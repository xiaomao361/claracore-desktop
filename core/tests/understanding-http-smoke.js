const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Client, StreamableHTTPClientTransport } = require("@modelcontextprotocol/client");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-understanding-http-"));
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const app = { isPackaged: false, getPath: () => root };
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, "../.."), runtimeDir: path.join(root, "runtime") };
  const gateway = createHttpAgentGateway({ app, ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({}), port: 0 });
  let client;
  try {
    let calls = 0;
    database.innerLifeGenerate = async () => { calls++; return JSON.stringify({ operations: [], coverage: [{ eventId: "u1", ...Object.fromEntries(["memory", "knowledge", "continuity", "innerlife"].map(domain => [domain, { status: "none", reason: "A transient question requires no durable update.", operations: [] }])) }] }); };
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find(item => item.id === "streamable-http-mcp");
    const headers = { Authorization: endpoint.authHeader.replace(/^Authorization:\s*/u, ""), "X-ClaraCore-Agent-ID": "codex", "X-ClaraCore-Conversation-ID": "understanding-http" };
    client = new Client({ name: "understanding-http", version: "1" }, { versionNegotiation: { mode: "auto" } });
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url), { requestInit: { headers } }));
    const manifest = await client.listTools();
    for (const name of ["understanding_context", "understanding_submit", "understanding_resume"]) assert(manifest.tools.some(tool => tool.name === name));
    const context = await client.callTool({ name: "understanding_context", arguments: { query: "HTTP_PRIVATE_CONTEXT_CANARY" } });
    assert(!context.isError); assert.equal(JSON.parse(context.content[0].text).domains.continuity.status, "none");
    const payload = { submissionId: "http-1", events: [{ id: "u1", speaker: "user", text: "HTTP_PRIVATE_DELTA_CANARY", sourceRef: "chat:http#u1" }], allowModel: true, execute: true };
    const result = await client.callTool({ name: "understanding_submit", arguments: payload });
    assert(!result.isError); assert.equal(JSON.parse(result.content[0].text).status, "completed");
    const resumed = await client.callTool({ name: "understanding_resume", arguments: { submissionId: "http-1", execute: true, detail: "plan" } });
    assert.equal(JSON.parse(resumed.content[0].text).status, "completed"); assert.equal(calls, 1);
    const conflicted = await client.callTool({ name: "understanding_submit", arguments: { ...payload, events: [{ ...payload.events[0], text: "changed" }] } });
    assert(conflicted.isError); assert.equal(JSON.parse(conflicted.content[0].text).code, "submission_id_conflict");
    const traces = await database.query("SELECT status, request_json, response_summary, error FROM gateway_traces WHERE tool_name LIKE 'understanding_%';");
    assert.equal(traces.length, 4); assert(traces.some(trace => trace.status === "error"));
    assert(!JSON.stringify(traces).includes("PRIVATE_")); assert(traces.every(trace => JSON.parse(trace.request_json).contentOmitted));
    console.log(JSON.stringify({ suite: "understanding-http", authenticatedMcp: true, fixturePlanner: true, idempotentRetry: true, traceBodiesOmitted: true, conflictIsError: true }));
  } finally {
    if (client) await client.close();
    await gateway.stop(); await database.close(); await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
