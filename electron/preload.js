const { contextBridge, ipcRenderer } = require("electron");
// Sandboxed preload scripts cannot require local modules. Keep this mapper
// dependency-free; core/tests/ipc-contract-lint.js verifies every referenced
// name against electron/ipc-contracts.js.
const ipcChannel = (name) => `claracore:${name}`;

contextBridge.exposeInMainWorld("ClaraCoreDesktop", {
  getRuntimeSnapshot() {
    return ipcRenderer.invoke(ipcChannel("getRuntimeSnapshot"));
  },
  getResourceSnapshot() {
    return ipcRenderer.invoke(ipcChannel("getResourceSnapshot"));
  },
  getImportPreview() {
    return ipcRenderer.invoke(ipcChannel("getImportPreview"));
  },
  clearLogs() {
    return ipcRenderer.invoke(ipcChannel("clearLogs"));
  },
  seedDemoData() {
    return ipcRenderer.invoke(ipcChannel("seedDemoData"));
  },
  clearDemoData() {
    return ipcRenderer.invoke(ipcChannel("clearDemoData"));
  },
  saveSettings(updates) {
    return ipcRenderer.invoke(ipcChannel("saveSettings"), updates);
  },
  listModels(input) {
    return ipcRenderer.invoke(ipcChannel("listModels"), input);
  },
  testModelConnection(input) {
    return ipcRenderer.invoke(ipcChannel("testModelConnection"), input);
  },
  rotateAgentGatewayToken() {
    return ipcRenderer.invoke(ipcChannel("rotateAgentGatewayToken"));
  },
  updateAgentGatewayConfig(input) {
    return ipcRenderer.invoke(ipcChannel("updateAgentGatewayConfig"), input);
  },
  setWindowPreferences(preferences) {
    return ipcRenderer.invoke(ipcChannel("setWindowPreferences"), preferences);
  },
  createMemory(input) {
    return ipcRenderer.invoke(ipcChannel("createMemory"), input);
  },
  updateMemory(id, input) {
    return ipcRenderer.invoke(ipcChannel("updateMemory"), id, input);
  },
  deleteMemory(id) {
    return ipcRenderer.invoke(ipcChannel("deleteMemory"), id);
  },
  archiveMemory(id) {
    return ipcRenderer.invoke(ipcChannel("archiveMemory"), id);
  },
  restoreMemory(id) {
    return ipcRenderer.invoke(ipcChannel("restoreMemory"), id);
  },
  restoreArchivedMemory(id) {
    return ipcRenderer.invoke(ipcChannel("restoreArchivedMemory"), id);
  },
  restrictMemory(id) {
    return ipcRenderer.invoke(ipcChannel("restrictMemory"), id);
  },
  unrestrictMemory(id) {
    return ipcRenderer.invoke(ipcChannel("unrestrictMemory"), id);
  },
  getMemories(limit) {
    return ipcRenderer.invoke(ipcChannel("getMemories"), limit);
  },
  getRestrictedMemories(limit) {
    return ipcRenderer.invoke(ipcChannel("getRestrictedMemories"), limit);
  },
  getDeletedMemories(limit) {
    return ipcRenderer.invoke(ipcChannel("getDeletedMemories"), limit);
  },
  getArchivedMemories(limit) {
    return ipcRenderer.invoke(ipcChannel("getArchivedMemories"), limit);
  },
  getMemoryStats() {
    return ipcRenderer.invoke(ipcChannel("getMemoryStats"));
  },
  createMemoryLabelAlias(input) {
    return ipcRenderer.invoke(ipcChannel("createMemoryLabelAlias"), input);
  },
  deleteMemoryLabelAlias(alias) {
    return ipcRenderer.invoke(ipcChannel("deleteMemoryLabelAlias"), alias);
  },
  getMemoryLabelAliases() {
    return ipcRenderer.invoke(ipcChannel("getMemoryLabelAliases"));
  },
  getMemoryGraph(input) {
    return ipcRenderer.invoke(ipcChannel("getMemoryGraph"), input);
  },
  getMemoryMaintenance() {
    return ipcRenderer.invoke(ipcChannel("getMemoryMaintenance"));
  },
  runMemoryMaintenance(input) {
    return ipcRenderer.invoke(ipcChannel("runMemoryMaintenance"), input);
  },
  getMemoryMergeSuggestions(input) {
    return ipcRenderer.invoke(ipcChannel("getMemoryMergeSuggestions"), input);
  },
  mergeMemories(input) {
    return ipcRenderer.invoke(ipcChannel("mergeMemories"), input);
  },
  getMemoryArchiveSuggestions(input) {
    return ipcRenderer.invoke(ipcChannel("getMemoryArchiveSuggestions"), input);
  },
  archiveDormantMemories(input) {
    return ipcRenderer.invoke(ipcChannel("archiveDormantMemories"), input);
  },
  createMemoryRecord(input) {
    return ipcRenderer.invoke(ipcChannel("createMemoryRecord"), input);
  },
  getMemoryRecords(input) {
    return ipcRenderer.invoke(ipcChannel("getMemoryRecords"), input);
  },
  searchMemories(input) {
    return ipcRenderer.invoke(ipcChannel("searchMemories"), input);
  },
  embedMemory(id) {
    return ipcRenderer.invoke(ipcChannel("embedMemory"), id);
  },
  processMemoryEmbeddings(limit) {
    return ipcRenderer.invoke(ipcChannel("processMemoryEmbeddings"), limit);
  },
  getSharedLine(input) {
    return ipcRenderer.invoke(ipcChannel("getSharedLine"), input);
  },
  saveSharedLine(input) {
    return ipcRenderer.invoke(ipcChannel("saveSharedLine"), input);
  },
  createSharedLine(input) {
    return ipcRenderer.invoke(ipcChannel("createSharedLine"), input);
  },
  activateSharedLine(lineId) {
    return ipcRenderer.invoke(ipcChannel("activateSharedLine"), lineId);
  },
  renameSharedLine(lineId, title) {
    return ipcRenderer.invoke(ipcChannel("renameSharedLine"), lineId, title);
  },
  archiveSharedLine(lineId) {
    return ipcRenderer.invoke(ipcChannel("archiveSharedLine"), lineId);
  },
  restoreSharedLine(lineId, makeActive) {
    return ipcRenderer.invoke(ipcChannel("restoreSharedLine"), lineId, makeActive);
  },
  createSharedLineHandoff(input) {
    return ipcRenderer.invoke(ipcChannel("createSharedLineHandoff"), input);
  },
  getInnerLife() {
    return ipcRenderer.invoke(ipcChannel("getInnerLife"));
  },
  getInnerLifeSessions(input) {
    return ipcRenderer.invoke(ipcChannel("getInnerLifeSessions"), input);
  },
  getInnerLifeDigestRuns(input) {
    return ipcRenderer.invoke(ipcChannel("getInnerLifeDigestRuns"), input);
  },
  getInnerLifeInbox(input) {
    return ipcRenderer.invoke(ipcChannel("getInnerLifeInbox"), input);
  },
  updateInnerLifeProfile(input) {
    return ipcRenderer.invoke(ipcChannel("updateInnerLifeProfile"), input);
  },
  processInnerLifeOnce(input) {
    return ipcRenderer.invoke(ipcChannel("processInnerLifeOnce"), input);
  },
  runInnerLifeDigest(input) {
    return ipcRenderer.invoke(ipcChannel("runInnerLifeDigest"), input);
  },
  checkInnerLifeShareTiming(input) {
    return ipcRenderer.invoke(ipcChannel("checkInnerLifeShareTiming"), input);
  },
  setInnerLifeDaemon(input) {
    return ipcRenderer.invoke(ipcChannel("setInnerLifeDaemon"), input);
  },
  tickInnerLifeDaemon(input) {
    return ipcRenderer.invoke(ipcChannel("tickInnerLifeDaemon"), input);
  },
  startInnerLifeSession(input) {
    return ipcRenderer.invoke(ipcChannel("startInnerLifeSession"), input);
  },
  submitInnerLifeInbox(input) {
    return ipcRenderer.invoke(ipcChannel("submitInnerLifeInbox"), input);
  },
  endInnerLifeSession(sessionId, input) {
    return ipcRenderer.invoke(ipcChannel("endInnerLifeSession"), sessionId, input);
  },
  reviewInnerLifeShare(id, decision, reason) {
    return ipcRenderer.invoke(ipcChannel("reviewInnerLifeShare"), id, decision, reason);
  },
  markInnerLifeShare(id, action, reason, deliveryEvidence) {
    return ipcRenderer.invoke(ipcChannel("markInnerLifeShare"), id, action, reason, deliveryEvidence);
  },
  applyInnerLifeShareToMemory(id) {
    return ipcRenderer.invoke(ipcChannel("applyInnerLifeShareToMemory"), id);
  },
  applyInnerLifeShareToSharedLine(id) {
    return ipcRenderer.invoke(ipcChannel("applyInnerLifeShareToSharedLine"), id);
  },
  createBackup() {
    return ipcRenderer.invoke(ipcChannel("createBackup"));
  },
  deleteBackup(backupId) {
    return ipcRenderer.invoke(ipcChannel("deleteBackup"), backupId);
  },
  exportProductJson(input) {
    return ipcRenderer.invoke(ipcChannel("exportProductJson"), input);
  },
  importProductJson(input) {
    return ipcRenderer.invoke(ipcChannel("importProductJson"), input);
  },
  exportMemoryArchive(input) {
    return ipcRenderer.invoke(ipcChannel("exportMemoryArchive"), input);
  },
  importMemoryArchive(input) {
    return ipcRenderer.invoke(ipcChannel("importMemoryArchive"), input);
  },
  importOldMemoria(input) {
    return ipcRenderer.invoke(ipcChannel("importOldMemoria"), input);
  },
  importOldContinuity(input) {
    return ipcRenderer.invoke(ipcChannel("importOldContinuity"), input);
  },
  importOldInnerLife(input) {
    return ipcRenderer.invoke(ipcChannel("importOldInnerLife"), input);
  },
  restoreBackup(backupId) {
    return ipcRenderer.invoke(ipcChannel("restoreBackup"), backupId);
  },
  previewRestore(backupId) {
    return ipcRenderer.invoke(ipcChannel("previewRestore"), backupId);
  },
  getDataRootPreference() {
    return ipcRenderer.invoke(ipcChannel("getDataRootPreference"));
  },
  chooseDataRoot() {
    return ipcRenderer.invoke(ipcChannel("chooseDataRoot"));
  },
  saveDataRootPreference(dataRoot) {
    return ipcRenderer.invoke(ipcChannel("saveDataRootPreference"), dataRoot);
  },
  relaunch() {
    return ipcRenderer.invoke(ipcChannel("relaunch"));
  },
  openPath(targetPath) {
    return ipcRenderer.invoke(ipcChannel("openPath"), targetPath);
  },
  openExternal(targetUrl) {
    return ipcRenderer.invoke(ipcChannel("openExternal"), targetUrl);
  },
  copyText(value) {
    return ipcRenderer.invoke(ipcChannel("copyText"), value);
  },
  setLanguage(language) {
    return ipcRenderer.invoke(ipcChannel("setLanguage"), language);
  },
  getUiPreferences() {
    return ipcRenderer.invoke(ipcChannel("getUiPreferences"));
  },
  checkForUpdates() {
    return ipcRenderer.invoke(ipcChannel("checkForUpdates"));
  },
  openUpdateUrl(targetUrl) {
    return ipcRenderer.invoke(ipcChannel("openUpdateUrl"), targetUrl);
  },
  saveUiPreferences(updates) {
    return ipcRenderer.invoke(ipcChannel("saveUiPreferences"), updates);
  },
  getShellState() {
    return ipcRenderer.invoke(ipcChannel("getShellState"));
  },
  onRuntimeChanged(callback) {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(ipcChannel("runtimeChanged"), listener);
    return () => ipcRenderer.removeListener(ipcChannel("runtimeChanged"), listener);
  }
});
