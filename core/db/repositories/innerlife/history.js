function createInnerLifeHistoryRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    sqlString
  } = helpers;

  return {
    async getInnerLifeHistory(agentId = DEFAULT_AGENT_ID, limit = 20) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, kind AS type, body, status, created_at
        FROM innerlife_events
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        type: row.type,
        body: row.body,
        status: row.status,
        createdAt: row.created_at
      }));
    },

    async listInnerLifeExperiences(agentId = DEFAULT_AGENT_ID, limit = 20) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const agentWhereClause = agentFilter === "all" ? "" : `AND s.agent_id = ${sqlString(agentFilter)}`;
      const shareRows = await this.query(`
        SELECT t.id, t.body, t.review_status, t.created_at, s.agent_id, s.id AS share_id
        FROM innerlife_thoughts t
        JOIN innerlife_shares s ON s.thought_id = t.id
        WHERE s.status = 'used' ${agentWhereClause}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${safeLimit};
      `);
      const eventWhereClause = agentFilter === "all" ? "" : `AND agent_id = ${sqlString(agentFilter)}`;
      const eventRows = await this.query(`
        SELECT id, agent_id, kind, body, status, created_at
        FROM innerlife_events
        WHERE kind IN ('autonomous_experience', 'explore') ${eventWhereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      return [
        ...shareRows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          shareId: row.share_id,
          body: row.body,
          reviewStatus: row.review_status,
          createdAt: row.created_at,
          source: "share"
        })),
        ...eventRows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          shareId: "",
          body: row.body,
          reviewStatus: row.status,
          createdAt: row.created_at,
          source: row.kind
        }))
      ]
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, safeLimit);
    },

    async listInnerLifeSummaries(agentId = DEFAULT_AGENT_ID, limit = 10) {
      const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(limit), 10) || 10));
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all"
        ? "WHERE summary != ''"
        : `WHERE summary != '' AND agent_id = ${sqlString(agentFilter)}`;
      const digestRows = await this.query(`
        SELECT id, agent_id, mode, summary, created_at, completed_at
        FROM innerlife_digest_runs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      const eventWhereClause = agentFilter === "all" ? "" : `AND agent_id = ${sqlString(agentFilter)}`;
      const eventRows = await this.query(`
        SELECT id, agent_id, kind, body, created_at
        FROM innerlife_events
        WHERE (kind LIKE 'summary:%' OR kind IN ('converge', 'convergence_run')) ${eventWhereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      return [
        ...digestRows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          mode: row.mode,
          summary: row.summary,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          source: "digest"
        })),
        ...eventRows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          mode: row.kind,
          summary: row.body,
          createdAt: row.created_at,
          completedAt: row.created_at,
          source: "event"
        }))
      ]
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, safeLimit);
    },

    async listInnerLifeDigestSummaries(agentId = DEFAULT_AGENT_ID, limit = 10) {
      const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(limit), 10) || 10));
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all"
        ? "WHERE summary != ''"
        : `WHERE summary != '' AND agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, mode, summary, created_at, completed_at
        FROM innerlife_digest_runs
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        mode: row.mode,
        summary: row.summary,
        createdAt: row.created_at,
        completedAt: row.completed_at
      }));
    }
  };
}

module.exports = {
  createInnerLifeHistoryRepository
};
