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
  await runtime.saveProductSettings(app, {
    "memory.controller.mode": "observe",
    "memory.controller.canary_agent_ids": ["*"]
  });
  const sourceDatabase = (await runtime.ensureProductCore(app)).database;
  const controllerDecision = await sourceDatabase.recordMemoryControlEvent({
    policyVersion: "v0.6.0-backup-smoke",
    policyMode: "observe",
    agentId: "codex",
    clientId: "backup-smoke",
    conversationId: "backup-controller",
    queryHash: "backup-controller",
    queryPreview: "还记得备份里的 Controller 决策吗",
    stageAAction: "RETRIEVE",
    stageAReason: "prior_context",
    stageBAction: "INJECT_TOP1",
    stageBReason: "top_candidate",
    candidates: [{ id: before.id, score: 0.9 }],
    resultStatus: "completed",
    totalLatencyMs: 8
  });
  await sourceDatabase.recordMemoryControlFeedback({
    decisionId: controllerDecision.id,
    feedbackType: "outcome_unknown",
    source: "backup-smoke",
    conversationId: "backup-controller",
    memoryIds: [before.id],
    idempotencyKey: "backup-controller-feedback"
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
  const backupController = await backupDatabase.getMemoryControlObservationSnapshot({ limit: 5 });
  if (backupController.eventCount !== 1 || backupController.feedbackCount !== 1 || backupController.recent[0]?.id !== controllerDecision.id) {
    throw new Error(`Backup database does not contain Controller evidence: ${JSON.stringify(backupController)}`);
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
  if (snapshot.memoryController.mode !== "observe" || snapshot.memoryController.eventCount !== 1 || snapshot.memoryController.feedbackCount !== 1) {
    throw new Error(`Restore did not recover Memory Controller state: ${JSON.stringify(snapshot.memoryController)}`);
  }
  if (JSON.stringify(snapshot.configuration.memoryController.canaryAgentIds) !== JSON.stringify(["*"])) {
    throw new Error(`Restore did not recover the canary allowlist: ${JSON.stringify(snapshot.configuration.memoryController)}`);
  }

  const productJson = await runtime.exportProductDataJson(app, {});
  await fs.access(productJson.path);
  const productJsonPayload = JSON.parse(await fs.readFile(productJson.path, "utf8"));
  if (productJsonPayload.format !== "claracore.product.export" || productJsonPayload.version !== 1) {
    throw new Error(`Product JSON export format mismatch: ${JSON.stringify(productJsonPayload).slice(0, 300)}`);
  }
  if (!productJsonPayload.tables?.memories?.some((memory) => memory.id === before.id)) {
    throw new Error("Product JSON export did not include the restored Memory.");
  }
  if (!productJsonPayload.tables?.memory_control_events?.some((event) => event.id === controllerDecision.id)) {
    throw new Error("Product JSON export did not include Memory Controller decisions.");
  }
  if (productJsonPayload.tables?.memory_control_feedback?.length !== 1) {
    throw new Error("Product JSON export did not include Memory Controller feedback.");
  }
  const exportedControllerAllowlist = productJsonPayload.tables?.app_settings
    ?.find((setting) => setting.key === "memory.controller.canary_agent_ids");
  if (exportedControllerAllowlist?.value_json !== JSON.stringify(["*"])) {
    throw new Error(`Product JSON export did not include the canary allowlist: ${JSON.stringify(exportedControllerAllowlist)}`);
  }
  const afterJson = await runtime.createProductMemory(app, {
    title: "Product JSON after C",
    body: "This record should disappear after product JSON import.",
    labels: "json, restore"
  });
  const preImportDatabase = (await runtime.ensureProductCore(app)).database;
  await preImportDatabase.recordMemoryControlEvent({
    policyVersion: "v0.6.0-backup-smoke",
    policyMode: "observe",
    agentId: "codex",
    clientId: "backup-smoke",
    conversationId: "post-export-controller",
    queryHash: "post-export-controller",
    queryPreview: "This decision should disappear after JSON import.",
    stageAAction: "NOOP",
    stageAReason: "ordinary_task",
    resultStatus: "completed"
  });
  const jsonImported = await runtime.importProductDataJson(app, { filePath: productJson.path });
  if (!jsonImported.imported || jsonImported.quickCheck !== "ok") {
    throw new Error(`Product JSON import failed: ${JSON.stringify(jsonImported)}`);
  }
  const jsonRestoredSearch = await runtime.searchProductMemories(app, "Backup restore before A");
  if (!jsonRestoredSearch.results.some((memory) => memory.id === before.id)) {
    throw new Error("Product JSON import did not restore exported Memory.");
  }
  const jsonRemovedSearch = await runtime.searchProductMemories(app, "Product JSON after C");
  if (jsonRemovedSearch.results.some((memory) => memory.id === afterJson.id)) {
    throw new Error("Product JSON import did not replace post-export Memory.");
  }
  const importedSnapshot = await runtime.buildProductSnapshot(app);
  const importedController = importedSnapshot.memoryController;
  if (importedController.eventCount !== 1 || importedController.feedbackCount !== 1 || importedController.recent[0]?.id !== controllerDecision.id) {
    throw new Error(`Product JSON import did not restore Controller evidence exactly: ${JSON.stringify(importedController)}`);
  }
  if (JSON.stringify(importedSnapshot.configuration.memoryController.canaryAgentIds) !== JSON.stringify(["*"])) {
    throw new Error(`Product JSON import did not restore the canary allowlist: ${JSON.stringify(importedSnapshot.configuration.memoryController)}`);
  }

  const disposableBackup = await runtime.createProductBackup(app);
  const disposableManifestPath = disposableBackup.metadata.manifestPath;
  await fs.access(disposableBackup.path);
  await fs.access(disposableManifestPath);
  const deletedBackup = await runtime.deleteProductBackup(app, disposableBackup.id);
  if (!deletedBackup.deleted || deletedBackup.backup.id !== disposableBackup.id) {
    throw new Error(`Backup delete did not report success: ${JSON.stringify(deletedBackup)}`);
  }
  let backupFileStillExists = true;
  try {
    await fs.access(disposableBackup.path);
  } catch (_error) {
    backupFileStillExists = false;
  }
  if (backupFileStillExists) throw new Error("Backup delete did not remove the .db file.");
  let manifestStillExists = true;
  try {
    await fs.access(disposableManifestPath);
  } catch (_error) {
    manifestStillExists = false;
  }
  if (manifestStillExists) throw new Error("Backup delete did not remove the manifest file.");
  const afterDeleteSnapshot = await runtime.buildProductSnapshot(app);
  if (afterDeleteSnapshot.backups.some((item) => item.id === disposableBackup.id)) {
    throw new Error("Backup delete did not remove the backup record.");
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
        productJsonPath: productJson.path,
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
