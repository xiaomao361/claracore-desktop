const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { ProductDatabase } = require("../db/database");
const {
  SESSION_AFTERTHOUGHT_MAX_ATTEMPTS,
  SESSION_LIFECYCLE_PORTS,
  createInnerLifeSessionLifecycleService,
  sessionAfterthoughtRetrySeconds
} = require("../innerlife/services/session-lifecycle");
const { findInnerLifeRepositoryCycles } = require("./innerlife-repository-graph");

const root = path.resolve(__dirname, "../..");

function createPorts(overrides = {}) {
  let idIndex = 0;
  return {
    claimAfterthoughts: async () => [],
    closeSession: async (_database, input) => ({
      ...input.session,
      status: "ended",
      endedAt: "2026-07-31 00:00:00",
      summary: input.summary
    }),
    completeAfterthought: async () => {},
    converge: async () => ({ converged: false }),
    createSession: async (_database, input) => ({
      id: input.id,
      agentId: input.agentId,
      userId: input.userId,
      host: input.host,
      externalSessionId: input.externalSessionId,
      status: "active",
      briefing: input.briefing,
      summary: "",
      metadata: {}
    }),
    ensureProfile: async (_database, agentId) => ({ agent_id: agentId }),
    findExistingSession: async () => null,
    findSessionForEnd: async () => null,
    findSimilarShare: async () => null,
    generateAfterthought: async (_database, input) => ({
      body: `Generated: ${input.prompt}`,
      source: "model",
      tier: input.tier
    }),
    getBriefing: async (_database, input) => ({
      agentId: input.agentId,
      sharedLine: { summary: "Current line" }
    }),
    getShare: async (_database, id) => ({
      id,
      agent_id: "codex",
      status: "pending",
      body: "Queued share",
      decision_reason: ""
    }),
    listShares: async () => [],
    newId: (prefix) => `${prefix}-${++idIndex}`,
    resolveAgentIdentity: (input) => ({ id: String(input?.agentId || "codex") }),
    retryAfterthought: async () => {},
    ...overrides
  };
}

async function main() {
  assert.throws(
    () => createInnerLifeSessionLifecycleService({}),
    /InnerLife session lifecycle service requires ports/,
    "The session lifecycle service must reject incomplete dependency wiring."
  );
  assert.deepStrictEqual(
    [...SESSION_LIFECYCLE_PORTS].sort(),
    Object.keys(createPorts()).sort(),
    "The session lifecycle test ports must stay aligned with the production service contract."
  );

  let createdSessionInput = null;
  const startSession = createInnerLifeSessionLifecycleService(createPorts({
    createSession: async (_database, input) => {
      createdSessionInput = input;
      return {
        ...input,
        status: "active"
      };
    },
    listShares: async (_database, status) => status === "pending"
      ? [{
          id: "share-1",
          agent_id: "codex",
          status: "pending",
          body: "A pending thought for this agent."
        }]
      : []
  }));
  const started = await startSession.startInnerLifeSession({}, {
    agentId: "codex",
    externalSessionId: "external-1",
    includeBriefing: true
  });
  assert.strictEqual(createdSessionInput.externalSessionId, "external-1");
  assert.strictEqual(started.session.status, "active");
  assert.strictEqual(started.share_plan.share.id, "share-1");
  assert.strictEqual(started.briefing.agentId, "codex");

  const repeatedSession = {
    id: "session-ended",
    agentId: "codex",
    status: "ended",
    briefing: { shouldNotLeak: true },
    summary: "Already closed",
    metadata: {}
  };
  const repeatEnd = createInnerLifeSessionLifecycleService(createPorts({
    findSessionForEnd: async () => repeatedSession
  }));
  const repeated = await repeatEnd.endInnerLifeSession({}, "session-ended", {
    agentId: "codex"
  });
  assert.strictEqual(repeated.repeated, true);
  assert(!Object.prototype.hasOwnProperty.call(repeated.session, "briefing"));

  let emptyCloseInput = null;
  const emptyEnd = createInnerLifeSessionLifecycleService(createPorts({
    closeSession: async (_database, input) => {
      emptyCloseInput = input;
      return { ...input.session, status: "ended", briefing: {} };
    },
    findSessionForEnd: async () => ({
      id: "session-empty",
      agentId: "codex",
      status: "active",
      briefing: {}
    })
  }));
  const emptyResult = await emptyEnd.endInnerLifeSession({}, "session-empty", {
    agentId: "codex",
    summary: ""
  });
  assert.strictEqual(emptyCloseInput.summary, "");
  assert.strictEqual(emptyResult.share, null);
  assert.strictEqual(emptyResult.shareDecision.reason, "empty_session_summary");

  let structuredCloseInput = null;
  const structuredEnd = createInnerLifeSessionLifecycleService(createPorts({
    closeSession: async (_database, input) => {
      structuredCloseInput = input;
      return { ...input.session, status: "ended", briefing: {} };
    },
    findSessionForEnd: async () => ({
      id: "session-structured",
      agentId: "codex",
      status: "active",
      briefing: {}
    })
  }));
  await structuredEnd.endInnerLifeSession({}, "session-structured", {
    agentId: "codex",
    summary: { outcome: "verified", next: ["continue"] }
  });
  assert(
    structuredCloseInput.summary.includes("\"outcome\": \"verified\""),
    "Structured session summaries must remain JSON-serializable text."
  );

  const bestEffortEnd = createInnerLifeSessionLifecycleService(createPorts());
  const missingResult = await bestEffortEnd.endInnerLifeSession({}, "missing", {
    agentId: "codex",
    bestEffort: true
  });
  assert.strictEqual(missingResult.missing, true);
  const legacyHookMissing = await bestEffortEnd.endInnerLifeSession({}, "missing-hook", {
    transcript: "[SessionEnd hook unavailable at start]"
  });
  assert.strictEqual(legacyHookMissing.missing, true);
  await assert.rejects(
    () => bestEffortEnd.endInnerLifeSession({}, "missing", {
      agentId: "codex",
      summary: "Explicit calls must surface a bad id."
    }),
    /InnerLife session not found/
  );
  const circularSummary = {};
  circularSummary.self = circularSummary;
  await assert.rejects(
    () => structuredEnd.endInnerLifeSession({}, "session-structured", {
      agentId: "codex",
      summary: circularSummary
    }),
    /must be JSON-serializable/
  );

  const afterthoughtTransitions = [];
  const convergenceInputs = [];
  const afterthoughtWorker = createInnerLifeSessionLifecycleService(createPorts({
    claimAfterthoughts: async () => [{
      id: "job-1",
      agentId: "codex",
      body: "Session summary",
      metadata: {
        thoughtId: "thought-1",
        shareId: "share-1",
        template: "Session afterthought template",
        attempts: 0
      }
    }],
    completeAfterthought: async (_database, input) => afterthoughtTransitions.push(input),
    converge: async (_database, input) => {
      convergenceInputs.push(input);
      return { converged: true };
    }
  }));
  const processed = await afterthoughtWorker.processPendingSessionAfterthoughts({}, 5);
  assert.strictEqual(processed.processed, 1);
  assert.strictEqual(processed.results[0].converged, true);
  assert.strictEqual(afterthoughtTransitions[0].shareDecision.reason, "distinct_shareable_thought");
  assert.strictEqual(convergenceInputs[0].sourceThoughtId, "thought-1");

  let convergenceWarningCompleted = 0;
  let convergenceWarningRetried = 0;
  const convergenceWarningWorker = createInnerLifeSessionLifecycleService(createPorts({
    claimAfterthoughts: async () => [{
      id: "job-convergence-warning",
      agentId: "codex",
      body: "Session summary",
      metadata: {
        thoughtId: "thought-convergence-warning",
        shareId: "share-convergence-warning",
        template: "Session afterthought template",
        attempts: 0
      }
    }],
    completeAfterthought: async () => {
      convergenceWarningCompleted += 1;
    },
    converge: async () => {
      throw new Error("synthetic convergence failure");
    },
    retryAfterthought: async () => {
      convergenceWarningRetried += 1;
    }
  }));
  const convergenceWarning = await convergenceWarningWorker.processPendingSessionAfterthoughts({}, 5);
  assert.strictEqual(convergenceWarning.processed, 1);
  assert.strictEqual(convergenceWarning.results[0].status, "processed_with_warning");
  assert(convergenceWarning.results[0].warning.includes("synthetic convergence failure"));
  assert.strictEqual(convergenceWarningCompleted, 1);
  assert.strictEqual(
    convergenceWarningRetried,
    0,
    "A post-persistence convergence failure must not regenerate the afterthought."
  );

  let retryInput = null;
  const failedWorker = createInnerLifeSessionLifecycleService(createPorts({
    claimAfterthoughts: async () => [{
      id: "job-failure",
      agentId: "codex",
      body: "Session summary",
      metadata: { shareId: "share-failure", attempts: 2 }
    }],
    completeAfterthought: async () => {
      throw new Error("synthetic persistence failure");
    },
    retryAfterthought: async (_database, input) => {
      retryInput = input;
    }
  }));
  const failed = await failedWorker.processPendingSessionAfterthoughts({}, 5);
  assert.strictEqual(failed.processed, 0);
  assert.strictEqual(failed.retrying, 1);
  assert.strictEqual(failed.terminalFailures, 0);
  assert.strictEqual(failed.results[0].error, "synthetic persistence failure");
  assert.strictEqual(failed.results[0].status, "retrying");
  assert.strictEqual(failed.results[0].attempts, 3);
  assert.strictEqual(failed.results[0].retrySeconds, sessionAfterthoughtRetrySeconds(3));
  assert.strictEqual(retryInput.job.id, "job-failure");
  assert.strictEqual(retryInput.attempts, 3);
  assert.strictEqual(retryInput.terminal, false);
  assert(retryInput.nextRetryAt);

  let terminalRetryInput = null;
  const terminalWorker = createInnerLifeSessionLifecycleService(createPorts({
    claimAfterthoughts: async () => [{
      id: "job-terminal",
      agentId: "codex",
      body: "Session summary",
      metadata: {
        shareId: "share-terminal",
        attempts: SESSION_AFTERTHOUGHT_MAX_ATTEMPTS - 1
      }
    }],
    completeAfterthought: async () => {
      throw new Error("synthetic terminal persistence failure");
    },
    retryAfterthought: async (_database, input) => {
      terminalRetryInput = input;
    }
  }));
  const terminal = await terminalWorker.processPendingSessionAfterthoughts({}, 5);
  assert.strictEqual(terminal.processed, 0);
  assert.strictEqual(terminal.retrying, 0);
  assert.strictEqual(terminal.terminalFailures, 1);
  assert.strictEqual(terminal.results[0].status, "failed");
  assert.strictEqual(terminal.results[0].attempts, SESSION_AFTERTHOUGHT_MAX_ATTEMPTS);
  assert.strictEqual(terminal.results[0].retrySeconds, 0);
  assert.strictEqual(terminal.results[0].nextRetryAt, null);
  assert.strictEqual(terminalRetryInput.terminal, true);
  assert.strictEqual(terminalRetryInput.nextRetryAt, null);

  const serviceSource = fs.readFileSync(
    path.join(root, "core/innerlife/services/session-lifecycle.js"),
    "utf8"
  );
  const repositorySource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/sessions.js"),
    "utf8"
  );
  const storeSource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/session-store.js"),
    "utf8"
  );
  const aggregatorSource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife.js"),
    "utf8"
  );
  assert(
    !/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/.test(serviceSource),
    "InnerLife session lifecycle service must not own SQL."
  );
  assert(
    !/\b(?:query|exec)\s*\(/.test(serviceSource),
    "InnerLife session lifecycle service must use declared ports."
  );
  assert(
    !/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/.test(repositorySource),
    "The public session repository must remain a thin adapter."
  );
  assert(
    /\b(?:SELECT|INSERT|UPDATE)\b/.test(storeSource),
    "Session SQL must stay in the private persistence adapter."
  );
  for (const methodName of [
    "convergeInnerLife",
    "ensureInnerLifeProfile",
    "findSimilarInnerLifeShare",
    "getInnerLifeBriefing",
    "getInnerLifeShare",
    "listInnerLifeShares"
  ]) {
    assert(
      !repositorySource.includes(`this.${methodName}(`),
      `Session repository must not orchestrate ${methodName} directly.`
    );
  }
  assert(
    repositorySource.includes("sessionLifecycle.startInnerLifeSession(this, input)") &&
      repositorySource.includes("sessionLifecycle.endInnerLifeSession(this, sessionId, input)") &&
      repositorySource.includes("sessionLifecycle.processPendingSessionAfterthoughts(this, limit)"),
    "Public session lifecycle methods must delegate to the service layer."
  );
  assert(
    aggregatorSource.includes("createInnerLifeSessionStore") &&
      aggregatorSource.includes("createInnerLifeSessionLifecycleService") &&
      aggregatorSource.includes("{ sessionLifecycle, sessionStore }"),
    "The InnerLife composition root must wire the session store and service explicitly."
  );
  for (const methodName of [
    "startInnerLifeSession",
    "endInnerLifeSession",
    "processPendingSessionAfterthoughts"
  ]) {
    assert.strictEqual(
      typeof ProductDatabase.prototype[methodName],
      "function",
      `ProductDatabase.${methodName} must remain stable.`
    );
  }

  const cycles = findInnerLifeRepositoryCycles();
  assert(
    cycles.every((cycle) => !cycle.includes("sessions.js")),
    `Session repository re-entered a cyclic dependency: ${JSON.stringify(cycles)}`
  );
  assert(
    cycles.every((cycle) => !cycle.includes("reflection.js")),
    `Reflection repository re-entered a cyclic dependency: ${JSON.stringify(cycles)}`
  );
  assert(
    cycles.every((cycle) => cycle.length <= 3),
    `InnerLife repository SCC grew beyond the post-session boundary: ${JSON.stringify(cycles)}`
  );

  console.log(JSON.stringify({
    suite: "innerlife-session-service-boundary-smoke",
    portCount: SESSION_LIFECYCLE_PORTS.length,
    processedAfterthoughts: processed.processed,
    retryCaptured: retryInput.job.id,
    repositoryCycles: cycles
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
