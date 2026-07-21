const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const runtime = require("../core/runtime");
const { sqliteCommand } = require("../core/sqlite-binary");

const execFileAsync = promisify(execFile);
const FIXTURES = [
  { id: "controller-history", query: "我们之前对 Memory Controller 做了什么决定？" },
  { id: "shared-line-continuation", query: "继续上次共同线里的实现。" },
  { id: "runtime-policy", query: "ClaraCore Desktop runtime performance policy" },
  { id: "stable-preference", query: "我之前确认过的稳定偏好是什么？" },
  { id: "knowledge-reuse", query: "查找可以复用的知识卡片。" }
];

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function summarize(values) {
  const safe = values.map(Number).filter(Number.isFinite);
  const round = (value) => Math.round(value * 1000) / 1000;
  return {
    count: safe.length,
    average: round(safe.reduce((sum, value) => sum + value, 0) / Math.max(1, safe.length)),
    p50: round(percentile(safe, 0.5)),
    p95: round(percentile(safe, 0.95)),
    max: round(safe.length ? Math.max(...safe) : 0)
  };
}

async function consistentDatabaseCopy(source, destination) {
  const escapedDestination = destination.replaceAll("'", "''");
  await execFileAsync(sqliteCommand(), [source, `.backup '${escapedDestination}'`]);
}

async function main() {
  const sourceDatabase = String(process.env.CLARACORE_PERFORMANCE_DB || "").trim();
  if (!sourceDatabase) throw new Error("CLARACORE_PERFORMANCE_DB is required.");
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-retrieval-baseline-"));
  const databasePath = path.join(dataRoot, "claracore.db");
  await consistentDatabaseCopy(path.resolve(sourceDatabase), databasePath);
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  try {
    const { database } = await runtime.ensureProductCore(app);
    const settings = await database.getSettings();
    const phaseState = { current: null };
    for (const [method, phase] of [
      ["listMemories", "keyword"],
      ["createEmbedding", "embedding"],
      ["vectorMemoryCandidates", "vectorCandidates"],
      ["annotateMemoryStates", "annotation"],
      ["getMemoryNeighbors", "neighbors"]
    ]) {
      const original = database[method].bind(database);
      database[method] = async (...args) => {
        const startedAt = performance.now();
        try {
          return await original(...args);
        } finally {
          if (phaseState.current) phaseState.current[phase] = (phaseState.current[phase] || 0) + performance.now() - startedAt;
        }
      };
    }

    const samples = [];
    for (const fixture of FIXTURES) {
      for (const pass of ["cold", "repeat"]) {
        const phases = {};
        phaseState.current = phases;
        const startedAt = performance.now();
        const result = await database.searchMemories(fixture.query, 3, { timeView: "current" });
        const searchMs = performance.now() - startedAt;
        phaseState.current = null;
        const eligibilityStartedAt = performance.now();
        const eligibleIds = await database.getMemoryControlEligibleIds({
          ids: (result.results || []).slice(0, 3).map((item) => item.id),
          timeView: "current",
          sensitivityScope: "normal"
        });
        samples.push({
          fixture: fixture.id,
          pass,
          mode: result.mode,
          resultCount: result.results?.length || 0,
          relatedCount: result.related?.length || 0,
          providerFallback: Boolean(result.error),
          searchMs,
          eligibilityMs: performance.now() - eligibilityStartedAt,
          phases
        });
      }
    }

    const phaseNames = ["keyword", "embedding", "vectorCandidates", "annotation", "neighbors"];
    const summary = {
      search: summarize(samples.map((sample) => sample.searchMs)),
      eligibility: summarize(samples.map((sample) => sample.eligibilityMs)),
      coldSearch: summarize(samples.filter((sample) => sample.pass === "cold").map((sample) => sample.searchMs)),
      repeatSearch: summarize(samples.filter((sample) => sample.pass === "repeat").map((sample) => sample.searchMs)),
      phases: Object.fromEntries(phaseNames.map((phase) => [phase, summarize(samples.map((sample) => sample.phases[phase] || 0))]))
    };
    const sanitizedSamples = samples.map((sample) => ({
      fixture: sample.fixture,
      pass: sample.pass,
      mode: sample.mode,
      resultCount: sample.resultCount,
      relatedCount: sample.relatedCount,
      providerFallback: sample.providerFallback,
      searchMs: Math.round(sample.searchMs * 1000) / 1000,
      eligibilityMs: Math.round(sample.eligibilityMs * 1000) / 1000,
      phases: Object.fromEntries(Object.entries(sample.phases).map(([phase, value]) => [phase, Math.round(value * 1000) / 1000]))
    }));
    console.log(JSON.stringify({
      ok: true,
      suite: "memory-retrieval-performance-baseline",
      source: "consistent temporary copy",
      databaseBytes: (await fs.stat(databasePath)).size,
      fixtureCount: FIXTURES.length,
      passesPerFixture: 2,
      provider: settings["memory.embedding.provider"] || "claracore-built-in",
      model: settings["memory.embedding.model"] || "",
      summary,
      samples: sanitizedSamples,
      privacy: "Only maintained synthetic fixture ids and timing/count metadata are emitted; live Memory content and ids are not output."
    }, null, 2));
  } finally {
    runtime.resetCachedDatabase();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
