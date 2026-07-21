const assert = require("assert");
const fs = require("fs/promises");
const http = require("http");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");

async function reservePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-http-backpressure-"));
  const databasePath = path.join(root, "claracore.db");
  const database = await initializeProductDatabase(databasePath);
  const port = await reservePort();
  const oldEnv = {
    maxConcurrency: process.env.CLARACORE_DESKTOP_HTTP_MAX_CONCURRENCY,
    maxQueue: process.env.CLARACORE_DESKTOP_HTTP_MAX_QUEUE,
    queueWaitMs: process.env.CLARACORE_DESKTOP_HTTP_QUEUE_WAIT_MS
  };
  process.env.CLARACORE_DESKTOP_HTTP_MAX_CONCURRENCY = "2";
  process.env.CLARACORE_DESKTOP_HTTP_MAX_QUEUE = "2";
  process.env.CLARACORE_DESKTOP_HTTP_QUEUE_WAIT_MS = "1000";

  const originalListMemories = database.listMemories.bind(database);
  database.listMemories = async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 120));
    return originalListMemories(...args);
  };
  const app = {
    isPackaged: false,
    getPath(name) {
      return name === "userData" ? root : path.join(root, name);
    }
  };
  const gateway = createHttpAgentGateway({
    app,
    ensureProductCore: async () => ({
      paths: {
        appRoot: path.resolve(__dirname, "../.."),
        dataRoot: root,
        databasePath,
        exportsDir: path.join(root, "exports"),
        runtimeDir: path.join(root, "runtime"),
        backupsDir: path.join(root, "backups"),
        logsDir: path.join(root, "logs")
      },
      database,
      summary: await database.getSummary()
    }),
    getRuntimeSnapshot: async () => ({ connections: { mcpServerName: "claracore-desktop", mcpCommand: "", mcpConfig: "{}" } }),
    getProductGatewayContext: async () => ({ ok: true }),
    port
  });

  try {
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find((item) => item.id === "streamable-http-mcp");
    const authorization = endpoint.authHeader.replace(/^Authorization:\s*/, "");
    const calls = Array.from({ length: 12 }, (_, index) => fetch(endpoint.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: authorization,
        "X-ClaraCore-Agent-ID": `backpressure-agent-${index}`
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: index,
        method: "tools/call",
        params: { name: "memoria_list", arguments: { limit: 1 } }
      })
    }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    const during = gateway.status().toolConcurrency;

    const healthStartedAt = performance.now();
    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    const healthDurationMs = performance.now() - healthStartedAt;
    assert.strictEqual(healthResponse.status, 200);
    assert.ok(healthDurationMs < 100, `Health route blocked for ${healthDurationMs}ms.`);

    const responses = await Promise.all(calls);
    const statuses = responses.map((response) => response.status);
    assert.strictEqual(during.active, 2);
    assert.strictEqual(during.queued, 2);
    assert.strictEqual(statuses.filter((status) => status === 200).length, 4);
    assert.strictEqual(statuses.filter((status) => status === 429).length, 8);
    assert.strictEqual(statuses.filter((status) => status >= 500).length, 0);
    const busyResponse = responses.find((response) => response.status === 429);
    assert.strictEqual(busyResponse.headers.get("retry-after"), "1");
    const busyPayload = await busyResponse.json();
    assert.strictEqual(busyPayload.error.code, -32001);
    assert.deepStrictEqual(gateway.status().toolConcurrency, {
      active: 0,
      queued: 0,
      maxActive: 2,
      maxQueued: 2,
      queueWaitMs: 1000
    });

    process.stdout.write(`${JSON.stringify({
      suite: "http-gateway-backpressure-smoke",
      statuses: {
        ok: statuses.filter((status) => status === 200).length,
        backpressure: statuses.filter((status) => status === 429).length,
        serverErrors: statuses.filter((status) => status >= 500).length
      },
      healthDurationMs: Math.round(healthDurationMs * 10) / 10,
      limits: gateway.status().toolConcurrency
    }, null, 2)}\n`);
  } finally {
    gateway.stop();
    database.close();
    for (const [key, value] of Object.entries({
      CLARACORE_DESKTOP_HTTP_MAX_CONCURRENCY: oldEnv.maxConcurrency,
      CLARACORE_DESKTOP_HTTP_MAX_QUEUE: oldEnv.maxQueue,
      CLARACORE_DESKTOP_HTTP_QUEUE_WAIT_MS: oldEnv.queueWaitMs
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
