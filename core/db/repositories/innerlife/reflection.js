const { normalizeSources } = require("../../../innerlife/source-ingest");
const {
  IL_SYSTEM,
  generateOrTemplate,
  isContextOnlyInnerLifeInbox,
  isNoShareInnerLifeOutput,
  summarizeInnerLifeProfile
} = require("../../../innerlife/policy");

function createInnerLifeReflectionRepository(helpers) {
  const {
    jsonSql,
    newId,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  return {
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
      const hasShareableInput = inboxItems.length > 0 || Boolean(prompt);
      const contextOnlyInbox = isContextOnlyInnerLifeInbox(inboxItems);
      const noveltyText = inboxItems.length > 0
        ? inboxItems.map((item) => item.body).join("\n")
        : prompt || body;
      const noShareOutput = isNoShareInnerLifeOutput(body);
      const duplicate = !hasShareableInput || contextOnlyInbox || noShareOutput
        ? null
        : await this.findSimilarInnerLifeShare(profile.agent_id, noveltyText);
      const shareDecision = !hasShareableInput
        ? { create: false, reason: "no_shareable_input" }
        : contextOnlyInbox
          ? { create: false, reason: "context_only_inbox" }
          : noShareOutput
            ? { create: false, reason: "model_no_share" }
            : duplicate
              ? { create: false, reason: "similar_share_exists", duplicateOf: duplicate.id, similarity: duplicate.similarity }
              : { create: true, reason: "distinct_shareable_thought" };
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
            inboxIds: inboxItems.map((item) => item.id),
            inboxSources: inboxItems.map((item) => item.source),
            generationSource: generated.source,
            generationTier: generated.tier,
            shareNoveltyText: noveltyText,
            shareDecision
          })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        SELECT ${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)}
        WHERE ${sqlString(shareDecision.create ? "1" : "0")} = '1';
      `);
      if (inboxItems.length > 0) {
        await this.exec(`
          UPDATE innerlife_inbox
          SET status = 'processed',
              processed_at = CURRENT_TIMESTAMP
          WHERE id IN (${inboxItems.map((item) => sqlString(item.id)).join(", ")});
        `);
      }
      const convergence = shareDecision.create
        ? await this.convergeInnerLife({
            agentId: profile.agent_id,
            sourceThoughtId: thoughtId,
            automated: true,
            reason: "process"
          })
        : null;
      return {
        eventId,
        thoughtId,
        share: shareDecision.create ? await this.getInnerLifeShare(shareId) : null,
        shareDecision,
        convergence,
        sharedLineContext,
        snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
      };
    },

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
  };
}

module.exports = {
  createInnerLifeReflectionRepository
};
