const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-pending-maintenance-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
  const runtime = require("../runtime");
  const { sqlString } = require("../db/helpers");
  const app = { isPackaged: false, getPath: name => path.join(root, name) };
  let database;
  try {
    await runtime.saveProductSettings(app, {
      "innerlife.provider": "disabled", "memory.embedding.provider": "ollama",
      "memory.embedding.model": "fixture-only", "memory.embedding.dimension": 2
    });
    ({ database } = await runtime.ensureProductCore(app));
    assert.equal((await database.getMemoryMaintenanceReport()).status, "ok");
    const memory = await database.createMemory({ title: "Pending audit", body: "An unfinished embedding must remain visible." });
    // Matching timestamps reproduce the old blind spot, without also being stale.
    await database.exec(`UPDATE memories SET updated_at = CURRENT_TIMESTAMP WHERE id = ${sqlString(memory.id)};
      UPDATE memory_embeddings SET embedded_at = CURRENT_TIMESTAMP WHERE memory_id = ${sqlString(memory.id)};`);
    for (const excluded of ["restricted", "archived", "deleted"]) {
      const item = await database.createMemory({ title: excluded, body: "Excluded pending fixture" });
      await database.exec(`UPDATE memories SET ${excluded === "restricted" ? "sensitivity" : "status"} = ${sqlString(excluded)} WHERE id = ${sqlString(item.id)};`);
    }
    const waiting = await database.getMemoryMaintenanceReport();
    assert.equal(waiting.status, "pending");
    assert.equal(waiting.counts.pendingEmbeddings, 1);
    assert.equal(waiting.counts.missingEmbeddings, 0);
    assert.equal(waiting.counts.failedEmbeddings, 0);
    assert.deepEqual(waiting.issues, [], "Waiting is not a failed embedding");
    assert.equal((await database.getMemoryAuditReport()).status, "needs_review");
    const persisted = await database.query("SELECT * FROM memory_embeddings ORDER BY memory_id;");
    const dry = await runtime.runProductMemoryMaintenance(app, { dryRun: true });
    assert.equal(dry.after.status, "pending");
    assert.equal(dry.embeddings, null);
    assert.deepEqual(await database.query("SELECT * FROM memory_embeddings ORDER BY memory_id;"), persisted);
    const queued = await database.runMemoryMaintenance();
    assert.deepEqual(queued.actions, [], "Existing pending jobs need consumption, not a timestamp reset");
    assert.deepEqual(await database.query("SELECT * FROM memory_embeddings ORDER BY memory_id;"), persisted);

    let calls = 0;
    database.createEmbedding = async () => {
      calls += 1;
      return { provider: "ollama", model: "fixture-only", vector: [1, 0] };
    };
    const repaired = await runtime.runProductMemoryMaintenance(app, { scheduled: true });
    assert.equal(repaired.before.status, "pending");
    assert.equal(repaired.embeddings.processed, 1);
    assert.equal(repaired.after.status, "ok");
    assert.equal(repaired.after.counts.pendingEmbeddings, 0);
    assert.equal(calls, 1, "Excluded records must not be embedded");
    assert.equal((await database.getMemoryAuditReport()).status, "ok");

    await database.markMemoryEmbeddingPending(memory.id);
    await database.createMemory({ title: "Second queued item", body: "A bounded batch can leave unfinished work." });
    const partial = await runtime.runProductMemoryMaintenance(app, { embeddingLimit: 1 });
    assert.equal(partial.embeddings.processed, 1);
    assert.equal(partial.after.status, "pending");
    assert.equal(partial.after.counts.pendingEmbeddings, 1);
    database.createEmbedding = async () => { throw new Error("fixture provider unavailable"); };
    const failed = await runtime.runProductMemoryMaintenance(app);
    assert.equal(failed.embeddings.results[0].ok, false);
    assert.equal(failed.after.status, "needs_repair");
    assert.equal(failed.after.counts.failedEmbeddings, 1);
    assert.equal(failed.after.counts.pendingEmbeddings, 0);
    assert(failed.after.issues.some(issue => issue.code === "failed_embeddings"));

    await database.exec("UPDATE memories SET status = 'archived' WHERE status = 'active';");
    await database.updateSettings({ "memory.embedding.provider": "disabled" });
    await database.createMemory({ title: "Paused queue", body: "Disabled processing must not imply that a job failed." });
    const paused = await runtime.runProductMemoryMaintenance(app);
    assert.equal(paused.embeddings.processed, 0);
    assert.equal(paused.after.status, "pending");
    assert.equal(paused.after.counts.pendingEmbeddings, 1);
    assert.equal(paused.after.counts.failedEmbeddings, 0);
    console.log(JSON.stringify({ suite: "memory-maintenance-pending", passed: true,
      sqlite: process.env.CLARACORE_DESKTOP_DISABLE_NODE_SQLITE === "1" ? "cli" : "node",
      pendingVisible: true, finalSnapshot: true, partialAndFailedDistinct: true, excludedAndDisabledPreserved: true }));
  } finally {
    database?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
