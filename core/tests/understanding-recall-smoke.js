const assert = require("node:assert/strict");
const { recallEvents, recallWindows, WINDOW_BYTES, RECALL_BYTES } = require("../gateway/understanding/recall");
const { createUnderstandingService } = require("../gateway/understanding/service");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { journal } = require("../gateway/understanding/journal");

async function main() {
  const long = "前段🙂".repeat(400) + "需要在结尾找到的冲突事实";
  const windows = recallWindows(long);
  assert(windows.length > 1);
  assert(windows.every(window => Buffer.byteLength(window) <= WINDOW_BYTES));
  assert(windows.at(-1).endsWith("需要在结尾找到的冲突事实"));
  assert(!windows.some(window => window.includes("\uFFFD")));
  const events = [
    { id: "long", text: long, sourceRef: "source:long" },
    { id: "late", text: "第二个事件更正了旧决定", sourceRef: "source:late" },
    { id: "failure", text: "FAIL_LOCAL_INDEX", sourceRef: "source:failure" }
  ];
  const calls = [];
  const result = await recallEvents({}, {}, { agentId: "codex" }, { events }, {
    lines: async () => ({ status: "none", candidates: [] }),
    memories: async (_core, query) => {
      calls.push(["memory", query]);
      return { status: "ok", items: query.includes("冲突事实") || query.includes("更正") ? [{ id: "memory-old", bodyPreview: "已保存的旧决定", detailRef: { tool: "memoria_get", arguments: { id: "memory-old" } } }] : [] };
    },
    knowledge: async (_core, _app, query, options) => {
      calls.push(["knowledge", query]); assert.equal(options.mode, "hybrid");
      if (query.includes("FAIL")) throw Object.assign(new Error("fixture"), { code: "index_corrupt" });
      return { status: "partial", code: "index_missing", items: query === "source:late" ? [{ reference: "notes/old.md#evidence", preview: "旧材料", detailRef: { tool: "knowledge_read", arguments: { action: "read", reference: "notes/old.md#evidence" } } }] : [] };
    }
  });
  assert.equal(result.events.length, 3);
  assert(result.events.every(event => event.textFullyCovered));
  assert(result.events[0].domains.memory.references.includes("memory-old"), "Tail window must contribute existing conflict context");
  assert(result.events[1].domains.memory.references.includes("memory-old"), "Later events must be retrieved independently");
  assert(result.events[1].domains.knowledge.references.includes("notes/old.md#evidence"));
  assert.equal(result.objects.memory.length, 1, "Same object is carried once with per-event references");
  assert(result.events[2].domains.knowledge.outcomes.some(outcome => outcome.status === "failed" && outcome.code === "index_corrupt"));
  assert(result.events[0].domains.knowledge.outcomes.some(outcome => outcome.status === "partial"));
  assert(calls.some(([domain, query]) => domain === "memory" && query === events[1].text));
  assert(Buffer.byteLength(JSON.stringify(result)) < RECALL_BYTES);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "understanding-omitted-candidates-"));
  try {
    const capacity = journal(root, "fixture", "capacity");
    capacity.write({ schema: 1, owner: "fixture", submissionId: "capacity", position: "recoverable" });
    assert.throws(() => capacity.write({ schema: 1, owner: "fixture", submissionId: "capacity", content: "x".repeat(256 * 1024) }), /journal_capacity_exceeded/);
    assert.equal(capacity.read().position, "recoverable", "An oversized state cannot replace the last readable checkpoint");
    let writes = 0;
    const event = { ...events[0], speaker: "user" };
    const service = createUnderstandingService({ lines: async () => ({ status: "none", candidates: [] }),
      memories: async (_core, query) => ({ status: "ok", items: query.includes("冲突事实") ? [{ id: "old-conflict" }] : [{ id: "old-1" }, { id: "old-2" }, { id: "old-3" }] }),
      knowledge: async () => ({ status: "no_results", items: [] }),
      generate: async () => JSON.stringify({ operations: [{ kind: "memory", certainty: "confirmed", body: "New fact", rationale: "Fixture", eventIds: [event.id], quotes: [{ eventId: event.id, text: "冲突事实" }] }],
        coverage: [{ eventId: event.id, ...Object.fromEntries(["memory", "knowledge", "continuity", "innerlife"].map(domain => [domain, { status: domain === "memory" ? "planned" : "none", reason: "Fixture", operations: domain === "memory" ? [0] : [] }])) }] }),
      prepare: async () => { writes++; return {}; }, apply: async () => { writes++; return { status: "completed" }; } });
    const receipt = await service.submit({ paths: { dataRoot: root } }, {}, { agentId: "codex", conversationId: "omitted" }, { submissionId: "crowded", events: [event], allowModel: true, execute: true, grants: { memory: true } });
    assert.equal(receipt.items[0].code, "recall_candidates_need_review"); assert.equal(writes, 0);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
  console.log(JSON.stringify({ suite: "understanding-recall", tailAndAllEventsCovered: true, provenanceLookup: true, sharedObjects: true, domainFailuresVisible: true }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
