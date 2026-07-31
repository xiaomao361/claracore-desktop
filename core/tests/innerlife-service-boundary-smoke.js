const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { ProductDatabase } = require("../db/database");
const {
  DAEMON_TICK_PORTS,
  createInnerLifeDaemonTickService
} = require("../innerlife/services/daemon-tick");

const root = path.resolve(__dirname, "../..");

function createPorts(overrides = {}) {
  return {
    completeFailure: async () => {},
    completeIdle: async () => {},
    completeSuccess: async () => {},
    ensureDaemonState: async () => ({
      agentId: "codex",
      enabled: true,
      status: "enabled",
      metadata: {}
    }),
    getLockKey: (_database, agentId) => `test:${agentId}`,
    getSettings: async () => ({
      "innerlife.enabled": true,
      "innerlife.loop_seconds": 30
    }),
    getSnapshot: async () => ({ mode: "lite" }),
    ingestSources: async () => ({
      sourceCount: 0,
      candidateCount: 0,
      insertedCount: 0,
      errors: []
    }),
    innerLifeRetrySeconds: (pollSeconds, failureCount) => pollSeconds * failureCount,
    isDaemonDue: async () => true,
    listPendingInbox: async () => [],
    listPendingInboxPage: async () => ({ items: [] }),
    markRunning: async () => {},
    processOnce: async () => ({ share: null, convergence: null }),
    resolveAgentIdentity: (input) => ({ id: String(input?.agentId || "codex") }),
    ...overrides
  };
}

async function main() {
  assert.throws(
    () => createInnerLifeDaemonTickService({}),
    /InnerLife daemon tick service requires ports/,
    "The daemon tick service must reject incomplete dependency wiring."
  );
  assert.deepStrictEqual(
    [...DAEMON_TICK_PORTS].sort(),
    Object.keys(createPorts()).sort(),
    "The daemon tick test ports must stay aligned with the production service contract."
  );

  const idleTransitions = [];
  let idleSnapshotCalls = 0;
  const idleTick = createInnerLifeDaemonTickService(createPorts({
    completeIdle: async (_database, input) => idleTransitions.push(input),
    getSnapshot: async () => {
      idleSnapshotCalls += 1;
      return { unexpected: true };
    }
  }));
  const idleResult = await idleTick({}, {
    agentId: "codex",
    force: true,
    includeSnapshot: false
  });
  assert.strictEqual(idleResult.ran, false);
  assert.strictEqual(idleResult.reason, "idle");
  assert.strictEqual(idleTransitions.length, 1);
  assert.strictEqual(idleTransitions[0].pollSeconds, 30);
  assert.strictEqual(idleSnapshotCalls, 0, "Idle ticks must honor includeSnapshot=false.");

  const successTransitions = [];
  let processedInput = null;
  const successTick = createInnerLifeDaemonTickService(createPorts({
    completeSuccess: async (_database, input) => successTransitions.push(input),
    listPendingInboxPage: async () => ({ items: [{ id: "inbox-1" }] }),
    processOnce: async (_database, input) => {
      processedInput = input;
      return { share: { id: "share-1" }, convergence: null };
    }
  }));
  const successResult = await successTick({}, {
    agentId: "codex",
    force: true,
    lineId: "line-1"
  });
  assert.strictEqual(successResult.ran, true);
  assert.strictEqual(successResult.reason, "processed");
  assert.strictEqual(processedInput.lineId, "line-1");
  assert.strictEqual(successTransitions[0].pendingInboxCount, 1);
  assert.strictEqual(successTransitions[0].result.share.id, "share-1");

  let releaseActiveTick;
  let signalActiveTick;
  const activeTickStarted = new Promise((resolve) => {
    signalActiveTick = resolve;
  });
  const activeTickReleased = new Promise((resolve) => {
    releaseActiveTick = resolve;
  });
  const concurrentTick = createInnerLifeDaemonTickService(createPorts({
    listPendingInboxPage: async () => ({ items: [{ id: "inbox-1" }] }),
    processOnce: async () => {
      signalActiveTick();
      await activeTickReleased;
      return { share: null, convergence: null };
    }
  }));
  const activeTick = concurrentTick({}, {
    agentId: "codex",
    force: true,
    includeSnapshot: false
  });
  await activeTickStarted;
  const overlappingTick = await concurrentTick({}, {
    agentId: "codex",
    force: true,
    includeSnapshot: false
  });
  assert.strictEqual(overlappingTick.ran, false);
  assert.strictEqual(overlappingTick.reason, "running");
  releaseActiveTick();
  await activeTick;

  let failureTransition = null;
  const failureTick = createInnerLifeDaemonTickService(createPorts({
    completeFailure: async (_database, input) => {
      failureTransition = input;
    },
    ensureDaemonState: async () => ({
      agentId: "codex",
      enabled: true,
      status: "enabled",
      metadata: { failureCount: 2 }
    }),
    listPendingInboxPage: async () => ({ items: [{ id: "inbox-1" }] }),
    processOnce: async () => {
      throw new Error("synthetic service failure");
    }
  }));
  await assert.rejects(
    () => failureTick({}, { agentId: "codex", force: true }),
    /synthetic service failure/
  );
  assert.strictEqual(failureTransition.failureCount, 3);
  assert.strictEqual(failureTransition.retrySeconds, 90);
  assert.strictEqual(failureTransition.pendingInboxCount, 1);

  const serviceSource = fs.readFileSync(
    path.join(root, "core/innerlife/services/daemon-tick.js"),
    "utf8"
  );
  const repositorySource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/daemon.js"),
    "utf8"
  );
  const aggregatorSource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife.js"),
    "utf8"
  );

  assert(
    !/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/.test(serviceSource),
    "InnerLife services must not own SQL."
  );
  assert(
    !/\b(?:query|exec)\s*\(/.test(serviceSource),
    "InnerLife services must use declared persistence ports."
  );
  for (const methodName of [
    "getInnerLifeSnapshot",
    "ingestInnerLifeSources",
    "processInnerLifeOnce"
  ]) {
    assert(
      !repositorySource.includes(`this.${methodName}(`),
      `Daemon repository must not orchestrate ${methodName} directly.`
    );
  }
  assert(
    repositorySource.includes("return tickInnerLifeDaemon(this, input);"),
    "The public daemon tick repository method must delegate to the service layer."
  );
  assert(
    aggregatorSource.includes("createInnerLifeDaemonTickService") &&
      aggregatorSource.includes("createInnerLifeDaemonRepository(helpers, { tickInnerLifeDaemon })"),
    "The InnerLife composition root must wire the daemon service explicitly."
  );
  assert.strictEqual(
    typeof ProductDatabase.prototype.tickInnerLifeDaemon,
    "function",
    "The external ProductDatabase daemon API must remain stable."
  );

  console.log(JSON.stringify({
    suite: "innerlife-service-boundary-smoke",
    portCount: DAEMON_TICK_PORTS.length,
    idleTransition: idleResult.reason,
    successTransition: successResult.reason,
    failureRetrySeconds: failureTransition.retrySeconds
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
