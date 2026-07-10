const path = require("path");
const { ipcChannel } = require("./ipc-contracts");
const {
  applyProductInnerLifeShareToMemory,
  applyProductInnerLifeShareToSharedLine,
  checkProductInnerLifeShareTiming,
  activateProductSharedLine,
  archiveProductDormantMemories,
  archiveProductMemory,
  archiveProductSharedLine,
  clearProductLogs,
  createProductBackup,
  createProductMemory,
  createProductMemoryLabelAlias,
  createProductMemoryRecord,
  createProductSharedLine,
  createProductSharedLineHandoff,
  deleteProductBackup,
  deleteProductMemory,
  deleteProductMemoryLabelAlias,
  embedProductMemory,
  ensureProductDirectories,
  exportProductDataJson,
  exportProductMemoryArchive,
  getProductMemories,
  getProductInnerLife,
  getProductInnerLifeDigestRuns,
  getProductImportPreview,
  getProductInnerLifeInbox,
  getProductArchivedMemories,
  getProductMemoryArchiveSuggestions,
  getProductDeletedMemories,
  getProductMemoryLabelAliases,
  getProductMemoryGraph,
  getProductMemoryMaintenance,
  getProductMemoryMergeSuggestions,
  getProductMemoryRecords,
  getProductMemoryStats,
  getProductRestrictedMemories,
  getProductSharedLine,
  getProductInnerLifeSessions,
  importProductDataJson,
  importProductMemoryArchive,
  importOldContinuityIntoProduct,
  importOldInnerLifeIntoProduct,
  importOldMemoriaIntoProduct,
  markProductInnerLifeShare,
  mergeProductMemories,
  previewProductRestore,
  processProductMemoryEmbeddings,
  processProductInnerLifeOnce,
  reviewProductInnerLifeShare,
  renameProductSharedLine,
  restoreProductBackup,
  restoreArchivedProductMemory,
  restoreProductMemory,
  restoreProductSharedLine,
  restrictProductMemory,
  runProductInnerLifeDigest,
  runProductMemoryMaintenance,
  setProductInnerLifeDaemon,
  saveProductSettings,
  saveProductSharedLine,
  searchProductMemories,
  submitProductInnerLifeInbox,
  tickProductInnerLifeDaemon,
  startProductInnerLifeSession,
  endProductInnerLifeSession,
  unrestrictProductMemory,
  updateProductInnerLifeProfile,
  updateProductMemory
} = require("../core/runtime");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}


function registerIpcHandlers({
  app,
  clipboard,
  dialog,
  getMainWindow,
  getResourceSnapshot,
  getRuntimeSnapshot,
  getTray,
  getTrayLanguage,
  getUiPreferences,
  currentDataRootPreference,
  ipcMain,
  listConfiguredModels,
  testConfiguredModel,
  notifyRuntimeChanged,
  rescheduleMemoryMaintenance,
  rotateAgentGatewayToken,
  updateAgentGatewayConfig,
  saveDataRootPreference,
  saveUiPreferences,
  setWindowCloseBehavior,
  shell,
  updateTrayMenu
}) {
  ipcMain.handle(ipcChannel("getRuntimeSnapshot"), () => getRuntimeSnapshot());
  ipcMain.handle(ipcChannel("getResourceSnapshot"), () => getResourceSnapshot());
  ipcMain.handle(ipcChannel("getImportPreview"), () => getProductImportPreview(app));
  ipcMain.handle(ipcChannel("clearLogs"), async () => {
    const result = await clearProductLogs(app);
    notifyRuntimeChanged("logs-clear");
    return result;
  });
  ipcMain.handle(ipcChannel("saveSettings"), async (_event, updates) => {
    if (!isPlainObject(updates)) return false;
    const result = await saveProductSettings(app, updates);
    if (Object.keys(updates).some((key) => key.startsWith("memory.maintenance."))) {
      rescheduleMemoryMaintenance();
    }
    return result;
  });
  ipcMain.handle(ipcChannel("listModels"), async (_event, input) => listConfiguredModels(input));
  ipcMain.handle(ipcChannel("testModelConnection"), async (_event, input) => testConfiguredModel(input));
  ipcMain.handle(ipcChannel("rotateAgentGatewayToken"), async () => {
    return rotateAgentGatewayToken();
  });
  ipcMain.handle(ipcChannel("updateAgentGatewayConfig"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return updateAgentGatewayConfig(input);
  });
  ipcMain.handle(ipcChannel("createMemory"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemory(app, input);
  });
  ipcMain.handle(ipcChannel("updateMemory"), async (_event, id, input) => {
    if (typeof id !== "string" || !isPlainObject(input)) return false;
    return updateProductMemory(app, id, input);
  });
  ipcMain.handle(ipcChannel("deleteMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    return deleteProductMemory(app, id);
  });
  ipcMain.handle(ipcChannel("archiveMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    const result = await archiveProductMemory(app, id);
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle(ipcChannel("restoreMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    return restoreProductMemory(app, id);
  });
  ipcMain.handle(ipcChannel("restoreArchivedMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    const result = await restoreArchivedProductMemory(app, id);
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle(ipcChannel("restrictMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    return restrictProductMemory(app, id);
  });
  ipcMain.handle(ipcChannel("unrestrictMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    return unrestrictProductMemory(app, id);
  });
  ipcMain.handle(ipcChannel("getRestrictedMemories"), async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductRestrictedMemories(app, input);
  });
  ipcMain.handle(ipcChannel("getMemories"), async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductMemories(app, input);
  });
  ipcMain.handle(ipcChannel("getDeletedMemories"), async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductDeletedMemories(app, input);
  });
  ipcMain.handle(ipcChannel("getArchivedMemories"), async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductArchivedMemories(app, input);
  });
  ipcMain.handle(ipcChannel("getMemoryStats"), async () => {
    return getProductMemoryStats(app);
  });
  ipcMain.handle(ipcChannel("createMemoryLabelAlias"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemoryLabelAlias(app, input);
  });
  ipcMain.handle(ipcChannel("deleteMemoryLabelAlias"), async (_event, alias) => {
    if (typeof alias !== "string") return false;
    return deleteProductMemoryLabelAlias(app, alias);
  });
  ipcMain.handle(ipcChannel("getMemoryLabelAliases"), async () => {
    return getProductMemoryLabelAliases(app);
  });
  ipcMain.handle(ipcChannel("getMemoryGraph"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryGraph(app, input || {});
  });
  ipcMain.handle(ipcChannel("getMemoryMaintenance"), async () => {
    return getProductMemoryMaintenance(app);
  });
  ipcMain.handle(ipcChannel("runMemoryMaintenance"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return runProductMemoryMaintenance(app, input || {});
  });
  ipcMain.handle(ipcChannel("getMemoryMergeSuggestions"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryMergeSuggestions(app, input || {});
  });
  ipcMain.handle(ipcChannel("mergeMemories"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    const result = await mergeProductMemories(app, input);
    notifyRuntimeChanged("memory-merge");
    return result;
  });
  ipcMain.handle(ipcChannel("getMemoryArchiveSuggestions"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryArchiveSuggestions(app, input || {});
  });
  ipcMain.handle(ipcChannel("archiveDormantMemories"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const result = await archiveProductDormantMemories(app, input || {});
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle(ipcChannel("createMemoryRecord"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemoryRecord(app, input);
  });
  ipcMain.handle(ipcChannel("getMemoryRecords"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryRecords(app, input || {});
  });
  ipcMain.handle(ipcChannel("searchMemories"), async (_event, input) => {
    if (typeof input === "string") return searchProductMemories(app, input);
    if (input && (typeof input !== "object" || Array.isArray(input))) {
      return { mode: "list", query: "", results: [], error: null };
    }
    return searchProductMemories(app, input || {});
  });
  ipcMain.handle(ipcChannel("embedMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    return embedProductMemory(app, id);
  });
  ipcMain.handle(ipcChannel("processMemoryEmbeddings"), async (_event, limit) => {
    return processProductMemoryEmbeddings(app, limit);
  });
  ipcMain.handle(ipcChannel("getSharedLine"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductSharedLine(app, input || {});
  });
  ipcMain.handle(ipcChannel("saveSharedLine"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return saveProductSharedLine(app, input);
  });
  ipcMain.handle(ipcChannel("createSharedLine"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductSharedLine(app, input);
  });
  ipcMain.handle(ipcChannel("activateSharedLine"), async (_event, lineId) => {
    if (typeof lineId !== "string") return false;
    return activateProductSharedLine(app, lineId);
  });
  ipcMain.handle(ipcChannel("renameSharedLine"), async (_event, lineId, title) => {
    if (typeof lineId !== "string" || typeof title !== "string") return false;
    return renameProductSharedLine(app, lineId, title);
  });
  ipcMain.handle(ipcChannel("archiveSharedLine"), async (_event, lineId) => {
    if (typeof lineId !== "string") return false;
    return archiveProductSharedLine(app, lineId);
  });
  ipcMain.handle(ipcChannel("restoreSharedLine"), async (_event, lineId, makeActive) => {
    if (typeof lineId !== "string") return false;
    return restoreProductSharedLine(app, lineId, Boolean(makeActive));
  });
  ipcMain.handle(ipcChannel("createSharedLineHandoff"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return createProductSharedLineHandoff(app, input || {});
  });
  ipcMain.handle(ipcChannel("getInnerLife"), async () => {
    return getProductInnerLife(app);
  });
  ipcMain.handle(ipcChannel("getInnerLifeSessions"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeSessions(app, input || {});
  });
  ipcMain.handle(ipcChannel("getInnerLifeDigestRuns"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeDigestRuns(app, input || {});
  });
  ipcMain.handle(ipcChannel("getInnerLifeInbox"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeInbox(app, input || {});
  });
  ipcMain.handle(ipcChannel("updateInnerLifeProfile"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    const result = await updateProductInnerLifeProfile(app, input);
    notifyRuntimeChanged("innerlife-profile");
    return result;
  });
  ipcMain.handle(ipcChannel("processInnerLifeOnce"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return processProductInnerLifeOnce(app, input || {});
  });
  ipcMain.handle(ipcChannel("runInnerLifeDigest"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return runProductInnerLifeDigest(app, input || {});
  });
  ipcMain.handle(ipcChannel("checkInnerLifeShareTiming"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return checkProductInnerLifeShareTiming(app, input || {});
  });
  ipcMain.handle(ipcChannel("setInnerLifeDaemon"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    const result = await setProductInnerLifeDaemon(app, input);
    if (result?.enabled) {
      await tickProductInnerLifeDaemon(app, {
        agentId: result.agentId,
        force: true,
        includeSnapshot: false
      });
    }
    notifyRuntimeChanged("innerlife-daemon");
    return result;
  });
  ipcMain.handle(ipcChannel("tickInnerLifeDaemon"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const result = await tickProductInnerLifeDaemon(app, input || {});
    notifyRuntimeChanged("innerlife-daemon", {
      daemonReason: result?.reason,
      ran: Boolean(result?.ran)
    });
    return result;
  });
  ipcMain.handle(ipcChannel("startInnerLifeSession"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return startProductInnerLifeSession(app, input || {});
  });
  ipcMain.handle(ipcChannel("submitInnerLifeInbox"), async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return submitProductInnerLifeInbox(app, input);
  });
  ipcMain.handle(ipcChannel("endInnerLifeSession"), async (_event, sessionId, input) => {
    if (typeof sessionId !== "string" || sessionId.length === 0) return false;
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return endProductInnerLifeSession(app, sessionId, input || {});
  });
  ipcMain.handle(ipcChannel("reviewInnerLifeShare"), async (_event, id, decision, reason) => {
    if (typeof id !== "string" || typeof decision !== "string") return false;
    return reviewProductInnerLifeShare(app, id, decision, typeof reason === "string" ? reason : "");
  });
  ipcMain.handle(ipcChannel("markInnerLifeShare"), async (_event, id, action, reason) => {
    if (typeof id !== "string" || typeof action !== "string") return false;
    return markProductInnerLifeShare(app, id, action, typeof reason === "string" ? reason : "");
  });
  ipcMain.handle(ipcChannel("applyInnerLifeShareToMemory"), async (_event, id) => {
    if (typeof id !== "string") return false;
    return applyProductInnerLifeShareToMemory(app, id);
  });
  ipcMain.handle(ipcChannel("applyInnerLifeShareToSharedLine"), async (_event, id) => {
    if (typeof id !== "string") return false;
    return applyProductInnerLifeShareToSharedLine(app, id);
  });
  ipcMain.handle(ipcChannel("createBackup"), async () => {
    return createProductBackup(app);
  });
  ipcMain.handle(ipcChannel("deleteBackup"), async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    const result = await deleteProductBackup(app, backupId);
    notifyRuntimeChanged("backup-delete");
    return result;
  });
  ipcMain.handle(ipcChannel("exportProductJson"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.targetPath && !options.silent) {
      const paths = await ensureProductDirectories(app);
      const defaultPath = path.join(paths.exportsDir, `claracore-product-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      const result = await dialog.showSaveDialog(getMainWindow(), {
        title: "Export ClaraCore Product JSON",
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      options.targetPath = result.filePath;
      options.allowExternalPath = true;
    }
    return exportProductDataJson(app, options);
  });
  ipcMain.handle(ipcChannel("importProductJson"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.filePath && !options.silent) {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        title: "Import ClaraCore Product JSON",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
      options.filePath = result.filePaths[0];
    }
    const imported = await importProductDataJson(app, options);
    notifyRuntimeChanged("product-json-import");
    return imported;
  });
  ipcMain.handle(ipcChannel("exportMemoryArchive"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.targetPath && !options.silent) {
      const paths = await ensureProductDirectories(app);
      const defaultPath = path.join(paths.exportsDir, `claracore-memory-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      const result = await dialog.showSaveDialog(getMainWindow(), {
        title: "Export Memory JSON",
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      options.targetPath = result.filePath;
      options.allowExternalPath = true;
    }
    return exportProductMemoryArchive(app, options);
  });
  ipcMain.handle(ipcChannel("importMemoryArchive"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.filePath && !options.silent) {
      const result = await dialog.showOpenDialog(getMainWindow(), {
        title: "Import Memory JSON",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
      options.filePath = result.filePaths[0];
    }
    const imported = await importProductMemoryArchive(app, options);
    notifyRuntimeChanged("memory-import");
    return imported;
  });
  ipcMain.handle(ipcChannel("importOldMemoria"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldMemoriaIntoProduct(app, input || {});
    notifyRuntimeChanged("old-memoria-import");
    return imported;
  });
  ipcMain.handle(ipcChannel("importOldContinuity"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldContinuityIntoProduct(app, input || {});
    notifyRuntimeChanged("old-continuity-import");
    return imported;
  });
  ipcMain.handle(ipcChannel("importOldInnerLife"), async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldInnerLifeIntoProduct(app, input || {});
    notifyRuntimeChanged("old-innerlife-import");
    return imported;
  });
  ipcMain.handle(ipcChannel("restoreBackup"), async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    return restoreProductBackup(app, backupId);
  });
  ipcMain.handle(ipcChannel("previewRestore"), async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    return previewProductRestore(app, backupId);
  });
  ipcMain.handle(ipcChannel("getDataRootPreference"), async () => currentDataRootPreference());
  ipcMain.handle(ipcChannel("chooseDataRoot"), async () => {
    const preference = currentDataRootPreference();
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: "Choose ClaraCore data directory",
      defaultPath: preference.effectiveDataRoot,
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true, path: preference.configuredDataRoot || preference.effectiveDataRoot };
    }
    return { canceled: false, path: result.filePaths[0] };
  });
  ipcMain.handle(ipcChannel("saveDataRootPreference"), async (_event, dataRoot) => saveDataRootPreference(dataRoot));
  ipcMain.handle(ipcChannel("relaunch"), () => {
    if (!app.isPackaged) {
      return { relaunched: false, reason: "development-mode" };
    }
    app.relaunch();
    app.quit();
    return { relaunched: true };
  });
  ipcMain.handle(ipcChannel("openPath"), async (_event, targetPath) => {
    if (typeof targetPath !== "string" || targetPath.length === 0) return false;
    await shell.openPath(targetPath);
    return true;
  });
  ipcMain.handle(ipcChannel("openExternal"), async (_event, targetUrl) => {
    if (typeof targetUrl !== "string" || !targetUrl.startsWith("http://127.0.0.1:")) return false;
    await shell.openExternal(targetUrl);
    return true;
  });
  ipcMain.handle(ipcChannel("copyText"), (_event, value) => {
    if (typeof value !== "string" || value.length === 0) return false;
    clipboard.writeText(value);
    return true;
  });
  ipcMain.handle(ipcChannel("setLanguage"), (_event, language) => {
    updateTrayMenu(language);
    return getTrayLanguage();
  });
  ipcMain.handle(ipcChannel("getUiPreferences"), () => getUiPreferences());
  ipcMain.handle(ipcChannel("saveUiPreferences"), async (_event, updates = {}) => {
    const preferences = await saveUiPreferences(updates);
    updateTrayMenu(preferences.language);
    setWindowCloseBehavior({ closeBehavior: preferences.closeBehavior });
    return preferences;
  });
  ipcMain.handle(ipcChannel("setWindowPreferences"), (_event, preferences = {}) => {
    return setWindowCloseBehavior(preferences);
  });
  ipcMain.handle(ipcChannel("getShellState"), () => ({
    hasTray: Boolean(getTray()),
    trayBounds: getTray() ? getTray().getBounds() : null,
    trayTitle: getTray() && typeof getTray().getTitle === "function" ? getTray().getTitle() : "",
    dockVisible: process.platform === "darwin" && app.dock && typeof app.dock.isVisible === "function" ? app.dock.isVisible() : null,
    windowVisible: getMainWindow() ? getMainWindow().isVisible() : false
  }));
  
}

module.exports = {
  registerIpcHandlers
};
