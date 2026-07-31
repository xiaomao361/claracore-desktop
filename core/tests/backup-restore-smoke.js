const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { ProductDatabase } = require("../db/database");
const runtime = require("../runtime");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function runSafetyBackupBarrierRace({ app, databasePath, label, operation, writeInput }) {
  const resolvedDatabasePath = path.resolve(databasePath);
  const backupEntered = deferred();
  const releaseBackup = deferred();
  const copyEntered = deferred();
  const releaseCopy = deferred();
  const originalCreateDatabaseBackup = ProductDatabase.prototype.createDatabaseBackup;
  const originalCopyFile = fs.copyFile;
  const originalInitialize = ProductDatabase.prototype.initialize;
  let backupIntercepted = false;
  let copyIntercepted = false;
  let copyBlocked = false;
  let mainInitializationsWhileCopyBlocked = 0;
  let operationPromise = null;
  let writePromise = null;
  let concurrentEnsure = null;

  ProductDatabase.prototype.createDatabaseBackup = async function instrumentedCreateDatabaseBackup(...args) {
    if (!backupIntercepted && path.resolve(this.dbPath) === resolvedDatabasePath) {
      backupIntercepted = true;
      backupEntered.resolve();
      await releaseBackup.promise;
    }
    return originalCreateDatabaseBackup.apply(this, args);
  };
  fs.copyFile = async (...args) => {
    const destination = path.resolve(String(args[1] || ""));
    if (!copyIntercepted && destination === resolvedDatabasePath) {
      copyIntercepted = true;
      copyBlocked = true;
      copyEntered.resolve();
      await releaseCopy.promise;
    }
    return originalCopyFile(...args);
  };
  ProductDatabase.prototype.initialize = async function instrumentedInitialize(...args) {
    if (copyBlocked && path.resolve(this.dbPath) === resolvedDatabasePath) {
      mainInitializationsWhileCopyBlocked += 1;
    }
    return originalInitialize.apply(this, args);
  };

  try {
    operationPromise = Promise.resolve().then(operation);
    operationPromise.then(
      () => {
        if (!backupIntercepted) backupEntered.reject(new Error(`${label} completed without creating an exclusive safety backup.`));
        if (!copyIntercepted) copyEntered.reject(new Error(`${label} completed without replacing the Product Core database.`));
      },
      (error) => {
        backupEntered.reject(error);
        copyEntered.reject(error);
      }
    );
    await backupEntered.promise;

    let writeSettled = false;
    writePromise = runtime.createProductMemory(app, writeInput);
    writePromise.then(
      () => {
        writeSettled = true;
      },
      () => {
        writeSettled = true;
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    if (writeSettled) {
      throw new Error(`${label} allowed a concurrent write to cross the safety-backup barrier.`);
    }

    releaseBackup.resolve();
    await copyEntered.promise;
    let concurrentEnsureSettled = false;
    concurrentEnsure = runtime.ensureProductCore(app);
    concurrentEnsure.then(
      () => {
        concurrentEnsureSettled = true;
      },
      () => {
        concurrentEnsureSettled = true;
      }
    );
    await new Promise((resolve) => setImmediate(resolve));
    if (mainInitializationsWhileCopyBlocked !== 0) {
      throw new Error(
        `${label} allowed ${mainInitializationsWhileCopyBlocked} Product Core initialization(s) during file replacement.`
      );
    }
    if (concurrentEnsureSettled || writeSettled) {
      throw new Error(`${label} released a queued ensure or write before file replacement finished.`);
    }

    copyBlocked = false;
    releaseCopy.resolve();
    const [result, writtenMemory, concurrentCore] = await Promise.all([
      operationPromise,
      writePromise,
      concurrentEnsure
    ]);
    const warmCore = await runtime.ensureProductCore(app);
    if (concurrentCore.database !== warmCore.database) {
      throw new Error(`${label} did not release the concurrent ensure onto the adopted replacement database.`);
    }
    const finalSearch = await runtime.searchProductMemories(app, writeInput.title);
    if (!finalSearch.results.some((memory) => memory.id === writtenMemory.id)) {
      throw new Error(`${label} lost the write that waited behind the safety-backup barrier.`);
    }

    const safetyDatabase = new ProductDatabase(result.safetyBackup.path);
    try {
      const safetyMemories = await safetyDatabase.listMemories(1000);
      if (safetyMemories.some((memory) => memory.id === writtenMemory.id)) {
        throw new Error(`${label} let the waiting write enter the pre-close safety backup.`);
      }
    } finally {
      safetyDatabase.close();
    }
    return result;
  } finally {
    releaseBackup.resolve();
    copyBlocked = false;
    releaseCopy.resolve();
    ProductDatabase.prototype.createDatabaseBackup = originalCreateDatabaseBackup;
    ProductDatabase.prototype.initialize = originalInitialize;
    fs.copyFile = originalCopyFile;
    if (operationPromise) await operationPromise.catch(() => {});
    if (writePromise) await writePromise.catch(() => {});
    if (concurrentEnsure) await concurrentEnsure.catch(() => {});
  }
}

async function assertFailedProductCoreSwapRecovers({ app, databasePath, label, operation }) {
  const resolvedDatabasePath = path.resolve(databasePath);
  const originalCopyFile = fs.copyFile;
  const injectedError = new Error(`planned ${label} replacement failure`);
  let injected = false;

  fs.copyFile = async (...args) => {
    const destination = path.resolve(String(args[1] || ""));
    if (!injected && destination === resolvedDatabasePath) {
      injected = true;
      throw injectedError;
    }
    return originalCopyFile(...args);
  };

  let failure = null;
  try {
    await operation();
  } catch (error) {
    failure = error;
  } finally {
    fs.copyFile = originalCopyFile;
  }

  if (!injected) throw new Error(`${label} did not reach Product Core file replacement.`);
  if (failure !== injectedError) {
    throw new Error(`${label} did not preserve the original replacement error after recovery.`);
  }
  const { database } = await runtime.ensureProductCore(app);
  const quickRows = await database.query("PRAGMA quick_check;");
  const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
  if (quickCheck !== "ok") {
    throw new Error(`${label} left Product Core unusable after a failed replacement: ${quickCheck}`);
  }
}

async function assertPostOpenFailureRollsBack({
  app,
  databasePath,
  label,
  methodName,
  operation,
  verifyRecoveredData
}) {
  const resolvedDatabasePath = path.resolve(databasePath);
  const originalMethod = ProductDatabase.prototype[methodName];
  const injectedError = new Error(`planned ${label} ${methodName} failure`);
  let injected = false;

  ProductDatabase.prototype[methodName] = async function instrumentedPostOpenFailure(...args) {
    if (!injected && path.resolve(this.dbPath) === resolvedDatabasePath) {
      injected = true;
      throw injectedError;
    }
    return originalMethod.apply(this, args);
  };

  let failure = null;
  try {
    await operation();
  } catch (error) {
    failure = error;
  } finally {
    ProductDatabase.prototype[methodName] = originalMethod;
  }

  if (!injected) throw new Error(`${label} did not reach post-open metadata method ${methodName}.`);
  if (failure !== injectedError) {
    throw new Error(`${label} did not preserve the post-open metadata error after rollback.`);
  }
  const { database } = await runtime.ensureProductCore(app);
  const quickRows = await database.query("PRAGMA quick_check;");
  const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
  if (quickCheck !== "ok") {
    throw new Error(`${label} left Product Core unusable after post-open metadata rollback: ${quickCheck}`);
  }
  await verifyRecoveredData();
}

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

  await assertFailedProductCoreSwapRecovers({
    app,
    databasePath: sourceDatabase.dbPath,
    label: "restore",
    operation: () => runtime.restoreProductBackup(app, backup.id)
  });
  const failedRestoreSearch = await runtime.searchProductMemories(app, "Backup restore after B");
  if (!failedRestoreSearch.results.some((memory) => memory.id === after.id)) {
    throw new Error("A failed restore did not recover the pre-restore Product Core data.");
  }

  await assertPostOpenFailureRollsBack({
    app,
    databasePath: sourceDatabase.dbPath,
    label: "restore",
    methodName: "registerBackupRecord",
    operation: () => runtime.restoreProductBackup(app, backup.id),
    async verifyRecoveredData() {
      const recoveredSearch = await runtime.searchProductMemories(app, "Backup restore after B");
      if (!recoveredSearch.results.some((memory) => memory.id === after.id)) {
        throw new Error("Restore metadata failure did not roll back the pre-restore Product Core data.");
      }
    }
  });

  const restored = await runSafetyBackupBarrierRace({
    app,
    databasePath: sourceDatabase.dbPath,
    label: "restore",
    operation: () => runtime.restoreProductBackup(app, backup.id),
    writeInput: {
      title: "Restore barrier write",
      body: "This write must wait for restore and then persist.",
      labels: "backup, barrier"
    }
  });
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
  await assertFailedProductCoreSwapRecovers({
    app,
    databasePath: sourceDatabase.dbPath,
    label: "product JSON import",
    operation: () => runtime.importProductDataJson(app, { filePath: productJson.path })
  });
  const failedImportSearch = await runtime.searchProductMemories(app, "Product JSON after C");
  if (!failedImportSearch.results.some((memory) => memory.id === afterJson.id)) {
    throw new Error("A failed Product JSON import did not recover the pre-import Product Core data.");
  }

  await assertPostOpenFailureRollsBack({
    app,
    databasePath: sourceDatabase.dbPath,
    label: "product JSON import",
    methodName: "recordRuntimeEvent",
    operation: () => runtime.importProductDataJson(app, { filePath: productJson.path }),
    async verifyRecoveredData() {
      const recoveredSearch = await runtime.searchProductMemories(app, "Product JSON after C");
      if (!recoveredSearch.results.some((memory) => memory.id === afterJson.id)) {
        throw new Error("Product JSON metadata failure did not roll back the pre-import Product Core data.");
      }
    }
  });

  const jsonImported = await runSafetyBackupBarrierRace({
    app,
    databasePath: sourceDatabase.dbPath,
    label: "product JSON import",
    operation: () => runtime.importProductDataJson(app, { filePath: productJson.path }),
    writeInput: {
      title: "Product JSON barrier write",
      body: "This write must wait for import and then persist.",
      labels: "json, barrier"
    }
  });
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
        removedMemoryId: after.id,
        races: [
          "restore-blocks-concurrent-ensure",
          "product-json-import-blocks-concurrent-ensure"
        ],
        failureRecovery: [
          "restore-rolls-back-to-safety-backup",
          "restore-post-open-failure-rolls-back",
          "product-json-import-rolls-back-to-safety-backup",
          "product-json-import-post-open-failure-rolls-back"
        ],
        barrierWrites: [
          "restore-write-waits-and-persists",
          "product-json-import-write-waits-and-persists"
        ]
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
