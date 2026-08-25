const { innerLifeShareSimilarity } = require("../../../innerlife/policy");

function createInnerLifeShareRepository(helpers, dependencies = {}) {
  const { shareTimingService } = dependencies;
  if (typeof shareTimingService !== "function") {
    throw new Error("InnerLife share repository requires shareTimingService.");
  }
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    newId,
    parseJson,
    sqlString
  } = helpers;

  function mapShareCheckRow(row) {
    return {
      id: row.id,
      shareId: row.share_id,
      agentId: row.agent_id,
      sessionId: row.session_id,
      context: row.context || "",
      decision: row.decision,
      reason: row.reason || "",
      createdAt: row.created_at,
      shareBody: row.share_body || "",
      shareStatus: row.share_status || "",
      metadata: parseJson(row.metadata_json, {})
    };
  }

  function mapShareRow(row) {
    const deliveryMetadata = parseJson(row.delivery_metadata_json, {}) || {};
    const { delivery_metadata_json: _deliveryMetadataJson, ...share } = row;
    return {
      ...share,
      deliveryEvidence: deliveryMetadata.deliveryEvidence || null
    };
  }

  function normalizeDeliveryEvidence(input = {}) {
    const conversationId = String(input.conversationId || "").trim();
    const responseId = String(input.responseId || "").trim();
    const responseExcerpt = String(input.responseExcerpt || "").replace(/\s+/g, " ").trim();
    const sharedAt = String(input.sharedAt || "").trim();
    const source = String(input.source || "agent").trim() || "agent";
    if (!conversationId) throw new Error("Used InnerLife shares require deliveryEvidence.conversationId.");
    if (responseExcerpt.length < 12) throw new Error("Used InnerLife shares require a deliveryEvidence.responseExcerpt of at least 12 characters.");
    if (!sharedAt || Number.isNaN(Date.parse(sharedAt))) throw new Error("Used InnerLife shares require a valid deliveryEvidence.sharedAt timestamp.");
    return {
      conversationId,
      ...(responseId ? { responseId } : {}),
      responseExcerpt: responseExcerpt.slice(0, 1200),
      sharedAt: new Date(sharedAt).toISOString(),
      source
    };
  }

  return {
    async findSimilarInnerLifeShare(agentId, body, input = {}) {
      const safeAgentId = String(agentId || "").trim();
      const candidate = String(body || "").trim();
      if (!safeAgentId || !candidate) return null;
      const threshold = Math.max(0.1, Math.min(1, Number(input.threshold) || 0.42));
      const limit = Math.max(1, Math.min(300, Number.parseInt(String(input.limit || 200), 10) || 200));
      const excludeId = String(input.excludeId || input.exclude_id || "").trim();
      const rows = await this.query(`
        SELECT
          s.id,
          s.status,
          s.body,
          s.updated_at,
          COALESCE(json_extract(e.metadata_json, '$.shareNoveltyText'), s.body) AS novelty_text
        FROM innerlife_shares s
        LEFT JOIN innerlife_thoughts t ON t.id = s.thought_id
        LEFT JOIN innerlife_events e ON e.id = t.event_id
        WHERE s.agent_id = ${sqlString(safeAgentId)}
          AND (${sqlString(excludeId)} = '' OR s.id != ${sqlString(excludeId)})
          AND (
            s.status IN ('pending', 'approved', 'deferred')
            OR (s.status = 'used' AND datetime(s.updated_at) >= datetime('now', '-30 days'))
          )
        ORDER BY s.updated_at DESC, s.created_at DESC
        LIMIT ${limit};
      `);
      let best = null;
      for (const row of rows) {
        const score = innerLifeShareSimilarity(candidate, row.novelty_text || row.body);
        if (score < threshold || (best && best.similarity >= score)) continue;
        best = {
          id: row.id,
          status: row.status,
          body: row.body || "",
          updatedAt: row.updated_at,
          similarity: score
        };
      }
      return best;
    },

    async listInnerLifeShares(status = "pending", limit = 20, agentId = "all") {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const statusFilter = String(status || "pending").trim();
      const agentFilter = String(agentId || "all").trim();
      const filters = [];
      if (statusFilter !== "all") filters.push(`s.status = ${sqlString(statusFilter)}`);
      if (agentFilter !== "all") filters.push(`s.agent_id = ${sqlString(agentFilter)}`);
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await this.query(`
        SELECT
          s.id,
          s.agent_id,
          s.thought_id,
          s.status,
          s.body,
          s.decision_reason,
          s.created_at,
          s.updated_at,
          t.event_id,
          t.review_status,
          (
            SELECT a.metadata_json
            FROM innerlife_share_actions a
            WHERE a.share_id = s.id AND a.action = 'used'
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT 1
          ) AS delivery_metadata_json
        FROM innerlife_shares s
        LEFT JOIN innerlife_thoughts t ON t.id = s.thought_id
        ${whereClause}
        ORDER BY s.updated_at DESC, s.created_at DESC
        LIMIT ${safeLimit};
      `);
      return rows.map(mapShareRow);
    },

    async listInnerLifeShareSummariesPage(input = {}) {
      const statusFilter = String(input.status || "pending").trim();
      const agentFilter = String(input.agentId || input.agent_id || "all").trim();
      const requestedLimit = Number.parseInt(String(input.limit ?? 3), 10);
      const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 3, 10));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const filters = [];
      if (statusFilter !== "all") filters.push(`s.status = ${sqlString(statusFilter)}`);
      if (agentFilter !== "all") filters.push(`s.agent_id = ${sqlString(agentFilter)}`);
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const [rows, totals] = await Promise.all([
        this.query(`
          SELECT s.id, s.agent_id, s.status, substr(s.body, 1, 400) AS preview,
                 s.created_at, s.updated_at
          FROM innerlife_shares s
          ${whereClause}
          ORDER BY s.updated_at DESC, s.created_at DESC
          LIMIT ${limit} OFFSET ${offset};
        `),
        this.query(`SELECT COUNT(*) AS total FROM innerlife_shares s ${whereClause};`)
      ]);
      return {
        items: rows,
        total: Number(totals[0]?.total || 0),
        limit,
        offset,
        requestedLimit
      };
    },

    async listInnerLifeShareChecks(agentId = DEFAULT_AGENT_ID, limit = 10) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE c.agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT c.id, c.share_id, c.agent_id, c.session_id, c.context, c.decision, c.reason, c.created_at, c.metadata_json, s.body AS share_body, s.status AS share_status
        FROM innerlife_share_checks c
        LEFT JOIN innerlife_shares s ON s.id = c.share_id
        ${whereClause}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map(mapShareCheckRow);
    },

    async listInnerLifeShareChecksCompact(agentId = DEFAULT_AGENT_ID, limit = 10) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, share_id, agent_id, session_id, decision, substr(reason, 1, 600) AS reason, created_at
        FROM innerlife_share_checks
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        shareId: row.share_id,
        agentId: row.agent_id,
        sessionId: row.session_id,
        decision: row.decision,
        reason: row.reason || "",
        createdAt: row.created_at
      }));
    },

    async getInnerLifeShareCheck(id) {
      const checkId = String(id || "").trim();
      if (!checkId) throw new Error("InnerLife share check id is required.");
      const rows = await this.query(`
        SELECT c.id, c.share_id, c.agent_id, c.session_id, c.context, c.decision, c.reason, c.created_at, c.metadata_json, s.body AS share_body, s.status AS share_status
        FROM innerlife_share_checks c
        LEFT JOIN innerlife_shares s ON s.id = c.share_id
        WHERE c.id = ${sqlString(checkId)}
        LIMIT 1;
      `);
      return rows[0] ? mapShareCheckRow(rows[0]) : null;
    },

    async checkInnerLifeShareTiming(input = {}) {
      return shareTimingService(this, input);
    },

    async reviewInnerLifeShare(id, decision, reason = "") {
      const shareId = String(id || "").trim();
      if (!shareId) throw new Error("InnerLife share id is required.");
      const status = decision === "approve" || decision === "approved" ? "approved" : decision === "reject" || decision === "rejected" ? "rejected" : "";
      if (!status) throw new Error("InnerLife share decision must be approve or reject.");
      const reviewStatus = status === "approved" ? "reviewed" : "dismissed";
      await this.exec(`
        UPDATE innerlife_shares
        SET status = ${sqlString(status)},
            decision_reason = ${sqlString(String(reason || "").trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(shareId)} AND status = 'pending';

        UPDATE innerlife_thoughts
        SET review_status = ${sqlString(reviewStatus)}
        WHERE id = (
          SELECT thought_id
          FROM innerlife_shares
          WHERE id = ${sqlString(shareId)}
        );
      `);
      const rows = await this.query(`
        SELECT
          s.id,
          s.agent_id,
          s.thought_id,
          s.status,
          s.body,
          s.decision_reason,
          s.created_at,
          s.updated_at,
          (
            SELECT a.metadata_json
            FROM innerlife_share_actions a
            WHERE a.share_id = s.id AND a.action = 'used'
            ORDER BY a.created_at DESC, a.id DESC
            LIMIT 1
          ) AS delivery_metadata_json
        FROM innerlife_shares s
        WHERE s.id = ${sqlString(shareId)};
      `);
      if (!rows[0]) throw new Error("InnerLife share not found.");
      return mapShareRow(rows[0]);
    },

    async markInnerLifeShare(id, action, reason = "", agentId = "", deliveryEvidence = null) {
      const shareId = String(id || "").trim();
      if (!shareId) throw new Error("InnerLife share id is required.");
      const normalized = String(action || "").trim().toLowerCase();
      const statusByAction = {
        used: "used",
        deferred: "deferred",
        discarded: "discarded"
      };
      const nextStatus = statusByAction[normalized];
      if (!nextStatus) throw new Error("InnerLife share action must be used, deferred, or discarded.");
      const share = await this.getInnerLifeShare(shareId);
      const callerAgentId = String(agentId || "").trim();
      if (callerAgentId && share.agent_id !== callerAgentId) {
        throw new Error("InnerLife share belongs to another agent.");
      }
      if (!["pending", "approved", "deferred"].includes(share.status)) {
        const error = new Error(`InnerLife share cannot be marked ${normalized} from ${share.status}.`);
        error.code = "INNERLIFE_SHARE_INVALID_TRANSITION";
        error.currentShare = share;
        throw error;
      }
      const normalizedEvidence = normalized === "used" ? normalizeDeliveryEvidence(deliveryEvidence || {}) : null;
      const actionId = newId("inner_share_action");
      await this.exec(`
        UPDATE innerlife_shares
        SET status = ${sqlString(nextStatus)},
            decision_reason = ${sqlString(String(reason || "").trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(shareId)};

        INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, metadata_json)
        VALUES (
          ${sqlString(actionId)},
          ${sqlString(shareId)},
          ${sqlString(share.agent_id)},
          ${sqlString(normalized)},
          ${sqlString(String(reason || "").trim())},
          ${jsonSql(normalizedEvidence ? { deliveryEvidence: normalizedEvidence } : {})}
        );
      `);
      return {
        actionId,
        share: await this.getInnerLifeShare(shareId)
      };
    },

    async listInnerLifeShareActions(shareId = null, limit = 20, agentId = "all") {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const filters = [];
      if (shareId) filters.push(`share_id = ${sqlString(shareId)}`);
      if (agentId && agentId !== "all") filters.push(`agent_id = ${sqlString(agentId)}`);
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      return this.query(`
        SELECT id, share_id, agent_id, action, reason, created_at, metadata_json
        FROM innerlife_share_actions
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
    },

    async listInnerLifeShareActionSummaries(shareId = null, limit = 20, agentId = "all") {
      const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(limit), 10) || 20));
      const filters = [];
      if (shareId) filters.push(`share_id = ${sqlString(shareId)}`);
      if (agentId && agentId !== "all") filters.push(`agent_id = ${sqlString(agentId)}`);
      const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await this.query(`
        SELECT id, share_id, agent_id, action, substr(reason, 1, 320) AS reason, created_at
        FROM innerlife_share_actions
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        shareId: row.share_id,
        agentId: row.agent_id,
        action: row.action,
        reason: row.reason || "",
        createdAt: row.created_at
      }));
    },

    async getInnerLifeShare(id) {
      const shareId = String(id || "").trim();
      if (!shareId) throw new Error("InnerLife share id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at
        FROM innerlife_shares
        WHERE id = ${sqlString(shareId)};
      `);
      if (!rows[0]) throw new Error("InnerLife share not found.");
      return rows[0];
    },

    async applyInnerLifeShareToMemory(id) {
      const share = await this.getInnerLifeShare(id);
      if (share.status !== "approved") {
        throw new Error("Only approved InnerLife shares can be applied to Memory.");
      }
      const memory = await this.createMemory({
        title: "InnerLife approved output",
        body: share.body,
        labels: ["innerlife", "approved"]
      });
      await this.exec(`
        UPDATE innerlife_shares
        SET decision_reason = ${sqlString(`${share.decision_reason || ""}\nApplied to Memory: ${memory.id}`.trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(share.id)};
      `);
      return {
        share: await this.getInnerLifeShare(share.id),
        memory
      };
    },

    async applyInnerLifeShareToSharedLine(id) {
      const share = await this.getInnerLifeShare(id);
      if (share.status !== "approved") {
        throw new Error("Only approved InnerLife shares can be applied to Shared Line.");
      }
      await this.saveCurrentPosition({
        agentId: share.agent_id,
        summary: share.body,
        interpretationStatus: "draft",
        factsUsed: [share.id],
        source: "innerlife",
        confirmOverwrite: true
      });
      const sharedLine = await this.getResumePacket({ agentId: share.agent_id, lite: true });
      await this.exec(`
        UPDATE innerlife_shares
        SET decision_reason = ${sqlString(`${share.decision_reason || ""}\nApplied to Shared Line: ${sharedLine.currentPosition.positionId}`.trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(share.id)};
      `);
      return {
        share: await this.getInnerLifeShare(share.id),
        sharedLine
      };
    }
  };
}

module.exports = {
  createInnerLifeShareRepository
};
