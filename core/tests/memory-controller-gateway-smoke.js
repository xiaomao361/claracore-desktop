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
  await database.exec(`UPDATE app_settings SET value_json = '"canary"' WHERE key = 'memory.controller.mode';`);
  const invalidMode = parseResult(await callToolBody("memory_context", { prompt }, paths, database));
  assert.equal(invalidMode.reason, "invalid_controller_mode");
  assert.equal(invalidMode.policyMode, "canary");
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

  assert.deepEqual(await semanticFingerprint(database), semanticBefore, "Gateway controller mutated semantic domain tables.");
  console.log(JSON.stringify({
    suite: "memory-controller-gateway-smoke",
    disabledNoAudit: true,
    observeOnly: true,
    trustedCaller: observedEvent.agentId,
    bodyAgentIgnored: true,
    cacheDecisionUnique: cached.decisionId !== observed.decisionId,
    invalidMode: invalidMode.reason,
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
