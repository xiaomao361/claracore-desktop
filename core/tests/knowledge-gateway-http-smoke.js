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
    const callTool = async (input) => {
      const tool = tools.tools.find(tool => tool.name === input.name);
      assert(tool, `Knowledge workflow escaped default catalog: ${input.name}`);
      for (const key of Object.keys(input.arguments || {})) assert(Object.hasOwn(tool.inputSchema.properties, key));
      return client.callTool(input);
    };
    const draft = { mode: "create", path: "notes/http.md", title: "HTTP intake", sections: [{ anchor: "source", heading: "Source", body: "PRIVATE_KNOWLEDGE_BODY_CANARY", source: "isolated test", date: "2026-09-22", attribution: "agent_synthesis" }] };
    const preview = await callTool({ name: "knowledge_intake_preview", arguments: draft });
    assert(!preview.isError);
    const { token } = JSON.parse(preview.content[0].text);
    const saved = await callTool({ name: "knowledge_intake_commit", arguments: { token } });
    assert.equal(JSON.parse(saved.content[0].text).status, "saved");
    const read = await callTool({ name: "knowledge_read", arguments: { action: "read", reference: "notes/http.md#source" } });
    assert(read.content[0].text.includes("PRIVATE_KNOWLEDGE_BODY_CANARY"));
    const contextResult = await callTool({ name: "gateway_auto_context", arguments: { prompt: "Source", domain: "knowledge", mode: "exact", deliveryContract: "memory-knowledge-v1" } });
    const packet = JSON.parse(contextResult.content[0].text);
    assert.equal(packet.decision, "deliver_context");
    assert(packet.blocks[0].body.includes("PRIVATE_KNOWLEDGE_BODY_CANARY"));
    assert.equal(packet.blocks[0].reference, "notes/http.md#source");
    assert(packet.budget.serializedBlocksBytes <= packet.budget.targetBytes);
    const contextTraces = await database.query("SELECT request_json, response_summary FROM gateway_traces WHERE tool_name = 'gateway_auto_context';");
    assert.equal(contextTraces.length, 1);
    assert(!JSON.stringify(contextTraces).includes("PRIVATE_KNOWLEDGE_BODY_CANARY"));
    const failed = await callTool({ name: "knowledge_intake_commit", arguments: { token: "expired" } });
    assert.equal(failed.isError, true);
    const traces = await database.query("SELECT status, request_json, response_summary, error FROM gateway_traces WHERE tool_name LIKE 'knowledge_%';");
    assert.equal(traces.length, 4);
    assert.equal(traces.filter((trace) => trace.status === "error").length, 1);
    assert(!JSON.stringify(traces).includes("PRIVATE_KNOWLEDGE_BODY_CANARY"), "Knowledge bodies must not persist in trace DB");
    assert(traces.every((trace) => JSON.parse(trace.request_json).contentOmitted === true));
    const makeDraft = (file) => ({ ...draft, path: `notes/${file}.md` });
    const conflictDraft = makeDraft("conflict");
    const conflictPreview = JSON.parse((await callTool({ name: "knowledge_intake_preview", arguments: conflictDraft })).content[0].text);
    await fs.writeFile(path.join(library, conflictDraft.path), "External edit must survive.");
    const conflict = await callTool({ name: "knowledge_intake_commit", arguments: { token: conflictPreview.token } });
    assert.equal(conflict.isError, true);
    assert.equal(JSON.parse(conflict.content[0].text).code, "conflict");
    assert.equal(await fs.readFile(path.join(library, conflictDraft.path), "utf8"), "External edit must survive.");
    await fs.rm(path.join(library, conflictDraft.path));
    const partialPreview = JSON.parse((await callTool({ name: "knowledge_intake_preview", arguments: makeDraft("partial") })).content[0].text);
    const syncFs = require("node:fs");
    const rename = syncFs.renameSync;
    let partial;
    try {
      syncFs.renameSync = (from, to) => {
        if (to.endsWith("index.json")) { const error = new Error("Isolated index failure"); error.code = "EACCES"; throw error; }
        return rename(from, to);
      };
      partial = await callTool({ name: "knowledge_intake_commit", arguments: { token: partialPreview.token } });
    } finally { syncFs.renameSync = rename; }
    assert.equal(partial.isError, true, "Partial write must remain visible over HTTP");
    const partialBody = JSON.parse(partial.content[0].text);
    assert.equal(partialBody.status, "partial");
    assert.equal(partialBody.write, "saved");
    assert.equal(partialBody.index.status, "failed");
    const retry = await callTool({ name: "knowledge_intake_commit", arguments: { token: partialPreview.token } });
    assert.deepEqual(retry, partial, "Same-token retry must retain the partial receipt without duplicating content");
    const body = await fs.readFile(path.join(library, "notes/partial.md"), "utf8");
    assert.equal(body.split("PRIVATE_KNOWLEDGE_BODY_CANARY").length - 1, 1);
    const exact = await callTool({ name: "knowledge_read", arguments: { action: "exact", query: "PRIVATE_KNOWLEDGE_BODY_CANARY" } });
    assert.equal(JSON.parse(exact.content[0].text).total, 2);
    assert((await callTool({ name: "knowledge_read", arguments: { action: "read", reference: "notes/partial.md#source" } })).content[0].text.includes("PRIVATE_KNOWLEDGE_BODY_CANARY"));
    console.log(JSON.stringify({ suite: "knowledge-http", authenticatedMcp: true, writeReadRoundTrip: true, traceBodyOmitted: true, failuresVisible: true, defaultCatalogOnly: true, conflictPreservesData: true, partialRetryPreserved: true }));
  } finally {
    if (client) await client.close();
    await gateway.stop();
    await database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
