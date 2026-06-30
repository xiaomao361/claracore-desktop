const innerLifeTickLocks = new Map();

const IL_SYSTEM = {
  digest:
    "You are the inner digestion layer of an AI agent. Quietly digest the material below into a short, honest internal understanding. Do not make decisions for the user and do not share automatically. Write in the agent's own first-person voice.",
  explore:
    "You are the autonomous exploration layer of an AI agent. From the material below, freely surface threads worth attention. Prefer open questions over conclusions. Write in the agent's own first-person voice.",
  converge:
    "You are the convergence layer of an AI agent. Consolidate the pending shares and recent thoughts below into the single most important thread, without discarding the others. Write in the agent's own first-person voice.",
  process:
    "You are the inner review layer of an AI agent. Calmly review the current state below and propose a single shareable thought for the next fitting moment. Do not act, only reflect. Write in the agent's own first-person voice.",
  session:
    "You are the inner afterthought layer of an AI agent. Based on the session summary below, write a short shareable afterthought worth revisiting later. Write in the agent's own first-person voice."
};

const DEFAULT_SHARE_POLICY = {
  default_mode: "when_relevant",
  max_proactive_per_day: 3,
  proactive_after_hours: 2,
  repeat_cooldown_hours: 4,
  max_defer_count: 3,
  stale_after_days: 7
};

function summarizeInnerLifeProfile(profile) {
  const profileJson = profile?.profile || {};
  const stateJson = profile?.state || {};
  const pickProfile = {
    identity: profileJson.identity || null,
    boundaries: profileJson.boundaries || null,
    share_policy: { ...DEFAULT_SHARE_POLICY, ...(profileJson.share_policy || profileJson.sharePolicy || {}) },
    autonomy: profileJson.autonomy || null,
    convergence: profileJson.convergence || null,
    autonomous_sources: Array.isArray(profileJson.autonomous_sources) ? profileJson.autonomous_sources.slice(0, 5) : undefined
  };
  const pickState = {
    current_interests: Array.isArray(stateJson.current_interests) ? stateJson.current_interests : [],
    open_loops: Array.isArray(stateJson.open_loops) ? stateJson.open_loops.filter((loop) => !loop?.status || loop.status === "open").slice(0, 8) : [],
    recent_mood: stateJson.recent_mood || null,
    recent_focus: stateJson.recent_focus || null
  };
  return [
    `Agent profile: ${profile?.display_name || profile?.agent_id || ""}`,
    `Profile JSON: ${JSON.stringify(pickProfile)}`,
    `Current inner state: ${JSON.stringify(pickState)}`
  ].join("\n");
}

function compactSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    agentId: session.agentId || session.agent_id,
    userId: session.userId || session.user_id,
    host: session.host,
    externalSessionId: session.externalSessionId || session.external_session_id,
    status: session.status,
    startedAt: session.startedAt || session.started_at,
    endedAt: session.endedAt || session.ended_at || null
  };
}

function compactShare(share) {
  if (!share) return null;
  const body = String(share.body || "");
  return {
    id: share.id,
    agentId: share.agentId || share.agent_id,
    status: share.status,
    createdAt: share.createdAt || share.created_at,
    updatedAt: share.updatedAt || share.updated_at,
    preview: body.length > 360 ? `${body.slice(0, 360).trim()}...` : body
  };
}

// Try a model-backed generation; fall back to the template text when InnerLife
// has no model configured or the model call fails. Never throw: a degraded
// model must not break the waiting-share pipeline.
async function generateOrTemplate(self, { tier, system, prompt, template }) {
  try {
    const text = await self.innerLifeGenerate({ tier, system, prompt });
    if (text) {
      return { body: text, source: "model", tier };
    }
  } catch (error) {
    return {
      body: `${template}\n\n[InnerLife model fallback: ${error.message || String(error)}]`,
      source: "fallback",
      tier,
      error: error.message || String(error)
    };
  }
  return { body: template, source: "template", tier };
}

function installInnerLifeRepository(ProductDatabase, helpers) {
  const {
    DEFAULT_AGENT_ID,
    innerLifeRetrySeconds,
    jsonSql,
    meaningfulTokens,
    newId,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  Object.assign(ProductDatabase.prototype, {
    async ensureInnerLifeProfile(agentId = DEFAULT_AGENT_ID) {
      const identity = resolveAgentIdentity(agentId || DEFAULT_AGENT_ID);
      const id = identity.id;
      const label = identity.tool ? `${identity.name} (${identity.tool})` : identity.name || id;
      await this.exec(`
        INSERT INTO agents (id, label, role, status)
        VALUES (${sqlString(id)}, ${sqlString(label)}, 'agent', 'active')
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label,
          updated_at = CURRENT_TIMESTAMP;
    
        INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(label)},
          0,
          ${jsonSql({
            agentId: id,
            agentTool: identity.tool,
            agentName: identity.name,
            share_policy: DEFAULT_SHARE_POLICY
          })},
          ${jsonSql({ current_interests: [], open_loops: [], recent_mood: null, recent_focus: null })}
        )
        ON CONFLICT(agent_id) DO NOTHING;
      `);
      const rows = await this.query(`
        SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
        FROM innerlife_profiles
        WHERE agent_id = ${sqlString(id)};
      `);
      const row = rows[0];
      return {
        ...row,
        enabled: Boolean(row?.enabled),
        profile: parseJson(row?.profile_json, {}),
        state: parseJson(row?.state_json, {})
      };
    }
    ,

    async updateInnerLifeProfile(input = {}) {
      const profile = await this.ensureInnerLifeProfile(input.agentId || input.agent_id || input.agent || DEFAULT_AGENT_ID);
      const displayName = String(input.displayName || input.display_name || profile.display_name || profile.agent_id).trim() || profile.agent_id;
      const profileJson = input.profile && typeof input.profile === "object" && !Array.isArray(input.profile)
        ? input.profile
        : profile.profile || {};
      const stateJson = input.state && typeof input.state === "object" && !Array.isArray(input.state)
        ? input.state
        : profile.state || {};
      await this.exec(`
        UPDATE innerlife_profiles
        SET display_name = ${sqlString(displayName)},
            profile_json = ${jsonSql(profileJson)},
            state_json = ${jsonSql(stateJson)},
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = ${sqlString(profile.agent_id)};
      `);
      return this.ensureInnerLifeProfile(profile.agent_id);
    }
    ,

    async listInnerLifeProfiles(input = {}) {
      const limit = Math.max(1, Math.min(200, Number.parseInt(String(input.limit || 100), 10) || 100));
      const rows = await this.query(`
        SELECT p.agent_id, p.display_name, p.enabled, p.profile_json, p.state_json, p.created_at, p.updated_at,
               a.label AS agent_label, a.status AS agent_status
        FROM innerlife_profiles p
        LEFT JOIN agents a ON a.id = p.agent_id
        ORDER BY p.updated_at DESC, p.agent_id ASC
        LIMIT ${limit};
      `);
      return rows.map((row) => ({
        agentId: row.agent_id,
        displayName: row.display_name,
        enabled: Boolean(row.enabled),
        profile: parseJson(row.profile_json, {}),
        state: parseJson(row.state_json, {}),
        agent: {
          label: row.agent_label || row.display_name || row.agent_id,
          status: row.agent_status || "active"
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    }
    ,

    async deleteInnerLifeProfile(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      if (!agentId || agentId === "all") throw new Error("InnerLife agent id is required.");
      const existingRows = await this.query(`
        SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
        FROM innerlife_profiles
        WHERE agent_id = ${sqlString(agentId)}
        LIMIT 1;
      `);
      const existing = existingRows[0];
      if (!existing) {
        return {
          deleted: false,
          agentId,
          reason: "InnerLife profile not found."
        };
      }
      const counts = (await this.query(`
        SELECT
          (SELECT COUNT(*) FROM innerlife_profiles WHERE agent_id = ${sqlString(agentId)}) AS profiles,
          (SELECT COUNT(*) FROM innerlife_daemon_state WHERE agent_id = ${sqlString(agentId)}) AS daemon_states,
          (SELECT COUNT(*) FROM innerlife_inbox WHERE agent_id = ${sqlString(agentId)}) AS inbox,
          (SELECT COUNT(*) FROM innerlife_events WHERE agent_id = ${sqlString(agentId)}) AS events,
          (SELECT COUNT(*)
           FROM innerlife_thoughts t
           JOIN innerlife_events e ON e.id = t.event_id
           WHERE e.agent_id = ${sqlString(agentId)}) AS thoughts,
          (SELECT COUNT(*) FROM innerlife_shares WHERE agent_id = ${sqlString(agentId)}) AS shares,
          (SELECT COUNT(*) FROM innerlife_share_actions WHERE agent_id = ${sqlString(agentId)}) AS share_actions,
          (SELECT COUNT(*) FROM innerlife_share_checks WHERE agent_id = ${sqlString(agentId)}) AS share_checks,
          (SELECT COUNT(*) FROM innerlife_digest_runs WHERE agent_id = ${sqlString(agentId)}) AS digest_runs,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE agent_id = ${sqlString(agentId)}) AS sessions,
          (SELECT COUNT(*) FROM gateway_sessions WHERE agent_id = ${sqlString(agentId)}) AS gateway_sessions,
          (SELECT COUNT(*) FROM gateway_traces WHERE agent_id = ${sqlString(agentId)}) AS gateway_traces;
      `))[0] || {};
      await this.exec(`
        DELETE FROM innerlife_share_actions
        WHERE agent_id = ${sqlString(agentId)}
           OR share_id IN (SELECT id FROM innerlife_shares WHERE agent_id = ${sqlString(agentId)});

        DELETE FROM innerlife_share_checks
        WHERE agent_id = ${sqlString(agentId)}
           OR share_id IN (SELECT id FROM innerlife_shares WHERE agent_id = ${sqlString(agentId)})
           OR session_id IN (SELECT id FROM innerlife_sessions WHERE agent_id = ${sqlString(agentId)});

        DELETE FROM innerlife_shares
        WHERE agent_id = ${sqlString(agentId)};

        DELETE FROM innerlife_thoughts
        WHERE event_id IN (SELECT id FROM innerlife_events WHERE agent_id = ${sqlString(agentId)});

        DELETE FROM innerlife_digest_runs WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM innerlife_sessions WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM innerlife_daemon_state WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM innerlife_inbox WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM innerlife_events WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM innerlife_profiles WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM gateway_sessions WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM gateway_traces WHERE agent_id = ${sqlString(agentId)};
        DELETE FROM agents
        WHERE id = ${sqlString(agentId)}
          AND NOT EXISTS (SELECT 1 FROM innerlife_profiles WHERE agent_id = ${sqlString(agentId)})
          AND NOT EXISTS (SELECT 1 FROM innerlife_inbox WHERE agent_id = ${sqlString(agentId)})
          AND NOT EXISTS (SELECT 1 FROM innerlife_shares WHERE agent_id = ${sqlString(agentId)})
          AND NOT EXISTS (SELECT 1 FROM innerlife_digest_runs WHERE agent_id = ${sqlString(agentId)})
          AND NOT EXISTS (SELECT 1 FROM innerlife_sessions WHERE agent_id = ${sqlString(agentId)})
          AND NOT EXISTS (SELECT 1 FROM innerlife_daemon_state WHERE agent_id = ${sqlString(agentId)});
      `);
      return {
        deleted: true,
        agentId,
        profile: {
          agentId: existing.agent_id,
          displayName: existing.display_name,
          enabled: Boolean(existing.enabled),
          profile: parseJson(existing.profile_json, {}),
          state: parseJson(existing.state_json, {}),
          createdAt: existing.created_at,
          updatedAt: existing.updated_at
        },
        removed: counts
      };
    }
    ,
    
    async listInnerLifeShares(status = "pending", limit = 20) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const statusFilter = String(status || "pending").trim();
      const whereClause = statusFilter === "all" ? "" : `WHERE s.status = ${sqlString(statusFilter)}`;
      const rows = await this.query(`
        SELECT
          s.id,
          s.agent_id,
          s.thought_id,
          s.status,
          s.body,
          s.decision_reason,
          s.created_at,
          s.updated_at,
          t.event_id,
          t.review_status
        FROM innerlife_shares s
        LEFT JOIN innerlife_thoughts t ON t.id = s.thought_id
        ${whereClause}
        ORDER BY s.updated_at DESC, s.created_at DESC
        LIMIT ${safeLimit};
      `);
      return rows;
    }
    ,
    
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
    }
    ,
    
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
    }
    ,
    
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
      const pendingInboxPage = await this.listInnerLifeInboxPage({ agentId, status: "pending", limit: 5, offset: 0 });
      const pendingInbox = pendingInboxPage.items;
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
              metadata_json = ${jsonSql({ pollSeconds, pendingInbox: 0, failureCount: 0, retrySeconds: 0 })}
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
    ,
    
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
      return rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        mode: row.mode,
        status: row.status,
        input: parseJson(row.input_json, {}),
        summary: row.summary || "",
        createdAt: row.created_at,
        completedAt: row.completed_at,
        metadata: parseJson(row.metadata_json, {})
      }));
    }
    ,

    async countInnerLifeDigestRuns(agentId = "all") {
      const agentFilter = String(agentId || "all").trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`SELECT COUNT(*) AS count FROM innerlife_digest_runs ${whereClause};`);
      return rows[0]?.count || 0;
    }
    ,

    async listInnerLifeDigestRunsPage(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 10), 10) || 10, 50));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const [items, total] = await Promise.all([
        this.listInnerLifeDigestRuns(agentId, limit, offset),
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
    }
    ,
    
    async listInnerLifeShareChecks(agentId = DEFAULT_AGENT_ID, limit = 10) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
      const rows = await this.query(`
        SELECT c.id, c.share_id, c.agent_id, c.session_id, c.context, c.decision, c.reason, c.created_at, c.metadata_json, s.body AS share_body, s.status AS share_status
        FROM innerlife_share_checks c
        LEFT JOIN innerlife_shares s ON s.id = c.share_id
        WHERE c.agent_id = ${sqlString(agentId)}
        ORDER BY c.created_at DESC, c.id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        shareId: row.share_id,
        agentId: row.agent_id,
        sessionId: row.session_id,
        context: row.context || "",
        decision: row.decision,
        reason: row.reason || "",
        createdAt: row.created_at,
        shareBody: row.share_body || "",
        shareStatus: row.share_status || "",
        metadata: parseJson(row.metadata_json, {})
      }));
    }
    ,
    
    async getInnerLifeSnapshot() {
      const profileRows = await this.query(`
        SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
        FROM innerlife_profiles
        ORDER BY updated_at DESC, agent_id ASC;
      `);
      const profiles = profileRows.map((row) => ({
        agentId: row.agent_id,
        displayName: row.display_name,
        enabled: Boolean(row.enabled),
        profile: parseJson(row.profile_json, {}),
        state: parseJson(row.state_json, {}),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
      const selectedProfile = profiles.find((item) => item.agentId === DEFAULT_AGENT_ID) || profiles[0] || null;
      const profile = selectedProfile
        ? {
            agent_id: selectedProfile.agentId,
            display_name: selectedProfile.displayName,
            enabled: selectedProfile.enabled,
            profile_json: JSON.stringify(selectedProfile.profile || {}),
            state_json: JSON.stringify(selectedProfile.state || {}),
            created_at: selectedProfile.createdAt,
            updated_at: selectedProfile.updatedAt,
            profile: selectedProfile.profile || {},
            state: selectedProfile.state || {}
          }
        : null;
      const pendingShares = await this.listInnerLifeShares("pending", 20);
      const recentShares = await this.listInnerLifeShares("all", 20);
      const sessionsPage = await this.listInnerLifeSessionsPage({ agentId: "all", limit: 10, offset: 0 });
      const sessions = sessionsPage.items;
      const inboxPage = await this.listInnerLifeInboxPage({ agentId: "all", status: "all", limit: 10, offset: 0 });
      const inbox = inboxPage.items;
      const digestRunsPage = await this.listInnerLifeDigestRunsPage({ agentId: "all", limit: 10, offset: 0 });
      const digestRuns = digestRunsPage.items;
      const shareChecks = profile ? await this.listInnerLifeShareChecks(profile.agent_id, 10) : [];
      const history = await this.getInnerLifeHistory("all", 20);
      const experiences = await this.listInnerLifeExperiences("all", 10);
      const summaries = await this.listInnerLifeSummaries("all", 10);
      const daemon = profile
        ? await this.ensureInnerLifeDaemonState(profile.agent_id)
        : { agentId: "", status: "paused", enabled: false, lastTickAt: null, nextRunAt: null, lastResult: "", lastError: "", tickCount: 0, updatedAt: null, metadata: {} };
      const rows = await this.query(`
        SELECT
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'pending') AS pending_inbox_count,
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'processed') AS processed_inbox_count,
          (SELECT COUNT(*) FROM innerlife_events) AS events_count,
          (SELECT COUNT(*) FROM innerlife_thoughts) AS thoughts_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'pending') AS pending_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'approved') AS approved_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'rejected') AS rejected_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'used') AS used_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'deferred') AS deferred_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'discarded') AS discarded_shares_count,
          (SELECT COUNT(*) FROM innerlife_digest_runs) AS digest_runs_count,
          (SELECT COUNT(*) FROM innerlife_share_checks) AS share_checks_count,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'active') AS active_sessions_count,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'ended') AS ended_sessions_count;
      `);
      return {
        profile,
        profiles,
        counts: rows[0] || {},
        pendingShares,
        recentShares,
        sessions,
        sessionsPage: {
          agentId: sessionsPage.agentId,
          limit: sessionsPage.limit,
          offset: sessionsPage.offset,
          total: sessionsPage.total,
          hasMore: sessionsPage.hasMore
        },
        inbox,
        inboxPage: {
          agentId: inboxPage.agentId,
          status: inboxPage.status,
          limit: inboxPage.limit,
          offset: inboxPage.offset,
          total: inboxPage.total,
          hasMore: inboxPage.hasMore
        },
        digestRuns,
        digestRunsPage: {
          agentId: digestRunsPage.agentId,
          limit: digestRunsPage.limit,
          offset: digestRunsPage.offset,
          total: digestRunsPage.total,
          hasMore: digestRunsPage.hasMore
        },
        shareChecks,
        history,
        experiences,
        summaries,
        daemon,
        doctor: profile ? await this.getInnerLifeDoctor(profile.agent_id) : { status: "ok", summary: "No InnerLife profiles configured.", issues: [], nextActions: [] }
      };
    }
    ,
    
    async getInnerLifeDoctor(agentId = DEFAULT_AGENT_ID) {
      const identity = resolveAgentIdentity(agentId || DEFAULT_AGENT_ID);
      const profileRows = await this.query(`
        SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
        FROM innerlife_profiles
        WHERE agent_id = ${sqlString(identity.id)}
        LIMIT 1;
      `);
      const profile = profileRows[0];
      if (!profile) {
        return {
          status: "ok",
          summary: "InnerLife is not configured for this agent.",
          issues: [],
          nextActions: ["Use innerlife_profile_set or an InnerLife write tool to create this agent's InnerLife profile."],
          counts: {
            pendingInbox: 0,
            pendingShares: 0,
            activeSessions: 0
          },
          daemon: {
            status: "paused",
            enabled: false,
            lastTickAt: null,
            nextRunAt: null,
            lastResult: "",
            lastError: "",
            tickCount: 0,
            updatedAt: null,
            metadata: {}
          }
        };
      }
      const daemon = await this.ensureInnerLifeDaemonState(profile.agent_id);
      const settings = await this.getSettings();
      const rows = await this.query(`
        SELECT
          (SELECT COUNT(*) FROM innerlife_inbox WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending') AS pending_inbox_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending') AS pending_shares_count,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'active') AS active_sessions_count;
      `);
      const counts = rows[0] || {};
      const issues = [];
      const failureCount = Number.parseInt(String(daemon.metadata?.failureCount || 0), 10) || 0;
      const retrySeconds = Number.parseInt(String(daemon.metadata?.retrySeconds || 0), 10) || 0;
      if (daemon.status === "error") {
        issues.push({
          level: failureCount >= 3 ? "error" : "warn",
          code: "daemon_retrying",
          message: daemon.lastError || "InnerLife daemon failed and is waiting before retry.",
          action: `Review the last error, keep pending inbox intact, and retry after ${retrySeconds}s or pause the daemon.`
        });
      }
      if (daemon.enabled && String(settings["innerlife.provider"] || "disabled") === "disabled") {
        issues.push({
          level: "warn",
          code: "model_disabled",
          message: "InnerLife daemon is enabled while the model provider is disabled.",
          action: "Configure an InnerLife model provider before relying on model-backed output."
        });
      }
      if (counts.pending_inbox_count > 0 && !daemon.enabled) {
        issues.push({
          level: "info",
          code: "pending_inbox_paused",
          message: `${counts.pending_inbox_count} inbox item(s) are waiting while the daemon is paused.`,
          action: "Run process once, run a digest, or enable the daemon when ready."
        });
      }
      const hasError = issues.some((issue) => issue.level === "error");
      const hasWarning = issues.some((issue) => issue.level === "warn");
      const status = hasError ? "error" : hasWarning ? "warn" : "ok";
      const nextActions = issues.map((issue) => issue.action);
      if (nextActions.length === 0) {
        nextActions.push("No recovery action is needed.");
      }
      return {
        status,
        summary:
          status === "ok"
            ? "InnerLife is healthy."
            : status === "warn"
              ? "InnerLife needs attention but can recover."
              : "InnerLife needs recovery before it is reliable.",
        issues,
        nextActions,
        counts: {
          pendingInbox: counts.pending_inbox_count || 0,
          pendingShares: counts.pending_shares_count || 0,
          activeSessions: counts.active_sessions_count || 0
        },
        daemon: {
          status: daemon.status,
          enabled: daemon.enabled,
          lastError: daemon.lastError,
          nextRunAt: daemon.nextRunAt,
          failureCount,
          retrySeconds
        }
      };
    }
    ,
    
    async getInnerLifeBriefing(agentId = DEFAULT_AGENT_ID) {
      const profile = await this.ensureInnerLifeProfile(agentId);
      const resumePacket = await this.getResumePacket();
      const memories = await this.listMemories(5);
      const pendingShares = (await this.listInnerLifeShares("pending", 20)).filter((share) => share.agent_id === profile.agent_id).slice(0, 5);
      const pendingInbox = (await this.listInnerLifeInboxPage({ agentId: profile.agent_id, status: "pending", limit: 5, offset: 0 })).items;
      const rows = await this.query(`
        SELECT t.body, t.created_at
        FROM innerlife_thoughts t
        JOIN innerlife_events e ON e.id = t.event_id
        WHERE e.agent_id = ${sqlString(profile.agent_id)}
        ORDER BY t.created_at DESC
        LIMIT 5;
      `);
      return {
        agentId: profile.agent_id,
        generatedAt: new Date().toISOString(),
        sharedLine: resumePacket.currentPosition,
        recentHandoffs: resumePacket.handoffs || [],
        recentMemories: memories.map((memory) => ({
          id: memory.id,
          title: memory.title || "",
          body: memory.body || "",
          labels: memory.labels || []
        })),
        pendingShares,
        pendingInbox,
        recentThoughts: rows.map((row) => ({
          body: row.body || "",
          createdAt: row.created_at
        })),
        text: [
          `Agent: ${profile.agent_id}`,
          summarizeInnerLifeProfile(profile),
          `Current position: ${resumePacket.currentPosition.summary || "(empty)"}`,
          `Pending shares: ${pendingShares.length}`,
          `Pending inbox: ${pendingInbox.length}`,
          `Recent memories: ${memories.length}`,
          `Recent thoughts: ${rows.length}`
        ].join("\n")
      };
    }
    ,
    
    async runInnerLifeDigest(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const mode = String(input.mode || "manual").trim() || "manual";
      const prompt = String(input.prompt || "").trim();
      const resumePacket = await this.getResumePacket();
      const memories = await this.listMemories(5);
      const inboxItems = (await this.listInnerLifeInboxPage({ agentId: profile.agent_id, status: "pending", limit: 10, offset: 0 })).items;
      const digestId = newId("inner_digest");
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const memoryLines = memories.map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
      const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body}`).join("\n") || "- No pending inbox items.";
      const currentPosition = resumePacket.currentPosition.summary || "No Shared Line position saved yet.";
      const template = [
        "InnerLife digest",
        "",
        summarizeInnerLifeProfile(profile),
        "",
        `Mode: ${mode}`,
        `Current position: ${currentPosition}`,
        "",
        "Inbox digested:",
        inboxLines,
        "",
        "Recent Memory context:",
        memoryLines,
        "",
        `Operator prompt: ${prompt || "Digest current state without sharing automatically."}`
      ].join("\n");
      const generated = await generateOrTemplate(this, {
        tier: mode === "deep" ? "deep" : "light",
        system: IL_SYSTEM.digest,
        prompt: template,
        template
      });
      const summary = generated.body;
      await this.exec(`
        INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, input_json, summary, completed_at, metadata_json)
        VALUES (
          ${sqlString(digestId)},
          ${sqlString(profile.agent_id)},
          ${sqlString(mode)},
          'completed',
          ${jsonSql(input)},
          ${sqlString(summary)},
          CURRENT_TIMESTAMP,
          ${jsonSql({
            lineId: resumePacket.lineId,
            positionId: resumePacket.currentPosition.positionId,
            memoryIds: memories.map((memory) => memory.id),
            inboxIds: inboxItems.map((item) => item.id),
            generationSource: generated.source,
            generationTier: generated.tier
          })}
        );

        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(profile.agent_id)},
          'digest',
          ${sqlString(prompt || "Manual digest")},
          'processed',
          ${jsonSql({ digestId, inboxIds: inboxItems.map((item) => item.id) })}
        );
    
        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(summary)}, 'unreviewed');
      `);
      if (inboxItems.length > 0) {
        await this.exec(`
          UPDATE innerlife_inbox
          SET status = 'processed',
              processed_at = CURRENT_TIMESTAMP
          WHERE id IN (${inboxItems.map((item) => sqlString(item.id)).join(", ")});
        `);
      }
      const convergence = await this.convergeInnerLife({
        agentId: profile.agent_id,
        sourceThoughtId: thoughtId,
        automated: true,
        reason: "digest"
      });
      return {
        digest: (await this.listInnerLifeDigestRuns(profile.agent_id, 100)).find((run) => run.id === digestId),
        eventId,
        thoughtId,
        convergence,
        processedInboxIds: inboxItems.map((item) => item.id),
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    ,
    
    async checkInnerLifeShareTiming(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const context = String(input.context || "").trim();
      const sessionId = String(input.sessionId || "").trim() || null;
      const requestedShareId = String(input.shareId || "").trim();
      let share = requestedShareId ? await this.getInnerLifeShare(requestedShareId) : null;
      if (!share) {
        const available = await this.query(`
          SELECT id
          FROM innerlife_shares
          WHERE agent_id = ${sqlString(profile.agent_id)}
            AND status IN ('approved', 'pending', 'deferred')
          ORDER BY
            CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
            updated_at DESC,
            created_at DESC
          LIMIT 1;
        `);
        if (available[0]?.id) {
          share = await this.getInnerLifeShare(available[0].id);
        }
      }
      if (!share) {
        const checkId = newId("inner_share_check");
        await this.exec(`
          INSERT INTO innerlife_share_checks (id, share_id, agent_id, session_id, context, decision, reason, metadata_json)
          VALUES (
            ${sqlString(checkId)},
            NULL,
            ${sqlString(profile.agent_id)},
            ${sessionId ? sqlString(sessionId) : "NULL"},
            ${sqlString(context)},
            'none',
            'No shareable InnerLife thought is available.',
            '{}'
          );
        `);
        return {
          check: (await this.listInnerLifeShareChecks(profile.agent_id, 100)).find((item) => item.id === checkId),
          share: null,
          snapshot: await this.getInnerLifeSnapshot()
        };
      }
      const contextTokens = meaningfulTokens(context);
      const shareTokens = new Set(meaningfulTokens(share.body));
      const overlap = contextTokens.filter((token) => shareTokens.has(token));
      const hasAsk = /\b(ask|asked|question|share|need|use|recall|remember)\b/i.test(context) || /分享|需要|使用|记得|回忆|问题/u.test(context);
      let decision = "defer";
      let reason = "Context is not specific enough yet.";
      if (!context) {
        decision = "defer";
        reason = "No current context was provided.";
      } else if ((share.status === "approved" || share.status === "pending") && (hasAsk || overlap.length > 0 || context.length >= 20)) {
        decision = "use";
        reason = overlap.length > 0 ? `Context matches: ${overlap.slice(0, 5).join(", ")}.` : "Waiting share fits the current context.";
      } else if (share.status === "deferred") {
        decision = overlap.length > 0 || hasAsk ? "use" : "defer";
        reason = decision === "use" ? "Deferred share now matches the current context." : "Deferred share still does not match the current context.";
      }
      const checkId = newId("inner_share_check");
      await this.exec(`
        INSERT INTO innerlife_share_checks (id, share_id, agent_id, session_id, context, decision, reason, metadata_json)
        VALUES (
          ${sqlString(checkId)},
          ${sqlString(share.id)},
          ${sqlString(profile.agent_id)},
          ${sessionId ? sqlString(sessionId) : "NULL"},
          ${sqlString(context)},
          ${sqlString(decision)},
          ${sqlString(reason)},
          ${jsonSql({ overlap })}
        );
      `);
      return {
        check: (await this.listInnerLifeShareChecks(profile.agent_id, 100)).find((item) => item.id === checkId),
        share,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    ,
    
    async countInnerLifeSessions(agentId = "all") {
      const agentFilter = String(agentId || "all").trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT COUNT(*) AS count
        FROM innerlife_sessions
        ${whereClause};
      `);
      return rows[0]?.count || 0;
    }
    ,

    async listInnerLifeSessions(agentId = DEFAULT_AGENT_ID, limit = 20, offset = 0) {
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
      const safeOffset = Math.max(0, Number.parseInt(String(offset), 10) || 0);
      const agentFilter = String(agentId || DEFAULT_AGENT_ID).trim();
      const whereClause = agentFilter === "all" ? "" : `WHERE agent_id = ${sqlString(agentFilter)}`;
      const rows = await this.query(`
        SELECT id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json
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
        briefing: parseJson(row.briefing_json, {}),
        summary: row.summary || "",
        metadata: parseJson(row.metadata_json, {})
      }));
    }
    ,

    async listInnerLifeSessionsPage(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 10), 10) || 10, 50));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const [items, total] = await Promise.all([
        this.listInnerLifeSessions(agentId, limit, offset),
        this.countInnerLifeSessions(agentId)
      ]);
      return {
        agentId,
        items,
        limit,
        offset,
        total,
        hasMore: offset + items.length < total
      };
    }
    ,
    
    async startInnerLifeSession(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const userId = String(input.userId || "local-user").trim() || "local-user";
      const host = String(input.host || "desktop").trim() || "desktop";
      const externalSessionId = String(input.externalSessionId || "").trim() || newId("external_session");
      const includeBriefing = Boolean(input.includeBriefing);
      const buildStartPacket = async (session, briefing, existing = false) => {
        const pendingShares = (await this.listInnerLifeShares("pending", 20)).filter((share) => share.agent_id === profile.agent_id);
        const approvedShares = (await this.listInnerLifeShares("approved", 20)).filter((share) => share.agent_id === profile.agent_id);
        const selected = pendingShares[0] || approvedShares[0] || null;
        const sharePlan = selected
          ? {
              selected: true,
              decision: "share_now",
              reason: selected.status === "pending"
                ? "A thought is waiting for a fitting moment to be shared."
                : "A previously approved thought is available for this agent.",
              delivery_style: "natural",
              share: compactShare(selected),
              suggested_opening: String(selected.body || "").split("\n").map((line) => line.trim()).filter(Boolean)[0]?.slice(0, 180) || ""
            }
          : {
              selected: false,
              decision: "wait",
              reason: "No thought is waiting to be shared for this agent.",
              delivery_style: null,
              share: null,
              suggested_opening: ""
            };
        return {
          session: compactSession(session),
          share_plan: sharePlan,
          briefing_ref: {
            tool: "innerlife_briefing",
            agentId: profile.agent_id,
            note: "Call innerlife_briefing only when the full context is needed."
          },
          instruction: existing
            ? "Existing session. Use share_plan first; fetch full briefing lazily only if needed."
            : "Use share_plan first. Do not mechanically read briefing aloud; fetch full briefing lazily only if needed.",
          ...(includeBriefing ? { briefing } : {})
        };
      };
      const existing = await this.query(`
        SELECT id
        FROM innerlife_sessions
        WHERE agent_id = ${sqlString(profile.agent_id)}
          AND external_session_id = ${sqlString(externalSessionId)}
        LIMIT 1;
      `);
      if (existing[0]?.id) {
        const session = (await this.listInnerLifeSessions(profile.agent_id, 100)).find((item) => item.id === existing[0].id);
        const briefing = parseJson((await this.query(`SELECT briefing_json FROM innerlife_sessions WHERE id = ${sqlString(existing[0].id)};`))[0]?.briefing_json, {});
        return buildStartPacket(session, briefing, true);
      }
      const briefing = await this.getInnerLifeBriefing(profile.agent_id);
      const id = newId("inner_session");
      await this.exec(`
        INSERT INTO innerlife_sessions (id, agent_id, user_id, host, external_session_id, status, briefing_json, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(profile.agent_id)},
          ${sqlString(userId)},
          ${sqlString(host)},
          ${sqlString(externalSessionId)},
          'active',
          ${jsonSql(briefing)},
          ${jsonSql({ startedBy: "desktop" })}
        );
      `);
      const session = (await this.listInnerLifeSessions(profile.agent_id, 100)).find((item) => item.id === id);
      return buildStartPacket(session, briefing, false);
    }
    ,
    
    async endInnerLifeSession(sessionId, input = {}) {
      const id = String(sessionId || "").trim();
      if (!id) throw new Error("InnerLife session id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, status
        FROM innerlife_sessions
        WHERE id = ${sqlString(id)}
        LIMIT 1;
      `);
      const session = rows[0];
      if (!session) throw new Error("InnerLife session not found.");
      const summary = String(input.summary || input.transcript || "").trim();
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const shareId = newId("inner_share");
      const inboxId = newId("inner_inbox");
      const template = [
        "Session afterthought",
        "",
        `Session: ${id}`,
        `Summary: ${summary || "No summary provided."}`,
        "",
        "Review before sharing or applying this anywhere."
      ].join("\n");
      const generated = await generateOrTemplate(this, {
        tier: "light",
        system: IL_SYSTEM.session,
        prompt: template,
        template
      });
      const body = generated.body;
      await this.exec(`
        UPDATE innerlife_sessions
        SET status = 'ended',
            ended_at = CURRENT_TIMESTAMP,
            summary = ${sqlString(summary)}
        WHERE id = ${sqlString(id)};
    
        INSERT INTO innerlife_inbox (id, agent_id, source, body, status, metadata_json)
        VALUES (
          ${sqlString(inboxId)},
          ${sqlString(session.agent_id)},
          'session_end',
          ${sqlString(summary || "Session ended")},
          'processed',
          ${jsonSql({ sessionId: id })}
        );
    
        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(session.agent_id)},
          'session_end',
          ${sqlString(summary || "Session ended")},
          'processed',
          ${jsonSql({ sessionId: id })}
        );
    
        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');
    
        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        VALUES (${sqlString(shareId)}, ${sqlString(session.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)});
      `);
      const convergence = await this.convergeInnerLife({
        agentId: session.agent_id,
        sourceThoughtId: thoughtId,
        automated: true,
        reason: "session_end"
      });
      return {
        session: (await this.listInnerLifeSessions(session.agent_id, 100)).find((item) => item.id === id),
        inboxId,
        eventId,
        thoughtId,
        share: (await this.listInnerLifeShares("pending", 20)).find((share) => share.id === shareId),
        convergence,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    ,
    
    async processInnerLifeOnce(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const resumePacket = await this.getResumePacket();
      const memories = await this.listMemories(5);
      const inboxItems = (await this.listInnerLifeInboxPage({ agentId: profile.agent_id, status: "pending", limit: 5, offset: 0 })).items;
      const prompt = String(input?.prompt || "").trim();
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const shareId = newId("inner_share");
      const memoryLines = memories.map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
      const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body}`).join("\n") || "- No pending inbox items.";
      const position = resumePacket.currentPosition.summary || "No Shared Line position saved yet.";
      const template = [
        "Manual InnerLife review",
        "",
        summarizeInnerLifeProfile(profile),
        "",
        `Current position: ${position}`,
        "",
        "Recent Memory context:",
        memoryLines,
        "",
        "Pending inbox:",
        inboxLines,
        "",
        `Operator prompt: ${prompt || "Review current state calmly and propose only one shareable thought for the next fitting moment."}`
      ].join("\n");
      const generated = await generateOrTemplate(this, {
        tier: "light",
        system: IL_SYSTEM.process,
        prompt: template,
        template
      });
      const body = generated.body;
      await this.exec(`
        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(profile.agent_id)},
          'manual_process_once',
          ${sqlString(prompt || "Manual process once")},
          'processed',
          ${jsonSql({
            lineId: resumePacket.lineId,
            positionId: resumePacket.currentPosition.positionId,
            memoryIds: memories.map((memory) => memory.id),
            inboxIds: inboxItems.map((item) => item.id)
          })}
        );
    
        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');
    
        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        VALUES (${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)});
      `);
      if (inboxItems.length > 0) {
        await this.exec(`
          UPDATE innerlife_inbox
          SET status = 'processed',
              processed_at = CURRENT_TIMESTAMP
          WHERE id IN (${inboxItems.map((item) => sqlString(item.id)).join(", ")});
        `);
      }
      const convergence = await this.convergeInnerLife({
        agentId: profile.agent_id,
        sourceThoughtId: thoughtId,
        automated: true,
        reason: "process"
      });
      return {
        eventId,
        thoughtId,
        share: (await this.listInnerLifeShares("pending", 20)).find((share) => share.id === shareId),
        convergence,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    ,
    
    async reviewInnerLifeShare(id, decision, reason = "") {
      const shareId = String(id || "").trim();
      if (!shareId) throw new Error("InnerLife share id is required.");
      const status = decision === "approve" || decision === "approved" ? "approved" : decision === "reject" || decision === "rejected" ? "rejected" : "";
      if (!status) throw new Error("InnerLife share decision must be approve or reject.");
      const reviewStatus = status === "approved" ? "reviewed" : "dismissed";
      await this.exec(`
        UPDATE innerlife_shares
        SET status = ${sqlString(status)},
            decision_reason = ${sqlString(String(reason || "").trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(shareId)} AND status = 'pending';
    
        UPDATE innerlife_thoughts
        SET review_status = ${sqlString(reviewStatus)}
        WHERE id = (
          SELECT thought_id
          FROM innerlife_shares
          WHERE id = ${sqlString(shareId)}
        );
      `);
      const rows = await this.query(`
        SELECT id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at
        FROM innerlife_shares
        WHERE id = ${sqlString(shareId)};
      `);
      if (!rows[0]) throw new Error("InnerLife share not found.");
      return rows[0];
    }
    ,
    
    async markInnerLifeShare(id, action, reason = "") {
      const shareId = String(id || "").trim();
      if (!shareId) throw new Error("InnerLife share id is required.");
      const normalized = String(action || "").trim().toLowerCase();
      const statusByAction = {
        used: "used",
        deferred: "deferred",
        discarded: "discarded"
      };
      const nextStatus = statusByAction[normalized];
      if (!nextStatus) throw new Error("InnerLife share action must be used, deferred, or discarded.");
      const share = await this.getInnerLifeShare(shareId);
      if (!["pending", "approved", "deferred"].includes(share.status)) {
        throw new Error(`InnerLife share cannot be marked ${normalized} from ${share.status}.`);
      }
      const actionId = newId("inner_share_action");
      await this.exec(`
        UPDATE innerlife_shares
        SET status = ${sqlString(nextStatus)},
            decision_reason = ${sqlString(String(reason || "").trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(shareId)};
    
        INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, metadata_json)
        VALUES (
          ${sqlString(actionId)},
          ${sqlString(shareId)},
          ${sqlString(share.agent_id)},
          ${sqlString(normalized)},
          ${sqlString(String(reason || "").trim())},
          '{}'
        );
      `);
      return {
        actionId,
        share: await this.getInnerLifeShare(shareId)
      };
    }
    ,
    
    async listInnerLifeShareActions(shareId = null, limit = 20) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const whereClause = shareId ? `WHERE share_id = ${sqlString(shareId)}` : "";
      return this.query(`
        SELECT id, share_id, agent_id, action, reason, created_at, metadata_json
        FROM innerlife_share_actions
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
    }
    ,
    
    async getInnerLifeShare(id) {
      const shareId = String(id || "").trim();
      if (!shareId) throw new Error("InnerLife share id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at
        FROM innerlife_shares
        WHERE id = ${sqlString(shareId)};
      `);
      if (!rows[0]) throw new Error("InnerLife share not found.");
      return rows[0];
    }
    ,
    
    async applyInnerLifeShareToMemory(id) {
      const share = await this.getInnerLifeShare(id);
      if (share.status !== "approved") {
        throw new Error("Only approved InnerLife shares can be applied to Memory.");
      }
      const memory = await this.createMemory({
        title: "InnerLife approved output",
        body: share.body,
        labels: ["innerlife", "approved"]
      });
      await this.exec(`
        UPDATE innerlife_shares
        SET decision_reason = ${sqlString(`${share.decision_reason || ""}\nApplied to Memory: ${memory.id}`.trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(share.id)};
      `);
      return {
        share: await this.getInnerLifeShare(share.id),
        memory
      };
    }
    ,
    
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
    }
    ,

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
    }
    ,

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
    }
    ,

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
    ,

    async exploreInnerLife(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const prompt = String(input.prompt || "").trim();
      const memories = await this.listMemories(5);
      const recentThoughts = await this.query(`
        SELECT body, created_at FROM innerlife_thoughts
        ORDER BY created_at DESC LIMIT 5;
      `);
      const memoryLines = memories.map((m) => `- ${m.title || m.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
      const thoughtLines = recentThoughts.map((t) => `- ${t.body.slice(0, 80)}`).join("\n") || "- No recent thoughts.";
      const template = [
        "InnerLife autonomous exploration",
        "",
        "Recent Memory context:",
        memoryLines,
        "",
        "Recent thoughts:",
        thoughtLines,
        "",
        `Exploration prompt: ${prompt || "Explore freely — surface what deserves attention without forcing a conclusion."}`
      ].join("\n");
      const generated = await generateOrTemplate(this, {
        tier: "light",
        system: IL_SYSTEM.explore,
        prompt: template,
        template
      });
      const body = generated.body;
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const shareId = newId("inner_share");
      await this.exec(`
        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(profile.agent_id)},
          'explore',
          ${sqlString(prompt || "autonomous exploration")},
          'processed',
          ${jsonSql({ memoryIds: memories.map((m) => m.id), generationSource: generated.source, generationTier: generated.tier })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        VALUES (${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)});
      `);
      const convergence = await this.convergeInnerLife({
        agentId: profile.agent_id,
        sourceThoughtId: thoughtId,
        automated: true,
        reason: "explore"
      });
      return {
        eventId,
        thoughtId,
        share: await this.getInnerLifeShare(shareId),
        convergence,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    ,

    async convergeInnerLife(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const sourceThoughtId = String(input.sourceThoughtId || input.thoughtId || "").trim();
      if (sourceThoughtId) {
        const existingShare = await this.query(`
          SELECT id
          FROM innerlife_shares
          WHERE thought_id = ${sqlString(sourceThoughtId)}
            AND agent_id = ${sqlString(profile.agent_id)}
          LIMIT 1;
        `);
        if (existingShare[0]?.id) {
          return {
            converged: false,
            reason: "Thought is already shareable.",
            share: await this.getInnerLifeShare(existingShare[0].id),
            snapshot: await this.getInnerLifeSnapshot()
          };
        }
      }
      const pendingShares = await this.listInnerLifeShares("pending", 10);
      const agentPendingShares = pendingShares.filter((s) => s.agent_id === profile.agent_id);
      const sourceThoughtRows = sourceThoughtId
        ? await this.query(`
          SELECT t.id, t.body, t.created_at
          FROM innerlife_thoughts t
          JOIN innerlife_events e ON e.id = t.event_id
          WHERE t.id = ${sqlString(sourceThoughtId)}
            AND e.agent_id = ${sqlString(profile.agent_id)}
          LIMIT 1;
        `)
        : [];
      if (sourceThoughtId && !sourceThoughtRows[0]) {
        return {
          converged: false,
          reason: "Source thought was not found for this agent.",
          snapshot: await this.getInnerLifeSnapshot()
        };
      }
      const recentThoughts = await this.query(`
        SELECT t.id, t.body, t.created_at
        FROM innerlife_thoughts t
        JOIN innerlife_events e ON e.id = t.event_id
        WHERE e.agent_id = ${sqlString(profile.agent_id)}
        ORDER BY t.created_at DESC LIMIT 5;
      `);
      const thoughtsForConvergence = [
        ...sourceThoughtRows,
        ...recentThoughts.filter((thought) => thought.id !== sourceThoughtId)
      ].slice(0, 5);
      if (agentPendingShares.length === 0 && thoughtsForConvergence.length === 0) {
        return {
          converged: false,
          reason: "Nothing to converge — no pending shares or recent thoughts.",
          snapshot: await this.getInnerLifeSnapshot()
        };
      }
      const shareLines = agentPendingShares.map((s) => `- ${s.body.slice(0, 100)}`).join("\n") || "- No pending shares.";
      const thoughtLines = thoughtsForConvergence.map((t) => `- ${t.body.slice(0, 80)}`).join("\n") || "- No recent thoughts.";
      const template = [
        "InnerLife convergence",
        "",
        summarizeInnerLifeProfile(profile),
        "",
        `Active pending shares: ${agentPendingShares.length}`,
        shareLines,
        "",
        "Recent thought context:",
        thoughtLines,
        "",
        "Converged: surface the most important thread without discarding others."
      ].join("\n");
      const generated = await generateOrTemplate(this, {
        tier: "deep",
        system: IL_SYSTEM.converge,
        prompt: template,
        template
      });
      const body = generated.body;
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const shareId = newId("inner_share");
      await this.exec(`
        INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
        VALUES (
          ${sqlString(eventId)},
          ${sqlString(profile.agent_id)},
          'converge',
          'convergence',
          'processed',
          ${jsonSql({
            pendingShareIds: agentPendingShares.map((s) => s.id),
            sourceThoughtId,
            automated: Boolean(input.automated),
            reason: String(input.reason || "").trim(),
            generationSource: generated.source,
            generationTier: generated.tier
          })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        VALUES (${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)});
      `);
      return {
        converged: true,
        eventId,
        thoughtId,
        share: await this.getInnerLifeShare(shareId),
        pendingShareCount: agentPendingShares.length,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    ,

    async applyInnerLifeShareToSharedLine(id) {
      const share = await this.getInnerLifeShare(id);
      if (share.status !== "approved") {
        throw new Error("Only approved InnerLife shares can be applied to Shared Line.");
      }
      await this.saveCurrentPosition({
        summary: share.body,
        interpretationStatus: "draft",
        factsUsed: [share.id],
        source: "innerlife",
        confirmOverwrite: true
      });
      const sharedLine = await this.getResumePacket();
      await this.exec(`
        UPDATE innerlife_shares
        SET decision_reason = ${sqlString(`${share.decision_reason || ""}\nApplied to Shared Line: ${sharedLine.positionId}`.trim())},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${sqlString(share.id)};
      `);
      return {
        share: await this.getInnerLifeShare(share.id),
        sharedLine
      };
    }
  });
}

module.exports = {
  installInnerLifeRepository
};
