const innerLifeTickLocks = new Map();

function createInnerLifeDaemonRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    innerLifeRetrySeconds,
    jsonSql,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  return {
    async ensureInnerLifeDaemonState(agentId = DEFAULT_AGENT_ID) {
      const profile = await this.ensureInnerLifeProfile(agentId);
      const settings = await this.getSettings();
      const enabled = Boolean(settings["innerlife.enabled"]);
      await this.exec(`
        INSERT INTO innerlife_daemon_state (agent_id, status, enabled, last_result, metadata_json)
        VALUES (
          ${sqlString(profile.agent_id)},
          ${enabled ? "'enabled'" : "'paused'"},
          ${enabled ? 1 : 0},
          'initialized',
          '{}'
        )
        ON CONFLICT(agent_id) DO NOTHING;
      `);
      if (!enabled) {
        await this.exec(`
          UPDATE innerlife_daemon_state
          SET status = 'paused',
              enabled = 0,
              next_run_at = NULL,
              last_result = 'paused',
              last_error = '',
              updated_at = CURRENT_TIMESTAMP,
              metadata_json = ${jsonSql({ failureCount: 0, retrySeconds: 0 })}
          WHERE agent_id = ${sqlString(profile.agent_id)};
        `);
      }
      const rows = await this.query(`
        SELECT agent_id, status, enabled, last_tick_at, next_run_at, last_result, last_error, tick_count, updated_at, metadata_json
        FROM innerlife_daemon_state
        WHERE agent_id = ${sqlString(profile.agent_id)}
        LIMIT 1;
      `);
      const row = rows[0] || {};
      return {
        agentId: row.agent_id || profile.agent_id,
        status: row.status || (enabled ? "enabled" : "paused"),
        enabled: Boolean(row.enabled),
        lastTickAt: row.last_tick_at || null,
        nextRunAt: row.next_run_at || null,
        lastResult: row.last_result || "",
        lastError: row.last_error || "",
        tickCount: row.tick_count || 0,
        updatedAt: row.updated_at || null,
        metadata: parseJson(row.metadata_json, {})
      };
    },

    async setInnerLifeDaemonState(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const action = String(input.action || "").trim().toLowerCase();
      const enable = action === "enable" || action === "start" || input.enabled === true;
      const pause = action === "pause" || action === "disable" || action === "stop" || input.enabled === false;
      if (!enable && !pause) throw new Error("InnerLife daemon action must be enable or pause.");
      const settings = await this.getSettings();
      const pollSeconds = Math.max(1, Number.parseInt(String(settings["innerlife.loop_seconds"] || 900), 10) || 900);
      const pendingInbox = enable ? await this.listInnerLifeInbox("pending", 1) : [];
      const nextRunSql = enable && pendingInbox.length > 0 ? "CURRENT_TIMESTAMP" : `datetime('now', '+${pollSeconds} seconds')`;
      await this.updateSettings({ "innerlife.enabled": enable });
      await this.exec(`
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

    async tickInnerLifeDaemon(input = {}) {
      const requestedAgentId = resolveAgentIdentity(input || {}).id;
      const includeSnapshot = input.includeSnapshot !== false;
      const snapshotIfRequested = async () => includeSnapshot ? this.getInnerLifeSnapshot() : undefined;
      const force = Boolean(input.force);
      if (!includeSnapshot && !force) {
        const settings = await this.getSettings();
        if (!settings["innerlife.enabled"]) {
          return {
            ran: false,
            reason: "paused",
            daemon: {
              agentId: requestedAgentId,
              status: "paused",
              enabled: false
            }
          };
        }
      }
      const hasExplicitAgent = Boolean(input?.agentId || input?.agent_id || input?.agent || input?.agentTool || input?.agent_tool || input?.agentName || input?.agent_name);
      const firstPendingInbox = await this.listInnerLifeInbox("pending", 1);
      const agentId = !hasExplicitAgent && firstPendingInbox[0]?.agentId ? firstPendingInbox[0].agentId : requestedAgentId;
      let pendingInboxPage = await this.listInnerLifeInboxPage({ agentId, status: "pending", limit: 5, offset: 0 });
      let pendingInbox = pendingInboxPage.items;
      const lockKey = `${this.dbPath}:${agentId}`;
      if (innerLifeTickLocks.get(lockKey)) {
        return {
          ran: false,
          reason: "running",
          daemon: await this.ensureInnerLifeDaemonState(agentId),
          snapshot: await snapshotIfRequested()
        };
      }
      innerLifeTickLocks.set(lockKey, true);
      try {
        const state = await this.ensureInnerLifeDaemonState(agentId);
        if (!state.enabled || state.status === "paused") {
          return {
            ran: false,
            reason: "paused",
            daemon: state,
            snapshot: await snapshotIfRequested()
          };
        }
        const dueRows = await this.query(`
          SELECT CASE
            WHEN next_run_at IS NULL THEN 1
            WHEN next_run_at <= CURRENT_TIMESTAMP THEN 1
            ELSE 0
          END AS due
          FROM innerlife_daemon_state
          WHERE agent_id = ${sqlString(agentId)}
          LIMIT 1;
        `);
        const due = Boolean(dueRows[0]?.due);
        if (!force && !due) {
          return {
            ran: false,
            reason: "not_due",
            daemon: state,
            snapshot: await snapshotIfRequested()
          };
        }
        const settings = await this.getSettings();
        const pollSeconds = Math.max(1, Number.parseInt(String(settings["innerlife.loop_seconds"] || 900), 10) || 900);
        const sourceIngest = await this.ingestInnerLifeSources({ agentId, maxItems: 5 });
        if (sourceIngest.insertedCount > 0) {
          pendingInboxPage = await this.listInnerLifeInboxPage({ agentId, status: "pending", limit: 5, offset: 0 });
          pendingInbox = pendingInboxPage.items;
        }
        if (pendingInbox.length === 0) {
          const tickIncrement = force ? "tick_count + 1" : "tick_count";
          await this.exec(`
            UPDATE innerlife_daemon_state
            SET status = 'enabled',
                last_tick_at = CURRENT_TIMESTAMP,
                next_run_at = datetime('now', '+${pollSeconds} seconds'),
                last_result = 'idle',
                last_error = '',
                tick_count = ${tickIncrement},
                updated_at = CURRENT_TIMESTAMP,
                metadata_json = ${jsonSql({
                  pollSeconds,
                  pendingInbox: 0,
                  sourceIngest: {
                    sourceCount: sourceIngest.sourceCount,
                    candidateCount: sourceIngest.candidateCount,
                    insertedCount: sourceIngest.insertedCount,
                    errors: sourceIngest.errors
                  },
                  failureCount: 0,
                  retrySeconds: 0
                })}
            WHERE agent_id = ${sqlString(agentId)};
          `);
          return {
            ran: false,
            reason: "idle",
            daemon: await this.ensureInnerLifeDaemonState(agentId),
            snapshot: await snapshotIfRequested()
          };
        }
        await this.exec(`
          UPDATE innerlife_daemon_state
          SET status = 'running',
              updated_at = CURRENT_TIMESTAMP
          WHERE agent_id = ${sqlString(agentId)};
        `);
        try {
          const result = await this.processInnerLifeOnce({
            agentId,
            prompt: "Daemon tick: digest pending inbox and create only one shareable thought for the next fitting moment."
          });
          await this.exec(`
            UPDATE innerlife_daemon_state
            SET status = 'enabled',
                last_tick_at = CURRENT_TIMESTAMP,
                next_run_at = datetime('now', '+${pollSeconds} seconds'),
                last_result = ${sqlString(`processed ${pendingInbox.length} inbox item(s)`)},
                last_error = '',
                tick_count = tick_count + 1,
                updated_at = CURRENT_TIMESTAMP,
                metadata_json = ${jsonSql({
                  pollSeconds,
                  pendingInbox: pendingInbox.length,
                  sourceIngest: {
                    sourceCount: sourceIngest.sourceCount,
                    candidateCount: sourceIngest.candidateCount,
                    insertedCount: sourceIngest.insertedCount,
                    errors: sourceIngest.errors
                  },
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
            WHERE agent_id = ${sqlString(agentId)};
          `);
          return {
            ran: true,
            reason: "processed",
            result,
            daemon: await this.ensureInnerLifeDaemonState(agentId),
            snapshot: await this.getInnerLifeSnapshot()
          };
        } catch (error) {
          const failureCount = Math.max(0, Number.parseInt(String(state.metadata?.failureCount || 0), 10) || 0) + 1;
          const retrySeconds = innerLifeRetrySeconds(pollSeconds, failureCount);
          await this.exec(`
            UPDATE innerlife_daemon_state
            SET status = 'error',
                last_tick_at = CURRENT_TIMESTAMP,
                next_run_at = datetime('now', '+${retrySeconds} seconds'),
                last_result = ${sqlString(`retry in ${retrySeconds}s`)},
                last_error = ${sqlString(error.message || String(error))},
                tick_count = tick_count + 1,
                updated_at = CURRENT_TIMESTAMP,
                metadata_json = ${jsonSql({
                  pollSeconds,
                  pendingInbox: pendingInbox.length,
                  failureCount,
                  retrySeconds,
                  error: error.message || String(error)
                })}
            WHERE agent_id = ${sqlString(agentId)};
          `);
          throw error;
        }
      } finally {
        innerLifeTickLocks.delete(lockKey);
      }
    }
  };
}

module.exports = {
  createInnerLifeDaemonRepository
};
