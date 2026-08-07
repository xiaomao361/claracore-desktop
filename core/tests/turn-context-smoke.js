const assert = require("assert");
const { arbitrateAutomaticContext } = require("../gateway/auto-context");
const {
  MEMORY_TIMEOUT_MS,
  TURN_BUDGET_MS,
  createTurnContextService
} = require("../gateway/turn-context");

function share(id, body, overrides = {}) {
  return { id, agent_id: "clara", status: "pending", body, ...overrides };
}

function memoryPacket(overrides = {}) {
  return {
    decisionId: "decision-1",
    action: "INJECT_TOP1",
    policyMode: "canary",
    context: "The gateway ambiguity refusal is bounded to five candidates.",
    ...overrides
  };
}

function serviceWith(overrides = {}) {
  return createTurnContextService({
    runMemoryController: async () => memoryPacket(),
    ...overrides
  });
}

function checkBudgetArithmetic() {
  assert.ok(
    MEMORY_TIMEOUT_MS < TURN_BUDGET_MS,
    `Memory timeout ${MEMORY_TIMEOUT_MS} must fit inside the ${TURN_BUDGET_MS}ms turn budget.`
  );
  assert.ok(MEMORY_TIMEOUT_MS < 2500, "Memory must be given less than the Controller's own hard timeout.");
}

function checkPortContract() {
  assert.throws(() => createTurnContextService({}), /requires ports/);
}

// InnerLife is reached through innerlife_share_check, not through automatic
// delivery. Topical relevance was never the right gate — a waiting thought does
// not have to be about the current topic. What makes a share wrong is the
// register, which the server cannot read, so the model owns the decision.
async function checkInnerLifeIsNotCollected() {
  let sharesTouched = false;
  const service = createTurnContextService({
    runMemoryController: async () => memoryPacket(),
    // Present but must never be reached; a port that is not in the contract
    // cannot be called by name.
    listPendingShares: async () => {
      sharesTouched = true;
      return [share("s1", "a waiting thought")];
    }
  });
  const collected = await service.collect({}, { prompt: "anything at all here", agentId: "clara" });
  assert.strictEqual(sharesTouched, false, "Automatic collection must not read InnerLife shares.");
  assert.deepStrictEqual(collected.shareCandidates, [], "Automatic context must carry no share candidates.");
  assert.strictEqual(
    collected.domainStatus.innerlife,
    "not_collected",
    "InnerLife must report not_collected, which is not the same as having nothing waiting."
  );

  // An abstain caused by no Memory candidate is a plain abstain, not a degraded
  // one: a domain that is deliberately not collected is not a broken domain.
  const decided = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: [],
    shareCandidates: collected.shareCandidates,
    domainStatus: collected.domainStatus
  });
  assert.strictEqual(decided.decision, "abstain");
  assert.strictEqual(decided.reason, "no_eligible_candidate");
}



function checkMemoryScoreIsReal() {
  // Hardcoding Memory relevance to 1 made any injected Memory outrank every
  // share permanently, so InnerLife could never win a turn while Memory was
  // live.
  const weakMemory = {
    decisionId: "d1",
    action: "INJECT_TOP1",
    policyMode: "canary",
    context: "a weakly related memory",
    stageB: { selectedIds: ["m1"] },
    candidates: [{ id: "m1", score: 0.4, stateRole: "current" }]
  };
  const strongShare = {
    domain: "innerlife",
    id: "s1",
    agentId: "clara",
    status: "pending",
    selected: true,
    relevance: 0.9,
    preview: "a strongly related waiting thought"
  };
  const decided = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: [{ ...weakMemory, agentId: "clara", relevance: 0.4, stateRole: "current", sensitivity: "normal", id: "m1" }],
    shareCandidates: [strongShare]
  });
  assert.strictEqual(decided.selected.domain, "innerlife", "A 0.9 share must beat a 0.4 Memory.");
}

async function checkCollectorForwardsRealScore() {
  const service = serviceWith({
    runMemoryController: async () => ({
      decisionId: "d1",
      action: "INJECT_TOP1",
      policyMode: "canary",
      context: "injected memory body",
      stageB: { selectedIds: ["m1"] },
      candidates: [{ id: "m1", score: 0.42, stateRole: "current" }]
    }),
    listPendingShares: async () => []
  });
  const collected = await service.collect({}, { prompt: "anything here at all", agentId: "clara" });
  assert.strictEqual(
    collected.memoryCandidates[0].relevance,
    0.42,
    "Collection must forward the Controller's real score, not a hardcoded 1."
  );
  assert.strictEqual(collected.memoryCandidates[0].id, "m1", "The candidate id must be the selected Memory, not the decision id.");
}

async function checkCollectionShape() {
  const collected = await serviceWith().collect({}, { prompt: "bounded ambiguity candidates", agentId: "clara" });
  assert.deepStrictEqual(collected.domainStatus, { memory: "ok", innerlife: "not_collected" });
  assert.strictEqual(collected.memoryCandidates.length, 1);
  assert.strictEqual(collected.memoryCandidates[0].policyMode, "canary");

  // An empty prompt does no domain work at all.
  const skipped = await serviceWith().collect({}, { prompt: "   ", agentId: "clara" });
  assert.deepStrictEqual(skipped.domainStatus, { memory: "skipped", innerlife: "not_collected" });
  assert.deepStrictEqual(skipped.memoryCandidates, []);
}

async function checkPartialFailure() {
  // One domain failing must not discard a valid winner from the other, and the
  // failure must stay visible rather than looking like a quiet turn.
  const memoryDown = serviceWith({
    runMemoryController: async () => {
      throw new Error("controller exploded");
    }
  });
  const collected = await memoryDown.collect({}, { prompt: "bounded ambiguity candidates for the refusal", agentId: "clara" });
  assert.strictEqual(collected.domainStatus.memory, "error");
  assert.strictEqual(collected.memoryCandidates.length, 0);

  // A host may still supply its own candidates on the compatibility path, and a
  // broken Memory domain must not discard them.
  const decided = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: collected.memoryCandidates,
    shareCandidates: [
      { id: "s1", agentId: "clara", status: "pending", selected: true, relevance: 0.9, preview: "a host-supplied candidate" }
    ],
    domainStatus: collected.domainStatus
  });
  assert.strictEqual(decided.domainStatus.memory, "error", "The arbiter must carry the domain status through.");
  assert.strictEqual(decided.decision, "deliver_one", "A healthy supplied candidate must survive a broken domain.");
}

async function checkTimeoutIsNotSilence() {
  const slow = serviceWith({
    runMemoryController: () => new Promise((resolve) => setTimeout(() => resolve(memoryPacket()), MEMORY_TIMEOUT_MS + 200))
  });
  const collected = await slow.collect({}, { prompt: "anything at all here", agentId: "clara" });
  assert.strictEqual(collected.domainStatus.memory, "timeout");
  assert.strictEqual(collected.memoryCandidates.length, 0);

  const decided = arbitrateAutomaticContext({
    agentId: "clara",
    ...collected,
    domainStatus: collected.domainStatus
  });
  assert.strictEqual(decided.decision, "abstain");
  assert.strictEqual(
    decided.reason,
    "no_eligible_candidate_degraded",
    "A timing-out domain must not be reported as a quiet turn."
  );

  // A genuinely quiet turn keeps the undegraded reason.
  const quiet = arbitrateAutomaticContext({ agentId: "clara" });
  assert.strictEqual(quiet.reason, "no_eligible_candidate");
}

async function checkControllerVerdictIsNotWidened() {
  // Collection forwards the Controller's verdict; the arbiter applies the same
  // discard rules it applies to host-supplied candidates. Observe mode and a
  // non-inject action must not become an automatic block.
  for (const [label, overrides] of [
    ["observe", { policyMode: "observe" }],
    ["abstain", { action: "ABSTAIN" }],
    ["empty context", { context: "" }]
  ]) {
    const service = serviceWith({ runMemoryController: async () => memoryPacket(overrides) });
    const collected = await service.collect({}, { prompt: "bounded ambiguity candidates", agentId: "clara" });
    const decided = arbitrateAutomaticContext({
      agentId: "clara",
      memoryCandidates: collected.memoryCandidates,
      shareCandidates: [],
      domainStatus: collected.domainStatus
    });
    assert.strictEqual(decided.decision, "abstain", `Controller ${label} must not become an automatic block.`);
  }
}

async function main() {
  checkBudgetArithmetic();
  checkPortContract();
  await checkInnerLifeIsNotCollected();
  checkMemoryScoreIsReal();
  await checkCollectorForwardsRealScore();
  await checkCollectionShape();
  await checkPartialFailure();
  await checkTimeoutIsNotSilence();
  await checkControllerVerdictIsNotWidened();
  process.stdout.write("Turn context smoke passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
