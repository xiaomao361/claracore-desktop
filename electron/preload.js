const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ClaraCoreDesktop", {
  getRuntimeSnapshot() {
    return ipcRenderer.invoke("claracore:getRuntimeSnapshot");
  },
  getResourceSnapshot() {
    return ipcRenderer.invoke("claracore:getResourceSnapshot");
  },
  getImportPreview() {
    return ipcRenderer.invoke("claracore:getImportPreview");
  },
  clearLogs() {
    return ipcRenderer.invoke("claracore:clearLogs");
  },
  saveSettings(updates) {
    return ipcRenderer.invoke("claracore:saveSettings", updates);
  },
  listModels(input) {
    return ipcRenderer.invoke("claracore:listModels", input);
  },
  setWindowPreferences(preferences) {
    return ipcRenderer.invoke("claracore:setWindowPreferences", preferences);
  },
  createMemory(input) {
    return ipcRenderer.invoke("claracore:createMemory", input);
  },
  updateMemory(id, input) {
    return ipcRenderer.invoke("claracore:updateMemory", id, input);
  },
  deleteMemory(id) {
    return ipcRenderer.invoke("claracore:deleteMemory", id);
  },
  archiveMemory(id) {
    return ipcRenderer.invoke("claracore:archiveMemory", id);
  },
  restoreMemory(id) {
    return ipcRenderer.invoke("claracore:restoreMemory", id);
  },
  restoreArchivedMemory(id) {
    return ipcRenderer.invoke("claracore:restoreArchivedMemory", id);
  },
  restrictMemory(id) {
    return ipcRenderer.invoke("claracore:restrictMemory", id);
  },
  unrestrictMemory(id) {
    return ipcRenderer.invoke("claracore:unrestrictMemory", id);
  },
  getMemories(limit) {
    return ipcRenderer.invoke("claracore:getMemories", limit);
  },
  getRestrictedMemories(limit) {
    return ipcRenderer.invoke("claracore:getRestrictedMemories", limit);
  },
  getDeletedMemories(limit) {
    return ipcRenderer.invoke("claracore:getDeletedMemories", limit);
  },
  getArchivedMemories(limit) {
    return ipcRenderer.invoke("claracore:getArchivedMemories", limit);
  },
  getMemoryStats() {
    return ipcRenderer.invoke("claracore:getMemoryStats");
  },
  createMemoryLabelAlias(input) {
    return ipcRenderer.invoke("claracore:createMemoryLabelAlias", input);
  },
  deleteMemoryLabelAlias(alias) {
    return ipcRenderer.invoke("claracore:deleteMemoryLabelAlias", alias);
  },
  getMemoryLabelAliases() {
    return ipcRenderer.invoke("claracore:getMemoryLabelAliases");
  },
  getMemoryGraph(input) {
    return ipcRenderer.invoke("claracore:getMemoryGraph", input);
  },
  getMemoryMaintenance() {
    return ipcRenderer.invoke("claracore:getMemoryMaintenance");
  },
  runMemoryMaintenance(input) {
    return ipcRenderer.invoke("claracore:runMemoryMaintenance", input);
  },
  getMemoryMergeSuggestions(input) {
    return ipcRenderer.invoke("claracore:getMemoryMergeSuggestions", input);
  },
  mergeMemories(input) {
    return ipcRenderer.invoke("claracore:mergeMemories", input);
  },
  getMemoryArchiveSuggestions(input) {
    return ipcRenderer.invoke("claracore:getMemoryArchiveSuggestions", input);
  },
  archiveDormantMemories(input) {
    return ipcRenderer.invoke("claracore:archiveDormantMemories", input);
  },
  createMemoryRecord(input) {
    return ipcRenderer.invoke("claracore:createMemoryRecord", input);
  },
  getMemoryRecords(input) {
    return ipcRenderer.invoke("claracore:getMemoryRecords", input);
  },
  searchMemories(input) {
    return ipcRenderer.invoke("claracore:searchMemories", input);
  },
  embedMemory(id) {
    return ipcRenderer.invoke("claracore:embedMemory", id);
  },
  processMemoryEmbeddings(limit) {
    return ipcRenderer.invoke("claracore:processMemoryEmbeddings", limit);
  },
  getSharedLine(input) {
    return ipcRenderer.invoke("claracore:getSharedLine", input);
  },
  saveSharedLine(input) {
    return ipcRenderer.invoke("claracore:saveSharedLine", input);
  },
  createSharedLine(input) {
    return ipcRenderer.invoke("claracore:createSharedLine", input);
  },
  activateSharedLine(lineId) {
    return ipcRenderer.invoke("claracore:activateSharedLine", lineId);
  },
  renameSharedLine(lineId, title) {
    return ipcRenderer.invoke("claracore:renameSharedLine", lineId, title);
  },
  archiveSharedLine(lineId) {
    return ipcRenderer.invoke("claracore:archiveSharedLine", lineId);
  },
  restoreSharedLine(lineId, makeActive) {
    return ipcRenderer.invoke("claracore:restoreSharedLine", lineId, makeActive);
  },
  createSharedLineHandoff(input) {
    return ipcRenderer.invoke("claracore:createSharedLineHandoff", input);
  },
  getInnerLife() {
    return ipcRenderer.invoke("claracore:getInnerLife");
  },
  getInnerLifeSessions(input) {
    return ipcRenderer.invoke("claracore:getInnerLifeSessions", input);
  },
  getInnerLifeDigestRuns(input) {
    return ipcRenderer.invoke("claracore:getInnerLifeDigestRuns", input);
  },
  getInnerLifeInbox(input) {
    return ipcRenderer.invoke("claracore:getInnerLifeInbox", input);
  },
  processInnerLifeOnce(input) {
    return ipcRenderer.invoke("claracore:processInnerLifeOnce", input);
  },
  runInnerLifeDigest(input) {
    return ipcRenderer.invoke("claracore:runInnerLifeDigest", input);
  },
  checkInnerLifeShareTiming(input) {
    return ipcRenderer.invoke("claracore:checkInnerLifeShareTiming", input);
  },
  setInnerLifeDaemon(input) {
    return ipcRenderer.invoke("claracore:setInnerLifeDaemon", input);
  },
  tickInnerLifeDaemon(input) {
    return ipcRenderer.invoke("claracore:tickInnerLifeDaemon", input);
  },
  startInnerLifeSession(input) {
    return ipcRenderer.invoke("claracore:startInnerLifeSession", input);
  },
  submitInnerLifeInbox(input) {
    return ipcRenderer.invoke("claracore:submitInnerLifeInbox", input);
  },
  endInnerLifeSession(sessionId, input) {
    return ipcRenderer.invoke("claracore:endInnerLifeSession", sessionId, input);
  },
  reviewInnerLifeShare(id, decision, reason) {
    return ipcRenderer.invoke("claracore:reviewInnerLifeShare", id, decision, reason);
  },
  markInnerLifeShare(id, action, reason) {
    return ipcRenderer.invoke("claracore:markInnerLifeShare", id, action, reason);
  },
  applyInnerLifeShareToMemory(id) {
    return ipcRenderer.invoke("claracore:applyInnerLifeShareToMemory", id);
  },
  applyInnerLifeShareToSharedLine(id) {
    return ipcRenderer.invoke("claracore:applyInnerLifeShareToSharedLine", id);
  },
  createBackup() {
    return ipcRenderer.invoke("claracore:createBackup");
  },
  deleteBackup(backupId) {
    return ipcRenderer.invoke("claracore:deleteBackup", backupId);
  },
  exportProductJson(input) {
    return ipcRenderer.invoke("claracore:exportProductJson", input);
  },
  importProductJson(input) {
    return ipcRenderer.invoke("claracore:importProductJson", input);
  },
  exportMemoryArchive(input) {
    return ipcRenderer.invoke("claracore:exportMemoryArchive", input);
  },
  importMemoryArchive(input) {
    return ipcRenderer.invoke("claracore:importMemoryArchive", input);
  },
  importOldMemoria(input) {
    return ipcRenderer.invoke("claracore:importOldMemoria", input);
  },
  importOldContinuity(input) {
    return ipcRenderer.invoke("claracore:importOldContinuity", input);
  },
  importOldInnerLife(input) {
    return ipcRenderer.invoke("claracore:importOldInnerLife", input);
  },
  restoreBackup(backupId) {
    return ipcRenderer.invoke("claracore:restoreBackup", backupId);
  },
  previewRestore(backupId) {
    return ipcRenderer.invoke("claracore:previewRestore", backupId);
  },
  openPath(targetPath) {
    return ipcRenderer.invoke("claracore:openPath", targetPath);
  },
  openExternal(targetUrl) {
    return ipcRenderer.invoke("claracore:openExternal", targetUrl);
  },
  copyText(value) {
    return ipcRenderer.invoke("claracore:copyText", value);
  },
  setLanguage(language) {
    return ipcRenderer.invoke("claracore:setLanguage", language);
  },
  getShellState() {
    return ipcRenderer.invoke("claracore:getShellState");
  },
  onRuntimeChanged(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("claracore:runtimeChanged", listener);
    return () => ipcRenderer.removeListener("claracore:runtimeChanged", listener);
  }
});
