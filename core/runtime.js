const path = require("path");
const fs = require("fs/promises");
const { ProductDatabase, initializeProductDatabase } = require("./db/database");
const { previewImportSources, quoteIdentifier, runSqliteReadOnly } = require("./import-preview");

const PRODUCT_VERSION = "0.2-reset";

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function safeArchiveString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function normalizeArchiveLabels(labels) {
  if (Array.isArray(labels)) {
    return [...new Set(labels.map((label) => String(label || "").trim().toLowerCase()).filter(Boolean))];
  }
  return [...new Set(String(labels || "").split(",").map((label) => label.trim().toLowerCase()).filter(Boolean))];
}

function normalizeArchiveStatus(status) {
  return ["active", "deleted", "archived"].includes(status) ? status : "active";
}

function normalizeArchiveSensitivity(sensitivity) {
  return sensitivity === "restricted" ? "restricted" : "normal";
}

function stableImportId(prefix, sourceId) {
  return `${prefix}_${String(sourceId || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || Date.now().toString(36)}`;
}

function pickFirst(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return fallback;
}

function normalizeImportLabels(labels) {
  if (Array.isArray(labels)) return labels.map((label) => String(label || "").trim().toLowerCase()).filter(Boolean);
  return String(labels || "")
    .split(",")
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeContinuityStatus(status) {
  return String(status || "").trim() === "archived" ? "archived" : "active";
}

function normalizeInterpretationStatus(status) {
  return String(status || "").trim() === "confirmed" ? "confirmed" : "draft";
}

function normalizeLegacyContinuityInterpretationStatus(row) {
  if (Number(row?.user_confirmed || 0) === 1) return "confirmed";
  const status = String(pickFirst(row, ["interpretation_status", "interpretationStatus", "status"], "draft") || "draft")
    .trim()
    .toLowerCase();
  return ["confirmed", "user_confirmed"].includes(status) ? "confirmed" : "draft";
}

function buildLegacyContinuityMetadata(row = {}) {
  return {
    source: "old-continuity",
    threadId: String(pickFirst(row, ["thread_id", "source_thread_id"], "") || ""),
    agentId: String(pickFirst(row, ["agent_id"], "") || ""),
    visibility: String(pickFirst(row, ["visibility"], "") || ""),
    mode: String(pickFirst(row, ["mode"], "") || ""),
    nextStep: String(pickFirst(row, ["next_step", "nextStep"], "") || ""),
    stateSummary: String(pickFirst(row, ["state_summary", "stateSummary"], "") || ""),
    sourceSession: String(pickFirst(row, ["source_session", "sourceSession"], "") || ""),
    notes: String(pickFirst(row, ["notes"], "") || ""),
    tags: safeJsonArray(pickFirst(row, ["tags"], "[]")),
    currentInterpretation: String(pickFirst(row, ["current_interpretation", "currentInterpretation"], "") || ""),
    interpretationStatusRaw: String(pickFirst(row, ["interpretation_status", "interpretationStatus"], "") || ""),
    userConfirmed: Number(row?.user_confirmed || 0) === 1,
    positionHistory: safeJsonArray(pickFirst(row, ["emotional_arc", "position_history", "positionHistory"], "[]")),
    affectiveTrace: safeJsonArray(pickFirst(row, ["affective_trace", "affectiveTrace"], "[]")),
    realityLine: String(pickFirst(row, ["reality_line", "realityLine"], "") || ""),
    entryPosture: String(pickFirst(row, ["entry_posture", "entryPosture"], "") || ""),
    confirmedGround: String(pickFirst(row, ["confirmed_ground", "confirmedGround"], "") || ""),
    provisionalRead: String(pickFirst(row, ["provisional_read", "provisionalRead"], "") || ""),
    boundaryNotes: String(pickFirst(row, ["boundary_notes", "boundaryNotes"], "") || ""),
    misreadRisks: String(pickFirst(row, ["misread_risks", "misreadRisks"], "") || ""),
    archivedArcIds: safeJsonArray(pickFirst(row, ["archived_arc_ids", "archivedArcIds"], "[]"))
  };
}

function safeJsonArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (value === undefined || value === null || String(value).trim() === "") return [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch (_error) {
    // Old services used a few plain-text fallbacks. Preserve them as a single item.
  }
  return [String(value).trim()].filter(Boolean);
}

function safeJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function normalizeInnerLifeShareStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return ["pending", "approved", "rejected", "used", "deferred", "discarded"].includes(normalized) ? normalized : "pending";
}

function normalizeInnerLifeReviewStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["approved", "reviewed"].includes(normalized)) return "reviewed";
  if (["rejected", "dismissed"].includes(normalized)) return "dismissed";
  return "unreviewed";
}

function normalizeInnerLifeEventStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return ["pending", "processed", "failed"].includes(normalized) ? normalized : "processed";
}

function legacyAgentLabels(sourceAgent, source = "") {
  const key = String(sourceAgent || source || "").trim().toLowerCase();
  if (key === "clara") return ["tool:claude-code", "agent:clara", "agent-id:claude-code:clara"];
  if (["hermes", "lara", "lara-hermes"].includes(key)) return ["tool:hermes", "agent:lara", "agent-id:hermes:lara"];
  if (key === "codex") return ["tool:codex", "agent:codex", "agent-id:codex"];
  return [];
}

function parseImportJson(value, fallback = null) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch (_error) {
    return fallback;
  }
}

function compactImportText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return fallback;
    const parsed = parseImportJson(raw, null);
    if (parsed !== null) return compactImportText(parsed, raw);
    return raw;
  }
  if (Array.isArray(value)) {
    return value.map((item) => compactImportText(item, "")).filter(Boolean).slice(0, 5).join("\n");
  }
  if (typeof value === "object") {
    if (Object.keys(value).length === 0) return fallback;
    for (const key of [
      "summary",
      "content",
      "body",
      "text",
      "title",
      "reason",
      "conversation_summary",
      "agent_afterthought",
      "experience_summary",
      "current_interpretation",
      "objective",
      "selected_url",
      "selection_reason"
    ]) {
      const text = compactImportText(value[key], "");
      if (text) return text;
    }
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return fallback;
    }
  }
  return String(value || "").trim() || fallback;
}

function normalizeInnerLifeInboxStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return ["pending", "processed", "failed"].includes(normalized) ? normalized : "processed";
}

function normalizeInnerLifeSessionStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return ["active", "open", "running"].includes(normalized) ? "active" : "ended";
}

function normalizeInnerLifeDigestStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (["failed", "error"].includes(normalized)) return "failed";
  if (["pending", "running"].includes(normalized)) return "pending";
  return "completed";
}

function reviewStatusFromShareStatus(status) {
  const normalized = normalizeInnerLifeShareStatus(status);
  if (["approved", "used"].includes(normalized)) return "reviewed";
  if (["rejected", "discarded"].includes(normalized)) return "dismissed";
  return "unreviewed";
}


function resolveDataRoot(app) {
  if (process.env.CLARACORE_DESKTOP_DATA_DIR) {
    return path.resolve(process.env.CLARACORE_DESKTOP_DATA_DIR);
  }
  return path.join(app.getPath("userData"), "product-dev");
}

function resolveProductPaths(app) {
  const dataRoot = resolveDataRoot(app);
  return {
    appRoot: path.resolve(__dirname, ".."),
    dataRoot,
    databasePath: path.join(dataRoot, "claracore.db"),
    backupsDir: path.join(dataRoot, "backups"),
    exportsDir: path.join(dataRoot, "exports"),
    runtimeDir: path.join(dataRoot, "runtime"),
    logsDir: path.join(dataRoot, "logs")
  };
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
    python: "bundled runtime planned",
    pythonSource: launch.source,
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
    restrictedMemories: [],
    deletedMemories: [],
    archivedMemories: [],
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
      productReset: path.join(paths.appRoot, "docs", "product-core-reset.md"),
      v02Legacy: path.join(paths.appRoot, "docs", "v0.2-plan.md")
    }
  };
}

async function ensureProductDirectories(app) {
  const paths = resolveProductPaths(app);
  await Promise.all([
    fs.mkdir(paths.dataRoot, { recursive: true }),
    fs.mkdir(paths.backupsDir, { recursive: true }),
    fs.mkdir(paths.exportsDir, { recursive: true }),
    fs.mkdir(paths.runtimeDir, { recursive: true }),
    fs.mkdir(paths.logsDir, { recursive: true })
  ]);
  return paths;
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
  const { database } = await ensureProductCore(app);
  return database.createMemory(input);
}

async function updateProductMemory(app, id, input) {
  const { database } = await ensureProductCore(app);
  return database.updateMemory(id, input);
}

async function deleteProductMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.deleteMemory(id);
}

async function archiveProductMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.archiveMemory(id);
}

async function restoreProductMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.restoreMemory(id);
}

async function restoreArchivedProductMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.restoreArchivedMemory(id);
}

async function restrictProductMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.setMemorySensitivity(id, "restricted");
}

async function unrestrictProductMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.setMemorySensitivity(id, "normal");
}

async function getProductMemoryStats(app) {
  const { database } = await ensureProductCore(app);
  return database.getMemoryStats();
}

async function createProductMemoryRecord(app, input) {
  const { database } = await ensureProductCore(app);
  return database.createMemoryRecord(input);
}

async function getProductMemoryRecords(app, input = {}) {
  const { database } = await ensureProductCore(app);
  return {
    records: await database.listMemoryRecords(input || {}),
    stats: await database.getMemoryRecordStats()
  };
}

async function createProductMemoryLabelAlias(app, input) {
  const { database } = await ensureProductCore(app);
  return database.createMemoryLabelAlias(input);
}

async function deleteProductMemoryLabelAlias(app, alias) {
  const { database } = await ensureProductCore(app);
  return database.deleteMemoryLabelAlias(alias);
}

async function getProductMemoryLabelAliases(app) {
  const { database } = await ensureProductCore(app);
  return database.listMemoryLabelAliases();
}

async function searchProductMemories(app, query) {
  const { database } = await ensureProductCore(app);
  return database.searchMemories(query, 50);
}

function normalizeListInput(input, fallbackLimit = 20) {
  if (typeof input === "number" || typeof input === "string") {
    return {
      limit: Math.max(1, Number.parseInt(String(input), 10) || fallbackLimit),
      offset: 0
    };
  }
  return {
    limit: Math.max(1, Number.parseInt(String(input?.limit || fallbackLimit), 10) || fallbackLimit),
    offset: Math.max(0, Number.parseInt(String(input?.offset || 0), 10) || 0)
  };
}

async function getProductMemories(app, input = {}) {
  const { database } = await ensureProductCore(app);
  const paging = normalizeListInput(input, 20);
  return database.listMemories(paging.limit, "", { offset: paging.offset });
}

async function getProductRestrictedMemories(app, input = {}) {
  const { database } = await ensureProductCore(app);
  const paging = normalizeListInput(input, 20);
  return database.listRestrictedMemories(paging.limit, { offset: paging.offset });
}

async function getProductDeletedMemories(app, input = {}) {
  const { database } = await ensureProductCore(app);
  const paging = normalizeListInput(input, 20);
  return database.listDeletedMemories(paging.limit, { offset: paging.offset });
}

async function getProductArchivedMemories(app, input = {}) {
  const { database } = await ensureProductCore(app);
  const paging = normalizeListInput(input, 20);
  return database.listArchivedMemories(paging.limit, { offset: paging.offset });
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
  const { database } = await ensureProductCore(app);
  return database.getMemoryMaintenanceReport();
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
  const { database } = await ensureProductCore(app);
  return database.getMemoryMergeSuggestions(input || {});
}

async function mergeProductMemories(app, input = {}) {
  const { database } = await ensureProductCore(app);
  return database.mergeMemories(input || {});
}

async function getProductMemoryArchiveSuggestions(app, input = {}) {
  const { database } = await ensureProductCore(app);
  return database.getMemoryArchiveSuggestions(input || {});
}

async function archiveProductDormantMemories(app, input = {}) {
  const { database } = await ensureProductCore(app);
  return database.archiveDormantMemories(input || {});
}

async function embedProductMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.embedMemory(id);
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
  const { paths, database } = await ensureProductCore(app);
  const createdAt = new Date().toISOString();
  const filename = `claracore-memory-export-${timestampForFilename(new Date(createdAt))}.json`;
  const targetPath = path.resolve(input?.targetPath || path.join(paths.exportsDir, filename));
  const exportsRoot = path.resolve(paths.exportsDir);
  if (!targetPath.startsWith(`${exportsRoot}${path.sep}`) && !input?.allowExternalPath) {
    throw new Error("Memory export path must be inside the product exports directory.");
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const memoryRows = await database.query(`
    SELECT
      m.id,
      m.title,
      m.body,
      m.status,
      m.sensitivity,
      m.source_id,
      m.created_at,
      m.updated_at,
      COALESCE(group_concat(l.label, ','), '') AS labels
    FROM memories m
    LEFT JOIN memory_labels l ON l.memory_id = m.id
    GROUP BY m.id
    ORDER BY m.created_at ASC;
  `);
  const recordRows = await database.query(`
    SELECT id, user_id, record_type, title, value_json, occurred_at, local_date, timezone,
           schema_version, note, source, source_agent, source_run_id, dedupe_key,
           status, memory_id, created_at, updated_at, metadata_json
    FROM memory_records
    ORDER BY occurred_at ASC, created_at ASC;
  `);
  const aliases = await database.listMemoryLabelAliases();
  const archive = {
    format: "claracore.memory.archive",
    version: 1,
    exportedAt: createdAt,
    productVersion: PRODUCT_VERSION,
    source: {
      dataRoot: paths.dataRoot,
      databasePath: paths.databasePath
    },
    counts: {
      memories: memoryRows.length,
      aliases: aliases.length,
      records: recordRows.length
    },
    memories: memoryRows.map((row) => ({
      id: row.id,
      title: row.title || "",
      body: row.body || "",
      status: normalizeArchiveStatus(row.status),
      sensitivity: normalizeArchiveSensitivity(row.sensitivity),
      sourceId: row.source_id || "",
      labels: normalizeArchiveLabels(row.labels),
      createdAt: row.created_at || createdAt,
      updatedAt: row.updated_at || row.created_at || createdAt
    })),
    labelAliases: aliases,
    records: recordRows.map((row) => ({
      id: row.id,
      userId: row.user_id || "local-user",
      recordType: row.record_type,
      title: row.title || "",
      value: JSON.parse(row.value_json || "{}"),
      occurredAt: row.occurred_at,
      localDate: row.local_date || "",
      timezone: row.timezone || "Asia/Shanghai",
      schemaVersion: row.schema_version || 1,
      note: row.note || "",
      source: row.source || "",
      sourceAgent: row.source_agent || "",
      sourceRunId: row.source_run_id || "",
      dedupeKey: row.dedupe_key || "",
      status: normalizeArchiveStatus(row.status),
      memoryId: row.memory_id || null,
      createdAt: row.created_at || createdAt,
      updatedAt: row.updated_at || row.created_at || createdAt,
      metadata: JSON.parse(row.metadata_json || "{}")
    }))
  };
  await fs.writeFile(targetPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
  return {
    path: targetPath,
    createdAt,
    counts: archive.counts
  };
}

async function importProductMemoryArchive(app, input = {}) {
  const requestedFilePath = String(input?.filePath || "").trim();
  if (!requestedFilePath) throw new Error("Memory import file path is required.");
  const filePath = path.resolve(requestedFilePath);
  const raw = await fs.readFile(filePath, "utf8");
  const archive = JSON.parse(raw);
  if (archive?.format !== "claracore.memory.archive" || archive?.version !== 1) {
    throw new Error("Unsupported Memory archive format.");
  }
  const { database } = await ensureProductCore(app);
  const importedAt = new Date().toISOString();
  const sourceId = `memory_json_${Date.now().toString(36)}`;
  const memories = Array.isArray(archive.memories) ? archive.memories : [];
  const aliases = Array.isArray(archive.labelAliases) ? archive.labelAliases : [];
  const records = Array.isArray(archive.records) ? archive.records : [];
  const summary = {
    importedAt,
    filePath,
    memories: { imported: 0, skipped: 0 },
    aliases: { imported: 0, skipped: 0 },
    records: { imported: 0, skipped: 0 }
  };

  await database.exec(`
    INSERT INTO memory_sources (id, kind, label, source_path, imported_at, metadata_json)
    VALUES (${sqlString(sourceId)}, 'import', 'Memory JSON import', ${sqlString(filePath)}, ${sqlString(importedAt)}, ${sqlString(JSON.stringify({
      format: archive.format,
      version: archive.version,
      exportedAt: archive.exportedAt || null
    }))})
    ON CONFLICT(id) DO NOTHING;
  `);

  for (const aliasEntry of aliases) {
    const alias = normalizeArchiveLabels(aliasEntry?.alias || "")[0] || "";
    const canonicalLabel = normalizeArchiveLabels(aliasEntry?.canonicalLabel || aliasEntry?.canonical_label || "")[0] || "";
    if (!alias || !canonicalLabel || alias === canonicalLabel) {
      summary.aliases.skipped += 1;
      continue;
    }
    const existing = await database.query(`
      SELECT alias
      FROM memory_label_aliases
      WHERE alias = ${sqlString(alias)}
      LIMIT 1;
    `);
    if (existing.length) {
      summary.aliases.skipped += 1;
      continue;
    }
    await database.exec(`
      INSERT INTO memory_label_aliases (alias, canonical_label, created_at)
      VALUES (${sqlString(alias)}, ${sqlString(canonicalLabel)}, ${sqlString(aliasEntry.createdAt || importedAt)});
    `);
    summary.aliases.imported += 1;
  }

  for (const memory of memories) {
    const id = safeArchiveString(memory?.id);
    const body = safeArchiveString(memory?.body);
    if (!id || !body) {
      summary.memories.skipped += 1;
      continue;
    }
    const existing = await database.query(`
      SELECT id
      FROM memories
      WHERE id = ${sqlString(id)}
      LIMIT 1;
    `);
    if (existing.length) {
      summary.memories.skipped += 1;
      continue;
    }
    const labels = await database.canonicalizeMemoryLabels(memory?.labels || []);
    await database.exec(`
      INSERT INTO memories (id, title, body, status, sensitivity, source_id, created_at, updated_at)
      VALUES (
        ${sqlString(id)},
        ${memory?.title ? sqlString(memory.title) : "NULL"},
        ${sqlString(body)},
        ${sqlString(normalizeArchiveStatus(memory?.status))},
        ${sqlString(normalizeArchiveSensitivity(memory?.sensitivity))},
        ${sqlString(sourceId)},
        ${sqlString(memory?.createdAt || importedAt)},
        ${sqlString(memory?.updatedAt || memory?.createdAt || importedAt)}
      );
      ${labels
        .map(
          (label) => `
            INSERT INTO memory_labels (memory_id, label)
            VALUES (${sqlString(id)}, ${sqlString(label)})
            ON CONFLICT(memory_id, label) DO NOTHING;
          `
        )
        .join("\n")}
    `);
    if (normalizeArchiveStatus(memory?.status) === "active" && normalizeArchiveSensitivity(memory?.sensitivity) !== "restricted") {
      await database.markMemoryEmbeddingPending(id);
    }
    summary.memories.imported += 1;
  }

  for (const record of records) {
    const id = safeArchiveString(record?.id);
    const recordType = safeArchiveString(record?.recordType || record?.record_type).toLowerCase();
    if (!id || !recordType) {
      summary.records.skipped += 1;
      continue;
    }
    const existing = await database.query(`
      SELECT id
      FROM memory_records
      WHERE id = ${sqlString(id)}
      LIMIT 1;
    `);
    if (existing.length) {
      summary.records.skipped += 1;
      continue;
    }
    const metadata = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
    const userId = safeArchiveString(record?.userId || record?.user_id || metadata.userId, "local-user");
    const occurredAt = safeArchiveString(record?.occurredAt || record?.occurred_at, importedAt);
    const timezone = safeArchiveString(record?.timezone || metadata.timezone, "Asia/Shanghai");
    const localDate = safeArchiveString(record?.localDate || record?.local_date, occurredAt.slice(0, 10));
    const schemaVersion = Number.parseInt(String(record?.schemaVersion || record?.schema_version || 1), 10) || 1;
    await database.exec(`
      INSERT INTO memory_records (
        id, user_id, record_type, title, value_json, occurred_at, local_date,
        timezone, schema_version, note, source, source_agent, source_run_id,
        dedupe_key, status, memory_id, created_at, updated_at, metadata_json
      )
      VALUES (
        ${sqlString(id)},
        ${sqlString(userId)},
        ${sqlString(recordType)},
        ${sqlString(safeArchiveString(record?.title, recordType) || recordType)},
        ${sqlString(JSON.stringify(record?.value && typeof record.value === "object" ? record.value : {}))},
        ${sqlString(occurredAt)},
        ${sqlString(localDate)},
        ${sqlString(timezone)},
        ${schemaVersion},
        ${record?.note ? sqlString(record.note) : "NULL"},
        ${sqlString(record?.source || sourceId)},
        ${record?.sourceAgent || record?.source_agent ? sqlString(record.sourceAgent || record.source_agent) : "NULL"},
        ${record?.sourceRunId || record?.source_run_id ? sqlString(record.sourceRunId || record.source_run_id) : "NULL"},
        ${record?.dedupeKey || record?.dedupe_key ? sqlString(record.dedupeKey || record.dedupe_key) : "NULL"},
        ${sqlString(normalizeArchiveStatus(record?.status))},
        ${record?.memoryId ? sqlString(record.memoryId) : "NULL"},
        ${sqlString(record?.createdAt || importedAt)},
        ${sqlString(record?.updatedAt || record?.createdAt || importedAt)},
        ${sqlString(JSON.stringify(metadata))}
      );
    `);
    summary.records.imported += 1;
  }

  return {
    ...summary,
    maintenance: await database.runMemoryMaintenance({ dryRun: false }),
    stats: await database.getMemoryStats()
  };
}

async function readOldMemoriaRows(dbPath) {
  const tableRows = await runSqliteReadOnly(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
  const tables = new Set(tableRows.map((row) => row.name));
  const readTable = async (tableName) => {
    if (!tables.has(tableName)) return [];
    return runSqliteReadOnly(dbPath, `SELECT * FROM ${quoteIdentifier(tableName)};`);
  };
  return {
    tables: [...tables],
    memories: await readTable("memories"),
    records: await readTable("records"),
    labels: [...(await readTable("labels")), ...(await readTable("memory_labels"))],
    sources: await readTable("memory_sources")
  };
}

async function importOldMemoriaIntoProduct(app, input = {}) {
  const preview = await previewImportSources();
  const source = preview.sources.memoria;
  const dbPath = path.resolve(String(input.databasePath || source.database?.dbPath || ""));
  if (!dbPath || !source.database?.present) throw new Error("Old Memoria database not found.");
  if (source.database?.quickCheck !== "ok") throw new Error(`Old Memoria quick_check failed: ${source.database?.quickCheck}`);
  const statBefore = await fs.stat(dbPath);
  const backup = await createProductBackup(app);
  const { database } = await ensureProductCore(app);
  const importedAt = new Date().toISOString();
  const sourceId = `old_memoria_${Date.now().toString(36)}`;
  const old = await readOldMemoriaRows(dbPath);
  const labelsByMemory = new Map();
  for (const row of old.labels) {
    const memoryId = String(pickFirst(row, ["memory_id", "memoryId", "id"], "") || "").trim();
    const label = String(pickFirst(row, ["label", "name", "tag"], "") || "").trim().toLowerCase();
    if (!memoryId || !label) continue;
    if (!labelsByMemory.has(memoryId)) labelsByMemory.set(memoryId, []);
    labelsByMemory.get(memoryId).push(label);
  }
  await database.exec(`
    INSERT INTO memory_sources (id, kind, label, source_path, imported_at, metadata_json)
    VALUES (${sqlString(sourceId)}, 'import', 'Old Memoria import', ${sqlString(dbPath)}, ${sqlString(importedAt)}, ${sqlString(JSON.stringify({
      tables: old.tables,
      mode: "copy_based_import"
    }))})
    ON CONFLICT(id) DO NOTHING;
  `);
  const summary = {
    importedAt,
    sourcePath: dbPath,
    backup,
    memories: { imported: 0, skipped: 0 },
    records: { imported: 0, skipped: 0 },
    labels: { imported: 0, skipped: 0 },
    sourceMtimeUnchanged: false,
    sourceSizeUnchanged: false
  };

  const importMemoryRow = async (row, kind) => {
    const oldId = String(pickFirst(row, ["id", "memory_id", "record_id"], "") || "").trim();
    const body = String(pickFirst(row, ["body", "content", "text", "value", "summary"], "") || "").trim();
    if (!oldId || !body) {
      summary[kind].skipped += 1;
      return;
    }
    const id = stableImportId(`old_memoria_${kind === "records" ? "record" : "memory"}`, oldId);
    const existing = await database.query(`SELECT id FROM memories WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary[kind].skipped += 1;
      return;
    }
    const title = String(pickFirst(row, ["title", "name"], "") || "").trim();
    const oldPrivate = String(pickFirst(row, ["private"], "") || "").trim();
    const sensitivity =
      oldPrivate === "1" || oldPrivate.toLowerCase() === "true"
        ? "restricted"
        : normalizeArchiveSensitivity(String(pickFirst(row, ["sensitivity"], "normal") || "normal"));
    const status = normalizeArchiveStatus(String(pickFirst(row, ["status"], "active") || "active"));
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp", "occurred_at"], importedAt) || importedAt);
    const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], createdAt) || createdAt);
    const inlineLabels = normalizeImportLabels(pickFirst(row, ["labels", "tags"], ""));
    const sourceAgent = String(pickFirst(row, ["source_agent", "sourceAgent"], "") || "").trim();
    const rowSource = String(pickFirst(row, ["source"], "") || "").trim();
    const rowLabels = [...new Set([...(labelsByMemory.get(oldId) || []), ...inlineLabels, ...legacyAgentLabels(sourceAgent, rowSource), "imported", "old-memoria"])];
    await database.exec(`
      INSERT INTO memories (id, title, body, status, sensitivity, source_id, created_at, updated_at)
      VALUES (
        ${sqlString(id)},
        ${title ? sqlString(title) : "NULL"},
        ${sqlString(body)},
        ${sqlString(status)},
        ${sqlString(sensitivity)},
        ${sqlString(sourceId)},
        ${sqlString(createdAt)},
        ${sqlString(updatedAt)}
      );
      ${rowLabels
        .map(
          (label) => `
            INSERT INTO memory_labels (memory_id, label)
            VALUES (${sqlString(id)}, ${sqlString(label)})
            ON CONFLICT(memory_id, label) DO NOTHING;
          `
        )
        .join("\n")}
    `);
    if (status === "active" && sensitivity !== "restricted") await database.markMemoryEmbeddingPending(id);
    summary[kind].imported += 1;
    summary.labels.imported += rowLabels.length;
  };

  const importRecordRow = async (row) => {
    const oldId = String(pickFirst(row, ["id", "record_id"], "") || "").trim();
    const userId = String(pickFirst(row, ["user_id", "userId"], "local-user") || "local-user").trim();
    const recordType = String(pickFirst(row, ["record_type", "recordType", "type"], "") || "").trim().toLowerCase();
    const occurredAt = String(pickFirst(row, ["occurred_at", "occurredAt", "timestamp"], importedAt) || importedAt).trim();
    const value = safeJsonObject(pickFirst(row, ["data_json", "value_json", "value", "data"], "{}"), {});
    if (!oldId || !userId || !recordType || !Object.keys(value).length) {
      summary.records.skipped += 1;
      return;
    }
    const id = stableImportId("old_memoria_record", oldId);
    const existing = await database.query(`SELECT id FROM memory_records WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.records.skipped += 1;
      return;
    }
    const dedupeKey = String(pickFirst(row, ["dedupe_key", "dedupeKey"], "") || "").trim();
    if (dedupeKey) {
      const duplicate = await database.query(`
        SELECT id
        FROM memory_records
        WHERE user_id = ${sqlString(userId)}
          AND record_type = ${sqlString(recordType)}
          AND dedupe_key = ${sqlString(dedupeKey)}
        LIMIT 1;
      `);
      if (duplicate.length) {
        summary.records.skipped += 1;
        return;
      }
    }
    const localDate = String(pickFirst(row, ["local_date", "localDate"], occurredAt.slice(0, 10)) || occurredAt.slice(0, 10)).trim();
    const timezone = String(pickFirst(row, ["timezone", "timezone_name", "timezoneName"], "Asia/Shanghai") || "Asia/Shanghai").trim();
    const schemaVersion = Number.parseInt(String(pickFirst(row, ["schema_version", "schemaVersion"], 1) || 1), 10) || 1;
    const note = String(pickFirst(row, ["note", "title"], "") || "").trim();
    const source = String(pickFirst(row, ["source"], sourceId) || sourceId).trim();
    const sourceAgent = String(pickFirst(row, ["source_agent", "sourceAgent"], "") || "").trim();
    const sourceRunId = String(pickFirst(row, ["source_run_id", "sourceRunId"], "") || "").trim();
    const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt).trim();
    await database.exec(`
      INSERT INTO memory_records (
        id, user_id, record_type, title, value_json, occurred_at, local_date,
        timezone, schema_version, note, source, source_agent, source_run_id,
        dedupe_key, status, created_at, updated_at, metadata_json
      )
      VALUES (
        ${sqlString(id)},
        ${sqlString(userId)},
        ${sqlString(recordType)},
        ${sqlString(note || recordType)},
        ${sqlString(JSON.stringify(value))},
        ${sqlString(occurredAt)},
        ${sqlString(localDate)},
        ${sqlString(timezone)},
        ${schemaVersion},
        ${note ? sqlString(note) : "NULL"},
        ${sqlString(source)},
        ${sourceAgent ? sqlString(sourceAgent) : "NULL"},
        ${sourceRunId ? sqlString(sourceRunId) : "NULL"},
        ${dedupeKey ? sqlString(dedupeKey) : "NULL"},
        'active',
        ${sqlString(createdAt)},
        ${sqlString(createdAt)},
        ${sqlString(JSON.stringify({ oldId, importedFrom: "old_memoria" }))}
      );
    `);
    summary.records.imported += 1;
  };

  for (const row of old.memories) await importMemoryRow(row, "memories");
  for (const row of old.records) await importRecordRow(row);

  const statAfter = await fs.stat(dbPath);
  summary.sourceMtimeUnchanged = statAfter.mtimeMs === statBefore.mtimeMs;
  summary.sourceSizeUnchanged = statAfter.size === statBefore.size;
  if (!summary.sourceMtimeUnchanged || !summary.sourceSizeUnchanged) {
    throw new Error("Old Memoria source changed during import.");
  }
  return {
    ...summary,
    maintenance: await database.runMemoryMaintenance({ dryRun: false }),
    stats: await database.getMemoryStats()
  };
}

async function readOldContinuityRows(dbPath) {
  const tableRows = await runSqliteReadOnly(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
  const tables = new Set(tableRows.map((row) => row.name));
  const readTable = async (tableName) => {
    if (!tables.has(tableName)) return [];
    return runSqliteReadOnly(dbPath, `SELECT * FROM ${quoteIdentifier(tableName)};`);
  };
  return {
    tables: [...tables],
    lines: await readTable("continuity_lines"),
    positions: await readTable("current_positions"),
    handoffs: await readTable("continuity_handoffs"),
    sessionThreads: await readTable("session_threads"),
    legacyHandoffs: await readTable("handoffs"),
    stateSnapshots: await readTable("state_snapshots")
  };
}

async function importOldContinuityIntoProduct(app, input = {}) {
  const preview = await previewImportSources();
  const source = preview.sources.continuity;
  const dbPath = path.resolve(String(input.databasePath || source.database?.dbPath || ""));
  if (!dbPath || !source.database?.present) throw new Error("Old Continuity database not found.");
  if (source.database?.quickCheck !== "ok") throw new Error(`Old Continuity quick_check failed: ${source.database?.quickCheck}`);
  const statBefore = await fs.stat(dbPath);
  const backup = await createProductBackup(app);
  const { database } = await ensureProductCore(app);
  const importedAt = new Date().toISOString();
  const old = await readOldContinuityRows(dbPath);
  const summary = {
    importedAt,
    sourcePath: dbPath,
    backup,
    lines: { imported: 0, skipped: 0 },
    positions: { imported: 0, skipped: 0 },
    handoffs: { imported: 0, skipped: 0 },
    sourceMtimeUnchanged: false,
    sourceSizeUnchanged: false
  };
  const lineIdMap = new Map();
  const importedLineIds = [];

  const ensureFallbackLine = async () => {
    const fallbackOldId = "default";
    const fallbackLineId = stableImportId("old_continuity_line", fallbackOldId);
    if (!lineIdMap.has(fallbackOldId)) lineIdMap.set(fallbackOldId, fallbackLineId);
    const existing = await database.query(`SELECT id FROM continuity_lines WHERE id = ${sqlString(fallbackLineId)} LIMIT 1;`);
    if (!existing.length) {
      await database.exec(`
        INSERT INTO continuity_lines (id, title, status, created_at, updated_at)
        VALUES (${sqlString(fallbackLineId)}, 'Imported Shared Line', 'active', ${sqlString(importedAt)}, ${sqlString(importedAt)});
      `);
      importedLineIds.push(fallbackLineId);
    }
    return fallbackLineId;
  };

  const oldLineRows = old.lines.length ? old.lines : old.sessionThreads;
  for (const row of oldLineRows) {
    const oldId = String(pickFirst(row, ["id", "line_id", "lineId", "thread_id"], "") || "").trim();
    if (!oldId) {
      summary.lines.skipped += 1;
      continue;
    }
    const id = stableImportId("old_continuity_line", oldId);
    lineIdMap.set(oldId, id);
    const existing = await database.query(`SELECT id FROM continuity_lines WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.lines.skipped += 1;
      continue;
    }
    const title = String(pickFirst(row, ["title", "name", "label", "topic"], "Imported Shared Line") || "Imported Shared Line").trim();
    const status = normalizeContinuityStatus(pickFirst(row, ["status"], "active"));
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "created"], importedAt) || importedAt);
    const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt", "modified_at", "last_active_at"], createdAt) || createdAt);
    await database.exec(`
      INSERT INTO continuity_lines (id, title, status, created_at, updated_at)
      VALUES (${sqlString(id)}, ${sqlString(title)}, ${sqlString(status)}, ${sqlString(createdAt)}, ${sqlString(updatedAt)});
    `);
    importedLineIds.push(id);
    summary.lines.imported += 1;
  }

  const resolveImportedLineId = async (row) => {
    const oldLineId = String(pickFirst(row, ["line_id", "lineId", "continuity_line_id", "thread_id", "source_thread_id"], "") || "").trim();
    if (oldLineId && lineIdMap.has(oldLineId)) return lineIdMap.get(oldLineId);
    if (lineIdMap.size === 1) return [...lineIdMap.values()][0];
    if (importedLineIds.length === 1) return importedLineIds[0];
    return ensureFallbackLine();
  };

  const oldPositionRows = old.positions.length ? old.positions : old.sessionThreads;
  for (const row of oldPositionRows) {
    const oldId = String(pickFirst(row, ["id", "position_id", "positionId", "thread_id"], "") || "").trim();
    const summaryText = String(
      pickFirst(row, ["summary", "body", "content", "text", "last_position", "state_summary", "current_interpretation", "reality_line"], "") || ""
    ).trim();
    if (!oldId || !summaryText) {
      summary.positions.skipped += 1;
      continue;
    }
    const lineId = await resolveImportedLineId(row);
    const positionId = stableImportId("old_continuity_position", oldId);
    const existing = await database.query(`SELECT id FROM current_positions WHERE id = ${sqlString(positionId)} LIMIT 1;`);
    if (existing.length) {
      summary.positions.skipped += 1;
      continue;
    }
    const status = normalizeLegacyContinuityInterpretationStatus(row);
    const factsUsed = safeJsonArray(pickFirst(row, ["facts_used_json", "factsUsed", "facts_used"], "[]"));
    const metadata = old.positions.length ? {} : buildLegacyContinuityMetadata(row);
    const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt", "last_active_at", "created_at", "createdAt"], importedAt) || importedAt);
    const historyId = stableImportId("old_continuity_history", oldId);
    const snapshotId = stableImportId("old_continuity_snapshot", oldId);
    await database.exec(`
      INSERT INTO current_positions (id, line_id, summary, interpretation_status, facts_used_json, metadata_json, updated_at)
      VALUES (${sqlString(positionId)}, ${sqlString(lineId)}, ${sqlString(summaryText)}, ${sqlString(status)}, ${sqlString(JSON.stringify(factsUsed))}, ${sqlString(JSON.stringify(metadata))}, ${sqlString(updatedAt)});
      INSERT INTO continuity_position_history (id, line_id, position_id, summary, interpretation_status, facts_used_json, source, created_at)
      VALUES (${sqlString(historyId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summaryText)}, ${sqlString(status)}, ${sqlString(JSON.stringify(factsUsed))}, 'old-continuity-import', ${sqlString(updatedAt)})
      ON CONFLICT(id) DO NOTHING;
      INSERT INTO continuity_snapshots (id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at)
      VALUES (${sqlString(snapshotId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summaryText)}, ${sqlString(status)}, ${sqlString(JSON.stringify(factsUsed))}, 'old-continuity-import', ${sqlString(updatedAt)})
      ON CONFLICT(id) DO NOTHING;
      UPDATE continuity_lines
      SET updated_at = ${sqlString(updatedAt)}
      WHERE id = ${sqlString(lineId)};
    `);
    summary.positions.imported += 1;
  }

  for (const row of [...old.handoffs, ...old.legacyHandoffs]) {
    const oldId = String(pickFirst(row, ["id", "handoff_id", "handoffId"], "") || "").trim();
    const objective = String(pickFirst(row, ["objective", "title", "summary", "body"], "") || "").trim();
    if (!oldId || !objective) {
      summary.handoffs.skipped += 1;
      continue;
    }
    const id = stableImportId("old_continuity_handoff", oldId);
    const existing = await database.query(`SELECT id FROM continuity_handoffs WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.handoffs.skipped += 1;
      continue;
    }
    const lineId = await resolveImportedLineId(row);
    const completed = safeJsonArray(pickFirst(row, ["completed_json", "completed", "done_json"], "[]"));
    const openItems = safeJsonArray(pickFirst(row, ["open_items_json", "openItems", "open_items", "todo_json"], "[]"));
    const nextStep = String(pickFirst(row, ["next_step", "nextStep", "next"], "") || "").trim();
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "updated_at", "updatedAt"], importedAt) || importedAt);
    await database.exec(`
      INSERT INTO continuity_handoffs (id, line_id, objective, completed_json, open_items_json, next_step, created_at)
      VALUES (${sqlString(id)}, ${sqlString(lineId)}, ${sqlString(objective)}, ${sqlString(JSON.stringify(completed))}, ${sqlString(JSON.stringify(openItems))}, ${sqlString(nextStep)}, ${sqlString(createdAt)});
    `);
    summary.handoffs.imported += 1;
  }

  for (const row of old.stateSnapshots) {
    const oldId = String(pickFirst(row, ["id", "snapshot_id", "snapshotId"], "") || "").trim();
    const summaryText = String(pickFirst(row, ["summary", "state_summary", "body", "content", "text"], "") || "").trim();
    if (!oldId || !summaryText) {
      summary.positions.skipped += 1;
      continue;
    }
    const lineId = await resolveImportedLineId(row);
    const positionId = stableImportId("old_continuity_snapshot_position", oldId);
    const snapshotId = stableImportId("old_continuity_state_snapshot", oldId);
    const existing = await database.query(`SELECT id FROM continuity_snapshots WHERE id = ${sqlString(snapshotId)} LIMIT 1;`);
    if (existing.length) {
      summary.positions.skipped += 1;
      continue;
    }
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "updated_at", "updatedAt"], importedAt) || importedAt);
    await database.exec(`
      INSERT INTO continuity_snapshots (id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at)
      VALUES (${sqlString(snapshotId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summaryText)}, 'draft', '[]', 'old-state-snapshot-import', ${sqlString(createdAt)});
    `);
    summary.positions.imported += 1;
  }

  const statAfter = await fs.stat(dbPath);
  summary.sourceMtimeUnchanged = statAfter.mtimeMs === statBefore.mtimeMs;
  summary.sourceSizeUnchanged = statAfter.size === statBefore.size;
  if (!summary.sourceMtimeUnchanged || !summary.sourceSizeUnchanged) {
    throw new Error("Old Continuity source changed during import.");
  }
  const activeImportedLines = await database.query(`
    SELECT id
    FROM continuity_lines
    WHERE id IN (${[...lineIdMap.values()].map((id) => sqlString(id)).join(", ") || "''"})
      AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1;
  `);
  const sharedLine = activeImportedLines[0]?.id
    ? await database.getResumePacket({ lineId: activeImportedLines[0].id })
    : await database.getResumePacket();
  if (activeImportedLines[0]?.id) {
    await database.setActiveContinuityLine(activeImportedLines[0].id);
  }
  return {
    ...summary,
    sharedLine
  };
}

async function readOldInnerLifeRows(dbPath) {
  const tableRows = await runSqliteReadOnly(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
  const tables = new Set(tableRows.map((row) => row.name));
  const readTable = async (tableName) => {
    if (!tables.has(tableName)) return [];
    return runSqliteReadOnly(dbPath, `SELECT * FROM ${quoteIdentifier(tableName)};`);
  };
  return {
    tables: [...tables],
    profiles: await readTable("innerlife_profiles"),
    events: await readTable("innerlife_events"),
    thoughts: await readTable("innerlife_thoughts"),
    shares: await readTable("innerlife_shares"),
    agentProfiles: await readTable("agent_profiles"),
    agentState: await readTable("agent_state"),
    inboxEvents: await readTable("inbox_events"),
    internalEvents: await readTable("internal_events"),
    pendingShares: await readTable("pending_shares"),
    digestRuns: await readTable("digest_runs"),
    sessions: await readTable("sessions"),
    shareActions: await readTable("share_actions"),
    innerSummaries: await readTable("inner_summaries"),
    autonomousExperiences: await readTable("autonomous_experiences"),
    explorationRuns: await readTable("exploration_runs"),
    convergenceRuns: await readTable("convergence_runs"),
    sourceSubscriptions: await readTable("source_subscriptions")
  };
}

async function importOldInnerLifeIntoProduct(app, input = {}) {
  const preview = await previewImportSources();
  const source = preview.sources.innerlife;
  const dbPath = path.resolve(String(input.databasePath || source.database?.dbPath || ""));
  if (!dbPath || !source.database?.present) throw new Error("Old InnerLife database not found.");
  if (source.database?.quickCheck !== "ok") throw new Error(`Old InnerLife quick_check failed: ${source.database?.quickCheck}`);
  const statBefore = await fs.stat(dbPath);
  const backup = await createProductBackup(app);
  const { database } = await ensureProductCore(app);
  const importedAt = new Date().toISOString();
  const old = await readOldInnerLifeRows(dbPath);
  const summary = {
    importedAt,
    sourcePath: dbPath,
    backup,
    profiles: { imported: 0, skipped: 0 },
    events: { imported: 0, skipped: 0 },
    thoughts: { imported: 0, skipped: 0 },
    shares: { imported: 0, skipped: 0 },
    inbox: { imported: 0, skipped: 0 },
    digestRuns: { imported: 0, skipped: 0 },
    sessions: { imported: 0, skipped: 0 },
    shareActions: { imported: 0, skipped: 0 },
    sourceMtimeUnchanged: false,
    sourceSizeUnchanged: false
  };
  const agentIdMap = new Map();
  const eventIdMap = new Map();
  const thoughtIdMap = new Map();

  const ensureAgent = async (oldAgentId, displayName = "") => {
    const sourceAgentId = String(oldAgentId || "").trim() || "my-agent";
    if (agentIdMap.has(sourceAgentId)) return agentIdMap.get(sourceAgentId);
    const legacyAgentMap = {
      clara: "claude-code:clara",
      lara: "hermes:lara",
      "my-agent": "codex"
    };
    const importedAgentId = legacyAgentMap[sourceAgentId] || sourceAgentId;
    const label = String(displayName || sourceAgentId || "Imported Agent").trim() || "Imported Agent";
    await database.exec(`
      INSERT INTO agents (id, label, role, status)
      VALUES (${sqlString(importedAgentId)}, ${sqlString(label)}, 'agent', 'active')
      ON CONFLICT(id) DO NOTHING;
    `);
    agentIdMap.set(sourceAgentId, importedAgentId);
    return importedAgentId;
  };

  const oldStateByAgent = new Map(
    old.agentState.map((row) => [String(pickFirst(row, ["agent_id", "agentId"], "my-agent") || "my-agent"), row])
  );
  const profileRows = old.profiles.length > 0 ? old.profiles : old.agentProfiles;
  for (const row of profileRows) {
    const oldAgentId = String(pickFirst(row, ["agent_id", "agentId", "id"], "my-agent") || "my-agent").trim() || "my-agent";
    const displayName = String(pickFirst(row, ["display_name", "displayName", "name", "label"], oldAgentId) || oldAgentId).trim();
    const agentId = await ensureAgent(oldAgentId, displayName);
    const existing = await database.query(`SELECT agent_id FROM innerlife_profiles WHERE agent_id = ${sqlString(agentId)} LIMIT 1;`);
    if (existing.length && agentId !== "my-agent") {
      summary.profiles.skipped += 1;
      continue;
    }
    const enabled = ["1", "true", "enabled"].includes(String(pickFirst(row, ["enabled", "status"], "0") || "0").trim().toLowerCase()) ? 1 : 0;
    const profileJson = safeJsonObject(pickFirst(row, ["profile_json", "profileJson", "profile"], "{}"), {});
    const stateRow = oldStateByAgent.get(oldAgentId);
    const stateJson = safeJsonObject(pickFirst(row, ["state_json", "stateJson", "state"], stateRow?.state_json || "{}"), {});
    const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
    const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], stateRow?.updated_at || createdAt) || createdAt);
    await database.exec(`
      INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at)
      VALUES (
        ${sqlString(agentId)},
        ${sqlString(displayName || "Imported Agent")},
        ${enabled},
        ${sqlString(JSON.stringify({ ...profileJson, importedFrom: "old-innerlife", oldAgentId }))},
        ${sqlString(JSON.stringify({ ...stateJson, importedAt }))},
        ${sqlString(createdAt)},
        ${sqlString(updatedAt)}
      )
      ON CONFLICT(agent_id) DO UPDATE SET
        display_name = excluded.display_name,
        profile_json = excluded.profile_json,
        state_json = excluded.state_json,
        updated_at = excluded.updated_at;
    `);
    summary.profiles.imported += 1;
  }

  for (const row of old.agentState) {
    const oldAgentId = String(pickFirst(row, ["agent_id", "agentId"], "my-agent") || "my-agent").trim() || "my-agent";
    if (old.profiles.length > 0 || old.agentProfiles.some((profile) => String(profile.agent_id || "") === oldAgentId)) continue;
    const agentId = await ensureAgent(oldAgentId, oldAgentId);
    const stateJson = safeJsonObject(pickFirst(row, ["state_json", "stateJson"], "{}"), {});
    const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], importedAt) || importedAt);
    await database.exec(`
      INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at)
      VALUES (
        ${sqlString(agentId)},
        ${sqlString(oldAgentId)},
        0,
        ${sqlString(JSON.stringify({ importedFrom: "old-innerlife-v2", oldAgentId }))},
        ${sqlString(JSON.stringify({ ...stateJson, importedAt, oldRevision: row.revision ?? null }))},
        ${sqlString(updatedAt)},
        ${sqlString(updatedAt)}
      )
      ON CONFLICT(agent_id) DO UPDATE SET
        state_json = excluded.state_json,
        updated_at = excluded.updated_at;
    `);
    summary.profiles.imported += 1;
  }

  for (const row of old.events) {
    const oldId = String(pickFirst(row, ["id", "event_id", "eventId"], "") || "").trim();
    const body = String(pickFirst(row, ["body", "content", "text", "summary"], "") || "").trim();
    if (!oldId || !body) {
      summary.events.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_event", oldId);
    eventIdMap.set(oldId, id);
    const existing = await database.query(`SELECT id FROM innerlife_events WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.events.skipped += 1;
      continue;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const kind = String(pickFirst(row, ["kind", "type", "event_type"], "imported") || "imported").trim() || "imported";
    const status = normalizeInnerLifeEventStatus(pickFirst(row, ["status"], "processed"));
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp"], importedAt) || importedAt);
    const metadata = safeJsonObject(pickFirst(row, ["metadata_json", "metadataJson", "metadata"], "{}"), {});
    await database.exec(`
      INSERT INTO innerlife_events (id, agent_id, kind, body, status, created_at, metadata_json)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${sqlString(kind)},
        ${sqlString(body)},
        ${sqlString(status)},
        ${sqlString(createdAt)},
        ${sqlString(JSON.stringify({ ...metadata, importedFrom: "old-innerlife", oldId }))}
      );
    `);
    summary.events.imported += 1;
  }

  const importEventRow = async (row, options = {}) => {
    const oldId = String(pickFirst(row, ["id"], "") || "").trim();
    const body = String(options.body || compactImportText(pickFirst(row, ["body", "content", "text", "summary", "result_json", "experience_json"], ""), "")).trim();
    if (!oldId || !body) {
      summary.events.skipped += 1;
      return null;
    }
    const id = stableImportId(options.prefix || "old_innerlife_event", oldId);
    eventIdMap.set(oldId, id);
    const existing = await database.query(`SELECT id FROM innerlife_events WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.events.skipped += 1;
      return id;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const kind = String(options.kind || pickFirst(row, ["kind", "type", "event_type", "summary_type"], "imported") || "imported").trim() || "imported";
    const status = normalizeInnerLifeEventStatus(pickFirst(row, ["status", "lifecycle_status"], "processed"));
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp", "fetched_at"], importedAt) || importedAt);
    const metadata = {
      importedFrom: "old-innerlife-v2",
      oldId,
      source: pickFirst(row, ["source", "source_name", "url"], ""),
      sourceRefs: parseImportJson(pickFirst(row, ["source_refs_json"], "[]"), []),
      metadata: parseImportJson(pickFirst(row, ["metadata_json"], "{}"), {}),
      raw: options.raw || {}
    };
    await database.exec(`
      INSERT INTO innerlife_events (id, agent_id, kind, body, status, created_at, metadata_json)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${sqlString(kind)},
        ${sqlString(body)},
        ${sqlString(status)},
        ${sqlString(createdAt)},
        ${sqlString(JSON.stringify(metadata))}
      );
    `);
    summary.events.imported += 1;
    return id;
  };

  for (const row of old.internalEvents) {
    await importEventRow(row, {
      prefix: "old_innerlife_internal_event",
      kind: pickFirst(row, ["event_type"], "internal_event"),
      body: compactImportText(row.content, ""),
      raw: {
        fingerprint: row.fingerprint || "",
        lifecycleStatus: row.lifecycle_status || "",
        archivedAt: row.archived_at || "",
        archiveReason: row.archive_reason || ""
      }
    });
  }

  for (const row of old.innerSummaries) {
    await importEventRow(row, {
      prefix: "old_innerlife_summary",
      kind: `summary:${String(row.summary_type || "consolidation")}`,
      body: [row.title, row.content].filter(Boolean).join("\n\n"),
      raw: { updatedAt: row.updated_at || "" }
    });
  }

  for (const row of old.autonomousExperiences) {
    await importEventRow(row, {
      prefix: "old_innerlife_experience",
      kind: "autonomous_experience",
      body: [row.title, compactImportText(row.experience_json, "")].filter(Boolean).join("\n\n"),
      raw: {
        runId: row.run_id || "",
        sourceName: row.source_name || "",
        url: row.url || "",
        publishedAt: row.published_at || "",
        evidence: parseImportJson(row.evidence_json, [])
      }
    });
  }

  for (const row of old.explorationRuns) {
    await importEventRow(row, {
      prefix: "old_innerlife_exploration",
      kind: "exploration_run",
      body: compactImportText(row.result_json, row.selection_reason || row.selected_url || "Exploration run"),
      raw: {
        selectedUrl: row.selected_url || "",
        selectionReason: row.selection_reason || "",
        candidateCount: row.candidate_count || 0,
        error: row.error || ""
      }
    });
  }

  for (const row of old.convergenceRuns) {
    await importEventRow(row, {
      prefix: "old_innerlife_convergence",
      kind: "convergence_run",
      body: compactImportText(row.result_json, row.reason || "Convergence run"),
      raw: {
        reason: row.reason || "",
        inputCounts: parseImportJson(row.input_counts_json, {}),
        error: row.error || ""
      }
    });
  }

  for (const row of old.sourceSubscriptions) {
    await importEventRow(row, {
      prefix: "old_innerlife_source_subscription",
      kind: "source_subscription",
      body: [row.name, row.url].filter(Boolean).join("\n"),
      raw: {
        sourceType: row.source_type || "",
        enabled: Number(row.enabled || 0) === 1,
        updatedAt: row.updated_at || ""
      }
    });
  }

  for (const row of old.inboxEvents) {
    const oldId = String(pickFirst(row, ["id"], "") || "").trim();
    const body = compactImportText(row.content_json, "");
    if (!oldId || !body) {
      summary.inbox.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_inbox", oldId);
    const existing = await database.query(`SELECT id FROM innerlife_inbox WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.inbox.skipped += 1;
      continue;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const source = [row.source_type, row.source_id].filter(Boolean).join(":") || "old_innerlife";
    const status = normalizeInnerLifeInboxStatus(row.status);
    const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
    const processedAt = String(pickFirst(row, ["processed_at", "processedAt"], "") || "").trim();
    await database.exec(`
      INSERT INTO innerlife_inbox (id, agent_id, source, body, status, created_at, processed_at, metadata_json)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${sqlString(source)},
        ${sqlString(body)},
        ${sqlString(status)},
        ${sqlString(createdAt)},
        ${processedAt ? sqlString(processedAt) : "NULL"},
        ${sqlString(JSON.stringify({
          importedFrom: "old-innerlife-v2",
          oldId,
          sourceType: row.source_type || "",
          sourceId: row.source_id || "",
          content: parseImportJson(row.content_json, {})
        }))}
      );
    `);
    summary.inbox.imported += 1;
  }

  for (const row of old.thoughts) {
    const oldId = String(pickFirst(row, ["id", "thought_id", "thoughtId"], "") || "").trim();
    const body = String(pickFirst(row, ["body", "content", "text", "summary"], "") || "").trim();
    if (!oldId || !body) {
      summary.thoughts.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_thought", oldId);
    thoughtIdMap.set(oldId, id);
    const existing = await database.query(`SELECT id FROM innerlife_thoughts WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.thoughts.skipped += 1;
      continue;
    }
    const oldEventId = String(pickFirst(row, ["event_id", "eventId"], "") || "").trim();
    const eventId = oldEventId && eventIdMap.has(oldEventId) ? eventIdMap.get(oldEventId) : null;
    const reviewStatus = normalizeInnerLifeReviewStatus(pickFirst(row, ["review_status", "reviewStatus", "status"], "unreviewed"));
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp"], importedAt) || importedAt);
    await database.exec(`
      INSERT INTO innerlife_thoughts (id, event_id, body, review_status, created_at)
      VALUES (${sqlString(id)}, ${eventId ? sqlString(eventId) : "NULL"}, ${sqlString(body)}, ${sqlString(reviewStatus)}, ${sqlString(createdAt)});
    `);
    summary.thoughts.imported += 1;
  }

  for (const row of old.shares) {
    const oldId = String(pickFirst(row, ["id", "share_id", "shareId"], "") || "").trim();
    const body = String(pickFirst(row, ["body", "content", "text", "summary"], "") || "").trim();
    if (!oldId || !body) {
      summary.shares.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_share", oldId);
    const existing = await database.query(`SELECT id FROM innerlife_shares WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.shares.skipped += 1;
      continue;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const oldThoughtId = String(pickFirst(row, ["thought_id", "thoughtId"], "") || "").trim();
    const thoughtId = oldThoughtId && thoughtIdMap.has(oldThoughtId) ? thoughtIdMap.get(oldThoughtId) : null;
    const status = normalizeInnerLifeShareStatus(pickFirst(row, ["status"], "pending"));
    const decisionReason = String(pickFirst(row, ["decision_reason", "decisionReason", "reason"], "") || "").trim();
    const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp"], importedAt) || importedAt);
    const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], createdAt) || createdAt);
    await database.exec(`
      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${thoughtId ? sqlString(thoughtId) : "NULL"},
        ${sqlString(status)},
        ${sqlString(body)},
        ${decisionReason ? sqlString(decisionReason) : "NULL"},
        ${sqlString(createdAt)},
        ${sqlString(updatedAt)}
      );
    `);
    summary.shares.imported += 1;
  }

  for (const row of old.pendingShares) {
    const oldId = String(pickFirst(row, ["id"], "") || "").trim();
    const body = String(pickFirst(row, ["body", "content"], "") || "").trim();
    if (!oldId || !body) {
      summary.shares.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_share", oldId);
    const existing = await database.query(`SELECT id FROM innerlife_shares WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.shares.skipped += 1;
      thoughtIdMap.set(oldId, stableImportId("old_innerlife_share_thought", oldId));
      continue;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const status = normalizeInnerLifeShareStatus(row.status);
    const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
    const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], createdAt) || createdAt);
    const thoughtId = stableImportId("old_innerlife_share_thought", oldId);
    await database.exec(`
      INSERT INTO innerlife_thoughts (id, event_id, body, review_status, created_at)
      VALUES (
        ${sqlString(thoughtId)},
        NULL,
        ${sqlString(body)},
        ${sqlString(reviewStatusFromShareStatus(status))},
        ${sqlString(createdAt)}
      )
      ON CONFLICT(id) DO NOTHING;

      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${sqlString(thoughtId)},
        ${sqlString(status)},
        ${sqlString(body)},
        ${row.decision_reason || row.reason ? sqlString(row.decision_reason || row.reason) : "NULL"},
        ${sqlString(createdAt)},
        ${sqlString(updatedAt)}
      );
    `);
    thoughtIdMap.set(oldId, thoughtId);
    summary.thoughts.imported += 1;
    summary.shares.imported += 1;
  }

  for (const row of old.digestRuns) {
    const oldId = String(pickFirst(row, ["id"], "") || "").trim();
    if (!oldId) {
      summary.digestRuns.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_digest", oldId);
    const existing = await database.query(`SELECT id FROM innerlife_digest_runs WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.digestRuns.skipped += 1;
      continue;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const output = parseImportJson(row.output_json, {});
    const summaryText = compactImportText(output, row.reason || row.error || "");
    const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
    await database.exec(`
      INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${sqlString(String(row.mode || "imported"))},
        ${sqlString(normalizeInnerLifeDigestStatus(row.status))},
        ${sqlString(JSON.stringify(parseImportJson(row.input_refs_json, [])))},
        ${sqlString(summaryText)},
        ${sqlString(createdAt)},
        ${normalizeInnerLifeDigestStatus(row.status) === "pending" ? "NULL" : sqlString(createdAt)},
        ${sqlString(JSON.stringify({
          importedFrom: "old-innerlife-v2",
          oldId,
          changed: Number(row.changed || 0) === 1,
          reason: row.reason || "",
          error: row.error || "",
          output,
          stateBefore: parseImportJson(row.state_before_json, {}),
          stateAfter: parseImportJson(row.state_after_json, {})
        }))}
      );
    `);
    summary.digestRuns.imported += 1;
  }

  for (const row of old.sessions) {
    const oldId = String(pickFirst(row, ["id"], "") || "").trim();
    if (!oldId) {
      summary.sessions.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_session", oldId);
    const existing = await database.query(`SELECT id FROM innerlife_sessions WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (existing.length) {
      summary.sessions.skipped += 1;
      continue;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const externalSessionId = String(row.external_session_id || oldId);
    const startedAt = String(pickFirst(row, ["created_at", "started_at", "createdAt"], importedAt) || importedAt);
    const endedAt = String(pickFirst(row, ["ended_at", "endedAt"], "") || "").trim();
    const reflection = parseImportJson(row.reflection_json, {});
    await database.exec(`
      INSERT INTO innerlife_sessions (id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${sqlString(String(row.user_id || "local-user"))},
        ${sqlString(String(row.host || "desktop"))},
        ${sqlString(externalSessionId)},
        ${sqlString(normalizeInnerLifeSessionStatus(row.status))},
        ${sqlString(startedAt)},
        ${endedAt ? sqlString(endedAt) : "NULL"},
        ${sqlString(JSON.stringify(parseImportJson(row.start_briefing_json, {})))},
        ${sqlString(compactImportText(reflection, ""))},
        ${sqlString(JSON.stringify({
          importedFrom: "old-innerlife-v2",
          oldId,
          startRevision: row.start_revision ?? null,
          endRevision: row.end_revision ?? null,
          conversation: parseImportJson(row.conversation_json, null),
          reflection
        }))}
      );
    `);
    summary.sessions.imported += 1;
  }

  for (const row of old.shareActions) {
    const oldId = String(pickFirst(row, ["id"], "") || "").trim();
    const oldShareId = String(pickFirst(row, ["share_id", "shareId"], "") || "").trim();
    if (!oldId || !oldShareId) {
      summary.shareActions.skipped += 1;
      continue;
    }
    const id = stableImportId("old_innerlife_share_action", oldId);
    const shareId = stableImportId("old_innerlife_share", oldShareId);
    const shareExists = await database.query(`SELECT id FROM innerlife_shares WHERE id = ${sqlString(shareId)} LIMIT 1;`);
    const existing = await database.query(`SELECT id FROM innerlife_share_actions WHERE id = ${sqlString(id)} LIMIT 1;`);
    if (!shareExists.length || existing.length) {
      summary.shareActions.skipped += 1;
      continue;
    }
    const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
    const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
    await database.exec(`
      INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, created_at, metadata_json)
      VALUES (
        ${sqlString(id)},
        ${sqlString(shareId)},
        ${sqlString(agentId)},
        ${sqlString(String(row.action || "imported"))},
        ${sqlString(String(row.reason || ""))},
        ${sqlString(createdAt)},
        ${sqlString(JSON.stringify({
          importedFrom: "old-innerlife-v2",
          oldId,
          sessionId: row.session_id ? stableImportId("old_innerlife_session", row.session_id) : null,
          deliveryStyle: row.delivery_style || "",
          metadata: parseImportJson(row.metadata_json, {})
        }))}
      );
    `);
    summary.shareActions.imported += 1;
  }

  const statAfter = await fs.stat(dbPath);
  summary.sourceMtimeUnchanged = statAfter.mtimeMs === statBefore.mtimeMs;
  summary.sourceSizeUnchanged = statAfter.size === statBefore.size;
  if (!summary.sourceMtimeUnchanged || !summary.sourceSizeUnchanged) {
    throw new Error("Old InnerLife source changed during import.");
  }
  return {
    ...summary,
    innerLife: await database.getInnerLifeSnapshot()
  };
}

async function getProductSharedLine(app, input = {}) {
  const { database } = await ensureProductCore(app);
  return database.getResumePacket(input || {});
}

async function getProductGatewayContext(app, input = {}) {
  const { database } = await ensureProductCore(app);
  return database.getGatewayContext(input || {});
}

async function saveProductSharedLine(app, input) {
  const { database } = await ensureProductCore(app);
  await database.saveCurrentPosition(input);
  return database.getResumePacket({ lineId: input?.lineId });
}

async function createProductSharedLine(app, input) {
  const { database } = await ensureProductCore(app);
  const line = await database.createContinuityLine(input || {});
  return {
    line,
    sharedLine: await database.getResumePacket({ lineId: line.id })
  };
}

async function activateProductSharedLine(app, lineId) {
  const { database } = await ensureProductCore(app);
  const line = await database.setActiveContinuityLine(lineId);
  return {
    line,
    sharedLine: await database.getResumePacket({ lineId: line.id })
  };
}

async function renameProductSharedLine(app, lineId, title) {
  const { database } = await ensureProductCore(app);
  const line = await database.renameContinuityLine(lineId, title);
  return {
    line,
    sharedLine: await database.getResumePacket({ lineId: line.active ? line.id : undefined })
  };
}

async function archiveProductSharedLine(app, lineId) {
  const { database } = await ensureProductCore(app);
  const line = await database.archiveContinuityLine(lineId);
  return {
    line,
    sharedLine: await database.getResumePacket()
  };
}

async function restoreProductSharedLine(app, lineId, makeActive = false) {
  const { database } = await ensureProductCore(app);
  const line = await database.restoreContinuityLine(lineId, makeActive);
  return {
    line,
    sharedLine: await database.getResumePacket({ lineId: line.active ? line.id : undefined })
  };
}

async function createProductSharedLineHandoff(app, input) {
  const { database } = await ensureProductCore(app);
  const handoff = await database.createContinuityHandoff(input);
  return {
    handoff,
    sharedLine: await database.getResumePacket({ lineId: input?.lineId })
  };
}

async function getProductInnerLife(app) {
  const { database } = await ensureProductCore(app);
  return database.getInnerLifeSnapshot();
}

async function getProductInnerLifeDoctor(app, agentId = "codex") {
  const { database } = await ensureProductCore(app);
  return database.getInnerLifeDoctor(agentId);
}

async function submitProductInnerLifeInbox(app, input) {
  const { database } = await ensureProductCore(app);
  return database.submitInnerLifeInbox(input);
}

async function startProductInnerLifeSession(app, input) {
  const { database } = await ensureProductCore(app);
  return database.startInnerLifeSession(input);
}

async function endProductInnerLifeSession(app, sessionId, input) {
  const { database } = await ensureProductCore(app);
  return database.endInnerLifeSession(sessionId, input);
}

async function processProductInnerLifeOnce(app, input) {
  const { database } = await ensureProductCore(app);
  return database.processInnerLifeOnce(input);
}

async function runProductInnerLifeDigest(app, input) {
  const { database } = await ensureProductCore(app);
  return database.runInnerLifeDigest(input);
}

async function checkProductInnerLifeShareTiming(app, input) {
  const { database } = await ensureProductCore(app);
  return database.checkInnerLifeShareTiming(input);
}

async function setProductInnerLifeDaemon(app, input) {
  const { database } = await ensureProductCore(app);
  return database.setInnerLifeDaemonState(input);
}

async function tickProductInnerLifeDaemon(app, input) {
  const { database } = await ensureProductCore(app);
  return database.tickInnerLifeDaemon(input);
}

async function markProductInnerLifeShare(app, id, action, reason = "") {
  const { database } = await ensureProductCore(app);
  return database.markInnerLifeShare(id, action, reason);
}

async function reviewProductInnerLifeShare(app, id, decision, reason = "") {
  const { database } = await ensureProductCore(app);
  return database.reviewInnerLifeShare(id, decision, reason);
}

async function getProductImportPreview(_app) {
  return previewImportSources();
}

async function applyProductInnerLifeShareToMemory(app, id) {
  const { database } = await ensureProductCore(app);
  return database.applyInnerLifeShareToMemory(id);
}

async function applyProductInnerLifeShareToSharedLine(app, id) {
  const { database } = await ensureProductCore(app);
  return database.applyInnerLifeShareToSharedLine(id);
}

async function createProductBackup(app) {
  const { paths, database } = await ensureProductCore(app);
  const createdAt = new Date();
  const backupStem = `claracore-backup-${timestampForFilename(createdAt)}`;
  const backupPath = path.join(paths.backupsDir, `${backupStem}.db`);
  const manifestPath = path.join(paths.backupsDir, `${backupStem}.json`);
  const summary = await database.getSummary();
  const backup = await database.createDatabaseBackup(backupPath, {
    productVersion: PRODUCT_VERSION,
    createdAt: createdAt.toISOString(),
    sourceDatabase: paths.databasePath,
    manifestPath,
    summary
  });
  let verification = {
    ok: false,
    quickCheck: "not-run"
  };
  try {
    const backupDatabase = new ProductDatabase(backupPath);
    const quickRows = await backupDatabase.query("PRAGMA quick_check;");
    const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
    const backupSummary = await backupDatabase.getSummary();
    verification = {
      ok: quickCheck === "ok",
      quickCheck,
      summary: backupSummary
    };
  } catch (error) {
    verification = {
      ok: false,
      quickCheck: "error",
      error: error.message
    };
  }
  const verifiedBackup = await database.updateBackup(backup.id, verification.ok ? "verified" : "failed", {
    verification
  });
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        id: verifiedBackup.id,
        productVersion: PRODUCT_VERSION,
        createdAt: verifiedBackup.created_at,
        sourceDatabase: paths.databasePath,
        backupDatabase: backupPath,
        status: verifiedBackup.status,
        summary,
        verification
      },
      null,
      2
    ),
    "utf8"
  );
  return {
    ...verifiedBackup,
    metadata: {
      ...(verifiedBackup.metadata || {}),
      manifestPath
    }
  };
}

async function resolveVerifiedBackup(app, backupId) {
  const { paths, database } = await ensureProductCore(app);
  const backup = await database.getBackup(backupId);
  if (!backup) throw new Error("Backup not found.");
  if (backup.status !== "verified") throw new Error("Only verified backups can be restored.");
  const backupPath = path.resolve(backup.path);
  const backupsRoot = path.resolve(paths.backupsDir);
  if (!backupPath.startsWith(`${backupsRoot}${path.sep}`)) {
    throw new Error("Backup must be inside the product backup directory.");
  }
  const candidate = new ProductDatabase(backupPath);
  const quickRows = await candidate.query("PRAGMA quick_check;");
  const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
  if (quickCheck !== "ok") {
    throw new Error(`Backup quick_check failed: ${quickCheck}`);
  }
  return {
    paths,
    database,
    backup,
    backupPath,
    quickCheck,
    candidate
  };
}

async function restorePreviewMemoryRows(database) {
  const rows = await database.query(`
    SELECT
      id,
      COALESCE(NULLIF(title, ''), substr(body, 1, 80), id) AS title,
      substr(body, 1, 160) AS body_preview,
      body,
      updated_at,
      created_at
    FROM memories
    WHERE status = 'active'
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 500;
  `);
  return rows.map((row) => ({
    id: row.id,
    title: row.title || row.id,
    bodyPreview: row.body_preview || "",
    body: row.body || "",
    updatedAt: row.updated_at || "",
    createdAt: row.created_at || ""
  }));
}

function summarizeRestoreMemoryDiff(currentRows, targetRows) {
  const currentById = new Map(currentRows.map((row) => [row.id, row]));
  const targetById = new Map(targetRows.map((row) => [row.id, row]));
  const removed = currentRows.filter((row) => !targetById.has(row.id));
  const restored = targetRows.filter((row) => !currentById.has(row.id));
  const changed = targetRows.filter((target) => {
    const current = currentById.get(target.id);
    if (!current) return false;
    return current.title !== target.title || current.body !== target.body || current.updatedAt !== target.updatedAt;
  });
  const keptCount = targetRows.filter((row) => currentById.has(row.id)).length - changed.length;
  const previewRow = ({ body: _body, ...row }) => row;
  return {
    removedCount: removed.length,
    restoredCount: restored.length,
    changedCount: changed.length,
    keptCount: Math.max(0, keptCount),
    limit: 8,
    removed: removed.slice(0, 8).map(previewRow),
    restored: restored.slice(0, 8).map(previewRow),
    changed: changed.slice(0, 8).map(previewRow)
  };
}

async function previewProductRestore(app, backupId) {
  const { database, backup, quickCheck, candidate } = await resolveVerifiedBackup(app, backupId);
  const currentMemories = await restorePreviewMemoryRows(database);
  const targetMemories = await restorePreviewMemoryRows(candidate);
  return {
    backup,
    quickCheck,
    current: await database.getSummary(),
    target: await candidate.getSummary(),
    memoryDiff: summarizeRestoreMemoryDiff(currentMemories, targetMemories)
  };
}

async function restoreProductBackup(app, backupId) {
  const { paths, backup, backupPath } = await resolveVerifiedBackup(app, backupId);

  const safetyBackup = await createProductBackup(app);
  await fs.copyFile(backupPath, paths.databasePath);
  const restoredDatabase = await initializeProductDatabase(paths.databasePath);
  const restoredSafetyBackup = await restoredDatabase.registerBackupRecord({
    id: safetyBackup.id,
    path: safetyBackup.path,
    status: safetyBackup.status,
    metadata: {
      ...(safetyBackup.metadata || {}),
      restoredDatabaseRegistered: true,
      restoredAfterBackupId: backup.id,
      restoredAfterBackupPath: backup.path
    }
  });
  await restoredDatabase.exec(`
    INSERT INTO runtime_events (id, level, source, message, metadata_json)
    VALUES (
      'event_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}',
      'info',
      'backup',
      'Database restored from verified backup',
      ${sqlString(
        JSON.stringify({
          restoredBackupId: backup.id,
          restoredBackupPath: backup.path,
          safetyBackupId: restoredSafetyBackup.id,
          safetyBackupPath: restoredSafetyBackup.path
        })
      )}
    );
  `);
  return {
    restored: true,
    backup,
    safetyBackup: restoredSafetyBackup,
    summary: await restoredDatabase.getSummary()
  };
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
