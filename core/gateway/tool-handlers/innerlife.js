const innerlife = require("../../innerlife");

async function handleInnerLifeTool(name, args, context) {
  const { core, currentMcpAgentId, textResult } = context;

  if (name === "innerlife_session_start") {
    return textResult(await innerlife.startSession(core, args));
  }

  if (name === "innerlife_session_end") {
    return textResult(
      await innerlife.endSession(core, args.sessionId, { ...args, agentId: currentMcpAgentId(args) })
    );
  }

  if (name === "innerlife_sessions") {
    return textResult({
      sessions: await innerlife.recentSessions(core, currentMcpAgentId(args), args.limit || 20)
    });
  }

  if (name === "innerlife_status") {
    return textResult(await innerlife.snapshot(core));
  }

  if (name === "innerlife_briefing") {
    return textResult(await innerlife.briefing(core, currentMcpAgentId(args)));
  }

  if (name === "innerlife_doctor") {
    return textResult(await innerlife.doctor(core, currentMcpAgentId(args)));
  }

  if (name === "innerlife_profile_set") {
    return textResult(await innerlife.updateProfile(core, args));
  }

  if (name === "innerlife_profile_list") {
    return textResult({
      profiles: await innerlife.profiles(core, args)
    });
  }

  if (name === "innerlife_profile_delete") {
    return textResult(await innerlife.deleteProfile(core, args));
  }

  if (name === "innerlife_digest") {
    return textResult(await innerlife.digest(core, args));
  }

  if (name === "innerlife_share_check") {
    return textResult(await innerlife.checkShareTiming(core, args));
  }

  if (name === "innerlife_submit_inbox") {
    return textResult({
      inbox: await innerlife.submitInbox(core, args),
      innerLife: await innerlife.snapshot(core)
    });
  }

  if (name === "innerlife_submit_fact") {
    return textResult({
      inbox: await innerlife.submitInbox(core, { ...args, agentId: currentMcpAgentId(args), source: "fact", body: args.body }),
      innerLife: await innerlife.snapshot(core)
    });
  }

  if (name === "innerlife_submit_continuity") {
    return textResult({
      inbox: await innerlife.submitInbox(core, { ...args, agentId: currentMcpAgentId(args), source: "continuity", body: args.body }),
      innerLife: await innerlife.snapshot(core)
    });
  }

  if (name === "innerlife_pending_shares") {
    return textResult({
      shares: await innerlife.pendingShares(core, args.status || "pending", args.limit || 20)
    });
  }

  if (name === "innerlife_share_actions") {
    return textResult({
      actions: await innerlife.shareActions(core, args.shareId || null, args.limit || 20)
    });
  }

  if (name === "innerlife_mark_share") {
    return textResult(await innerlife.markShare(core, args.id, args.action, args.reason || ""));
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
    return textResult({
      history: await innerlife.history(core, { agentId: currentMcpAgentId(args), limit: args.limit || 20 })
    });
  }

  if (name === "innerlife_experiences") {
    return textResult({
      experiences: await innerlife.experiences(core, { agentId: currentMcpAgentId(args), limit: args.limit || 20 })
    });
  }

  if (name === "innerlife_summaries") {
    return textResult({
      summaries: await innerlife.summaries(core, { agentId: currentMcpAgentId(args), limit: args.limit || 10 })
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
