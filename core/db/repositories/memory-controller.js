const POLICY_MODES = new Set(["off", "observe", "canary"]);
const STAGE_A_ACTIONS = new Set(["NOOP", "RETRIEVE"]);
const STAGE_B_ACTIONS = new Set(["", "ABSTAIN", "INJECT_TOP1", "INJECT_TOPK", "EXPAND_ONE_HOP", "RE_RETRIEVE"]);
const RESULT_STATUSES = new Set(["completed", "abstained", "timeout", "error"]);
const CACHE_STATUSES = new Set(["none", "hit", "miss", "invalidated"]);
const FEEDBACK_TYPES = new Set(["used", "ignored", "wrong", "corrected", "task_succeeded", "task_failed", "outcome_unknown", "delivered"]);

function boundedInteger(value, fallback = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(maximum, parsed));
}

function boundedText(value, maximum) {
  return String(value || "").trim().slice(0, maximum);
}

function boundedJson(value, fallback, maximumBytes, label) {
  const normalized = value === undefined ? fallback : value;
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes) {
    throw new Error(`${label} exceeds the ${maximumBytes}-byte limit.`);
  }
  return normalized;
}

function requireEnum(value, allowed, label, fallback = "") {
  const normalized = String(value ?? fallback).trim();
  if (!allowed.has(normalized)) throw new Error(`${label} must be one of: ${[...allowed].filter(Boolean).join(", ")}.`);
  return normalized;
}

function createMemoryControllerRepository(helpers) {
  const { jsonSql, newId, parseJson, resolveAgentIdentity, sqlString } = helpers;

  function mapEventRow(row) {
    return {
      id: row.id,
      policyVersion: row.policy_version,
      policyMode: row.policy_mode,
      agentId: row.agent_id,
      clientId: row.client_id || "",
      conversationId: row.conversation_id || "",
      sessionId: row.session_id || "",
      queryHash: row.query_hash || "",
      queryPreview: row.query_preview || "",
      features: parseJson(row.feature_json, {}),
      stageA: { action: row.stage_a_action, reason: row.stage_a_reason },
      stageB: { action: row.stage_b_action || "", reason: row.stage_b_reason || "" },
      searchParams: parseJson(row.search_params_json, {}),
      candidates: parseJson(row.candidates_json, []),
      injectedIds: parseJson(row.injected_ids_json, []),
      cacheStatus: row.cache_status || "none",
      searchLatencyMs: row.search_latency_ms || 0,
      totalLatencyMs: row.total_latency_ms || 0,
      estimatedTokens: row.estimated_tokens || 0,
      resultStatus: row.result_status,
      error: row.error || "",
      createdAt: row.created_at,
      feedbackCount: row.feedback_count || 0
    };
  }

  function mapFeedbackRow(row) {
    return {
      id: row.id,
      decisionId: row.decision_id,
      feedbackType: row.feedback_type,
      source: row.source,
      conversationId: row.conversation_id || "",
      responseId: row.response_id || "",
      memoryIds: parseJson(row.memory_ids_json, []),
      evidenceExcerpt: row.evidence_excerpt || "",
      evidence: parseJson(row.evidence_json, {}),
      observedAt: row.observed_at || null,
      idempotencyKey: row.idempotency_key || "",
      createdAt: row.created_at
    };
  }

  return {
    async getMemoryControlWatermark(scope = "memoria") {
      const normalizedScope = boundedText(scope, 80) || "memoria";
      const rows = await this.query(`
        SELECT scope, revision, updated_at
        FROM memory_control_watermarks
        WHERE scope = ${sqlString(normalizedScope)}
        LIMIT 1;
      `);
      return rows[0] ? {
        scope: rows[0].scope,
        revision: rows[0].revision || 0,
        updatedAt: rows[0].updated_at
      } : null;
    },

    async getMemoryControlEligibleIds(input = {}) {
      const ids = [...new Set((Array.isArray(input.ids) ? input.ids : [])
        .map((id) => boundedText(id, 160))
        .filter(Boolean))].slice(0, 3);
      if (ids.length === 0) return [];
      const timeView = String(input.timeView || input.time_view || "current").trim().toLowerCase();
      const statusClause = timeView === "historical"
        ? "m.status = 'superseded'"
        : timeView === "all"
          ? "m.status IN ('active', 'superseded')"
          : timeView === "current"
            ? "m.status = 'active'"
            : "";
      if (!statusClause) throw new Error("timeView must be current, historical, or all.");
      const sensitivityScope = String(input.sensitivityScope || input.sensitivity_scope || "normal").trim().toLowerCase();
      if (sensitivityScope !== "normal") throw new Error("Memory Controller cache currently supports normal sensitivity only.");
      let agentClause = "";
      if (input.agentId || input.agent_id) {
        const identity = resolveAgentIdentity(input);
        const tail = identity.id.includes(":") ? identity.id.split(":").slice(1).join(":") : identity.id;
        const labels = [...new Set([`agent-id:${identity.id}`, tail ? `agent:${tail}` : ""])].filter(Boolean);
        agentClause = `
          AND EXISTS (
            SELECT 1 FROM memory_labels agent_filter
            WHERE agent_filter.memory_id = m.id
              AND agent_filter.label IN (${labels.map(sqlString).join(", ")})
          )
        `;
      }
      const rows = await this.query(`
        SELECT m.id
        FROM memories m
        WHERE m.id IN (${ids.map(sqlString).join(", ")})
          AND ${statusClause}
          AND m.sensitivity = 'normal'
          ${agentClause};
      `);
      return rows.map((row) => row.id);
    },

    async recordMemoryControlEvent(input = {}) {
      const id = boundedText(input.id, 160) || newId("memory_control");
      const identity = resolveAgentIdentity(input || {});
      const policyVersion = boundedText(input.policyVersion || input.policy_version, 120);
      if (!policyVersion) throw new Error("Memory Controller policyVersion is required.");
      const policyMode = requireEnum(input.policyMode || input.policy_mode, POLICY_MODES, "policyMode", "observe");
      const stageAAction = requireEnum(input.stageAAction || input.stage_a_action, STAGE_A_ACTIONS, "stageAAction");
      const stageAReason = boundedText(input.stageAReason || input.stage_a_reason, 120);
      if (!stageAReason) throw new Error("Memory Controller stageAReason is required.");
      const stageBAction = requireEnum(input.stageBAction || input.stage_b_action, STAGE_B_ACTIONS, "stageBAction", "");
      const resultStatus = requireEnum(input.resultStatus || input.result_status, RESULT_STATUSES, "resultStatus");
      const cacheStatus = requireEnum(input.cacheStatus || input.cache_status, CACHE_STATUSES, "cacheStatus", "none");
      const conversationId = boundedText(input.conversationId || input.conversation_id, 160);
      const sessionId = boundedText(input.sessionId || input.session_id || conversationId, 160);
      const features = boundedJson(input.features || input.featureState || {}, {}, 4096, "features");
      const searchParams = boundedJson(input.searchParams || {}, {}, 2048, "searchParams");
      const candidates = boundedJson(Array.isArray(input.candidates) ? input.candidates.slice(0, 20) : [], [], 8192, "candidates");
      const injectedIds = boundedJson(Array.isArray(input.injectedIds) ? input.injectedIds.slice(0, 3) : [], [], 1024, "injectedIds");
      await this.exec(`
        INSERT INTO memory_control_events (
          id, policy_version, policy_mode, agent_id, client_id, conversation_id, session_id,
          query_hash, query_preview, feature_json, stage_a_action, stage_a_reason,
          stage_b_action, stage_b_reason, search_params_json, candidates_json,
          injected_ids_json, cache_status, search_latency_ms, total_latency_ms,
          estimated_tokens, result_status, error
        ) VALUES (
          ${sqlString(id)}, ${sqlString(policyVersion)}, ${sqlString(policyMode)},
          ${sqlString(identity.id)}, ${sqlString(boundedText(input.clientId || input.client_id, 160))},
          ${sqlString(conversationId)}, ${sqlString(sessionId)},
          ${sqlString(boundedText(input.queryHash || input.query_hash, 160))},
          ${sqlString(boundedText(input.queryPreview || input.query_preview, 160))},
          ${jsonSql(features)},
          ${sqlString(stageAAction)}, ${sqlString(stageAReason)},
          ${sqlString(stageBAction)}, ${sqlString(boundedText(input.stageBReason || input.stage_b_reason, 120))},
          ${jsonSql(searchParams)}, ${jsonSql(candidates)},
          ${jsonSql(injectedIds)},
          ${sqlString(cacheStatus)},
          ${boundedInteger(input.searchLatencyMs || input.search_latency_ms, 0, 600000)},
          ${boundedInteger(input.totalLatencyMs || input.total_latency_ms, 0, 600000)},
          ${boundedInteger(input.estimatedTokens || input.estimated_tokens, 0, 100000)},
          ${sqlString(resultStatus)}, ${sqlString(boundedText(input.error, 500))}
        );
      `);
      return this.getMemoryControlEvent(id);
    },

    async getMemoryControlEvent(id) {
      const decisionId = boundedText(id, 160);
      if (!decisionId) throw new Error("Memory Controller decision id is required.");
      const rows = await this.query(`
        SELECT e.*, (SELECT COUNT(*) FROM memory_control_feedback f WHERE f.decision_id = e.id) AS feedback_count
        FROM memory_control_events e
        WHERE e.id = ${sqlString(decisionId)}
        LIMIT 1;
      `);
      return rows[0] ? mapEventRow(rows[0]) : null;
    },

    async listMemoryControlEvents(input = {}) {
      const limit = Math.max(1, Math.min(100, boundedInteger(input.limit, 20, 100) || 20));
      const offset = boundedInteger(input.offset, 0, 1000000);
      const filters = [];
      if (input.agentId || input.agent_id) filters.push(`e.agent_id = ${sqlString(resolveAgentIdentity(input).id)}`);
      if (input.conversationId || input.conversation_id) filters.push(`e.conversation_id = ${sqlString(boundedText(input.conversationId || input.conversation_id, 160))}`);
      if (input.resultStatus || input.result_status) {
        filters.push(`e.result_status = ${sqlString(requireEnum(input.resultStatus || input.result_status, RESULT_STATUSES, "resultStatus"))}`);
      }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await this.query(`
        SELECT e.*, (SELECT COUNT(*) FROM memory_control_feedback f WHERE f.decision_id = e.id) AS feedback_count
        FROM memory_control_events e
        ${where}
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT ${limit} OFFSET ${offset};
      `);
      return rows.map(mapEventRow);
    },

    async recordMemoryControlFeedback(input = {}) {
      const decisionId = boundedText(input.decisionId || input.decision_id, 160);
      if (!decisionId) throw new Error("Memory Controller feedback decisionId is required.");
      if (!(await this.getMemoryControlEvent(decisionId))) throw new Error("Memory Controller decision not found.");
      const feedbackType = requireEnum(input.feedbackType || input.feedback_type, FEEDBACK_TYPES, "feedbackType");
      const source = boundedText(input.source, 120);
      if (!source) throw new Error("Memory Controller feedback source is required.");
      const idempotencyKey = boundedText(input.idempotencyKey || input.idempotency_key, 200);
      if (idempotencyKey) {
        const existing = await this.query(`
          SELECT * FROM memory_control_feedback WHERE idempotency_key = ${sqlString(idempotencyKey)} LIMIT 1;
        `);
        if (existing[0]) return mapFeedbackRow(existing[0]);
      }
      const id = boundedText(input.id, 160) || newId("memory_feedback");
      const memoryIds = boundedJson(Array.isArray(input.memoryIds) ? input.memoryIds.slice(0, 3) : [], [], 1024, "memoryIds");
      const evidence = boundedJson(input.evidence || {}, {}, 4096, "evidence");
      await this.exec(`
        INSERT INTO memory_control_feedback (
          id, decision_id, feedback_type, source, conversation_id, response_id,
          memory_ids_json, evidence_excerpt, evidence_json, observed_at, idempotency_key
        ) VALUES (
          ${sqlString(id)}, ${sqlString(decisionId)}, ${sqlString(feedbackType)}, ${sqlString(source)},
          ${sqlString(boundedText(input.conversationId || input.conversation_id, 160))},
          ${sqlString(boundedText(input.responseId || input.response_id, 160))},
          ${jsonSql(memoryIds)},
          ${sqlString(boundedText(input.evidenceExcerpt || input.evidence_excerpt, 500))},
          ${jsonSql(evidence)},
          ${input.observedAt || input.observed_at ? sqlString(new Date(input.observedAt || input.observed_at).toISOString()) : "NULL"},
          ${idempotencyKey ? sqlString(idempotencyKey) : "NULL"}
        );
      `);
      const rows = await this.query(`SELECT * FROM memory_control_feedback WHERE id = ${sqlString(id)} LIMIT 1;`);
      return mapFeedbackRow(rows[0]);
    },

    async listMemoryControlFeedback(input = {}) {
      const decisionId = boundedText(input.decisionId || input.decision_id, 160);
      const limit = Math.max(1, Math.min(100, boundedInteger(input.limit, 20, 100) || 20));
      const filters = [];
      if (decisionId) filters.push(`decision_id = ${sqlString(decisionId)}`);
      if (input.feedbackType || input.feedback_type) {
        filters.push(`feedback_type = ${sqlString(requireEnum(input.feedbackType || input.feedback_type, FEEDBACK_TYPES, "feedbackType"))}`);
      }
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await this.query(`
        SELECT * FROM memory_control_feedback
        ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit};
      `);
      return rows.map(mapFeedbackRow);
    },

    async getMemoryControlObservationSnapshot(input = {}) {
      const limit = Math.max(1, Math.min(20, boundedInteger(input.limit, 10, 20) || 10));
      const [stats, events, stageARows, stageBRows, resultRows, agentRows] = await Promise.all([
        this.getMemoryControlLedgerStats(),
        this.listMemoryControlEvents({ limit }),
        this.query("SELECT stage_a_action AS name, COUNT(*) AS count FROM memory_control_events GROUP BY stage_a_action ORDER BY stage_a_action;"),
        this.query("SELECT COALESCE(NULLIF(stage_b_action, ''), 'NONE') AS name, COUNT(*) AS count FROM memory_control_events GROUP BY COALESCE(NULLIF(stage_b_action, ''), 'NONE') ORDER BY name;"),
        this.query("SELECT result_status AS name, COUNT(*) AS count FROM memory_control_events GROUP BY result_status ORDER BY result_status;"),
        this.query("SELECT agent_id AS name, COUNT(*) AS count FROM memory_control_events GROUP BY agent_id ORDER BY count DESC, agent_id ASC LIMIT 20;")
      ]);
      const countMap = (rows) => Object.fromEntries(rows.map((row) => [row.name, Number(row.count || 0)]));
      return {
        ...stats,
        stageA: countMap(stageARows),
        stageB: countMap(stageBRows),
        results: countMap(resultRows),
        agents: countMap(agentRows),
        recent: events.map((event) => ({
          id: event.id,
          agentId: event.agentId,
          clientId: event.clientId,
          conversationId: event.conversationId,
          queryPreview: event.queryPreview,
          stageA: event.stageA,
          stageB: event.stageB,
          cacheStatus: event.cacheStatus,
          totalLatencyMs: event.totalLatencyMs,
          resultStatus: event.resultStatus,
          error: event.error,
          createdAt: event.createdAt
        }))
      };
    },

    async getMemoryControlLedgerStats() {
      const rows = await this.query(`
        SELECT
          (SELECT COUNT(*) FROM memory_control_events) AS event_count,
          (SELECT COUNT(*) FROM memory_control_feedback) AS feedback_count,
          (SELECT COUNT(DISTINCT decision_id) FROM memory_control_feedback) AS events_with_feedback,
          COALESCE((SELECT SUM(
            length(id) + length(policy_version) + length(policy_mode) + length(agent_id) +
            length(client_id) + length(conversation_id) + length(session_id) + length(query_hash) +
            length(query_preview) + length(feature_json) + length(stage_a_action) + length(stage_a_reason) +
            length(stage_b_action) + length(stage_b_reason) + length(search_params_json) +
            length(candidates_json) + length(injected_ids_json) + length(error)
          ) FROM memory_control_events), 0) +
          COALESCE((SELECT SUM(
            length(id) + length(decision_id) + length(feedback_type) + length(source) +
            length(conversation_id) + length(response_id) + length(memory_ids_json) +
            length(evidence_excerpt) + length(evidence_json) + COALESCE(length(idempotency_key), 0)
          ) FROM memory_control_feedback), 0) AS estimated_bytes;
      `);
      return {
        eventCount: rows[0]?.event_count || 0,
        feedbackCount: rows[0]?.feedback_count || 0,
        eventsWithFeedback: rows[0]?.events_with_feedback || 0,
        estimatedBytes: rows[0]?.estimated_bytes || 0
      };
    },

    async cleanupMemoryControlLedger(input = {}) {
      const maxAgeDays = Math.max(1, boundedInteger(input.maxAgeDays || input.max_age_days, 30, 3650) || 30);
      const feedbackMaxAgeDays = Math.max(maxAgeDays, boundedInteger(input.feedbackMaxAgeDays || input.feedback_max_age_days, 180, 3650) || 180);
      const maxEvents = Math.max(1, boundedInteger(input.maxEvents || input.max_events, 10000, 1000000) || 10000);
      const maxBytes = Math.max(1024, boundedInteger(input.maxBytes || input.max_bytes, 8 * 1024 * 1024, 1024 * 1024 * 1024) || 8 * 1024 * 1024);
      const dryRun = input.dryRun === true || input.dry_run === true;
      const before = await this.getMemoryControlLedgerStats();
      const rows = await this.query(`
        SELECT e.id, e.created_at,
          (SELECT COUNT(*) FROM memory_control_feedback f WHERE f.decision_id = e.id) AS feedback_count,
          (length(e.id) + length(e.policy_version) + length(e.policy_mode) + length(e.agent_id) +
            length(e.client_id) + length(e.conversation_id) + length(e.session_id) + length(e.query_hash) +
            length(e.query_preview) + length(e.feature_json) + length(e.stage_a_action) + length(e.stage_a_reason) +
            length(e.stage_b_action) + length(e.stage_b_reason) + length(e.search_params_json) +
            length(e.candidates_json) + length(e.injected_ids_json) + length(e.error) +
            COALESCE((SELECT SUM(length(f.id) + length(f.decision_id) + length(f.feedback_type) + length(f.source) +
              length(f.conversation_id) + length(f.response_id) + length(f.memory_ids_json) +
              length(f.evidence_excerpt) + length(f.evidence_json) + COALESCE(length(f.idempotency_key), 0))
              FROM memory_control_feedback f WHERE f.decision_id = e.id), 0)
          ) AS estimated_bytes,
          CASE WHEN julianday(e.created_at) < julianday('now') - ${maxAgeDays} THEN 1 ELSE 0 END AS ordinary_expired,
          CASE WHEN julianday(e.created_at) < julianday('now') - ${feedbackMaxAgeDays} THEN 1 ELSE 0 END AS feedback_expired
        FROM memory_control_events e
        ORDER BY CASE WHEN (SELECT COUNT(*) FROM memory_control_feedback f WHERE f.decision_id = e.id) = 0 THEN 0 ELSE 1 END,
          e.created_at ASC, e.id ASC;
      `);
      const selected = new Map();
      for (const row of rows) {
        if ((!row.feedback_count && row.ordinary_expired) || (row.feedback_count && row.feedback_expired)) {
          selected.set(row.id, row.feedback_count ? "feedback_age" : "ordinary_age");
        }
      }
      let remainingCount = rows.length - selected.size;
      let remainingBytes = rows.reduce((sum, row) => sum + (row.estimated_bytes || 0), 0) - rows.filter((row) => selected.has(row.id)).reduce((sum, row) => sum + (row.estimated_bytes || 0), 0);
      for (const row of rows) {
        if (remainingCount <= maxEvents && remainingBytes <= maxBytes) break;
        if (selected.has(row.id)) continue;
        selected.set(row.id, "capacity");
        remainingCount -= 1;
        remainingBytes -= row.estimated_bytes || 0;
      }
      const selectedRows = rows.filter((row) => selected.has(row.id));
      if (!dryRun && selectedRows.length) {
        await this.exec(`DELETE FROM memory_control_events WHERE id IN (${selectedRows.map((row) => sqlString(row.id)).join(", ")});`);
      }
      const after = dryRun ? {
        eventCount: remainingCount,
        feedbackCount: before.feedbackCount - selectedRows.reduce((sum, row) => sum + (row.feedback_count || 0), 0),
        eventsWithFeedback: before.eventsWithFeedback - selectedRows.filter((row) => row.feedback_count > 0).length,
        estimatedBytes: Math.max(0, remainingBytes)
      } : await this.getMemoryControlLedgerStats();
      return {
        dryRun,
        policy: { maxAgeDays, feedbackMaxAgeDays, maxEvents, maxBytes },
        deleted: selectedRows.length,
        feedbackRowsDeleted: selectedRows.reduce((sum, row) => sum + (row.feedback_count || 0), 0),
        reasons: {
          ordinaryAge: selectedRows.filter((row) => selected.get(row.id) === "ordinary_age").length,
          feedbackAge: selectedRows.filter((row) => selected.get(row.id) === "feedback_age").length,
          capacity: selectedRows.filter((row) => selected.get(row.id) === "capacity").length
        },
        before,
        after
      };
    }
  };
}

module.exports = {
  CACHE_STATUSES,
  FEEDBACK_TYPES,
  POLICY_MODES,
  RESULT_STATUSES,
  STAGE_A_ACTIONS,
  STAGE_B_ACTIONS,
  createMemoryControllerRepository
};
