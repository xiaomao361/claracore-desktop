const { DEFAULT_SHARE_POLICY } = require("../../../innerlife/policy");

function createInnerLifeProfileRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  return {
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
    

  };
}

module.exports = {
  createInnerLifeProfileRepository
};
