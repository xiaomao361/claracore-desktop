const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-innerlife-share-quality-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  await runtime.saveProductSettings(app, { "innerlife.provider": "disabled" });
  await runtime.submitProductInnerLifeInbox(app, {
    agentId: "quality-agent",
    source: "continuity",
    body: "Release workflow completed, validation passed, and the Shared Line checkpoint was updated."
  });
  await runtime.setProductInnerLifeDaemon(app, { agentId: "quality-agent", action: "enable" });
  const continuityTick = await runtime.tickProductInnerLifeDaemon(app, { agentId: "quality-agent", force: true });
  if (!continuityTick.ran || continuityTick.result?.share !== null) {
    throw new Error(`Continuity-only digestion created a share: ${JSON.stringify(continuityTick)}`);
  }
  if (continuityTick.result?.shareDecision?.reason !== "context_only_inbox") {
    throw new Error(`Continuity-only share decision is wrong: ${JSON.stringify(continuityTick.result?.shareDecision)}`);
  }

  const emptyProcess = await runtime.processProductInnerLifeOnce(app, { agentId: "quality-agent" });
  if (emptyProcess.share !== null || emptyProcess.shareDecision?.reason !== "no_shareable_input") {
    throw new Error(`Empty process-once created a share: ${JSON.stringify(emptyProcess.shareDecision)}`);
  }

  const emptySession = await runtime.startProductInnerLifeSession(app, {
    agentId: "quality-agent",
    host: "quality-smoke",
    externalSessionId: "empty-quality-session"
  });
  const emptySessionEnd = await runtime.endProductInnerLifeSession(app, emptySession.session.id, {
    agentId: "quality-agent",
    summary: ""
  });
  if (emptySessionEnd.share !== null || emptySessionEnd.shareDecision?.reason !== "empty_session_summary") {
    throw new Error(`Empty session created an afterthought share: ${JSON.stringify(emptySessionEnd)}`);
  }

  const distinctBody = "A clean pipeline can still be wrong when expected business fields are absent.";
  await runtime.submitProductInnerLifeInbox(app, {
    agentId: "quality-agent",
    source: "observation",
    body: distinctBody
  });
  const first = await runtime.processProductInnerLifeOnce(app, { agentId: "quality-agent" });
  if (!first.share?.id || first.shareDecision?.reason !== "distinct_shareable_thought") {
    throw new Error(`Distinct observation did not create a share: ${JSON.stringify(first.shareDecision)}`);
  }

  await runtime.submitProductInnerLifeInbox(app, {
    agentId: "quality-agent",
    source: "observation",
    body: distinctBody
  });
  const repeated = await runtime.processProductInnerLifeOnce(app, { agentId: "quality-agent" });
  if (repeated.share !== null || repeated.shareDecision?.reason !== "similar_share_exists") {
    throw new Error(`Repeated observation was not suppressed: ${JSON.stringify(repeated.shareDecision)}`);
  }
  if (repeated.shareDecision.duplicateOf !== first.share.id || repeated.shareDecision.similarity !== 1) {
    throw new Error(`Repeated observation did not point to the original share: ${JSON.stringify(repeated.shareDecision)}`);
  }

  const secondBody = "Repairing one broken link in an existing system can be more valuable than replacing the system.";
  await runtime.submitProductInnerLifeInbox(app, {
    agentId: "quality-agent",
    source: "observation",
    body: secondBody
  });
  const second = await runtime.processProductInnerLifeOnce(app, { agentId: "quality-agent" });
  if (!second.share?.id || second.share.id === first.share.id) {
    throw new Error(`A genuinely different observation was suppressed: ${JSON.stringify(second.shareDecision)}`);
  }

  const core = await runtime.ensureProductCore(app);
  const quietSession = await runtime.startProductInnerLifeSession(app, {
    agentId: "quality-agent",
    host: "quality-smoke",
    externalSessionId: "no-share-quality-session"
  });
  const quietSessionEnd = await runtime.endProductInnerLifeSession(app, quietSession.session.id, {
    agentId: "quality-agent",
    summary: "The session ended cleanly but produced no distinct judgment worth sharing."
  });
  core.database.innerLifeGenerate = async () => "[NO_SHARE]";
  const quietAfterthought = await core.database.processPendingSessionAfterthoughts(5);
  const quietShare = await core.database.getInnerLifeShare(quietSessionEnd.share.id);
  if (quietAfterthought.processed !== 1 || quietShare.status !== "discarded") {
    throw new Error(`Session [NO_SHARE] was not discarded: ${JSON.stringify({ quietAfterthought, quietShare })}`);
  }
  const quietJob = await core.database.getInnerLifeInboxItem(quietSessionEnd.afterthoughtJob.id);
  if (quietJob.metadata?.shareDecision?.reason !== "model_no_share") {
    throw new Error(`Session [NO_SHARE] decision was not audited: ${JSON.stringify(quietJob.metadata)}`);
  }

  const emptyModelSession = await runtime.startProductInnerLifeSession(app, {
    agentId: "quality-agent",
    host: "quality-smoke",
    externalSessionId: "empty-model-output-session"
  });
  const emptyModelSessionEnd = await runtime.endProductInnerLifeSession(
    app,
    emptyModelSession.session.id,
    {
      agentId: "quality-agent",
      summary: "The model path should not publish its placeholder when generation returns empty."
    }
  );
  core.database.innerLifeGenerate = async () => "";
  const emptyModelAfterthought = await core.database.processPendingSessionAfterthoughts(5);
  const emptyModelShare = await core.database.getInnerLifeShare(emptyModelSessionEnd.share.id);
  if (emptyModelAfterthought.processed !== 1 || emptyModelShare.status !== "discarded") {
    throw new Error(`Empty model output was not discarded: ${JSON.stringify({ emptyModelAfterthought, emptyModelShare })}`);
  }
  const emptyModelJob = await core.database.getInnerLifeInboxItem(
    emptyModelSessionEnd.afterthoughtJob.id
  );
  if (emptyModelJob.metadata?.shareDecision?.reason !== "no_model_output") {
    throw new Error(`Empty model output decision was not audited: ${JSON.stringify(emptyModelJob.metadata)}`);
  }

  const failedModelSession = await runtime.startProductInnerLifeSession(app, {
    agentId: "quality-agent",
    host: "quality-smoke",
    externalSessionId: "failed-model-session"
  });
  const failedModelSessionEnd = await runtime.endProductInnerLifeSession(
    app,
    failedModelSession.session.id,
    {
      agentId: "quality-agent",
      summary: "A transient model outage must retain this afterthought for retry."
    }
  );
  core.database.innerLifeGenerate = async () => {
    const error = new Error("ECONNREFUSED");
    error.code = "ECONNREFUSED";
    throw error;
  };
  const failedModelAfterthought = await core.database.processPendingSessionAfterthoughts(5);
  const failedModelShare = await core.database.getInnerLifeShare(failedModelSessionEnd.share.id);
  const failedModelJob = await core.database.getInnerLifeInboxItem(
    failedModelSessionEnd.afterthoughtJob.id
  );
  if (
    failedModelAfterthought.processed !== 0 ||
    failedModelAfterthought.retrying !== 1 ||
    failedModelAfterthought.results[0]?.errorCode !== "INNERLIFE_AFTERTHOUGHT_GENERATION_FAILED" ||
    failedModelShare.status !== "drafting" ||
    failedModelJob.status !== "pending" ||
    failedModelJob.metadata?.retryState !== "retrying" ||
    failedModelJob.metadata?.lastErrorCode !== "INNERLIFE_AFTERTHOUGHT_GENERATION_FAILED" ||
    !failedModelJob.metadata?.nextRetryAt
  ) {
    throw new Error(`Failed model generation did not remain retryable: ${JSON.stringify({
      failedModelAfterthought,
      failedModelShare,
      failedModelJob
    })}`);
  }

  const counts = await core.database.getInnerLifeCounts("quality-agent");
  if (
    counts.drafting_shares_count !== 1 ||
    counts.pending_shares_count !== 2 ||
    counts.pending_inbox_count !== 0 ||
    counts.processed_inbox_count !== 6 ||
    counts.afterthought_retrying_count !== 1 ||
    !counts.afterthought_next_retry_at ||
    counts.thoughts_count !== 8 ||
    counts.discarded_shares_count !== 2 ||
    counts.ended_sessions_count !== 4
  ) {
    throw new Error(`InnerLife share-quality counts are wrong: ${JSON.stringify(counts)}`);
  }
  const events = await core.database.query(`
    SELECT json_extract(metadata_json, '$.shareDecision.reason') AS reason
    FROM innerlife_events
    WHERE agent_id = 'quality-agent'
    ORDER BY created_at ASC, id ASC;
  `);
  const reasons = events.map((row) => row.reason);
  for (const expected of ["context_only_inbox", "no_shareable_input", "distinct_shareable_thought", "similar_share_exists"]) {
    if (!reasons.includes(expected)) throw new Error(`Missing auditable share decision ${expected}: ${JSON.stringify(reasons)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    dataRoot,
    counts,
    firstShareId: first.share.id,
    secondShareId: second.share.id,
    duplicateOf: repeated.shareDecision.duplicateOf,
    reasons
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
