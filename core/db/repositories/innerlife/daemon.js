function createInnerLifeDaemonRepository(helpers, services = {}) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;
  const { tickInnerLifeDaemon } = services;
  if (typeof tickInnerLifeDaemon !== "function") {
    throw new Error("InnerLife daemon repository requires tickInnerLifeDaemon service.");
  }

  function compactSourceIngest(input = {}) {
    return {
      sourceCount: Number(input.sourceCount || 0),
      candidateCount: Number(input.candidateCount || 0),
      insertedCount: Number(input.insertedCount || 0),
      errors: Array.isArray(input.errors) ? input.errors : []
    };
  }

  // The per-Agent daemon row owns the desired setting. The global switch is
  // a gate; reading a paused global gate must not erase any Agent's choice.
  function shapeState(row, agentId, globalEnabled) {
    const enabled = Boolean(globalEnabled && row.enabled && row.status !== "paused");
    return {
      agentId: row.agent_id || agentId,
      status: enabled ? row.status || "enabled" : "paused",
      enabled,
      lastTickAt: row.last_tick_at || null,
      nextRunAt: enabled ? row.next_run_at || null : null,
      lastResult: row.last_result || "",
      lastError: row.last_error || "",
      tickCount: row.tick_count || 0,
      updatedAt: row.updated_at || null,
      metadata: parseJson(row.metadata_json, {})
    };
  }

  return {
    async getInnerLifeDaemonStateReadOnly(agentId = DEFAULT_AGENT_ID, settings = null) {
      const identity = resolveAgentIdentity(agentId || DEFAULT_AGENT_ID);
      const resolvedSettings = settings || await this.getSettings();
      const enabled = Boolean(resolvedSettings["innerlife.enabled"]);
      const rows = await this.query(`
        SELECT agent_id, status, enabled, last_tick_at, next_run_at, last_result, last_error, tick_count, updated_at, metadata_json
        FROM innerlife_daemon_state
        WHERE agent_id = ${sqlString(identity.id)}
        LIMIT 1;
      `);
      const row = rows[0] || {};
      return shapeState(row, identity.id, enabled);
    },

    async listEnabledInnerLifeDaemonAgentIds() {
      const settings = await this.getSettings();
      if (!settings["innerlife.enabled"]) return [];
      const rows = await this.query(`
        SELECT agent_id
        FROM innerlife_daemon_state
        WHERE enabled = 1 AND status != 'paused'
        ORDER BY agent_id ASC;
      `);
      return rows.map((row) => String(row.agent_id || "").trim()).filter(Boolean);
    },

    async ensureInnerLifeDaemonState(agentId = DEFAULT_AGENT_ID) {
      const profile = await this.ensureInnerLifeProfile(agentId);
      const settings = await this.getSettings();
      const enabled = Boolean(settings["innerlife.enabled"]);
      await this.exec(`
        INSERT INTO innerlife_daemon_state (agent_id, status, enabled, last_result, metadata_json)
        VALUES (
          ${sqlString(profile.agent_id)},
          ${profile.enabled ? "'enabled'" : "'paused'"},
          ${profile.enabled ? 1 : 0},
          'initialized',
          '{}'
        )
        ON CONFLICT(agent_id) DO NOTHING;
      `);
      const rows = await this.query(`
        SELECT agent_id, status, enabled, last_tick_at, next_run_at, last_result, last_error, tick_count, updated_at, metadata_json
        FROM innerlife_daemon_state
        WHERE agent_id = ${sqlString(profile.agent_id)}
        LIMIT 1;
      `);
      const row = rows[0] || {};
      return shapeState(row, profile.agent_id, enabled);
    },

    async setInnerLifeDaemonState(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const action = String(input.action || "").trim().toLowerCase();
      const enable = action === "enable" || action === "start" || input.enabled === true;
      const pause = action === "pause" || action === "disable" || action === "stop" || input.enabled === false;
      if (!enable && !pause) throw new Error("InnerLife daemon action must be enable or pause.");
      if (enable && pause) throw new Error("InnerLife daemon action conflicts with enabled.");
      const settings = await this.getSettings();
      const pollSeconds = Math.max(1, Number.parseInt(String(settings["innerlife.loop_seconds"] || 3600), 10) || 3600);
      const pendingInbox = enable ? await this.listInnerLifeInboxForAgent(profile.agent_id, "pending", 1) : [];
      const nextRunSql = enable && pendingInbox.length > 0 ? "CURRENT_TIMESTAMP" : `datetime('now', '+${pollSeconds} seconds')`;
      if (enable && !settings["innerlife.enabled"]) await this.updateSettings({ "innerlife.enabled": true });
      await this.execAtomic(`
        INSERT INTO innerlife_daemon_state (agent_id, status, enabled, next_run_at, last_result, last_error, updated_at, metadata_json)
        VALUES (
          ${sqlString(profile.agent_id)},
          ${enable ? "'enabled'" : "'paused'"},
          ${enable ? 1 : 0},
          ${enable ? nextRunSql : "NULL"},
          ${enable ? "'enabled'" : "'paused'"},
          '',
          CURRENT_TIMESTAMP,
          ${jsonSql({ pollSeconds, pendingInbox: pendingInbox.length, failureCount: 0, retrySeconds: 0 })}
        )
        ON CONFLICT(agent_id) DO UPDATE SET
          status = excluded.status,
          enabled = excluded.enabled,
          next_run_at = excluded.next_run_at,
          last_result = excluded.last_result,
          last_error = '',
          updated_at = CURRENT_TIMESTAMP,
          metadata_json = excluded.metadata_json;
    
        UPDATE innerlife_profiles
        SET enabled = ${enable ? 1 : 0},
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = ${sqlString(profile.agent_id)};
      `);
      return this.ensureInnerLifeDaemonState(profile.agent_id);
    },

    async isInnerLifeDaemonTickDue(agentId = DEFAULT_AGENT_ID) {
      const identity = resolveAgentIdentity(agentId || DEFAULT_AGENT_ID);
      const rows = await this.query(`
        SELECT CASE
          WHEN next_run_at IS NULL THEN 1
          WHEN next_run_at <= CURRENT_TIMESTAMP THEN 1
          ELSE 0
        END AS due
        FROM innerlife_daemon_state
        WHERE agent_id = ${sqlString(identity.id)}
        LIMIT 1;
      `);
      return Boolean(rows[0]?.due);
    },

    async markInnerLifeDaemonTickRunning(agentId = DEFAULT_AGENT_ID) {
      const identity = resolveAgentIdentity(agentId || DEFAULT_AGENT_ID);
      await this.exec(`
        UPDATE innerlife_daemon_state
        SET status = 'running',
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = ${sqlString(identity.id)} AND enabled = 1 AND status != 'paused';
      `);
    },

    async completeInnerLifeDaemonTickIdle(input = {}) {
      const identity = resolveAgentIdentity(input.agentId || DEFAULT_AGENT_ID);
      const pollSeconds = Math.max(1, Number.parseInt(String(input.pollSeconds || 3600), 10) || 3600);
      await this.exec(`
        UPDATE innerlife_daemon_state
        SET status = 'enabled',
            last_tick_at = CURRENT_TIMESTAMP,
            next_run_at = datetime('now', '+${pollSeconds} seconds'),
            last_result = 'idle',
            last_error = '',
            tick_count = tick_count + 1,
            updated_at = CURRENT_TIMESTAMP,
            metadata_json = ${jsonSql({
              pollSeconds,
              pendingInbox: 0,
              sourceIngest: compactSourceIngest(input.sourceIngest),
              failureCount: 0,
              retrySeconds: 0
            })}
        WHERE agent_id = ${sqlString(identity.id)} AND enabled = 1 AND status != 'paused';
      `);
    },

    async completeInnerLifeDaemonTickSuccess(input = {}) {
      const identity = resolveAgentIdentity(input.agentId || DEFAULT_AGENT_ID);
      const pendingInboxCount = Math.max(
        0,
        Number.parseInt(String(input.pendingInboxCount || 0), 10) || 0
      );
      const pollSeconds = Math.max(1, Number.parseInt(String(input.pollSeconds || 3600), 10) || 3600);
      const result = input.result || {};
      await this.exec(`
        UPDATE innerlife_daemon_state
        SET status = 'enabled',
            last_tick_at = CURRENT_TIMESTAMP,
            next_run_at = datetime('now', '+${pollSeconds} seconds'),
            last_result = ${sqlString(`processed ${pendingInboxCount} inbox item(s)`)},
            last_error = '',
            tick_count = tick_count + 1,
            updated_at = CURRENT_TIMESTAMP,
            metadata_json = ${jsonSql({
              pollSeconds,
              pendingInbox: pendingInboxCount,
              sourceIngest: compactSourceIngest(input.sourceIngest),
              shareId: result.share?.id || "",
              convergence: result.convergence
                ? {
                    converged: Boolean(result.convergence.converged),
                    reason: result.convergence.reason || "",
                    shareId: result.convergence.share?.id || ""
                  }
                : null,
              failureCount: 0,
              retrySeconds: 0
            })}
        WHERE agent_id = ${sqlString(identity.id)} AND enabled = 1 AND status != 'paused';
      `);
    },

    async completeInnerLifeDaemonTickFailure(input = {}) {
      const identity = resolveAgentIdentity(input.agentId || DEFAULT_AGENT_ID);
      const pendingInboxCount = Math.max(
        0,
        Number.parseInt(String(input.pendingInboxCount || 0), 10) || 0
      );
      const pollSeconds = Math.max(1, Number.parseInt(String(input.pollSeconds || 3600), 10) || 3600);
      const failureCount = Math.max(1, Number.parseInt(String(input.failureCount || 1), 10) || 1);
      const retrySeconds = Math.max(1, Number.parseInt(String(input.retrySeconds || 1), 10) || 1);
      const error = String(input.error || "InnerLife daemon tick failed.");
      await this.exec(`
        UPDATE innerlife_daemon_state
        SET status = 'error',
            last_tick_at = CURRENT_TIMESTAMP,
            next_run_at = datetime('now', '+${retrySeconds} seconds'),
            last_result = ${sqlString(`retry in ${retrySeconds}s`)},
            last_error = ${sqlString(error)},
            tick_count = tick_count + 1,
            updated_at = CURRENT_TIMESTAMP,
            metadata_json = ${jsonSql({
              pollSeconds,
              pendingInbox: pendingInboxCount,
              failureCount,
              retrySeconds,
              error
            })}
        WHERE agent_id = ${sqlString(identity.id)} AND enabled = 1 AND status != 'paused';
      `);
    },

    async tickInnerLifeDaemon(input = {}) {
      return tickInnerLifeDaemon(this, input);
    }
  };
}

module.exports = {
  createInnerLifeDaemonRepository
};
