const crypto = require("crypto");
const http = require("http");

function createHttpAgentGateway({ app, getRuntimeSnapshot, getProductGatewayContext }) {
  const state = {
    host: "127.0.0.1",
    server: null,
    sockets: new Set(),
    port: null,
    token: crypto.randomBytes(32).toString("base64url")
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
        bind: state.host
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
        bind: state.host
      }
    ];
  }

  function sendJson(response, statusCode, payload) {
    const body = JSON.stringify(payload, null, 2);
    response.writeHead(statusCode, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "authorization, content-type"
    });
    response.end(body);
  }

  function isAuthorized(request, requestUrl) {
    const authorization = request.headers.authorization || "";
    const token = requestUrl.searchParams.get("token") || "";
    return authorization === `Bearer ${state.token}` || token === state.token;
  }

  async function handleRequest(request, response) {
    const currentBaseUrl = baseUrl() || `http://${state.host}:0`;
    const requestUrl = new URL(request.url || "/", currentBaseUrl);
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
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
        bind: state.host
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
          current: "localhost-http-url",
          bind: state.host,
          port: state.port,
          portPolicy: "runtime-assigned; do not hard-code across app sessions",
          lan: "disabled-by-default"
        },
        auth: {
          type: "bearer",
          header: `Authorization: Bearer ${state.token}`
        },
        endpoints: buildEndpoints().map((endpoint) => ({
          id: endpoint.id,
          method: endpoint.method,
          url: endpoint.url,
          healthUrl: endpoint.healthUrl,
          auth: endpoint.auth
        })),
        mcp: {
          serverName: snapshot.connections.mcpServerName,
          command: snapshot.connections.mcpCommand,
          config: JSON.parse(snapshot.connections.mcpConfig)
        },
        firstCall: "GET /gateway/context with the bearer token, or call gateway_context through MCP."
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
      state.server.once("error", reject);
      state.server.listen(0, state.host, () => {
        state.port = state.server.address().port;
        state.server.off("error", reject);
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
    start,
    stop
  };
}

module.exports = {
  createHttpAgentGateway
};
