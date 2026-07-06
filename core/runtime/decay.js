function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function safeLimit(value, fallback = 8) {
  return Math.max(1, Math.min(50, Number.parseInt(String(value || fallback), 10) || fallback));
}

function preview(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function issue(level, code, message, action, items = []) {
  return {
    level,
    code,
    message,
    action,
    count: items.length,
    items
  };
}

async function buildDecayAudit(database, input = {}) {
  const limit = safeLimit(input.limit, 8);
  const memoryDormantDays = Math.max(1, Math.min(3650, Number.parseInt(String(input.memoryDormantDays || 30), 10) || 30));
  const sharedLineStaleDays = Math.max(1, Math.min(3650, Number.parseInt(String(input.sharedLineStaleDays || 14), 10) || 14));
  const innerLifeStaleDays = Math.max(1, Math.min(3650, Number.parseInt(String(input.innerLifeStaleDays || 7), 10) || 7));

  const [memoryArchiveSuggestions, sharedLineRows, shareRows, inboxRows, daemonRows] = await Promise.all([
    database.getMemoryArchiveSuggestions({ olderThanDays: memoryDormantDays, limit }),
    database.query(`
      SELECT
        l.id AS line_id,
        l.title,
        l.agent_id,
        p.id AS position_id,
        p.summary,
        p.interpretation_status,
        p.updated_at,
        p.metadata_json
      FROM continuity_lines l
      JOIN current_positions p ON p.line_id = l.id
      WHERE l.status = 'active'
        AND (
          p.interpretation_status IN ('draft', 'needs_review', 'stale')
          OR datetime(p.updated_at) <= datetime('now', '-${sharedLineStaleDays} days')
        )
      ORDER BY p.updated_at ASC, l.updated_at ASC
      LIMIT ${limit};
    `),
    database.query(`
      SELECT id, agent_id, status, body, decision_reason, created_at, updated_at
      FROM innerlife_shares
      WHERE status IN ('pending', 'deferred')
        AND datetime(updated_at) <= datetime('now', '-${innerLifeStaleDays} days')
      ORDER BY updated_at ASC, created_at ASC
      LIMIT ${limit};
    `),
    database.query(`
      SELECT id, agent_id, source, body, status, created_at, processed_at, metadata_json
      FROM innerlife_inbox
      WHERE status = 'pending'
        AND datetime(created_at) <= datetime('now', '-${innerLifeStaleDays} days')
      ORDER BY created_at ASC
      LIMIT ${limit};
    `),
    database.query(`
      SELECT agent_id, status, last_tick_at, next_run_at, last_result, last_error, tick_count, updated_at, metadata_json
      FROM innerlife_daemon_state
      WHERE status = 'error'
      ORDER BY updated_at DESC
      LIMIT ${limit};
    `)
  ]);

  const issues = [];
  const dormantMemories = (memoryArchiveSuggestions.suggestions || []).map((item) => ({
    id: item.id,
    title: item.title || "",
    summary: item.bodyPreview || "",
    status: item.reason || "dormant",
    updatedAt: item.updatedAt,
    labels: item.labels || []
  }));
  if (dormantMemories.length) {
    issues.push(issue(
      "info",
      "memory_dormant",
      `${dormantMemories.length} active Memory item(s) look dormant after ${memoryDormantDays} days.`,
      "Review archive suggestions before archiving; no automatic archive was run.",
      dormantMemories
    ));
  }

  const sharedLines = sharedLineRows.map((row) => {
    const metadata = parseJson(row.metadata_json, {});
    return {
      id: row.line_id,
      title: row.title || "",
      agentId: row.agent_id || "",
      positionId: row.position_id || "",
      summary: preview(row.summary || ""),
      status: row.interpretation_status || "draft",
      updatedAt: row.updated_at,
      needsReview: row.interpretation_status === "needs_review" || Boolean(metadata.needsReview || metadata.needs_review)
    };
  });
  if (sharedLines.length) {
    issues.push(issue(
      "warn",
      "shared_line_review",
      `${sharedLines.length} Shared Line position(s) are draft, stale, or need review.`,
      "Review the current position before agents rely on it for continuity.",
      sharedLines
    ));
  }

  const oldShares = shareRows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    status: row.status,
    summary: preview(row.body),
    reason: row.decision_reason || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  if (oldShares.length) {
    issues.push(issue(
      "warn",
      "innerlife_old_shares",
      `${oldShares.length} InnerLife share(s) have waited at least ${innerLifeStaleDays} days.`,
      "Run a timing check or mark the share used, deferred, or discarded after review.",
      oldShares
    ));
  }

  const oldInbox = inboxRows.map((row) => ({
    id: row.id,
    agentId: row.agent_id,
    source: row.source,
    status: row.status,
    summary: preview(row.body),
    createdAt: row.created_at,
    metadata: parseJson(row.metadata_json, {})
  }));
  if (oldInbox.length) {
    issues.push(issue(
      "warn",
      "innerlife_old_inbox",
      `${oldInbox.length} InnerLife inbox item(s) are still pending after ${innerLifeStaleDays} days.`,
      "Enable the daemon, run a digest, or discard stale source material after review.",
      oldInbox
    ));
  }

  const daemonErrors = daemonRows.map((row) => ({
    agentId: row.agent_id,
    status: row.status,
    lastError: row.last_error || "",
    lastResult: row.last_result || "",
    tickCount: row.tick_count || 0,
    updatedAt: row.updated_at,
    metadata: parseJson(row.metadata_json, {})
  }));
  if (daemonErrors.length) {
    issues.push(issue(
      "error",
      "innerlife_daemon_error",
      `${daemonErrors.length} InnerLife daemon state(s) are in error.`,
      "Read the daemon error, keep pending material intact, then retry or pause.",
      daemonErrors
    ));
  }

  const status = issues.some((item) => item.level === "error")
    ? "error"
    : issues.some((item) => item.level === "warn")
      ? "needs_review"
      : "ok";
  return {
    status,
    generatedAt: new Date().toISOString(),
    thresholds: {
      memoryDormantDays,
      sharedLineStaleDays,
      innerLifeStaleDays
    },
    summary: status === "ok"
      ? "No decay review items found."
      : "Review stale, dormant, or waiting product state before mutating it.",
    counts: {
      issues: issues.length,
      dormantMemories: dormantMemories.length,
      sharedLines: sharedLines.length,
      oldShares: oldShares.length,
      oldInbox: oldInbox.length,
      daemonErrors: daemonErrors.length
    },
    issues
  };
}

function createDecayRuntime({ ensureProductCore }) {
  async function getProductDecayAudit(app, input = {}) {
    const { database } = await ensureProductCore(app);
    return buildDecayAudit(database, input);
  }

  return {
    getProductDecayAudit
  };
}

module.exports = {
  buildDecayAudit,
  createDecayRuntime
};
