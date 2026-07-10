const {
  IL_SYSTEM,
  compactSession,
  compactShare,
  generateOrTemplate
} = require("../../../innerlife/policy");

function createInnerLifeSessionRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    newId,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  function mapSessionRow(row) {
    return {
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id,
      host: row.host,
      externalSessionId: row.external_session_id,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      briefing: parseJson(row.briefing_json, {}),
      summary: row.summary || "",
      metadata: parseJson(row.metadata_json, {})
    };
  }

  return {
    async countInnerLifeSessions(agentId = "all") {
      const agentFilter = String(agentId || "all").trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT COUNT(*) AS count
        FROM innerlife_sessions
        ${whereClause};
      `);
      return rows[0]?.count || 0;
    },

    async listInnerLifeSessions(agentId = DEFAULT_AGENT_ID, limit = 20, offset = 0) {
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json
        FROM innerlife_sessions
        ${whereClause}
        ORDER BY started_at DESC, id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map(mapSessionRow);
    },

    async getInnerLifeSession(id) {
      const sessionId = String(id || "").trim();
      if (!sessionId) throw new Error("InnerLife session id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json
        FROM innerlife_sessions
        WHERE id = ${sqlString(sessionId)}
        LIMIT 1;
      `);
      return rows[0] ? mapSessionRow(rows[0]) : null;
    },

    async listInnerLifeSessionsPage(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 10), 10) || 10, 50));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const [items, total] = await Promise.all([
        this.listInnerLifeSessions(agentId, limit, offset),
        this.countInnerLifeSessions(agentId)
      ]);
      return {
        agentId,
        items,
        limit,
        offset,
        total,
        hasMore: offset + items.length < total
      };
    },

    async startInnerLifeSession(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const userId = String(input.userId || "local-user").trim() || "local-user";
      const host = String(input.host || "desktop").trim() || "desktop";
      const externalSessionId = String(input.externalSessionId || "").trim() || newId("external_session");
      const includeBriefing = Boolean(input.includeBriefing);
      const buildStartPacket = async (session, briefing, existing = false) => {
        const pendingShares = (await this.listInnerLifeShares("pending", 20)).filter((share) => share.agent_id === profile.agent_id);
        const approvedShares = (await this.listInnerLifeShares("approved", 20)).filter((share) => share.agent_id === profile.agent_id);
        const selected = pendingShares[0] || approvedShares[0] || null;
        const sharePlan = selected
          ? {
              selected: true,
              decision: "share_now",
              reason: selected.status === "pending"
                ? "A thought is waiting for a fitting moment to be shared."
                : "A previously approved thought is available for this agent.",
              delivery_style: "natural",
              share: compactShare(selected),
              suggested_opening: String(selected.body || "").split("\n").map((line) => line.trim()).filter(Boolean)[0]?.slice(0, 180) || ""
            }
          : {
              selected: false,
              decision: "wait",
              reason: "No thought is waiting to be shared for this agent.",
              delivery_style: null,
              share: null,
              suggested_opening: ""
            };
        return {
          session: compactSession(session),
          share_plan: sharePlan,
          briefing_ref: {
            tool: "innerlife_briefing",
            agentId: profile.agent_id,
            note: "Call innerlife_briefing only when the full context is needed."
          },
          instruction: existing
            ? "Existing session. Use share_plan first; fetch full briefing lazily only if needed."
            : "Use share_plan first. Do not mechanically read briefing aloud; fetch full briefing lazily only if needed.",
          ...(includeBriefing ? { briefing } : {})
        };
      };
      const existing = await this.query(`
        SELECT id
        FROM innerlife_sessions
        WHERE agent_id = ${sqlString(profile.agent_id)}
          AND external_session_id = ${sqlString(externalSessionId)}
        LIMIT 1;
      `);
      if (existing[0]?.id) {
        const session = await this.getInnerLifeSession(existing[0].id);
        const briefing = parseJson((await this.query(`SELECT briefing_json FROM innerlife_sessions WHERE id = ${sqlString(existing[0].id)};`))[0]?.briefing_json, {});
        return buildStartPacket(session, briefing, true);
      }
      const briefing = await this.getInnerLifeBriefing({
        agentId: profile.agent_id,
        lineId: input.lineId || input.line_id || ""
      });
      const id = newId("inner_session");
      await this.exec(`
        INSERT INTO innerlife_sessions (id, agent_id, user_id, host, external_session_id, status, briefing_json, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(profile.agent_id)},
          ${sqlString(userId)},
          ${sqlString(host)},
          ${sqlString(externalSessionId)},
          'active',
          ${jsonSql(briefing)},
          ${jsonSql({ startedBy: "desktop" })}
        );
      `);
      const session = await this.getInnerLifeSession(id);
      return buildStartPacket(session, briefing, false);
    },

    async endInnerLifeSession(sessionId, input = {}) {
      const requestedId = String(sessionId || "").trim();
      if (!requestedId) throw new Error("InnerLife session id is required.");
      const callerAgentId = String(input.agentId || "").trim();
      const rows = await this.query(`
        SELECT id, agent_id, status
        FROM innerlife_sessions
        WHERE id = ${sqlString(requestedId)}
        LIMIT 1;
      `);
      let session = rows[0];
      if (!session) {
        // Agents often pass the external session id they registered at start
        // instead of the internal id; accept it, preferring active sessions.
        const fallbackRows = await this.query(`
          SELECT id, agent_id, status
          FROM innerlife_sessions
          WHERE external_session_id = ${sqlString(requestedId)}
            AND (${sqlString(callerAgentId)} = '' OR agent_id = ${sqlString(callerAgentId)})
          ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, started_at DESC
          LIMIT 1;
        `);
        session = fallbackRows[0];
      }
      if (!session) throw new Error("InnerLife session not found.");
      const id = session.id;
      if (session.status === "ended") {
        // Ending the same session twice is documented as safe; do not write
        // duplicate events, thoughts, or shares.
        const { briefing: _repeatedBriefing, ...endedSession } = (await this.getInnerLifeSession(id)) || {};
        return {
          session: endedSession,
          repeated: true
        };
      }
      const summary = String(input.summary || input.transcript || "").trim();
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const shareId = newId("inner_share");
      const inboxId = newId("inner_inbox");
      const template = [
        "Session afterthought",
        "",
        `Session: ${id}`,
        `Summary: ${summary || "No summary provided."}`,
        "",
        "Review before sharing or applying this anywhere."
      ].join("\n");
      const generated = await generateOrTemplate(this, {
        tier: "light",
        system: IL_SYSTEM.session,
        prompt: template,
        template
      });
      const body = generated.body;
      await this.exec(`
        UPDATE innerlife_sessions
        SET status = 'ended',
            ended_at = CURRENT_TIMESTAMP,
            summary = ${sqlString(summary)}
        WHERE id = ${sqlString(id)};

        INSERT INTO innerlife_inbox (id, agent_id, source, body, status, metadata_json)
        VALUES (
          ${sqlString(inboxId)},
          ${sqlString(session.agent_id)},
          'session_end',
          ${sqlString(summary || "Session ended")},
          'processed',
          ${jsonSql({ sessionId: id })}
        );

        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(session.agent_id)},
          'session_end',
          ${sqlString(summary || "Session ended")},
          'processed',
          ${jsonSql({ sessionId: id })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        VALUES (${sqlString(shareId)}, ${sqlString(session.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)});
      `);
      const convergence = await this.convergeInnerLife({
        agentId: session.agent_id,
        sourceThoughtId: thoughtId,
        automated: true,
        reason: "session_end"
      });
      // Keep the acknowledgement small: agents only need the closed session,
      // the created ids, and the afterthought share. Full InnerLife state
      // belongs to innerlife_status / innerlife_briefing, not this response.
      const { briefing: _briefing, ...endedSession } = (await this.getInnerLifeSession(id)) || {};
      return {
        session: endedSession,
        inboxId,
        eventId,
        thoughtId,
        share: await this.getInnerLifeShare(shareId),
        converged: Boolean(convergence?.converged),
        convergenceReason: convergence?.reason || ""
      };
    }
  };
}

module.exports = {
  createInnerLifeSessionRepository
};
