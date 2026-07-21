const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { createSnapshotRuntime } = require("../runtime/snapshot");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-logs-snapshot-performance-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  try {
    await database.recordRuntimeEvent({ level: "info", source: "smoke", message: "Logs snapshot smoke" });
    await database.recordGatewayTrace({ agentId: "logs-smoke", toolName: "gateway_context", status: "ok", durationMs: 4 });
    let queryCalls = 0;
    const query = database.query.bind(database);
    database.query = async (sql) => {
      queryCalls += 1;
      return query(sql);
    };
    const runtime = createSnapshotRuntime({
      ensureProductCore: async () => ({ database, paths: { dataRoot: root } })
    });
    const before = JSON.stringify(await Promise.all([
      query("SELECT * FROM runtime_events ORDER BY rowid;"),
      query("SELECT * FROM gateway_traces ORDER BY rowid;")
    ]));
    queryCalls = 0;
    const snapshot = await runtime.buildProductLogsSnapshot({});
    const payloadBytes = Buffer.byteLength(JSON.stringify(snapshot));
    const after = JSON.stringify(await Promise.all([
      query("SELECT * FROM runtime_events ORDER BY rowid;"),
      query("SELECT * FROM gateway_traces ORDER BY rowid;")
    ]));

    assert(queryCalls <= 2, `Logs snapshot exceeded two reads: ${queryCalls}`);
    assert(payloadBytes <= 100 * 1024, `Logs snapshot exceeded 100 KiB: ${payloadBytes}`);
    assert.strictEqual(before, after, "Logs snapshot mutated observed tables.");
    assert.strictEqual(snapshot.runtimeEvents.length, 1);
    assert.strictEqual(snapshot.gatewayTraces.length, 1);
    process.stdout.write(`${JSON.stringify({
      suite: "logs-snapshot-performance-smoke",
      snapshotQueryCalls: queryCalls,
      payloadBytes
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
