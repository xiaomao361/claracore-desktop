function createInnerLifeShareRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    meaningfulTokens,
    newId,
    parseJson,
    resolveAgentIdentity,
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

  function uniqueTokens(tokens) {
    return [...new Set(tokens || [])];
  }

  function buildSharedLineTimingContext(resumePacket = {}) {
    const current = resumePacket.currentPosition || {};
    const sharedReality = resumePacket.sharedReality || {};
    const agentState = resumePacket.agentState || {};
    return [
      current.summary ? `Current position: ${current.summary}` : "",
      current.interpretationStatus ? `Interpretation status: ${current.interpretationStatus}` : "",
      sharedReality.realityLine ? `Reality line: ${sharedReality.realityLine}` : "",
      sharedReality.currentInterpretation ? `Current interpretation: ${sharedReality.currentInterpretation}` : "",
      sharedReality.confirmedGround ? `Confirmed ground: ${sharedReality.confirmedGround}` : "",
      sharedReality.provisionalRead ? `Provisional read: ${sharedReality.provisionalRead}` : "",
      sharedReality.boundaryNotes ? `Boundary notes: ${sharedReality.boundaryNotes}` : "",
      sharedReality.misreadRisks ? `Misread risks: ${sharedReality.misreadRisks}` : "",
      resumePacket.nextStep ? `Next step: ${resumePacket.nextStep}` : "",
      agentState.notes ? `Agent notes: ${agentState.notes}` : ""
    ].filter(Boolean).join("\n");
  }

  return {
    async listInnerLifeShares(status = "pending", limit = 20) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const statusFilter = String(status || "pending").trim();
      const whereClause = statusFilter === "all" ? "" : `WHERE s.status = ${sqlString(statusFilter)}`;
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
          t.review_status
        FROM innerlife_shares s
        LEFT JOIN innerlife_thoughts t ON t.id = s.thought_id
        ${whereClause}
        ORDER BY s.updated_at DESC, s.created_at DESC
        LIMIT ${safeLimit};
      `);
      return rows;
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
      const providedContext = String(input.context || "").trim();
      const sessionId = String(input.sessionId || "").trim() || null;
      const requestedShareId = String(input.shareId || "").trim();
      const requestedShare = requestedShareId ? await this.getInnerLifeShare(requestedShareId) : null;
      const hasExplicitAgent = Boolean(input?.agentId || input?.agent_id || input?.agent);
      const agentId = hasExplicitAgent ? resolveAgentIdentity(input || {}).id : requestedShare?.agent_id || resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const resumePacket = await this.getResumePacket({ agentId: profile.agent_id, lite: true });
      const sharedLineContext = buildSharedLineTimingContext(resumePacket);
      const context = providedContext || sharedLineContext;
      let share = requestedShare;
      if (!share) {
        const available = await this.query(`
          SELECT id
          FROM innerlife_shares
          WHERE agent_id = ${sqlString(profile.agent_id)}
            AND status IN ('approved', 'pending', 'deferred')
          ORDER BY
            CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
            updated_at DESC,
            created_at DESC
          LIMIT 1;
        `);
        if (available[0]?.id) {
          share = await this.getInnerLifeShare(available[0].id);
        }
      }
      if (!share) {
        const checkId = newId("inner_share_check");
        await this.exec(`
          INSERT INTO innerlife_share_checks (id, share_id, agent_id, session_id, context, decision, reason, metadata_json)
          VALUES (
            ${sqlString(checkId)},
            NULL,
            ${sqlString(profile.agent_id)},
            ${sessionId ? sqlString(sessionId) : "NULL"},
            ${sqlString(context)},
            'none',
            'No shareable InnerLife thought is available.',
            '{}'
          );
        `);
        return {
          check: await this.getInnerLifeShareCheck(checkId),
          share: null,
          snapshot: await this.getInnerLifeSnapshot()
        };
      }
      const explicitTokens = meaningfulTokens(providedContext);
      const lineTokens = meaningfulTokens(sharedLineContext);
      const contextTokens = meaningfulTokens([providedContext, sharedLineContext].filter(Boolean).join("\n"));
      const shareTokens = new Set(meaningfulTokens(share.body));
      const explicitOverlap = uniqueTokens(explicitTokens.filter((token) => shareTokens.has(token)));
      const lineOverlap = uniqueTokens(lineTokens.filter((token) => shareTokens.has(token)));
      const overlap = uniqueTokens(contextTokens.filter((token) => shareTokens.has(token)));
      const hasAsk = /\b(ask|asked|question|share|need|use|recall|remember)\b/i.test(providedContext) || /分享|需要|使用|记得|回忆|问题/u.test(providedContext);
      const hasConnection = hasAsk || explicitOverlap.length > 0 || lineOverlap.length > 0;
      let decision = "defer";
      let reason = "Context is not specific enough yet.";
      if (!context) {
        decision = "defer";
        reason = "No current context or Shared Line context was available.";
      } else if (share.status === "pending" && hasConnection) {
        decision = "review_first";
        reason = overlap.length > 0
          ? `Pending share connects to the current line: ${overlap.slice(0, 5).join(", ")}. Review before use.`
          : "Pending share may fit the current context, but it still requires review before use.";
      } else if (share.status === "approved" && hasConnection) {
        decision = "use";
        reason = overlap.length > 0 ? `Approved share connects to the current line: ${overlap.slice(0, 5).join(", ")}.` : "Approved share fits the current context.";
      } else if (share.status === "deferred") {
        decision = hasConnection ? "use" : "defer";
        reason = decision === "use" ? "Deferred share now matches the current context." : "Deferred share still does not match the current context.";
      }
      const checkId = newId("inner_share_check");
      await this.exec(`
        INSERT INTO innerlife_share_checks (id, share_id, agent_id, session_id, context, decision, reason, metadata_json)
        VALUES (
          ${sqlString(checkId)},
          ${sqlString(share.id)},
          ${sqlString(profile.agent_id)},
          ${sessionId ? sqlString(sessionId) : "NULL"},
          ${sqlString(context)},
          ${sqlString(decision)},
          ${sqlString(reason)},
          ${jsonSql({
            overlap,
            explicitOverlap,
            lineOverlap,
            hasAsk,
            contextSource: providedContext ? "provided+shared_line" : "shared_line",
            lineId: resumePacket.lineId || "",
            positionId: resumePacket.currentPosition?.positionId || ""
          })}
        );
      `);
      return {
        check: await this.getInnerLifeShareCheck(checkId),
        share,
        snapshot: await this.getInnerLifeSnapshot()
      };
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
        SELECT id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at
        FROM innerlife_shares
        WHERE id = ${sqlString(shareId)};
      `);
      if (!rows[0]) throw new Error("InnerLife share not found.");
      return rows[0];
    },

    async markInnerLifeShare(id, action, reason = "") {
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
      if (!["pending", "approved", "deferred"].includes(share.status)) {
        throw new Error(`InnerLife share cannot be marked ${normalized} from ${share.status}.`);
      }
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
          '{}'
        );
      `);
      return {
        actionId,
        share: await this.getInnerLifeShare(shareId)
      };
    },

    async listInnerLifeShareActions(shareId = null, limit = 20) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const whereClause = shareId ? `WHERE share_id = ${sqlString(shareId)}` : "";
      return this.query(`
        SELECT id, share_id, agent_id, action, reason, created_at, metadata_json
        FROM innerlife_share_actions
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
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
