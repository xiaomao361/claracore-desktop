const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { ProductDatabase } = require("../db/database");
const runtime = require("../runtime");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-backup-restore-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  const before = await runtime.createProductMemory(app, {
    title: "Backup restore before A",
    body: "This record should return after restore.",
    labels: "backup, restore"
  });
  await runtime.saveProductSharedLine(app, {
    summary: "Backup restore shared line checkpoint.",
    interpretationStatus: "confirmed",
    factsUsed: [before.id]
  });

  const backup = await runtime.createProductBackup(app);
  if (backup.status !== "verified") throw new Error(`Backup was not verified: ${backup.status}`);
  if (!backup.metadata?.manifestPath) throw new Error("Backup manifest path is missing.");
  await fs.access(backup.path);
  await fs.access(backup.metadata.manifestPath);
  const manifest = JSON.parse(await fs.readFile(backup.metadata.manifestPath, "utf8"));
  if (manifest.status !== "verified") throw new Error("Backup manifest does not record verified status.");
  if (manifest.verification?.quickCheck !== "ok") throw new Error("Backup manifest quick_check is not ok.");

  const backupDatabase = new ProductDatabase(backup.path);
  const quickRows = await backupDatabase.query("PRAGMA quick_check;");
  const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
  if (quickCheck !== "ok") throw new Error(`Backup database quick_check failed: ${quickCheck}`);
  const backupMemories = await backupDatabase.listMemories(20);
  if (!backupMemories.some((memory) => memory.id === before.id)) {
    throw new Error("Backup database does not contain the checkpoint Memory.");
  }

  await runtime.deleteProductMemory(app, before.id);
  const after = await runtime.createProductMemory(app, {
    title: "Backup restore after B",
    body: "This record should disappear after restore.",
    labels: "backup, restore"
  });

  const preview = await runtime.previewProductRestore(app, backup.id);
  if (preview.quickCheck !== "ok") throw new Error("Restore preview quick_check is not ok.");
  if (!preview.memoryDiff.restored.some((row) => row.id === before.id)) {
    throw new Error(`Restore preview does not show checkpoint Memory returning: ${JSON.stringify(preview.memoryDiff)}`);
  }
  if (!preview.memoryDiff.removed.some((row) => row.id === after.id)) {
    throw new Error(`Restore preview does not show post-backup Memory removal: ${JSON.stringify(preview.memoryDiff)}`);
  }

  const restored = await runtime.restoreProductBackup(app, backup.id);
  if (!restored.restored) throw new Error("Restore result did not report restored=true.");
  if (!restored.safetyBackup?.id || restored.safetyBackup.status !== "verified") {
    throw new Error("Restore did not create a verified safety backup.");
  }
  await fs.access(restored.safetyBackup.path);

  const restoredSearch = await runtime.searchProductMemories(app, "Backup restore before A");
  if (!restoredSearch.results.some((memory) => memory.id === before.id)) {
    throw new Error("Restore did not bring back the checkpoint Memory.");
  }
  const removedSearch = await runtime.searchProductMemories(app, "Backup restore after B");
  if (removedSearch.results.some((memory) => memory.id === after.id)) {
    throw new Error("Restore did not remove the post-backup Memory.");
  }
  const snapshot = await runtime.buildProductSnapshot(app);
  if (!snapshot.data.databasePath.startsWith(dataRoot)) {
    throw new Error(`Restored database escaped product data root: ${snapshot.data.databasePath}`);
  }
  if (!snapshot.backups.some((item) => item.id === restored.safetyBackup.id && item.status === "verified")) {
    throw new Error("Restored database did not re-register the verified safety backup.");
  }
  if (snapshot.sharedLine.currentPosition.summary !== "Backup restore shared line checkpoint.") {
    throw new Error("Restore did not recover the Shared Line checkpoint.");
  }
  const events = await (await runtime.ensureProductCore(app)).database.query(`
    SELECT message
    FROM runtime_events
    WHERE source = 'backup'
    ORDER BY created_at DESC
    LIMIT 5;
  `);
  if (!events.some((event) => event.message === "Database restored from verified backup")) {
    throw new Error("Restore runtime event was not recorded.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dataRoot,
        backupPath: backup.path,
        manifestPath: backup.metadata.manifestPath,
        safetyBackupPath: restored.safetyBackup.path,
        restoredMemoryId: before.id,
        removedMemoryId: after.id
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
