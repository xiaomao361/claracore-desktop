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
    let queryCalls = 0;
    const query = database.query.bind(database);
    database.query = async (sql) => {
      queryCalls += 1;
      return query(sql);
    };
    const runtime = createSnapshotRuntime({ ensureProductCore: async () => ({ database, paths }) });
    const snapshot = await runtime.buildProductOverviewSnapshot({ isPackaged: false });
    const payloadBytes = Buffer.byteLength(JSON.stringify(snapshot));

    assert(queryCalls <= 30, `Overview exceeded 30 SQL reads: ${queryCalls}`);
    assert(payloadBytes <= 200 * 1024, `Overview exceeded 200 KiB: ${payloadBytes}`);
    assert.strictEqual(snapshot.overview, true);
    assert.strictEqual(snapshot.sharedLine.overview, true);
    assert.strictEqual(snapshot.innerLife.overview, true);
    process.stdout.write(`${JSON.stringify({
      suite: "overview-snapshot-performance-smoke",
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
