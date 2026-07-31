function createInnerLifeDigestRepository(helpers, dependencies = {}) {
  const { digestRunService, digestRunStore } = dependencies;
  if (typeof digestRunService !== "function" || typeof digestRunStore?.prune !== "function") {
    throw new Error("InnerLife digest repository requires digestRunService and digestRunStore.prune.");
  }
  const {
    DEFAULT_AGENT_ID,
    parseJson,
    sqlString
  } = helpers;

  function mapDigestRunRow(row) {
    return {
      id: row.id,
      agentId: row.agent_id,
      mode: row.mode,
      status: row.status,
      input: parseJson(row.input_json, {}),
      summary: row.summary || "",
      createdAt: row.created_at,
      completedAt: row.completed_at,
      metadata: parseJson(row.metadata_json, {})
    };
  }

  return {
    async listInnerLifeDigestRuns(agentId = DEFAULT_AGENT_ID, limit = 10, offset = 0) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json
        FROM innerlife_digest_runs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map(mapDigestRunRow);
    },

    async listInnerLifeDigestRunsCompact(agentId = DEFAULT_AGENT_ID, limit = 10, offset = 0) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, mode, status, substr(summary, 1, 1000) AS summary, created_at, completed_at
        FROM innerlife_digest_runs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        mode: row.mode,
        status: row.status,
        summary: row.summary || "",
        createdAt: row.created_at,
        completedAt: row.completed_at
      }));
    },

    async getInnerLifeDigestRun(id) {
      const digestId = String(id || "").trim();
      if (!digestId) throw new Error("InnerLife digest run id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json
        FROM innerlife_digest_runs
        WHERE id = ${sqlString(digestId)}
        LIMIT 1;
      `);
      return rows[0] ? mapDigestRunRow(rows[0]) : null;
    },

    async countInnerLifeDigestRuns(agentId = "all") {
      const agentFilter = String(agentId || "all").trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`SELECT COUNT(*) AS count FROM innerlife_digest_runs ${whereClause};`);
      return rows[0]?.count || 0;
    },

    async listInnerLifeDigestRunsPage(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 10), 10) || 10, 50));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const [items, total] = await Promise.all([
        this.listInnerLifeDigestRunsCompact(agentId, limit, offset),
        this.countInnerLifeDigestRuns(agentId)
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

    async runInnerLifeDigest(input = {}) {
      return digestRunService(this, input);
    },

    async pruneInnerLifeDigestRuns(agentId, keep) {
      return digestRunStore.prune(this, agentId, keep);
    },
  };
}

module.exports = {
  createInnerLifeDigestRepository
};
