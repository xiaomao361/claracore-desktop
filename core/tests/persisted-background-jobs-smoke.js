const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const {
  SESSION_AFTERTHOUGHT_MAX_ATTEMPTS,
  sessionAfterthoughtRetrySeconds
} = require("../innerlife/services/session-lifecycle");

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function makeAfterthoughtDue(database, id) {
  await database.exec(`
    UPDATE innerlife_inbox
    SET metadata_json = json_set(
      metadata_json,
      '$.nextRetryAt',
      '2000-01-01T00:00:00.000Z'
    )
    WHERE id = ${sqlString(id)};
  `);
}

async function queueAfterthought(database, externalSessionId, summary) {
  const started = await database.startInnerLifeSession({
    agentId: "jobs-smoke",
    externalSessionId
  });
  return database.endInnerLifeSession(started.session.id, {
    agentId: "jobs-smoke",
    summary
  });
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-persisted-jobs-"));
  const databasePath = path.join(root, "claracore.db");
  let database = await initializeProductDatabase(databasePath);
  try {
    const memory = await database.createMemory({
      agentId: "jobs-smoke",
      title: "Persisted embedding job",
      body: "Embedding work must survive the request and process restart."
    });
    const started = await database.startInnerLifeSession({
      agentId: "jobs-smoke",
      externalSessionId: "persisted-afterthought-session"
    });
    database.innerLifeGenerate = async () => {
      throw new Error("Session end must not wait for model generation.");
    };
    const startedAt = performance.now();
    const ended = await database.endInnerLifeSession(started.session.id, {
      agentId: "jobs-smoke",
      summary: "Persist this afterthought and generate it after acknowledgement."
    });
    const acknowledgementMs = performance.now() - startedAt;
    assert.strictEqual(ended.afterthoughtJob?.status, "pending");
    assert(acknowledgementMs < 100, `Session end acknowledgement was too slow: ${acknowledgementMs} ms`);

    database.close();
    database = await initializeProductDatabase(databasePath);
    const pendingEmbeddingIds = await database.pendingEmbeddingMemoryIds(10);
    assert(pendingEmbeddingIds.includes(memory.id), "Pending embedding job did not survive database reopen.");
    database.innerLifeGenerate = async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return "Model-generated afterthought completed by the persisted worker.";
    };
    const workerRuns = await Promise.all([
      database.processPendingSessionAfterthoughts(5),
      database.processPendingSessionAfterthoughts(5)
    ]);
    const processed = {
      processed: workerRuns.reduce((sum, result) => sum + result.processed, 0),
      results: workerRuns.flatMap((result) => result.results)
    };
    assert.strictEqual(processed.processed, 1, "Concurrent workers processed the same persisted job twice.");
    const share = await database.getInnerLifeShare(ended.share.id);
    assert(share.body.includes("persisted worker"), "Persisted afterthought worker did not update the queued share.");
    const job = await database.getInnerLifeInboxItem(ended.afterthoughtJob.id);
    assert.strictEqual(job.status, "processed");

    const staleLease = await queueAfterthought(
      database,
      "persisted-afterthought-stale-lease",
      "Only the current lease owner may persist this generated afterthought."
    );
    const oldGenerationStarted = deferred();
    const oldGenerationFinished = deferred();
    database.innerLifeGenerate = async () => {
      oldGenerationStarted.resolve();
      return oldGenerationFinished.promise;
    };
    const oldLeaseWorker = database.processPendingSessionAfterthoughts(5);
    await oldGenerationStarted.promise;
    const oldLeaseJob = await database.getInnerLifeInboxItem(staleLease.afterthoughtJob.id);
    assert.strictEqual(oldLeaseJob.status, "processing");
    assert(oldLeaseJob.metadata.leaseToken, "A claimed afterthought must persist an owner token.");
    await database.exec(`
      UPDATE innerlife_inbox
      SET processed_at = datetime('now', '-10 minutes')
      WHERE id = ${sqlString(staleLease.afterthoughtJob.id)}
        AND status = 'processing';
    `);
    database.innerLifeGenerate = async () => (
      "The replacement lease owner persisted the only accepted afterthought."
    );
    const replacementLeaseWorker = await database.processPendingSessionAfterthoughts(5);
    assert.strictEqual(replacementLeaseWorker.processed, 1);
    oldGenerationFinished.resolve("Obsolete output from an expired afterthought lease.");
    const expiredLeaseResult = await oldLeaseWorker;
    assert.strictEqual(expiredLeaseResult.processed, 0);
    assert.strictEqual(expiredLeaseResult.staleClaims, 1);
    assert.strictEqual(expiredLeaseResult.results[0]?.status, "stale_claim");
    const staleLeaseShare = await database.getInnerLifeShare(staleLease.share.id);
    assert(
      staleLeaseShare.body.includes("replacement lease owner"),
      "An expired worker must not overwrite the current lease owner's share."
    );
    assert(
      !staleLeaseShare.body.includes("Obsolete output"),
      "An expired worker's generated output must be discarded."
    );
    const currentLeaseJob = await database.getInnerLifeInboxItem(staleLease.afterthoughtJob.id);
    assert.strictEqual(currentLeaseJob.status, "processed");
    assert.strictEqual(currentLeaseJob.metadata.leaseRecoveries, 1);
    assert.notStrictEqual(
      currentLeaseJob.metadata.completedLeaseToken,
      oldLeaseJob.metadata.leaseToken,
      "A reclaimed job must complete under a new lease token."
    );

    const recoveringSummary = "Preserve this retrying session input until the model path recovers.";
    const recovering = await queueAfterthought(
      database,
      "persisted-afterthought-recovery",
      recoveringSummary
    );
    let recoveringGenerationCalls = 0;
    database.innerLifeGenerate = async () => {
      recoveringGenerationCalls += 1;
      throw new Error("synthetic transient afterthought failure");
    };
    const firstFailure = await database.processPendingSessionAfterthoughts(5);
    assert.strictEqual(firstFailure.processed, 0);
    assert.strictEqual(firstFailure.retrying, 1);
    assert.strictEqual(firstFailure.terminalFailures, 0);
    assert.strictEqual(firstFailure.results[0]?.status, "retrying");
    assert.strictEqual(firstFailure.results[0]?.attempts, 1);
    assert.strictEqual(
      firstFailure.results[0]?.retrySeconds,
      sessionAfterthoughtRetrySeconds(1)
    );

    const persistedRetry = await database.getInnerLifeInboxItem(recovering.afterthoughtJob.id);
    assert.strictEqual(persistedRetry.status, "pending");
    assert.strictEqual(persistedRetry.body, recoveringSummary, "Retry must preserve the original session summary.");
    assert.strictEqual(persistedRetry.metadata.attempts, 1);
    assert.strictEqual(persistedRetry.metadata.retryState, "retrying");
    assert.strictEqual(persistedRetry.metadata.retrySeconds, 60);
    assert(persistedRetry.metadata.nextRetryAt, "Retry must persist the next eligible time.");
    assert.strictEqual(persistedRetry.metadata.lastError, "synthetic transient afterthought failure");
    assert(
      persistedRetry.metadata.template.includes(recoveringSummary),
      "Retry metadata must preserve the original afterthought template."
    );

    const retryingDoctor = await database.getInnerLifeDoctor("jobs-smoke");
    assert.strictEqual(retryingDoctor.afterthought.retryingCount, 1);
    assert.strictEqual(retryingDoctor.afterthought.terminalFailureCount, 0);
    assert(retryingDoctor.afterthought.nextRetryAt);
    assert(
      retryingDoctor.issues.some((issue) => issue.code === "afterthought_retrying"),
      "InnerLife Doctor must expose a retrying afterthought."
    );

    database.close();
    database = await initializeProductDatabase(databasePath);
    database.innerLifeGenerate = async () => {
      recoveringGenerationCalls += 1;
      return "Recovered afterthought generated after the persisted retry became due.";
    };
    const notDueAfterReopen = await database.processPendingSessionAfterthoughts(5);
    assert.strictEqual(notDueAfterReopen.processed, 0);
    assert.strictEqual(notDueAfterReopen.results.length, 0);
    assert.strictEqual(
      recoveringGenerationCalls,
      1,
      "A persisted future retry must not call the model on every scheduler tick."
    );

    await makeAfterthoughtDue(database, recovering.afterthoughtJob.id);
    const recovered = await database.processPendingSessionAfterthoughts(5);
    assert.strictEqual(recovered.processed, 1);
    assert.strictEqual(recoveringGenerationCalls, 2);
    const recoveredJob = await database.getInnerLifeInboxItem(recovering.afterthoughtJob.id);
    assert.strictEqual(recoveredJob.status, "processed");
    assert.strictEqual(recoveredJob.metadata.retryState, "succeeded");
    assert.strictEqual(recoveredJob.metadata.attempts, 2);
    assert.strictEqual(recoveredJob.metadata.retrySeconds, 0);
    assert.strictEqual(recoveredJob.metadata.nextRetryAt, null);
    assert.strictEqual(recoveredJob.metadata.lastError, "");
    const recoveredDoctor = await database.getInnerLifeDoctor("jobs-smoke");
    assert.strictEqual(recoveredDoctor.afterthought.retryingCount, 0);
    assert.strictEqual(recoveredDoctor.afterthought.terminalFailureCount, 0);
    assert(
      recoveredDoctor.issues.every((issue) => !issue.code.startsWith("afterthought_")),
      "Successful recovery must clear the afterthought fault signal."
    );

    const terminalSummary = "Keep this terminal afterthought source intact for explicit operator recovery.";
    const terminal = await queueAfterthought(
      database,
      "persisted-afterthought-terminal",
      terminalSummary
    );
    let terminalGenerationCalls = 0;
    database.innerLifeGenerate = async () => {
      terminalGenerationCalls += 1;
      throw new Error("synthetic permanent afterthought failure");
    };
    for (let attempt = 1; attempt <= SESSION_AFTERTHOUGHT_MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 1) {
        await makeAfterthoughtDue(database, terminal.afterthoughtJob.id);
      }
      const runs = await Promise.all([
        database.processPendingSessionAfterthoughts(5),
        database.processPendingSessionAfterthoughts(5)
      ]);
      const attemptResults = runs.flatMap((result) => result.results);
      assert.strictEqual(
        attemptResults.length,
        1,
        `Concurrent workers must claim terminal attempt ${attempt} exactly once.`
      );
      assert.strictEqual(attemptResults[0].attempts, attempt);
      assert.strictEqual(
        attemptResults[0].status,
        attempt === SESSION_AFTERTHOUGHT_MAX_ATTEMPTS ? "failed" : "retrying"
      );
      assert.strictEqual(
        attemptResults[0].retrySeconds,
        attempt === SESSION_AFTERTHOUGHT_MAX_ATTEMPTS
          ? 0
          : sessionAfterthoughtRetrySeconds(attempt)
      );
    }
    assert.strictEqual(
      terminalGenerationCalls,
      SESSION_AFTERTHOUGHT_MAX_ATTEMPTS,
      "Concurrent claims must not duplicate permanent-failure model calls."
    );

    const terminalJob = await database.getInnerLifeInboxItem(terminal.afterthoughtJob.id);
    assert.strictEqual(terminalJob.status, "failed");
    assert.strictEqual(terminalJob.body, terminalSummary);
    assert.strictEqual(terminalJob.metadata.attempts, SESSION_AFTERTHOUGHT_MAX_ATTEMPTS);
    assert.strictEqual(terminalJob.metadata.retryState, "terminal");
    assert.strictEqual(terminalJob.metadata.retrySeconds, 0);
    assert.strictEqual(terminalJob.metadata.nextRetryAt, null);
    assert(terminalJob.metadata.terminalAt);
    assert.strictEqual(terminalJob.metadata.lastError, "synthetic permanent afterthought failure");
    assert(
      terminalJob.metadata.template.includes(terminalSummary),
      "Terminal failure must retain the original generation input."
    );

    const afterTerminal = await database.processPendingSessionAfterthoughts(5);
    assert.strictEqual(afterTerminal.results.length, 0);
    assert.strictEqual(
      terminalGenerationCalls,
      SESSION_AFTERTHOUGHT_MAX_ATTEMPTS,
      "A terminal job must not be silently retried."
    );
    const terminalDoctor = await database.getInnerLifeDoctor("jobs-smoke");
    assert.strictEqual(terminalDoctor.status, "error");
    assert.strictEqual(terminalDoctor.afterthought.retryingCount, 0);
    assert.strictEqual(terminalDoctor.afterthought.terminalFailureCount, 1);
    assert.strictEqual(terminalDoctor.afterthought.lastError, "synthetic permanent afterthought failure");
    assert(
      terminalDoctor.issues.some((issue) => issue.code === "afterthought_terminal_failure"),
      "InnerLife Doctor must expose terminal afterthought failures."
    );
    const terminalStatus = await database.getInnerLifeSnapshot("jobs-smoke");
    assert.strictEqual(terminalStatus.counts.afterthought_retrying_count, 0);
    assert.strictEqual(terminalStatus.counts.afterthought_terminal_failure_count, 1);
    assert(
      terminalStatus.inbox.some((item) => (
        item.id === terminal.afterthoughtJob.id
        && item.status === "failed"
        && item.body === terminalSummary
      )),
      "InnerLife status must retain the identifiable failed job and its original summary."
    );
    assert(
      terminalStatus.doctor.issues.some((issue) => issue.code === "afterthought_terminal_failure"),
      "InnerLife status must carry the Doctor terminal-failure signal."
    );
    const retentionCounts = await database.getInnerLifeRetentionCounts();
    assert(
      retentionCounts.protected_inbox >= 1,
      "Terminal afterthought evidence must remain protected from automatic processed-inbox retention."
    );

    await assert.rejects(
      database.resolveInnerLifeSessionAfterthoughtFailure(terminal.afterthoughtJob.id, {
        action: "retry",
        agentId: "another-agent"
      }),
      /not found for this agent/,
      "Afterthought recovery must remain scoped to the owning Agent."
    );
    const requeued = await database.resolveInnerLifeSessionAfterthoughtFailure(
      terminal.afterthoughtJob.id,
      {
        action: "retry",
        agentId: "jobs-smoke",
        reason: "Model path repaired during the persisted-job smoke."
      }
    );
    assert.strictEqual(requeued.action, "retry");
    assert.strictEqual(requeued.job.status, "pending");
    assert.strictEqual(requeued.job.metadata.retryState, "pending");
    assert.strictEqual(requeued.job.metadata.attempts, 0);
    assert.strictEqual(requeued.job.metadata.lastTerminalAttempts, SESSION_AFTERTHOUGHT_MAX_ATTEMPTS);
    assert.strictEqual(requeued.job.metadata.lastTerminalError, "synthetic permanent afterthought failure");
    assert.strictEqual(requeued.job.metadata.requeueCount, 1);
    const requeuedDoctor = await database.getInnerLifeDoctor("jobs-smoke");
    assert.strictEqual(requeuedDoctor.afterthought.terminalFailureCount, 0);

    database.innerLifeGenerate = async () => (
      "Operator-retried terminal afterthought completed from its preserved original input."
    );
    const operatorRecovered = await database.processPendingSessionAfterthoughts(5);
    assert.strictEqual(operatorRecovered.processed, 1);
    const operatorRecoveredJob = await database.getInnerLifeInboxItem(terminal.afterthoughtJob.id);
    assert.strictEqual(operatorRecoveredJob.status, "processed");
    assert.strictEqual(operatorRecoveredJob.metadata.retryState, "succeeded");
    assert.strictEqual(operatorRecoveredJob.metadata.attempts, 1);
    assert.strictEqual(operatorRecoveredJob.metadata.requeueCount, 1);

    const acknowledged = await queueAfterthought(
      database,
      "persisted-afterthought-acknowledged",
      "Preserve this terminal record until an operator explicitly acknowledges it."
    );
    await database.exec(`
      UPDATE innerlife_inbox
      SET status = 'failed',
          processed_at = CURRENT_TIMESTAMP,
          metadata_json = json_set(
            metadata_json,
            '$.attempts', ${SESSION_AFTERTHOUGHT_MAX_ATTEMPTS},
            '$.retryState', 'terminal',
            '$.retrySeconds', 0,
            '$.nextRetryAt', NULL,
            '$.lastAttemptAt', '2026-07-31T00:00:00.000Z',
            '$.lastError', 'operator-reviewed terminal failure',
            '$.terminalAt', '2026-07-31T00:00:00.000Z'
          )
      WHERE id = ${sqlString(acknowledged.afterthoughtJob.id)};
    `);
    await assert.rejects(
      database.resolveInnerLifeSessionAfterthoughtFailure(acknowledged.afterthoughtJob.id, {
        action: "acknowledge",
        agentId: "jobs-smoke"
      }),
      /requires a reason/,
      "Acknowledgement must carry an audit reason."
    );
    const acknowledgement = await database.resolveInnerLifeSessionAfterthoughtFailure(
      acknowledged.afterthoughtJob.id,
      {
        action: "acknowledge",
        agentId: "jobs-smoke",
        reason: "The source summary was reviewed and no generated share is required."
      }
    );
    assert.strictEqual(acknowledgement.action, "acknowledge");
    assert.strictEqual(acknowledgement.job.status, "processed");
    assert.strictEqual(acknowledgement.job.metadata.retryState, "acknowledged");
    assert.strictEqual(
      acknowledgement.job.metadata.lastTerminalError,
      "operator-reviewed terminal failure"
    );
    assert.strictEqual(
      acknowledgement.job.metadata.acknowledgementReason,
      "The source summary was reviewed and no generated share is required."
    );
    const acknowledgedShare = await database.getInnerLifeShare(acknowledged.share.id);
    assert.strictEqual(acknowledgedShare.status, "discarded");
    assert(acknowledgedShare.decision_reason.includes("no generated share is required"));
    const resolvedDoctor = await database.getInnerLifeDoctor("jobs-smoke");
    assert.strictEqual(resolvedDoctor.afterthought.terminalFailureCount, 0);
    assert(
      resolvedDoctor.issues.every((issue) => issue.code !== "afterthought_terminal_failure"),
      "Retrying or acknowledging every terminal failure must clear the persistent Doctor error."
    );

    process.stdout.write(`${JSON.stringify({
      suite: "persisted-background-jobs-smoke",
      acknowledgementMs: Math.round(acknowledgementMs * 1000) / 1000,
      embeddingStatus: "pending-after-reopen",
      afterthoughtStatus: job.status,
      workerSource: processed.results[0]?.source,
      retryRecovered: recoveredJob.metadata.retryState,
      staleLeaseProtection: expiredLeaseResult.results[0]?.status,
      terminalAttempts: terminalJob.metadata.attempts,
      terminalDoctorStatus: terminalDoctor.status,
      terminalResolution: {
        retry: operatorRecoveredJob.metadata.retryState,
        acknowledge: acknowledgement.job.metadata.retryState,
        doctor: resolvedDoctor.status
      }
    }, null, 2)}\n`);
  } finally {
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
