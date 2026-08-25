const innerlife = require("../../innerlife");
const {
  normalizeInnerLifeDetail,
  shapeInnerLifeBriefing,
  shapeInnerLifeStatus,
  shapePendingShares,
  shapeShareCheckResult
} = require("../../innerlife/selective");
const continuity = require("../../continuity");
const { shapeSharedLinePacket } = require("../../continuity/resume-detail");
const { boundedText, shapeInnerLifeSessionCatalogEntry } = require("../bounded-response");

function compactLineSummary(line) {
  return {
    id: line.id,
    agentId: line.agentId,
    title: line.title,
    isCurrent: Boolean(line.active),
    interpretationStatus: line.interpretationStatus,
    updatedAt: line.updatedAt
  };
}

function shapeInnerLifeProfile(profile = {}, fallbackAgentId = "") {
  return {
    agentId: profile.agentId || profile.agent_id || fallbackAgentId,
    displayName: profile.displayName || profile.display_name || "",
    profileEnabled: Boolean(profile.profileEnabled ?? profile.enabled),
    profile: profile.profile || {},
    state: profile.state || {},
    createdAt: profile.createdAt || profile.created_at || null,
    updatedAt: profile.updatedAt || profile.updated_at || null
  };
}

function shapeInnerLifeProfileSummary(profile = {}) {
  const { enabled: _enabled, ...summary } = profile;
  return {
    ...summary,
    profileEnabled: Boolean(profile.profileEnabled ?? profile.enabled)
  };
}

async function handleInnerLifeTool(name, args, context) {
  const { core, currentMcpAgentId, textResult } = context;

  if (name === "innerlife_session_start") {
    const startPacket = await innerlife.startSession(core, args);
    // Bundle the Shared Line startup context so agents do not need separate
    // shared_line_list / shared_line_activate / shared_line_get round trips.
    const lineId = String(args.lineId || args.line_id || "").trim();
    let sharedLine = null;
    let activatedLine = null;
    let sharedLineError = "";
    try {
      if (lineId) {
        const activation = await continuity.activate(core, lineId, { lite: true });
        activatedLine = activation.line;
        sharedLine = activation.sharedLine;
      } else {
        sharedLine = await continuity.get(core, { agentId: currentMcpAgentId(args), lite: true });
      }
    } catch (error) {
      sharedLineError = error.message || String(error);
    }
    const linePage = await continuity.listSummaries(core, {
      agentId: currentMcpAgentId(args),
      limit: 10,
      status: "active"
    });
    // v0.6.6: session start is the path a host hook actually injects, so it
    // must carry the same bounded contracts as the individual tools. Shaping
    // only innerlife_briefing and shared_line_get would leave the largest
    // per-session payload unshaped.
    return textResult({
      ...startPacket,
      ...(startPacket.briefing ? { briefing: shapeInnerLifeBriefing(startPacket.briefing, args.detail) } : {}),
      shared_line: sharedLine ? shapeSharedLinePacket(sharedLine, args.detail === "full" ? "full" : "resume") : sharedLine,
      shared_lines: linePage.items.map(compactLineSummary),
      shared_line_page: {
        returned: linePage.items.length,
        total: linePage.total,
        limit: linePage.limit,
        offset: linePage.offset,
        hasMore: linePage.items.length < linePage.total
      },
      ...(activatedLine ? { activated_line: compactLineSummary(activatedLine) } : {}),
      ...(sharedLineError ? { shared_line_error: sharedLineError } : {})
    });
  }

  if (name === "innerlife_session_end") {
    return textResult(
      await innerlife.endSession(core, args.sessionId || args.session_id, {
        ...args,
        ...(args.agentId || args.agent_id ? { agentId: currentMcpAgentId(args) } : {})
      })
    );
  }

  if (name === "innerlife_afterthought_resolve") {
    const agentId = currentMcpAgentId(args);
    const resolution = await innerlife.resolveAfterthoughtFailure(core, args.id, {
      action: args.action,
      reason: args.reason || "",
      agentId
    });
    return textResult({
      ...resolution,
      doctor: await innerlife.doctor(core, agentId)
    });
  }

  if (name === "innerlife_sessions") {
    const page = await innerlife.recentSessionsPage(core, {
      agentId: currentMcpAgentId(args),
      limit: args.limit,
      offset: args.offset
    });
    return textResult({
      sessions: page.items.map(shapeInnerLifeSessionCatalogEntry),
      page: {
        returned: page.items.length,
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.hasMore
      }
    });
  }

  if (name === "innerlife_session_get") {
    const session = await innerlife.session(core, args.id);
    return textResult(session ? { session } : { error: "not found", id: args.id });
  }

  if (name === "innerlife_status") {
    // v0.6.6: the default read is operational state only. detail=true still
    // returns the complete snapshot, including inbox bodies and history.
    const agentId = currentMcpAgentId(args);
    const detail = normalizeInnerLifeDetail(args.detail);
    const snapshot = detail === "full" ? await innerlife.snapshot(core, agentId) : await innerlife.snapshotLite(core, agentId);
    return textResult(shapeInnerLifeStatus(snapshot, detail));
  }

  if (name === "innerlife_briefing") {
    const briefing = await innerlife.briefing(core, { ...args, agentId: currentMcpAgentId(args) });
    return textResult(shapeInnerLifeBriefing(briefing, args.detail));
  }

  if (name === "innerlife_doctor") {
    return textResult(await innerlife.doctor(core, currentMcpAgentId(args)));
  }

  if (name === "innerlife_profile_set") {
    return textResult(shapeInnerLifeProfile(await innerlife.updateProfile(core, args), args.agentId));
  }

  if (name === "innerlife_profile_list") {
    const page = await innerlife.profileSummaries(core, args);
    return textResult({
      profiles: page.items.map((profile) => ({
        ...shapeInnerLifeProfileSummary(profile),
        detailRef: { tool: "innerlife_profile_get", arguments: { agentId: profile.agentId } }
      })),
      page: {
        returned: page.items.length,
        total: page.total,
        limit: page.limit,
        offset: page.offset,
        hasMore: page.offset + page.items.length < page.total
      }
    });
  }

  if (name === "innerlife_profile_get") {
    const profile = await innerlife.profile(core, args.agentId);
    return textResult({
      profile: shapeInnerLifeProfile(profile, args.agentId)
    });
  }

  if (name === "innerlife_profile_delete") {
    // The HTTP gateway overwrites args.agentId with the caller's identity
    // header, so the delete target must come from a field the gateway never
    // touches. Falling back to agentId here would delete the caller instead.
    const targetAgentId = String(args.targetAgentId || "").trim();
    if (!targetAgentId) {
      throw new Error("innerlife_profile_delete requires targetAgentId naming the profile to delete.");
    }
    return textResult(await innerlife.deleteProfile(core, { agentId: targetAgentId }));
  }

  if (name === "innerlife_digest") {
    return textResult(await innerlife.digest(core, args));
  }

  if (name === "innerlife_share_check") {
    return textResult(shapeShareCheckResult(await innerlife.checkShareTiming(core, args)));
  }

  if (name === "innerlife_submit_inbox") {
    const agentId = currentMcpAgentId(args);
    return textResult({
      inbox: await innerlife.submitInbox(core, args),
      innerLife: await innerlife.snapshotLite(core, agentId)
    });
  }

  if (name === "innerlife_submit_fact") {
    const agentId = currentMcpAgentId(args);
    return textResult({
      inbox: await innerlife.submitInbox(core, { ...args, agentId, source: "fact", body: args.body }),
      innerLife: await innerlife.snapshotLite(core, agentId)
    });
  }

  if (name === "innerlife_submit_continuity") {
    const agentId = currentMcpAgentId(args);
    return textResult({
      inbox: await innerlife.submitInbox(core, { ...args, agentId, source: "continuity", body: args.body }),
      innerLife: await innerlife.snapshotLite(core, agentId)
    });
  }

  if (name === "innerlife_pending_shares") {
    // Summary reads project previews in SQL; full bodies require explicit
    // detail=full and remain capped to one bounded page.
    const detail = normalizeInnerLifeDetail(args.detail);
    if (detail === "full") {
      const shares = await innerlife.pendingShares(
        core,
        args.status || "pending",
        Math.min(10, Number.parseInt(String(args.limit || 3), 10) || 3),
        currentMcpAgentId(args)
      );
      return textResult(shapePendingShares(shares, detail, args.limit));
    }
    const page = await innerlife.pendingShareSummaries(core, {
      ...args,
      agentId: currentMcpAgentId(args)
    });
    return textResult({
      ...shapePendingShares(page.items, detail, page.limit, page.total),
      page: {
        limit: page.limit,
        offset: page.offset,
        returned: page.items.length,
        total: page.total,
        hasMore: page.offset + page.items.length < page.total
      }
    });
  }

  if (name === "innerlife_share_actions") {
    const actions = args.detail === "full"
      ? await innerlife.shareActions(core, args.shareId || null, Math.min(50, args.limit || 10), currentMcpAgentId(args))
      : await innerlife.shareActionSummaries(core, args.shareId || null, args.limit || 10, currentMcpAgentId(args));
    return textResult({
      actions
    });
  }

  if (name === "innerlife_mark_share") {
    try {
      return textResult(await innerlife.markShare(
        core,
        args.id,
        args.action,
        args.reason || "",
        currentMcpAgentId(args),
        args.deliveryEvidence || null
      ));
    } catch (error) {
      if (error.code !== "INNERLIFE_SHARE_INVALID_TRANSITION") throw error;
      return textResult({
        ok: false,
        error: {
          code: error.code,
          message: error.message
        },
        share: error.currentShare
      });
    }
  }

  if (name === "innerlife_daemon_status") {
    return textResult(await innerlife.daemonStatus(core, currentMcpAgentId(args)));
  }

  if (name === "innerlife_daemon_set") {
    return textResult(await innerlife.setDaemon(core, args));
  }

  if (name === "innerlife_daemon_tick") {
    return textResult(await innerlife.tickDaemon(core, args));
  }

  if (name === "innerlife_history") {
    const history = args.detail === "full"
      ? await innerlife.history(core, { agentId: currentMcpAgentId(args), limit: Math.min(50, args.limit || 10) })
      : await innerlife.historySummaries(core, { agentId: currentMcpAgentId(args), limit: args.limit || 10 });
    return textResult({
      history: args.detail === "full" ? history : history.map((item) => ({ ...item, preview: boundedText(item.preview, 400) }))
    });
  }

  if (name === "innerlife_experiences") {
    const experiences = args.detail === "full"
      ? await innerlife.experiences(core, { agentId: currentMcpAgentId(args), limit: Math.min(50, args.limit || 10) })
      : await innerlife.experienceSummaries(core, { agentId: currentMcpAgentId(args), limit: args.limit || 10 });
    return textResult({
      experiences: args.detail === "full"
        ? experiences
        : experiences.map((item) => ({ ...item, preview: boundedText(item.preview, 400) }))
    });
  }

  if (name === "innerlife_summaries") {
    const summaries = args.detail === "full"
      ? await innerlife.summaries(core, { agentId: currentMcpAgentId(args), limit: Math.min(50, args.limit || 10) })
      : await innerlife.summaryPreviews(core, { agentId: currentMcpAgentId(args), limit: args.limit || 10 });
    return textResult({
      summaries: args.detail === "full"
        ? summaries
        : summaries.map((item) => ({ ...item, summary: boundedText(item.summary, 600) }))
    });
  }

  if (name === "innerlife_explore") {
    return textResult(await innerlife.explore(core, args));
  }

  if (name === "innerlife_converge") {
    return textResult(await innerlife.converge(core, args));
  }

  return undefined;
}

module.exports = {
  handleInnerLifeTool
};
