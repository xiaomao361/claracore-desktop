const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");

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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-http-mcp-"));
  const databasePath = path.join(tempRoot, "claracore.db");
  const database = await initializeProductDatabase(databasePath);
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
      "X-ClaraCore-Session-ID": "session-smoke"
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
    const initialized = await postMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    assert.strictEqual(initialized.result.serverInfo.name, "claracore-desktop");
    const tools = await postMcp({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    assert(tools.result.tools.some((tool) => tool.name === "claracore_connection_test"), "tools/list should include connection test");
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
    const traces = await database.listGatewayTraces({ limit: 5 });
    const trace = traces.find((item) => item.toolName === "claracore_connection_test");
    assert(trace, "Streamable HTTP tools/call should record a Gateway trace");
    assert.strictEqual(trace.agentId, "clara");
    assert.strictEqual(trace.sessionId, "session-smoke");
    assert.strictEqual(trace.transport, "streamable-http");
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
