const {
  IL_SYSTEM,
  compactSession,
  compactShare,
  generateOrTemplate,
  isNoShareInnerLifeOutput
} = require("../../../innerlife/policy");

function normalizeSessionSummary(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    let serialized;
    try {
      serialized = JSON.stringify(value, null, 2);
    } catch (_error) {
      throw new Error("InnerLife session summary must be JSON-serializable.");
    }
    if (typeof serialized !== "string") {
      throw new Error("InnerLife session summary must be JSON-serializable.");
    }
    return serialized.trim();
  }
  return String(value || "").trim();
}

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

    async listInnerLifeSessionsCompact(agentId = DEFAULT_AGENT_ID, limit = 20, offset = 0) {
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, user_id, host, external_session_id, status, started_at, ended_at,
               substr(summary, 1, 600) AS summary
        FROM innerlife_sessions
        ${whereClause}
        ORDER BY started_at DESC, id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        userId: row.user_id,
        host: row.host,
        externalSessionId: row.external_session_id,
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        summary: row.summary || ""
      }));
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
        this.listInnerLifeSessionsCompact(agentId, limit, offset),
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
      if (session && callerAgentId && session.agent_id !== callerAgentId) {
        session = null;
      }
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
      if (!session) {
        // The SessionEnd hook is a fail-open safety net that fires for every
        // Claude session exit, including sessions whose session_start never
        // registered a row (e.g. the Desktop was unavailable or the start
        // request was interrupted). For that path a
        // missing session means "nothing to close", not an error — return a
        // benign no-op so it does not surface as a red gateway trace. Explicit
        // model calls (which pass a summary, not the hook transcript) still get
        // a hard error so a mistyped session id stays visible.
        const legacyHookFallback = String(input.transcript || "").startsWith("[SessionEnd hook");
        if (input.bestEffort === true || legacyHookFallback) {
          return { session: null, missing: true, repeated: false };
        }
        throw new Error("InnerLife session not found.");
      }
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
      const summarySource = input.summary || input.transcript || "";
      const summary = normalizeSessionSummary(summarySource);
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const shareId = newId("inner_share");
      const inboxId = newId("inner_inbox");
      if (!summary) {
        await this.exec(`
          UPDATE innerlife_sessions
          SET status = 'ended',
              ended_at = CURRENT_TIMESTAMP,
              summary = ''
          WHERE id = ${sqlString(id)};

          INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
          VALUES (
            ${sqlString(eventId)},
            ${sqlString(session.agent_id)},
            'session_end',
            'Session ended without a summary.',
            'processed',
            ${jsonSql({ sessionId: id, shareDecision: { create: false, reason: "empty_session_summary" } })}
          );
        `);
        const { briefing: _briefing, ...endedSession } = (await this.getInnerLifeSession(id)) || {};
        return {
          session: endedSession,
          inboxId: null,
          eventId,
          thoughtId: null,
          share: null,
          shareDecision: { create: false, reason: "empty_session_summary" },
          afterthoughtJob: null,
          converged: false,
          convergenceReason: "empty_session_summary"
        };
      }
      const template = [
        "Session afterthought",
        "",
        `Session: ${id}`,
        `Summary: ${summary || "No summary provided."}`,
        "",
        "Review before sharing or applying this anywhere."
      ].join("\n");
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
          'session_end_afterthought',
          ${sqlString(summary || "Session ended")},
          'pending',
          ${jsonSql({
            jobType: "session_afterthought",
            sessionId: id,
            eventId,
            thoughtId,
            shareId,
            template,
            attempts: 0
          })}
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
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(template)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        VALUES (${sqlString(shareId)}, ${sqlString(session.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(template)});
      `);
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
        afterthoughtJob: { id: inboxId, status: "pending" },
        converged: false,
        convergenceReason: "queued"
      };
    },

    async processPendingSessionAfterthoughts(limit = 5) {
      const safeLimit = Math.max(1, Math.min(20, Number.parseInt(String(limit), 10) || 5));
      await this.exec(`
        UPDATE innerlife_inbox
        SET status = 'pending', processed_at = NULL
        WHERE source = 'session_end_afterthought'
          AND status = 'processing'
          AND datetime(processed_at) < datetime('now', '-5 minutes');
      `);
      const rows = await this.query(`
        UPDATE innerlife_inbox
        SET status = 'processing', processed_at = CURRENT_TIMESTAMP
        WHERE id IN (
          SELECT id
          FROM innerlife_inbox
          WHERE source = 'session_end_afterthought'
            AND status = 'pending'
          ORDER BY created_at ASC, id ASC
          LIMIT ${sqlString(safeLimit)}
        )
          AND status = 'pending'
        RETURNING id, agent_id, body, metadata_json;
      `);
      const results = [];
      for (const row of rows) {
        const metadata = parseJson(row.metadata_json, {});
        const template = String(metadata.template || row.body || "Session ended");
        try {
          const share = await this.getInnerLifeShare(metadata.shareId);
          let generated = { body: share?.body || template, source: "skipped" };
          if (share && ["pending", "approved", "deferred"].includes(share.status)) {
            generated = await generateOrTemplate(this, {
              tier: "light",
              system: IL_SYSTEM.session,
              prompt: template,
              template
            });
            const noShareOutput = isNoShareInnerLifeOutput(generated.body);
            const duplicate = noShareOutput
              ? null
              : await this.findSimilarInnerLifeShare(row.agent_id, generated.body, { excludeId: metadata.shareId });
            const shareDecision = noShareOutput
              ? { create: false, reason: "model_no_share" }
              : duplicate
                ? { create: false, reason: "similar_share_exists", duplicateOf: duplicate.id, similarity: duplicate.similarity }
                : { create: true, reason: "distinct_shareable_thought" };
            await this.exec(`
              UPDATE innerlife_thoughts
              SET body = ${sqlString(generated.body)}
              WHERE id = ${sqlString(metadata.thoughtId)};

              UPDATE innerlife_shares
              SET body = ${sqlString(generated.body)},
                  status = ${sqlString(shareDecision.create ? share.status : "discarded")},
                  decision_reason = ${sqlString(shareDecision.create ? (share.decision_reason || "") : `Automatic quality filter: ${shareDecision.reason}`)},
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ${sqlString(metadata.shareId)}
                AND status IN ('pending', 'approved', 'deferred');
            `);
            metadata.shareDecision = shareDecision;
          }
          await this.exec(`
            UPDATE innerlife_inbox
            SET status = 'processed',
                processed_at = CURRENT_TIMESTAMP,
                metadata_json = ${jsonSql({
                  ...metadata,
                  attempts: Number(metadata.attempts || 0) + 1,
                  completedAt: new Date().toISOString(),
                  resultSource: generated.source
                })}
            WHERE id = ${sqlString(row.id)}
              AND status = 'processing';
          `);
          const convergence = metadata.shareDecision?.create === false
            ? null
            : await this.convergeInnerLife({
                agentId: row.agent_id,
                sourceThoughtId: metadata.thoughtId,
                automated: true,
                reason: "session_end"
              });
          results.push({
            id: row.id,
            ok: true,
            shareId: metadata.shareId,
            source: generated.source,
            converged: Boolean(convergence?.converged)
          });
        } catch (error) {
          await this.exec(`
            UPDATE innerlife_inbox
            SET status = 'pending',
                processed_at = NULL,
                metadata_json = ${jsonSql({
              ...metadata,
              attempts: Number(metadata.attempts || 0) + 1,
              lastAttemptAt: new Date().toISOString(),
              lastError: error.message || String(error)
            })}
            WHERE id = ${sqlString(row.id)};
          `);
          results.push({ id: row.id, ok: false, error: error.message || String(error) });
        }
      }
      return { processed: results.filter((item) => item.ok).length, results };
    }
  };
}

module.exports = {
  createInnerLifeSessionRepository
};
