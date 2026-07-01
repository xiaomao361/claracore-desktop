const path = require("path");
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
  currentDataRootPreference,
  ipcMain,
  listConfiguredModels,
  notifyRuntimeChanged,
  rescheduleMemoryMaintenance,
  saveDataRootPreference,
  setWindowCloseBehavior,
  shell,
  updateTrayMenu
}) {
  ipcMain.handle("claracore:getRuntimeSnapshot", () => getRuntimeSnapshot());
  ipcMain.handle("claracore:getResourceSnapshot", () => getResourceSnapshot());
  ipcMain.handle("claracore:getImportPreview", () => getProductImportPreview(app));
  ipcMain.handle("claracore:clearLogs", async () => {
    const result = await clearProductLogs(app);
    notifyRuntimeChanged("logs-clear");
    return result;
  });
  ipcMain.handle("claracore:saveSettings", async (_event, updates) => {
    if (!isPlainObject(updates)) return false;
    const result = await saveProductSettings(app, updates);
    if (Object.keys(updates).some((key) => key.startsWith("memory.maintenance."))) {
      rescheduleMemoryMaintenance();
    }
    return result;
  });
  ipcMain.handle("claracore:listModels", async (_event, input) => listConfiguredModels(input));
  ipcMain.handle("claracore:createMemory", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemory(app, input);
  });
  ipcMain.handle("claracore:updateMemory", async (_event, id, input) => {
    if (typeof id !== "string" || !isPlainObject(input)) return false;
    return updateProductMemory(app, id, input);
  });
  ipcMain.handle("claracore:deleteMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return deleteProductMemory(app, id);
  });
  ipcMain.handle("claracore:archiveMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    const result = await archiveProductMemory(app, id);
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle("claracore:restoreMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return restoreProductMemory(app, id);
  });
  ipcMain.handle("claracore:restoreArchivedMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    const result = await restoreArchivedProductMemory(app, id);
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle("claracore:restrictMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return restrictProductMemory(app, id);
  });
  ipcMain.handle("claracore:unrestrictMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return unrestrictProductMemory(app, id);
  });
  ipcMain.handle("claracore:getRestrictedMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductRestrictedMemories(app, input);
  });
  ipcMain.handle("claracore:getMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductMemories(app, input);
  });
  ipcMain.handle("claracore:getDeletedMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductDeletedMemories(app, input);
  });
  ipcMain.handle("claracore:getArchivedMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductArchivedMemories(app, input);
  });
  ipcMain.handle("claracore:getMemoryStats", async () => {
    return getProductMemoryStats(app);
  });
  ipcMain.handle("claracore:createMemoryLabelAlias", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemoryLabelAlias(app, input);
  });
  ipcMain.handle("claracore:deleteMemoryLabelAlias", async (_event, alias) => {
    if (typeof alias !== "string") return false;
    return deleteProductMemoryLabelAlias(app, alias);
  });
  ipcMain.handle("claracore:getMemoryLabelAliases", async () => {
    return getProductMemoryLabelAliases(app);
  });
  ipcMain.handle("claracore:getMemoryGraph", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryGraph(app, input || {});
  });
  ipcMain.handle("claracore:getMemoryMaintenance", async () => {
    return getProductMemoryMaintenance(app);
  });
  ipcMain.handle("claracore:runMemoryMaintenance", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return runProductMemoryMaintenance(app, input || {});
  });
  ipcMain.handle("claracore:getMemoryMergeSuggestions", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryMergeSuggestions(app, input || {});
  });
  ipcMain.handle("claracore:mergeMemories", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    const result = await mergeProductMemories(app, input);
    notifyRuntimeChanged("memory-merge");
    return result;
  });
  ipcMain.handle("claracore:getMemoryArchiveSuggestions", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryArchiveSuggestions(app, input || {});
  });
  ipcMain.handle("claracore:archiveDormantMemories", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const result = await archiveProductDormantMemories(app, input || {});
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle("claracore:createMemoryRecord", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemoryRecord(app, input);
  });
  ipcMain.handle("claracore:getMemoryRecords", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryRecords(app, input || {});
  });
  ipcMain.handle("claracore:searchMemories", async (_event, input) => {
    if (typeof input === "string") return searchProductMemories(app, input);
    if (input && (typeof input !== "object" || Array.isArray(input))) {
      return { mode: "list", query: "", results: [], error: null };
    }
    return searchProductMemories(app, input || {});
  });
  ipcMain.handle("claracore:embedMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return embedProductMemory(app, id);
  });
  ipcMain.handle("claracore:processMemoryEmbeddings", async (_event, limit) => {
    return processProductMemoryEmbeddings(app, limit);
  });
  ipcMain.handle("claracore:getSharedLine", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductSharedLine(app, input || {});
  });
  ipcMain.handle("claracore:saveSharedLine", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return saveProductSharedLine(app, input);
  });
  ipcMain.handle("claracore:createSharedLine", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductSharedLine(app, input);
  });
  ipcMain.handle("claracore:activateSharedLine", async (_event, lineId) => {
    if (typeof lineId !== "string") return false;
    return activateProductSharedLine(app, lineId);
  });
  ipcMain.handle("claracore:renameSharedLine", async (_event, lineId, title) => {
    if (typeof lineId !== "string" || typeof title !== "string") return false;
    return renameProductSharedLine(app, lineId, title);
  });
  ipcMain.handle("claracore:archiveSharedLine", async (_event, lineId) => {
    if (typeof lineId !== "string") return false;
    return archiveProductSharedLine(app, lineId);
  });
  ipcMain.handle("claracore:restoreSharedLine", async (_event, lineId, makeActive) => {
    if (typeof lineId !== "string") return false;
    return restoreProductSharedLine(app, lineId, Boolean(makeActive));
  });
  ipcMain.handle("claracore:createSharedLineHandoff", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return createProductSharedLineHandoff(app, input || {});
  });
  ipcMain.handle("claracore:getInnerLife", async () => {
    return getProductInnerLife(app);
  });
  ipcMain.handle("claracore:getInnerLifeSessions", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeSessions(app, input || {});
  });
  ipcMain.handle("claracore:getInnerLifeDigestRuns", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeDigestRuns(app, input || {});
  });
  ipcMain.handle("claracore:getInnerLifeInbox", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeInbox(app, input || {});
  });
  ipcMain.handle("claracore:updateInnerLifeProfile", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    const result = await updateProductInnerLifeProfile(app, input);
    notifyRuntimeChanged("innerlife-profile");
    return result;
  });
  ipcMain.handle("claracore:processInnerLifeOnce", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return processProductInnerLifeOnce(app, input || {});
  });
  ipcMain.handle("claracore:runInnerLifeDigest", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return runProductInnerLifeDigest(app, input || {});
  });
  ipcMain.handle("claracore:checkInnerLifeShareTiming", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return checkProductInnerLifeShareTiming(app, input || {});
  });
  ipcMain.handle("claracore:setInnerLifeDaemon", async (_event, input) => {
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
  ipcMain.handle("claracore:tickInnerLifeDaemon", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const result = await tickProductInnerLifeDaemon(app, input || {});
    notifyRuntimeChanged("innerlife-daemon", {
      daemonReason: result?.reason,
      ran: Boolean(result?.ran)
    });
    return result;
  });
  ipcMain.handle("claracore:startInnerLifeSession", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return startProductInnerLifeSession(app, input || {});
  });
  ipcMain.handle("claracore:submitInnerLifeInbox", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return submitProductInnerLifeInbox(app, input);
  });
  ipcMain.handle("claracore:endInnerLifeSession", async (_event, sessionId, input) => {
    if (typeof sessionId !== "string" || sessionId.length === 0) return false;
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return endProductInnerLifeSession(app, sessionId, input || {});
  });
  ipcMain.handle("claracore:reviewInnerLifeShare", async (_event, id, decision, reason) => {
    if (typeof id !== "string" || typeof decision !== "string") return false;
    return reviewProductInnerLifeShare(app, id, decision, typeof reason === "string" ? reason : "");
  });
  ipcMain.handle("claracore:markInnerLifeShare", async (_event, id, action, reason) => {
    if (typeof id !== "string" || typeof action !== "string") return false;
    return markProductInnerLifeShare(app, id, action, typeof reason === "string" ? reason : "");
  });
  ipcMain.handle("claracore:applyInnerLifeShareToMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return applyProductInnerLifeShareToMemory(app, id);
  });
  ipcMain.handle("claracore:applyInnerLifeShareToSharedLine", async (_event, id) => {
    if (typeof id !== "string") return false;
    return applyProductInnerLifeShareToSharedLine(app, id);
  });
  ipcMain.handle("claracore:createBackup", async () => {
    return createProductBackup(app);
  });
  ipcMain.handle("claracore:deleteBackup", async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    const result = await deleteProductBackup(app, backupId);
    notifyRuntimeChanged("backup-delete");
    return result;
  });
  ipcMain.handle("claracore:exportProductJson", async (_event, input) => {
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
  ipcMain.handle("claracore:importProductJson", async (_event, input) => {
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
  ipcMain.handle("claracore:exportMemoryArchive", async (_event, input) => {
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
  ipcMain.handle("claracore:importMemoryArchive", async (_event, input) => {
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
  ipcMain.handle("claracore:importOldMemoria", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldMemoriaIntoProduct(app, input || {});
    notifyRuntimeChanged("old-memoria-import");
    return imported;
  });
  ipcMain.handle("claracore:importOldContinuity", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldContinuityIntoProduct(app, input || {});
    notifyRuntimeChanged("old-continuity-import");
    return imported;
  });
  ipcMain.handle("claracore:importOldInnerLife", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldInnerLifeIntoProduct(app, input || {});
    notifyRuntimeChanged("old-innerlife-import");
    return imported;
  });
  ipcMain.handle("claracore:restoreBackup", async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    return restoreProductBackup(app, backupId);
  });
  ipcMain.handle("claracore:previewRestore", async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    return previewProductRestore(app, backupId);
  });
  ipcMain.handle("claracore:getDataRootPreference", async () => currentDataRootPreference());
  ipcMain.handle("claracore:chooseDataRoot", async () => {
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
  ipcMain.handle("claracore:saveDataRootPreference", async (_event, dataRoot) => saveDataRootPreference(dataRoot));
  ipcMain.handle("claracore:relaunch", () => {
    if (!app.isPackaged) {
      return { relaunched: false, reason: "development-mode" };
    }
    app.relaunch();
    app.quit();
    return { relaunched: true };
  });
  ipcMain.handle("claracore:openPath", async (_event, targetPath) => {
    if (typeof targetPath !== "string" || targetPath.length === 0) return false;
    await shell.openPath(targetPath);
    return true;
  });
  ipcMain.handle("claracore:openExternal", async (_event, targetUrl) => {
    if (typeof targetUrl !== "string" || !targetUrl.startsWith("http://127.0.0.1:")) return false;
    await shell.openExternal(targetUrl);
    return true;
  });
  ipcMain.handle("claracore:copyText", (_event, value) => {
    if (typeof value !== "string" || value.length === 0) return false;
    clipboard.writeText(value);
    return true;
  });
  ipcMain.handle("claracore:setLanguage", (_event, language) => {
    updateTrayMenu(language);
    return getTrayLanguage();
  });
  ipcMain.handle("claracore:setWindowPreferences", (_event, preferences = {}) => {
    return setWindowCloseBehavior(preferences);
  });
  ipcMain.handle("claracore:getShellState", () => ({
    hasTray: Boolean(getTray()),
    trayBounds: getTray() ? getTray().getBounds() : null,
    trayTitle: getTray() && typeof getTray().getTitle === "function" ? getTray().getTitle() : "",
    windowVisible: getMainWindow() ? getMainWindow().isVisible() : false
  }));
  
}

module.exports = {
  registerIpcHandlers
};
