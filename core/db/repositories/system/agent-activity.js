function createAgentActivityRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    parseJson,
    sqlString
  } = helpers;

  return {
    async getAgentActivitySummary(input = {}) {
      await this.ensureGatewayTraceCompatibility();
      const now = input.now instanceof Date ? input.now : new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfYesterday = new Date(startOfToday);
      startOfYesterday.setDate(startOfYesterday.getDate() - 1);
      const startOfTomorrow = new Date(startOfToday);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
      const startOfSevenDays = new Date(now);
      startOfSevenDays.setDate(startOfSevenDays.getDate() - 7);
      const startOfThirtyDays = new Date(now);
      startOfThirtyDays.setDate(startOfThirtyDays.getDate() - 30);
      const windows = {
        yesterday: { start: startOfYesterday, end: startOfToday },
        today: { start: startOfToday, end: startOfTomorrow },
        "7d": { start: startOfSevenDays, end: null },
        "30d": { start: startOfThirtyDays, end: null }
      };

      function sqlDate(date) {
        return date.toISOString();
      }

      function timeClause(column, window) {
        const start = sqlString(sqlDate(window.start));
        const end = window.end ? sqlString(sqlDate(window.end)) : null;
        return `julianday(${column}) >= julianday(${start})${end ? ` AND julianday(${column}) < julianday(${end})` : ""}`;
      }

      function normalizeAgentLabel(label = "") {
        const value = String(label || "").trim();
        if (value.startsWith("agent-id:")) return value.slice("agent-id:".length);
        if (value.startsWith("agent:")) return value.slice("agent:".length);
        return "";
      }

      async function rowsForPeriod(window) {
        const memoryTimeClause = timeClause("m.created_at", window);
        const linkTimeClause = timeClause("k.created_at", window);
        const shareTimeClause = timeClause("a.created_at", window);
        const historyTimeClause = timeClause("h.created_at", window);
        const traceTimeClause = timeClause("created_at", window);
        const [memories, links, shares, lineUpdates, gatewayCalls] = await Promise.all([
          this.query(`
            SELECT m.id AS id, l.label AS label
            FROM memories m
            JOIN memory_labels l ON l.memory_id = m.id
            WHERE m.status = 'active'
              AND (l.label LIKE 'agent-id:%' OR l.label LIKE 'agent:%')
              AND ${memoryTimeClause}
          `),
          this.query(`
            SELECT k.id AS id, labels.label AS label
            FROM memory_links k
            JOIN (
              SELECT memory_id, label FROM memory_labels WHERE label LIKE 'agent-id:%' OR label LIKE 'agent:%'
            ) labels ON labels.memory_id = k.from_memory_id OR labels.memory_id = k.to_memory_id
            WHERE ${linkTimeClause}
          `),
          this.query(`
            SELECT s.id AS share_id, s.agent_id AS agent_id, a.metadata_json AS metadata_json
            FROM innerlife_share_actions a
            JOIN innerlife_shares s ON s.id = a.share_id
            WHERE a.action = 'used'
              AND ${shareTimeClause};
          `),
          this.query(`
            SELECT l.agent_id AS agent_id, COUNT(h.id) AS count
            FROM continuity_position_history h
            JOIN continuity_lines l ON l.id = h.line_id
            WHERE ${historyTimeClause}
            GROUP BY l.agent_id;
          `),
          this.query(`
            SELECT agent_id AS agent_id, COUNT(*) AS count
            FROM gateway_traces
            WHERE ${traceTimeClause}
            GROUP BY agent_id;
          `)
        ]);

        const agents = new Map();
        function ensure(agentId) {
          const id = String(agentId || "").trim() || DEFAULT_AGENT_ID;
          if (!agents.has(id)) {
            agents.set(id, {
              agentId: id,
              newMemories: 0,
              formedConnections: 0,
              confirmedShares: 0,
              sharedLineUpdates: 0,
              gatewayCalls: 0
            });
          }
          return agents.get(id);
        }
        function addUnique(rows, metric) {
          const seen = new Set();
          for (const row of rows) {
            const agentId = normalizeAgentLabel(row.label);
            if (!agentId || !row.id) continue;
            const key = `${agentId}:${row.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            ensure(agentId)[metric] += 1;
          }
        }
        addUnique(memories, "newMemories");
        addUnique(links, "formedConnections");
        const confirmedShareIds = new Set();
        for (const row of shares) {
          const evidence = parseJson(row.metadata_json, {}).deliveryEvidence || {};
          if (!evidence.conversationId || !evidence.responseExcerpt || !evidence.sharedAt) continue;
          const key = `${row.agent_id}:${row.share_id}`;
          if (confirmedShareIds.has(key)) continue;
          confirmedShareIds.add(key);
          ensure(row.agent_id).confirmedShares += 1;
        }
        for (const row of lineUpdates) ensure(row.agent_id).sharedLineUpdates += Number(row.count || 0);
        for (const row of gatewayCalls) ensure(row.agent_id).gatewayCalls += Number(row.count || 0);
        return Array.from(agents.values())
          .filter((agent) =>
            agent.newMemories || agent.formedConnections || agent.confirmedShares || agent.sharedLineUpdates || agent.gatewayCalls
          )
          .sort((left, right) => {
            const leftTotal = left.newMemories + left.formedConnections + left.confirmedShares + left.sharedLineUpdates + left.gatewayCalls;
            const rightTotal = right.newMemories + right.formedConnections + right.confirmedShares + right.sharedLineUpdates + right.gatewayCalls;
            return rightTotal - leftTotal || left.agentId.localeCompare(right.agentId);
          });
      }

      const periods = {};
      for (const [key, window] of Object.entries(windows)) {
        periods[key] = {
          start: window.start.toISOString(),
          end: window.end ? window.end.toISOString() : now.toISOString(),
          agents: await rowsForPeriod.call(this, window)
        };
      }
      return {
        generatedAt: now.toISOString(),
        periods
      };
    }
  };
}

module.exports = {
  createAgentActivityRepository
};
