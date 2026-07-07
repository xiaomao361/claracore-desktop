const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const assert = require("assert");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-http-mcp-"));
  const databasePath = path.join(tempRoot, "claracore.db");
  const database = await initializeProductDatabase(databasePath);
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
    getProductGatewayContext: async () => ({ ok: true })
  });

  try {
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find((item) => item.id === "streamable-http-mcp");
    assert(endpoint, "Streamable HTTP MCP endpoint should be exposed");
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
