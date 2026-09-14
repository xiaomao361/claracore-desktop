// Synthetic, isolated SQL stage diagnostics; cumulative CTE timings are not
// additive. EXPLAIN and isolated stages may differ from the full query plan.
const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { performance } = require("perf_hooks");
const { ProductDatabase } = require("../core/db/database");
const { sqlString } = require("../core/db/helpers");
const { vector, prepareFixture } = require("./sqlite-vec-baseline");

async function main() {
  const size = Number(process.argv[2] || 50000);
  assert(Number.isInteger(size) && size > 0 && size <= 50000);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-vec-profile-"));
  const database = new ProductDatabase(path.join(root, "fixture.db"));
  const report = { size, dimension: 512, node: process.versions.node, cpu: os.cpus()[0].model, createdAt: new Date().toISOString(), filters: [] };
  try {
    await prepareFixture(database.dbPath, size);
    if (process.env.CLARACORE_VEC_PROFILE_NO_INDEX === "1") {
      await database.exec("DROP INDEX idx_memory_embeddings_space;");
      report.coveringIndexDisabled = true;
    }
    // Optional build diagnosis only on this generated fixture: its SQL string
    // literals contain no semicolons. Production execution is left untouched.
    if (process.env.CLARACORE_VEC_PROFILE_BUILD === "1") {
      const { DatabaseSync } = require("node:sqlite");
      report.buildStatements = [];
      database.sqlite = { DatabaseSync: class extends DatabaseSync {
        exec(sql) {
          if (!sql.includes("CREATE TEMP TABLE vector_input AS")) return super.exec(sql);
          for (const statement of sql.split(";").filter((part) => part.trim())) {
            const start = performance.now();
            super.exec(statement);
            report.buildStatements.push({ statement: statement.trim().slice(0, 110), elapsedMs: performance.now() - start });
          }
        }
      } };
    }
    database.vectorEngine = "sqlite-vec";
    database.createEmbedding = async () => ({ provider: "fixture", model: "baseline-512", vector: vector(0) });
    let captured;
    const original = database.queryVectorProjection.bind(database);
    database.queryVectorProjection = async (setup, select) => {
      const start = performance.now();
      const result = await original(setup, select);
      captured = { setup, select, elapsedMs: performance.now() - start };
      return result;
    };
    for (const filter of ["all", "codex"]) {
      const options = filter === "all" ? {} : { agentId: filter };
      const firstStart = performance.now();
      const first = await database.searchMemories("semantic baseline with no keyword match", 10, options);
      assert.equal(first.error, null, first.error);
      const firstMs = performance.now() - firstStart;
      const full = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const result = await database.searchMemories("semantic baseline with no keyword match", 10, options);
        assert.equal(result.error, null, result.error);
        full.push({ totalMs: performance.now() - start, projectionMs: captured.elapsedMs });
      }
      const connection = database.vectorConnection;
      assert(connection, "Profiling requires Node SQLite");
      const prefix = captured.select.slice(0, captured.select.indexOf("    SELECT json_object("));
      const stages = [];
      connection.exec("BEGIN IMMEDIATE;");
      try {
        const start = performance.now();
        connection.exec(captured.setup);
        stages.push({ stage: "query_setup", elapsedMs: performance.now() - start });
        for (const [stage, expression] of [["eligible", "count(*)"], ["nearest", "count(*)"], ["native_scores", "count(*)"], ["scored", "sum(search_score)"], ["ranked", "sum(search_score)"]]) {
          const sql = `${prefix} SELECT ${expression} AS value FROM ${stage};`;
          const start = performance.now();
          const result = connection.prepare(sql).get();
          stages.push({ stage, elapsedMs: performance.now() - start, value: result.value, plan: connection.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() });
        }
      } finally { connection.exec("ROLLBACK;"); }
      report.filters.push({ filter, firstMs, full, stages, fullPlan: connection.prepare(`EXPLAIN QUERY PLAN ${captured.select}`).all() });
      console.error(JSON.stringify({ filter, firstMs, full, stages: stages.map(({ plan, ...stage }) => stage) }));
    }
    if (process.env.CLARACORE_VEC_PROFILE_MUTATION === "1") {
      await database.exec(`UPDATE memory_embeddings SET vector_json=${sqlString(JSON.stringify(vector(0).map((value) => -value)))} WHERE memory_id='fixture-000000';`);
      const start = performance.now();
      const result = await database.searchMemories("semantic baseline with no keyword match", 10);
      assert.equal(result.error, null, result.error);
      assert(!result.results.some((row) => row.id === "fixture-000000"), "Changed source vector must not return a stale match");
      report.singleVectorUpdate = { nextSearchMs: performance.now() - start, status: result.vectorSearch, staleMatch: false };
      console.error(JSON.stringify(report.singleVectorUpdate));
    }
    const destination = path.resolve(__dirname, "../out", `sqlite-vec-profile-${process.argv[3] || "current"}.json`);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, JSON.stringify(report, null, 2) + "\n");
    console.log(destination);
  } finally { database.close(); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
