const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { createSchedulers } = require("../../electron/schedulers");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase5-innerlife-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  // Pin the InnerLife model provider to disabled so afterthought generation
  // stays deterministic and offline. The shipping default now enables a hosted
  // provider, which this smoke test must not depend on or call over the network.
  await runtime.saveProductSettings(app, {
    "innerlife.provider": "disabled"
  });

  const memory = await runtime.createProductMemory(app, {
    title: "InnerLife smoke Memory",
    body: "InnerLife process once should read recent Memory context without writing old service data.",
    labels: "innerlife, phase5"
  });
  await runtime.saveProductSharedLine(app, {
    agentId: "my-agent",
    summary: "Phase 5 position: test manual InnerLife process once.",
    interpretationStatus: "confirmed",
    factsUsed: [memory.id]
  });

  const sessionStart = await runtime.startProductInnerLifeSession(app, {
    agentId: "my-agent",
    userId: "phase5-user",
    host: "phase5-smoke",
    externalSessionId: "phase5-session-001"
  });
  if (!sessionStart.session?.id) throw new Error("InnerLife session start did not create a session.");
  if (!sessionStart.share_plan || sessionStart.briefing) {
    throw new Error("InnerLife session start should return compact share_plan and omit full briefing by default.");
  }
  const core = await runtime.ensureProductCore(app);
  const fullBriefing = await core.database.getInnerLifeBriefing("my-agent");
  if (!fullBriefing.text.includes("Current position")) {
    throw new Error("InnerLife lazy briefing did not include current position.");
  }
  if (!fullBriefing.recentMemories.some((item) => item.id === memory.id)) {
    throw new Error("InnerLife lazy briefing did not include recent Memory context.");
  }
  const duplicateStart = await runtime.startProductInnerLifeSession(app, {
    agentId: "my-agent",
    userId: "phase5-user",
    host: "phase5-smoke",
    externalSessionId: "phase5-session-001"
  });
  if (duplicateStart.session.id !== sessionStart.session.id) {
    throw new Error("InnerLife session start should be idempotent for the same external session id.");
  }
  const sessionEnd = await runtime.endProductInnerLifeSession(app, sessionStart.session.id, {
    summary: "The phase5 smoke conversation ended with a reviewable afterthought."
  });
  if (sessionEnd.session.status !== "ended") throw new Error("InnerLife session end did not close the session.");
  if (!sessionEnd.share?.body.includes("Session afterthought")) {
    throw new Error("InnerLife session end did not create a reviewable afterthought share.");
  }
  if (sessionEnd.afterthoughtJob?.status !== "pending") {
    throw new Error("InnerLife session end did not persist an afterthought job before returning.");
  }
  const inboxItem = await runtime.submitProductInnerLifeInbox(app, {
    agentId: "my-agent",
    source: "phase5-smoke",
    body: "Inbox material should be consumed by manual process once."
  });
  if (!inboxItem?.id) throw new Error("InnerLife inbox submit did not create an inbox item.");

  const firstRun = await runtime.processProductInnerLifeOnce(app, {
    agentId: "my-agent",
    prompt: "Create a reviewable share candidate for this current state."
  });
  if (!firstRun.share?.id) throw new Error("InnerLife process once did not create a pending share.");
  if (!firstRun.share.body.includes("Phase 5 position")) {
    throw new Error("InnerLife share did not include Shared Line context.");
  }
  if (!firstRun.share.body.includes("InnerLife smoke Memory")) {
    throw new Error("InnerLife share did not include recent Memory context.");
  }
  if (!firstRun.share.body.includes("Inbox material should be consumed")) {
    throw new Error("InnerLife share did not include pending inbox context.");
  }
  if (firstRun.snapshot.counts.pending_shares_count !== 2) {
    throw new Error("InnerLife pending share count should include session afterthought and process-once share.");
  }
  if (firstRun.snapshot.counts.pending_inbox_count !== 0 || firstRun.snapshot.counts.processed_inbox_count !== 1) {
    throw new Error(`InnerLife inbox counts are wrong after process once: ${JSON.stringify(firstRun.snapshot.counts)}`);
  }
  const processedAfterthoughts = await core.database.processPendingSessionAfterthoughts(5);
  if (processedAfterthoughts.processed !== 1 || processedAfterthoughts.results[0]?.id !== sessionEnd.afterthoughtJob.id) {
    throw new Error(`InnerLife afterthought worker did not process the persisted job: ${JSON.stringify(processedAfterthoughts)}`);
  }

  const pendingShareCheck = await runtime.checkProductInnerLifeShareTiming(app, {
    shareId: firstRun.share.id,
    context: "The user asked to use the Phase 5 position and Manual InnerLife review now."
  });
  if (pendingShareCheck.check?.decision !== "review_first") {
    throw new Error(`InnerLife pending share timing should require review first: ${JSON.stringify(pendingShareCheck.check)}`);
  }
  if (pendingShareCheck.share.status !== "pending") {
    throw new Error("InnerLife pending share timing check should not change share status.");
  }
  const approved = await runtime.reviewProductInnerLifeShare(app, firstRun.share.id, "approve", "phase5 smoke approve");
  if (approved.status !== "approved") throw new Error("InnerLife approve did not mark the share approved.");
  const shareCheck = await runtime.checkProductInnerLifeShareTiming(app, {
    shareId: approved.id,
    context: "The user asked to use the Phase 5 position and Manual InnerLife review now."
  });
  if (shareCheck.check?.decision !== "use") {
    throw new Error(`InnerLife share timing should recommend use for matching approved context: ${JSON.stringify(shareCheck.check)}`);
  }
  if (shareCheck.share.status !== "approved") {
    throw new Error("InnerLife share timing check should not change share status.");
  }
  if (
    shareCheck.check?.metadata?.contextSource !== "provided+shared_line" ||
    !shareCheck.check?.metadata?.lineId ||
    shareCheck.check.metadata.lineId === "line_default" ||
    !Array.isArray(shareCheck.check?.metadata?.lineOverlap) ||
    shareCheck.check.metadata.lineOverlap.length === 0
  ) {
    throw new Error(`InnerLife share timing did not record Shared Line connection evidence: ${JSON.stringify(shareCheck.check)}`);
  }
  const appliedMemory = await runtime.applyProductInnerLifeShareToMemory(app, approved.id);
  if (!appliedMemory.memory?.id) throw new Error("Approved InnerLife share did not apply to Memory.");
  const memorySearch = await runtime.searchProductMemories(app, "Manual InnerLife review");
  if (!memorySearch.results.some((memoryRecord) => memoryRecord.id === appliedMemory.memory.id)) {
    throw new Error("Applied InnerLife Memory was not searchable.");
  }
  const appliedSharedLine = await runtime.applyProductInnerLifeShareToSharedLine(app, approved.id);
  if (!appliedSharedLine.sharedLine.currentPosition.summary.includes("Manual InnerLife review")) {
    throw new Error("Approved InnerLife share did not apply to Shared Line.");
  }
  if (!appliedSharedLine.sharedLine.currentPosition.factsUsed.includes(approved.id)) {
    throw new Error("Applied Shared Line did not reference the InnerLife share id.");
  }
  const deferred = await runtime.markProductInnerLifeShare(app, approved.id, "deferred", "wait for a better moment");
  if (deferred.share.status !== "deferred") throw new Error("InnerLife deferred action did not update share status.");
  let unverifiedUseBlocked = false;
  try {
    await runtime.markProductInnerLifeShare(app, approved.id, "used", "claimed without evidence");
  } catch (error) {
    unverifiedUseBlocked = String(error.message || "").includes("deliveryEvidence");
  }
  if (!unverifiedUseBlocked) throw new Error("InnerLife allowed a used share without delivery evidence.");
  const usedAgain = await runtime.markProductInnerLifeShare(
    app,
    approved.id,
    "used",
    "shared in the conversation",
    {
      conversationId: "phase5-conversation-001",
      responseId: "phase5-response-001",
      responseExcerpt: "The response actually included the Phase 5 InnerLife review thought.",
      sharedAt: new Date().toISOString(),
      source: "phase5-smoke"
    }
  );
  if (usedAgain.share.status !== "used") throw new Error("InnerLife used action did not update share status.");
  const activity = await core.database.getAgentActivitySummary();
  const activityAgent = activity.periods["30d"].agents.find((agent) => agent.agentId === "my-agent");
  if (activityAgent?.confirmedShares !== 1 || Object.prototype.hasOwnProperty.call(activityAgent || {}, "proactiveShares")) {
    throw new Error(`Agent activity did not count only confirmed shares: ${JSON.stringify(activityAgent)}`);
  }

  await runtime.setProductInnerLifeDaemon(app, { agentId: "my-agent", action: "pause" });
  const pausedDaemon = await runtime.tickProductInnerLifeDaemon(app, { agentId: "my-agent", force: true });
  if (pausedDaemon.reason !== "paused" || pausedDaemon.ran !== false) {
    throw new Error(`InnerLife daemon should stay paused by default: ${JSON.stringify(pausedDaemon.daemon)}`);
  }
  const enabledDaemon = await runtime.setProductInnerLifeDaemon(app, { agentId: "my-agent", action: "enable" });
  if (!enabledDaemon.enabled || enabledDaemon.status !== "enabled") {
    throw new Error(`InnerLife daemon did not enable: ${JSON.stringify(enabledDaemon)}`);
  }
  const daemonInbox = await runtime.submitProductInnerLifeInbox(app, {
    agentId: "my-agent",
    source: "phase5-daemon",
    body: "Daemon inbox material should be processed by daemon tick."
  });
  if (!daemonInbox?.id) throw new Error("InnerLife daemon inbox submit did not create an inbox item.");
  const daemonTick = await runtime.tickProductInnerLifeDaemon(app, { agentId: "my-agent", force: true });
  if (!daemonTick.ran || daemonTick.reason !== "processed" || !daemonTick.result?.share?.id) {
    throw new Error(`InnerLife daemon did not process pending inbox: ${JSON.stringify(daemonTick)}`);
  }
  if (!daemonTick.result.share.body.includes("Daemon inbox material should be processed")) {
    throw new Error("InnerLife daemon share did not include daemon inbox context.");
  }
  const daemonRejected = await runtime.reviewProductInnerLifeShare(app, daemonTick.result.share.id, "reject", "phase5 daemon reject");
  if (daemonRejected.status !== "rejected") throw new Error("InnerLife daemon share reject did not update status.");
  const pausedAgain = await runtime.setProductInnerLifeDaemon(app, { agentId: "my-agent", action: "pause" });
  if (pausedAgain.enabled || pausedAgain.status !== "paused") {
    throw new Error(`InnerLife daemon did not pause: ${JSON.stringify(pausedAgain)}`);
  }

  const recoveryEnabled = await runtime.setProductInnerLifeDaemon(app, { agentId: "my-agent", action: "enable" });
  if (!recoveryEnabled.enabled) throw new Error("InnerLife daemon did not enable for recovery test.");
  const recoveryInbox = await runtime.submitProductInnerLifeInbox(app, {
    agentId: "my-agent",
    source: "phase5-daemon-recovery",
    body: "Daemon recovery inbox material should survive a failed tick."
  });
  if (!recoveryInbox?.id) throw new Error("InnerLife daemon recovery inbox submit did not create an inbox item.");
  const { database: recoveryDatabase } = await runtime.ensureProductCore(app);
  const originalProcessOnce = recoveryDatabase.processInnerLifeOnce.bind(recoveryDatabase);
  recoveryDatabase.processInnerLifeOnce = async () => {
    throw new Error("phase5 forced daemon failure");
  };
  let failureThrown = false;
  try {
    await recoveryDatabase.tickInnerLifeDaemon({ agentId: "my-agent", force: true });
  } catch (error) {
    failureThrown = error.message.includes("phase5 forced daemon failure");
  } finally {
    recoveryDatabase.processInnerLifeOnce = originalProcessOnce;
  }
  if (!failureThrown) throw new Error("InnerLife daemon recovery test did not throw the forced failure.");
  const failedDaemon = await recoveryDatabase.ensureInnerLifeDaemonState("my-agent");
  if (
    failedDaemon.status !== "error" ||
    !failedDaemon.lastError.includes("phase5 forced daemon failure") ||
    failedDaemon.metadata.failureCount !== 1 ||
    failedDaemon.metadata.retrySeconds < 1
  ) {
    throw new Error(`InnerLife daemon failure state is wrong: ${JSON.stringify(failedDaemon)}`);
  }
  const failedSnapshot = await runtime.buildProductSnapshot(app);
  if (failedSnapshot.innerLife.counts.pending_inbox_count !== 1) {
    throw new Error("InnerLife daemon failure should leave inbox material pending for retry.");
  }
  const failedDoctor = await recoveryDatabase.getInnerLifeDoctor("my-agent");
  if (
    failedDoctor.status !== "warn" ||
    !failedDoctor.issues.some((issue) => issue.code === "daemon_retrying" && issue.message.includes("phase5 forced daemon failure")) ||
    !failedDoctor.nextActions.some((action) => action.includes("retry"))
  ) {
    throw new Error(`InnerLife doctor did not report daemon recovery guidance: ${JSON.stringify(failedDoctor)}`);
  }
  const recoveredTick = await recoveryDatabase.tickInnerLifeDaemon({ agentId: "my-agent", force: true });
  if (!recoveredTick.ran || recoveredTick.reason !== "processed" || !recoveredTick.result?.share?.id) {
    throw new Error(`InnerLife daemon did not recover after failure: ${JSON.stringify(recoveredTick)}`);
  }
  if (recoveredTick.daemon.status !== "enabled" || recoveredTick.daemon.metadata.failureCount !== 0) {
    throw new Error(`InnerLife daemon recovery did not clear failure state: ${JSON.stringify(recoveredTick.daemon)}`);
  }
  const recoveryRejected = await runtime.reviewProductInnerLifeShare(app, recoveredTick.result.share.id, "reject", "phase5 daemon recovery reject");
  if (recoveryRejected.status !== "rejected") throw new Error("InnerLife daemon recovery share reject did not update status.");
  const recoveryPaused = await runtime.setProductInnerLifeDaemon(app, { agentId: "my-agent", action: "pause" });
  if (recoveryPaused.status !== "paused") throw new Error("InnerLife daemon did not pause after recovery test.");
  const recoveredDoctor = await recoveryDatabase.getInnerLifeDoctor("my-agent");
  if (recoveredDoctor.status !== "ok" || !recoveredDoctor.nextActions.includes("No recovery action is needed.")) {
    throw new Error(`InnerLife doctor did not clear after recovery: ${JSON.stringify(recoveredDoctor)}`);
  }

  const digestInbox = await runtime.submitProductInnerLifeInbox(app, {
    agentId: "my-agent",
    source: "phase5-digest",
    body: "Digest material should be stored in an explicit digest run."
  });
  if (!digestInbox?.id) throw new Error("InnerLife digest inbox submit did not create an inbox item.");
  const digest = await runtime.runProductInnerLifeDigest(app, {
    agentId: "my-agent",
    mode: "light",
    prompt: "Create a digest record without making a share."
  });
  if (!digest.digest?.summary.includes("Digest material should be stored")) {
    throw new Error("InnerLife digest did not include pending inbox material.");
  }
  if (digest.snapshot.counts.digest_runs_count !== 1 || digest.snapshot.counts.pending_inbox_count !== 0) {
    throw new Error(`InnerLife digest counts are wrong: ${JSON.stringify(digest.snapshot.counts)}`);
  }

  const secondRun = await runtime.processProductInnerLifeOnce(app, {
    agentId: "my-agent",
    prompt: "Create a distinct review candidate for Shared Line timing validation."
  });
  if (!secondRun.share?.id) throw new Error("Second InnerLife process once did not create a pending share.");
  const implicitLineCheck = await runtime.checkProductInnerLifeShareTiming(app, {
    agentId: "my-agent",
    shareId: secondRun.share.id
  });
  if (implicitLineCheck.check?.decision !== "review_first") {
    throw new Error(`InnerLife share timing should use Shared Line context when no explicit context is provided: ${JSON.stringify(implicitLineCheck.check)}`);
  }
  if (
    implicitLineCheck.check?.metadata?.contextSource !== "shared_line" ||
    !implicitLineCheck.check?.metadata?.lineId ||
    implicitLineCheck.check.metadata.lineId === "line_default" ||
    !Array.isArray(implicitLineCheck.check?.metadata?.lineOverlap) ||
    implicitLineCheck.check.metadata.lineOverlap.length === 0
  ) {
    throw new Error(`InnerLife implicit Shared Line timing metadata is wrong: ${JSON.stringify(implicitLineCheck.check)}`);
  }
  const rejected = await runtime.reviewProductInnerLifeShare(app, secondRun.share.id, "reject", "phase5 smoke reject");
  if (rejected.status !== "rejected") throw new Error("InnerLife reject did not mark the share rejected.");
  const discarded = await runtime.markProductInnerLifeShare(app, sessionEnd.share.id, "discarded", "session afterthought is not useful");
  if (discarded.share.status !== "discarded") throw new Error("InnerLife discarded action did not update share status.");

  const snapshot = await runtime.buildProductSnapshot(app);
  if (!snapshot.data.databasePath.startsWith(dataRoot)) {
    throw new Error(`InnerLife database escaped product data root: ${snapshot.data.databasePath}`);
  }
  if (snapshot.innerLife.counts.used_shares_count !== 1 || snapshot.innerLife.counts.rejected_shares_count !== 3 || snapshot.innerLife.counts.discarded_shares_count !== 1) {
    throw new Error(`Unexpected InnerLife review counts: ${JSON.stringify(snapshot.innerLife.counts)}`);
  }
  if (snapshot.innerLife.counts.pending_shares_count !== 0) {
    throw new Error("InnerLife should have no pending shares after marking the session afterthought discarded.");
  }
  if (snapshot.innerLife.counts.ended_sessions_count !== 1) {
    throw new Error("InnerLife ended session count should be 1.");
  }
  const { database } = await runtime.ensureProductCore(app);
  const rows = await database.query(`
    SELECT
      (SELECT COUNT(*) FROM innerlife_events) AS events_count,
      (SELECT COUNT(*) FROM innerlife_thoughts) AS thoughts_count,
      (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'used') AS used_count,
      (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'rejected') AS rejected_count,
      (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'discarded') AS discarded_count,
      (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'ended') AS ended_sessions_count,
      (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'processed') AS processed_inbox_count,
      (SELECT COUNT(*) FROM innerlife_share_actions) AS share_actions_count,
      (SELECT COUNT(*) FROM innerlife_digest_runs) AS digest_runs_count,
      (SELECT COUNT(*) FROM innerlife_share_checks) AS share_checks_count,
      (SELECT tick_count FROM innerlife_daemon_state WHERE agent_id = 'my-agent') AS daemon_tick_count,
      (SELECT status FROM innerlife_daemon_state WHERE agent_id = 'my-agent') AS daemon_status;
  `);
  const row = rows[0] || {};
  if (
    row.events_count !== 6 ||
    row.thoughts_count !== 6 ||
    row.used_count !== 1 ||
    row.rejected_count !== 3 ||
    row.discarded_count !== 1 ||
    row.ended_sessions_count !== 1 ||
    row.processed_inbox_count !== 5 ||
    row.share_actions_count !== 3 ||
    row.digest_runs_count !== 1 ||
    row.share_checks_count !== 3 ||
    row.daemon_tick_count !== 3 ||
    row.daemon_status !== "paused"
  ) {
    throw new Error(`InnerLife SQLite counts are wrong: ${JSON.stringify(row)}`);
  }

  const otherSession = await runtime.startProductInnerLifeSession(app, {
    agentId: "other-agent",
    host: "other-client",
    externalSessionId: "other-conversation"
  });
  let crossAgentSessionEndBlocked = false;
  try {
    await runtime.endProductInnerLifeSession(app, otherSession.session.id, {
      agentId: "my-agent",
      summary: "Wrong agent must not close this session."
    });
  } catch (error) {
    crossAgentSessionEndBlocked = String(error.message || "").includes("not found");
  }
  if (!crossAgentSessionEndBlocked) {
    throw new Error("InnerLife allowed one agent to end another agent's session.");
  }
  const otherEnded = await runtime.endProductInnerLifeSession(app, otherSession.session.id, {
    agentId: "other-agent",
    summary: "Other agent data must not leak into my-agent status or actions."
  });
  const scopedSnapshot = await database.getInnerLifeSnapshotLite("my-agent");
  const globalSnapshot = await database.getInnerLifeSnapshotLite("all");
  if (scopedSnapshot.counts.pending_shares_count !== 0 || globalSnapshot.counts.pending_shares_count !== 1) {
    throw new Error(`InnerLife agent-scoped counts are not isolated: ${JSON.stringify({ scoped: scopedSnapshot.counts, global: globalSnapshot.counts })}`);
  }
  const scopedShares = await database.listInnerLifeShares("pending", 20, "my-agent");
  if (scopedShares.some((share) => share.agent_id !== "my-agent")) {
    throw new Error(`InnerLife pending shares leaked across agents: ${JSON.stringify(scopedShares)}`);
  }
  let crossAgentActionBlocked = false;
  try {
    await database.markInnerLifeShare(otherEnded.share.id, "discarded", "wrong caller", "my-agent");
  } catch (error) {
    crossAgentActionBlocked = String(error.message || "").includes("another agent");
  }
  if (!crossAgentActionBlocked) {
    throw new Error("InnerLife allowed one agent to act on another agent's share.");
  }
  await database.markInnerLifeShare(otherEnded.share.id, "discarded", "owner cleanup", "other-agent");

  await runtime.saveProductSettings(app, {
    "innerlife.loop_seconds": 1,
    "innerlife.provider": "disabled"
  });
  for (const agentId of ["codex", "lara"]) {
    await runtime.setProductInnerLifeDaemon(app, { agentId, action: "enable" });
    await runtime.submitProductInnerLifeInbox(app, {
      agentId,
      source: "phase5-multi-agent-scheduler",
      body: `${agentId} scheduled inbox should be processed without starving another agent.`
    });
  }
  await runtime.setProductInnerLifeDaemon(app, { agentId: "idle-agent", action: "enable" });
  await database.exec(`
    UPDATE innerlife_daemon_state
    SET next_run_at = CURRENT_TIMESTAMP
    WHERE agent_id IN ('codex', 'lara', 'idle-agent');
  `);
  const schedulerNotifications = [];
  const schedulers = createSchedulers({
    app,
    ensureProductCore: runtime.ensureProductCore,
    isQuitting: () => false,
    notifyRuntimeChanged: (scope, detail) => schedulerNotifications.push({ scope, detail }),
    runProductMemoryMaintenance: async () => ({}),
    saveProductSettings: runtime.saveProductSettings,
    tickProductInnerLifeDaemon: runtime.tickProductInnerLifeDaemon
  });
  await schedulers.runInnerLifeScheduledTick();
  const multiAgentRows = await database.query(`
    SELECT
      d.agent_id,
      d.last_result,
      d.tick_count,
      (SELECT COUNT(*) FROM innerlife_inbox i WHERE i.agent_id = d.agent_id AND i.status = 'pending') AS pending_count
    FROM innerlife_daemon_state d
    WHERE d.agent_id IN ('codex', 'lara', 'idle-agent')
    ORDER BY d.agent_id;
  `);
  const processedAgentRows = multiAgentRows.filter((state) => state.agent_id === "codex" || state.agent_id === "lara");
  const idleAgentRow = multiAgentRows.find((state) => state.agent_id === "idle-agent");
  if (
    multiAgentRows.length !== 3 ||
    processedAgentRows.some((state) => !String(state.last_result || "").startsWith("processed") || state.tick_count < 1 || state.pending_count !== 0) ||
    idleAgentRow?.last_result !== "idle" ||
    idleAgentRow?.tick_count !== 1
  ) {
    throw new Error(`InnerLife multi-agent scheduler did not tick every enabled agent: ${JSON.stringify(multiAgentRows)}`);
  }
  const notifiedAgentIds = new Set(
    schedulerNotifications
      .filter((item) => item.scope === "innerlife-daemon")
      .map((item) => item.detail?.agentId)
  );
  if (!notifiedAgentIds.has("codex") || !notifiedAgentIds.has("lara")) {
    throw new Error(`InnerLife multi-agent scheduler notifications are incomplete: ${JSON.stringify(schedulerNotifications)}`);
  }

  const isolatedTicks = [];
  const isolatedNotifications = [];
  const isolatedSchedulers = createSchedulers({
    app,
    ensureProductCore: async () => ({
      database: {
        processPendingSessionAfterthoughts: async () => { throw new Error("synthetic afterthought failure"); },
        listEnabledInnerLifeDaemonAgentIds: async () => ["codex", "lara"]
      }
    }),
    isQuitting: () => false,
    notifyRuntimeChanged: (scope, detail) => isolatedNotifications.push({ scope, detail }),
    runProductMemoryMaintenance: async () => ({}),
    saveProductSettings: async () => ({}),
    tickProductInnerLifeDaemon: async (_app, input) => {
      isolatedTicks.push(input.agentId);
      return { ran: false, reason: "idle" };
    }
  });
  await isolatedSchedulers.runInnerLifeScheduledTick();
  if (isolatedTicks.join(",") !== "codex,lara") {
    throw new Error(`Afterthought failure blocked daemon agents: ${JSON.stringify(isolatedTicks)}`);
  }
  if (!isolatedNotifications.some((item) => item.scope === "innerlife-session-afterthought-error")) {
    throw new Error(`Afterthought failure was not surfaced independently: ${JSON.stringify(isolatedNotifications)}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dataRoot,
        databasePath: snapshot.data.databasePath,
        approvedShareId: approved.id,
        rejectedShareId: rejected.id,
        sessionId: sessionStart.session.id,
        appliedMemoryId: appliedMemory.memory.id,
        appliedSharedLineId: appliedSharedLine.sharedLine.lineId,
        counts: snapshot.innerLife.counts
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
