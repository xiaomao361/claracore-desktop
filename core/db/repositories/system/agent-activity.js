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
      // Yesterday/today are half-open calendar days. The rolling periods
      // intentionally keep their existing lower-bound-only contract.
      const periodSpecs = [
        { key: "yesterday", flag: "in_yesterday", count: "yesterday_count", start: startOfYesterday, end: startOfToday },
        { key: "today", flag: "in_today", count: "today_count", start: startOfToday, end: startOfTomorrow },
        { key: "7d", flag: "in_7d", count: "seven_days_count", start: startOfSevenDays, end: null },
        { key: "30d", flag: "in_30d", count: "thirty_days_count", start: startOfThirtyDays, end: null }
      ];

      function sqlDate(date) {
        return date.toISOString();
      }

      function timeClause(column, period) {
        const start = sqlString(sqlDate(period.start));
        const end = period.end ? sqlString(sqlDate(period.end)) : null;
        return `julianday(${column}) >= julianday(${start})${end ? ` AND julianday(${column}) < julianday(${end})` : ""}`;
      }

      function membershipColumns(column) {
        return periodSpecs
          .map((period) => `CASE WHEN ${timeClause(column, period)} THEN 1 ELSE 0 END AS ${period.flag}`)
          .join(",\n              ");
      }

      function aggregateColumns(column) {
        return periodSpecs
          .map((period) => `SUM(CASE WHEN ${timeClause(column, period)} THEN 1 ELSE 0 END) AS ${period.count}`)
          .join(",\n              ");
      }

      function normalizeAgentLabel(label = "") {
        const value = String(label || "").trim();
        if (value.startsWith("agent-id:")) return value.slice("agent-id:".length);
        if (value.startsWith("agent:")) return value.slice("agent:".length);
        return "";
      }

      const thirtyDayPeriod = periodSpecs.find((period) => period.key === "30d");
      // Scan each source once over the largest window, then assign each row or
      // aggregate count to every period it belongs to.
      const [memories, links, shares, lineUpdates, gatewayCalls] = await Promise.all([
        this.query(`
          SELECT
            m.id AS id,
            l.label AS label,
            ${membershipColumns("m.created_at")}
          FROM memories m
          JOIN memory_labels l ON l.memory_id = m.id
          WHERE m.status = 'active'
            AND (l.label LIKE 'agent-id:%' OR l.label LIKE 'agent:%')
            AND ${timeClause("m.created_at", thirtyDayPeriod)}
        `),
        this.query(`
          SELECT
            k.id AS id,
            labels.label AS label,
            ${membershipColumns("k.created_at")}
          FROM memory_links k
          JOIN (
            SELECT memory_id, label FROM memory_labels WHERE label LIKE 'agent-id:%' OR label LIKE 'agent:%'
          ) labels ON labels.memory_id = k.from_memory_id OR labels.memory_id = k.to_memory_id
          WHERE ${timeClause("k.created_at", thirtyDayPeriod)}
        `),
        this.query(`
          SELECT
            s.id AS share_id,
            s.agent_id AS agent_id,
            a.metadata_json AS metadata_json,
            ${membershipColumns("a.created_at")}
          FROM innerlife_share_actions a
          JOIN innerlife_shares s ON s.id = a.share_id
          WHERE a.action = 'used'
            AND ${timeClause("a.created_at", thirtyDayPeriod)};
        `),
        this.query(`
          SELECT
            l.agent_id AS agent_id,
            ${aggregateColumns("h.created_at")}
          FROM continuity_position_history h
          JOIN continuity_lines l ON l.id = h.line_id
          WHERE ${timeClause("h.created_at", thirtyDayPeriod)}
          GROUP BY l.agent_id;
        `),
        this.query(`
          SELECT
            agent_id AS agent_id,
            ${aggregateColumns("created_at")}
          FROM gateway_traces
          WHERE ${timeClause("created_at", thirtyDayPeriod)}
          GROUP BY agent_id;
        `)
      ]);

      const agentsByPeriod = new Map(periodSpecs.map((period) => [period.key, new Map()]));
      const seenByPeriod = new Map(periodSpecs.map((period) => [period.key, {
        newMemories: new Set(),
        formedConnections: new Set(),
        confirmedShares: new Set()
      }]));

      function ensure(periodKey, agentId) {
        const agents = agentsByPeriod.get(periodKey);
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

      function forIncludedPeriods(row, visit) {
        for (const period of periodSpecs) {
          if (Number(row[period.flag] || 0) > 0) visit(period);
        }
      }

      function addUnique(rows, metric) {
        for (const row of rows) {
          const agentId = normalizeAgentLabel(row.label);
          if (!agentId || !row.id) continue;
          forIncludedPeriods(row, (period) => {
            const key = `${agentId}:${row.id}`;
            const seen = seenByPeriod.get(period.key)[metric];
            if (seen.has(key)) return;
            seen.add(key);
            ensure(period.key, agentId)[metric] += 1;
          });
        }
      }

      addUnique(memories, "newMemories");
      addUnique(links, "formedConnections");
      for (const row of shares) {
        const evidence = parseJson(row.metadata_json, {}).deliveryEvidence || {};
        if (!evidence.conversationId || !evidence.responseExcerpt || !evidence.sharedAt) continue;
        forIncludedPeriods(row, (period) => {
          const key = `${row.agent_id}:${row.share_id}`;
          const seen = seenByPeriod.get(period.key).confirmedShares;
          if (seen.has(key)) return;
          seen.add(key);
          ensure(period.key, row.agent_id).confirmedShares += 1;
        });
      }
      for (const row of lineUpdates) {
        for (const period of periodSpecs) {
          const count = Number(row[period.count] || 0);
          if (count > 0) ensure(period.key, row.agent_id).sharedLineUpdates += count;
        }
      }
      for (const row of gatewayCalls) {
        for (const period of periodSpecs) {
          const count = Number(row[period.count] || 0);
          if (count > 0) ensure(period.key, row.agent_id).gatewayCalls += count;
        }
      }

      function sortedActiveAgents(periodKey) {
        return Array.from(agentsByPeriod.get(periodKey).values())
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
      for (const period of periodSpecs) {
        periods[period.key] = {
          start: period.start.toISOString(),
          end: period.end ? period.end.toISOString() : now.toISOString(),
          agents: sortedActiveAgents(period.key)
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
