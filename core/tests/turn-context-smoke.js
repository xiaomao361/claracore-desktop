const assert = require("assert");
const { arbitrateAutomaticContext } = require("../gateway/auto-context");
const {
  INNERLIFE_TIMEOUT_MS,
  MEMORY_TIMEOUT_MS,
  SHARE_CANDIDATE_LIMIT,
  TURN_BUDGET_MS,
  createTurnContextService
} = require("../gateway/turn-context");
const { createInnerLifeRelevanceScorer, relevanceTokens } = require("../innerlife/relevance");
const { meaningfulTokens } = require("../db/helpers");

const scoreShareRelevance = createInnerLifeRelevanceScorer();

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
    listPendingShares: async () => [],
    scoreShareRelevance,
    ...overrides
  });
}

function checkBudgetArithmetic() {
  // The patch proposed one 3 s budget while the Memory Controller's own hard
  // timeout is 2500 ms, which would leave almost nothing for InnerLife. The
  // per-domain slices must actually fit inside the turn budget.
  assert.ok(
    MEMORY_TIMEOUT_MS + INNERLIFE_TIMEOUT_MS < TURN_BUDGET_MS,
    `Domain timeouts ${MEMORY_TIMEOUT_MS}+${INNERLIFE_TIMEOUT_MS} leave no room inside the ${TURN_BUDGET_MS}ms turn budget.`
  );
  assert.ok(MEMORY_TIMEOUT_MS < 2500, "Memory must be given less than the Controller's own hard timeout.");
}

function checkPortContract() {
  assert.throws(() => createTurnContextService({}), /requires ports/);
  assert.throws(() => createTurnContextService({ runMemoryController: () => {} }), /requires ports/);
}

async function checkRelevanceIsReadOnly() {
  // The scorer must be a pure function of its inputs. If it ever needs a
  // database it has become innerlife_share_check, which writes a row per check.
  const scorer = createInnerLifeRelevanceScorer();
  assert.strictEqual(scorer.length, 2, "The relevance scorer takes only a prompt and a share.");

  const related = scorer(
    "how does the shared line ambiguity refusal bound its candidates",
    share("s1", "The shared line ambiguity refusal returns bounded candidates instead of the whole catalog.")
  );
  const unrelated = scorer(
    "what should I have for lunch today",
    share("s2", "The shared line ambiguity refusal returns bounded candidates instead of the whole catalog.")
  );
  assert.ok(related.relevance > unrelated.relevance, "A matching prompt must score above an unrelated one.");
  assert.strictEqual(unrelated.relevance, 0, "An unrelated prompt must score zero, not merely low.");

  // An explicit ask lifts a connected share but must not manufacture relevance,
  // or "有什么想说的" would surface anything at all.
  const askOnly = scorer("你有什么想说的吗", share("s3", "completely unrelated stored thought about disk alerts"));
  assert.strictEqual(askOnly.relevance, 0, "An ask signal alone must not create relevance.");

  // Relevance must not collapse on length. Dividing by the share's own tokens
  // was the first attempt: a real multi-sentence thought scored 0.2 against a
  // 0.5 threshold, so nothing but a near-paraphrase could ever be delivered and
  // the feature would have silently never fired.
  const realistic = scorer(
    "how does the shared line ambiguity refusal bound its candidates",
    share(
      "s4",
      "Worth keeping: the ambiguity refusal now bounds its candidates and reports a true total count, so an agent can choose without pulling the whole catalog. It refuses rather than guessing."
    )
  );
  assert.ok(
    realistic.relevance >= 0.5,
    `A realistic multi-sentence share scored ${realistic.relevance}; the scorer must not penalise length.`
  );

  // One shared common word is not a topic match.
  const oneWord = scorer(
    "how does the shared line ambiguity refusal bound its candidates",
    share("s5", "The candidates for the election were announced yesterday in the news")
  );
  assert.strictEqual(oneWord.signals.reason, "prompt_coverage");
  assert.ok(oneWord.relevance < 0.5, "A single incidental term must not clear the threshold.");
  const belowFloor = scorer("candidates", share("s6", "candidates only here nothing else at all"));
  assert.strictEqual(belowFloor.signals.reason, "below_overlap_floor");

  // KNOWN FALSE POSITIVE, recorded rather than hidden: when the InnerLife
  // provider is disabled, processInnerLifeOnce stores a template that embeds the
  // operator prompt verbatim, so such a share scores high against a similar
  // prompt. That is InnerLife content quality, not relevance scoring, and is not
  // papered over here — fixing it inside the scorer would mean string-matching
  // the template.
  const templateEcho = scorer(
    "shared line ambiguity refusal bounded candidates",
    share(
      "s7",
      "Manual InnerLife review\n\nCurrent position: none\n\nOperator prompt: shared line ambiguity refusal bounded candidates"
    )
  );
  assert.ok(
    templateEcho.relevance >= 0.5,
    "Template echo currently scores high; this assertion exists so the behaviour is visible if it changes."
  );
}

function checkChineseRelevance() {
  // The shared meaningfulTokens helper keeps an unpunctuated Chinese sentence as
  // a single token, so coverage was 1 with an overlap of 1, fell under the
  // two-token floor, and scored 0. Chinese relevance was dead in every case.
  assert.strictEqual(
    meaningfulTokens("共享线歧义拒绝").length,
    1,
    "Guard: the shared tokenizer still collapses Chinese, which is why relevance owns its own."
  );
  assert.ok(
    relevanceTokens("共享线歧义拒绝").length > 1,
    "Relevance tokenisation must split Chinese into matchable units."
  );

  const scorer = createInnerLifeRelevanceScorer();
  const body = "共享线歧义拒绝现在会返回有界候选和真实总数，agent 可以自己选，不用把整个目录拉下来。";
  for (const fragment of ["共享线歧义拒绝", "返回有界候选", "真实总数"]) {
    const scored = scorer(fragment, share("zh", body));
    assert.strictEqual(scored.signals.coverage, 1, `Fragment ${fragment} should be fully covered.`);
    assert.ok(scored.relevance >= 0.5, `Fragment ${fragment} scored ${scored.relevance}; Chinese must be deliverable.`);
  }
  assert.strictEqual(scorer("今天中午吃什么好呢", share("zh", body)).relevance, 0, "Unrelated Chinese must score zero.");

  // Mixed script must not lose the latin half.
  const mixed = scorer("the ambiguity refusal 有界候选", share("zh2", "ambiguity refusal 返回有界候选"));
  assert.ok(mixed.relevance > 0, "Mixed-script prompts must still match.");
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
  const service = serviceWith({
    listPendingShares: async (unusedCore, unusedAgent, limit) => {
      assert.strictEqual(limit, SHARE_CANDIDATE_LIMIT, "Collection must ask for the default three candidates.");
      return [share("s1", "bounded ambiguity candidates"), share("s2", "unrelated"), share("s3", "unrelated too"), share("s4", "overflow")];
    }
  });
  const collected = await service.collect({}, { prompt: "bounded ambiguity candidates", agentId: "clara" });
  assert.ok(collected.shareCandidates.length <= SHARE_CANDIDATE_LIMIT);
  assert.deepStrictEqual(collected.domainStatus, { memory: "ok", innerlife: "ok" });
  assert.ok(collected.memoryCandidates.length === 1);
  assert.strictEqual(collected.memoryCandidates[0].policyMode, "canary");

  // An empty prompt does no domain work at all.
  const skipped = await service.collect({}, { prompt: "   ", agentId: "clara" });
  assert.deepStrictEqual(skipped.domainStatus, { memory: "skipped", innerlife: "skipped" });
  assert.deepStrictEqual(skipped.memoryCandidates, []);
}

async function checkPartialFailure() {
  // One domain failing must not discard a valid winner from the other, and the
  // failure must stay visible rather than looking like a quiet turn.
  const memoryDown = serviceWith({
    runMemoryController: async () => {
      throw new Error("controller exploded");
    },
    listPendingShares: async () => [share("s1", "bounded ambiguity candidates for the refusal")]
  });
  const collected = await memoryDown.collect({}, { prompt: "bounded ambiguity candidates for the refusal", agentId: "clara" });
  assert.strictEqual(collected.domainStatus.memory, "error");
  assert.strictEqual(collected.domainStatus.innerlife, "ok");
  assert.strictEqual(collected.memoryCandidates.length, 0);
  assert.ok(collected.shareCandidates.length > 0, "A healthy domain must still produce candidates.");

  const decided = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: collected.memoryCandidates,
    shareCandidates: collected.shareCandidates,
    domainStatus: collected.domainStatus
  });
  assert.strictEqual(decided.domainStatus.memory, "error", "The arbiter must carry the domain status through.");
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
  checkChineseRelevance();
  checkMemoryScoreIsReal();
  await checkCollectorForwardsRealScore();
  await checkRelevanceIsReadOnly();
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
