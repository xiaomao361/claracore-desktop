const { quoteIdentifier } = require("../../import-preview");

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
  if (Array.isArray(labels)) return labels.map(normalizeImportLabel).filter(Boolean);
  const text = String(labels || "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map(normalizeImportLabel).filter(Boolean);
  } catch (_error) {
    // Fall through to comma-separated legacy labels.
  }
  return text
    .split(",")
    .map(normalizeImportLabel)
    .filter(Boolean);
}

function normalizeImportLabel(label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (!normalized) return "";
  if (/^[,;:|，；：、.。]+$/.test(normalized)) return "";
  if (Array.from(normalized).length < 2) return "";
  return normalized;
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

const PRODUCT_EXPORT_TABLES = [
  "schema_migrations",
  "app_settings",
  "secret_refs",
  "agents",
  "memory_sources",
  "memories",
  "memory_labels",
  "memory_label_aliases",
  "memory_embeddings",
  "memory_records",
  "continuity_lines",
  "current_positions",
  "continuity_position_history",
  "continuity_snapshots",
  "continuity_handoffs",
  "innerlife_profiles",
  "innerlife_events",
  "innerlife_inbox",
  "innerlife_thoughts",
  "innerlife_shares",
  "innerlife_share_actions",
  "innerlife_digest_runs",
  "innerlife_sessions",
  "innerlife_share_checks",
  "innerlife_daemon_state",
  "gateway_sessions",
  "gateway_traces",
  "runtime_events",
  "backups"
];

function sqlValue(value, quoteString) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return quoteString(value);
}

function insertRowsSql(tableName, rows, quoteString) {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  return rows
    .map((row) => {
      const columns = Object.keys(row || {});
      if (columns.length === 0) return "";
      return `
        INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")})
        VALUES (${columns.map((column) => sqlValue(row[column], quoteString)).join(", ")});
      `;
    })
    .filter(Boolean)
    .join("\n");
}

function summarizeProductTables(tables = {}) {
  return Object.fromEntries(
    Object.entries(tables).map(([tableName, rows]) => [tableName, Array.isArray(rows) ? rows.length : 0])
  );
}

module.exports = {
  safeArchiveString,
  normalizeArchiveLabels,
  normalizeArchiveStatus,
  normalizeArchiveSensitivity,
  stableImportId,
  pickFirst,
  normalizeImportLabels,
  normalizeImportLabel,
  normalizeContinuityStatus,
  normalizeInterpretationStatus,
  normalizeLegacyContinuityInterpretationStatus,
  buildLegacyContinuityMetadata,
  safeJsonArray,
  safeJsonObject,
  normalizeInnerLifeShareStatus,
  normalizeInnerLifeReviewStatus,
  normalizeInnerLifeEventStatus,
  legacyAgentLabels,
  parseImportJson,
  compactImportText,
  normalizeInnerLifeInboxStatus,
  normalizeInnerLifeSessionStatus,
  normalizeInnerLifeDigestStatus,
  reviewStatusFromShareStatus,
  PRODUCT_EXPORT_TABLES,
  sqlValue,
  insertRowsSql,
  summarizeProductTables
};
