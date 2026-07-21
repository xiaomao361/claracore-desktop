const CHANNEL_NAMES = Object.freeze([
  "activateSharedLine", "applyInnerLifeShareToMemory", "applyInnerLifeShareToSharedLine",
  "archiveDormantMemories", "archiveMemory", "archiveSharedLine", "checkForUpdates", "checkInnerLifeShareTiming",
  "chooseDataRoot", "clearDemoData", "clearLogs", "copyText", "createBackup", "createMemory",
  "createMemoryLabelAlias", "createMemoryRecord", "createSharedLine", "createSharedLineHandoff",
  "deleteBackup", "deleteMemory", "deleteMemoryLabelAlias", "embedMemory", "endInnerLifeSession",
  "exportMemoryArchive", "exportProductJson", "getArchivedMemories", "getDataRootPreference",
  "getDeletedMemories", "getImportPreview", "getInnerLife", "getInnerLifeDigestRuns",
  "getInnerLifeInbox", "getInnerLifeSessions", "getMemories", "getMemoryArchiveSuggestions",
  "getMemoryGraph", "getMemoryLabelAliases", "getMemoryMaintenance", "getMemoryMergeSuggestions",
  "getMemoryRecords", "getMemoryStats", "getResourceSnapshot", "getRestrictedMemories",
  "getLogsSnapshot", "getRuntimeSnapshot", "getSharedLine", "getShellState", "getUiPreferences", "getViewSnapshot", "importMemoryArchive",
  "importOldContinuity", "importOldInnerLife", "importOldMemoria", "importProductJson", "listModels",
  "markInnerLifeShare", "mergeMemories", "openExternal", "openPath", "openUpdateUrl", "previewRestore",
  "processInnerLifeOnce", "processMemoryEmbeddings", "relaunch", "renameSharedLine",
  "restoreArchivedMemory", "restoreBackup", "restoreMemory", "restoreSharedLine", "restrictMemory",
  "reviewInnerLifeShare", "rotateAgentGatewayToken", "runInnerLifeDigest", "runMemoryMaintenance",
  "runtimeChanged", "saveDataRootPreference", "saveSettings", "saveSharedLine", "saveUiPreferences",
  "searchMemories", "seedDemoData", "setInnerLifeDaemon", "setLanguage", "setWindowPreferences",
  "startInnerLifeSession", "submitInnerLifeInbox", "testModelConnection", "tickInnerLifeDaemon",
  "unrestrictMemory", "updateAgentGatewayConfig", "updateInnerLifeProfile", "updateMemory"
]);

const CHANNELS = new Set(CHANNEL_NAMES);

function ipcChannel(name) {
  if (!CHANNELS.has(name)) throw new Error(`Unknown ClaraCore IPC channel: ${name}`);
  return `claracore:${name}`;
}

module.exports = { CHANNEL_NAMES, ipcChannel };
