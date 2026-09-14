const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { performance } = require("perf_hooks");
const { initializeProductDatabase, ProductDatabase } = require("../core/db/database");
const { sqlString } = require("../core/db/helpers");

function vector(index) {
  let seed = (index + 1) >>> 0;
  const values = Array.from({ length: 512 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  });
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return values.map((value) => value / norm);
}

async function measure(dbPath, engine) {
  const database = new ProductDatabase(dbPath);
  database.vectorEngine = engine;
  // Keep disposable caches inside the parent-owned fixture root. A timed-out
  // child cannot run finally; the parent must still be able to clean its cache.
  if (engine === "sqlite-vec") database.vectorCacheRoot = await fs.mkdtemp(path.join(path.dirname(dbPath), "projection-"));
  const measurements = [];
  const samples = Number(process.env.CLARACORE_VEC_BASELINE_SAMPLES || 20);
  assert(Number.isInteger(samples) && samples >= 5 && samples <= 100);
  try {
    for (const filter of ["all", "codex"]) {
      let queryVector = vector(17);
      database.createEmbedding = async () => ({ provider: "fixture", model: "baseline-512", vector: queryVector });
      const options = filter === "all" ? {} : { agentId: filter };
      const firstStart = performance.now();
      const first = await database.searchMemories("semantic baseline with no keyword match", 10, options);
      assert.equal(first.error, null, first.error);
      const firstMs = performance.now() - firstStart;
      const times = [];
      const matches = [];
      for (let i = 0; i < samples; i += 1) {
        queryVector = vector(i * 10);
        const start = performance.now();
        const result = await database.searchMemories("semantic baseline with no keyword match", 10, options);
        times.push(performance.now() - start);
        assert.equal(result.error, null, result.error);
        matches.push(result.results.map((row) => row.id));
      }
      times.sort((a, b) => a - b);
      measurements.push({ filter, samples: times.length, firstMs, p50: times[Math.ceil(samples * 0.5)-1], p95: times[Math.ceil(samples * 0.95)-1], rssBytes: process.memoryUsage().rss, matches });
    }
  } finally { database.close(); }
  return { engine, measurements };
}

async function prepareFixture(dbPath, size) {
  const database = await initializeProductDatabase(dbPath);
  try {
    for (let offset = 0; offset < size; offset += 200) {
      const rows = Array.from({ length: Math.min(200, size - offset) }, (_, n) => {
        const index = offset + n;
        const id = `fixture-${String(index).padStart(6, "0")}`;
        return { id, index, json: JSON.stringify(vector(index)) };
      });
      await database.exec(`BEGIN IMMEDIATE;
        INSERT INTO memories(id,title,body) VALUES ${rows.map((row) => `(${sqlString(row.id)},'fixture','fixture')`).join(",")};
        INSERT INTO memory_labels(memory_id,label) VALUES ${rows.map((row) => `(${sqlString(row.id)},${sqlString(`agent-id:${row.index % 10 ? "other" : "codex"}`)})`).join(",")};
        INSERT INTO memory_embeddings(memory_id,provider,model,dimension,status,vector_json) VALUES ${rows.map((row) => `(${sqlString(row.id)},'fixture','baseline-512',512,'ready',${sqlString(row.json)})`).join(",")};
        COMMIT;`);
    }
  } finally { database.close(); }
}

async function main() {
  if (process.argv[2] === "--child") {
    console.log(JSON.stringify(await measure(process.argv[3], process.argv[4])));
    return;
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-vec-baseline-"));
  const sizes = process.argv.slice(2).map(Number);
  if (!sizes.length) sizes.push(1000, 10000, 50000);
  assert(sizes.every((size) => Number.isInteger(size) && size > 0 && size <= 50000));
  const report = {
    suite: "sqlite-vec-baseline", createdAt: new Date().toISOString(),
    node: process.versions.node, platform: process.platform, arch: process.arch,
    cpu: os.cpus()[0].model, dimension: 512,
    note: "Deterministic synthetic corpus. Separate processes per engine. Search includes keyword lookup and result shaping, but embedding generation is stubbed. firstMs includes projection build only for the first native query. RSS is a snapshot, not peak memory. No live data.",
    results: []
  };
  await fs.mkdir(path.resolve(__dirname, "../out"), { recursive: true });
  const reportPath = path.resolve(__dirname, "../out/sqlite-vec-baseline.json");
  const save = () => fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  let failed = false;
  try {
    for (const size of sizes) {
      console.error(`Preparing ${size} synthetic vectors`);
      const dbPath = path.join(root, `fixture-${size}.db`);
      await prepareFixture(dbPath, size);
      const engines = [];
      const entry = { size, engines, parity: "unverified" };
      report.results.push(entry);
      for (const engine of ["legacy", "sqlite-vec"]) {
        console.error(`Measuring ${size} / ${engine}`);
        const timeout = Number(process.env.CLARACORE_VEC_BASELINE_TIMEOUT_MS || 60000);
        assert(Number.isInteger(timeout) && timeout >= 1000 && timeout <= 300000);
        const child = spawnSync(process.execPath, [__filename, "--child", dbPath, engine], { encoding: "utf8", timeout });
        if (child.error || child.status !== 0) {
          failed = true;
          engines.push({ engine, status: "failed", timeoutMs: timeout, error: child.error?.message || child.stderr || `exit ${child.status}`, measurements: [] });
        } else engines.push({ ...JSON.parse(child.stdout), status: "passed" });
        await save();
      }
      if (engines.every((engine) => engine.status === "passed")) {
        for (let i = 0; i < 2; i += 1) {
          assert.deepEqual(engines[0].measurements[i].matches, engines[1].measurements[i].matches, "Both engines must return the same IDs before comparing latency");
        }
        entry.parity = "passed";
      }
      await save();
    }
    report.status = failed ? "incomplete" : "measured";
    await save();
    console.log(JSON.stringify({ reportPath, status: report.status, results: report.results.map(({ size, parity, engines }) => ({ size, parity, engines: engines.map(({ measurements, ...rest }) => ({ ...rest, measurements: measurements.map(({ matches: _matches, ...values }) => values) })) })) }, null, 2));
    if (failed) process.exitCode = 1;
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { vector, prepareFixture };
