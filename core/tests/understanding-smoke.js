const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { initializeProductDatabase } = require("../db/database");
const { service, prepare, apply, lines } = require("../gateway/understanding/adapters");
const { createUnderstandingService, ownerKey } = require("../gateway/understanding/service");
const { journal, hash } = require("../gateway/understanding/journal");
const { validatePlan, normalizeInput } = require("../gateway/understanding/planner");
const { saveKnowledgeRootPreference } = require("../knowledge/preferences");

const caller = { agentId: "codex", clientId: "test", conversationId: "understanding-test" };
const event = { id: "u1", speaker: "user", text: "我决定文档使用中文。", sourceRef: "conversation:test#u1" };
const memoryOp = { kind: "memory", eventIds: [event.id], quotes: [{ eventId: event.id, text: event.text }], rationale: "用户明确做出的文档语言决定。", certainty: "confirmed", body: "文档使用中文。", title: "文档语言" };
function planFor(events, operations, pending = {}) {
  return JSON.stringify({ operations, coverage: events.map(e => Object.fromEntries([
    ["eventId", e.id], ...["memory", "knowledge", "continuity", "innerlife"].map(domain => {
      const indices = operations.flatMap((op, i) => ({ memory: "memory", knowledge: "knowledge", material: "innerlife", line_create: "continuity", line_archive: "continuity", position: "continuity" }[op.kind] === domain && op.eventIds.includes(e.id)) ? [i] : []);
      return [domain, { status: indices.length ? "planned" : pending[domain] ? "pending" : "none", reason: pending[domain] || (indices.length ? "Evidence supports operation." : "No durable change for this domain."), operations: indices }];
    })
  ])) });
}
async function setup(root) {
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const app = { getPath: () => root };
  const core = { database, paths: { dataRoot: root } };
  return { core, app, database };
}
const input = (submissionId, events = [event], extra = {}) => ({ submissionId, events, allowModel: true, grants: { memory: true }, execute: true, ...extra });

async function crashWorker(root) {
  const { core, app } = await setup(root);
  const crashing = createUnderstandingService({ lines, memories: async () => ({}), knowledge: async () => ({}),
    generate: async () => planFor([event], [memoryOp]), prepare,
    apply: async (...args) => { await apply(...args); process.exit(73); } });
  await crashing.submit(core, app, caller, input("crash"));
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-understanding-"));
  let database;
  try {
    const setupResult = await setup(root); database = setupResult.database;
    const { core, app } = setupResult;
    const library = path.join(root, "library"); await fs.mkdir(library);
    await saveKnowledgeRootPreference(app, library);
    let modelCalls = 0;
    database.innerLifeGenerate = async () => { modelCalls++; return planFor([event], [memoryOp]); };
    const noPermission = await service.submit(core, app, caller, input("model-opt-in", [event], { allowModel: false }));
    assert.equal(noPermission.status, "model_permission_required"); assert.equal(modelCalls, 0);
    database.innerLifeGenerate = async () => null;
    assert.equal((await service.submit(core, app, caller, input("model-off"))).status, "model_unavailable");
    database.innerLifeGenerate = async () => planFor([event], [memoryOp]);
    const noGrant = await service.submit(core, app, caller, input("no-grant", [event], { grants: {} }));
    assert.equal(noGrant.items[0].code, "authorization_required");
    assert.equal((await database.query("SELECT COUNT(*) AS count FROM memories;"))[0].count, 0);
    const preview = await service.submit(core, app, caller, input("preview", [event], { execute: false }));
    assert.equal(preview.items[0].status, "planned");
    assert.equal((await database.query("SELECT COUNT(*) AS count FROM memories;"))[0].count, 0);
    assert((await service.resume(core, app, caller, { submissionId: "preview", detail: "plan" })).plan.operations[0].body.includes("中文"));
    const saved = await service.resume(core, app, caller, { submissionId: "preview", execute: true });
    assert.equal(saved.status, "completed");
    const recalledMemory = await service.context(core, app, caller, { query: memoryOp.body, knowledgeMode: "exact" });
    assert.notEqual(recalledMemory.domains.memory.status, "failed");
    assert(recalledMemory.domains.memory.items.some(item => item.id === saved.items[0].reference), "Real memory search returns a packet, not an array");
    const repeated = await service.submit(core, app, caller, input("preview", [event], { execute: false }));
    assert.equal(repeated.items[0].reference, saved.items[0].reference);
    await assert.rejects(service.submit(core, app, caller, input("preview", [{ ...event, text: "changed" }])), /submission_id_conflict/);
    await assert.rejects(service.resume(core, app, { ...caller, conversationId: "other" }, { submissionId: "preview" }), /submission_not_found/);
    const deduped = await service.submit(core, app, caller, input("same-fact-new-turn"));
    assert.equal(deduped.items[0].status, "unchanged");
    assert.equal((await database.query("SELECT COUNT(*) AS count FROM memories;"))[0].count, 1);
    const invalidLine = await service.submit(core, app, caller, input("missing-line", [event], { lineId: "line-does-not-exist" }));
    assert.equal(invalidLine.status, "partial");
    assert.equal(invalidLine.items[0].status, "unchanged", "Unavailable line must not block independent memory handling");
    assert.equal(invalidLine.contextIssues[0].code, "line_not_available_to_caller");

    // Structural contracts reject missing domains and fabricated evidence before
    // any write. These fixtures do not establish real model extraction quality.
    const missing = JSON.parse(planFor([event], [memoryOp])); delete missing.coverage[0].knowledge;
    assert.throws(() => validatePlan(JSON.stringify(missing), normalizeInput(input("bad"))), /incomplete_coverage/);
    const forged = JSON.parse(planFor([event], [memoryOp])); forged.operations[0].quotes[0].text = "用户没有说过";
    assert.throws(() => validatePlan(JSON.stringify(forged), normalizeInput(input("forged"))), /evidence_mismatch/);
    database.innerLifeGenerate = async () => JSON.stringify(missing);
    assert.equal((await service.submit(core, app, caller, input("missing-coverage"))).planningStatus, "incomplete_coverage");
    const guess = { ...event, speaker: "agent", text: "我猜用户也许更喜欢英文。" };
    database.innerLifeGenerate = async () => planFor([guess], [{ ...memoryOp, body: "用户更喜欢英文。", quotes: [{ eventId: guess.id, text: guess.text }] }]);
    assert.equal((await service.submit(core, app, caller, input("guess", [guess]))).items[0].code, "confirmed_user_evidence_required");
    const question = { ...event, text: "现在几点？" };
    database.innerLifeGenerate = async () => planFor([question], []);
    const lineCountBefore = (await database.query("SELECT COUNT(*) AS count FROM continuity_lines;"))[0].count;
    const empty = await service.context(core, app, caller, { query: "普通一次性问答" });
    assert.equal(empty.domains.continuity.status, "none");
    assert.equal((await service.submit(core, app, caller, input("question", [question]))).status, "completed");
    assert.equal((await database.query("SELECT COUNT(*) AS count FROM continuity_lines;"))[0].count, lineCountBefore);

    const objective = { ...event, text: "请记录这个短期任务：整理今天的材料，下次从清单继续。" };
    const createOp = { ...memoryOp, kind: "line_create", body: "整理今天的材料，清单尚待补齐。", title: "材料整理", nextStep: "补齐清单", quotes: [{ eventId: objective.id, text: objective.text }] };
    database.innerLifeGenerate = async () => planFor([objective], [createOp]);
    const created = await service.submit(core, app, caller, input("short-task", [objective], { grants: { continuity: true, createLine: true } }));
    assert.equal(created.status, "completed", JSON.stringify(created));
    const lineId = created.items[0].reference;
    assert.equal((await database.getContinuityLine(lineId)).active, false);
    const restored = await service.context(core, app, caller, { query: "继续整理", lineId });
    assert.equal(restored.domains.continuity.selected.lineId, lineId);
    const waiting = { ...event, speaker: "agent", text: "当前材料已列出，等待外部回复。结束本次聊天。" };
    const position = { ...memoryOp, kind: "position", certainty: "provisional", body: "清单已整理，等待外部回复。", lineId, quotes: [{ eventId: waiting.id, text: waiting.text }], nextStep: "收到回复后核对" };
    database.innerLifeGenerate = async () => planFor([waiting], [position]);
    const protectedPosition = await service.submit(core, app, caller, input("protected", [waiting], { lineId, grants: { continuity: true } }));
    assert.equal(protectedPosition.items[0].code, "SHARED_LINE_CONFIRM_OVERWRITE_REQUIRED");
    const updated = await service.submit(core, app, caller, input("waiting", [waiting], { lineId, grants: { continuity: true, overwriteConfirmed: true } }));
    assert.equal(updated.status, "completed");
    assert.equal((await database.getContinuityLine(lineId)).status, "active", "Conversation end must not archive an objective");
    await database.createContinuityLine({ id: "line-other", title: "其他长期事项", agentId: "codex", makeActive: false });
    const ambiguous = await service.context(core, app, caller, { query: "继续" });
    assert.equal(ambiguous.domains.continuity.status, "selection_required"); assert.equal(ambiguous.domains.continuity.candidates.length, 2);
    const noIdPosition = { ...position, lineId: "line-other" };
    database.innerLifeGenerate = async () => planFor([waiting], [noIdPosition]);
    assert.equal((await service.submit(core, app, caller, input("ambiguous", [waiting], { grants: { continuity: true } }))).items[0].code, "exact_line_selection_required");
    // An execution approved later must retain the reviewed position revision.
    database.innerLifeGenerate = async () => planFor([waiting], [noIdPosition]);
    await service.submit(core, app, caller, input("stale-review", [waiting], { lineId: "line-other", execute: false, grants: { continuity: true } }));
    await database.saveCurrentPosition({ lineId: "line-other", summary: "Another writer advanced this objective.", interpretationStatus: "draft" });
    const stale = await service.resume(core, app, caller, { submissionId: "stale-review", execute: true });
    assert.equal(stale.items[0].code, "conflict");
    const atomic = database.execAtomic;
    let interleaved = false;
    database.execAtomic = async function(sql) {
      if (!interleaved) { interleaved = true; await this.exec("UPDATE current_positions SET summary = 'Concurrent write' WHERE line_id = 'line-other';"); }
      return atomic.call(this, sql);
    };
    const racing = await service.submit(core, app, caller, input("concurrent", [waiting], { lineId: "line-other", grants: { continuity: true } }));
    assert.equal(racing.items[0].code, "conflict");
    assert.equal((await database.getCurrentPosition("line-other")).summary, "Concurrent write");
    database.execAtomic = atomic;
    // A model can be slow: changes made while it judges must also conflict.
    database.innerLifeGenerate = async () => {
      await database.saveCurrentPosition({ lineId: "line-other", summary: "Progress during semantic planning", interpretationStatus: "draft", nextStep: "Preserve this continuation" });
      return planFor([waiting], [noIdPosition]);
    };
    const duringModel = await service.submit(core, app, caller, input("during-model", [waiting], { lineId: "line-other", grants: { continuity: true } }));
    assert.equal(duringModel.items[0].code, "conflict");
    assert.equal((await database.getCurrentPosition("line-other")).summary, "Progress during semantic planning");
    const { nextStep, ...withoutNextStep } = noIdPosition;
    database.innerLifeGenerate = async () => planFor([waiting], [withoutNextStep]);
    assert.equal((await service.submit(core, app, caller, input("preserve-next", [waiting], { lineId: "line-other", grants: { continuity: true } }))).status, "completed");
    assert.equal((await database.getCurrentPosition("line-other")).metadata.nextStep, "Preserve this continuation");
    const finished = { ...event, text: "材料整理已经全部完成，可以归档这个事项。" };
    database.innerLifeGenerate = async () => planFor([finished], [{ ...memoryOp, kind: "line_archive", lineId, completed: true, body: "材料整理完成。", quotes: [{ eventId: event.id, text: finished.text }] }]);
    const archived = await service.submit(core, app, caller, input("finish", [finished], { lineId, grants: { continuity: true, archiveLine: true } }));
    assert.equal(archived.status, "completed"); assert.equal((await database.getContinuityLine(lineId)).status, "archived");
    assert.equal((await database.getContinuityLine("line-other")).status, "active");
    assert((await database.listContinuityPositionHistory(20, lineId)).length >= 3);

    const source = { id: "s1", speaker: "source", text: "SQLite 事务提供数据库内的原子性；文件系统写入需要单独恢复。", sourceRef: "fixture:sqlite-design" };
    const knowledgeOp = { kind: "knowledge", eventIds: [source.id], quotes: [{ eventId: source.id, text: source.text }], rationale: "可复查的资料结论。", certainty: "source", body: source.text, title: "跨存储恢复", sourceRef: source.sourceRef, date: "2026-10-15", attribution: "source_statement" };
    const materialOp = { ...knowledgeOp, kind: "material", existingId: "operation:0" };
    database.innerLifeGenerate = async () => planFor([source], [knowledgeOp, materialOp]);
    const knowledge = await service.submit(core, app, caller, input("knowledge", [source], { grants: { knowledge: true, innerlife: true } }));
    assert.equal(knowledge.status, "completed"); assert.equal(knowledge.items.length, 2);
    const inbox = await database.getInnerLifeInboxItem(knowledge.items[1].reference);
    assert(!inbox.body.includes(source.text)); assert(inbox.body.includes(knowledge.items[0].reference));
    const filesBefore = await fs.readdir(path.join(library, "notes"));
    database.innerLifeGenerate = async () => planFor([source], [knowledgeOp]);
    const repeatSource = await service.submit(core, app, caller, input("knowledge-dedupe", [source], { grants: { knowledge: true } }));
    assert.equal(repeatSource.items[0].status, "unchanged");
    // Simulate lost domain acknowledgment, restart of preview cache, and durable
    // running state. A valid existing file is reconciled, never appended again.
    const store = journal(root, ownerKey(caller), "knowledge");
    const state = store.read(); state.plan.operations[0].status = "running"; store.write(state);
    const recoveredKnowledge = await service.resume(core, app, caller, { submissionId: "knowledge", execute: true });
    assert.equal(recoveredKnowledge.status, "partial"); assert.equal(recoveredKnowledge.items[0].code, "write_recovered_index_unverified");
    assert.deepEqual(await fs.readdir(path.join(library, "notes")), filesBefore);
    // Expired preview before writing can be regenerated with identical kb_id.
    const expiryOp = { ...state.plan.operations[0], body: source.text + " 延迟预览。", sourceRef: "fixture:expiry" };
    const expiryState = { ...state, input: { ...state.input, events: [{ ...source, sourceRef: "fixture:expiry" }] } };
    const prepared = await prepare(core, app, caller, expiryState, expiryOp, hash("expiry"));
    prepared.token = "expired";
    const expiryResult = await apply(core, app, caller, expiryState, { ...expiryOp, prepared }, hash("expiry"));
    assert.equal(expiryResult.status, "completed");

    // Cross-domain partial failure must not block an independent valid write.
    const combined = [event, source];
    database.innerLifeGenerate = async () => planFor(combined, [memoryOp, knowledgeOp]);
    const knowledgeApply = core.database.createMemory;
    const failOnce = createUnderstandingService({ lines, memories: async () => ({}), knowledge: async () => ({}), generate: () => database.innerLifeGenerate(), prepare,
      apply: async (...args) => { if (args[4].kind === "knowledge") throw Object.assign(new Error("fixture"), { code: "fixture_failure" }); return apply(...args); } });
    const partial = await failOnce.submit(core, app, caller, input("partial", combined, { grants: { memory: true, knowledge: true } }));
    assert.equal(partial.status, "partial"); assert.equal(partial.items[1].code, "fixture_failure");
    assert.equal((await service.resume(core, app, caller, { submissionId: "partial", execute: true })).status, "completed");
    assert.equal(core.database.createMemory, knowledgeApply);

    // Private or pending thought text cannot leak through unified context.
    const originalTiming = database.checkInnerLifeShareTiming;
    database.checkInnerLifeShareTiming = async () => ({ check: { decision: "review_first" }, share: { id: "pending", status: "pending", body: "PRIVATE_PENDING_CANARY" } });
    const withheld = await service.context(core, app, caller, { query: "engineering", reviewShares: true });
    assert(!JSON.stringify(withheld).includes("PRIVATE_PENDING_CANARY")); assert.equal(withheld.domains.innerlife.status, "withheld");
    database.checkInnerLifeShareTiming = originalTiming;
    assert(Buffer.byteLength(JSON.stringify(restored)) < 24 * 1024);
    await assert.rejects(service.context(core, app, caller, { query: "中".repeat(501) }), /bounded_query_required/);
    assert.throws(() => normalizeInput(input("oversize", Array.from({ length: 12 }, (_, i) => ({ ...event, id: String(i), text: "x".repeat(6000) })))), /delta_too_large/);
    assert.throws(() => validatePlan(" ".repeat(48 * 1024 + 1), normalizeInput(input("large-plan"))), /invalid_planner_output/);
    assert(!JSON.stringify(saved).includes(memoryOp.body), "Default receipts must not copy saved bodies");

    await database.close(); database = null;
    const crashRoot = path.join(root, "crash-test"); await fs.mkdir(crashRoot);
    const child = spawnSync(process.execPath, [__filename, "crash-worker", crashRoot], { encoding: "utf8" });
    assert.equal(child.status, 73, child.stderr);
    const reopened = await setup(crashRoot); database = reopened.database;
    const afterCrash = await service.resume(reopened.core, reopened.app, caller, { submissionId: "crash", execute: true });
    assert.equal(afterCrash.status, "completed");
    assert.equal((await database.query("SELECT COUNT(*) AS count FROM memories;"))[0].count, 1);
    console.log(JSON.stringify({ suite: "understanding", actualDatabaseAndMarkdown: true, semanticModel: "fixture_only", processCrashAfterWriteRecovered: true, immutablePlan: true, perDomainCoverage: true, provisionalNotConfirmed: true, privateShareWithheld: true }));
  } finally {
    if (database) await database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
if (process.argv[2] === "crash-worker") crashWorker(process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
else main().catch(error => { console.error(error); process.exitCode = 1; });
