const path = require("path");
const fs = require("fs/promises");
const { initializeProductDatabase } = require("../db/database");
const { previewImportSources } = require("../import-preview");
const { ensureProductDirectories, resolveProductPaths } = require("./paths");
const { createBackupRuntime } = require("./backup");
const { createImportRuntime } = require("./imports");
const memoria = require("../memoria");
const continuity = require("../continuity");
const innerlife = require("../innerlife");

const PRODUCT_VERSION = "0.2-reset";

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}



function memoryGraphCachePath(paths, includeRestricted = false) {
  return path.join(paths.runtimeDir, includeRestricted ? "memoria-graph-restricted.json" : "memoria-graph-primary.json");
}

async function readMemoryGraphCache(paths, input = {}) {
  if (input.force === true) return null;
  const includeRestricted = Boolean(input.includeRestricted);
  const cachePath = memoryGraphCachePath(paths, includeRestricted);
  try {
    const cache = JSON.parse(await fs.readFile(cachePath, "utf8"));
    if (cache?.includeRestricted === includeRestricted && cache?.graph?.nodes?.length > 0 && cache?.graph?.edges?.length > 0) {
      return {
        ...cache.graph,
        cache: {
          path: cachePath,
          generatedAt: cache.generatedAt,
          includeRestricted
        }
      };
    }
  } catch (_error) {
    return null;
  }
  return null;
}

async function writeMemoryGraphCache(paths, database, input = {}) {
  const includeRestricted = Boolean(input.includeRestricted);
  const limit = includeRestricted ? 1000 : 100;
  const graph = await database.getMemoryGraph({ limit, includeRestricted });
  const cachePath = memoryGraphCachePath(paths, includeRestricted);
  await fs.writeFile(
    cachePath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        includeRestricted,
        limit,
        graph
      },
      null,
      2
    )
  );
  return {
    ...graph,
    cache: {
      path: cachePath,
      generatedAt: new Date().toISOString(),
      includeRestricted
    }
  };
}

async function refreshMemoryGraphCaches(paths, database) {
  const [primary, restricted] = await Promise.all([
    writeMemoryGraphCache(paths, database, { includeRestricted: false }),
    writeMemoryGraphCache(paths, database, { includeRestricted: true })
  ]);
  return {
    primary: primary.cache,
    restricted: restricted.cache
  };
}

function productModules(input = {}) {
  const innerLife = input.innerLife || {};
  const daemon = innerLife.daemon || {};
  const innerLifePresent = Boolean(innerLife.counts || daemon.agentId);
  return [
    {
      id: "gateway",
      label: "Gateway",
      descriptionKey: "module.gateway.description",
      required: true,
      present: true,
      state: "ready"
    },
    {
      id: "memoria",
      label: "Memoria",
      descriptionKey: "module.memoria.description",
      required: true,
      present: true,
      state: "ready"
    },
    {
      id: "continuity",
      label: "Continuity",
      descriptionKey: "module.continuity.description",
      required: true,
      present: true,
      state: "ready"
    },
    {
      id: "innerlife",
      label: "InnerLife",
      descriptionKey: "module.innerlife.description",
      required: true,
      present: innerLifePresent,
      state: daemon.enabled ? "ready" : "paused"
    }
  ];
}

function gatewayLaunchConfig(app, paths) {
  const gatewayScript = path.join(paths.appRoot, "core", "gateway", "mcp-server.js");
  if (app?.isPackaged) {
    return {
      command: process.execPath,
      args: ["--gateway"],
      displayCommand: `"${process.execPath}" --gateway`,
      source: "packaged app"
    };
  }
  return {
    command: "node",
    args: [gatewayScript],
    displayCommand: `node ${gatewayScript}`,
    source: "development checkout"
  };
}

function productAgentSetup(app, paths, configuration) {
  const agentId = configuration?.gateway?.agentId || "codex";
  const launch = gatewayLaunchConfig(app, paths);
  return {
    gatewayStatus: "available",
    mcpServerName: "claracore-desktop",
    mcpCommand: launch.displayCommand,
    mcpConfig: JSON.stringify(
      {
        mcpServers: {
          "claracore-desktop": {
            type: "stdio",
            command: launch.command,
            args: launch.args,
            env: {
              CLARACORE_AGENT_ID: agentId,
              CLARACORE_DESKTOP_DATA_DIR: paths.dataRoot
            }
          }
        }
      },
      null,
      2
    ),
    httpEndpoints: [],
    python: "not required for Desktop Gateway",
    pythonSource: "Node/Electron runtime",
    gatewayEnvPath: "not used in product core reset"
  };
}

async function canWriteRuntimeProbe(paths) {
  const probePath = path.join(paths.runtimeDir, ".write-check");
  try {
    await fs.writeFile(probePath, String(Date.now()), "utf8");
    await fs.unlink(probePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function buildHealthChecks(app, paths, configuration, databaseSummary, canWriteRuntime) {
  const checks = [
    {
      id: "data-root",
      level: canWriteRuntime ? "ok" : "error",
      labelKey: "health.dataRoot",
      detail: canWriteRuntime ? paths.dataRoot : `${paths.dataRoot} is not writable`
    },
    {
      id: "database",
      level: databaseSummary?.initialized ? "ok" : "warn",
      labelKey: "health.database",
      detail: paths.databasePath
    },
    {
      id: "gateway",
      level: "ok",
      labelKey: "health.gateway",
      detail: app?.isPackaged ? "packaged stdio gateway" : "development stdio gateway"
    },
    {
      id: "embedding",
      level: configuration?.memoria?.provider === "ollama" && configuration?.memoria?.endpoint ? "ok" : "warn",
      labelKey: "health.embedding",
      detail: `${configuration?.memoria?.provider || "unknown"} ${configuration?.memoria?.model || ""}`.trim()
    },
    {
      id: "old-services",
      level: "ok",
      labelKey: "health.oldServices",
      detail: "not controlled by Desktop"
    }
  ];
  return {
    status: checks.some((check) => check.level === "error")
      ? "error"
      : checks.some((check) => check.level === "warn")
        ? "warn"
        : "ok",
    checks
  };
}

async function buildProductSnapshot(app) {
  const paths = await ensureProductDirectories(app);
  const database = await initializeProductDatabase(paths.databasePath);
  const configuration = await database.getConfiguration(paths);
  const databaseSummary = await database.getSummary();
  const memories = await database.listMemories(20);
  const restrictedMemories = await database.listRestrictedMemories(20);
  const deletedMemories = await database.listDeletedMemories(20);
  const archivedMemories = await database.listArchivedMemories(20);
  const memoryStats = await database.getMemoryStats();
  const memoryLabelAliases = await database.listMemoryLabelAliases();
  const memoryGraph = await database.getMemoryGraph({ limit: 100 });
  const memoryMaintenance = await database.getMemoryMaintenanceReport();
  const memoryMergeSuggestions = await database.getMemoryMergeSuggestions({ limit: 5 });
  const memoryArchiveSuggestions = await database.getMemoryArchiveSuggestions({ limit: 5, olderThanDays: 30 });
  const memoryRecords = await database.listMemoryRecords({ limit: 10 });
  const memoryRecordStats = await database.getMemoryRecordStats();
  const sharedLine = await database.getResumePacket();
  const innerLife = await database.getInnerLifeSnapshot();
  const gatewayTraces = await database.listGatewayTraces({ limit: 20 });
  const runtimeEvents = await database.listRuntimeEvents({ limit: 50 });
  const importPreview = await previewImportSources();
  const backups = await database.listBackups(5);
  const health = buildHealthChecks(app, paths, configuration, databaseSummary, await canWriteRuntimeProbe(paths));
  return {
    mode: process.env.CLARACORE_DESKTOP_DATA_DIR ? "custom-product-data" : "isolated-product-dev",
    productVersion: PRODUCT_VERSION,
    root: paths.appRoot,
    appRoot: paths.appRoot,
    coreStatus: health.status === "ok" ? "Ready" : "Needs attention",
    data: {
      root: paths.dataRoot,
      databasePath: paths.databasePath,
      databasePresent: Boolean(databaseSummary.initialized),
      backupsDir: paths.backupsDir,
      exportsDir: paths.exportsDir,
      runtimeDir: paths.runtimeDir,
      logsDir: paths.logsDir
    },
    database: databaseSummary,
    health,
    connections: productAgentSetup(app, paths, configuration),
    configuration,
    memories,
    restrictedMemories,
    deletedMemories,
    archivedMemories,
    memoryStats,
    memoryLabelAliases,
    memoryGraph,
    memoryMaintenance,
    memoryMergeSuggestions,
    memoryArchiveSuggestions,
    memoryRecords,
    memoryRecordStats,
    sharedLine,
    innerLife,
    gatewayTraces,
    runtimeEvents,
    importPreview,
    backups,
    modules: productModules({ innerLife }),
    plans: {
      productReset: path.join(paths.appRoot, "docs", "ARCHITECTURE.md"),
      v02Legacy: path.join(paths.appRoot, "docs", "CLEANUP_PLAN.md")
    }
  };
}

async function ensureProductCore(app) {
  const paths = await ensureProductDirectories(app);
  const database = await initializeProductDatabase(paths.databasePath);
  return {
    paths,
    database,
    summary: await database.getSummary()
  };
}

const backupRuntime = createBackupRuntime({
  ensureProductCore,
  productVersion: PRODUCT_VERSION,
  sqlString,
  timestampForFilename
});

const importRuntime = createImportRuntime({
  createProductBackup,
  ensureProductCore,
  productVersion: PRODUCT_VERSION,
  sqlString,
  timestampForFilename
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

async function createProductMemory(app, input) {
  return memoria.create(await ensureProductCore(app), input);
}

async function updateProductMemory(app, id, input) {
  return memoria.update(await ensureProductCore(app), id, input);
}

async function deleteProductMemory(app, id) {
  return memoria.remove(await ensureProductCore(app), id);
}

async function archiveProductMemory(app, id) {
  return memoria.archive(await ensureProductCore(app), id);
}

async function restoreProductMemory(app, id) {
  return memoria.restore(await ensureProductCore(app), id);
}

async function restoreArchivedProductMemory(app, id) {
  return memoria.restoreArchived(await ensureProductCore(app), id);
}

async function restrictProductMemory(app, id) {
  return memoria.restrict(await ensureProductCore(app), id);
}

async function unrestrictProductMemory(app, id) {
  return memoria.unrestrict(await ensureProductCore(app), id);
}

async function getProductMemoryStats(app) {
  return memoria.stats(await ensureProductCore(app));
}

async function createProductMemoryRecord(app, input) {
  return memoria.createRecord(await ensureProductCore(app), input);
}

async function getProductMemoryRecords(app, input = {}) {
  return memoria.records(await ensureProductCore(app), input);
}

async function createProductMemoryLabelAlias(app, input) {
  return memoria.createLabelAlias(await ensureProductCore(app), input);
}

async function deleteProductMemoryLabelAlias(app, alias) {
  return memoria.deleteLabelAlias(await ensureProductCore(app), alias);
}

async function getProductMemoryLabelAliases(app) {
  return memoria.labelAliases(await ensureProductCore(app));
}

async function searchProductMemories(app, query) {
  return memoria.search(await ensureProductCore(app), query);
}

async function getProductMemories(app, input = {}) {
  return memoria.list(await ensureProductCore(app), input);
}

async function getProductRestrictedMemories(app, input = {}) {
  return memoria.restricted(await ensureProductCore(app), input);
}

async function getProductDeletedMemories(app, input = {}) {
  return memoria.deleted(await ensureProductCore(app), input);
}

async function getProductArchivedMemories(app, input = {}) {
  return memoria.archived(await ensureProductCore(app), input);
}

async function getProductMemoryGraph(app, input = {}) {
  const paths = await ensureProductDirectories(app);
  const database = await initializeProductDatabase(paths.databasePath);
  if (input?.includeRestricted) {
    return (await readMemoryGraphCache(paths, input || {})) || database.getMemoryGraph(input || {});
  }
  return database.getMemoryGraph(input || {});
}

async function getProductMemoryMaintenance(app) {
  return memoria.maintenance(await ensureProductCore(app));
}

async function runProductMemoryMaintenance(app, input = {}) {
  const paths = await ensureProductDirectories(app);
  const database = await initializeProductDatabase(paths.databasePath);
  const maintenance = await database.runMemoryMaintenance(input || {});
  let graphCache = null;
  let embeddings = null;
  if (input?.dryRun !== true) {
    embeddings = await database.processPendingEmbeddings(input?.embeddingLimit ?? 20);
    graphCache = await refreshMemoryGraphCaches(paths, database);
    await database.recordRuntimeEvent({
      level: embeddings.results?.some((item) => !item.ok) ? "warn" : "info",
      source: "memoria",
      message: "Memoria maintenance completed",
      metadata: {
        scheduled: Boolean(input?.scheduled),
        actions: maintenance.actions || [],
        embeddings: summarizeEmbeddingProcessResult(embeddings),
        graphCache
      }
    });
  }
  return {
    ...maintenance,
    embeddings,
    graphCache
  };
}

async function getProductMemoryMergeSuggestions(app, input = {}) {
  return memoria.mergeSuggestions(await ensureProductCore(app), input);
}

async function mergeProductMemories(app, input = {}) {
  return memoria.merge(await ensureProductCore(app), input);
}

async function getProductMemoryArchiveSuggestions(app, input = {}) {
  return memoria.archiveSuggestions(await ensureProductCore(app), input);
}

async function archiveProductDormantMemories(app, input = {}) {
  return memoria.archiveDormant(await ensureProductCore(app), input);
}

async function embedProductMemory(app, id) {
  return memoria.embed(await ensureProductCore(app), id);
}

function summarizeEmbeddingProcessResult(result) {
  const rows = result?.results || [];
  return {
    processed: Number(result?.processed || rows.length || 0),
    ready: rows.filter((item) => item.ok).length,
    failed: rows.filter((item) => !item.ok).length,
    batches: Number(result?.batches || 1)
  };
}

function normalizeEmbeddingProcessInput(input) {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return {
      all: Boolean(input.all || input.mode === "all"),
      requeue: Boolean(input.requeue),
      batchSize: Math.max(1, Math.min(20, Number.parseInt(String(input.batchSize || input.limit || 20), 10) || 20))
    };
  }
  return {
    all: false,
    requeue: false,
    batchSize: Math.max(1, Math.min(20, Number.parseInt(String(input || 5), 10) || 5))
  };
}

async function processProductMemoryEmbeddings(app, input = 5) {
  const { database } = await ensureProductCore(app);
  const options = normalizeEmbeddingProcessInput(input);
  let result;
  if (options.all) {
    const maintenance = await database.runMemoryMaintenance({});
    const results = [];
    let batches = 0;
    while (batches < 1000) {
      const batch = await database.processPendingEmbeddings(options.batchSize);
      batches += 1;
      results.push(...(batch.results || []));
      if (!batch.processed) break;
    }
    result = {
      mode: "all",
      batchSize: options.batchSize,
      batches,
      processed: results.length,
      maintenanceActions: maintenance.actions || [],
      results
    };
  } else {
    const maintenance = options.requeue ? await database.runMemoryMaintenance({}) : null;
    result = {
      mode: "batch",
      batchSize: options.batchSize,
      maintenanceActions: maintenance?.actions || [],
      ...(await database.processPendingEmbeddings(options.batchSize))
    };
  }
  const summary = summarizeEmbeddingProcessResult(result);
  await database.recordRuntimeEvent({
    level: summary.failed > 0 ? "warn" : "info",
    source: "memoria",
    message: options.all ? "Processed all pending Memory embeddings" : "Processed pending Memory embedding batch",
    metadata: {
      mode: result.mode,
      batchSize: options.batchSize,
      ...summary
    }
  });
  return result;
}

async function exportProductMemoryArchive(app, input = {}) {
  return importRuntime.exportProductMemoryArchive(app, input);
}

async function importProductMemoryArchive(app, input = {}) {
  return importRuntime.importProductMemoryArchive(app, input);
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

async function getProductInnerLifeDoctor(app, agentId = "codex") {
  return innerlife.doctor(await ensureProductCore(app), agentId);
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

async function markProductInnerLifeShare(app, id, action, reason = "") {
  return innerlife.markShare(await ensureProductCore(app), id, action, reason);
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

async function previewProductRestore(app, backupId) {
  return backupRuntime.previewProductRestore(app, backupId);
}

async function restoreProductBackup(app, backupId) {
  return backupRuntime.restoreProductBackup(app, backupId);
}

module.exports = {
  applyProductInnerLifeShareToMemory,
  applyProductInnerLifeShareToSharedLine,
  buildProductSnapshot,
  checkProductInnerLifeShareTiming,
  activateProductSharedLine,
  archiveProductDormantMemories,
  archiveProductMemory,
  archiveProductSharedLine,
  createProductBackup,
  createProductMemoryLabelAlias,
  createProductSharedLine,
  createProductSharedLineHandoff,
  createProductMemory,
  createProductMemoryRecord,
  deleteProductMemory,
  deleteProductMemoryLabelAlias,
  embedProductMemory,
  ensureProductDirectories,
  ensureProductCore,
  exportProductMemoryArchive,
  getProductMemoryStats,
  getProductMemories,
  getProductMemoryLabelAliases,
  getProductMemoryRecords,
  getProductMemoryGraph,
  getProductMemoryMaintenance,
  getProductMemoryArchiveSuggestions,
  getProductMemoryMergeSuggestions,
  getProductDeletedMemories,
  getProductArchivedMemories,
  getProductRestrictedMemories,
  getProductSharedLine,
  getProductGatewayContext,
  getProductInnerLife,
  getProductInnerLifeDoctor,
  getProductImportPreview,
  importProductMemoryArchive,
  importOldContinuityIntoProduct,
  importOldInnerLifeIntoProduct,
  importOldMemoriaIntoProduct,
  markProductInnerLifeShare,
  mergeProductMemories,
  processProductMemoryEmbeddings,
  processProductInnerLifeOnce,
  previewProductRestore,
  reviewProductInnerLifeShare,
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
  submitProductInnerLifeInbox,
  tickProductInnerLifeDaemon,
  startProductInnerLifeSession,
  endProductInnerLifeSession,
  unrestrictProductMemory,
  updateProductMemory,
  resolveProductPaths
};
