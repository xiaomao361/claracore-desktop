const { MAX_PROMPT_CHARS, makeSource, collectConvergenceSources, reviewInnerLifeCandidate } = require("../../../innerlife/grounding");
const { normalizeSources } = require("../../../innerlife/source-ingest");
const {
  IL_SYSTEM,
  buildInnerLifeProfileContext,
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
      const sources = [
        makeSource("identity", "identity", JSON.stringify(profile.profile?.identity || {})),
        ...memories.map((memory) => makeSource(memory.id, "memory", `${memory.title || ""}\n${String(memory.body || "").slice(0, 800)}`, memory.created_at || memory.createdAt)),
        ...inboxItems.map((item) => makeSource(item.id, "inbox", String(item.body || "").slice(0, 2000), item.created_at || item.createdAt))
      ];
      if (prompt && !/^Daemon tick:/.test(prompt)) sources.push(makeSource("operator", "inbox", prompt));
      if (resumePacket.currentPosition.summary) sources.push(makeSource(resumePacket.lineId, "position", resumePacket.currentPosition.summary));
      const triggerText = [...inboxItems.map((item) => item.body), /^Daemon tick:/.test(prompt) ? "" : prompt].join("\n");
      const profileContext = buildInnerLifeProfileContext(profile, { triggerText });
      const recentShares = await this.listInnerLifeShares("all", 12, profile.agent_id);
      const position = resumePacket.currentPosition.summary || (
        sharedLineContext.status === "ambiguous"
          ? "Shared Line selection is ambiguous; no line context was used."
          : "No Shared Line position saved yet."
      );
      const operatorPrompt = prompt
        || "Review current state calmly and propose only one shareable thought for the next fitting moment.";
      const templateBase = [
        "Manual InnerLife review",
        "",
        profileContext.text,
        "",
        `Current position: ${position}`,
        "",
        "Sources (record dates are not event dates):",
        JSON.stringify(sources)
      ].join("\n");
      // The model needs to see the operator prompt; the stored body must not
      // echo it. A fallback body that quotes the prompt verbatim scores highly
      // against any later prompt on the same topic, so automatic context would
      // deliver boilerplate back as if it were a thought.
      const modelPrompt = `${templateBase}\n\nOperator prompt: ${operatorPrompt}`;
      const template = templateBase;
      const generated = modelPrompt.length > MAX_PROMPT_CHARS
        ? { body: "[CONTEXT_LIMIT_EXCEEDED]", source: "blocked", tier: "light" }
        : await generateOrTemplate(this, {
        tier: "light",
        system: IL_SYSTEM.process,
        prompt: modelPrompt,
        template
      });
      const body = generated.body;
      const hasShareableInput = inboxItems.length > 0 || Boolean(prompt);
      const contextOnlyInbox = isContextOnlyInnerLifeInbox(inboxItems);
      const noveltyText = inboxItems.length > 0
        ? inboxItems.map((item) => item.body).join("\n")
        : prompt || body;
      const noShareOutput = isNoShareInnerLifeOutput(body);
      const sourceDuplicate = !hasShareableInput || contextOnlyInbox || noShareOutput
        ? null
        : await this.findSimilarInnerLifeShare(profile.agent_id, noveltyText);
      const outputDuplicate = hasShareableInput && !contextOnlyInbox && !noShareOutput && generated.source === "model"
        ? await this.findSimilarInnerLifeShare(profile.agent_id, body, { compareOutput: true }) : null;
      const duplicate = outputDuplicate || sourceDuplicate;
      const grounding = hasShareableInput && !contextOnlyInbox && !noShareOutput && !duplicate
        ? await reviewInnerLifeCandidate(this, { generated, context: modelPrompt, sources, recentShares }) : null;
      const shareDecision = !hasShareableInput
        ? { create: false, reason: "no_shareable_input" }
        : contextOnlyInbox
          ? { create: false, reason: "context_only_inbox" }
          : noShareOutput
            ? { create: false, reason: "model_no_share" }
            : duplicate
              ? { create: false, reason: "similar_share_exists", duplicateOf: duplicate.id, similarity: duplicate.similarity }
              : grounding && !grounding.create
                ? { create: false, reason: grounding.reason, retryable: grounding.retryable }
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
            generationSystem: IL_SYSTEM.process,
            contextPolicy: profileContext,
            generationContext: modelPrompt.slice(0, MAX_PROMPT_CHARS),
            generationContextTruncated: modelPrompt.length > MAX_PROMPT_CHARS,
            grounding,
            duplicateBasis: outputDuplicate ? "output" : sourceDuplicate ? "source" : null,
            shareDecision
          })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        SELECT ${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)}
        WHERE ${sqlString(shareDecision.create ? "1" : "0")} = '1';
      `);
      if (inboxItems.length > 0 && !shareDecision.retryable) {
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
      const profileContext = buildInnerLifeProfileContext(profile, { triggerText: [prompt, ...inboxItems.map((item) => item.body)].join("\n") });
      const sources = [makeSource("identity", "identity", JSON.stringify(profile.profile?.identity || {})),
        ...memories.map((m) => makeSource(m.id, "memory", `${m.title || ""}\n${String(m.body || "").slice(0, 800)}`, m.created_at || m.createdAt)),
        ...inboxItems.map((item) => makeSource(item.id, "inbox", String(item.body || "").slice(0, 2000), item.created_at || item.createdAt))];
      if (prompt) sources.push(makeSource("operator", "inbox", prompt));
      const template = [
        "InnerLife autonomous exploration",
        "",
        profileContext.text,
        "",
        "Sources (record dates are not event dates):",
        JSON.stringify(sources),
        "",
        ""
      ].join("\n");
      // Same defect as processInnerLifeOnce: the model needs the exploration
      // prompt, the stored body must not echo it back as if it were a thought.
      const explorePrompt = prompt
        || "Explore freely — surface what deserves attention without forcing a conclusion.";
      const modelPrompt = `${template}\nExploration prompt: ${explorePrompt}`;
      const generated = modelPrompt.length > MAX_PROMPT_CHARS
        ? { body: "[CONTEXT_LIMIT_EXCEEDED]", source: "blocked", tier: "light" }
        : await generateOrTemplate(this, {
        tier: "light",
        system: IL_SYSTEM.explore,
        prompt: modelPrompt,
        template
      });
      const body = generated.body;
      const recentShares = await this.listInnerLifeShares("all", 12, profile.agent_id);
      const duplicate = generated.source === "model" && !isNoShareInnerLifeOutput(body)
        ? await this.findSimilarInnerLifeShare(profile.agent_id, body, { compareOutput: true }) : null;
      const grounding = isNoShareInnerLifeOutput(body)
        ? { create: false, reason: "model_no_share" }
        : duplicate ? { create: false, reason: "similar_share_exists", duplicateOf: duplicate.id }
          : await reviewInnerLifeCandidate(this, { generated, context: modelPrompt, sources, recentShares });
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
            generationTier: generated.tier,
            generationSystem: IL_SYSTEM.explore,
            generationContext: modelPrompt.slice(0, MAX_PROMPT_CHARS),
            generationContextTruncated: modelPrompt.length > MAX_PROMPT_CHARS,
            contextPolicy: profileContext,
            grounding,
            shareDecision: { create: grounding.create, reason: grounding.reason }
          })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        SELECT ${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)}
        WHERE ${sqlString(grounding.create ? "1" : "0")} = '1';
      `);
      const convergence = grounding.create ? await this.convergeInnerLife({
        agentId: profile.agent_id,
        sourceThoughtId: thoughtId,
        automated: true,
        reason: "explore"
      }) : null;
      return {
        eventId,
        thoughtId,
        share: grounding.create ? await this.getInnerLifeShare(shareId) : null,
        shareDecision: { create: grounding.create, reason: grounding.reason },
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
      const pendingShares = await this.listInnerLifeShares("pending", 10, profile.agent_id);
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
      const originThoughtIds = [...new Set([
        ...thoughtsForConvergence.map((t) => t.id), ...agentPendingShares.map((s) => s.thought_id)
      ].filter(Boolean))];
      const originRows = originThoughtIds.length ? await this.query(`
        SELECT t.id, e.id AS event_id, e.metadata_json
        FROM innerlife_thoughts t JOIN innerlife_events e ON e.id = t.event_id
        WHERE e.agent_id = ${sqlString(profile.agent_id)}
          AND t.id IN (${originThoughtIds.map(sqlString).join(", ")});
      `) : [];
      const sources = collectConvergenceSources(profile.profile?.identity,
        originThoughtIds.map((id) => originRows.find((row) => row.id === id)).filter(Boolean));
      const template = [
        "InnerLife convergence",
        "",
        summarizeInnerLifeProfile(profile),
        "",
        `Active pending shares: ${agentPendingShares.length}`,
        shareLines,
        "",
        "Previous AI thoughts (not factual evidence):",
        thoughtLines,
        "",
        "Original sources (record dates are not event dates):",
        JSON.stringify(sources),
        "",
        "Converged: surface the most important thread without discarding others."
      ].join("\n");
      const generated = template.length > MAX_PROMPT_CHARS
        ? { body: "[CONTEXT_LIMIT_EXCEEDED]", source: "blocked", tier: "deep" }
        : await generateOrTemplate(this, {
        tier: "deep",
        system: IL_SYSTEM.converge,
        prompt: template,
        template
      });
      const body = generated.body;
      const duplicate = generated.source === "model" && !isNoShareInnerLifeOutput(body)
        ? await this.findSimilarInnerLifeShare(profile.agent_id, body, { compareOutput: true }) : null;
      const grounding = isNoShareInnerLifeOutput(body)
        ? { create: false, reason: "model_no_share" }
        : duplicate ? { create: false, reason: "similar_share_exists", duplicateOf: duplicate.id }
          : await reviewInnerLifeCandidate(this, { generated, context: template, sources,
            recentShares: await this.listInnerLifeShares("all", 12, profile.agent_id) });
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
            generationTier: generated.tier,
            generationSystem: IL_SYSTEM.converge,
            generationContext: template.slice(0, MAX_PROMPT_CHARS),
            generationContextTruncated: template.length > MAX_PROMPT_CHARS,
            grounding,
            shareDecision: { create: grounding.create, reason: grounding.reason }
          })}
        );

        INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
        VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
        SELECT ${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)}
        WHERE ${sqlString(grounding.create ? "1" : "0")} = '1';
      `);
      return {
        converged: grounding.create,
        shareDecision: { create: grounding.create, reason: grounding.reason },
        eventId,
        thoughtId,
        share: grounding.create ? await this.getInnerLifeShare(shareId) : null,
        pendingShareCount: agentPendingShares.length,
        snapshot: await this.getInnerLifeSnapshotLite(profile.agent_id)
      };
    },
  };
}

module.exports = {
  createInnerLifeReflectionRepository
};
