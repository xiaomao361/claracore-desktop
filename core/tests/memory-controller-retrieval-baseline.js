const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const fixture = require("../memory-controller/fixtures/retrieval-cases.json");
const { estimateTokens, percentile } = require("../memory-controller/evaluation");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-controller-baseline-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  await runtime.saveProductSettings(app, {
    "memory.embedding.provider": "disabled",
    "memory.embedding.model": ""
  });

  const ids = {};
  for (const memory of fixture.memories) {
    const created = await runtime.createProductMemory(app, memory);
    ids[memory.key] = created.id;
  }
  const { database } = await runtime.ensureProductCore(app);
  for (const relation of fixture.relations) {
    if (relation.kind === "supersedes") {
      await database.supersedeMemory({
        currentMemoryId: ids[relation.current],
        historicalMemoryId: ids[relation.historical],
        note: "Memory Controller isolated fixture"
      });
    } else {
      await database.createMemoryLink({
        fromMemoryId: ids[relation.from],
        toMemoryId: ids[relation.to],
        kind: relation.kind,
        strength: relation.strength,
        source: "manual",
        note: "Memory Controller isolated fixture"
      });
    }
  }
  for (const key of fixture.archive) {
    await database.archiveMemory(ids[key]);
  }

  const latencies = [];
  const caseReports = [];
  for (const testCase of fixture.cases) {
    const startedAt = process.hrtime.bigint();
    const result = await database.searchMemories(testCase.query, 3, { timeView: testCase.timeView });
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    latencies.push(latencyMs);
    const directIds = result.results.map((memory) => memory.id);
    const relatedIds = (result.related || []).map((entry) => entry.memory.id);
    for (const key of testCase.expectedDirect || []) {
      assert.ok(directIds.includes(ids[key]), `${testCase.id} missed direct Memory ${key}.`);
    }
    for (const key of testCase.expectedRelated || []) {
      assert.ok(relatedIds.includes(ids[key]), `${testCase.id} missed related Memory ${key}.`);
    }
    for (const key of testCase.excludedDirect || []) {
      assert.ok(!directIds.includes(ids[key]), `${testCase.id} leaked excluded Memory ${key}.`);
    }
    for (const key of testCase.excludedEverywhere || []) {
      assert.ok(!directIds.includes(ids[key]), `${testCase.id} leaked excluded Memory ${key}.`);
      assert.ok(!relatedIds.includes(ids[key]), `${testCase.id} leaked excluded related Memory ${key}.`);
    }
    const returnedText = result.results.map((memory) => `${memory.title}\n${memory.body}`).join("\n");
    caseReports.push({
      id: testCase.id,
      mode: result.mode,
      timeView: result.timeView,
      directCount: directIds.length,
      relatedCount: relatedIds.length,
      estimatedReturnedTokens: returnedText ? estimateTokens(returnedText) : 0,
      latencyMs,
      semanticFallbackError: result.error || null
    });
  }

  const report = {
    suite: "memory-controller-retrieval-baseline",
    isolation: "temporary Desktop database",
    caseCount: caseReports.length,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: Math.max(...latencies)
    },
    cases: caseReports
  };
  console.log(JSON.stringify(report, null, 2));
  database.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
