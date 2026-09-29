const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Client, StreamableHTTPClientTransport } = require("@modelcontextprotocol/client");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");
const { saveKnowledgeRootPreference } = require("../knowledge/preferences");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-knowledge-http-"));
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const app = { isPackaged: false, getPath: () => root };
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, "../.."), runtimeDir: path.join(root, "runtime") };
  const gateway = createHttpAgentGateway({ app, ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({}), port: 0 });
  let client;
  try {
    const library = path.join(root, "library"); await fs.mkdir(library);
    await saveKnowledgeRootPreference(app, library);
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find((item) => item.id === "streamable-http-mcp");
    const headers = { Authorization: endpoint.authHeader.replace(/^Authorization:\s*/u, ""), "X-ClaraCore-Agent-ID": "codex", "X-ClaraCore-Conversation-ID": "knowledge-test" };
    client = new Client({ name: "knowledge-test", version: "1" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url), { requestInit: { headers } }));
    const tools = await client.listTools();
    assert(tools.tools.some((tool) => tool.name === "knowledge_intake_commit"));
    const draft = { mode: "create", path: "notes/http.md", title: "HTTP intake", sections: [{ anchor: "source", heading: "Source", body: "PRIVATE_KNOWLEDGE_BODY_CANARY", source: "isolated test", date: "2026-09-22", attribution: "agent_synthesis" }] };
    const preview = await client.callTool({ name: "knowledge_intake_preview", arguments: draft });
    assert(!preview.isError);
    const { token } = JSON.parse(preview.content[0].text);
    const saved = await client.callTool({ name: "knowledge_intake_commit", arguments: { token } });
    assert.equal(JSON.parse(saved.content[0].text).status, "saved");
    const read = await client.callTool({ name: "knowledge_read", arguments: { action: "read", reference: "notes/http.md#source" } });
    assert(read.content[0].text.includes("PRIVATE_KNOWLEDGE_BODY_CANARY"));
    const contextResult = await client.callTool({ name: "gateway_auto_context", arguments: { prompt: "Source", domain: "knowledge", mode: "exact", deliveryContract: "memory-knowledge-v1" } });
    const packet = JSON.parse(contextResult.content[0].text);
    assert.equal(packet.decision, "deliver_context");
    assert(packet.blocks[0].body.includes("PRIVATE_KNOWLEDGE_BODY_CANARY"));
    assert.equal(packet.blocks[0].reference, "notes/http.md#source");
    assert(packet.budget.serializedBlocksBytes <= packet.budget.targetBytes);
    const contextTraces = await database.query("SELECT request_json, response_summary FROM gateway_traces WHERE tool_name = 'gateway_auto_context';");
    assert.equal(contextTraces.length, 1);
    assert(!JSON.stringify(contextTraces).includes("PRIVATE_KNOWLEDGE_BODY_CANARY"));
    const failed = await client.callTool({ name: "knowledge_intake_commit", arguments: { token: "expired" } });
    assert.equal(failed.isError, true);
    const traces = await database.query("SELECT status, request_json, response_summary, error FROM gateway_traces WHERE tool_name LIKE 'knowledge_%';");
    assert.equal(traces.length, 4);
    assert.equal(traces.filter((trace) => trace.status === "error").length, 1);
    assert(!JSON.stringify(traces).includes("PRIVATE_KNOWLEDGE_BODY_CANARY"), "Knowledge bodies must not persist in trace DB");
    assert(traces.every((trace) => JSON.parse(trace.request_json).contentOmitted === true));
    console.log(JSON.stringify({ suite: "knowledge-http", authenticatedMcp: true, writeReadRoundTrip: true, traceBodyOmitted: true, failuresVisible: true }));
  } finally {
    if (client) await client.close();
    await gateway.stop();
    await database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
