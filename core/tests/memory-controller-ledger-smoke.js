const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { sqlString } = require("../db/helpers");

async function expectRejection(operation, fragment) {
  try {
    await operation;
  } catch (error) {
    assert.ok(error.message.includes(fragment), `Expected '${fragment}', got '${error.message}'.`);
    return;
  }
  throw new Error(`Expected operation to reject with '${fragment}'.`);
}

async function semanticFingerprint(database) {
  const rows = await database.query(`
    SELECT
      (SELECT COUNT(*) FROM memories) AS memories,
      (SELECT COUNT(*) FROM memory_labels) AS memory_labels,
      (SELECT COUNT(*) FROM memory_links) AS memory_links,
      (SELECT COUNT(*) FROM continuity_lines) AS continuity_lines,
      (SELECT COUNT(*) FROM current_positions) AS current_positions,
      (SELECT COUNT(*) FROM innerlife_shares) AS innerlife_shares;
  `);
  return rows[0];
}

async function createEvent(database, suffix, overrides = {}) {
  return database.recordMemoryControlEvent({
    policyVersion: "stage-a-v1",
    policyMode: "observe",
    agentId: "codex",
    clientId: "ledger-smoke",
    conversationId: "conversation-ledger-smoke",
    queryHash: `sha256:${suffix}`,
    features: { fixture: suffix },
    stageAAction: "RETRIEVE",
    stageAReason: "explicit_history_request",
    stageBAction: "ABSTAIN",
    stageBReason: "low_relevance",
    searchParams: { limit: 3, timeView: "current" },
    candidates: [{ id: `mem_${suffix}`, score: 0.7 }],
    cacheStatus: "miss",
    searchLatencyMs: 12,
    totalLatencyMs: 15,
    estimatedTokens: 0,
    resultStatus: "abstained",
    ...overrides
  });
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-controller-ledger-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  const { database } = await runtime.ensureProductCore(app);
  const tables = new Set((await database.query("SELECT name FROM sqlite_master WHERE type = 'table';")).map((row) => row.name));
  assert.ok(tables.has("memory_control_events"), "memory_control_events table is missing.");
  assert.ok(tables.has("memory_control_feedback"), "memory_control_feedback table is missing.");
  const migrations = new Set((await database.query("SELECT id FROM schema_migrations;")).map((row) => row.id));
  assert.ok(migrations.has("004_memory_controller_ledger"), "Memory Controller migration was not recorded.");

  const semanticBefore = await semanticFingerprint(database);
  const noop = await database.recordMemoryControlEvent({
    policyVersion: "stage-a-v1",
    policyMode: "observe",
    agentId: "codex",
    clientId: "ledger-smoke",
    conversationId: "conversation-ledger-smoke",
    queryHash: "sha256:noop",
    queryPreview: "x".repeat(300),
    prompt: "This full prompt must never be persisted by the ledger repository.",
    features: { promptLength: 64 },
    stageAAction: "NOOP",
    stageAReason: "ordinary_current_turn",
    resultStatus: "completed"
  });
  assert.equal(noop.queryPreview.length, 160, "Query preview was not bounded.");
  assert.deepEqual(noop.injectedIds, [], "Observe-only NOOP should not record injected ids.");
  const columns = new Set((await database.query("PRAGMA table_info(memory_control_events);")).map((row) => row.name));
  assert.ok(!columns.has("prompt") && !columns.has("prompt_json"), "Ledger schema must not contain a full-prompt column.");
  const rawNoop = (await database.query(`SELECT * FROM memory_control_events WHERE id = ${sqlString(noop.id)};`))[0];
  assert.ok(!JSON.stringify(rawNoop).includes("This full prompt"), "Ledger persisted a full prompt.");

  const retrieval = await createEvent(database, "retrieval");
  const feedback = await database.recordMemoryControlFeedback({
    decisionId: retrieval.id,
    feedbackType: "outcome_unknown",
    source: "ledger-smoke",
    conversationId: retrieval.conversationId,
    memoryIds: [],
    evidence: { reason: "No response lifecycle exists in Slice 1." },
    idempotencyKey: "ledger-smoke:retrieval:unknown"
  });
  const duplicateFeedback = await database.recordMemoryControlFeedback({
    decisionId: retrieval.id,
    feedbackType: "outcome_unknown",
    source: "ledger-smoke",
    idempotencyKey: "ledger-smoke:retrieval:unknown"
  });
  assert.equal(duplicateFeedback.id, feedback.id, "Feedback idempotency did not return the existing row.");
  assert.equal((await database.listMemoryControlFeedback({ decisionId: retrieval.id })).length, 1);
  assert.equal((await database.getMemoryControlEvent(retrieval.id)).feedbackCount, 1);

  await expectRejection(
    database.recordMemoryControlEvent({ policyVersion: "stage-a-v1", stageAAction: "MAYBE", stageAReason: "bad", resultStatus: "completed" }),
    "stageAAction"
  );
  await expectRejection(
    database.recordMemoryControlEvent({
      policyVersion: "stage-a-v1",
      stageAAction: "NOOP",
      stageAReason: "ordinary_current_turn",
      resultStatus: "completed",
      features: { oversized: "x".repeat(5000) }
    }),
    "features exceeds"
  );
  await expectRejection(
    database.recordMemoryControlFeedback({ decisionId: "missing", feedbackType: "used", source: "smoke" }),
    "decision not found"
  );

  const oldWithoutFeedback = await createEvent(database, "old-no-feedback");
  const oldWithFeedback = await createEvent(database, "old-with-feedback");
  await database.recordMemoryControlFeedback({
    decisionId: oldWithFeedback.id,
    feedbackType: "wrong",
    source: "user-correction",
    idempotencyKey: "ledger-smoke:old:wrong"
  });
  await database.exec(`
    UPDATE memory_control_events
    SET created_at = datetime('now', '-45 days')
    WHERE id IN (${sqlString(oldWithoutFeedback.id)}, ${sqlString(oldWithFeedback.id)});
  `);

  const dryRun = await database.cleanupMemoryControlLedger({ maxAgeDays: 30, feedbackMaxAgeDays: 180, maxEvents: 100, dryRun: true });
  assert.equal(dryRun.deleted, 1, `Dry-run should select only the old event without feedback: ${JSON.stringify(dryRun)}`);
  assert.equal(dryRun.reasons.ordinaryAge, 1);
  assert.ok(await database.getMemoryControlEvent(oldWithoutFeedback.id), "Dry-run deleted an event.");
  const ageCleanup = await database.cleanupMemoryControlLedger({ maxAgeDays: 30, feedbackMaxAgeDays: 180, maxEvents: 100 });
  assert.equal(ageCleanup.deleted, 1);
  assert.equal(await database.getMemoryControlEvent(oldWithoutFeedback.id), null);
  assert.ok(await database.getMemoryControlEvent(oldWithFeedback.id), "Feedback-aware retention removed a protected event too early.");

  const capacityCleanup = await database.cleanupMemoryControlLedger({ maxAgeDays: 365, feedbackMaxAgeDays: 365, maxEvents: 2 });
  assert.equal(capacityCleanup.after.eventCount, 2, "Hard event cap was not enforced.");
  assert.ok(await database.getMemoryControlEvent(retrieval.id), "Capacity cleanup should prefer deleting events without feedback.");
  assert.ok(await database.getMemoryControlEvent(oldWithFeedback.id), "Capacity cleanup should preserve feedback-bearing events when possible.");

  await database.exec(`
    UPDATE memory_control_events
    SET created_at = datetime('now', '-200 days')
    WHERE id = ${sqlString(oldWithFeedback.id)};
  `);
  const feedbackExpiry = await database.cleanupMemoryControlLedger({ maxAgeDays: 30, feedbackMaxAgeDays: 180, maxEvents: 100 });
  assert.equal(feedbackExpiry.reasons.feedbackAge, 1, "Expired feedback-bearing event was not selected.");
  assert.equal(feedbackExpiry.feedbackRowsDeleted, 1, "Feedback cascade count was not reported.");
  assert.equal((await database.listMemoryControlFeedback({ decisionId: oldWithFeedback.id })).length, 0, "Expired feedback did not cascade.");

  const semanticAfter = await semanticFingerprint(database);
  assert.deepEqual(semanticAfter, semanticBefore, "Controller ledger mutated semantic domain tables.");
  console.log(JSON.stringify({
    suite: "memory-controller-ledger-smoke",
    migration: "004_memory_controller_ledger",
    semanticReadOnly: true,
    finalStats: await database.getMemoryControlLedgerStats(),
    retention: {
      dryRun,
      ageCleanup,
      capacityCleanup,
      feedbackExpiry
    }
  }, null, 2));
  database.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
