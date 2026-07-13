const crypto = require("crypto");
const fs = require("fs/promises");
const http = require("http");
const path = require("path");
const { PRODUCT_VERSION } = require("../core/version");
const { createGatewayTools } = require("../core/gateway/tools");

const PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_HTTP_PORT = 50668;
const GATEWAY_CONFIG_FILE = "agent-gateway.json";
const SERVER_INFO = {
  name: "claracore-desktop",
  version: PRODUCT_VERSION
};

function gatewayConfigPath(app) {
  return path.join(app.getPath("userData"), GATEWAY_CONFIG_FILE);
}

function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function normalizePort(value, fallback = DEFAULT_HTTP_PORT) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 65535) return parsed;
  return fallback;
}

// For the non-explicit (production) path, a persisted or user-entered port of 0
// is a stale placeholder rather than a request for a random port; fall back to
// the stable default. Random binding is reserved for the explicit env/test path.
function stablePort(value, fallback = DEFAULT_HTTP_PORT) {
  const normalized = normalizePort(value, fallback);
  return normalized === 0 ? fallback : normalized;
}

async function readGatewayConfig(configPath) {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return {};
  }
}

async function writeGatewayConfig(configPath, config) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(configPath, 0o600);
}

function publicGatewayConfig(configPath, config, baseUrl) {
  return {
    path: configPath,
    host: config.host,
    port: config.port,
    endpoint: baseUrl ? `${baseUrl}/mcp` : `http://${config.host}:${config.port}/mcp`,
    auth: "bearer-token",
    tokenFile: configPath,
    tokenCreatedAt: config.tokenCreatedAt || "",
    tokenRotatedAt: config.tokenRotatedAt || "",
    tokenFileMode: "0600"
  };
}

function tokenLooksValid(value) {
  return typeof value === "string" && value.trim().length >= 32;
}

function createHttpAgentGateway({ app, ensureProductCore, getRuntimeSnapshot, getProductGatewayContext, port }) {
  const explicitPort = Boolean(process.env.CLARACORE_DESKTOP_HTTP_PORT || port !== undefined);
  const state = {
    host: "127.0.0.1",
    server: null,
    sockets: new Set(),
    port: null,
    configuredPort: normalizePort(process.env.CLARACORE_DESKTOP_HTTP_PORT || port, DEFAULT_HTTP_PORT),
    explicitPort,
    token: null,
    tokenFile: gatewayConfigPath(app),
    tokenCreatedAt: "",
    tokenRotatedAt: "",
    lastError: null
  };

  function baseUrl() {
    if (!state.port) return null;
    return `http://${state.host}:${state.port}`;
  }

  function buildEndpoints() {
    const currentBaseUrl = baseUrl();
    if (!currentBaseUrl) return [];
    return [
      {
        id: "agent-setup-json",
        method: "GET",
        url: `${currentBaseUrl}/agent/setup`,
        openUrl: `${currentBaseUrl}/agent/setup?token=${encodeURIComponent(state.token)}`,
        copyUrl: `${currentBaseUrl}/agent/setup?token=${encodeURIComponent(state.token)}`,
        healthUrl: `${currentBaseUrl}/health`,
        auth: "bearer-token",
        authHeader: `Authorization: Bearer ${state.token}`,
        bind: state.host,
        tokenFile: state.tokenFile,
        tokenFileMode: "0600",
        portPolicy: state.configuredPort === 0 ? "test-random" : "stable-localhost"
      },
      {
        id: "streamable-http-mcp",
        method: "POST",
        url: `${currentBaseUrl}/mcp`,
        copyUrl: `${currentBaseUrl}/mcp`,
        healthUrl: `${currentBaseUrl}/health`,
        auth: "bearer-token",
        authHeader: `Authorization: Bearer ${state.token}`,
        bind: state.host,
        transport: "streamable-http",
        tokenFile: state.tokenFile,
        tokenFileMode: "0600",
        portPolicy: state.configuredPort === 0 ? "test-random" : "stable-localhost"
      },
      {
        id: "gateway-context-json",
        method: "GET",
        url: `${currentBaseUrl}/gateway/context`,
        openUrl: `${currentBaseUrl}/gateway/context?token=${encodeURIComponent(state.token)}`,
        copyUrl: `${currentBaseUrl}/gateway/context?token=${encodeURIComponent(state.token)}`,
        healthUrl: `${currentBaseUrl}/health`,
        auth: "bearer-token",
        authHeader: `Authorization: Bearer ${state.token}`,
        bind: state.host,
        tokenFile: state.tokenFile,
        tokenFileMode: "0600",
        portPolicy: state.configuredPort === 0 ? "test-random" : "stable-localhost"
      }
    ];
  }

  function status() {
    const currentBaseUrl = baseUrl();
    return {
      ok: Boolean(state.server && state.port),
      host: state.host,
      port: state.port,
      configuredPort: state.configuredPort,
      portPolicy: state.configuredPort === 0 ? "test-random" : "stable-localhost",
      baseUrl: currentBaseUrl,
      endpoint: currentBaseUrl ? `${currentBaseUrl}/mcp` : `http://${state.host}:${state.configuredPort}/mcp`,
      tokenFile: state.tokenFile,
      tokenFileMode: "0600",
      token: state.token || "",
      authHeader: state.token ? `Authorization: Bearer ${state.token}` : "",
      tokenCreatedAt: state.tokenCreatedAt,
      tokenRotatedAt: state.tokenRotatedAt,
      error: state.lastError
    };
  }

  function sendJson(response, statusCode, payload) {
    const body = JSON.stringify(payload, null, 2);
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(body);
  }

  function sendText(response, statusCode, text) {
    response.writeHead(statusCode, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store"
    });
    response.end(text);
  }

  function tokenMatches(candidate) {
    const value = String(candidate || "");
    const expected = state.token;
    if (!expected) return false;
    const valueBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return valueBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(valueBuffer, expectedBuffer);
  }

  function isAuthorized(request, requestUrl) {
    const authorization = request.headers.authorization || "";
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
    const token = requestUrl.searchParams.get("token") || "";
    return tokenMatches(bearer) || tokenMatches(token);
  }

  function originAllowed(request) {
    const origin = String(request.headers.origin || "").trim();
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      return ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
    } catch (_error) {
      return false;
    }
  }

  function readRequestBody(request, maxBytes = 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
        if (Buffer.byteLength(body, "utf8") > maxBytes) {
          reject(new Error("request_too_large"));
          request.destroy();
        }
      });
      request.on("end", () => resolve(body));
      request.on("error", reject);
    });
  }

  function jsonRpcResult(id, result) {
    return { jsonrpc: "2.0", id, result };
  }

  function jsonRpcError(id, code, message) {
    return {
      jsonrpc: "2.0",
      id: id === undefined ? null : id,
      error: { code, message }
    };
  }

  function responseText(result) {
    const text = result?.content?.[0]?.text || "";
    return text.length > 500 ? `${text.slice(0, 497)}...` : text;
  }

  function currentHttpAgentId(request, requestUrl, args = {}) {
    return String(
      request.headers["x-claracore-agent-id"] ||
        requestUrl.searchParams.get("agentId") ||
        args.agentId ||
        args.agent_id ||
        "http-agent"
    ).trim() || "http-agent";
  }

  function currentHttpClientId(request, requestUrl) {
    return String(
      request.headers["x-claracore-client-id"] ||
        requestUrl.searchParams.get("clientId") ||
        "http-client"
    ).trim() || "http-client";
  }

  function currentHttpConversationId(request, requestUrl) {
    return String(
      request.headers["x-claracore-conversation-id"] ||
        request.headers["x-claracore-session-id"] ||
        requestUrl.searchParams.get("conversationId") ||
        requestUrl.searchParams.get("sessionId") ||
        ""
    ).trim();
  }

  function gatewayLaunchConfig() {
    const currentBaseUrl = baseUrl() || `http://${state.host}:0`;
    return {
      command: "streamable-http",
      args: [`${currentBaseUrl}/mcp`],
      env: {},
      displayCommand: `${currentBaseUrl}/mcp`,
      source: "Desktop Streamable HTTP"
    };
  }

  async function ensureGatewayConfig({ rotateToken = false } = {}) {
    const existing = await readGatewayConfig(state.tokenFile);
    const now = new Date().toISOString();
    if (!state.explicitPort) {
      state.configuredPort = stablePort(existing.port, DEFAULT_HTTP_PORT);
    }
    const nextToken =
      rotateToken || !tokenLooksValid(existing.token)
        ? generateToken()
        : existing.token.trim();
    const nextConfig = {
      version: 1,
      product: "ClaraCore Desktop",
      transport: "streamable-http",
      host: state.host,
      port: state.configuredPort,
      endpoint: `http://${state.host}:${state.configuredPort}/mcp`,
      auth: "bearer-token",
      header: `Authorization: Bearer ${nextToken}`,
      token: nextToken,
      tokenCreatedAt: existing.tokenCreatedAt || now,
      tokenRotatedAt: rotateToken ? now : existing.tokenRotatedAt || "",
      updatedAt: now,
      notes: [
        "This file is local-only and should be readable only by the current OS user.",
        "MCP clients can reuse this endpoint and bearer token across ClaraCore Desktop restarts.",
        "Rotate the token from Agent Access if it may have been exposed."
      ]
    };
    await writeGatewayConfig(state.tokenFile, nextConfig);
    state.token = nextToken;
    state.tokenCreatedAt = nextConfig.tokenCreatedAt;
    state.tokenRotatedAt = nextConfig.tokenRotatedAt;
    return nextConfig;
  }

  async function rotateToken() {
    const config = await ensureGatewayConfig({ rotateToken: true });
    return {
      rotated: true,
      gateway: status(),
      config: publicGatewayConfig(state.tokenFile, config, baseUrl()),
      authHeader: `Authorization: Bearer ${state.token}`
    };
  }

  async function assertPortAvailable(portValue) {
    if (state.server && Number(state.port) === Number(portValue)) return;
    await new Promise((resolve, reject) => {
      const probe = http.createServer();
      probe.once("error", reject);
      probe.listen(portValue, state.host, () => {
        probe.close(resolve);
      });
    });
  }

  async function updateConfig(input = {}) {
    const existing = await readGatewayConfig(state.tokenFile);
    const previousPort = state.configuredPort;
    const previousToken = state.token || existing.token || "";
    const hasControlledRandomPort = state.explicitPort && previousPort === 0;
    const nextPort = hasControlledRandomPort
      ? previousPort
      : stablePort(input.port, previousPort || DEFAULT_HTTP_PORT);
    if (state.explicitPort && !hasControlledRandomPort && nextPort !== previousPort) {
      throw new Error("CLARACORE_DESKTOP_HTTP_PORT is controlling the Gateway port for this launch.");
    }
    const nextToken = input.generateToken
      ? generateToken()
      : tokenLooksValid(input.token)
        ? String(input.token).trim()
        : previousToken;
    if (!tokenLooksValid(nextToken)) {
      throw new Error("Gateway token must be at least 32 characters.");
    }
    await assertPortAvailable(nextPort);
    const now = new Date().toISOString();
    const nextConfig = {
      version: 1,
      product: "ClaraCore Desktop",
      transport: "streamable-http",
      host: state.host,
      port: nextPort,
      endpoint: `http://${state.host}:${nextPort}/mcp`,
      auth: "bearer-token",
      header: `Authorization: Bearer ${nextToken}`,
      token: nextToken,
      tokenCreatedAt: existing.tokenCreatedAt || state.tokenCreatedAt || now,
      tokenRotatedAt: nextToken !== previousToken ? now : existing.tokenRotatedAt || state.tokenRotatedAt || "",
      updatedAt: now,
      notes: [
        "This file is local-only and should be readable only by the current OS user.",
        "MCP clients can reuse this endpoint and bearer token across ClaraCore Desktop restarts.",
        "Rotate the token from Settings or Agent Access if it may have been exposed."
      ]
    };
    await writeGatewayConfig(state.tokenFile, nextConfig);
    const restartNeeded = state.server && nextPort !== state.configuredPort;
    if (restartNeeded) stop();
    state.configuredPort = nextPort;
    state.token = nextToken;
    state.tokenCreatedAt = nextConfig.tokenCreatedAt;
    state.tokenRotatedAt = nextConfig.tokenRotatedAt;
    if (restartNeeded) await start();
    return {
      saved: true,
      gateway: status(),
      config: publicGatewayConfig(state.tokenFile, nextConfig, baseUrl()),
      authHeader: `Authorization: Bearer ${state.token}`
    };
  }

  function textResult(value) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(value, null, 2)
        }
      ]
    };
  }

  async function callMcpTool({ request, requestUrl, name, args }) {
    const startedAt = Date.now();
    const { paths, database } = await ensureProductCore(app);
    const agentId = currentHttpAgentId(request, requestUrl, args);
    const clientId = currentHttpClientId(request, requestUrl);
    const conversationId = currentHttpConversationId(request, requestUrl);
    const caller = { agentId, clientId, conversationId, transport: "streamable-http" };
    // Caller metadata belongs to Gateway context and traces. Domain tool
    // arguments (notably InnerLife sessionId) must remain untouched.
    const callArgs = { ...(args || {}), agentId };
    delete callArgs.agent_id;
    const { callToolBody } = createGatewayTools({
      serverInfo: SERVER_INFO,
      currentMcpAgentId: (toolArgs = {}) => currentHttpAgentId(request, requestUrl, toolArgs),
      currentCallerContext: () => caller,
      gatewayLaunchConfig,
      runtimeAppForGateway: () => app,
      textResult
    });
    try {
      const result = await callToolBody(name, callArgs, paths, database);
      await database.recordGatewayTrace({
        agentId,
        clientId,
        conversationId,
        transport: "streamable-http",
        toolName: name,
        status: "ok",
        durationMs: Date.now() - startedAt,
        request: callArgs,
        responseSummary: responseText(result)
      });
      return result;
    } catch (error) {
      await database.recordGatewayTrace({
        agentId,
        clientId,
        conversationId,
        transport: "streamable-http",
        toolName: name,
        status: "error",
        durationMs: Date.now() - startedAt,
        request: callArgs,
        error: error.message || String(error)
      });
      throw error;
    }
  }

  async function handleMcpRequest(request, response, requestUrl) {
    if (!originAllowed(request)) {
      sendJson(response, 403, { error: "origin_not_allowed" });
      return;
    }
    if (!isAuthorized(request, requestUrl)) {
      sendJson(response, 401, {
        error: "unauthorized",
        message: "Use Authorization: Bearer <token> from Agent Access."
      });
      return;
    }
    if (request.method === "GET") {
      sendJson(response, 200, {
        product: "ClaraCore Desktop",
        transport: "streamable-http",
        protocolVersion: PROTOCOL_VERSION,
        endpoint: `${baseUrl()}/mcp`,
        note: "Send MCP JSON-RPC requests with POST. Server-initiated event streams are not used in this local v0.5.x endpoint."
      });
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }
    const accept = String(request.headers.accept || "");
    if (accept && !accept.includes("application/json") && !accept.includes("text/event-stream") && accept !== "*/*") {
      sendJson(response, 406, { error: "not_acceptable" });
      return;
    }
    let message;
    try {
      const raw = await readRequestBody(request);
      message = JSON.parse(raw || "{}");
    } catch (error) {
      sendJson(response, 400, jsonRpcError(null, -32700, error.message || "Parse error"));
      return;
    }
    if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      sendJson(response, 400, jsonRpcError(message?.id, -32600, "Invalid JSON-RPC request."));
      return;
    }
    if (message.id === undefined || message.id === null) {
      response.writeHead(202, { "cache-control": "no-store" });
      response.end();
      return;
    }
    try {
      if (message.method === "initialize") {
        sendJson(response, 200, jsonRpcResult(message.id, {
          protocolVersion: message.params?.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO
        }));
        return;
      }
      if (message.method === "tools/list") {
        const { toolDefinitions } = createGatewayTools({
          serverInfo: SERVER_INFO,
          currentMcpAgentId: (toolArgs = {}) => currentHttpAgentId(request, requestUrl, toolArgs),
          gatewayLaunchConfig,
          runtimeAppForGateway: () => app,
          textResult
        });
        sendJson(response, 200, jsonRpcResult(message.id, { tools: toolDefinitions() }));
        return;
      }
      if (message.method === "tools/call") {
        const name = message.params?.name;
        if (!name || typeof name !== "string") throw new Error("Tool name is required.");
        const result = await callMcpTool({
          request,
          requestUrl,
          name,
          args: message.params?.arguments || {}
        });
        sendJson(response, 200, jsonRpcResult(message.id, result));
        return;
      }
      if (message.method === "ping") {
        sendJson(response, 200, jsonRpcResult(message.id, {}));
        return;
      }
      sendJson(response, 200, jsonRpcError(message.id, -32601, `Unsupported method: ${message.method}`));
    } catch (error) {
      sendJson(response, 200, jsonRpcError(message.id, -32000, error.message || String(error)));
    }
  }

  async function handleRequest(request, response) {
    const currentBaseUrl = baseUrl() || `http://${state.host}:0`;
    const requestUrl = new URL(request.url || "/", currentBaseUrl);
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "cache-control": "no-store" });
      response.end();
      return;
    }
    if (requestUrl.pathname === "/mcp") {
      await handleMcpRequest(request, response, requestUrl);
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }
    if (requestUrl.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        product: "ClaraCore Desktop",
        bind: state.host,
        port: state.port,
        configuredPort: state.configuredPort,
        tokenFile: state.tokenFile
      });
      return;
    }
    if (!isAuthorized(request, requestUrl)) {
      sendJson(response, 401, {
        error: "unauthorized",
        message: "Use Authorization: Bearer <token> from Agent Access."
      });
      return;
    }
    if (requestUrl.pathname === "/agent/setup") {
      const snapshot = await getRuntimeSnapshot();
      sendJson(response, 200, {
        product: "ClaraCore Desktop",
        principle: "Agent-first: software is built for agents to operate and for humans to inspect.",
        connectionMode: {
          current: "streamable-http-and-stdio",
          bind: state.host,
          port: state.port,
          portPolicy: state.configuredPort === 0 ? "test-random" : "stable-localhost",
          lan: "disabled-by-default"
        },
        auth: {
          type: "bearer",
          header: `Authorization: Bearer ${state.token}`,
          tokenFile: state.tokenFile,
          tokenFileMode: "0600",
          tokenCreatedAt: state.tokenCreatedAt,
          tokenRotatedAt: state.tokenRotatedAt
        },
        endpoints: buildEndpoints().map((endpoint) => ({
          id: endpoint.id,
          method: endpoint.method,
          url: endpoint.url,
          healthUrl: endpoint.healthUrl,
          auth: endpoint.auth
        })),
        mcp: {
          streamableHttp: {
            endpoint: `${currentBaseUrl}/mcp`,
            transport: "streamable-http",
            auth: "bearer",
            headers: {
              Authorization: `Bearer ${state.token}`,
              "X-ClaraCore-Agent-ID": "<agent-stable-id>",
              "X-ClaraCore-Client-ID": "<client-host-id>",
              "X-ClaraCore-Conversation-ID": "<host-conversation-id>"
            }
          },
          serverName: snapshot.connections.mcpServerName,
          command: snapshot.connections.mcpCommand,
          config: JSON.parse(snapshot.connections.mcpConfig)
        },
        firstCalls: [
          "Call claracore_connection_test after installing or changing the MCP connection.",
          "Call gateway_docs to read the current product and Memory write contract.",
          "Call gateway_context to load the selected Shared Line, current Memory, and InnerLife state."
        ],
        memoriaUsage: {
          writePolicy: "Search before writing a potentially changed fact.",
          sameFact: "Use memoria_update when correcting or refining the same fact.",
          confirmedChange: "Create the new fact, then call memoria_supersede with currentMemoryId=new and historicalMemoryId=old.",
          unresolvedConflict: "Use memoria_link_create with kind=contradicts; do not supersede either fact yet.",
          recall: "memoria_search defaults to timeView=current; use historical for prior state and all only to compare both.",
          historyPolicy: "Superseded facts remain durable history and should not be deleted or archived merely because they are no longer current."
        }
      });
      return;
    }
    if (requestUrl.pathname === "/gateway/context") {
      const agentId = requestUrl.searchParams.get("agentId") || process.env.CLARACORE_AGENT_ID || "http-agent";
      sendJson(response, 200, await getProductGatewayContext(app, { agentId }));
      return;
    }
    sendJson(response, 404, { error: "not_found" });
  }

  async function start() {
    if (state.server) return;
    await ensureGatewayConfig();
    state.server = http.createServer((request, response) => {
      handleRequest(request, response).catch((error) => {
        sendJson(response, 500, {
          error: "internal_error",
          message: error?.message || String(error)
        });
      });
    });
    state.server.on("connection", (socket) => {
      state.sockets.add(socket);
      socket.on("close", () => {
        state.sockets.delete(socket);
      });
    });
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        state.lastError = {
          code: error?.code || "listen_failed",
          message: error?.message || String(error),
          port: state.configuredPort
        };
        state.server.off("error", onError);
        try {
          state.server.close();
        } catch (_closeError) {
          // The server may fail before it starts listening.
        }
        state.server = null;
        resolve();
      };
      state.server.once("error", onError);
      state.server.listen(state.configuredPort, state.host, () => {
        state.port = state.server.address().port;
        state.lastError = null;
        state.server.off("error", onError);
        resolve();
      });
    });
  }

  function stop() {
    if (!state.server) return;
    state.server.close();
    for (const socket of state.sockets) {
      socket.destroy();
    }
    state.sockets.clear();
    state.server = null;
    state.port = null;
  }

  return {
    buildEndpoints,
    rotateToken,
    start,
    status,
    updateConfig,
    stop
  };
}

module.exports = {
  DEFAULT_HTTP_PORT,
  createHttpAgentGateway
};
