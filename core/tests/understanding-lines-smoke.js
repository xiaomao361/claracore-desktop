const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { initializeProductDatabase } = require("../db/database");
const { service } = require("../gateway/understanding/adapters");
const { assessLineSelection } = require("../gateway/understanding/line-selection");

const caller = { agentId: "codex", clientId: "line-test", conversationId: "matching" };
function plan(event, operations, selection) {
  return JSON.stringify({ operations, lineSelection: selection, coverage: [{ eventId: event.id,
    ...Object.fromEntries(["memory", "knowledge", "continuity", "innerlife"].map(domain => [domain, {
      status: domain === "continuity" && operations.length ? "planned" : "none", reason: "Explicit fixture decision.",
      operations: domain === "continuity" ? operations.map((_, index) => index) : []
    }])) }] });
}
function selection(event, catalog, decision, lineId = "") {
  return { decision, certainty: decision === "ambiguous" ? "uncertain" : "clear", lineId,
    evaluatedCandidateIds: catalog.candidates.map(item => item.id), rationale: "The fixture describes one objective or explicitly distinct work.", quotes: [{ eventId: event.id, text: event.text }] };
}
async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "understanding-lines-"));
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const core = { paths: { dataRoot: root }, database }, app = { getPath: () => root };
  try {
    for (const [id, title] of [["line-alpha", "项目 A"], ["line-beta", "项目 B"]]) {
      await database.createContinuityLine({ id, title, agentId: "codex", makeActive: false });
      await database.saveCurrentPosition({ lineId: id, summary: `${title} 的现有进度`, interpretationStatus: "draft" });
    }
    let modelCalls = 0;
    database.innerLifeGenerate = async () => { modelCalls++; throw new Error("Must not call model without opt-in"); };
    const active = await database.getActiveContinuityLineIdReadOnly();
    assert.equal((await service.context(core, app, caller, { query: "项目 A" })).domains.continuity.status, "selection_required");
    assert.equal(modelCalls, 0);
    database.innerLifeGenerate = async input => {
      const data = JSON.parse(input.prompt);
      return JSON.stringify(selection({ id: "query", text: data.query }, data.catalog, "reuse", "line-alpha"));
    };
    const read = await service.context(core, app, caller, { query: "继续项目 A 的文档", allowModel: true });
    assert.equal(read.domains.continuity.selected.lineId, "line-alpha");
    assert.equal(await database.getActiveContinuityLineIdReadOnly(), active, "Semantic selection never changes global activation");
    database.innerLifeGenerate = async input => { const data = JSON.parse(input.prompt); return JSON.stringify(selection({ id: "query", text: data.query }, data.catalog, "ambiguous")); };
    assert.equal((await service.context(core, app, caller, { query: "继续之前的事情", allowModel: true })).domains.continuity.selectionStatus, "line_selection_required");
    database.innerLifeGenerate = async input => { const data = JSON.parse(input.prompt); return JSON.stringify(selection({ id: "query", text: data.query }, data.catalog, "new")); };
    assert.equal((await service.context(core, app, caller, { query: "另一个新事项", allowModel: true })).domains.continuity.selectionStatus, "read_cannot_create_line");

    const progress = { id: "a1", speaker: "agent", text: "项目 A 测试已完成，下一步整理文档。", sourceRef: "conversation:matching#a1" };
    const position = { kind: "position", eventIds: [progress.id], quotes: [{ eventId: progress.id, text: progress.text }], rationale: "Progress belongs to project A.", certainty: "provisional", body: progress.text, nextStep: "整理文档" };
    database.innerLifeGenerate = async input => {
      const data = JSON.parse(input.prompt);
      return plan(progress, [position], selection(progress, data.existing.continuity, "reuse", "line-alpha"));
    };
    const reused = await service.submit(core, app, caller, { submissionId: "reuse", events: [progress], allowModel: true, execute: true, grants: { continuity: true } });
    assert.equal(reused.status, "completed", JSON.stringify(reused)); assert.equal(reused.items[0].reference, "line-alpha");
    assert.equal((await database.getCurrentPosition("line-beta")).summary, "项目 B 的现有进度");

    const fresh = { id: "u1", speaker: "user", text: "为独立的播客计划建立共同线，下次继续准备选题。", sourceRef: "conversation:matching#u1" };
    const createOp = { kind: "line_create", eventIds: [fresh.id], quotes: [{ eventId: fresh.id, text: fresh.text }], rationale: "Independent podcast objective, unrelated to projects A and B.", certainty: "confirmed", title: "播客计划", body: "准备播客选题", nextStep: "整理选题" };
    database.innerLifeGenerate = async input => { const data = JSON.parse(input.prompt); return plan(fresh, [createOp], selection(fresh, data.existing.continuity, "new")); };
    const createInput = id => ({ submissionId: id, events: [fresh], allowModel: true, execute: true, grants: { continuity: true, createLine: true } });
    const created = await service.submit(core, app, caller, createInput("distinct"));
    assert.equal(created.status, "completed", JSON.stringify(created)); assert(created.items[0].reference.startsWith("line_understanding_"));
    assert.equal((await database.getContinuityLine("line-alpha")).status, "active");
    database.innerLifeGenerate = async input => { const data = JSON.parse(input.prompt); return plan(fresh, [createOp], selection(fresh, data.existing.continuity, "ambiguous")); };
    const ambiguous = await service.submit(core, app, caller, createInput("ambiguous"));
    assert.equal(ambiguous.items[0].code, "line_selection_required");
    assert.equal(assessLineSelection({ decision: "new", certainty: "clear", evaluatedCandidateIds: [] }, { status: "none", candidates: [], hasMore: true }), "line_catalog_incomplete");

    // New concurrent objectives invalidate the model's distinctness judgment.
    database.innerLifeGenerate = async input => {
      const data = JSON.parse(input.prompt);
      await database.createContinuityLine({ id: "line-during-model", title: "Concurrent objective", agentId: "codex", makeActive: false });
      return plan(fresh, [createOp], selection(fresh, data.existing.continuity, "new"));
    };
    const raced = await service.submit(core, app, caller, createInput("new-race"));
    assert(["conflict", "line_selection_required"].includes(raced.items[0].code));
    database.innerLifeGenerate = async input => { const data = JSON.parse(input.prompt); return plan(fresh, [createOp], selection(fresh, data.existing.continuity, "new")); };
    const atomic = database.execAtomic;
    let injected = false;
    database.execAtomic = async function(sql) {
      if (!injected && sql.includes("understanding_catalog_guard")) {
        injected = true;
        await this.exec("INSERT INTO continuity_lines(id,agent_id,title,status) VALUES('line-concurrent','codex','New concurrent objective','active');");
      }
      return atomic.call(this, sql);
    };
    const atomicRace = await service.submit(core, app, caller, createInput("atomic-race"));
    assert.equal(atomicRace.items[0].code, "conflict"); database.execAtomic = atomic;
    console.log(JSON.stringify({ suite: "understanding-lines", semanticMatcher: "fixture", readNeverCreatesOrActivates: true, exactReuse: true, distinctNewWithExisting: true, ambiguousAbstains: true, catalogRaceGuard: true }));
  } finally { await database.close(); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
