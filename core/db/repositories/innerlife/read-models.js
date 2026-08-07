const { summarizeInnerLifeProfile } = require("../../../innerlife/policy");

function createInnerLifeReadModelRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  function emptyInnerLifeResumePacket(agentId) {
    return {
      lineId: "",
      currentPosition: {
        lineId: "",
        agentId,
        positionId: "",
        summary: "",
        interpretationStatus: "",
        factsUsed: [],
        metadata: {},
        updatedAt: null
      },
      handoffs: [],
      sharedReality: {},
      agentState: {},
      nextStep: ""
    };
  }

  return {
    async getInnerLifeCounts(agentId = "all") {
      const requestedAgentId = String(agentId || "all").trim() || "all";
      const agentClause = requestedAgentId === "all" ? "" : ` AND agent_id = ${sqlString(requestedAgentId)}`;
      const rows = await this.query(`
        SELECT
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'pending' AND source != 'session_end_afterthought'${agentClause}) AS pending_inbox_count,
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'processed'${agentClause}) AS processed_inbox_count,
          (SELECT COUNT(*) FROM innerlife_inbox
            WHERE source = 'session_end_afterthought'
              AND status IN ('pending', 'processing')
              AND CASE
                WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.retryState')
                ELSE NULL
              END = 'retrying'${agentClause}) AS afterthought_retrying_count,
          (SELECT COUNT(*) FROM innerlife_inbox
            WHERE source = 'session_end_afterthought'
              AND status = 'failed'${agentClause}) AS afterthought_terminal_failure_count,
          (SELECT MIN(
              CASE
                WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.nextRetryAt')
                ELSE NULL
              END
            )
            FROM innerlife_inbox
            WHERE source = 'session_end_afterthought'
              AND status = 'pending'
              AND CASE
                WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.retryState')
                ELSE NULL
              END = 'retrying'${agentClause}) AS afterthought_next_retry_at,
          (SELECT CASE
              WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.lastError')
              ELSE ''
            END
            FROM innerlife_inbox
            WHERE source = 'session_end_afterthought'
              AND status IN ('pending', 'processing', 'failed')
              AND COALESCE(
                CASE
                  WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.lastError')
                  ELSE NULL
                END,
                ''
              ) != ''${agentClause}
            ORDER BY datetime(COALESCE(
              CASE
                WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.lastAttemptAt')
                ELSE NULL
              END,
              created_at
            )) DESC, id DESC
            LIMIT 1) AS afterthought_last_error,
          (SELECT COUNT(*) FROM innerlife_events WHERE 1 = 1${agentClause}) AS events_count,
          (SELECT COUNT(*) FROM innerlife_thoughts WHERE event_id IN (
            SELECT id FROM innerlife_events WHERE 1 = 1${agentClause}
          )) AS thoughts_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'pending'${agentClause}) AS pending_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'approved'${agentClause}) AS approved_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'rejected'${agentClause}) AS rejected_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'used'${agentClause}) AS used_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'deferred'${agentClause}) AS deferred_shares_count,
          (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'discarded'${agentClause}) AS discarded_shares_count,
          (SELECT COUNT(*) FROM innerlife_digest_runs WHERE 1 = 1${agentClause}) AS digest_runs_count,
          (SELECT COUNT(*) FROM innerlife_share_checks WHERE 1 = 1${agentClause}) AS share_checks_count,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'active'${agentClause}) AS active_sessions_count,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'ended'${agentClause}) AS ended_sessions_count;
      `);
      return rows[0] || {};
    },

    async getInnerLifeSnapshotLite(agentId = "all") {
      const requestedAgentId = String(agentId || "all").trim() || "all";
      const profileRows = await this.query(`
        SELECT agent_id, display_name, enabled
        FROM innerlife_profiles
        ORDER BY updated_at DESC, agent_id ASC;
      `);
      const profiles = profileRows
        .filter((row) => requestedAgentId === "all" || row.agent_id === requestedAgentId)
        .map((row) => ({
          agentId: row.agent_id,
          displayName: row.display_name,
          enabled: Boolean(row.enabled)
        }));
      const selectedProfile = profiles.find((item) => item.agentId === requestedAgentId) || profiles.find((item) => item.agentId === DEFAULT_AGENT_ID) || profiles[0] || null;
      const pendingShares = (await this.listInnerLifeShares("pending", 20, requestedAgentId)).map((share) => ({
        id: share.id,
        agent_id: share.agent_id,
        status: share.status,
        created_at: share.created_at,
        updated_at: share.updated_at,
        preview: String(share.body || "").slice(0, 200)
      }));
      const settings = selectedProfile ? await this.getSettings() : null;
      const daemon = selectedProfile
        ? await this.getInnerLifeDaemonStateReadOnly(selectedProfile.agentId, settings)
        : { agentId: "", status: "paused", enabled: false, lastTickAt: null, nextRunAt: null, lastResult: "", lastError: "", tickCount: 0, updatedAt: null, metadata: {} };
      const counts = await this.getInnerLifeCounts(requestedAgentId);
      const pendingInbox = selectedProfile
        ? await this.listInnerLifeInboxForAgent(selectedProfile.agentId, "pending", 5, {
            excludeSources: ["session_end_afterthought"]
          })
        : [];
      const doctor = selectedProfile
        ? await this.getInnerLifeDoctor(selectedProfile.agentId, {
            profile: { agent_id: selectedProfile.agentId },
            daemon,
            settings,
            counts: {
              pendingInbox: counts.pending_inbox_count || 0,
              pendingShares: counts.pending_shares_count || 0,
              activeSessions: counts.active_sessions_count || 0,
              afterthoughtRetrying: counts.afterthought_retrying_count || 0,
              afterthoughtTerminalFailures: counts.afterthought_terminal_failure_count || 0,
              afterthoughtNextRetryAt: counts.afterthought_next_retry_at || null,
              afterthoughtLastError: counts.afterthought_last_error || ""
            }
          })
        : { status: "ok", summary: "No InnerLife profiles configured.", issues: [], nextActions: [] };
      return {
        mode: "lite",
        profiles,
        counts,
        pendingShares,
        pendingInbox,
        daemon,
        doctor,
        detail_ref: "Pass detail=true to innerlife_status for the full snapshot, or use innerlife_sessions / innerlife_digest / innerlife_pending_shares for specific records."
      };
    },

    async getInnerLifeSnapshot(agentId = "all") {
      const requestedAgentId = String(agentId || "all").trim() || "all";
      const profileRows = await this.query(`
        SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
        FROM innerlife_profiles
        ORDER BY updated_at DESC, agent_id ASC;
      `);
      const profiles = profileRows
        .filter((row) => requestedAgentId === "all" || row.agent_id === requestedAgentId)
        .map((row) => ({
          agentId: row.agent_id,
          displayName: row.display_name,
          enabled: Boolean(row.enabled),
          profile: parseJson(row.profile_json, {}),
          state: parseJson(row.state_json, {}),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }));
      const selectedProfile = profiles.find((item) => item.agentId === requestedAgentId) || profiles.find((item) => item.agentId === DEFAULT_AGENT_ID) || profiles[0] || null;
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
      const compactShare = (share) => ({
        id: share.id,
        agent_id: share.agent_id,
        thought_id: share.thought_id,
        status: share.status,
        body: String(share.body || "").slice(0, 800),
        decision_reason: String(share.decision_reason || "").slice(0, 600),
        created_at: share.created_at,
        updated_at: share.updated_at
      });
      const pendingShares = (await this.listInnerLifeShares("pending", 20, requestedAgentId)).map(compactShare);
      const recentShares = (await this.listInnerLifeShares("all", 20, requestedAgentId)).map(compactShare);
      const sessionsPage = await this.listInnerLifeSessionsPage({ agentId: requestedAgentId, limit: 10, offset: 0 });
      const sessions = sessionsPage.items;
      const inboxPage = await this.listInnerLifeInboxPage({ agentId: requestedAgentId, status: "all", limit: 10, offset: 0 });
      const inbox = inboxPage.items;
      const digestRunsPage = await this.listInnerLifeDigestRunsPage({ agentId: requestedAgentId, limit: 10, offset: 0 });
      const digestRuns = digestRunsPage.items;
      const shareChecks = await this.listInnerLifeShareChecksCompact(requestedAgentId, 20);
      const history = (await this.getInnerLifeHistory(requestedAgentId, 20)).map((item) => ({
        ...item,
        body: String(item.body || "").slice(0, 800)
      }));
      const experiences = (await this.listInnerLifeExperiences(requestedAgentId, 10)).map((item) => ({
        ...item,
        body: String(item.body || "").slice(0, 800)
      }));
      const summaries = (await this.listInnerLifeSummaries(requestedAgentId, 10)).map((item) => ({
        ...item,
        summary: String(item.summary || "").slice(0, 1000)
      }));
      const daemon = profile
        ? await this.ensureInnerLifeDaemonState(profile.agent_id)
        : { agentId: "", status: "paused", enabled: false, lastTickAt: null, nextRunAt: null, lastResult: "", lastError: "", tickCount: 0, updatedAt: null, metadata: {} };
      return {
        profile,
        profiles,
        counts: await this.getInnerLifeCounts(requestedAgentId),
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
    },

    async listInnerLifeRecentThoughts(agentId, limit = 5) {
      const identity = resolveAgentIdentity(agentId || DEFAULT_AGENT_ID);
      const safeLimit = Math.max(1, Math.min(20, Number.parseInt(String(limit), 10) || 5));
      const rows = await this.query(`
        SELECT t.id, t.body, t.created_at
        FROM innerlife_thoughts t
        JOIN innerlife_events e ON e.id = t.event_id
        WHERE e.agent_id = ${sqlString(identity.id)}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map((row) => ({
        id: row.id,
        body: row.body || "",
        createdAt: row.created_at
      }));
    },

    async getInnerLifeDoctor(agentId = DEFAULT_AGENT_ID, context = {}) {
      const identity = resolveAgentIdentity(agentId || DEFAULT_AGENT_ID);
      const profile = context.profile || (await this.query(`
          SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
          FROM innerlife_profiles
          WHERE agent_id = ${sqlString(identity.id)}
          LIMIT 1;
        `))[0];
      if (!profile) {
        return {
          status: "ok",
          summary: "InnerLife is not configured for this agent.",
          issues: [],
          nextActions: ["Use innerlife_profile_set or an InnerLife write tool to create this agent's InnerLife profile."],
          counts: {
            pendingInbox: 0,
            pendingShares: 0,
            activeSessions: 0,
            afterthoughtRetrying: 0,
            afterthoughtTerminalFailures: 0
          },
          afterthought: {
            retryingCount: 0,
            terminalFailureCount: 0,
            nextRetryAt: null,
            lastError: ""
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
      const daemon = context.daemon || await this.ensureInnerLifeDaemonState(profile.agent_id);
      const settings = context.settings || await this.getSettings();
      const resolvedCounts = context.counts || (await this.query(`
          SELECT
            (SELECT COUNT(*) FROM innerlife_inbox WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending' AND source != 'session_end_afterthought') AS pending_inbox_count,
            (SELECT COUNT(*) FROM innerlife_shares WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending') AS pending_shares_count,
            (SELECT COUNT(*) FROM innerlife_sessions WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'active') AS active_sessions_count,
            (SELECT COUNT(*) FROM innerlife_inbox
              WHERE agent_id = ${sqlString(profile.agent_id)}
                AND source = 'session_end_afterthought'
                AND status IN ('pending', 'processing')
                AND CASE
                  WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.retryState')
                  ELSE NULL
                END = 'retrying') AS afterthought_retrying_count,
            (SELECT COUNT(*) FROM innerlife_inbox
              WHERE agent_id = ${sqlString(profile.agent_id)}
                AND source = 'session_end_afterthought'
                AND status = 'failed') AS afterthought_terminal_failure_count,
            (SELECT MIN(
                CASE
                  WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.nextRetryAt')
                  ELSE NULL
                END
              )
              FROM innerlife_inbox
              WHERE agent_id = ${sqlString(profile.agent_id)}
                AND source = 'session_end_afterthought'
                AND status = 'pending'
                AND CASE
                  WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.retryState')
                  ELSE NULL
                END = 'retrying') AS afterthought_next_retry_at,
            (SELECT CASE
                WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.lastError')
                ELSE ''
              END
              FROM innerlife_inbox
              WHERE agent_id = ${sqlString(profile.agent_id)}
                AND source = 'session_end_afterthought'
                AND status IN ('pending', 'processing', 'failed')
                AND COALESCE(
                  CASE
                    WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.lastError')
                    ELSE NULL
                  END,
                  ''
                ) != ''
              ORDER BY datetime(COALESCE(
                CASE
                  WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.lastAttemptAt')
                  ELSE NULL
                END,
                created_at
              )) DESC, id DESC
              LIMIT 1) AS afterthought_last_error;
        `))[0] || {};
      const pendingInboxCount = resolvedCounts.pendingInbox ?? resolvedCounts.pending_inbox_count ?? 0;
      const pendingSharesCount = resolvedCounts.pendingShares ?? resolvedCounts.pending_shares_count ?? 0;
      const activeSessionsCount = resolvedCounts.activeSessions ?? resolvedCounts.active_sessions_count ?? 0;
      const afterthoughtRetryingCount = resolvedCounts.afterthoughtRetrying
        ?? resolvedCounts.afterthought_retrying_count
        ?? 0;
      const afterthoughtTerminalFailureCount = resolvedCounts.afterthoughtTerminalFailures
        ?? resolvedCounts.afterthought_terminal_failure_count
        ?? 0;
      const afterthoughtNextRetryAt = resolvedCounts.afterthoughtNextRetryAt
        ?? resolvedCounts.afterthought_next_retry_at
        ?? null;
      const afterthoughtLastError = resolvedCounts.afterthoughtLastError
        ?? resolvedCounts.afterthought_last_error
        ?? "";
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
      if (afterthoughtTerminalFailureCount > 0) {
        issues.push({
          level: "error",
          code: "afterthought_terminal_failure",
          message: `${afterthoughtTerminalFailureCount} session afterthought job(s) reached the retry limit. ${afterthoughtLastError || ""}`.trim(),
          action: "Inspect the preserved job in innerlife_status(detail=true). After repairing the model path, call innerlife_afterthought_resolve with action=retry; or call it with action=acknowledge and a reason to close the failure without claiming generation succeeded."
        });
      }
      if (afterthoughtRetryingCount > 0) {
        issues.push({
          level: "warn",
          code: "afterthought_retrying",
          message: `${afterthoughtRetryingCount} session afterthought job(s) are waiting for a bounded retry. ${afterthoughtLastError || ""}`.trim(),
          action: afterthoughtNextRetryAt
            ? `Keep the original input intact and retry no earlier than ${afterthoughtNextRetryAt}.`
            : "Keep the original input intact and allow the persisted worker to retry."
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
      if (pendingInboxCount > 0 && !daemon.enabled) {
        issues.push({
          level: "info",
          code: "pending_inbox_paused",
          message: `${pendingInboxCount} inbox item(s) are waiting while the daemon is paused.`,
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
          pendingInbox: pendingInboxCount,
          pendingShares: pendingSharesCount,
          activeSessions: activeSessionsCount,
          afterthoughtRetrying: afterthoughtRetryingCount,
          afterthoughtTerminalFailures: afterthoughtTerminalFailureCount
        },
        afterthought: {
          retryingCount: afterthoughtRetryingCount,
          terminalFailureCount: afterthoughtTerminalFailureCount,
          nextRetryAt: afterthoughtNextRetryAt,
          lastError: afterthoughtLastError
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
    },

    async getOptionalInnerLifeResumePacket(input = {}, agentId = DEFAULT_AGENT_ID) {
      const lineId = String(input?.lineId || input?.line_id || "").trim();
      try {
        const resumePacket = await this.getResumePacket({
          agentId,
          ...(lineId ? { lineId } : {}),
          lite: true
        });
        return {
          resumePacket,
          sharedLineContext: {
            status: "selected",
            lineId: resumePacket.lineId || lineId || "",
            candidateLineIds: []
          }
        };
      } catch (error) {
        if (error?.code !== "SHARED_LINE_ID_REQUIRED") throw error;
        return {
          resumePacket: emptyInnerLifeResumePacket(agentId),
          sharedLineContext: {
            status: "ambiguous",
            lineId: "",
            errorCode: error.code,
            candidateLineIds: (error.candidates || []).map((candidate) => candidate.lineId).filter(Boolean)
          }
        };
      }
    },

    async getInnerLifeBriefing(input = DEFAULT_AGENT_ID) {
      const options = input && typeof input === "object" ? input : { agentId: input };
      const agentId = resolveAgentIdentity(options || {}).id;
      // A briefing is an observation. Reading one for an unknown Agent must not
      // create that Agent's profile.
      const profile = await this.getInnerLifeProfileReadOnly(agentId);
      const { resumePacket, sharedLineContext } = await this.getOptionalInnerLifeResumePacket(options, profile.agent_id);
      const memories = await this.listMemories(5);
      const pendingShares = (await this.listInnerLifeShares("pending", 20)).filter((share) => share.agent_id === profile.agent_id).slice(0, 5);
      const pendingInbox = await this.listInnerLifeInboxForAgent(profile.agent_id, "pending", 5, {
        excludeSources: ["session_end_afterthought"]
      });
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
        sharedLineContext,
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
          `Current position: ${resumePacket.currentPosition.summary || (sharedLineContext.status === "ambiguous" ? "(not selected: multiple active Shared Lines)" : "(empty)")}`,
          `Pending shares: ${pendingShares.length}`,
          `Pending inbox: ${pendingInbox.length}`,
          `Recent memories: ${memories.length}`,
          `Recent thoughts: ${rows.length}`
        ].join("\n")
      };
    },

  };
}

module.exports = {
  createInnerLifeReadModelRepository
};
