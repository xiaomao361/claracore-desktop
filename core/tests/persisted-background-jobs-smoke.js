const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-persisted-jobs-"));
  const databasePath = path.join(root, "claracore.db");
  let database = await initializeProductDatabase(databasePath);
  try {
    const memory = await database.createMemory({
      agentId: "jobs-smoke",
      title: "Persisted embedding job",
      body: "Embedding work must survive the request and process restart."
    });
    const started = await database.startInnerLifeSession({
      agentId: "jobs-smoke",
      externalSessionId: "persisted-afterthought-session"
    });
    database.innerLifeGenerate = async () => {
      throw new Error("Session end must not wait for model generation.");
    };
    const startedAt = performance.now();
    const ended = await database.endInnerLifeSession(started.session.id, {
      agentId: "jobs-smoke",
      summary: "Persist this afterthought and generate it after acknowledgement."
    });
    const acknowledgementMs = performance.now() - startedAt;
    assert.strictEqual(ended.afterthoughtJob?.status, "pending");
    assert(acknowledgementMs < 100, `Session end acknowledgement was too slow: ${acknowledgementMs} ms`);

    database.close();
    database = await initializeProductDatabase(databasePath);
    const pendingEmbeddingIds = await database.pendingEmbeddingMemoryIds(10);
    assert(pendingEmbeddingIds.includes(memory.id), "Pending embedding job did not survive database reopen.");
    database.innerLifeGenerate = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return "Model-generated afterthought completed by the persisted worker.";
    };
    const workerRuns = await Promise.all([
      database.processPendingSessionAfterthoughts(5),
      database.processPendingSessionAfterthoughts(5)
    ]);
    const processed = {
      processed: workerRuns.reduce((sum, result) => sum + result.processed, 0),
      results: workerRuns.flatMap((result) => result.results)
    };
    assert.strictEqual(processed.processed, 1, "Concurrent workers processed the same persisted job twice.");
    const share = await database.getInnerLifeShare(ended.share.id);
    assert(share.body.includes("persisted worker"), "Persisted afterthought worker did not update the queued share.");
    const job = await database.getInnerLifeInboxItem(ended.afterthoughtJob.id);
    assert.strictEqual(job.status, "processed");

    process.stdout.write(`${JSON.stringify({
      suite: "persisted-background-jobs-smoke",
      acknowledgementMs: Math.round(acknowledgementMs * 1000) / 1000,
      embeddingStatus: "pending-after-reopen",
      afterthoughtStatus: job.status,
      workerSource: processed.results[0]?.source
    }, null, 2)}\n`);
  } finally {
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
