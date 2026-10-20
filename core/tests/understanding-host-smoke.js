const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { Client, StreamableHTTPClientTransport } = require("@modelcontextprotocol/client");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");
const { createUnderstandingHost } = require("../gateway/understanding/host");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-understanding-host-"));
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const app = { isPackaged: false, getPath: () => root };
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, "../.."), runtimeDir: path.join(root, "runtime") };
  const gateway = createHttpAgentGateway({ app, ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({}), port: 0 });
  let client;
  try {
    let modelCalls = 0;
    database.innerLifeGenerate = async input => {
      modelCalls++;
      const { events } = JSON.parse(input.prompt);
      const event = events[0];
      return JSON.stringify({ operations: [{ kind: "memory", eventIds: [event.id], quotes: [{ eventId: event.id, text: event.text }],
        rationale: "User's explicit fixture decision", certainty: "confirmed", body: event.text }],
      coverage: events.map(item => ({ eventId: item.id, ...Object.fromEntries(["memory", "knowledge", "continuity", "innerlife"].map(domain => [domain,
        { status: domain === "memory" ? "planned" : "none", reason: "Fixture routing", operations: domain === "memory" ? [0] : [] }])) })) });
    };
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find(item => item.id === "streamable-http-mcp");
    const token = endpoint.authHeader.replace(/^Authorization:\s*Bearer\s*/u, "");
    const caller = { agentId: "codex", clientId: "fixture-host", conversationId: "host-evidence" };
    const headers = { Authorization: `Bearer ${token}`, "X-ClaraCore-Agent-ID": caller.agentId, "X-ClaraCore-Client-ID": caller.clientId, "X-ClaraCore-Conversation-ID": caller.conversationId };
    client = new Client({ name: "fixture-host", version: "1" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url), { requestInit: { headers } }));
    let calls = [], loseAfterWrite = false, failBeforeSend = false;
    const callTool = async (name, args) => {
      calls.push(name);
      if (failBeforeSend) { failBeforeSend = false; throw new Error("fixture transport failure before send"); }
      const result = await client.callTool({ name, arguments: args });
      if (loseAfterWrite && name === "understanding_submit") { loseAfterWrite = false; throw new Error("fixture lost response after write"); }
      return result;
    };
    const configuration = { caller, stateDirectory: path.join(root, "host-state"), callTool, allowModel: true, grants: { memory: true },
      capabilities: { rawEvidence: true, stableTurnIds: true, endCallback: false } };
    const disabled = createUnderstandingHost(configuration);
    assert.equal((await disabled.onEvent({ kind: "turn_completed" })).status, "disabled"); assert.equal(calls.length, 0);
    const unsupported = createUnderstandingHost({ ...configuration, enabled: true, capabilities: {} });
    assert.equal((await unsupported.onEvent({ kind: "turn_completed" })).code, "host_evidence_capability_missing"); assert.equal(calls.length, 0);
    const host = createUnderstandingHost({ ...configuration, enabled: true });
    assert.equal((await host.onEvent({ kind: "turn_completed", turnKind: "goal_continuation" })).reason, "non_user_goal_continuation");
    assert.equal(calls.length, 0);
    const event = { kind: "turn_completed", turnId: "turn-1", events: [{ id: "u1", speaker: "user", text: "HOST_USER_DECISION_CANARY", sourceRef: "host:host-evidence#u1" }] };
    loseAfterWrite = true;
    const uncertain = await host.onEvent(event);
    assert.equal(uncertain.status, "pending"); assert.equal(modelCalls, 1);
    assert.equal((await database.query("SELECT COUNT(*) AS n FROM memories;"))[0].n, 1);
    const restarted = createUnderstandingHost({ ...configuration, enabled: true });
    const recovered = await restarted.recoverPending();
    assert.equal(recovered.items[0].status, "completed"); assert.equal(calls.at(-1), "understanding_resume"); assert.equal(modelCalls, 1);
    assert.equal((await database.query("SELECT COUNT(*) AS n FROM memories;"))[0].n, 1);
    const callsBefore = calls.length;
    assert.equal((await restarted.onEvent(event)).status, "completed"); assert.equal(calls.length, callsBefore);
    await assert.rejects(restarted.onEvent({ ...event, events: [{ ...event.events[0], text: "changed same turn" }] }), /host_checkpoint_conflict/);
    // Lost transport BEFORE the server received it: first prove absence, then
    // submit the exact original payload. Never invent a new submission id.
    failBeforeSend = true;
    const earlyFailure = await restarted.onEvent({ ...event, turnId: "turn-2", events: [{ ...event.events[0], id: "u2", text: "SECOND_HOST_DECISION" }] });
    assert.equal(earlyFailure.status, "pending");
    const recoveredEarly = await restarted.resume({ turnId: "turn-2" });
    assert.equal(recoveredEarly.status, "completed");
    assert.deepEqual(calls.slice(-2), ["understanding_resume", "understanding_submit"]);
    assert.equal((await database.query("SELECT COUNT(*) AS n FROM memories;"))[0].n, 2);
    assert.equal((await restarted.onEvent({ kind: "conversation_ended" })).code, "end_callback_unavailable");
    const ended = createUnderstandingHost({ ...configuration, enabled: true, capabilities: { ...configuration.capabilities, endCallback: true } });
    assert.equal((await ended.onEvent({ kind: "conversation_ended" })).status, "no_new_delta");
    const forged = createUnderstandingHost({ ...configuration, enabled: true, grants: {} });
    const blocked = await forged.onEvent({ ...event, turnId: "turn-forged", grants: { memory: true }, events: [{ ...event.events[0], text: "FORGED_EVENT_AUTHORITY" }] });
    assert.equal(blocked.status, "attention"); assert.equal(blocked.receipt.items[0].code, "authorization_required");
    assert.equal((await database.query("SELECT COUNT(*) AS n FROM memories;"))[0].n, 2);

    // Executable bridge uses explicit connection data, no global config lookup.
    const { runHostEvent } = await import(pathToFileURL(path.resolve(__dirname, "../../scripts/understanding-host.mjs")).href);
    assert.equal((await runHostEvent({ stateDirectory: root, ...caller }, {}, () => { throw new Error("Unexpected network"); })).networkCalls, 0);
    const tokenVariable = "CLARACORE_UNDERSTANDING_TEST_TOKEN";
    process.env[tokenVariable] = token;
    try {
      const bridge = await runHostEvent({ enabled: true, stateDirectory: path.join(root, "bridge"), ...caller, endpoint: endpoint.url, tokenEnv: tokenVariable,
        allowModel: true, grants: { memory: true }, capabilities: configuration.capabilities }, { ...event, turnId: "bridge-turn" }, async (url, requestHeaders) => {
        const transportClient = new Client({ name: "bridge", version: "1" }, { versionNegotiation: { mode: "auto" } });
        await transportClient.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: requestHeaders } }));
        return { callTool: (name, args) => transportClient.callTool({ name, arguments: args }), close: () => transportClient.close() };
      });
      assert.equal(bridge.status, "completed");
    } finally { delete process.env[tokenVariable]; }
    console.log(JSON.stringify({ suite: "understanding-host", authenticatedMcp: true, disabledZeroCalls: true, durableCheckpointRecovery: true,
      beforeAndAfterSendFailures: true, authorityFromHostOnly: true, missingEndExplicit: true, realHostInstalled: false, semanticModel: "fixture" }));
  } finally { if (client) await client.close(); await gateway.stop(); await database.close(); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
