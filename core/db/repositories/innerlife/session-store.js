function createInnerLifeSessionStore(helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    parseJson,
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

  async function count(database, agentId = "all") {
    const agentFilter = String(agentId || "all").trim();
    const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
    const rows = await database.query(`
      SELECT COUNT(*) AS count
      FROM innerlife_sessions
      ${whereClause};
    `);
    return rows[0]?.count || 0;
  }

  async function list(database, agentId = DEFAULT_AGENT_ID, limit = 20, offset = 0) {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
    const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
    const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
    const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
    const rows = await database.query(`
      SELECT id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json
      FROM innerlife_sessions
      ${whereClause}
      ORDER BY started_at DESC, id DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset};
    `);
    return rows.map(mapSessionRow);
  }

  async function listCompact(database, agentId = DEFAULT_AGENT_ID, limit = 20, offset = 0) {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
    const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
    const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
    const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
    const rows = await database.query(`
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
  }

  async function get(database, id) {
    const sessionId = String(id || "").trim();
    if (!sessionId) throw new Error("InnerLife session id is required.");
    const rows = await database.query(`
      SELECT id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json
      FROM innerlife_sessions
      WHERE id = ${sqlString(sessionId)}
      LIMIT 1;
    `);
    return rows[0] ? mapSessionRow(rows[0]) : null;
  }

  async function findExisting(database, input) {
    const rows = await database.query(`
      SELECT id
      FROM innerlife_sessions
      WHERE agent_id = ${sqlString(input.agentId)}
        AND external_session_id = ${sqlString(input.externalSessionId)}
      LIMIT 1;
    `);
    return rows[0]?.id ? get(database, rows[0].id) : null;
  }

  async function create(database, input) {
    await database.exec(`
      INSERT INTO innerlife_sessions (id, agent_id, user_id, host, external_session_id, status, briefing_json, metadata_json)
      VALUES (
        ${sqlString(input.id)},
        ${sqlString(input.agentId)},
        ${sqlString(input.userId)},
        ${sqlString(input.host)},
        ${sqlString(input.externalSessionId)},
        'active',
        ${jsonSql(input.briefing)},
        ${jsonSql({ startedBy: "desktop" })}
      );
    `);
    return get(database, input.id);
  }

  async function findForEnd(database, input) {
    const rows = await database.query(`
      SELECT id
      FROM innerlife_sessions
      WHERE id = ${sqlString(input.requestedId)}
        AND (${sqlString(input.callerAgentId)} = '' OR agent_id = ${sqlString(input.callerAgentId)})
      LIMIT 1;
    `);
    let id = rows[0]?.id;
    if (!id) {
      const fallbackRows = await database.query(`
        SELECT id
        FROM innerlife_sessions
        WHERE external_session_id = ${sqlString(input.requestedId)}
          AND (${sqlString(input.callerAgentId)} = '' OR agent_id = ${sqlString(input.callerAgentId)})
        ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, started_at DESC
        LIMIT 1;
      `);
      id = fallbackRows[0]?.id;
    }
    return id ? get(database, id) : null;
  }

  async function close(database, input) {
    const { session, summary, eventId } = input;
    if (!summary) {
      await database.exec(`
        UPDATE innerlife_sessions
        SET status = 'ended',
            ended_at = CURRENT_TIMESTAMP,
            summary = ''
        WHERE id = ${sqlString(session.id)};

        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(session.agentId)},
          'session_end',
          'Session ended without a summary.',
          'processed',
          ${jsonSql({
            sessionId: session.id,
            shareDecision: { create: false, reason: "empty_session_summary" }
          })}
        );
      `);
      return get(database, session.id);
    }

    await database.exec(`
      UPDATE innerlife_sessions
      SET status = 'ended',
          ended_at = CURRENT_TIMESTAMP,
          summary = ${sqlString(summary)}
      WHERE id = ${sqlString(session.id)};

      INSERT INTO innerlife_inbox (id, agent_id, source, body, status, metadata_json)
      VALUES (
        ${sqlString(input.inboxId)},
        ${sqlString(session.agentId)},
        'session_end_afterthought',
        ${sqlString(summary || "Session ended")},
        'pending',
        ${jsonSql({
          jobType: "session_afterthought",
          sessionId: session.id,
          eventId,
          thoughtId: input.thoughtId,
          shareId: input.shareId,
          template: input.template,
          attempts: 0
        })}
      );

      INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
      VALUES (
        ${sqlString(eventId)},
        ${sqlString(session.agentId)},
        'session_end',
        ${sqlString(summary || "Session ended")},
        'processed',
        ${jsonSql({ sessionId: session.id })}
      );

      INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
      VALUES (${sqlString(input.thoughtId)}, ${sqlString(eventId)}, ${sqlString(input.template)}, 'unreviewed');

      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
      VALUES (${sqlString(input.shareId)}, ${sqlString(session.agentId)}, ${sqlString(input.thoughtId)}, 'pending', ${sqlString(input.template)});
    `);
    return get(database, session.id);
  }

  async function claimAfterthoughts(database, limit) {
    await database.exec(`
      UPDATE innerlife_inbox
      SET status = 'pending', processed_at = NULL
      WHERE source = 'session_end_afterthought'
        AND status = 'processing'
        AND datetime(processed_at) < datetime('now', '-5 minutes');
    `);
    const rows = await database.query(`
      UPDATE innerlife_inbox
      SET status = 'processing', processed_at = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT id
        FROM innerlife_inbox
        WHERE source = 'session_end_afterthought'
          AND status = 'pending'
        ORDER BY created_at ASC, id ASC
        LIMIT ${sqlString(limit)}
      )
        AND status = 'pending'
      RETURNING id, agent_id, body, metadata_json;
    `);
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      body: row.body || "",
      metadata: parseJson(row.metadata_json, {})
    }));
  }

  async function completeAfterthought(database, input) {
    const { generated, job, metadata, share, shareDecision } = input;
    if (share && shareDecision) {
      await database.exec(`
        UPDATE innerlife_thoughts
        SET body = ${sqlString(generated.body)}
        WHERE id = ${sqlString(metadata.thoughtId)};

        UPDATE innerlife_shares
        SET body = ${sqlString(generated.body)},
            status = ${sqlString(shareDecision.create ? share.status : "discarded")},
            decision_reason = ${sqlString(
              shareDecision.create
                ? (share.decision_reason || "")
                : `Automatic quality filter: ${shareDecision.reason}`
            )},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(metadata.shareId)}
          AND status IN ('pending', 'approved', 'deferred');
      `);
    }
    await database.exec(`
      UPDATE innerlife_inbox
      SET status = 'processed',
          processed_at = CURRENT_TIMESTAMP,
          metadata_json = ${jsonSql({
            ...metadata,
            attempts: Number(metadata.attempts || 0) + 1,
            completedAt: new Date().toISOString(),
            resultSource: generated.source
          })}
      WHERE id = ${sqlString(job.id)}
        AND status = 'processing';
    `);
  }

  async function retryAfterthought(database, input) {
    await database.exec(`
      UPDATE innerlife_inbox
      SET status = 'pending',
          processed_at = NULL,
          metadata_json = ${jsonSql({
            ...input.metadata,
            attempts: Number(input.metadata.attempts || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: input.error
          })}
      WHERE id = ${sqlString(input.job.id)};
    `);
  }

  return Object.freeze({
    claimAfterthoughts,
    close,
    completeAfterthought,
    count,
    create,
    findExisting,
    findForEnd,
    get,
    list,
    listCompact,
    retryAfterthought
  });
}

module.exports = {
  createInnerLifeSessionStore
};
