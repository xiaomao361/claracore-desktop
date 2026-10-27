const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { initializeProductDatabase } = require("../db/database");
const { sqlString, jsonSql } = require("../db/helpers");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");
const { profileToolDefinitions } = require("../gateway/tool-profiles");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-line-search-"));
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR = root;
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, "../.."), runtimeDir: path.join(root, "runtime") };
  const gateway = createHttpAgentGateway({
    app: { isPackaged: false, getPath: () => root }, port: 0,
    ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({})
  });
  try {
    await database.exec("INSERT INTO agents(id, label) VALUES ('search-a', 'A'), ('search-b', 'B');");
    const fixtures = [
      ["title", "search-a", "Desktop 100%_literal 'quoted'", "active", "标题命中", ""],
      ["position", "search-a", "工程", "active", `${"前文".repeat(1000)} Desktop 接续`, ""],
      ["step", "search-a", "发布", "active", "已修复", "Desktop 验收"],
      ["old", "search-a", "其他工作", "active", "今天做别的事", ""],
      ["archive", "search-a", "Desktop archive", "archived", "", ""],
      ["deleted", "search-a", "Desktop deleted", "deleted", "", ""],
      ["foreign", "search-b", "Desktop foreign", "active", "", ""]
    ];
    for (const [id, agent, title, status, summary, nextStep] of fixtures) {
      await database.exec(`
        INSERT INTO continuity_lines(id, agent_id, title, status)
          VALUES (${sqlString(id)}, ${sqlString(agent)}, ${sqlString(title)}, ${sqlString(status)});
        INSERT INTO current_positions(id, line_id, summary, interpretation_status, facts_used_json, metadata_json, updated_at)
          VALUES (${sqlString(`position_${id}`)}, ${sqlString(id)}, ${sqlString(summary)}, 'draft', '[]', ${jsonSql({ nextStep })}, '2026-10-27 10:00:00');
      `);
    }
    await database.exec("INSERT INTO continuity_position_history(id, line_id, position_id, summary, interpretation_status, facts_used_json, source) VALUES ('old-checkpoint', 'old', 'position_old', 'Desktop historical-only', 'draft', '[]', 'fixture');");
    await database.exec("INSERT INTO agents(id, label) VALUES ('choice-agent', 'Choice fixture');");
    for (let index = 0; index < 8; index++) {
      const createdAt = index === 0 ? "2026-06-20T05:19:11.268833+00:00" : "2026-08-10 09:19:12";
      const updatedAt = index === 0 ? "2026-10-27T12:00:00+08:00" : index === 1 ? "2026-10-27 05:00:00" : `2026-10-27 0${index}:00:00`;
      await database.exec(`INSERT INTO continuity_lines(id, agent_id, title, status, created_at, updated_at)
        VALUES (${sqlString(`choice-${index}`)}, 'choice-agent', ${sqlString(`Choice ${index}`)}, 'active', ${sqlString(createdAt)}, ${sqlString(updatedAt)});`);
    }
    await database.setActiveContinuityLine("choice-0");
    const reopened = await initializeProductDatabase(database.dbPath);
    try {
      assert.equal(await reopened.getActiveContinuityLineIdReadOnly(), "choice-0", "The persisted global fallback must survive database reinitialization.");
    } finally { reopened.close(); }
    const before = await database.query("SELECT * FROM continuity_lines ORDER BY id;");
    const beforeSettings = await database.getSettings();
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find(item => item.id === "streamable-http-mcp");
    let requestId = 0;
    async function list(args = {}) {
      const response = await fetch(endpoint.url, {
        method: "POST", signal: AbortSignal.timeout(5000),
        headers: { Authorization: endpoint.authHeader.replace(/^Authorization:\s*/, ""), "Content-Type": "application/json", "X-ClaraCore-Agent-ID": "search-a", "X-ClaraCore-Client-ID": "search-test" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method: "tools/call", params: { name: "shared_line_list", arguments: args } })
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      if (body.error) throw new Error(body.error.message);
      if (body.result?.isError) throw new Error(body.result.content[0].text);
      return JSON.parse(body.result.content[0].text);
    }
    const matching = await list({ query: "desktop", status: "active" });
    assert.equal(matching.page.total, 3);
    assert.deepEqual(matching.lines.map(line => line.id).sort(), ["position", "step", "title"]);
    assert.equal(matching.page.hasMore, false);
    assert.ok(matching.lines.every(line => line.isGlobalFallback === line.isCurrent), "The old alias must retain its global-only meaning.");
    const pagedIds = [];
    for (let offset = 0; offset < 3; offset++) {
      const page = await list({ query: "Desktop", status: "active", limit: 1, offset });
      assert.equal(page.page.total, 3);
      assert.equal(page.page.hasMore, offset < 2);
      pagedIds.push(page.lines[0].id);
    }
    assert.equal(new Set(pagedIds).size, 3);
    assert.equal((await list({ query: "Desktop", status: "active", offset: 3 })).lines.length, 0);
    assert.equal((await list({ query: "Desktop", status: "active", allAgents: true })).page.total, 4);
    assert.equal((await list({ query: "Desktop", status: "archived" })).page.total, 1);
    for (const query of ["100%_literal", "'quoted'", "%", "_", "100%_literal 'quoted'"]) {
      assert.deepEqual((await list({ query, status: "active" })).lines.map(line => line.id), ["title"]);
    }
    for (const query of ["historical-only", "missing", "' OR 1=1 --"]) {
      assert.equal((await list({ query })).page.total, 0);
    }
    assert.deepEqual((await list({ query: "验收" })).lines.map(line => line.id), ["step"]);
    assert.equal((await list({ query: "  " })).page.total, (await list()).page.total);
    for (const query of [null, 3, {}, "字".repeat(201)]) {
      await assert.rejects(database.listContinuityLineSummaries({ agentId: "search-a", query }), /Shared Line query/);
      await assert.rejects(list({ query }), /Shared Line query/);
    }
    const schema = profileToolDefinitions("core").find(tool => tool.name === "shared_line_list").inputSchema;
    assert.equal(schema.properties.query.maxLength, 200);
    assert.equal(profileToolDefinitions("core").length, 25);
    const choices = await database.listContinuityLineSummaries({ agentId: "choice-agent", status: "active", limit: 10 });
    assert.equal(choices.total, 8);
    assert.ok(choices.items.findIndex(line => line.id === "choice-1") < choices.items.findIndex(line => line.id === "choice-0"), "Order timezone-aware and SQLite UTC dates by instant, not text.");
    assert.equal(choices.items.find(line => line.id === "choice-0").createdAt, "2026-06-20T05:19:11.268833Z", "Keep imported fractional precision.");
    assert.equal(choices.items.find(line => line.id === "choice-1").createdAt, "2026-08-10T09:19:12Z");
    const firstFive = choices.items.slice(0, 5).map(line => line.id);
    await assert.rejects(database.getResumePacket({ agentId: "choice-agent" }), error => {
      assert.equal(error.code, "SHARED_LINE_ID_REQUIRED");
      assert.deepEqual(error.candidates.map(line => line.lineId), firstFive, "get and list must agree on candidate order.");
      return true;
    });
    await database.setActiveContinuityLine("choice-7");
    const afterOtherSession = await database.listContinuityLineSummaries({ agentId: "choice-agent", status: "active", limit: 5 });
    assert.deepEqual(afterOtherSession.items.map(line => line.id), firstFive, "A different session's global fallback must not reorder Agent candidates.");
    await database.setActiveContinuityLine("choice-0");
    assert.deepEqual(await database.query("SELECT * FROM continuity_lines ORDER BY id;"), before, "Finding a candidate must not select, activate or create a line.");
    assert.equal((await database.getSettings())["continuity.active_line_id"], beforeSettings["continuity.active_line_id"]);
    console.log(JSON.stringify({ suite: "shared-line-search", sqlite: database.connection ? "node" : "cli", authenticatedHttp: true, latestPositionOnly: true, literalSearch: true, filteredPagination: true, noLineWrites: true, passed: true }));
  } finally {
    await gateway.stop();
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
