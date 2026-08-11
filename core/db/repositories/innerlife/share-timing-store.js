function createInnerLifeShareTimingStore(helpers) {
  const {
    jsonSql,
    sqlString
  } = helpers;

  async function findAvailableShareId(database, agentId) {
    const rows = await database.query(`
      SELECT id
      FROM innerlife_shares
      WHERE agent_id = ${sqlString(agentId)}
        AND status IN ('approved', 'pending', 'deferred')
      ORDER BY
        CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        updated_at DESC,
        created_at DESC
      LIMIT 1;
    `);
    return rows[0]?.id || "";
  }

  async function recordCheck(database, input) {
    const requestedSessionId = String(input.sessionId || "").trim();
    let sessionId = "";
    if (requestedSessionId) {
      const sessions = await database.query(`
        SELECT id
        FROM innerlife_sessions
        WHERE agent_id = ${sqlString(input.agentId)}
          AND (
            id = ${sqlString(requestedSessionId)}
            OR external_session_id = ${sqlString(requestedSessionId)}
          )
        ORDER BY CASE WHEN id = ${sqlString(requestedSessionId)} THEN 0 ELSE 1 END
        LIMIT 1;
      `);
      sessionId = sessions[0]?.id || "";
    }
    await database.exec(`
      INSERT INTO innerlife_share_checks (id, share_id, agent_id, session_id, context, decision, reason, metadata_json)
      VALUES (
        ${sqlString(input.id)},
        ${input.shareId ? sqlString(input.shareId) : "NULL"},
        ${sqlString(input.agentId)},
        ${sessionId ? sqlString(sessionId) : "NULL"},
        ${sqlString(input.context)},
        ${sqlString(input.decision)},
        ${sqlString(input.reason)},
        ${jsonSql(input.metadata)}
      );
    `);
  }

  return Object.freeze({
    findAvailableShareId,
    recordCheck
  });
}

module.exports = {
  createInnerLifeShareTimingStore
};
