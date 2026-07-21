const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { createMemoryController } = require("../memory-controller/controller");
const { ACTIONS, REASON_CODES, evaluateStageB, formatMemoryContext } = require("../memory-controller/stage-b");
const { estimateTokens } = require("../memory-controller/evaluation");

async function semanticFingerprint(database) {
  const rows = await database.query(`
    SELECT
      (SELECT COUNT(*) FROM memories) AS memories,
      (SELECT COUNT(*) FROM memory_labels) AS memory_labels,
      (SELECT COUNT(*) FROM memory_links) AS memory_links,
      (SELECT COUNT(*) FROM continuity_lines) AS continuity_lines,
      (SELECT COUNT(*) FROM innerlife_shares) AS innerlife_shares;
  `);
  return rows[0];
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-controller-orchestration-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  await runtime.saveProductSettings(app, {
    "memory.embedding.provider": "disabled",
    "memory.embedding.model": ""
  });
  const codexPrompt = "还记得我们之前决定的 controller orchestration smoke 吗";
  const laraPrompt = "还记得我们之前决定的 lara controller smoke 吗";
  const codexMemory = await runtime.createProductMemory(app, {
    title: "Controller orchestration smoke",
    body: codexPrompt,
    agentId: "codex"
  });
  const laraMemory = await runtime.createProductMemory(app, {
    title: "Lara controller smoke",
    body: laraPrompt,
    agentId: "lara"
  });
  const { database } = await runtime.ensureProductCore(app);
  const semanticBefore = await semanticFingerprint(database);

  let searchCalls = 0;
  const controller = createMemoryController({
    database,
    mode: "observe",
    search: async (...args) => {
      searchCalls += 1;
      return database.searchMemories(...args);
    }
  });

  const noop = await controller.run({
    prompt: "把当前文件格式化一下",
    agentId: "codex",
    conversationId: "orchestration-noop"
  });
  assert.equal(noop.action, "NOOP");
  assert.equal(noop.cacheStatus, "none");
  assert.equal(searchCalls, 0, "Stage A NOOP called Memoria.");
  assert.ok(noop.decisionId, "Stage A NOOP did not create a ledger decision.");

  const observed = await controller.run({
    prompt: codexPrompt,
    agentId: "codex",
    conversationId: "orchestration-observe"
  });
  assert.equal(observed.action, "ABSTAIN", "Unscored keyword-only retrieval must not become injectable.");
  assert.equal(observed.reason, REASON_CODES.LOW_RELEVANCE);
  assert.equal(observed.stageB.action, "ABSTAIN");
  assert.equal(observed.context, "", "Observe mode returned injectable context.");
  assert.equal(observed.cacheStatus, "miss");
  assert.ok(observed.candidates.some((candidate) => candidate.id === codexMemory.id));
  assert.ok(!observed.candidates.some((candidate) => candidate.id === laraMemory.id), "Observe result crossed Agent scope.");
  const observedEvent = await database.getMemoryControlEvent(observed.decisionId);
  assert.deepEqual(observedEvent.injectedIds, [], "Observe event recorded an injection.");
  assert.equal(observedEvent.stageB.action, "ABSTAIN");

  const cached = await controller.run({
    prompt: codexPrompt,
    agentId: "codex",
    conversationId: "orchestration-observe-cache"
  });
  assert.equal(cached.cacheStatus, "hit");
  assert.notEqual(cached.decisionId, observed.decisionId, "Cache hit reused a decision id.");
  assert.equal(searchCalls, 1, "Equivalent retrieval did not use the cache.");

  const lara = await controller.run({
    prompt: laraPrompt,
    agentId: "lara",
    conversationId: "orchestration-lara"
  });
  assert.equal(lara.action, "ABSTAIN");
  assert.ok(lara.candidates.some((candidate) => candidate.id === laraMemory.id));
  assert.ok(!lara.candidates.some((candidate) => candidate.id === codexMemory.id), "Lara result crossed Agent scope.");
  assert.equal((await database.getMemoryControlEvent(lara.decisionId)).agentId, "lara");

  const canaryController = createMemoryController({
    database,
    mode: "canary",
    search: async () => ({
      mode: "vector",
      results: [{
        ...codexMemory,
        search_source: "vector",
        search_score: 0.9
      }]
    })
  });
  const canary = await canaryController.run({
    prompt: codexPrompt,
    agentId: "codex",
    mode: "canary",
    conversationId: "orchestration-canary"
  });
  assert.equal(canary.action, "INJECT_TOP1");
  assert.ok(canary.context.includes(codexMemory.id));
  assert.ok(!canary.context.includes(laraMemory.id));
  assert.ok(canary.context.includes("read-only"));
  const canaryEvent = await database.getMemoryControlEvent(canary.decisionId);
  assert.deepEqual(canaryEvent.injectedIds, [codexMemory.id]);
  assert.ok(canaryEvent.estimatedTokens > 0 && canaryEvent.estimatedTokens <= 600);

  const weak = evaluateStageB({
    candidates: [{ id: "weak", status: "active", sensitivity: "normal", source: "vector", score: 0.4 }]
  });
  assert.equal(weak.action, ACTIONS.ABSTAIN);
  assert.equal(weak.reason, REASON_CODES.LOW_RELEVANCE);
  const weakHybrid = evaluateStageB({
    candidates: [{ id: "weak-hybrid", status: "active", sensitivity: "normal", source: "keyword+vector", score: 0.11 }]
  });
  assert.equal(weakHybrid.action, ACTIONS.ABSTAIN);
  assert.equal(weakHybrid.reason, REASON_CODES.LOW_RELEVANCE);
  const keywordOnly = evaluateStageB({
    candidates: [{ id: "keyword-only", status: "active", sensitivity: "normal", source: "keyword", score: 0 }]
  });
  assert.equal(keywordOnly.action, ACTIONS.ABSTAIN);
  assert.equal(keywordOnly.reason, REASON_CODES.LOW_RELEVANCE);
  const ambiguous = evaluateStageB({
    candidates: [
      { id: "first", status: "active", sensitivity: "normal", source: "vector", score: 0.84 },
      { id: "second", status: "active", sensitivity: "normal", source: "vector", score: 0.8 }
    ]
  });
  assert.equal(ambiguous.reason, REASON_CODES.AMBIGUOUS_TOP_RESULTS);
  const ambiguousHybrid = evaluateStageB({
    candidates: [
      { id: "hybrid", status: "active", sensitivity: "normal", source: "keyword+vector", score: 0.8 },
      { id: "vector", status: "active", sensitivity: "normal", source: "vector", score: 0.75 }
    ]
  });
  assert.equal(ambiguousHybrid.reason, REASON_CODES.AMBIGUOUS_TOP_RESULTS);
  const restricted = evaluateStageB({
    candidates: [{ id: "restricted", status: "active", sensitivity: "restricted", source: "keyword", score: 1 }]
  });
  assert.equal(restricted.reason, REASON_CODES.RESTRICTED_RESULT);
  const noBudget = evaluateStageB({
    candidates: [{ id: "candidate", status: "active", sensitivity: "normal", source: "keyword", score: 1 }],
    contextBudgetTokens: 20
  });
  assert.equal(noBudget.reason, REASON_CODES.CONTEXT_BUDGET_EXCEEDED);
  const boundedContext = formatMemoryContext({
    candidates: [{ id: "large", title: "Large", body: "长期内容".repeat(2000), status: "active", sensitivity: "normal" }],
    contextBudgetTokens: 100
  });
  assert.ok(boundedContext.estimatedTokens <= 100, "Formatter exceeded the caller context budget.");
  assert.ok(boundedContext.context.endsWith("…"), "Formatter did not mark truncated context.");
  const hardCapContext = formatMemoryContext({
    candidates: [{ id: "hard-cap", title: "Hard cap", body: "长期内容".repeat(2000), status: "active", sensitivity: "normal" }],
    contextBudgetTokens: 900
  });
  assert.ok(hardCapContext.estimatedTokens > 600 && hardCapContext.estimatedTokens <= 900, "Formatter did not honor a caller budget above the default target.");
  assert.equal(estimateTokens("，，。：！？"), 6, "Full-width punctuation was omitted from the token estimate.");

  const normalizedSearchPrompts = [];
  const normalizedController = createMemoryController({
    database,
    search: async (searchPrompt) => {
      normalizedSearchPrompts.push(searchPrompt);
      return {
        mode: "vector",
        results: [{ ...codexMemory, search_source: "vector", search_score: 0.9 }]
      };
    }
  });
  const normalizedFirst = await normalizedController.run({
    prompt: "Do you remember  our previous decision?",
    agentId: "codex",
    conversationId: "normalized-first"
  });
  const normalizedSecond = await normalizedController.run({
    prompt: "do you remember our previous decision?",
    agentId: "codex",
    conversationId: "normalized-second"
  });
  assert.deepEqual(normalizedSearchPrompts, ["do you remember our previous decision?"], "Cache hashing and retrieval did not use the same normalized prompt.");
  assert.equal(normalizedFirst.cacheStatus, "miss");
  assert.equal(normalizedSecond.cacheStatus, "hit");

  const timeoutController = createMemoryController({
    database,
    timeoutMs: 10,
    search: () => new Promise((resolve) => setTimeout(() => resolve({ results: [] }), 50))
  });
  const timeout = await timeoutController.run({
    prompt: "还记得我们上次讨论的超时方案吗",
    agentId: "codex",
    conversationId: "orchestration-timeout"
  });
  assert.equal(timeout.action, "NOOP");
  assert.equal(timeout.reason, "controller_timeout");
  assert.equal(timeout.resultStatus, "timeout");
  assert.equal((await database.getMemoryControlEvent(timeout.decisionId)).resultStatus, "timeout");

  const errorController = createMemoryController({
    database,
    search: async () => {
      throw new Error("synthetic search failure");
    }
  });
  const failed = await errorController.run({
    prompt: "还记得我们上次讨论的失败方案吗",
    agentId: "codex",
    conversationId: "orchestration-error"
  });
  assert.equal(failed.action, "NOOP");
  assert.equal(failed.reason, "controller_error");
  assert.equal(failed.context, "");
  assert.equal((await database.getMemoryControlEvent(failed.decisionId)).resultStatus, "error");

  const auditlessDatabase = new Proxy(database, {
    get(target, property) {
      if (property === "recordMemoryControlEvent") return async () => { throw new Error("synthetic ledger failure"); };
      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  const auditlessController = createMemoryController({ database: auditlessDatabase, mode: "canary" });
  const auditless = await auditlessController.run({
    prompt: codexPrompt,
    agentId: "codex",
    conversationId: "orchestration-auditless"
  });
  assert.equal(auditless.action, "NOOP", "Missing audit unexpectedly returned injectable context.");
  assert.equal(auditless.reason, "audit_unavailable");
  assert.equal(auditless.context, "");
  assert.equal(auditless.decisionId, "");

  const semanticAfter = await semanticFingerprint(database);
  assert.deepEqual(semanticAfter, semanticBefore, "Controller orchestration mutated semantic domain tables.");
  const events = await database.listMemoryControlEvents({ limit: 20 });
  assert.ok(events.length >= 7, "Expected one ledger event per controller turn.");

  console.log(JSON.stringify({
    suite: "memory-controller-orchestration-smoke",
    semanticReadOnly: true,
    searchCalls,
    decisions: {
      noop: noop.decisionId,
      observed: observed.decisionId,
      cached: cached.decisionId,
      lara: lara.decisionId,
      canary: canary.decisionId,
      timeout: timeout.decisionId,
      error: failed.decisionId,
      auditless: auditless.decisionId
    },
    observe: { action: observed.action, stageB: observed.stageB.action, contextLength: observed.context.length },
    cache: { status: cached.cacheStatus, newDecision: cached.decisionId !== observed.decisionId },
    canary: { action: canary.action, estimatedTokens: canaryEvent.estimatedTokens },
    failOpen: { timeout: timeout.reason, error: failed.reason, audit: auditless.reason }
  }, null, 2));
  database.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
