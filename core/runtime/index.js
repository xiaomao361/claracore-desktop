const { initializeProductDatabase } = require("../db/database");
const { previewImportSources } = require("../import-preview");
const { desktopSettingsPath, ensureProductDirectories, readDesktopSettings, resolveProductPaths } = require("./paths");
const { createBackupRuntime } = require("./backup");
const { createImportRuntime } = require("./imports");
const { createSnapshotRuntime } = require("./snapshot");
const { createMemoryRuntime } = require("./memoria");
const { createDecayRuntime } = require("./decay");
const { seedDemoFixture, clearDemoFixture } = require("./demo-data");
const { PRODUCT_VERSION } = require("../version");
const continuity = require("../continuity");
const innerlife = require("../innerlife");

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}



let _cachedDatabase = null;
let _cachedDatabasePath = null;

function resetCachedDatabase() {
  if (_cachedDatabase && typeof _cachedDatabase.close === "function") {
    _cachedDatabase.close();
  }
  _cachedDatabase = null;
  _cachedDatabasePath = null;
}

async function ensureProductCore(app) {
  const paths = await ensureProductDirectories(app);
  if (!_cachedDatabase || _cachedDatabasePath !== paths.databasePath) {
    _cachedDatabase = await initializeProductDatabase(paths.databasePath);
    _cachedDatabasePath = paths.databasePath;
  }
  return {
    paths,
    database: _cachedDatabase,
    summary: await _cachedDatabase.getSummary()
  };
}

const backupRuntime = createBackupRuntime({
  ensureProductCore,
  productVersion: PRODUCT_VERSION,
  resetCachedDatabase,
  sqlString,
  timestampForFilename
});

const importRuntime = createImportRuntime({
  createProductBackup,
  ensureProductCore,
  productVersion: PRODUCT_VERSION,
  resetCachedDatabase,
  sqlString,
  timestampForFilename
});

const snapshotRuntime = createSnapshotRuntime({
  ensureProductCore
});

const decayRuntime = createDecayRuntime({
  ensureProductCore
});

async function buildProductSnapshot(app) {
  return snapshotRuntime.buildProductSnapshot(app);
}

async function buildProductOverviewSnapshot(app) {
  return snapshotRuntime.buildProductOverviewSnapshot(app);
}

async function getProductViewSnapshot(app, view) {
  return snapshotRuntime.buildProductViewSnapshot(app, view);
}

async function getProductLogsSnapshot(app) {
  return snapshotRuntime.buildProductLogsSnapshot(app);
}

async function getProductDecayAudit(app, input = {}) {
  return decayRuntime.getProductDecayAudit(app, input);
}

const {
  createProductMemory,
  updateProductMemory,
  deleteProductMemory,
  archiveProductMemory,
  restoreProductMemory,
  restoreArchivedProductMemory,
  restrictProductMemory,
  unrestrictProductMemory,
  getProductMemoryStats,
  createProductMemoryRecord,
  getProductMemoryRecords,
  createProductMemoryLabelAlias,
  deleteProductMemoryLabelAlias,
  getProductMemoryLabelAliases,
  searchProductMemories,
  getProductMemories,
  getProductRestrictedMemories,
  getProductDeletedMemories,
  getProductArchivedMemories,
  getProductMemoryGraph,
  getProductMemoryMaintenance,
  runProductMemoryMaintenance,
  getProductMemoryMergeSuggestions,
  mergeProductMemories,
  getProductMemoryArchiveSuggestions,
  archiveProductDormantMemories,
  embedProductMemory,
  processProductMemoryEmbeddings
} = createMemoryRuntime({
  ensureProductCore,
  ensureProductDirectories
});

async function saveProductSettings(app, updates) {
  const { paths, database } = await ensureProductCore(app);
  await database.updateSettings(updates);
  const configuration = await database.getConfiguration(paths);
  return {
    configuration,
    summary: await database.getSummary()
  };
}

async function clearProductLogs(app) {
  const { database } = await ensureProductCore(app);
  return database.clearLogs();
}

async function seedProductDemoData(app) {
  const backup = await createProductBackup(app);
  const { paths, database } = await ensureProductCore(app);
  await seedDemoFixture(database, { dataRoot: paths.dataRoot });
  return { ok: true, backupId: backup?.id || null };
}

async function clearProductDemoData(app) {
  const backup = await createProductBackup(app);
  const { database } = await ensureProductCore(app);
  await clearDemoFixture(database);
  return { ok: true, backupId: backup?.id || null };
}

async function exportProductMemoryArchive(app, input = {}) {
  return importRuntime.exportProductMemoryArchive(app, input);
}

async function exportProductDataJson(app, input = {}) {
  return importRuntime.exportProductDataJson(app, input);
}

async function importProductMemoryArchive(app, input = {}) {
  return importRuntime.importProductMemoryArchive(app, input);
}

async function importProductDataJson(app, input = {}) {
  return importRuntime.importProductDataJson(app, input);
}

async function importOldMemoriaIntoProduct(app, input = {}) {
  return importRuntime.importOldMemoriaIntoProduct(app, input);
}

async function importOldContinuityIntoProduct(app, input = {}) {
  return importRuntime.importOldContinuityIntoProduct(app, input);
}

async function importOldInnerLifeIntoProduct(app, input = {}) {
  return importRuntime.importOldInnerLifeIntoProduct(app, input);
}


async function getProductSharedLine(app, input = {}) {
  return continuity.get(await ensureProductCore(app), input);
}

async function getProductGatewayContext(app, input = {}) {
  return continuity.gatewayContext(await ensureProductCore(app), input);
}

async function saveProductSharedLine(app, input) {
  return continuity.save(await ensureProductCore(app), input);
}

async function createProductSharedLine(app, input) {
  return continuity.create(await ensureProductCore(app), input);
}

async function activateProductSharedLine(app, lineId) {
  return continuity.activate(await ensureProductCore(app), lineId);
}

async function renameProductSharedLine(app, lineId, title) {
  return continuity.rename(await ensureProductCore(app), lineId, title);
}

async function archiveProductSharedLine(app, lineId) {
  return continuity.archive(await ensureProductCore(app), lineId);
}

async function restoreProductSharedLine(app, lineId, makeActive = false) {
  return continuity.restore(await ensureProductCore(app), lineId, makeActive);
}

async function createProductSharedLineHandoff(app, input) {
  return continuity.createHandoff(await ensureProductCore(app), input);
}

async function getProductInnerLife(app) {
  return innerlife.snapshot(await ensureProductCore(app));
}

async function getProductInnerLifeSessions(app, input = {}) {
  return innerlife.sessions(await ensureProductCore(app), input);
}

async function getProductInnerLifeDigestRuns(app, input = {}) {
  return innerlife.digestRuns(await ensureProductCore(app), input);
}

async function getProductInnerLifeInbox(app, input = {}) {
  return innerlife.inbox(await ensureProductCore(app), input);
}

async function getProductInnerLifeDoctor(app, agentId = "codex") {
  return innerlife.doctor(await ensureProductCore(app), agentId);
}

async function updateProductInnerLifeProfile(app, input = {}) {
  return innerlife.updateProfile(await ensureProductCore(app), input);
}

async function listProductInnerLifeProfiles(app, input = {}) {
  return innerlife.profiles(await ensureProductCore(app), input);
}

async function deleteProductInnerLifeProfile(app, input = {}) {
  return innerlife.deleteProfile(await ensureProductCore(app), input);
}

async function submitProductInnerLifeInbox(app, input) {
  return innerlife.submitInbox(await ensureProductCore(app), input);
}

async function startProductInnerLifeSession(app, input) {
  return innerlife.startSession(await ensureProductCore(app), input);
}

async function endProductInnerLifeSession(app, sessionId, input) {
  return innerlife.endSession(await ensureProductCore(app), sessionId, input);
}

async function processProductInnerLifeOnce(app, input) {
  return innerlife.processOnce(await ensureProductCore(app), input);
}

async function runProductInnerLifeDigest(app, input) {
  return innerlife.digest(await ensureProductCore(app), input);
}

async function checkProductInnerLifeShareTiming(app, input) {
  return innerlife.checkShareTiming(await ensureProductCore(app), input);
}

async function setProductInnerLifeDaemon(app, input) {
  return innerlife.setDaemon(await ensureProductCore(app), input);
}

async function tickProductInnerLifeDaemon(app, input) {
  return innerlife.tickDaemon(await ensureProductCore(app), input);
}

async function markProductInnerLifeShare(app, id, action, reason = "", deliveryEvidence = null) {
  return innerlife.markShare(await ensureProductCore(app), id, action, reason, "", deliveryEvidence);
}

async function reviewProductInnerLifeShare(app, id, decision, reason = "") {
  return innerlife.reviewShare(await ensureProductCore(app), id, decision, reason);
}

async function getProductImportPreview(_app) {
  return previewImportSources();
}

async function applyProductInnerLifeShareToMemory(app, id) {
  return innerlife.applyShareToMemory(await ensureProductCore(app), id);
}

async function applyProductInnerLifeShareToSharedLine(app, id) {
  return innerlife.applyShareToSharedLine(await ensureProductCore(app), id);
}

async function createProductBackup(app) {
  return backupRuntime.createProductBackup(app);
}

async function deleteProductBackup(app, backupId) {
  return backupRuntime.deleteProductBackup(app, backupId);
}

async function previewProductRestore(app, backupId) {
  return backupRuntime.previewProductRestore(app, backupId);
}

async function restoreProductBackup(app, backupId) {
  return backupRuntime.restoreProductBackup(app, backupId);
}

module.exports = {
  applyProductInnerLifeShareToMemory,
  applyProductInnerLifeShareToSharedLine,
  buildProductOverviewSnapshot,
  buildProductSnapshot,
  checkProductInnerLifeShareTiming,
  activateProductSharedLine,
  archiveProductDormantMemories,
  archiveProductMemory,
  archiveProductSharedLine,
  clearProductLogs,
  createProductBackup,
  createProductMemoryLabelAlias,
  createProductSharedLine,
  createProductSharedLineHandoff,
  createProductMemory,
  createProductMemoryRecord,
  deleteProductBackup,
  deleteProductInnerLifeProfile,
  deleteProductMemory,
  deleteProductMemoryLabelAlias,
  embedProductMemory,
  ensureProductDirectories,
  ensureProductCore,
  exportProductDataJson,
  exportProductMemoryArchive,
  getProductMemoryStats,
  getProductMemories,
  getProductMemoryLabelAliases,
  getProductMemoryRecords,
  getProductMemoryGraph,
  getProductMemoryMaintenance,
  getProductMemoryArchiveSuggestions,
  getProductMemoryMergeSuggestions,
  getProductLogsSnapshot,
  getProductViewSnapshot,
  getProductDeletedMemories,
  getProductArchivedMemories,
  getProductDecayAudit,
  getProductRestrictedMemories,
  getProductSharedLine,
  getProductGatewayContext,
  getProductInnerLife,
  getProductInnerLifeDoctor,
  getProductInnerLifeDigestRuns,
  getProductInnerLifeInbox,
  getProductInnerLifeSessions,
  getProductImportPreview,
  importProductDataJson,
  importProductMemoryArchive,
  importOldContinuityIntoProduct,
  importOldInnerLifeIntoProduct,
  importOldMemoriaIntoProduct,
  listProductInnerLifeProfiles,
  markProductInnerLifeShare,
  mergeProductMemories,
  processProductMemoryEmbeddings,
  processProductInnerLifeOnce,
  previewProductRestore,
  reviewProductInnerLifeShare,
  resetCachedDatabase,
  restoreProductBackup,
  restoreArchivedProductMemory,
  restoreProductMemory,
  restoreProductSharedLine,
  restrictProductMemory,
  renameProductSharedLine,
  runProductInnerLifeDigest,
  runProductMemoryMaintenance,
  setProductInnerLifeDaemon,
  saveProductSettings,
  saveProductSharedLine,
  searchProductMemories,
  seedProductDemoData,
  clearProductDemoData,
  submitProductInnerLifeInbox,
  tickProductInnerLifeDaemon,
  startProductInnerLifeSession,
  endProductInnerLifeSession,
  unrestrictProductMemory,
  updateProductInnerLifeProfile,
  updateProductMemory,
  desktopSettingsPath,
  readDesktopSettings,
  resolveProductPaths
};
