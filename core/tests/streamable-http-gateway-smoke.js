const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { initializeProductDatabase } = require("../db/database");
const {
  CODEX_MCP_TOKEN_ENV_VAR,
  createHttpAgentGateway,
  syncCodexMcpToken
} = require("../../electron/http-agent-gateway");

async function reservePort() {
  const server = require("http").createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function withOccupiedPort(port, fn) {
  const server = require("http").createServer((_request, response) => {
    response.writeHead(200);
    response.end("occupied");
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  try {
    await fn();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  const previousTestInstance = process.env.CLARACORE_DESKTOP_TEST_INSTANCE;
  const previousUserDataDir = process.env.CLARACORE_DESKTOP_USER_DATA_DIR;
  try {
    process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
    delete process.env.CLARACORE_DESKTOP_USER_DATA_DIR;
    assert.throws(
      () => createHttpAgentGateway({ app: { getPath: () => "/should-not-be-used" }, port: 0 }),
      /random-port test Gateway requires CLARACORE_DESKTOP_USER_DATA_DIR/,
      "A random-port test Gateway must not fall through to the live userData path"
    );
  } finally {
    if (previousTestInstance === undefined) delete process.env.CLARACORE_DESKTOP_TEST_INSTANCE;
    else process.env.CLARACORE_DESKTOP_TEST_INSTANCE = previousTestInstance;
    if (previousUserDataDir === undefined) delete process.env.CLARACORE_DESKTOP_USER_DATA_DIR;
    else process.env.CLARACORE_DESKTOP_USER_DATA_DIR = previousUserDataDir;
  }

  let syncCall = null;
  const syncResult = syncCodexMcpToken("s".repeat(64), {
    platform: "darwin",
    spawn(command, args) {
      syncCall = { command, args };
      return { status: 0, stderr: "" };
    }
  });
  assert(syncResult.ok, "Codex token sync should accept a valid token on macOS");
  assert.strictEqual(syncCall.command, "/bin/launchctl");
  assert.deepStrictEqual(syncCall.args, ["setenv", CODEX_MCP_TOKEN_ENV_VAR, "s".repeat(64)]);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-http-mcp-"));
  const databasePath = path.join(tempRoot, "claracore.db");
  const database = await initializeProductDatabase(databasePath);
  await database.updateSettings({ "memory.controller.mode": "observe" });
  const port = await reservePort();
  const app = {
    isPackaged: false,
    getPath(name) {
      if (name === "userData") return tempRoot;
      return path.join(tempRoot, name);
    }
  };
  const ensureProductCore = async () => ({
    paths: {
      appRoot: path.resolve(__dirname, "../.."),
      dataRoot: tempRoot,
      databasePath,
      exportsDir: path.join(tempRoot, "exports"),
      runtimeDir: path.join(tempRoot, "runtime"),
      backupsDir: path.join(tempRoot, "backups"),
      logsDir: path.join(tempRoot, "logs")
    },
    database,
    summary: await database.getSummary()
  });
  const gateway = createHttpAgentGateway({
    app,
    ensureProductCore,
    getRuntimeSnapshot: async () => ({
      connections: {
        mcpServerName: "claracore-desktop",
        mcpCommand: "node core/gateway/mcp-server.js",
        mcpConfig: JSON.stringify({ mcpServers: {} })
      }
    }),
    getProductGatewayContext: async () => ({ ok: true }),
    port
  });

  try {
    await gateway.start();
    assert.strictEqual(gateway.status().port, port, "Gateway should bind the configured stable port");
    assert(gateway.status().codexTokenSync.skipped, "Non-packaged test Gateway should not modify the user launch environment");
    const endpoint = gateway.buildEndpoints().find((item) => item.id === "streamable-http-mcp");
    assert(endpoint, "Streamable HTTP MCP endpoint should be exposed");
    assert(endpoint.url.includes(`:${port}/mcp`), "Streamable HTTP endpoint should use the configured port");
    assert(endpoint.tokenFile, "Endpoint should expose the local token file path");
    const firstToken = endpoint.authHeader;
    const tokenFile = path.join(tempRoot, "agent-gateway.json");
    const tokenConfig = JSON.parse(await fs.readFile(tokenFile, "utf8"));
    assert.strictEqual(tokenConfig.port, port, "Token config should persist the stable port");
    assert.strictEqual(tokenConfig.endpoint, `http://127.0.0.1:${port}/mcp`, "Token config should persist the stable endpoint");
    if (process.platform !== "win32") {
      const mode = (await fs.stat(tokenFile)).mode & 0o777;
      assert.strictEqual(mode, 0o600, "Token config should be readable only by the current user");
    }
    const headers = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      Authorization: endpoint.authHeader.replace(/^Authorization:\s*/, ""),
      "X-ClaraCore-Agent-ID": "clara",
      "X-ClaraCore-Client-ID": "claude-code",
      "X-ClaraCore-Conversation-ID": "session-smoke"
    };
    async function postMcp(message) {
      const response = await fetch(endpoint.url, {
        method: "POST",
        headers,
        body: JSON.stringify(message)
      });
      if (response.status !== 200) {
        throw new Error(`Unexpected HTTP ${response.status}: ${await response.text()}`);
      }
      return response.json();
    }
    const setupResponse = await fetch(`http://127.0.0.1:${port}/agent/setup`, {
      headers: { Authorization: headers.Authorization }
    });
    assert.strictEqual(setupResponse.status, 200, "Agent setup should be readable with the bearer token");
    const setup = await setupResponse.json();
    assert.deepStrictEqual(
      setup.firstCalls.map((item) => item.match(/claracore_connection_test|gateway_docs|shared_line_list|gateway_context/)?.[0]),
      ["claracore_connection_test", "gateway_docs", "shared_line_list", "gateway_context"],
      "Agent setup should expose the canonical first-connection sequence"
    );
    assert.deepStrictEqual(Object.keys(setup.capabilities), ["memory", "sharedLine", "innerLife", "gateway"]);
    assert(setup.afterConnect?.includes("proactively"), "Agent setup should require a proactive user handoff");
    assert.strictEqual(setup.userIntroductionRequirements?.length, 5);
    assert(setup.memoriaUsage?.confirmedChange?.includes("memoria_supersede"), "Agent setup should explain confirmed Memory replacement");
    assert(setup.memoriaUsage?.unresolvedConflict?.includes("contradicts"), "Agent setup should preserve unresolved conflicts");
    assert(setup.memoriaUsage?.recall?.includes("timeView=current"), "Agent setup should explain current and historical recall");
    const initialized = await postMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    assert.strictEqual(initialized.result.serverInfo.name, "claracore-desktop");
    assert(initialized.result.instructions.includes("Search Memoria and Shared Line"), "initialize should describe selective context reads");
    assert(initialized.result.instructions.includes("Write Memoria only"), "initialize should describe restrained Memory writes");
    const tools = await postMcp({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    assert(tools.result.tools.some((tool) => tool.name === "claracore_connection_test"), "tools/list should include connection test");
    assert(tools.result.tools.some((tool) => tool.name === "memory_context"), "tools/list should include observe-only memory_context");
    const controllerPrompt = "还记得我们之前决定的 HTTP Gateway Controller smoke 吗";
    const controllerMemory = await database.createMemory({
      title: "HTTP Gateway Controller",
      body: controllerPrompt,
      agentId: "clara"
    });
    const controllerCall = await postMcp({
      jsonrpc: "2.0",
      id: 21,
      method: "tools/call",
      params: {
        name: "memory_context",
        arguments: { prompt: controllerPrompt, agentId: "lara" }
      }
    });
    const controllerPacket = JSON.parse(controllerCall.result.content[0].text);
    assert.strictEqual(controllerPacket.action, "RETRIEVE");
    assert.strictEqual(controllerPacket.context, "", "HTTP memory_context must remain observe-only");
    assert(controllerPacket.candidates.some((candidate) => candidate.id === controllerMemory.id));
    const controllerEvent = await database.getMemoryControlEvent(controllerPacket.decisionId);
    assert.strictEqual(controllerEvent.agentId, "clara", "HTTP body Agent id overrode the authenticated caller header");
    assert.strictEqual(controllerEvent.clientId, "claude-code");
    assert.strictEqual(controllerEvent.conversationId, "session-smoke");

    const unidentifiedResponse = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        Accept: headers.Accept,
        "Content-Type": headers["Content-Type"],
        Authorization: headers.Authorization
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 22,
        method: "tools/call",
        params: { name: "memory_context", arguments: { prompt: controllerPrompt, agentId: "clara" } }
      })
    });
    const unidentifiedCall = await unidentifiedResponse.json();
    const unidentifiedPacket = JSON.parse(unidentifiedCall.result.content[0].text);
    assert.strictEqual(unidentifiedPacket.reason, "caller_identity_required", "HTTP memory_context trusted a body Agent id");
    assert.strictEqual(unidentifiedPacket.decisionId, "");
    const called = await postMcp({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "claracore_connection_test",
        arguments: {}
      }
    });
    assert(called.result.content[0].text.includes("claracore-desktop"), "tool response should mention product");
    const connectionPacket = JSON.parse(called.result.content[0].text);
    assert.deepStrictEqual(connectionPacket.nextCalls, ["gateway_docs", "shared_line_list", "gateway_context"]);
    assert(connectionPacket.afterOnboarding.includes("Tell the user"));
    const contentBeforeOnboarding = await database.getSummary();
    const docsCall = await postMcp({
      jsonrpc: "2.0",
      id: 31,
      method: "tools/call",
      params: { name: "gateway_docs", arguments: {} }
    });
    assert(docsCall.result.content[0].text.includes("## What ClaraCore Lets You Do"));
    const linesCall = await postMcp({
      jsonrpc: "2.0",
      id: 32,
      method: "tools/call",
      params: { name: "shared_line_list", arguments: { status: "active" } }
    });
    assert(Array.isArray(JSON.parse(linesCall.result.content[0].text).lines));
    const contextCall = await postMcp({
      jsonrpc: "2.0",
      id: 33,
      method: "tools/call",
      params: { name: "gateway_context", arguments: {} }
    });
    const contextPacket = JSON.parse(contextCall.result.content[0].text);
    assert(contextPacket.sharedLine || contextPacket.shared_line || contextPacket.continuity, "First onboarding should return context truth");
    const contentAfterOnboarding = await database.getSummary();
    assert.strictEqual(contentAfterOnboarding.memories_count, contentBeforeOnboarding.memories_count);
    assert.strictEqual(contentAfterOnboarding.continuity_lines_count, contentBeforeOnboarding.continuity_lines_count);
    const traces = await database.listGatewayTraces({ limit: 5 });
    const trace = traces.find((item) => item.toolName === "claracore_connection_test");
    assert(trace, "Streamable HTTP tools/call should record a Gateway trace");
    assert.strictEqual(trace.agentId, "clara");
    assert.strictEqual(trace.clientId, "claude-code");
    assert.strictEqual(trace.conversationId, "session-smoke");
    assert.strictEqual(trace.sessionId, "session-smoke");
    assert.strictEqual(trace.transport, "streamable-http");

    const started = await postMcp({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "innerlife_session_start",
        arguments: {
          host: "claude-code",
          externalSessionId: "claude-host-session-a"
        }
      }
    });
    const startedPacket = JSON.parse(started.result.content[0].text);
    assert(startedPacket.session?.id, "HTTP InnerLife session start should return a domain session id");
    headers["X-ClaraCore-Conversation-ID"] = "claude-conversation-b";
    const ended = await postMcp({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "innerlife_session_end",
        arguments: {
          sessionId: startedPacket.session.id,
          summary: "Caller conversation changed, but the InnerLife session reference must survive."
        }
      }
    });
    const endedPacket = JSON.parse(ended.result.content[0].text);
    assert.strictEqual(endedPacket.session.id, startedPacket.session.id);
    assert.strictEqual(endedPacket.session.status, "ended");
    const endTrace = (await database.listGatewayTraces({ limit: 10 })).find(
      (item) => item.toolName === "innerlife_session_end"
    );
    assert(endTrace, "HTTP InnerLife session end should record a Gateway trace");
    assert.strictEqual(endTrace.conversationId, "claude-conversation-b");
    assert.strictEqual(endTrace.request.sessionId, startedPacket.session.id);
    gateway.stop();

    const restarted = createHttpAgentGateway({
      app,
      ensureProductCore,
      getRuntimeSnapshot: async () => ({
        connections: {
          mcpServerName: "claracore-desktop",
          mcpCommand: "node core/gateway/mcp-server.js",
          mcpConfig: JSON.stringify({ mcpServers: {} })
        }
      }),
      getProductGatewayContext: async () => ({ ok: true }),
      port
    });
    await restarted.start();
    const restartedEndpoint = restarted.buildEndpoints().find((item) => item.id === "streamable-http-mcp");
    assert.strictEqual(restartedEndpoint.authHeader, firstToken, "Bearer token should survive app restarts");
    const rotated = await restarted.rotateToken();
    assert.notStrictEqual(rotated.authHeader, firstToken, "Token rotation should change the bearer token");
    const savedToken = "a".repeat(64);
    const savedConfig = await restarted.updateConfig({ port, token: savedToken });
    assert.strictEqual(savedConfig.gateway.token, savedToken, "Settings update should persist the supplied bearer token");
    assert.strictEqual(savedConfig.authHeader, `Authorization: Bearer ${savedToken}`);
    const updatedConfig = JSON.parse(await fs.readFile(tokenFile, "utf8"));
    assert.strictEqual(updatedConfig.token, savedToken, "Token file should reflect Settings token updates");
    const generatedConfig = await restarted.updateConfig({ port, generateToken: true });
    assert.notStrictEqual(generatedConfig.gateway.token, savedToken, "Generate token should create a new bearer token");
    assert.strictEqual(generatedConfig.gateway.port, port, "Generate token should not move the Gateway port");
    restarted.stop();

    const configurable = createHttpAgentGateway({
      app,
      ensureProductCore,
      getRuntimeSnapshot: async () => ({
        connections: {
          mcpServerName: "claracore-desktop",
          mcpCommand: "node core/gateway/mcp-server.js",
          mcpConfig: JSON.stringify({ mcpServers: {} })
        }
      }),
      getProductGatewayContext: async () => ({ ok: true })
    });
    await configurable.start();
    const nextPort = await reservePort();
    const movedConfig = await configurable.updateConfig({ port: nextPort, token: "b".repeat(64) });
    assert.strictEqual(movedConfig.gateway.port, nextPort, "Settings update should move the running Gateway to the selected port");
    assert.strictEqual(movedConfig.gateway.endpoint, `http://127.0.0.1:${nextPort}/mcp`);
    const movedEndpoint = configurable.buildEndpoints().find((item) => item.id === "streamable-http-mcp");
    assert.strictEqual(movedEndpoint.url, `http://127.0.0.1:${nextPort}/mcp`);
    configurable.stop();

    await withOccupiedPort(port, async () => {
      const blocked = createHttpAgentGateway({
        app,
        ensureProductCore,
        getRuntimeSnapshot: async () => ({
          connections: {
            mcpServerName: "claracore-desktop",
            mcpCommand: "node core/gateway/mcp-server.js",
            mcpConfig: JSON.stringify({ mcpServers: {} })
          }
        }),
        getProductGatewayContext: async () => ({ ok: true }),
        port
      });
      await blocked.start();
      assert.strictEqual(blocked.buildEndpoints().length, 0, "Gateway must not silently switch to a random port");
      assert.strictEqual(blocked.status().error.code, "EADDRINUSE", "Gateway should surface port conflicts");
      blocked.stop();
    });
    console.log("Streamable HTTP Gateway smoke passed");
  } finally {
    gateway.stop();
    database.close();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
