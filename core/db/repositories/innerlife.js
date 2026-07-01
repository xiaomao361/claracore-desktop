const { createInnerLifeProfileRepository } = require("./innerlife/profile");
const { createInnerLifeInboxRepository } = require("./innerlife/inbox");
const { createInnerLifeDaemonRepository } = require("./innerlife/daemon");
const { createInnerLifeHistoryRepository } = require("./innerlife/history");
const { createInnerLifeSessionRepository } = require("./innerlife/sessions");
const { createInnerLifeShareRepository } = require("./innerlife/shares");
const {
  IL_SYSTEM,
  generateOrTemplate,
  summarizeInnerLifeProfile
} = require("../../innerlife/policy");

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

  Object.assign(ProductDatabase.prototype, {
    ...createInnerLifeProfileRepository(helpers),
    ...createInnerLifeShareRepository(helpers),
    ...createInnerLifeInboxRepository(helpers),
    ...createInnerLifeDaemonRepository(helpers),
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
    },

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
      const shareChecks = await this.listInnerLifeShareChecks("all", 20);
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
    },

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
    },

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
    },

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
      return {
        digest: await this.getInnerLifeDigestRun(digestId),
        eventId,
        thoughtId,
        convergence: null,
        processedInboxIds: inboxItems.map((item) => item.id),
        snapshot: await this.getInnerLifeSnapshot()
      };
    },

    ...createInnerLifeSessionRepository(helpers),
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
        share: await this.getInnerLifeShare(shareId),
        convergence,
        snapshot: await this.getInnerLifeSnapshot()
      };
    },

    ...createInnerLifeHistoryRepository(helpers),
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
    },

  });
}

module.exports = {
  installInnerLifeRepository
};
