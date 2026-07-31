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

  function mapAfterthoughtRow(row) {
    return {
      id: row.id,
      agentId: row.agent_id,
      source: row.source,
      body: row.body || "",
      status: row.status,
      createdAt: row.created_at,
      processedAt: row.processed_at,
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
          attempts: 0,
          retryState: "pending",
          retrySeconds: 0,
          nextRetryAt: null,
          lastAttemptAt: null,
          lastError: "",
          terminalAt: null,
          leaseToken: null,
          leaseStartedAt: null,
          leaseRecoveries: 0
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
      SET status = 'pending',
          processed_at = NULL,
          metadata_json = json_set(
            CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END,
            '$.lastLeaseToken', json_extract(metadata_json, '$.leaseToken'),
            '$.leaseToken', NULL,
            '$.leaseStartedAt', NULL,
            '$.lastLeaseRecoveredAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
            '$.leaseRecoveries', COALESCE(
              CAST(json_extract(metadata_json, '$.leaseRecoveries') AS INTEGER),
              0
            ) + 1
          )
      WHERE source = 'session_end_afterthought'
        AND status = 'processing'
        AND datetime(processed_at) < datetime('now', '-5 minutes');
    `);
    const rows = await database.query(`
      UPDATE innerlife_inbox
      SET status = 'processing',
          processed_at = CURRENT_TIMESTAMP,
          metadata_json = json_set(
            CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END,
            '$.leaseToken', lower(hex(randomblob(16))),
            '$.leaseStartedAt', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          )
      WHERE id IN (
        SELECT id
        FROM innerlife_inbox
        WHERE source = 'session_end_afterthought'
          AND status = 'pending'
          AND COALESCE(
            CASE
              WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.retryState')
              ELSE NULL
            END,
            'pending'
          ) != 'terminal'
          AND (
            CASE
              WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.nextRetryAt')
              ELSE NULL
            END IS NULL
            OR datetime(
              CASE
                WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.nextRetryAt')
                ELSE NULL
              END
            ) <= CURRENT_TIMESTAMP
          )
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
    const completedAt = new Date().toISOString();
    const leaseToken = String(metadata.leaseToken || "").trim();
    if (!leaseToken) throw new Error("InnerLife session afterthought completion requires an active lease token.");
    const completedMetadata = {
      ...metadata,
      attempts: Number(metadata.attempts || 0) + 1,
      completedAt,
      resultSource: generated.source,
      retryState: "succeeded",
      retrySeconds: 0,
      nextRetryAt: null,
      lastAttemptAt: completedAt,
      lastError: "",
      terminalAt: null,
      lastLeaseToken: leaseToken,
      leaseToken: null,
      leaseStartedAt: null,
      completedLeaseToken: leaseToken
    };
    const shareUpdateEnabled = Boolean(share && shareDecision);
    const nextShareStatus = shareDecision?.create ? (share?.status || "pending") : "discarded";
    const nextDecisionReason = shareDecision?.create
      ? (share?.decision_reason || "")
      : shareDecision
        ? `Automatic quality filter: ${shareDecision.reason}`
        : "";
    await database.exec(`
      BEGIN IMMEDIATE;

      UPDATE innerlife_inbox
      SET status = 'processed',
          processed_at = CURRENT_TIMESTAMP,
          metadata_json = ${jsonSql(completedMetadata)}
      WHERE id = ${sqlString(job.id)}
        AND status = 'processing'
        AND json_extract(metadata_json, '$.leaseToken') = ${sqlString(leaseToken)};

      UPDATE innerlife_thoughts
      SET body = ${sqlString(generated.body)}
      WHERE id = ${sqlString(metadata.thoughtId)}
        AND ${sqlString(shareUpdateEnabled ? "1" : "0")} = '1'
        AND EXISTS (
          SELECT 1
          FROM innerlife_inbox
          WHERE id = ${sqlString(job.id)}
            AND status = 'processed'
            AND json_extract(metadata_json, '$.completedLeaseToken') = ${sqlString(leaseToken)}
        );

      UPDATE innerlife_shares
      SET body = ${sqlString(generated.body)},
          status = ${sqlString(nextShareStatus)},
          decision_reason = ${sqlString(nextDecisionReason)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(metadata.shareId)}
        AND status IN ('pending', 'approved', 'deferred')
        AND ${sqlString(shareUpdateEnabled ? "1" : "0")} = '1'
        AND EXISTS (
          SELECT 1
          FROM innerlife_inbox
          WHERE id = ${sqlString(job.id)}
            AND status = 'processed'
            AND json_extract(metadata_json, '$.completedLeaseToken') = ${sqlString(leaseToken)}
        );

      COMMIT;
    `);
    const rows = await database.query(`
      SELECT metadata_json
      FROM innerlife_inbox
      WHERE id = ${sqlString(job.id)}
        AND status = 'processed'
      LIMIT 1;
    `);
    return {
      completed: parseJson(rows[0]?.metadata_json, {}).completedLeaseToken === leaseToken
    };
  }

  async function retryAfterthought(database, input) {
    const terminal = input.terminal === true;
    const attempts = Math.max(
      1,
      Number.parseInt(String(input.attempts || Number(input.metadata.attempts || 0) + 1), 10) || 1
    );
    const retrySeconds = terminal
      ? 0
      : Math.max(1, Number.parseInt(String(input.retrySeconds || 1), 10) || 1);
    const failedAt = String(input.failedAt || new Date().toISOString());
    const nextRetryAt = terminal ? null : String(input.nextRetryAt || "").trim() || null;
    const status = terminal ? "failed" : "pending";
    const leaseToken = String(input.metadata.leaseToken || "").trim();
    if (!leaseToken) throw new Error("InnerLife session afterthought retry requires an active lease token.");
    const rows = await database.query(`
      UPDATE innerlife_inbox
      SET status = ${sqlString(status)},
          processed_at = ${terminal ? "CURRENT_TIMESTAMP" : "NULL"},
          metadata_json = ${jsonSql({
            ...input.metadata,
            attempts,
            retryState: terminal ? "terminal" : "retrying",
            retrySeconds,
            nextRetryAt,
            lastAttemptAt: failedAt,
            lastError: input.error,
            terminalAt: terminal ? failedAt : null,
            lastLeaseToken: leaseToken,
            leaseToken: null,
            leaseStartedAt: null
          })}
      WHERE id = ${sqlString(input.job.id)}
        AND status = 'processing'
        AND json_extract(metadata_json, '$.leaseToken') = ${sqlString(leaseToken)}
      RETURNING id;
    `);
    return {
      updated: Boolean(rows[0]?.id)
    };
  }

  async function resolveAfterthoughtFailure(database, id, input = {}) {
    const jobId = String(id || "").trim();
    const agentId = String(input.agentId || input.agent_id || "").trim();
    const action = String(input.action || "").trim().toLowerCase();
    const reason = String(input.reason || "").trim();
    if (!jobId) throw new Error("InnerLife session afterthought job id is required.");
    if (!agentId) throw new Error("InnerLife session afterthought recovery requires an agent id.");
    if (!["retry", "acknowledge"].includes(action)) {
      throw new Error("InnerLife session afterthought action must be retry or acknowledge.");
    }
    if (action === "acknowledge" && !reason) {
      throw new Error("Acknowledging an InnerLife session afterthought failure requires a reason.");
    }

    const existingRows = await database.query(`
      SELECT id, agent_id, source, body, status, created_at, processed_at, metadata_json
      FROM innerlife_inbox
      WHERE id = ${sqlString(jobId)}
        AND agent_id = ${sqlString(agentId)}
        AND source = 'session_end_afterthought'
      LIMIT 1;
    `);
    const existing = existingRows[0] ? mapAfterthoughtRow(existingRows[0]) : null;
    if (!existing) throw new Error("InnerLife session afterthought failure was not found for this agent.");
    if (existing.status !== "failed" || existing.metadata.retryState !== "terminal") {
      throw new Error("Only a terminal InnerLife session afterthought failure can be resolved.");
    }

    const resolvedAt = new Date().toISOString();
    if (action === "retry") {
      const rows = await database.query(`
        UPDATE innerlife_inbox
        SET status = 'pending',
            processed_at = NULL,
            metadata_json = json_set(
              CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END,
              '$.lastTerminalAttempts', COALESCE(json_extract(metadata_json, '$.attempts'), 0),
              '$.lastTerminalError', COALESCE(json_extract(metadata_json, '$.lastError'), ''),
              '$.lastTerminalAt', json_extract(metadata_json, '$.terminalAt'),
              '$.attempts', 0,
              '$.retryState', 'pending',
              '$.retrySeconds', 0,
              '$.nextRetryAt', NULL,
              '$.lastAttemptAt', NULL,
              '$.lastError', '',
              '$.terminalAt', NULL,
              '$.requeuedAt', ${sqlString(resolvedAt)},
              '$.requeueReason', ${sqlString(reason)},
              '$.requeueCount', COALESCE(
                CAST(json_extract(metadata_json, '$.requeueCount') AS INTEGER),
                0
              ) + 1
            )
        WHERE id = ${sqlString(jobId)}
          AND agent_id = ${sqlString(agentId)}
          AND source = 'session_end_afterthought'
          AND status = 'failed'
          AND json_extract(metadata_json, '$.retryState') = 'terminal'
        RETURNING id, agent_id, source, body, status, created_at, processed_at, metadata_json;
      `);
      if (!rows[0]) {
        throw new Error("InnerLife session afterthought failure changed before it could be retried.");
      }
      return {
        action,
        job: mapAfterthoughtRow(rows[0])
      };
    }

    const acknowledgement = `Terminal afterthought failure acknowledged: ${reason}`;
    await database.exec(`
      BEGIN IMMEDIATE;

      UPDATE innerlife_inbox
      SET status = 'processed',
          processed_at = CURRENT_TIMESTAMP,
          metadata_json = json_set(
            CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END,
            '$.lastTerminalAttempts', COALESCE(json_extract(metadata_json, '$.attempts'), 0),
            '$.lastTerminalError', COALESCE(json_extract(metadata_json, '$.lastError'), ''),
            '$.lastTerminalAt', json_extract(metadata_json, '$.terminalAt'),
            '$.retryState', 'acknowledged',
            '$.retrySeconds', 0,
            '$.nextRetryAt', NULL,
            '$.lastError', '',
            '$.acknowledgedAt', ${sqlString(resolvedAt)},
            '$.acknowledgementReason', ${sqlString(reason)}
          )
      WHERE id = ${sqlString(jobId)}
        AND agent_id = ${sqlString(agentId)}
        AND source = 'session_end_afterthought'
        AND status = 'failed'
        AND json_extract(metadata_json, '$.retryState') = 'terminal';

      UPDATE innerlife_shares
      SET status = 'discarded',
          decision_reason = ${sqlString(acknowledgement)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = (
          SELECT json_extract(metadata_json, '$.shareId')
          FROM innerlife_inbox
          WHERE id = ${sqlString(jobId)}
            AND agent_id = ${sqlString(agentId)}
            AND status = 'processed'
            AND json_extract(metadata_json, '$.retryState') = 'acknowledged'
        )
        AND status = 'pending';

      UPDATE innerlife_thoughts
      SET review_status = 'dismissed'
      WHERE id = (
          SELECT json_extract(metadata_json, '$.thoughtId')
          FROM innerlife_inbox
          WHERE id = ${sqlString(jobId)}
            AND agent_id = ${sqlString(agentId)}
            AND status = 'processed'
            AND json_extract(metadata_json, '$.retryState') = 'acknowledged'
        )
        AND review_status = 'unreviewed';

      COMMIT;
    `);
    const rows = await database.query(`
      SELECT id, agent_id, source, body, status, created_at, processed_at, metadata_json
      FROM innerlife_inbox
      WHERE id = ${sqlString(jobId)}
        AND agent_id = ${sqlString(agentId)}
      LIMIT 1;
    `);
    const job = rows[0] ? mapAfterthoughtRow(rows[0]) : null;
    if (!job || job.status !== "processed" || job.metadata.retryState !== "acknowledged") {
      throw new Error("InnerLife session afterthought failure changed before it could be acknowledged.");
    }
    return {
      action,
      job
    };
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
    resolveAfterthoughtFailure,
    retryAfterthought
  });
}

module.exports = {
  createInnerLifeSessionStore
};
