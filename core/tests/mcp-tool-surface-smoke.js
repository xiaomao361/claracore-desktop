const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");
const { profileToolDefinitions } = require("../gateway/tool-profiles");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-tool-surface-"));
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  await database.updateSettings({ "innerlife.provider": "disabled", "memory.controller.mode": "observe" });
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, "../.."), runtimeDir: path.join(root, "runtime") };
  const app = { isPackaged: false, getPath: () => root };
  const gateway = createHttpAgentGateway({ app, ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({}), port: 0 });
  try {
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find(item => item.id === "streamable-http-mcp");
    const headers = { Authorization: endpoint.authHeader.replace(/^Authorization:\s*/, ""), "Content-Type": "application/json",
      "X-ClaraCore-Agent-ID": "codex", "X-ClaraCore-Client-ID": "surface-test", "X-ClaraCore-Conversation-ID": "surface-conversation" };
    let id = 0;
    async function rpc(method, params = {}, profile, query = "") {
      const response = await fetch(endpoint.url + query, { method: "POST", headers: { ...headers,
        ...(profile === undefined ? {} : { "X-ClaraCore-Tool-Profile": profile }) },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
      assert.equal(response.status, 200);
      return response.json();
    }
    const initialized = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {} });
    assert.equal(initialized.result.capabilities.tools.listChanged, undefined, "No live catalog refresh is promised");
    const defaults = (await rpc("tools/list")).result.tools;
    const names = new Set(defaults.map(tool => tool.name));
    assert.equal(names.size, 25);
    async function call(name, args = {}, { profile, defaultOnly = true, failed = false } = {}) {
      if (defaultOnly) {
        assert(names.has(name), `Daily workflow escaped core through ${name}`);
        const advertised = defaults.find(tool => tool.name === name).inputSchema.properties;
        for (const key of Object.keys(args)) assert(Object.hasOwn(advertised, key), `Daily workflow used hidden argument ${name}.${key}`);
      }
      const response = await rpc("tools/call", { name, arguments: args }, profile);
      if (failed) {
        assert(response.error || response.result?.isError, `Expected visible failure for ${name}`);
        return response;
      }
      assert(!response.error, JSON.stringify(response.error));
      assert(!response.result?.isError, JSON.stringify(response.result));
      return JSON.parse(response.result.content[0].text);
    }
    for (const [input, resolved] of [[undefined, "core"], ["core", "core"], ["CORE-COMPAT", "core-compat"], ["full", "full"], ["invalid", "core"]]) {
      const result = await rpc("tools/list", {}, input);
      assert.deepEqual(result.result.tools, JSON.parse(JSON.stringify(profileToolDefinitions(resolved))));
      const connection = await call("claracore_connection_test", {}, { profile: input });
      assert.equal(connection.toolProfile, resolved);
      assert.deepEqual(connection.nextCalls, ["shared_line_get"]);
    }
    assert.deepEqual((await rpc("tools/list", {}, undefined, "?toolProfile=core-compat")).result.tools, JSON.parse(JSON.stringify(profileToolDefinitions("core-compat"))));
    assert.deepEqual((await rpc("tools/list", {}, "core", "?toolProfile=full")).result.tools, defaults, "Explicit header wins over query");
    const docs = await rpc("tools/call", { name: "gateway_docs", arguments: { section: "diagnostics" } });
    assert.match(docs.result.content[0].text, /core-compat/);
    assert.match(docs.result.content[0].text, /Reconnect/);
    for (const hidden of ["innerlife_pending_shares", "innerlife_status", "claracore_status", "knowledge_index_rebuild", "understanding_resume", "gateway_trace_list"]) assert(!names.has(hidden));
    const status = await call("claracore_status", {}, { defaultOnly: false });
    assert.equal(status.connection.toolProfile, "core", "Fixed hook/API calls remain callable outside discovery");
    await call("innerlife_pending_shares", {}, { defaultOnly: false });
    await call("not_a_tool", {}, { defaultOnly: false, failed: true });

    const old = await call("memoria_create", { title: "Surface fact", body: "Surface orchard used port 1000." });
    const oldId = old.memory?.id || old.id;
    assert(oldId);
    const searched = await call("memoria_search", { query: "Surface orchard", limit: 10 });
    assert(searched.results.some(item => item.id === oldId));
    const read = await call("memoria_get", { id: oldId });
    assert.match(JSON.stringify(read), /1000/);
    await call("memoria_update", { id: oldId, body: "Surface orchard previously used port 1000." });
    const current = await call("memoria_create", { title: "Surface fact current", body: "Surface orchard now uses port 2000." });
    const currentId = current.memory?.id || current.id;
    await call("memoria_link_list", { memoryId: currentId });
    await call("memoria_link_create", { fromMemoryId: currentId, toMemoryId: oldId, kind: "related", note: "Same orchard" });
    await call("memoria_supersede", { currentMemoryId: currentId, historicalMemoryId: oldId, note: "Confirmed replacement" });
    const now = await call("memoria_search", { query: "Surface orchard", limit: 10 });
    assert(now.results.some(item => item.id === currentId));
    assert(!now.results.some(item => item.id === oldId));
    assert.equal((await call("memoria_get", { id: oldId })).memory.status, "superseded");
    assert.match(JSON.stringify(await call("memoria_link_list", { memoryId: currentId })), /supersedes/);

    const a = await call("shared_line_create", { title: "Surface A", agentId: "codex", makeActive: true });
    const b = await call("shared_line_create", { title: "Surface B", agentId: "codex", makeActive: true });
    const aId = a.line.id, bId = b.line.id;
    const catalog = await call("shared_line_list", { status: "active" });
    assert(catalog.lines.some(item => item.id === aId || item.lineId === aId));
    const ambiguous = await call("shared_line_get", {}, { failed: true });
    assert.match(JSON.stringify(ambiguous), /SHARED_LINE_ID_REQUIRED/);
    await call("shared_line_update", { summary: "Must not guess", nextStep: "Nothing" }, { failed: true });
    await call("shared_line_activate", { lineId: aId });
    await call("shared_line_agent_state");
    await call("shared_line_update", { lineId: aId, summary: "Surface A checkpoint", nextStep: "Continue A", interpretationStatus: "active" });
    assert.equal((await call("shared_line_get", { lineId: aId })).summary, "Surface A checkpoint");
    assert.notEqual((await call("shared_line_get", { lineId: bId })).summary, "Surface A checkpoint");

    const startArgs = { host: "no-hook-test", externalSessionId: "surface-session", lineId: aId };
    const started = await call("innerlife_session_start", startArgs);
    assert.equal((await call("innerlife_session_start", startArgs)).session.id, started.session.id);
    const automatic = await call("gateway_auto_context", { prompt: "Surface orchard", sessionId: started.session.id });
    assert.equal(automatic.decision, "abstain");
    assert.equal(automatic.block, null);
    await call("innerlife_submit_inbox", { source: "isolated-test", body: "Surface continuation fixture" });
    const ended = await call("innerlife_session_end", { sessionId: started.session.id, summary: "Surface A checkpoint" });
    assert.equal(ended.session.status, "ended");
    assert.equal((await call("innerlife_session_end", { sessionId: started.session.id, summary: "Surface A checkpoint" })).session.status, "ended");
    const missing = await call("innerlife_session_end", { sessionId: "does-not-exist", bestEffort: true });
    assert.equal(missing.missing, true);
    // Complete synthetic afterthought generation without an external model.
    database.innerLifeGenerate = async () => "Surface A checkpoint thought for the user.";
    await database.processPendingSessionAfterthoughts(5);
    const shareId = ended.share.id;
    const checked = await call("innerlife_share_check", { shareId, lineId: aId, context: "Surface A checkpoint" });
    assert.equal(checked.share.id, shareId);
    assert.equal((await database.getInnerLifeShare(shareId)).status, "pending", "Reading is not delivery");
    await call("innerlife_mark_share", { id: shareId, action: "used" }, { failed: true });
    assert.equal((await database.getInnerLifeShare(shareId)).status, "pending");
    const used = await call("innerlife_mark_share", { id: shareId, action: "used", deliveryEvidence: {
      conversationId: "surface-conversation", responseId: "surface-response", responseExcerpt: "Surface A checkpoint thought for the user.", sharedAt: new Date().toISOString()
    } });
    assert.equal(used.share.status, "used");
    await call("shared_line_archive", { lineId: aId });
    console.log(JSON.stringify({ suite: "mcp-tool-surface", core: 25, compat: 38, full: 83, dailyWorkflowUsesAdvertisedSchemas: true, ambiguityRefusesWrite: true, lifecycleRetry: true, evidenceRequired: true, passed: true }));
  } finally {
    await gateway.stop();
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
