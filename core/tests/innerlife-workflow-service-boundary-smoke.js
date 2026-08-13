const assert = require("assert");
const fs = require("fs");
const fsPromises = require("fs/promises");
const os = require("os");
const path = require("path");
const { ProductDatabase, initializeProductDatabase } = require("../db/database");
const { listInstalledRepositoryMethods } = require("../db/repository-installer");
const {
  DIGEST_RUN_PORTS,
  createInnerLifeDigestRunService
} = require("../innerlife/services/digest-run");
const {
  SHARE_TIMING_PORTS,
  createInnerLifeShareTimingService
} = require("../innerlife/services/share-timing");
const { findInnerLifeRepositoryCycles } = require("./innerlife-repository-graph");

const root = path.resolve(__dirname, "../..");

function createDigestPorts(overrides = {}) {
  let idIndex = 0;
  return {
    ensureProfile: async (_database, agentId) => ({
      agent_id: agentId,
      display_name: "Codex",
      profile: {},
      state: {}
    }),
    generateDigest: async (_database, input) => ({
      body: input.template,
      source: "template",
      tier: input.tier
    }),
    getDigestRun: async (_database, id) => ({ id }),
    getOptionalResumePacket: async () => ({
      resumePacket: {
        lineId: "line-1",
        currentPosition: {
          positionId: "position-1",
          summary: "Continue the architecture cleanup."
        }
      },
      sharedLineContext: {
        status: "selected",
        candidateLineIds: ["line-1"]
      }
    }),
    getSnapshotLite: async (_database, agentId) => ({ agentId }),
    listInboxPage: async () => ({ items: [] }),
    listMemories: async () => [],
    newId: (prefix) => `${prefix}-${++idIndex}`,
    persistDigestRun: async () => {},
    pruneDigestRuns: async () => {},
    resolveAgentIdentity: (input) => ({ id: String(input?.agentId || "codex") }),
    ...overrides
  };
}

function createSharePorts(overrides = {}) {
  let idIndex = 0;
  return {
    ensureProfile: async (_database, agentId) => ({ agent_id: agentId }),
    findAvailableShareId: async () => "",
    getOptionalResumePacket: async () => ({
      resumePacket: {
        lineId: "",
        currentPosition: {},
        sharedReality: {},
        agentState: {},
        nextStep: ""
      },
      sharedLineContext: {
        status: "missing",
        candidateLineIds: []
      }
    }),
    getShare: async () => null,
    getShareCheck: async (_database, id) => ({ id }),
    getSnapshotLite: async (_database, agentId) => ({ agentId }),
    meaningfulTokens: (value) => (
      String(value || "").toLowerCase().match(/[a-z0-9_-]+/g) || []
    ),
    newId: (prefix) => `${prefix}-${++idIndex}`,
    recordCheck: async () => {},
    resolveAgentIdentity: (input) => ({ id: String(input?.agentId || "codex") }),
    ...overrides
  };
}

async function verifyAutomaticShareSelectionPriority() {
  const dataRoot = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), "claracore-share-timing-priority-")
  );
  const database = await initializeProductDatabase(path.join(dataRoot, "claracore.db"));
  try {
    await database.exec(`
      INSERT INTO agents (id, label)
      VALUES ('selection-agent', 'Selection Agent');

      INSERT INTO innerlife_shares (id, agent_id, status, body) VALUES
        ('share-deferred', 'selection-agent', 'deferred', 'deferred marker'),
        ('share-pending', 'selection-agent', 'pending', 'pending marker'),
        ('share-approved', 'selection-agent', 'approved', 'approved marker');
    `);
    const selectedIds = [];
    const approved = await database.checkInnerLifeShareTiming({
      agentId: "selection-agent",
      context: "Please use the approved marker."
    });
    selectedIds.push(approved.share?.id);
    await database.exec(`
      UPDATE innerlife_shares SET status = 'rejected' WHERE id = 'share-approved';
    `);
    const pending = await database.checkInnerLifeShareTiming({
      agentId: "selection-agent",
      context: "Please use the pending marker."
    });
    selectedIds.push(pending.share?.id);
    await database.exec(`
      UPDATE innerlife_shares SET status = 'rejected' WHERE id = 'share-pending';
    `);
    const deferred = await database.checkInnerLifeShareTiming({
      agentId: "selection-agent",
      context: "Please use the deferred marker."
    });
    selectedIds.push(deferred.share?.id);
    assert.deepStrictEqual(
      selectedIds,
      ["share-approved", "share-pending", "share-deferred"],
      "Automatic share selection must preserve approved > pending > deferred priority."
    );
    return selectedIds;
  } finally {
    database.close();
    await fsPromises.rm(dataRoot, { recursive: true, force: true });
  }
}

async function main() {
  assert.throws(
    () => createInnerLifeDigestRunService({}),
    /InnerLife digest run service requires ports/,
    "The digest run service must reject incomplete dependency wiring."
  );
  assert.throws(
    () => createInnerLifeShareTimingService({}),
    /InnerLife share timing service requires ports/,
    "The share timing service must reject incomplete dependency wiring."
  );
  assert.deepStrictEqual(
    [...DIGEST_RUN_PORTS].sort(),
    Object.keys(createDigestPorts()).sort(),
    "Digest run test ports must stay aligned with the production service contract."
  );
  assert.deepStrictEqual(
    [...SHARE_TIMING_PORTS].sort(),
    Object.keys(createSharePorts()).sort(),
    "Share timing test ports must stay aligned with the production service contract."
  );

  const digestCalls = [];
  let generatedInput = null;
  let persistedDigest = null;
  const digestRun = createInnerLifeDigestRunService(createDigestPorts({
    generateDigest: async (_database, input) => {
      generatedInput = input;
      return {
        body: "A generated digest.",
        source: "model",
        tier: input.tier
      };
    },
    getDigestRun: async (_database, id) => {
      digestCalls.push("get-digest");
      return { id, summary: "A generated digest." };
    },
    getSnapshotLite: async (_database, agentId) => {
      digestCalls.push("snapshot");
      return { agentId, mode: "lite" };
    },
    listInboxPage: async () => ({
      items: [{ id: "inbox-1", source: "continuity", body: "Keep the boundary explicit." }]
    }),
    listMemories: async () => [{
      id: "memory-1",
      title: "Stable API",
      body: "Keep the public API stable."
    }],
    persistDigestRun: async (_database, input) => {
      digestCalls.push("persist");
      persistedDigest = input;
    },
    pruneDigestRuns: async (_database, agentId) => {
      digestCalls.push("prune");
      assert.strictEqual(agentId, "codex");
    }
  }));
  const digestResult = await digestRun({}, {
    agentId: "codex",
    mode: "deep",
    prompt: "Finish the repository boundary."
  });
  assert.strictEqual(generatedInput.tier, "deep");
  assert(generatedInput.template.includes("Continue the architecture cleanup."));
  assert(generatedInput.template.includes("Keep the boundary explicit."));
  assert.strictEqual(persistedDigest.resumePacket.lineId, "line-1");
  assert.strictEqual(persistedDigest.generated.source, "model");
  assert.deepStrictEqual(persistedDigest.inboxItems.map((item) => item.id), ["inbox-1"]);
  assert.deepStrictEqual(digestCalls, ["persist", "prune", "get-digest", "snapshot"]);
  assert.strictEqual(digestResult.digest.id, "inner_digest-1");
  assert.strictEqual(digestResult.eventId, "inner_event-2");
  assert.strictEqual(digestResult.thoughtId, "inner_thought-3");
  assert.deepStrictEqual(digestResult.processedInboxIds, ["inbox-1"]);

  const shareCalls = [];
  let recordedCheck = null;
  const selectedShare = {
    id: "share-1",
    agent_id: "codex",
    status: "pending",
    body: "architecture boundary"
  };
  const shareTiming = createInnerLifeShareTimingService(createSharePorts({
    findAvailableShareId: async () => "share-1",
    getOptionalResumePacket: async () => ({
      resumePacket: {
        lineId: "line-1",
        currentPosition: {
          positionId: "position-1",
          summary: "Architecture boundary cleanup"
        },
        sharedReality: {},
        agentState: {},
        nextStep: "Remove the repository cycle"
      },
      sharedLineContext: {
        status: "selected",
        candidateLineIds: ["line-1"]
      }
    }),
    getShare: async (_database, id) => id === "share-1" ? selectedShare : null,
    getShareCheck: async (_database, id) => ({
      id,
      decision: recordedCheck.decision,
      metadata: recordedCheck.metadata
    }),
    getSnapshotLite: async (_database, agentId) => {
      shareCalls.push("snapshot");
      return { agentId, mode: "lite" };
    },
    recordCheck: async (_database, input) => {
      shareCalls.push("record");
      recordedCheck = input;
    }
  }));
  const shareResult = await shareTiming({}, {
    agentId: "codex",
    context: "Please share the architecture boundary result.",
    sessionId: "session-1"
  });
  assert.strictEqual(recordedCheck.decision, "review_first");
  assert.strictEqual(recordedCheck.sessionId, "session-1");
  assert.strictEqual(recordedCheck.metadata.contextSource, "provided+shared_line");
  assert(recordedCheck.metadata.explicitOverlap.includes("architecture"));
  assert(recordedCheck.metadata.lineOverlap.includes("boundary"));
  assert.deepStrictEqual(shareCalls, ["record", "snapshot"]);
  assert.strictEqual(shareResult.share.id, "share-1");
  assert.strictEqual(shareResult.check.decision, "review_first");

  let registerOnlyCheck = null;
  const registerOnlyShare = {
    id: "share-register-only",
    agent_id: "codex",
    status: "pending",
    body: "release trace evidence"
  };
  const registerOnlyTiming = createInnerLifeShareTimingService(createSharePorts({
    findAvailableShareId: async () => registerOnlyShare.id,
    getShare: async (_database, id) => id === registerOnlyShare.id ? registerOnlyShare : null,
    getShareCheck: async (_database, id) => ({
      id,
      decision: registerOnlyCheck.decision,
      reason: registerOnlyCheck.reason,
      metadata: registerOnlyCheck.metadata
    }),
    recordCheck: async (_database, input) => {
      registerOnlyCheck = input;
    }
  }));
  const registerOnlyResult = await registerOnlyTiming({}, {
    agentId: "codex",
    context: "We are wrapping up an engineering task together."
  });
  assert.strictEqual(registerOnlyCheck.decision, "review_first");
  assert.deepStrictEqual(registerOnlyCheck.metadata.overlap, []);
  assert.deepStrictEqual(registerOnlyCheck.metadata.explicitOverlap, []);
  assert.deepStrictEqual(registerOnlyCheck.metadata.lineOverlap, []);
  assert.strictEqual(registerOnlyCheck.metadata.contextSource, "provided");
  assert.match(registerOnlyCheck.reason, /Topic overlap is only evidence/);
  assert.strictEqual(registerOnlyResult.share.id, registerOnlyShare.id);

  for (const status of ["approved", "deferred"]) {
    let statusCheck = null;
    const statusShare = {
      id: `share-register-only-${status}`,
      agent_id: "codex",
      status,
      body: "release trace evidence"
    };
    const statusTiming = createInnerLifeShareTimingService(createSharePorts({
      findAvailableShareId: async () => statusShare.id,
      getShare: async (_database, id) => id === statusShare.id ? statusShare : null,
      getShareCheck: async (_database, id) => ({
        id,
        decision: statusCheck.decision,
        reason: statusCheck.reason,
        metadata: statusCheck.metadata
      }),
      recordCheck: async (_database, input) => {
        statusCheck = input;
      }
    }));
    const statusResult = await statusTiming({}, {
      agentId: "codex",
      context: "We are wrapping up an engineering task together."
    });
    assert.strictEqual(statusCheck.decision, "review_first");
    assert.deepStrictEqual(statusCheck.metadata.overlap, []);
    assert.strictEqual(statusCheck.metadata.contextSource, "provided");
    assert.match(statusCheck.reason, /Topic overlap is only evidence/);
    assert.strictEqual(statusResult.share.id, statusShare.id);
  }

  let contextlessCheck = null;
  const contextlessTiming = createInnerLifeShareTimingService(createSharePorts({
    findAvailableShareId: async () => registerOnlyShare.id,
    getShare: async (_database, id) => id === registerOnlyShare.id ? registerOnlyShare : null,
    getShareCheck: async (_database, id) => ({
      id,
      decision: contextlessCheck.decision,
      reason: contextlessCheck.reason
    }),
    recordCheck: async (_database, input) => {
      contextlessCheck = input;
    }
  }));
  await contextlessTiming({}, { agentId: "codex" });
  assert.strictEqual(contextlessCheck.decision, "defer");
  assert.match(contextlessCheck.reason, /No current context/);

  const noShareCalls = [];
  let noShareCheck = null;
  const noShareTiming = createInnerLifeShareTimingService(createSharePorts({
    getShareCheck: async (_database, id) => ({
      id,
      decision: noShareCheck.decision,
      metadata: noShareCheck.metadata
    }),
    getSnapshotLite: async (_database, agentId) => {
      noShareCalls.push("snapshot");
      return { agentId };
    },
    recordCheck: async (_database, input) => {
      noShareCalls.push("record");
      noShareCheck = input;
    }
  }));
  const noShareResult = await noShareTiming({}, { agentId: "codex" });
  assert.strictEqual(noShareCheck.decision, "none");
  assert.strictEqual(noShareCheck.metadata.contextSource, "none");
  assert.deepStrictEqual(noShareCalls, ["record", "snapshot"]);
  assert.strictEqual(noShareResult.share, null);

  const crossAgentTiming = createInnerLifeShareTimingService(createSharePorts({
    getShare: async () => selectedShare
  }));
  await assert.rejects(
    () => crossAgentTiming({}, { agentId: "other", shareId: "share-1" }),
    /InnerLife share belongs to another agent/
  );
  const automaticSelectionPriority = await verifyAutomaticShareSelectionPriority();

  const digestServiceSource = fs.readFileSync(
    path.join(root, "core/innerlife/services/digest-run.js"),
    "utf8"
  );
  const shareServiceSource = fs.readFileSync(
    path.join(root, "core/innerlife/services/share-timing.js"),
    "utf8"
  );
  const digestStoreSource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/digest-run-store.js"),
    "utf8"
  );
  const shareStoreSource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/share-timing-store.js"),
    "utf8"
  );
  const digestRepositorySource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/digests.js"),
    "utf8"
  );
  const shareRepositorySource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/shares.js"),
    "utf8"
  );
  const wiringSource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife/workflow-wiring.js"),
    "utf8"
  );
  const aggregatorSource = fs.readFileSync(
    path.join(root, "core/db/repositories/innerlife.js"),
    "utf8"
  );

  for (const [name, source] of [
    ["digest run", digestServiceSource],
    ["share timing", shareServiceSource]
  ]) {
    assert(
      !/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/.test(source),
      `InnerLife ${name} service must not own SQL.`
    );
    assert(
      !/\b(?:query|exec)\s*\(/.test(source),
      `InnerLife ${name} service must use declared ports.`
    );
  }
  assert(
    /\b(?:INSERT|UPDATE|DELETE)\b/.test(digestStoreSource),
    "Digest run SQL must stay in its private persistence adapter."
  );
  assert(
    /\b(?:SELECT|INSERT)\b/.test(shareStoreSource),
    "Share timing SQL must stay in its private persistence adapter."
  );
  for (const source of [digestRepositorySource, shareRepositorySource]) {
    assert(!source.includes("this.getOptionalInnerLifeResumePacket("));
    assert(!source.includes("this.getInnerLifeSnapshotLite("));
  }
  assert(
    digestRepositorySource.includes("return digestRunService(this, input);") &&
      digestRepositorySource.includes("return digestRunStore.prune(this, agentId, keep);"),
    "Digest public methods must delegate to the focused service and store."
  );
  assert(
    shareRepositorySource.includes("return shareTimingService(this, input);"),
    "Share timing public method must delegate to the focused service."
  );
  assert(
    wiringSource.includes("createInnerLifeDigestRunStore") &&
      wiringSource.includes("createInnerLifeDigestRunService") &&
      wiringSource.includes("createInnerLifeShareTimingStore") &&
      wiringSource.includes("createInnerLifeShareTimingService"),
    "The focused workflow composition must wire both services and stores explicitly."
  );
  assert(
    aggregatorSource.includes("createInnerLifeWorkflowWiring") &&
      aggregatorSource.includes("workflowWiring.shares") &&
      aggregatorSource.includes("workflowWiring.digests"),
    "The InnerLife composition root must install the focused workflow wiring."
  );

  for (const methodName of [
    "runInnerLifeDigest",
    "pruneInnerLifeDigestRuns",
    "checkInnerLifeShareTiming",
    "resolveInnerLifeSessionAfterthoughtFailure"
  ]) {
    assert.strictEqual(
      typeof ProductDatabase.prototype[methodName],
      "function",
      `ProductDatabase.${methodName} must remain stable.`
    );
  }
  const installed = listInstalledRepositoryMethods(ProductDatabase);
  // v0.6.10 adds seven summary-only read paths so default catalogs do not
  // hydrate rich stored bodies, profile state, or trace requests.
  for (const methodName of [
    "listContinuityLineSummaries",
    "listMemoryLinkSummaries",
    "listMemoryRecordSummaries",
    "listMemorySummariesPage",
    "listInnerLifeShareSummariesPage",
    "listInnerLifeProfileSummariesPage",
    "listGatewayTraceSummaries",
    "listInnerLifeShareActionSummaries",
    "getInnerLifeHistorySummaries",
    "listInnerLifeExperienceSummaries",
    "listInnerLifeSummaryPreviews"
  ]) {
    assert(
      installed.some((entry) => entry.name === methodName),
      `The bounded repository read path ${methodName} must remain installed.`
    );
  }
  assert.strictEqual(installed.length, 189, "The repository public API count must remain stable.");
  assert.strictEqual(
    installed.filter((entry) => entry.owner === "innerlife").length,
    72,
    "The InnerLife public API count must remain stable."
  );

  const cycles = findInnerLifeRepositoryCycles();
  assert.deepStrictEqual(
    cycles,
    [],
    `InnerLife repository modules must remain acyclic: ${JSON.stringify(cycles)}`
  );

  console.log(JSON.stringify({
    suite: "innerlife-workflow-service-boundary-smoke",
    digestPortCount: DIGEST_RUN_PORTS.length,
    shareTimingPortCount: SHARE_TIMING_PORTS.length,
    automaticSelectionPriority,
    repositoryCycles: cycles,
    repositoryMethodCount: installed.length,
    innerLifeMethodCount: installed.filter((entry) => entry.owner === "innerlife").length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
