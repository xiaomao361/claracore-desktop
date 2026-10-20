import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { createUnderstandingHost } = require("../core/gateway/understanding/host");

// Explicit JSON event bridge for a host with real raw-evidence callbacks.
// It does not discover credentials, read conversation logs, or install hooks.
export async function runHostEvent(config, event, connect) {
  if (!config || !path.isAbsolute(config.stateDirectory || "")) throw new Error("invalid_host_configuration");
  const caller = { agentId: config.agentId, clientId: config.clientId, conversationId: config.conversationId };
  if (!caller.agentId || !caller.clientId || !caller.conversationId) throw new Error("host_identity_required");
  if (config.enabled !== true) return { status: "disabled", installed: false, networkCalls: 0 };
  let endpoint;
  try { endpoint = new URL(config.endpoint); } catch { throw new Error("local_gateway_endpoint_required"); }
  if (!["http:", "https:"].includes(endpoint.protocol) || !["127.0.0.1", "[::1]"].includes(endpoint.hostname)
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== "/mcp") throw new Error("local_gateway_endpoint_required");
  if (typeof config.tokenEnv !== "string" || !/^[A-Z_][A-Z0-9_]*$/u.test(config.tokenEnv) || !process.env[config.tokenEnv]) throw new Error("gateway_token_environment_required");
  const connection = await connect(endpoint, {
    Authorization: `Bearer ${process.env[config.tokenEnv]}`, "X-ClaraCore-Agent-ID": caller.agentId,
    "X-ClaraCore-Client-ID": caller.clientId, "X-ClaraCore-Conversation-ID": caller.conversationId
  });
  try {
    const host = createUnderstandingHost({ caller, stateDirectory: config.stateDirectory, enabled: true, allowModel: config.allowModel === true,
      grants: config.grants, capabilities: config.capabilities, lineId: config.lineId || "", callTool: connection.callTool });
    if (event.command === "resume") return await host.resume(event);
    if (event.command === "recover") return await host.recoverPending(event);
    return await host.onEvent(event);
  } finally { await connection.close(); }
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--config") throw new Error("usage: understanding-host.mjs --config explicit-config.json");
  const configText = await fs.readFile(path.resolve(process.argv[3]), "utf8");
  if (Buffer.byteLength(configText) > 16 * 1024) throw new Error("host_configuration_too_large");
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
    if (Buffer.byteLength(text) > 40 * 1024) throw new Error("host_event_too_large");
  }
  const result = await runHostEvent(JSON.parse(configText), JSON.parse(text), async (endpoint, headers) => {
    const { Client, StreamableHTTPClientTransport } = require("@modelcontextprotocol/client");
    const client = new Client({ name: "claracore-understanding-host", version: "1" }, { versionNegotiation: { mode: "auto" } });
    try {
      await client.connect(new StreamableHTTPClientTransport(endpoint, { requestInit: { headers } }));
      const manifest = await client.listTools();
      for (const name of ["understanding_context", "understanding_submit", "understanding_resume"]) {
        if (!manifest.tools.some(tool => tool.name === name)) throw new Error("understanding_contract_unavailable");
      }
    } catch (error) { await client.close(); throw error; }
    return { callTool: (name, args) => client.callTool({ name, arguments: args }), close: () => client.close() };
  });
  process.stdout.write(JSON.stringify(result) + "\n");
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { process.stderr.write((error.code || "host_event_failed") + "\n"); process.exitCode = 1; });
}
