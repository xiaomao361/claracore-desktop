const { spawn } = require("child_process");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

function tryBuiltinSqlite() {
  try {
    return require("node:sqlite");
  } catch (_error) {
    return null;
  }
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

function sqliteString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function truncatePreview(value, maxLength = 160) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function pickPreviewValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return fallback;
}

function summarizeImportSampleRow(row) {
  return {
    id: truncatePreview(pickPreviewValue(row, ["id", "memory_id", "record_id", "line_id", "agent_id", "event_id", "thought_id", "share_id"], "")),
    title: truncatePreview(pickPreviewValue(row, ["title", "name", "label", "display_name", "kind", "type", "record_type"], "")),
    status: truncatePreview(pickPreviewValue(row, ["status", "review_status", "interpretation_status", "enabled"], "")),
    preview: truncatePreview(pickPreviewValue(row, ["body", "summary", "content", "text", "value", "objective", "next_step"], ""))
  };
}

async function runSqliteReadOnly(dbPath, sql) {
  const sqlite = tryBuiltinSqlite();
  if (sqlite?.DatabaseSync) {
    const database = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    try {
      return database.prepare(sql).all();
    } finally {
      database.close();
    }
  }
  const uri = `file:${dbPath}?mode=ro`;
  return new Promise((resolve, reject) => {
    const child = spawn("sqlite3", ["-readonly", "-json", uri], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `sqlite3 exited with code ${code}`));
        return;
      }
      const text = stdout.trim();
      resolve(text ? JSON.parse(text) : []);
    });
    child.stdin.end(sql);
  });
}

async function scanSqliteDatabase(dbPath, interestingTables = []) {
  const present = await exists(dbPath);
  if (!present) {
    return {
      present: false,
      dbPath,
      sizeBytes: 0,
      modifiedAt: null,
      tables: [],
      counts: {},
      error: null
    };
  }
  const stat = await fs.stat(dbPath);
  try {
    const tableRows = await runSqliteReadOnly(
      dbPath,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    );
    const tables = tableRows.map((row) => row.name);
    const counts = {};
    for (const table of interestingTables.filter((name) => tables.includes(name))) {
      const rows = await runSqliteReadOnly(dbPath, `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)};`);
      counts[table] = rows[0]?.count ?? 0;
    }
    const quickRows = await runSqliteReadOnly(dbPath, "PRAGMA quick_check;");
    const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0] || "unknown";
    return {
      present: true,
      dbPath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      tables,
      counts,
      quickCheck,
      error: null
    };
  } catch (error) {
    return {
      present: true,
      dbPath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      tables: [],
      counts: {},
      quickCheck: "error",
      error: error.message
    };
  }
}

async function scanJsonFile(filePath) {
  const present = await exists(filePath);
  if (!present) {
    return {
      present: false,
      path: filePath,
      sizeBytes: 0,
      keys: [],
      error: null
    };
  }
  const stat = await fs.stat(filePath);
  try {
    const data = JSON.parse(await fs.readFile(filePath, "utf8"));
    return {
      present: true,
      path: filePath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      keys: data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).slice(0, 20) : [],
      error: null
    };
  } catch (error) {
    return {
      present: true,
      path: filePath,
      sizeBytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      keys: [],
      error: error.message
    };
  }
}

function resolveImportPreviewPaths() {
  const home = os.homedir();
  const memoriaRoot = path.resolve(process.env.MEMORIA_ROOT || path.join(home, ".claracore", "memoria"));
  const continuityRoot = path.resolve(process.env.CONTINUITY_ROOT || path.join(home, ".claracore", "continuity"));
  const innerlifeRoot = path.resolve(process.env.INNERLIFE_ROOT || path.join(home, ".claracore", "innerlife"));
  return {
    memoria: {
      root: memoriaRoot,
      databasePath: path.join(memoriaRoot, "memoria.db"),
      labelAliasesPath: path.join(memoriaRoot, "label_aliases.json")
    },
    continuity: {
      root: continuityRoot,
      databasePath: path.join(continuityRoot, "continuity.db"),
      modelAdjustmentsPath: path.join(continuityRoot, "model_adjustments.json")
    },
    innerlife: {
      root: innerlifeRoot,
      databasePath: path.resolve(process.env.INNERLIFE_DB_PATH || path.join(innerlifeRoot, "innerlife.db")),
      envPath: path.join(innerlifeRoot, "innerlife.env")
    }
  };
}

const importPlanRules = {
  memoria: [
    { table: "memories", target: "memories", action: "copy_candidate", note: "old memory rows" },
    { table: "records", target: "memories", action: "copy_candidate", note: "old record rows" },
    { table: "memory_labels", target: "memory_labels", action: "copy_candidate", note: "old labels" },
    { table: "memory_sources", target: "memory_sources", action: "copy_candidate", note: "old source metadata" }
  ],
  continuity: [
    { table: "continuity_lines", target: "continuity_lines", action: "copy_candidate", note: "old shared lines" },
    { table: "current_positions", target: "current_positions", action: "copy_candidate", note: "old current positions" },
    { table: "continuity_handoffs", target: "continuity_handoffs", action: "copy_candidate", note: "old handoffs" },
    { table: "session_threads", target: "continuity_lines", action: "copy_candidate", note: "legacy shared lines and positions" },
    { table: "handoffs", target: "continuity_handoffs", action: "copy_candidate", note: "legacy handoffs" },
    { table: "state_snapshots", target: "continuity_snapshots", action: "copy_candidate", note: "legacy state snapshots" }
  ],
  innerlife: [
    { table: "innerlife_profiles", target: "innerlife_profiles", action: "copy_candidate", note: "old profiles" },
    { table: "innerlife_events", target: "innerlife_events", action: "copy_candidate", note: "old events" },
    { table: "innerlife_thoughts", target: "innerlife_thoughts", action: "copy_candidate", note: "old thoughts" },
    { table: "innerlife_shares", target: "innerlife_shares", action: "copy_candidate", note: "old pending shares" },
    { table: "agent_profiles", target: "innerlife_profiles", action: "copy_candidate", note: "InnerLife v2 agent profiles" },
    { table: "agent_state", target: "innerlife_profiles", action: "copy_candidate", note: "InnerLife v2 agent state" },
    { table: "inbox_events", target: "innerlife_inbox", action: "copy_candidate", note: "InnerLife v2 inbox" },
    { table: "internal_events", target: "innerlife_events", action: "copy_candidate", note: "InnerLife v2 internal events" },
    { table: "pending_shares", target: "innerlife_shares", action: "copy_candidate", note: "InnerLife v2 pending shares" },
    { table: "digest_runs", target: "innerlife_digest_runs", action: "copy_candidate", note: "InnerLife v2 digest history" },
    { table: "sessions", target: "innerlife_sessions", action: "copy_candidate", note: "InnerLife v2 sessions" },
    { table: "share_actions", target: "innerlife_share_actions", action: "copy_candidate", note: "InnerLife v2 share actions" },
    { table: "inner_summaries", target: "innerlife_events", action: "copy_candidate", note: "InnerLife v2 summaries" },
    { table: "autonomous_experiences", target: "innerlife_events", action: "copy_candidate", note: "InnerLife v2 autonomous experiences" },
    { table: "exploration_runs", target: "innerlife_events", action: "copy_candidate", note: "InnerLife v2 exploration runs" },
    { table: "convergence_runs", target: "innerlife_events", action: "copy_candidate", note: "InnerLife v2 convergence runs" },
    { table: "source_subscriptions", target: "innerlife_events", action: "copy_candidate", note: "InnerLife v2 source subscriptions" }
  ]
};

function buildImportPlan(sourceId, database) {
  const tables = new Set(database?.tables || []);
  const counts = database?.counts || {};
  const rules = importPlanRules[sourceId] || [];
  const candidates = rules
    .filter((rule) => tables.has(rule.table))
    .map((rule) => ({
      ...rule,
      rowCount: counts[rule.table] ?? null
    }));
  const knownTables = new Set(rules.map((rule) => rule.table));
  const skippedTables = Array.from(tables)
    .filter((table) => !knownTables.has(table))
    .sort();
  const candidateRows = candidates.reduce((total, candidate) => {
    return total + (Number.isFinite(candidate.rowCount) ? candidate.rowCount : 0);
  }, 0);
  return {
    status: database?.present ? "preview_only" : "missing_source",
    candidateRows,
    candidates,
    skippedTables,
    importEnabled: ["memoria", "continuity", "innerlife"].includes(sourceId) && Boolean(database?.present) && database?.quickCheck === "ok",
    requirement:
      sourceId === "memoria"
        ? "Creates a verified product backup first, then imports old Memoria rows read-only."
        : sourceId === "continuity"
          ? "Creates a verified product backup first, then imports old Continuity rows read-only."
          : sourceId === "innerlife"
            ? "Creates a verified product backup first, then imports old InnerLife rows read-only."
            : "Create a product backup and confirm before copy-based import is enabled."
  };
}

async function attachImportPlanSamples(source) {
  const database = source?.database || {};
  const importPlan = source?.importPlan || {};
  if (!database.present || database.quickCheck !== "ok" || !database.dbPath || !Array.isArray(importPlan.candidates)) {
    return source;
  }
  for (const candidate of importPlan.candidates) {
    try {
      const rows = await runSqliteReadOnly(database.dbPath, `SELECT * FROM ${quoteIdentifier(candidate.table)} LIMIT 3;`);
      candidate.samples = rows.map(summarizeImportSampleRow);
      candidate.sampleCount = candidate.samples.length;
    } catch (error) {
      candidate.samples = [];
      candidate.sampleError = error.message || String(error);
    }
  }
  return source;
}

async function previewImportSources() {
  const paths = resolveImportPreviewPaths();
  const sources = {
    memoria: {
      id: "memoria",
      label: "Memoria",
      root: paths.memoria.root,
      database: await scanSqliteDatabase(paths.memoria.databasePath, [
        "memories",
        "records",
        "memory_labels",
        "memory_embeddings",
        "memory_sources"
      ]),
      labelAliases: await scanJsonFile(paths.memoria.labelAliasesPath)
    },
    continuity: {
      id: "continuity",
      label: "Continuity",
      root: paths.continuity.root,
      database: await scanSqliteDatabase(paths.continuity.databasePath, [
        "continuity_lines",
        "current_positions",
        "continuity_handoffs",
        "threads",
        "positions",
        "audit_log"
      ]),
      modelAdjustments: await scanJsonFile(paths.continuity.modelAdjustmentsPath)
    },
    innerlife: {
      id: "innerlife",
      label: "InnerLife",
      root: paths.innerlife.root,
      database: await scanSqliteDatabase(paths.innerlife.databasePath, [
        "innerlife_profiles",
        "innerlife_events",
        "innerlife_thoughts",
        "innerlife_shares",
        "agent_profiles",
        "agent_state",
        "inbox_events",
        "internal_events",
        "pending_shares",
        "digest_runs",
        "sessions",
        "share_actions",
        "inner_summaries",
        "autonomous_experiences",
        "exploration_runs",
        "convergence_runs",
        "source_subscriptions"
      ]),
      envFile: {
        present: await exists(paths.innerlife.envPath),
        path: paths.innerlife.envPath
      }
    }
  };
  for (const [sourceId, source] of Object.entries(sources)) {
    source.importPlan = buildImportPlan(sourceId, source.database);
    await attachImportPlanSamples(source);
  }
  return {
    mode: "read-only-preview",
    generatedAt: new Date().toISOString(),
    sources,
    writePolicy: "Source files are read-only. Memoria, Continuity, and InnerLife imports are backup-gated."
  };
}

module.exports = {
  buildImportPlan,
  previewImportSources,
  quoteIdentifier,
  resolveImportPreviewPaths,
  runSqliteReadOnly,
  scanSqliteDatabase,
  scanJsonFile,
  sqliteString
};
