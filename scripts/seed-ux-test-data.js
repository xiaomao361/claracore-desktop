#!/usr/bin/env node

const os = require("os");
const path = require("path");
const runtime = require("../core/runtime");
const { seedDemoFixture, clearDemoFixture } = require("../core/runtime/demo-data");
const { defaultUserDataPath } = require("../core/platform-paths");

const DEFAULT_NEXT_DATA_ROOT = path.join(os.homedir(), "Library", "Application Support", "claracore-desktop-next", "data");

function createCliApp() {
  const userData = process.env.CLARACORE_DESKTOP_USER_DATA_DIR || defaultUserDataPath();
  return {
    isPackaged: false,
    getPath(name) {
      if (name === "userData") return userData;
      if (name === "home") return os.homedir();
      return path.join(userData, name);
    }
  };
}

async function main() {
  if (!process.env.CLARACORE_DESKTOP_DATA_DIR) {
    process.env.CLARACORE_DESKTOP_DATA_DIR = DEFAULT_NEXT_DATA_ROOT;
  }
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = process.env.CLARACORE_DESKTOP_TEST_INSTANCE || "1";

  const app = createCliApp();
  const beforeBackup = await runtime.createProductBackup(app);
  const { paths, database } = await runtime.ensureProductCore(app);
  const clearing = process.argv.includes("--clear");

  if (clearing) {
    await clearDemoFixture(database);
  } else {
    await seedDemoFixture(database, { dataRoot: paths.dataRoot });
  }

  const snapshot = await runtime.buildProductSnapshot(app);
  const result = {
    ok: true,
    cleared: clearing || undefined,
    dataRoot: paths.dataRoot,
    databasePath: paths.databasePath,
    [clearing ? "backupBeforeClear" : "backupBeforeSeed"]: {
      id: beforeBackup.id,
      path: beforeBackup.path,
      status: beforeBackup.status
    },
    counts: {
      memories: snapshot.memoryStats?.activeCount ?? 0,
      pendingVectors: clearing ? undefined : snapshot.memoryStats?.pendingEmbeddingCount ?? 0,
      failedVectors: clearing ? undefined : snapshot.memoryStats?.failedEmbeddingCount ?? 0,
      sharedLines: snapshot.sharedLine?.lines?.length ?? 0,
      pendingShares: snapshot.innerLife?.counts?.pending_shares_count ?? 0,
      gatewayTraces: snapshot.gatewayTraces?.length ?? 0
    }
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exit(1);
});
