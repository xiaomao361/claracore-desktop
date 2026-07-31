const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { createSnapshotRuntime } = require("../runtime/snapshot");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-overview-performance-"));
  const paths = {
    appRoot: path.resolve(__dirname, "../.."),
    dataRoot: root,
    databasePath: path.join(root, "claracore.db"),
    backupsDir: path.join(root, "backups"),
    exportsDir: path.join(root, "exports"),
    runtimeDir: path.join(root, "runtime"),
    logsDir: path.join(root, "logs")
  };
  await Promise.all([paths.backupsDir, paths.exportsDir, paths.runtimeDir, paths.logsDir]
    .map((directory) => fs.mkdir(directory, { recursive: true })));
  const database = await initializeProductDatabase(paths.databasePath);
  try {
    await database.updateInnerLifeProfile({ agentId: "overview-agent", displayName: "Overview Agent" });
    for (let index = 0; index < 20; index += 1) {
      await database.createMemory({
        title: `Overview payload memory ${index}`,
        body: `payload-${String(index).padStart(2, "0")}-`.padEnd(4000, "x"),
        agentId: "overview-agent",
        labels: ["overview-payload"]
      });
    }
    for (let index = 0; index < 5; index += 1) {
      await database.submitInnerLifeInbox({
        agentId: "overview-agent",
        source: "overview-smoke",
        body: `inbox-${String(index).padStart(2, "0")}-`.padEnd(3000, "y")
      });
    }
    await database.exec(`
      INSERT INTO innerlife_events (id, agent_id, kind, body, status)
      VALUES ('overview-event', 'overview-agent', 'smoke', 'overview', 'processed');
      INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
      VALUES
        ('overview-thought-pending', 'overview-event', 'pending overview share', 'unreviewed'),
        ('overview-thought-used', 'overview-event', 'used overview share', 'reviewed');
      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body, created_at)
      VALUES
        ('overview-share-pending', 'overview-agent', 'overview-thought-pending', 'pending', 'pending overview share', datetime('now', '-1 minute')),
        ('overview-share-used', 'overview-agent', 'overview-thought-used', 'used', 'used overview share', CURRENT_TIMESTAMP);
    `);
    const liteSnapshot = await database.getInnerLifeSnapshotLite("all");
    assert(!Object.hasOwn(liteSnapshot, "recentShares"), "Lite snapshot should not load recent shares");
    assert(Object.hasOwn(liteSnapshot, "pendingInbox"), "Domain lite snapshot must retain its pendingInbox contract");
    let queryCalls = 0;
    const shareQueries = [];
    const query = database.query.bind(database);
    const listInnerLifeShares = database.listInnerLifeShares.bind(database);
    database.query = async (sql) => {
      queryCalls += 1;
      return query(sql);
    };
    database.listInnerLifeShares = async (status, ...args) => {
      shareQueries.push(status);
      return listInnerLifeShares(status, ...args);
    };
    const runtime = createSnapshotRuntime({ ensureProductCore: async () => ({ database, paths }) });
    const snapshot = await runtime.buildProductOverviewSnapshot({ isPackaged: false });
    const payloadBytes = Buffer.byteLength(JSON.stringify(snapshot));

    assert(queryCalls <= 30, `Overview exceeded 30 SQL reads: ${queryCalls}`);
    assert(payloadBytes <= 135 * 1024, `Overview exceeded 135 KiB: ${payloadBytes}`);
    assert.strictEqual(snapshot.overview, true);
    assert.strictEqual(snapshot.sharedLine.overview, true);
    assert.strictEqual(snapshot.innerLife.overview, true);
    assert.strictEqual(Object.hasOwn(snapshot, "memories"), false, "Overview must not duplicate recentMemories as memories");
    assert.strictEqual(snapshot.recentMemories.length, 20, "Overview recent Memory sample changed");
    assert.strictEqual(Object.hasOwn(snapshot.innerLife, "pendingInbox"), false, "Overview must expose waiting inbox rows once");
    assert.strictEqual(snapshot.innerLife.inbox.length, 5, "Overview inbox sample changed");
    assert.strictEqual(shareQueries.filter((status) => status === "pending").length, 1, "Lite snapshot should query pending shares once");
    assert.strictEqual(shareQueries.filter((status) => status === "all").length, 1, "Overview should query recent shares once at the view boundary");
    assert(snapshot.innerLife.pendingShares.some((share) => share.body === "pending overview share"));
    assert(!snapshot.innerLife.pendingShares.some((share) => share.body === "used overview share"));
    assert(snapshot.innerLife.recentShares.some((share) => share.body === "used overview share"));
    process.stdout.write(`${JSON.stringify({
      suite: "overview-snapshot-performance-smoke",
      snapshotQueryCalls: queryCalls,
      payloadBytes,
      thresholdBytes: 135 * 1024
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
