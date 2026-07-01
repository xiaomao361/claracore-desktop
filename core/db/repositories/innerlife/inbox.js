function createInnerLifeInboxRepository(helpers) {
  const {
    jsonSql,
    newId,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  return {
    async listInnerLifeInbox(status = "pending", limit = 20, offset = 0) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const statusFilter = String(status || "pending").trim();
      const whereClause = statusFilter === "all" ? "" : `WHERE status = ${sqlString(statusFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, source, body, status, created_at, processed_at, metadata_json
        FROM innerlife_inbox
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        source: row.source,
        body: row.body,
        status: row.status,
        createdAt: row.created_at,
        processedAt: row.processed_at,
        metadata: parseJson(row.metadata_json, {})
      }));
    }
    ,

    async countInnerLifeInbox(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const status = String(input.status || "all").trim() || "all";
      const clauses = [];
      if (agentId !== "all") clauses.push(`agent_id = ${sqlString(agentId)}`);
      if (status !== "all") clauses.push(`status = ${sqlString(status)}`);
      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await this.query(`SELECT COUNT(*) AS count FROM innerlife_inbox ${whereClause};`);
      return rows[0]?.count || 0;
    }
    ,

    async listInnerLifeInboxPage(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const status = String(input.status || "all").trim() || "all";
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 10), 10) || 10, 50));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const clauses = [];
      if (agentId !== "all") clauses.push(`agent_id = ${sqlString(agentId)}`);
      if (status !== "all") clauses.push(`status = ${sqlString(status)}`);
      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = await this.query(`
        SELECT id, agent_id, source, body, status, created_at, processed_at, metadata_json
        FROM innerlife_inbox
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit} OFFSET ${offset};
      `);
      const total = await this.countInnerLifeInbox({ agentId, status });
      return {
        agentId,
        status,
        items: rows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          source: row.source,
          body: row.body,
          status: row.status,
          createdAt: row.created_at,
          processedAt: row.processed_at,
          metadata: parseJson(row.metadata_json, {})
        })),
        limit,
        offset,
        total,
        hasMore: offset + rows.length < total
      };
    }
    ,
    
    async submitInnerLifeInbox(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const body = String(input.body || "").trim();
      if (!body) throw new Error("InnerLife inbox body is required.");
      const source = String(input.source || "desktop").trim() || "desktop";
      const id = newId("inner_inbox");
      await this.exec(`
        INSERT INTO innerlife_inbox (id, agent_id, source, body, status, metadata_json)
        VALUES (${sqlString(id)}, ${sqlString(profile.agent_id)}, ${sqlString(source)}, ${sqlString(body)}, 'pending', ${jsonSql(input.metadata || {})});
      `);
      return (await this.listInnerLifeInbox("all", 100)).find((item) => item.id === id);
    }
    ,
    

  };
}

module.exports = {
  createInnerLifeInboxRepository
};
