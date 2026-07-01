const path = require("path");
const fs = require("fs/promises");
const memoria = require("../memoria");

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

function createMemoryRuntime({ ensureProductCore, ensureProductDirectories }) {
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

async function searchProductMemories(app, input) {
  return memoria.search(await ensureProductCore(app), input);
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
  const { database } = await ensureProductCore(app);
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
  const { database } = await ensureProductCore(app);
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
    const deadline = Date.now() + 5 * 60 * 1000;
    while (batches < 1000 && Date.now() < deadline) {
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

  return {
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
  };
}

module.exports = {
  createMemoryRuntime
};
