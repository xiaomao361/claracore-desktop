const { createInnerLifeProfileRepository } = require("./innerlife/profile");
const { createInnerLifeInboxRepository } = require("./innerlife/inbox");
const { createInnerLifeDaemonRepository } = require("./innerlife/daemon");
const { createInnerLifeHistoryRepository } = require("./innerlife/history");
const { createInnerLifeSessionRepository } = require("./innerlife/sessions");
const { createInnerLifeShareRepository } = require("./innerlife/shares");
const { createInnerLifeRetentionRepository } = require("./innerlife/retention");
const { fetchCandidates, hash, normalizeSources } = require("../../innerlife/source-ingest");
const {
  IL_SYSTEM,
  generateOrTemplate,
  summarizeInnerLifeProfile
} = require("../../innerlife/policy");

const DIGEST_RUN_RETENTION_PER_AGENT = 200;

function installInnerLifeRepository(ProductDatabase, helpers) {
  const {
    DEFAULT_AGENT_ID,
    jsonSql,
    newId,
    parseJson,
    resolveAgentIdentity,
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

  Object.assign(ProductDatabase.prototype, {
    ...createInnerLifeProfileRepository(helpers),
    ...createInnerLifeShareRepository(helpers),
    ...createInnerLifeInboxRepository(helpers),
    ...createInnerLifeDaemonRepository(helpers),
    ...createInnerLifeRetentionRepository(helpers),
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

    async getInnerLifeCounts(agentId = "all") {
      const requestedAgentId = String(agentId || "all").trim() || "all";
      const agentClause = requestedAgentId === "all" ? "" : ` AND agent_id = ${sqlString(requestedAgentId)}`;
      const rows = await this.query(`
        SELECT
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'pending' AND source != 'session_end_afterthought'${agentClause}) AS pending_inbox_count,
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'processed'${agentClause}) AS processed_inbox_count,
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
              activeSessions: counts.active_sessions_count || 0
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
      const daemon = context.daemon || await this.ensureInnerLifeDaemonState(profile.agent_id);
      const settings = context.settings || await this.getSettings();
      const resolvedCounts = context.counts || (await this.query(`
          SELECT
            (SELECT COUNT(*) FROM innerlife_inbox WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending' AND source != 'session_end_afterthought') AS pending_inbox_count,
            (SELECT COUNT(*) FROM innerlife_shares WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending') AS pending_shares_count,
            (SELECT COUNT(*) FROM innerlife_sessions WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'active') AS active_sessions_count;
        `))[0] || {};
      const pendingInboxCount = resolvedCounts.pendingInbox ?? resolvedCounts.pending_inbox_count ?? 0;
      const pendingSharesCount = resolvedCounts.pendingShares ?? resolvedCounts.pending_shares_count ?? 0;
      const activeSessionsCount = resolvedCounts.activeSessions ?? resolvedCounts.active_sessions_count ?? 0;
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
          activeSessions: activeSessionsCount
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
      const profile = await this.ensureInnerLifeProfile(agentId);
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

    async runInnerLifeDigest(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const mode = String(input.mode || "manual").trim() || "manual";
      const prompt = String(input.prompt || "").trim();
      const { resumePacket, sharedLineContext } = await this.getOptionalInnerLifeResumePacket(input, profile.agent_id);
      const memories = await this.listMemories(5);
      const inboxItems = (await this.listInnerLifeInboxPage({ agentId: profile.agent_id, status: "pending", limit: 10, offset: 0 })).items;
      const digestId = newId("inner_digest");
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const memoryLines = memories.map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
      const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body}`).join("\n") || "- No pending inbox items.";
      const currentPosition = resumePacket.currentPosition.summary || (
        sharedLineContext.status === "ambiguous"
          ? "Shared Line selection is ambiguous; no line context was used."
          : "No Shared Line position saved yet."
      );
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
            sharedLineStatus: sharedLineContext.status,
            candidateLineIds: sharedLineContext.candidateLineIds,
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
      await this.pruneInnerLifeDigestRuns(profile.agent_id);
      return {
        digest: await this.getInnerLifeDigestRun(digestId),
        eventId,
        thoughtId,
        convergence: null,
        sharedLineContext,
        processedInboxIds: inboxItems.map((item) => item.id),
        snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
      };
    },

    async pruneInnerLifeDigestRuns(agentId, keep = DIGEST_RUN_RETENTION_PER_AGENT) {
      const id = String(agentId || "").trim();
      if (!id) return;
      const safeLimit = Math.max(1, Number.parseInt(String(keep), 10) || DIGEST_RUN_RETENTION_PER_AGENT);
      await this.exec(`
        DELETE FROM innerlife_digest_runs
        WHERE agent_id = ${sqlString(id)}
          AND id NOT IN (
            SELECT id FROM innerlife_digest_runs
            WHERE agent_id = ${sqlString(id)}
            ORDER BY created_at DESC, id DESC
            LIMIT ${safeLimit}
          );
      `);
    },

    ...createInnerLifeSessionRepository(helpers),

    async ingestInnerLifeSources(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const sources = normalizeSources(profile.profile);
      const limitPerSource = Math.max(1, Math.min(Number.parseInt(String(input.limitPerSource || 10), 10) || 10, 20));
      const maxItems = Math.max(1, Math.min(Number.parseInt(String(input.maxItems || 10), 10) || 10, 50));
      const errors = [];
      const candidates = [];
      for (const source of sources) {
        try {
          candidates.push(...await fetchCandidates(source, { limit: limitPerSource }));
        } catch (error) {
          errors.push({ source: source.name, url: source.url, error: error.message || String(error) });
        }
      }
      const existingRows = await this.query(`
        SELECT metadata_json
        FROM innerlife_inbox
        WHERE agent_id = ${sqlString(profile.agent_id)}
        ORDER BY created_at DESC
        LIMIT 500;
      `);
      const known = new Set(
        existingRows
          .map((row) => parseJson(row.metadata_json, {}))
          .map((metadata) => metadata.contentFingerprint || metadata.candidateFingerprint || "")
          .filter(Boolean)
      );
      const seen = new Set();
      const selected = [];
      for (const candidate of candidates) {
        const body = [
          candidate.title,
          candidate.publishedAt ? `Published: ${candidate.publishedAt}` : "",
          candidate.url,
          "",
          candidate.summary
        ].filter(Boolean).join("\n");
        const contentFingerprint = hash(`${candidate.url}\n${candidate.title}\n${candidate.summary}`).slice(0, 32);
        if (known.has(contentFingerprint) || known.has(candidate.candidateFingerprint) || seen.has(contentFingerprint)) continue;
        seen.add(contentFingerprint);
        selected.push({ ...candidate, body, contentFingerprint });
        if (selected.length >= maxItems) break;
      }
      const inserted = [];
      for (const candidate of selected) {
        inserted.push(await this.submitInnerLifeInbox({
          agentId: profile.agent_id,
          source: `source:${candidate.sourceName}`,
          body: candidate.body,
          metadata: {
            sourceType: candidate.sourceType,
            sourceName: candidate.sourceName,
            url: candidate.url,
            title: candidate.title,
            publishedAt: candidate.publishedAt || "",
            candidateFingerprint: candidate.candidateFingerprint,
            contentFingerprint: candidate.contentFingerprint,
            ingestedBy: "innerlife_sources"
          }
        }));
      }
      return {
        agentId: profile.agent_id,
        sourceCount: sources.length,
        candidateCount: candidates.length,
        insertedCount: inserted.length,
        inserted,
        errors
      };
    },

    async processInnerLifeOnce(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const { resumePacket, sharedLineContext } = await this.getOptionalInnerLifeResumePacket(input, profile.agent_id);
      const memories = await this.listMemories(5);
      const inboxItems = await this.listInnerLifeInboxForAgent(profile.agent_id, "pending", 5, {
        excludeSources: ["session_end_afterthought"]
      });
      const prompt = String(input?.prompt || "").trim();
      const eventId = newId("inner_event");
      const thoughtId = newId("inner_thought");
      const shareId = newId("inner_share");
      const memoryLines = memories.map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
      const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body}`).join("\n") || "- No pending inbox items.";
      const position = resumePacket.currentPosition.summary || (
        sharedLineContext.status === "ambiguous"
          ? "Shared Line selection is ambiguous; no line context was used."
          : "No Shared Line position saved yet."
      );
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
            sharedLineStatus: sharedLineContext.status,
            candidateLineIds: sharedLineContext.candidateLineIds,
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
        share: await this.getInnerLifeShare(shareId),
        convergence,
        sharedLineContext,
        snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
      };
    },

    ...createInnerLifeHistoryRepository(helpers),
    async exploreInnerLife(input = {}) {
      const agentId = resolveAgentIdentity(input || {}).id;
      const profile = await this.ensureInnerLifeProfile(agentId);
      const sourceIngest = input.ingestSources === false
        ? { sourceCount: normalizeSources(profile.profile).length, candidateCount: 0, insertedCount: 0, inserted: [], errors: [] }
        : await this.ingestInnerLifeSources({ agentId: profile.agent_id, maxItems: input.maxSourceItems || 5 });
      const prompt = String(input.prompt || "").trim();
      const memories = await this.listMemories(5);
      const inboxItems = (await this.listInnerLifeInboxPage({ agentId: profile.agent_id, status: "pending", limit: 5, offset: 0 })).items;
      const recentThoughts = await this.query(`
        SELECT body, created_at FROM innerlife_thoughts
        ORDER BY created_at DESC LIMIT 5;
      `);
      const memoryLines = memories.map((m) => `- ${m.title || m.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
      const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body.slice(0, 260)}`).join("\n") || "- No pending inbox items.";
      const thoughtLines = recentThoughts.map((t) => `- ${t.body.slice(0, 80)}`).join("\n") || "- No recent thoughts.";
      const template = [
        "InnerLife autonomous exploration",
        "",
        summarizeInnerLifeProfile(profile),
        "",
        "Recent Memory context:",
        memoryLines,
        "",
        "Pending source/inbox material:",
        inboxLines,
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
          ${jsonSql({
            memoryIds: memories.map((m) => m.id),
            inboxIds: inboxItems.map((item) => item.id),
            sourceIngest: {
              sourceCount: sourceIngest.sourceCount,
              candidateCount: sourceIngest.candidateCount,
              insertedCount: sourceIngest.insertedCount,
              errors: sourceIngest.errors
            },
            generationSource: generated.source,
            generationTier: generated.tier
          })}
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
        snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
      };
    },

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
            snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
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
          snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
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
          snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
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
        snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
      };
    },

  });
}

module.exports = {
  installInnerLifeRepository
};
