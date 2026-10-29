const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { Client, StreamableHTTPClientTransport } = require("@modelcontextprotocol/client");
const runtimeRoot = process.env.CLARACORE_TEST_ASAR || path.resolve(__dirname, "../..");
const { initializeProductDatabase } = require(path.join(runtimeRoot, "core/db/database"));
const { createHttpAgentGateway } = require(path.join(runtimeRoot, "electron/http-agent-gateway"));
const { toolDefinitions, callableToolDefinitions, legacyDefinitions } = require(path.join(runtimeRoot, "core/gateway/tool-definitions"));
const { LEGACY_TOOL_ROUTES } = require(path.join(runtimeRoot, "core/gateway/tool-compatibility-routes"));
const { createGatewayTools } = require(path.join(runtimeRoot, "core/gateway/tools"));

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-capabilities-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  await database.updateSettings({ "innerlife.provider": "disabled" });
  const app = { isPackaged: false, getPath: () => root };
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, "../.."), runtimeDir: path.join(root, "runtime") };
  const gateway = createHttpAgentGateway({ app, ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({}), port: 0 });
  let client;
  try {
    assert.equal(toolDefinitions().length, 83);
    assert.equal(callableToolDefinitions().length, 99, "83 active contracts plus 16 transitional aliases");
    const currentNames = new Set(toolDefinitions().map(tool => tool.name));
    const callableNames = new Set(callableToolDefinitions().map(tool => tool.name));
    const baseline = require("./fixtures/mcp-full97-baseline.json");
    const canonical = new Map(toolDefinitions().map(tool => [tool.name, tool]));
    const legacy = new Map(legacyDefinitions.map(tool => [tool.name, tool]));
    const extended = new Set(["innerlife_status", "memoria_maintenance_audit", "innerlife_pending_shares"]);
    const digest = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    assert.equal(baseline.tools.length, 97);
    for (const previous of baseline.tools) {
      if (LEGACY_TOOL_ROUTES[previous.name]) assert.equal(digest(legacy.get(previous.name)), previous.sha256, "Preserved legacy schema");
      else if (previous.name === "gateway_auto_context") {
        const previousShape = JSON.parse(JSON.stringify(canonical.get(previous.name)));
        assert.deepEqual(previousShape.inputSchema.properties.detail.enum, ["summary", "full"]);
        assert.equal(previousShape.inputSchema.properties.diagnosticsFor.maxLength, 160);
        delete previousShape.inputSchema.properties.detail;
        delete previousShape.inputSchema.properties.diagnosticsFor;
        // Model removal changes help text only; preserve the original schema check.
        const properties = previousShape.inputSchema.properties;
        assert.equal(properties.domain.description, "Explicit scope wins; otherwise both. Knowledge stays observation-only for current Memory-only hosts.");
        assert.equal(properties.query.description, "Optional bounded retrieval query; otherwise the prompt is used.");
        assert.equal(properties.mode.description, "Explicit mode wins; otherwise semantic. Memory retains its controller gates.");
        properties.domain.description = "Explicit scope wins; otherwise both or opted-in Jev advice. Knowledge stays observation-only for current Memory-only hosts.";
        properties.query.description = "Optional bounded retrieval query; only this query (or bounded prompt) may reach enabled Jev.";
        properties.mode.description = "Explicit mode wins; otherwise semantic or opted-in Jev advice. Memory retains its controller gates.";
        assert.equal(digest(previousShape), previous.sha256, "Automatic context preserves arguments after diagnostic additions and help-text cleanup");
      }
      else if (previous.name === "shared_line_list") {
        // 1.0.4 adds only an optional query. Verify the entire old contract
        // still hashes identically after removing that one additive field.
        const previousShape = JSON.parse(JSON.stringify(canonical.get(previous.name)));
        assert.equal(previousShape.inputSchema.properties.query.type, "string");
        assert.equal(previousShape.inputSchema.properties.query.maxLength, 200);
        delete previousShape.inputSchema.properties.query;
        assert.equal(digest(previousShape), previous.sha256, "Shared Line search must preserve every pre-existing schema field");
      }
      else if (!extended.has(previous.name)) assert.equal(digest(canonical.get(previous.name)), previous.sha256, `Unrelated schema changed: ${previous.name}`);
    }
    const map = require("./fixtures/mcp-capability-map.json");
    assert.deepEqual(map.tools.map(tool => tool.name), baseline.tools.map(tool => tool.name));
    for (const entry of map.tools) assert.equal(entry.replacement, LEGACY_TOOL_ROUTES[entry.name]?.name || entry.name);
    for (const [old, route] of Object.entries(LEGACY_TOOL_ROUTES)) {
      assert(!currentNames.has(old));
      assert(currentNames.has(route.name));
      assert(callableNames.has(old));
    }
    assert.equal(callableNames.size, 99, "No duplicate callable definitions");
    // Direct integrations do not receive the HTTP-injected agentId. The old
    // source aliases still have to write for the resolved caller, not default.
    const direct = createGatewayTools({ currentMcpAgentId: () => "direct-agent", runtimeAppForGateway: () => app, textResult: value => value });
    for (const name of ["innerlife_submit_fact", "innerlife_submit_continuity"]) {
      const result = await direct.callToolBody(name, { body: "Direct caller fixture" }, paths, database);
      assert.equal(result.inbox.agentId, "direct-agent");
    }
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find(item => item.id === "streamable-http-mcp");
    const headers = { Authorization: endpoint.authHeader.replace(/^Authorization:\s*/, ""), "X-ClaraCore-Agent-ID": "codex",
      "X-ClaraCore-Client-ID": "consolidation-test", "X-ClaraCore-Conversation-ID": "consolidation-conversation", "X-ClaraCore-Tool-Profile": "full" };
    client = new Client({ name: "consolidation-test", version: "1" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url), { requestInit: { headers } }));
    assert.equal((await client.listTools()).tools.length, 83);
    let requestId = 0;
    const legacyRpc = async (name, args) => {
      const response = await fetch(endpoint.url, { method: "POST", headers: { ...headers, "Content-Type": "application/json", "MCP-Protocol-Version": "2025-06-18" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method: "tools/call", params: { name, arguments: args } }) });
      const rpc = await response.json();
      if (rpc.error) throw new Error(rpc.error.message);
      return rpc.result;
    };
    for (const protocol of ["legacy", "modern"]) {
      const seenAliases = new Set();
      async function raw(name, args = {}) {
        const result = protocol === "modern" ? await client.callTool({ name, arguments: args }) : await legacyRpc(name, args);
        if (Object.hasOwn(LEGACY_TOOL_ROUTES, name)) {
          seenAliases.add(name);
          assert.equal(result._meta?.["claracore/compatibility"]?.replacementTool, LEGACY_TOOL_ROUTES[name].name);
        }
        return result;
      }
      async function call(name, args = {}) {
        const result = await raw(name, args);
        assert(!result.isError, JSON.stringify(result));
        return JSON.parse(result.content[0].text);
      }
      async function fails(name, args = {}) {
        await assert.rejects(async () => {
          const result = await raw(name, args);
          if (result.isError) throw new Error(result.content[0].text);
        });
      }
      // Meaning comes from original contracts: source aliases must preserve
      // source, and caller-supplied fields cannot change the old operation.
      const fact = await call("innerlife_submit_fact", { source: "continuity", body: `${protocol} fact fixture` });
      const continuity = await call("innerlife_submit_continuity", { source: "fact", body: `${protocol} continuity fixture` });
      assert.equal(fact.inbox.source, "fact");
      assert.equal(continuity.inbox.source, "continuity");
      assert.equal(fact.inbox.body, `${protocol} fact fixture`);
      const start = await call("innerlife_session_start", { externalSessionId: `${protocol}-session`, host: "isolated-test" });
      const listed = await call("innerlife_sessions", { limit: 1, offset: 0, status: "active" });
      const selected = await call("innerlife_status", { detail: "full", section: "sessions", limit: 1, offset: 0, status: "active" });
      assert.deepEqual(listed.sessions, selected.sessions);
      assert.equal(listed.page.total, selected.pages.sessions.total);
      assert.equal(listed.page.limit, 1);
      await fails("innerlife_sessions", { limit: 1, status: " ACTIVE " });
      await fails("innerlife_sessions", { status: " " });
      const detail = await call("innerlife_session_get", { id: start.session.id });
      const selectedDetail = await call("innerlife_status", { detail: "full", section: "sessions", recordId: start.session.id });
      assert.deepEqual(detail.session, selectedDetail.record);
      assert.deepEqual(await call("innerlife_session_get", { id: "not-found" }), { error: "not found", id: "not-found" });
      await fails("innerlife_status", { detail: "full", section: "sessions", recordId: "not-found" });
      const foreign = await database.startInnerLifeSession({ agentId: "other-agent", externalSessionId: `${protocol}-foreign`, host: "isolated-test" });
      await fails("innerlife_session_get", { id: foreign.session.id });
      await fails("innerlife_status", { detail: "full", section: "sessions", recordId: foreign.session.id });
      await fails("innerlife_sessions", { limit: 51 });

      // The old doctor/daemon reads initialized state. New diagnostics must
      // not inherit that side effect, including for an existing profile.
      await database.exec("DELETE FROM innerlife_daemon_state WHERE agent_id = 'codex';");
      const daemonRows = async () => (await database.query("SELECT count(*) n FROM innerlife_daemon_state WHERE agent_id = 'codex';"))[0].n;
      assert.equal(await daemonRows(), 0);
      const daemon = await call("innerlife_status", { detail: "full", section: "daemon" });
      const doctor = await call("innerlife_status", { detail: "full", section: "doctor" });
      assert.equal(daemon.record.agentId, "codex");
      assert(doctor.record.status);
      assert.equal(await daemonRows(), 0);
      await fails("innerlife_status", { detail: "full", section: "daemon", recordId: "unexpected" });
      const oldDoctor = await call("innerlife_doctor");
      assert(oldDoctor.status);
      assert.equal(await daemonRows(), 1);
      await database.exec("DELETE FROM innerlife_daemon_state WHERE agent_id = 'codex';");
      const oldDaemon = await call("innerlife_daemon_status");
      assert.equal(oldDaemon.agentId, "codex");
      assert.equal(await daemonRows(), 1);

      const reportPairs = [
        ["memoria_maintenance_check", "maintenance"],
        ["memoria_merge_suggestions", "merge-suggestions"],
        ["memoria_archive_suggestions", "archive-suggestions"]
      ];
      for (const [old, section] of reportPairs) {
        const args = { limit: 2, olderThanDays: 7 };
        const oldReport = await call(old, args);
        const current = await call("memoria_maintenance_audit", { ...args, section });
        const stable = value => { const { generatedAt: _generatedAt, checkedAt: _checkedAt, ...rest } = value; return rest; };
        assert.deepEqual(stable(oldReport), stable(current));
      }
      await fails("memoria_maintenance_audit", { section: "typo" });
      const audit = await call("memoria_maintenance_audit");
      assert(audit.maintenance && audit.review.mergeSuggestions && audit.review.archiveSuggestions);

      const model = `${protocol}-fixture-model`;
      assert.deepEqual(await call("shared_line_model_adjustment_get", { model: "" }), { modelAdjustment: null });
      await call("shared_line_model_adjustment_set", { model, forbiddenPhrases: ["fixture phrase"], injectPrompt: "fixture instruction" });
      const modelRead = await call("shared_line_model_adjustment_get", { model });
      assert.deepEqual(modelRead, await call("shared_line_model_adjustment", { action: "get", model }));
      assert(JSON.stringify(modelRead).includes("fixture phrase"));
      const models = await call("shared_line_model_adjustment_list");
      assert.deepEqual(models, await call("shared_line_model_adjustment", { action: "list" }));
      await fails("shared_line_model_adjustment", { model });
      await fails("shared_line_model_adjustment", { action: "delete" });
      await fails("shared_line_model_adjustment", { action: "get", model, injectPrompt: "must not write" });
      assert.deepEqual(await call("shared_line_model_adjustment_get", { model, action: "delete" }), modelRead, "Old name determines the action");
      await call("shared_line_model_adjustment_delete", { model });

      const alias = `${protocol}-alias`, canonicalLabel = `${protocol}-canonical`;
      await call("memoria_label_alias_create", { alias, canonicalLabel });
      const aliases = await call("memoria_label_alias_list");
      assert(JSON.stringify(aliases).includes(canonicalLabel));
      assert.deepEqual(aliases, await call("memoria_label_alias", { action: "list" }));
      await fails("memoria_label_alias", { alias, canonicalLabel });
      await fails("memoria_label_alias", { action: "upsert", alias });
      await fails("memoria_label_alias", { action: "delete" });
      await fails("memoria_label_alias", { action: "list", alias });
      await call("memoria_label_alias_delete", { alias });
      assert(!JSON.stringify(await call("memoria_label_alias", { action: "list" })).includes(canonicalLabel));
      await fails("missing_tool");
      await fails("constructor");
      assert.deepEqual([...seenAliases].sort(), Object.keys(LEGACY_TOOL_ROUTES).sort(), "Every compatibility alias exercised on both protocols");
    }
    console.log(JSON.stringify({ suite: "mcp-capability-consolidation", activeTools: 83, transitionalAliases: 16,
      protocols: ["legacy", "modern"], fixedActionsPreserved: true, sourceMeaningPreserved: true,
      nullableAndForeignSeparated: true, diagnosticsReadOnly: true, oldInitializationCompatible: true, passed: true }));
  } finally {
    await client?.close();
    await gateway.stop();
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
