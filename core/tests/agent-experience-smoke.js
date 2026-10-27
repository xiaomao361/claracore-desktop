const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { initializeProductDatabase } = require("../db/database");
const { createHttpAgentGateway } = require("../../electron/http-agent-gateway");
const { arbitrateAutomaticContext, shapeAutomaticContext } = require("../gateway/auto-context");
const { handleSystemTool } = require("../gateway/tool-handlers/system");
const { shapeMemoryAck, shapeMemoryCatalogEntry } = require("../gateway/bounded-response");
const { jsonSql, sqlString } = require("../db/helpers");

async function checkProjection() {
  const winner = arbitrateAutomaticContext({ agentId: "a", memoryCandidates: [{
    id: "m", context: "An exact prepared Memory block.", action: "INJECT_TOP1", policyMode: "canary", relevance: 0.9
  }] });
  const variants = [winner, arbitrateAutomaticContext({}),
    arbitrateAutomaticContext({ domainStatus: { memory: "timeout", knowledge: "error" } }),
    { contract: "memory-knowledge-v1", decision: "deliver_context", blocks: [{ domain: "knowledge", body: "Complete prepared source section." }], selected: [{ domain: "knowledge", id: "source#section" }], domainStatus: { memory: "skipped", knowledge: "ok" } },
    { decision: "abstain", blocks: [], selected: [], reason: "non_user_goal_continuation", collectionSkipped: true, turnKind: "goal_continuation", domainStatus: { memory: "skipped", knowledge: "skipped" } }
  ];
  const longBlock = arbitrateAutomaticContext({ memoryCandidates: [{ id: "m", context: "正文".repeat(2000), relevance: 0.9 }] }).block;
  assert.equal(longBlock.truncated, true);
  assert.deepEqual(longBlock.detailRef, { tool: "memoria_get", arguments: { id: "m" } });
  for (const original of variants) {
    const summary = shapeAutomaticContext(original);
    for (const field of ["decision", "reason", "domainStatus", "selected", "block", "blocks", "contract", "turnKind", "collectionSkipped"]) {
      assert.deepEqual(summary[field], original[field], `Projection changed delivery meaning: ${field}`);
    }
    assert.ok(!("candidates" in summary) && !("evidenceStates" in summary));
    const { detail, ...full } = shapeAutomaticContext(original, "full");
    assert.equal(detail, "full");
    assert.deepEqual(full, original);
  }
  await assert.rejects(handleSystemTool("gateway_auto_context", { prompt: "x", detail: "typo" }, {}), /detail must be/);
  await assert.rejects(handleSystemTool("gateway_auto_context", { prompt: "x", diagnosticsFor: "d" }, {}), /cannot be combined/);
  const short = shapeMemoryAck({ id: "m", title: "Whole title", labels: ["one"] });
  assert.ok(!short.truncatedFields, "Complete fields must not be marked truncated.");
  for (const shape of [shapeMemoryAck, shapeMemoryCatalogEntry]) {
    const preview = shape({ id: "m", title: "中文".repeat(200), labels: Array.from({ length: 10 }, (_, i) => `label-${i}`) });
    assert.deepEqual(preview.truncatedFields, ["title", "labels"]);
    assert.equal(preview.detailRef.arguments.id, "m");
  }
}

async function main() {
  await checkProjection();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-agent-experience-"));
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR = root;
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, "../.."), runtimeDir: path.join(root, "runtime") };
  const gateway = createHttpAgentGateway({ app: { isPackaged: false, getPath: () => root }, port: 0,
    ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({}) });
  try {
    await database.updateSettings({ "memory.controller.mode": "observe", "innerlife.provider": "disabled" });
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find(item => item.id === "streamable-http-mcp");
    let requestId = 0;
    async function call(name, args = {}, client = "experience-test") {
      const response = await fetch(endpoint.url, { method: "POST", signal: AbortSignal.timeout(10000),
        headers: { Authorization: endpoint.authHeader.replace(/^Authorization:\s*/, ""), "Content-Type": "application/json",
          "X-ClaraCore-Agent-ID": "codex", "X-ClaraCore-Client-ID": client, "X-ClaraCore-Conversation-ID": "experience-session" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method: "tools/call", params: { name, arguments: args } }) });
      assert.equal(response.status, 200);
      const result = await response.json();
      if (result.error) throw new Error(result.error.message);
      if (result.result?.isError) throw new Error(result.result.content[0].text);
      return JSON.parse(result.result.content[0].text);
    }
    const args = { prompt: "请回忆之前确认的工程决定，本轮没有匹配记录。", domain: "memory" };
    const summary = await call("gateway_auto_context", args);
    assert.equal(summary.detail, "summary");
    assert.equal(summary.decision, "abstain");
    assert.equal(summary.block, null);
    assert.equal(summary.recallReceipt.hostDelivery, "unknown");
    assert.equal(summary.recallReceipt.used, "unknown");
    assert.ok(summary.diagnosticsRef?.arguments.diagnosticsFor);
    const eventsBefore = (await database.getMemoryControlLedgerStats()).eventCount;
    const details = await call(summary.diagnosticsRef.tool, summary.diagnosticsRef.arguments);
    assert.equal(details.decisionId, summary.recallReceipt.decisionId);
    assert.ok(details.decisionDetails.stageA.action);
    assert.equal((await database.getMemoryControlLedgerStats()).eventCount, eventsBefore, "Inspect must not rerun recall or create a decision.");
    await assert.rejects(call(summary.diagnosticsRef.tool, summary.diagnosticsRef.arguments, "different-client"), /not found for this caller/);
    const full = await call("gateway_auto_context", { ...args, detail: "full" });
    assert.ok(Array.isArray(full.candidates) && full.jev.route);
    assert.ok(Buffer.byteLength(JSON.stringify(summary)) < Buffer.byteLength(JSON.stringify(full)) * 0.8, "A quiet default response should shed diagnostic overhead.");

    const created = await call("shared_line_create", { title: "Agent experience fixture", makeActive: false });
    const lineId = created.line.id;
    const originalSummary = "保留完整的当前进展。".repeat(250);
    const nextStep = "下一步必须核实实际结果。".repeat(100);
    const saved = await call("shared_line_update", { lineId, summary: originalSummary, nextStep, interpretationStatus: "confirmed" });
    assert.equal(saved.persisted, true);
    assert.equal(saved.receipt.operation, "shared_line_update");
    assert.equal(saved.receipt.lineId, lineId);
    assert.ok(saved.receipt.positionId);
    assert.ok(saved.truncatedFields.includes("summary") && saved.truncatedFields.includes("nextStep"));
    const read = await call(saved.receipt.readBack.tool, saved.receipt.readBack.arguments);
    assert.equal(read.currentPosition.summary, originalSummary);
    assert.equal(read.nextStep, nextStep);
    const catalog = await call("shared_line_list", { query: "experience fixture" });
    assert.equal(catalog.lines[0].id, lineId);
    assert.ok(catalog.lines[0].truncatedFields.includes("summary") && catalog.lines[0].truncatedFields.includes("nextStep"));
    assert.equal(saved.detailRef.arguments.lineId, lineId);
    await assert.rejects(call("shared_line_update", { lineId, summary: "Must not persist", confirmOverwrite: true, detail: "typo" }), /shared_line detail/);
    const lineCount = (await database.query("SELECT COUNT(*) AS total FROM continuity_lines;"))[0].total;
    await assert.rejects(call("shared_line_create", { title: "Must not be created", detail: "typo" }), /shared_line detail/);
    assert.equal((await database.query("SELECT COUNT(*) AS total FROM continuity_lines;"))[0].total, lineCount);
    await assert.rejects(call("shared_line_update", { lineId, summary: "Unconfirmed replacement", interpretationStatus: "draft" }), /overwrite requires explicit confirmation/);
    assert.equal((await call("shared_line_get", { lineId, detail: "full" })).currentPosition.summary, originalSummary);
    await database.exec("INSERT INTO innerlife_events(id, agent_id, kind, body, status) VALUES ('fresh-event', 'codex', 'test', 'fixture', 'completed'); INSERT INTO innerlife_thoughts(id, event_id, body, review_status) VALUES ('fresh-thought', 'fresh-event', 'CONSUMED_THOUGHT_DO_NOT_REPLAY', 'approved');");
    for (let index = 0; index < 10; index++) {
      await database.exec(`INSERT INTO innerlife_shares(id, agent_id, thought_id, status, body, created_at, updated_at)
        VALUES (${sqlString(`fresh-share-${index}`)}, 'codex', ${index === 0 ? "'fresh-thought'" : "NULL"}, 'pending',
          ${sqlString(index === 0 ? "CONSUMED_THOUGHT_DO_NOT_REPLAY" : `Fresh candidate ${index}`)}, datetime('now', ${sqlString(`-${index} minutes`)}), datetime('now', ${sqlString(`-${index} minutes`)}));`);
    }
    const startArgs = { externalSessionId: "freshness-session", includeBriefing: true };
    const first = await call("innerlife_session_start", startArgs);
    assert.equal(first.briefing.counts.pendingShares, 10);
    assert.equal(first.briefing.counts.pendingSharePreviews, 5);
    assert.equal(first.share_plan.share.id, "fresh-share-0");
    assert.ok(!("selectedShare" in first.briefing), "Startup must have exactly one recommendation source.");
    const historical = (await database.getInnerLifeSession(first.session.id)).briefing;
    historical.generatedAt = "2000-01-01T00:00:00Z";
    await database.exec(`UPDATE innerlife_sessions SET briefing_json = ${jsonSql(historical)} WHERE id = ${sqlString(first.session.id)}; UPDATE innerlife_shares SET status = 'used' WHERE id = 'fresh-share-0';`);
    const resumed = await call("innerlife_session_start", startArgs);
    assert.equal(resumed.session.id, first.session.id);
    assert.equal(resumed.briefingFresh, true);
    assert.notEqual(resumed.briefing.generatedAt, historical.generatedAt);
    assert.equal(resumed.briefing.counts.pendingShares, 9);
    assert.equal(resumed.briefing.counts.pendingSharePreviews, 5);
    assert.equal((await call("innerlife_pending_shares", { limit: 1 })).totalPending, 9);
    assert.equal(resumed.share_plan.share.id, "fresh-share-1");
    assert.ok(!JSON.stringify(resumed.briefing).includes("CONSUMED_THOUGHT_DO_NOT_REPLAY"), "Used shares must not reappear as selected shares or open loops.");
    assert.deepEqual((await database.getInnerLifeSession(first.session.id)).briefing, historical);
    assert.ok(resumed.shared_lines.some(line => line.id === lineId && typeof line.nextStep === "string" && line.nextStep.length > 0));
    await database.exec("UPDATE innerlife_shares SET status = 'used' WHERE agent_id = 'codex' AND id LIKE 'fresh-share-%';");
    const empty = await call("innerlife_session_start", startArgs);
    assert.equal(empty.briefing.counts.pendingShares, 0);
    assert.equal(empty.share_plan.selected, false);
    assert.equal(await database.countInnerLifeSessions("codex"), 1);
    console.log(JSON.stringify({ suite: "agent-experience", sqlite: database.connection ? "node" : "cli",
      compactQuietBytes: Buffer.byteLength(JSON.stringify(summary)), fullQuietBytes: Buffer.byteLength(JSON.stringify(full)),
      preparedBlocksPreserved: true, diagnosticsReadWithoutRecall: true, callerIsolation: true, truncationVisible: true,
      savedContentReadBack: true, failedWriteHasNoReceipt: true, resumedBriefingFresh: true, consumedSharesNotReplayed: true, previewAndTotalDistinct: true, passed: true }));
  } finally {
    await gateway.stop();
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
