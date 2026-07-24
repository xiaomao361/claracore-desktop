const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { createGatewayTools } = require("../gateway/tools");

function parseResult(result) {
  return JSON.parse(result.content[0].text);
}

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
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-controller-gateway-"));
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
  const prompt = "还记得我们之前决定的 gateway controller smoke 吗";
  const privateCandidateBody = "PRIVATE_CANDIDATE_BODY_MUST_NOT_LEAK_IN_OBSERVE";
  const codexMemory = await runtime.createProductMemory(app, { title: "Codex Gateway Controller", body: `${prompt}\n${privateCandidateBody}`, agentId: "codex" });
  const laraMemory = await runtime.createProductMemory(app, { title: "Lara Gateway Controller", body: prompt, agentId: "lara" });
  const restrictedPrompt = "还记得我们之前决定的 restricted gateway controller smoke 吗";
  await runtime.createProductMemory(app, {
    title: "Restricted Gateway Controller",
    body: restrictedPrompt,
    agentId: "codex",
    sensitivity: "restricted"
  });
  const canaryPrompt = "还记得我们之前决定的 trusted gateway canary 吗";
  const trustedCanaryMemory = await runtime.createProductMemory(app, {
    title: "Trusted Gateway Canary",
    body: `${canaryPrompt}\nTRUSTED_CANARY_CONTEXT`,
    agentId: "codex",
    labels: ["decision", "project:claracore-desktop"]
  });
  const laraCanaryPrompt = "还记得 Lara 之前决定的 trusted gateway canary 吗";
  const laraTrustedCanaryMemory = await runtime.createProductMemory(app, {
    title: "Lara Trusted Gateway Canary",
    body: `${laraCanaryPrompt}\nLARA_TRUSTED_CANARY_CONTEXT`,
    agentId: "lara",
    labels: ["decision", "project:claracore-desktop"]
  });
  const productDecisionPrompt = "还记得我们之前确认的 product decision canary 吗";
  const productDecisionMemory = await runtime.createProductMemory(app, {
    title: "Clara Product Decision Canary",
    body: `${productDecisionPrompt}\nCLARA_PRODUCT_DECISION_CONTEXT`,
    agentId: "clara",
    labels: ["product-decision", "claracore-desktop"]
  });
  const { paths, database } = await runtime.ensureProductCore(app);
  const semanticBefore = await semanticFingerprint(database);
  let caller = {
    agentId: "codex",
    clientId: "gateway-controller-smoke",
    conversationId: "gateway-controller-conversation",
    transport: "test"
  };
  const { toolDefinitions, callToolBody } = createGatewayTools({
    serverInfo: { name: "claracore-desktop", version: "test" },
    currentMcpAgentId: () => caller.agentId,
    currentCallerContext: () => caller,
    gatewayLaunchConfig: () => ({ displayCommand: "test", source: "test" }),
    runtimeAppForGateway: () => app,
    textResult(value) {
      return { content: [{ type: "text", text: JSON.stringify(value) }] };
    }
  });

  const definition = toolDefinitions().find((tool) => tool.name === "memory_context");
  assert(definition, "Gateway tools/list is missing memory_context.");
  assert(!definition.inputSchema.properties.agentId, "memory_context accepts a body-supplied Agent id.");

  const beforeDisabled = (await database.getMemoryControlLedgerStats()).eventCount;
  const disabled = parseResult(await callToolBody("memory_context", { prompt }, paths, database));
  assert.equal(disabled.reason, "controller_disabled");
  assert.equal(disabled.policyMode, "off");
  assert.equal(disabled.context, "");
  assert.equal((await database.getMemoryControlLedgerStats()).eventCount, beforeDisabled, "Disabled controller wrote a decision.");
  await runtime.saveProductSettings(app, { "memory.controller.mode": "observe" });

  const observed = parseResult(await callToolBody("memory_context", {
    prompt,
    agentId: "lara"
  }, paths, database));
  assert.equal(observed.action, "ABSTAIN");
  assert.equal(observed.reason, "low_relevance");
  assert.equal(observed.context, "", "Gateway observe mode returned injectable context.");
  assert.ok(!JSON.stringify(observed).includes(privateCandidateBody), "Gateway observe packet leaked candidate body outside context.");
  assert.ok(observed.candidates.some((candidate) => candidate.id === codexMemory.id));
  assert.ok(!observed.candidates.some((candidate) => candidate.id === laraMemory.id), "Body Agent id overrode Gateway caller identity.");
  const observedEvent = await database.getMemoryControlEvent(observed.decisionId);
  assert.equal(observedEvent.agentId, "codex");
  assert.equal(observedEvent.clientId, caller.clientId);
  assert.equal(observedEvent.conversationId, caller.conversationId);
  assert.deepEqual(observedEvent.injectedIds, []);

  const cached = parseResult(await callToolBody("memory_context", { prompt }, paths, database));
  assert.equal(cached.cacheStatus, "hit");
  assert.notEqual(cached.decisionId, observed.decisionId, "Gateway cache hit reused a decision id.");

  const beforeInvalidMode = (await database.getMemoryControlLedgerStats()).eventCount;
  await database.exec(`UPDATE app_settings SET value_json = '"future"' WHERE key = 'memory.controller.mode';`);
  const invalidMode = parseResult(await callToolBody("memory_context", { prompt }, paths, database));
  assert.equal(invalidMode.reason, "invalid_controller_mode");
  assert.equal(invalidMode.policyMode, "future");
  assert.equal(invalidMode.resultStatus, "error");
  assert.equal((await database.getMemoryControlLedgerStats()).eventCount, beforeInvalidMode, "Invalid controller mode wrote a decision.");
  await runtime.saveProductSettings(app, { "memory.controller.mode": "observe" });

  const noop = parseResult(await callToolBody("memory_context", {
    prompt: "检查当前文件语法"
  }, paths, database));
  assert.equal(noop.action, "NOOP");
  assert.equal(noop.context, "");

  const restricted = parseResult(await callToolBody("memory_context", {
    prompt: restrictedPrompt
  }, paths, database));
  assert.equal(restricted.action, "ABSTAIN");
  assert.equal(restricted.context, "");
  assert.deepEqual(restricted.candidates, []);

  const beforeUnknown = (await database.getMemoryControlLedgerStats()).eventCount;
  caller = { ...caller, agentId: "unknown-agent", conversationId: "unknown-caller" };
  const unknown = parseResult(await callToolBody("memory_context", {
    prompt,
    agentId: "codex"
  }, paths, database));
  assert.equal(unknown.action, "NOOP");
  assert.equal(unknown.reason, "caller_identity_required");
  assert.equal(unknown.decisionId, "");
  assert.equal((await database.getMemoryControlLedgerStats()).eventCount, beforeUnknown, "Unidentified caller created a controller decision.");

  caller = { ...caller, agentId: "codex", conversationId: "timeout-caller" };
  const originalSearch = database.searchMemories;
  database.searchMemories = () => new Promise((resolve) => setTimeout(() => resolve({ results: [] }), 3000));
  const timeoutStartedAt = Date.now();
  const timeout = parseResult(await callToolBody("memory_context", {
    prompt: "还记得我们之前决定的 gateway timeout smoke 吗"
  }, paths, database));
  database.searchMemories = originalSearch;
  assert.equal(timeout.action, "NOOP");
  assert.equal(timeout.reason, "controller_timeout");
  assert.equal(timeout.context, "");
  assert(Date.now() - timeoutStartedAt < 2900, "Gateway did not enforce the 2500 ms controller timeout.");
  assert.equal((await database.getMemoryControlEvent(timeout.decisionId)).resultStatus, "timeout");

  const originalCanarySearch = database.searchMemories;
  database.searchMemories = async (_prompt, _limit, searchOptions = {}) => {
    const trustedMemory = searchOptions.agentId === "lara"
      ? laraTrustedCanaryMemory
      : searchOptions.agentId === "clara"
        ? productDecisionMemory
        : trustedCanaryMemory;
    return {
      mode: "vector",
      results: [{
        ...trustedMemory,
        labels: [...trustedMemory.labels, `agent-id:${searchOptions.agentId}`],
        search_source: "vector",
        search_score: 0.91
      }]
    };
  };
  await runtime.saveProductSettings(app, {
    "memory.controller.mode": "canary",
    "memory.controller.canary_agent_ids": ["*"]
  });
  caller = { ...caller, agentId: "codex", conversationId: "trusted-canary-caller" };
  const canary = parseResult(await callToolBody("memory_context", {
    prompt: canaryPrompt
  }, paths, database));
  assert.equal(canary.action, "INJECT_TOP1");
  assert.equal(canary.policyMode, "canary");
  assert.equal(canary.configuredMode, "canary");
  assert.equal(canary.canaryEligible, true);
  assert.ok(canary.context.includes(canary.decisionId), "Canary context omitted the decision id.");
  assert.ok(canary.context.includes(trustedCanaryMemory.id), "Canary context omitted the selected Memory id.");
  assert.ok(canary.context.includes("Verify against current code, runtime, data, and user statements."));
  assert.deepEqual((await database.getMemoryControlEvent(canary.decisionId)).injectedIds, [trustedCanaryMemory.id]);

  caller = { ...caller, agentId: "lara", conversationId: "all-agents-canary-caller" };
  const allAgentsCanary = parseResult(await callToolBody("memory_context", {
    prompt: laraCanaryPrompt
  }, paths, database));
  assert.equal(allAgentsCanary.action, "INJECT_TOP1");
  assert.equal(allAgentsCanary.policyMode, "canary");
  assert.equal(allAgentsCanary.canaryEligible, true);
  assert.ok(allAgentsCanary.context.includes(laraTrustedCanaryMemory.id));
  assert.ok(!allAgentsCanary.context.includes(trustedCanaryMemory.id), "All-Agent canary crossed Agent scope.");
  assert.deepEqual(
    (await database.getMemoryControlEvent(allAgentsCanary.decisionId)).injectedIds,
    [laraTrustedCanaryMemory.id]
  );

  caller = { ...caller, agentId: "clara", conversationId: "product-decision-canary-caller" };
  const productDecisionCanary = parseResult(await callToolBody("memory_context", {
    prompt: productDecisionPrompt
  }, paths, database));
  assert.equal(productDecisionCanary.action, "INJECT_TOP1");
  assert.equal(productDecisionCanary.policyMode, "canary");
  assert.equal(productDecisionCanary.canaryEligible, true);
  assert.ok(productDecisionCanary.context.includes(productDecisionMemory.id));
  assert.ok(!productDecisionCanary.context.includes(trustedCanaryMemory.id), "Product-decision canary crossed Codex Agent scope.");
  assert.ok(!productDecisionCanary.context.includes(laraTrustedCanaryMemory.id), "Product-decision canary crossed Lara Agent scope.");
  assert.deepEqual(
    (await database.getMemoryControlEvent(productDecisionCanary.decisionId)).injectedIds,
    [productDecisionMemory.id]
  );

  await runtime.saveProductSettings(app, {
    "memory.controller.canary_agent_ids": ["codex"]
  });
  caller = { ...caller, agentId: "lara", conversationId: "explicitly-non-allowlisted-caller" };
  const nonAllowlisted = parseResult(await callToolBody("memory_context", {
    prompt: laraCanaryPrompt
  }, paths, database));
  assert.equal(nonAllowlisted.configuredMode, "canary");
  assert.equal(nonAllowlisted.policyMode, "observe");
  assert.equal(nonAllowlisted.canaryEligible, false);
  assert.equal(nonAllowlisted.context, "");

  caller = { ...caller, agentId: "codex", conversationId: "historical-canary-caller" };
  const historical = parseResult(await callToolBody("memory_context", {
    prompt: canaryPrompt,
    timeView: "historical"
  }, paths, database));
  assert.equal(historical.policyMode, "observe");
  assert.equal(historical.canaryEligible, false);
  assert.equal(historical.context, "");

  const beforeInvalidAllowlist = (await database.getMemoryControlLedgerStats()).eventCount;
  await database.exec(`
    UPDATE app_settings
    SET value_json = '"codex"'
    WHERE key = 'memory.controller.canary_agent_ids';
  `);
  const invalidAllowlist = parseResult(await callToolBody("memory_context", {
    prompt: canaryPrompt
  }, paths, database));
  assert.equal(invalidAllowlist.reason, "invalid_canary_allowlist");
  assert.equal(invalidAllowlist.context, "");
  assert.equal((await database.getMemoryControlLedgerStats()).eventCount, beforeInvalidAllowlist, "Malformed canary allowlist wrote a decision.");
  database.searchMemories = originalCanarySearch;

  assert.deepEqual(await semanticFingerprint(database), semanticBefore, "Gateway controller mutated semantic domain tables.");
  console.log(JSON.stringify({
    suite: "memory-controller-gateway-smoke",
    disabledNoAudit: true,
    observeOnly: true,
    trustedCaller: observedEvent.agentId,
    bodyAgentIgnored: true,
    cacheDecisionUnique: cached.decisionId !== observed.decisionId,
    invalidMode: invalidMode.reason,
    canaryContext: canary.action,
    allAgentsCanary: allAgentsCanary.action,
    allAgentsScopedMemory: laraTrustedCanaryMemory.id,
    productDecisionCanary: productDecisionCanary.action,
    productDecisionScopedMemory: productDecisionMemory.id,
    nonAllowlistedMode: nonAllowlisted.policyMode,
    historicalMode: historical.policyMode,
    invalidAllowlist: invalidAllowlist.reason,
    restrictedAction: restricted.action,
    unidentifiedAction: unknown.reason,
    timeoutAction: timeout.reason,
    semanticReadOnly: true
  }, null, 2));
  database.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
