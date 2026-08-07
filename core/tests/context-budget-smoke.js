const assert = require("assert");
const {
  CORE_TOOL_NAMES,
  DEFAULT_PROFILE,
  normalizeProfile,
  profileToolDefinitions
} = require("../gateway/tool-profiles");
const { toolDefinitions } = require("../gateway/tool-definitions");
const { DOCS_SECTIONS, buildGatewayDocs } = require("../gateway/docs");
const { ambiguousSharedLineError } = require("../db/helpers");
const memoria = require("../memoria");
const { shapeSharedLinePacket } = require("../continuity/resume-detail");
const {
  SHARE_CANDIDATE_LIMIT,
  shapeInnerLifeBriefing,
  shapeInnerLifeStatus,
  shapePendingShares
} = require("../innerlife/selective");
const { CONTEXT_BUDGET_CEILINGS } = require("./fixtures/context-budget-ceilings");
const {
  AMBIGUOUS_LINE_COUNT,
  ambiguousLines,
  gatewayLaunchFixture,
  innerLifeBriefingFixture,
  innerLifeSharesFixture,
  innerLifeSnapshotLiteFixture,
  memorySearchCore,
  memorySearchRows,
  pathsFixture,
  sharedLinePacketFixture
} = require("./fixtures/context-budget-fixtures");
const { createGatewayContextService } = require("../gateway/context");
const {
  AUTO_CONTEXT_HARD_LIMIT_BYTES,
  AUTO_CONTEXT_HARD_LIMIT_TOKENS,
  AUTO_CONTEXT_TARGET_TOKENS,
  arbitrateAutomaticContext
} = require("../gateway/auto-context");
const { collect } = require("../../scripts/context-budget-baseline");

function bytes(value) {
  return Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value), "utf8");
}

function assertWithin(label, value, ceiling) {
  const size = bytes(value);
  assert.ok(size <= ceiling, `${label} is ${size} bytes, over the ${ceiling}-byte ceiling.`);
}

function checkProfileResolution() {
  assert.strictEqual(DEFAULT_PROFILE, "core", "The default tool profile must be core.");
  for (const input of ["", null, undefined, "FULL-ish", "admin", "core ", "  ", 42, {}]) {
    const resolved = normalizeProfile(input);
    assert.ok(
      resolved === "core" || resolved === "full",
      `Profile resolution must stay inside the maintained set, got ${resolved}.`
    );
  }
  // Only an explicit, valid selection may broaden the surface.
  assert.strictEqual(normalizeProfile("admin"), "core", "An invalid profile must fail closed to core.");
  assert.strictEqual(normalizeProfile(""), "core", "A missing profile must fail closed to core.");
  assert.strictEqual(normalizeProfile("FULL"), "full", "A valid profile must be accepted case-insensitively.");
}

function checkCoreProfile() {
  const core = profileToolDefinitions("core");
  assert.strictEqual(core.length, CORE_TOOL_NAMES.length);
  assert.ok(
    core.length <= CONTEXT_BUDGET_CEILINGS.coreToolCount,
    `core exposes ${core.length} tools, over the ${CONTEXT_BUDGET_CEILINGS.coreToolCount} ceiling.`
  );
  assertWithin("core tools/list", core, CONTEXT_BUDGET_CEILINGS.coreToolsList);

  for (const tool of core) {
    assert.ok(tool.name && tool.description, `Core tool ${tool.name} must keep a name and description.`);
    assert.strictEqual(tool.inputSchema?.type, "object", `Core tool ${tool.name} must keep an object schema.`);
  }

  // Deprecated contract names must not survive in what an Agent reads.
  for (const tool of profileToolDefinitions("full")) {
    assert.ok(
      !/\blite\b/i.test(JSON.stringify(tool)),
      `Tool ${tool.name} still advertises the deprecated "lite" contract name.`
    );
  }

  // The core manifest advertises fewer arguments, but handlers are shared and
  // Gateway input is not schema-validated, so every core tool must still be a
  // real tool with an unchanged handler contract.
  const canonical = new Map(toolDefinitions().map((tool) => [tool.name, tool]));
  for (const tool of core) {
    const source = canonical.get(tool.name);
    assert.ok(source, `Core tool ${tool.name} must exist in the canonical manifest.`);
    const advertised = Object.keys(tool.inputSchema.properties || {});
    const supported = Object.keys(source.inputSchema.properties || {});
    for (const property of advertised) {
      assert.ok(supported.includes(property), `Core tool ${tool.name} advertises unknown property ${property}.`);
    }
    for (const required of tool.inputSchema.required || []) {
      assert.ok(advertised.includes(required), `Core tool ${tool.name} requires unadvertised property ${required}.`);
    }
  }
}

// The core profile was first picked by asking "does this tool sound like
// maintenance", which put memoria_supersede in full — while the first-party
// Agent instructions name it as the everyday remedy for a stale fact. It failed
// silently: nothing broke until a closeout actually needed it. These pairs are
// the check that classification did not drift from what the Agent is told to do.
const CORE_WORKFLOW_PAIRS = Object.freeze([
  ["memoria_create", "memoria_supersede", "a confirmed replacement is create plus supersede"],
  ["memoria_link_create", "memoria_link_list", "reading a neighbourhood before adding to it"],
  ["memoria_record_create", "memoria_record_list", "writing a structured record implies reading them back"],
  ["innerlife_session_start", "innerlife_session_end", "a session that can start must be closable"],
  ["innerlife_share_check", "innerlife_mark_share", "checking a share implies reporting the outcome"]
]);

function checkCoreWorkflowsAreComplete() {
  const core = new Set(CORE_TOOL_NAMES);
  for (const [write, read, why] of CORE_WORKFLOW_PAIRS) {
    if (!core.has(write)) continue;
    assert.ok(
      core.has(read),
      `core advertises ${write} but not ${read} — ${why}. A half workflow fails silently: the Agent only finds out mid-task.`
    );
  }
}

function checkFullProfileUnchanged() {
  const full = profileToolDefinitions("full");
  const canonical = toolDefinitions();
  assert.strictEqual(full.length, canonical.length, "The full profile must expose every canonical tool.");
  assert.deepStrictEqual(
    full.map((tool) => tool.name).sort(),
    canonical.map((tool) => tool.name).sort(),
    "The full profile must preserve all existing tool names."
  );
  assert.deepStrictEqual(full, canonical, "The full profile must preserve canonical schemas byte-for-byte.");

  const coreNames = new Set(CORE_TOOL_NAMES);
  assert.ok(
    canonical.some((tool) => !coreNames.has(tool.name)),
    "The core profile must actually be smaller than the full manifest."
  );
}

function checkDocs() {
  const args = { launch: gatewayLaunchFixture, paths: pathsFixture, toolProfile: "core" };
  const fallback = buildGatewayDocs(args);
  assert.strictEqual(fallback.section, "default");
  assertWithin("gateway_docs default", fallback.text, CONTEXT_BUDGET_CEILINGS.docsDefault);

  for (const section of DOCS_SECTIONS) {
    const result = buildGatewayDocs({ ...args, section });
    assert.strictEqual(result.section, section);
    assertWithin(
      `gateway_docs section=${section}`,
      result.text,
      section === "full" ? CONTEXT_BUDGET_CEILINGS.docsFullSection : CONTEXT_BUDGET_CEILINGS.docsSection
    );
    assert.ok(result.text.trim().length > 0, `Section ${section} must return content.`);
    // A truncated docs section silently drops guidance. Bound the content, do
    // not cut it.
    assert.ok(
      !result.text.includes("[truncated"),
      `Section ${section} was truncated; raise its bound or trim the source instead.`
    );
  }

  assert.throws(() => buildGatewayDocs({ ...args, section: "everything" }), /section must be one of/);

  assert.ok(!fallback.text.includes("[truncated"), "Default docs must not be truncated.");

  // The changed v0.6.6 defaults must be stated where an Agent actually reads.
  for (const phrase of ["memoria_search", "shared_line_get", "innerlife_status", "detail=full"]) {
    assert.ok(fallback.text.includes(phrase), `Default docs must state the changed default for ${phrase}.`);
  }

  // Default docs may name a tool to state its default, but must never restate
  // the manifest. The invariant is the descriptions, not the names.
  const canonicalTools = toolDefinitions();
  for (const tool of canonicalTools) {
    assert.ok(
      !fallback.text.includes(tool.description),
      `Default docs restate the ${tool.name} description; tools/list is the manifest, not this guide.`
    );
  }
  const manifestBytes = bytes(canonicalTools);
  assert.ok(
    bytes(fallback.text) * 10 < manifestBytes,
    `Default docs are ${bytes(fallback.text)} bytes against a ${manifestBytes}-byte manifest; they should be an order of magnitude smaller.`
  );

  // Onboarding safety statements must survive the trim.
  for (const phrase of ["Do not mutate SQLite directly", "MCP tools are the product contract"]) {
    assert.ok(fallback.text.includes(phrase), `Default docs must keep the safety statement: ${phrase}`);
  }
  // One startup sequence, stated once, not contradicted per section.
  assert.ok(fallback.text.includes("claracore_connection_test"), "Default docs must state the startup sequence.");
}

function checkAmbiguityPayload() {
  // Drive the real builder rather than a reimplementation.
  const lines = ambiguousLines();
  const error = ambiguousSharedLineError("fixture-agent", lines);

  assert.strictEqual(error.code, "SHARED_LINE_ID_REQUIRED");
  assert.strictEqual(error.totalCount, AMBIGUOUS_LINE_COUNT, "The refusal must report the true total count.");
  // The candidate query is capped, so the caller passes the real count. Without
  // this the field reported the page size and quietly lied above the cap.
  const cappedPage = lines.slice(0, 20);
  const capped = ambiguousSharedLineError("fixture-agent", cappedPage, 23);
  assert.strictEqual(capped.totalCount, 23, "totalCount must be the caller's true count, not the page size.");
  assert.ok(/has 23 active Shared Lines/.test(capped.message), "The refusal message must state the true total.");
  assert.ok(/\+18 more/.test(capped.message), "The omitted count must follow the true total.");
  assert.ok(
    error.candidates.length <= CONTEXT_BUDGET_CEILINGS.ambiguityCandidateLimit,
    `Ambiguity returned ${error.candidates.length} candidates, over the ${CONTEXT_BUDGET_CEILINGS.ambiguityCandidateLimit} limit.`
  );
  assert.ok(error.detailRef?.tool === "shared_line_list", "The refusal must reference the full catalog explicitly.");

  for (const candidate of error.candidates) {
    assert.deepStrictEqual(
      Object.keys(candidate).sort(),
      ["lineId", "status", "summaryPreview", "title", "updatedAt"],
      "Ambiguity candidates must expose only the documented bounded fields."
    );
    assertWithin("ambiguity candidate preview", candidate.summaryPreview, CONTEXT_BUDGET_CEILINGS.ambiguityCandidatePreview);
  }

  const payload = {
    error: "shared_line_id_required",
    code: error.code,
    message: error.message,
    agentId: error.agentId,
    candidates: error.candidates,
    candidateCount: error.candidateCount,
    totalCount: error.totalCount,
    detailRef: error.detailRef
  };
  assertWithin("shared line ambiguity payload", payload, CONTEXT_BUDGET_CEILINGS.ambiguityPayload);

  // A refusal is a refusal: it must not guess a line.
  assert.ok(!("lineId" in error), "The ambiguity refusal must not select a line.");
  assert.ok(/nothing was read or written/i.test(error.message), "The refusal must say no write occurred.");
}

const EMBEDDING_OPERATIONAL_FIELDS = [
  "embedding_provider",
  "embedding_model",
  "embedding_dimension",
  "embedding_error",
  "embedded_at",
  "embedding_status"
];

async function checkMemorySummarySearch() {
  const core = memorySearchCore(12);

  const result = await memoria.searchSummary(core, { query: "fixture recall" });
  assert.strictEqual(result.detail, "summary", "memoria_search must default to summary detail.");
  assert.strictEqual(result.results.length, 3, "memoria_search must default to three results.");
  assert.strictEqual(result.resultPage.appliedLimit, 3);
  assertWithin("memoria_search default", result, CONTEXT_BUDGET_CEILINGS.memoriaSearchDefault);

  const serialized = JSON.stringify(result);
  for (const field of EMBEDDING_OPERATIONAL_FIELDS) {
    assert.ok(!serialized.includes(field), `Ordinary search must not expose embedding metadata field ${field}.`);
  }
  assert.ok(!("related" in result), "Related records must be omitted from the default search payload.");
  assert.ok(result.relatedRef?.tool, "Related records must remain explicitly retrievable.");

  for (const entry of result.results) {
    assert.ok(
      Buffer.byteLength(entry.bodyPreview, "utf8") <= 1200,
      `Body preview is ${Buffer.byteLength(entry.bodyPreview, "utf8")} bytes, over the 1200-byte bound.`
    );
    assert.strictEqual(entry.detailRef.tool, "memoria_get", "Every summary must reference the full-record path.");
    assert.ok(entry.stateRole, "Temporal state role must survive summarization.");
  }

  // Top result and temporal semantics must match the pre-change result.
  const full = await memoria.search(core, { query: "fixture recall", limit: 3 });
  assert.strictEqual(result.results[0].id, full.results[0].id, "Summarization must not reorder results.");
  assert.strictEqual(result.timeView, full.timeView);
  assert.strictEqual(result.mode, full.mode);
  for (const [index, entry] of result.results.entries()) {
    assert.strictEqual(entry.stateRole, full.results[index].stateRole);
    assert.deepStrictEqual(entry.supersedes, full.results[index].supersedes);
    assert.deepStrictEqual(entry.supersededBy, full.results[index].supersededBy);
  }

  // detail=full recovers everything the default intentionally removed.
  const detailed = await memoria.searchSummary(core, { query: "fixture recall", detail: "full", limit: 3 });
  assert.strictEqual(detailed.detail, "full");
  assert.ok(Array.isArray(detailed.related), "detail=full must restore related records.");
  assert.strictEqual(detailed.results[0].body, full.results[0].body, "detail=full must restore whole bodies.");

  // The explicit override is bounded, not unlimited.
  const capped = await memoria.searchSummary(core, { query: "fixture recall", limit: 500 });
  assert.strictEqual(capped.resultPage.appliedLimit, memoria.SUMMARY_SEARCH_MAX_LIMIT);
  assert.strictEqual(capped.resultPage.requestCapped, true);
  assert.ok(capped.results.length <= memoria.SUMMARY_SEARCH_MAX_LIMIT);

  assert.rejects(
    () => memoria.searchSummary(core, { query: "fixture recall", detail: "everything" }),
    /detail must be summary or full/
  );
}

function checkSharedLineResume() {
  const stored = sharedLinePacketFixture();

  const resume = shapeSharedLinePacket(stored);
  assert.strictEqual(resume.detail, "resume", "shared_line_get must default to the resume packet.");
  assertWithin("shared_line_get resume", resume, CONTEXT_BUDGET_CEILINGS.sharedLineGetDefault);

  // The resume packet must carry everything needed to continue work.
  for (const field of ["lineId", "lineTitle", "summary", "interpretationStatus", "factsUsed", "nextStep", "updatedAt"]) {
    assert.ok(field in resume, `Resume packet lost the continuation field ${field}.`);
  }
  assert.ok(resume.summary.length > 0, "Resume must keep the current position summary.");
  assert.ok(resume.recentHandoff, "Resume must keep at most one recent handoff when one exists.");
  assert.strictEqual(resume.recentHandoff.id, stored.handoffs[0].id);

  // And nothing that belongs to an explicit detail read.
  for (const field of [
    "agentState",
    "agentStates",
    "modelAdjustment",
    "snapshots",
    "positionHistory",
    "affectiveTrace",
    "history",
    "handoffs",
    "text",
    "lines",
    "archivedLines"
  ]) {
    assert.ok(!(field in resume), `Resume packet must not carry ${field}.`);
  }
  assert.ok(!JSON.stringify(resume).includes("privateFullMetadata"), "Resume must not leak raw position metadata.");

  // Two unrelated lines must not repeat the same Agent-level state.
  const otherResume = shapeSharedLinePacket(sharedLinePacketFixture("line_fixture_beta"));
  const agentStateMarkers = ["communicationStyle", "relationshipPosition", "boundaries", "stablePatterns"];
  for (const marker of agentStateMarkers) {
    assert.ok(!JSON.stringify(resume).includes(marker), `Line packet repeats Agent-level ${marker}.`);
    assert.ok(!JSON.stringify(otherResume).includes(marker), `Line packet repeats Agent-level ${marker}.`);
  }
  assert.strictEqual(resume.omitted.agentState, "shared_line_agent_state", "Agent state must stay explicitly reachable.");
  assert.strictEqual(resume.omitted.positionHistory, 30, "Resume must report the true arc size it omitted.");
  assert.strictEqual(resume.omitted.affectiveTrace, 30);

  // context adds only non-empty relevant Shared Reality.
  const context = shapeSharedLinePacket(stored, "context");
  assertWithin("shared_line_get context", context, CONTEXT_BUDGET_CEILINGS.sharedLineGetContext);
  assert.ok(context.sharedReality, "context detail must add Shared Reality.");
  for (const [key, value] of Object.entries(context.sharedReality)) {
    assert.ok(
      typeof value === "boolean" || String(value).trim().length > 0,
      `context Shared Reality must omit empty field ${key}.`
    );
  }
  for (const empty of ["entryPosture", "provisionalRead", "boundaryNotes", "misreadRisks"]) {
    assert.ok(!(empty in context.sharedReality), `context must not carry empty Shared Reality field ${empty}.`);
  }
  assert.ok(!("agentState" in context), "context detail must still exclude Agent-level state.");

  // full restores the stored packet, unchanged and unmutated.
  const full = shapeSharedLinePacket(stored, "full");
  assert.strictEqual(full.detail, "full");
  for (const field of ["agentState", "agentStates", "snapshots", "history", "handoffs", "positionHistory", "affectiveTrace", "text"]) {
    assert.ok(field in full, `detail=full lost ${field}.`);
  }
  assert.deepStrictEqual(full.agentState, stored.agentState, "detail=full must return stored Agent state unchanged.");
  assert.deepStrictEqual(
    stored,
    sharedLinePacketFixture(),
    "Shaping must not mutate the stored packet; removing agentState from a default read never deletes it."
  );

  // Model adjustment is a model-scoped read.
  assert.ok(!("modelAdjustment" in resume), "Model adjustment must not ride along by default.");
  const withModel = shapeSharedLinePacket(stored, "resume", { model: "fixture-model" });
  assert.ok(withModel.modelAdjustment, "An explicitly requested model must return its adjustment.");

  assert.throws(() => shapeSharedLinePacket(stored, "everything"), /detail must be one of/);
}


function checkInnerLifeSelective() {
  const snapshot = innerLifeSnapshotLiteFixture();
  const status = shapeInnerLifeStatus(snapshot);
  assertWithin("innerlife_status default", status, CONTEXT_BUDGET_CEILINGS.innerlifeStatusDefault);
  assert.strictEqual(status.detail, "summary");

  // The old `lite` contract is deprecated explicitly, not silently reused.
  // `mode` is stated by the shape rather than inherited from the read model,
  // and the boolean argument stays a documented alias for the named level.
  assert.strictEqual(status.mode, "status", "The default status read must not still report mode=lite.");
  assert.strictEqual(shapeInnerLifeStatus(snapshot, "full").mode, "full");
  assert.strictEqual(shapeInnerLifeStatus(snapshot, true).detail, "full", "detail=true must alias the full level.");
  assert.strictEqual(shapeInnerLifeStatus(snapshot, false).detail, "summary");
  assert.strictEqual(shapeInnerLifeStatus(snapshot, "summary").detail, "summary");
  assert.throws(() => shapeInnerLifeStatus(snapshot, "lite"), /detail must be one of/, "lite must not resolve as a detail level.");
  for (const shape of [status, shapeInnerLifeStatus(snapshot, "full")]) {
    assert.notStrictEqual(shape.mode, "lite", "No InnerLife status shape may still report the pre-0.6.6 lite mode.");
  }

  // Operational state only: no share catalog, no Inbox bodies.
  assert.ok(!("pendingShares" in status), "Default status must not return a share catalog.");
  assert.ok(!("pendingInbox" in status), "Default status must not return Inbox bodies.");
  const statusText = JSON.stringify(status);
  for (const share of snapshot.pendingShares.slice(0, 3)) {
    assert.ok(!statusText.includes(share.body), "Default status leaked a share body.");
  }
  for (const item of snapshot.pendingInbox) {
    assert.ok(!statusText.includes(item.body), "Default status leaked an Inbox body.");
  }
  // But the indicators must be truthful.
  assert.strictEqual(status.work.hasPendingShares, true);
  assert.strictEqual(status.work.pendingShareCount, snapshot.counts.pending_shares_count);
  assert.strictEqual(status.work.hasPendingInbox, true);
  assert.strictEqual(status.work.pendingInboxCount, snapshot.counts.pending_inbox_count);
  assert.strictEqual(status.doctor.issueCount, snapshot.doctor.issues.length);
  assert.ok(status.doctor.issues.length < snapshot.doctor.issues.length, "Doctor issues must be bounded.");
  assert.ok(status.detailRefs.full.arguments.detail === true, "Full snapshot must stay explicitly reachable.");

  // detail=true still returns everything.
  const fullStatus = shapeInnerLifeStatus(snapshot, true);
  assert.strictEqual(fullStatus.detail, "full");
  assert.deepStrictEqual(fullStatus.pendingInbox, snapshot.pendingInbox);
  assert.deepStrictEqual(fullStatus.pendingShares, snapshot.pendingShares);

  // Candidates are previews, three by default, and reading them marks nothing.
  const shares = innerLifeSharesFixture();
  const candidates = shapePendingShares(shares);
  assertWithin("innerlife_pending_shares default", candidates, CONTEXT_BUDGET_CEILINGS.innerlifePendingSharesDefault);
  assert.strictEqual(candidates.shares.length, SHARE_CANDIDATE_LIMIT);
  assert.strictEqual(candidates.totalPending, shares.length, "Candidate list must report the true pending total.");
  for (const candidate of candidates.shares) {
    assert.strictEqual(candidate.status, "pending", "Listing must not change a share status.");
    assert.ok(
      Buffer.byteLength(candidate.preview, "utf8") <= 320,
      "Candidate preview must stay bounded."
    );
    const source = shares.find((share) => share.id === candidate.id);
    assert.ok(candidate.preview.length < source.body.length, "Listing must not return the full share body.");
  }
  assert.deepStrictEqual(shares, innerLifeSharesFixture(), "Shaping candidates must not mutate the stored shares.");
  assert.deepStrictEqual(
    shapePendingShares(shares, "full").shares,
    shares,
    "detail=full must recover the whole share bodies."
  );

  // The briefing is one decision, not an aggregate dump.
  const stored = innerLifeBriefingFixture();
  const briefing = shapeInnerLifeBriefing(stored);
  assertWithin("innerlife_briefing default", briefing, CONTEXT_BUDGET_CEILINGS.innerlifeBriefingDefault);
  assert.ok(briefing.sharedLine?.lineId, "An unambiguous line must appear in the briefing.");
  assert.ok(briefing.selectedShare, "The briefing may carry at most one candidate preview.");
  assert.ok(!Array.isArray(briefing.pendingShares), "The briefing must not return the full share list.");
  assert.ok(!Array.isArray(briefing.pendingInbox), "The briefing must not return Inbox bodies.");
  assert.ok(!("text" in briefing), "The briefing must not carry a parallel text block.");
  assert.ok(briefing.recentMemories.length <= 2, "The briefing must not return five full Memories.");
  assert.strictEqual(briefing.counts.pendingShares, stored.pendingShares.length, "Counts must stay truthful.");
  assert.strictEqual(briefing.counts.pendingInbox, stored.pendingInbox.length);

  // No exact body appears twice in one briefing.
  const bodies = [
    ...briefing.openLoops.map((loop) => loop.preview),
    ...(briefing.selectedShare ? [briefing.selectedShare.preview] : []),
    ...briefing.recentMemories.map((memory) => memory.preview)
  ].map((value) => value.trim());
  assert.strictEqual(new Set(bodies).size, bodies.length, "The same body must not appear twice in one briefing.");
  // The fixture's first three thoughts duplicate share bodies; they must be gone.
  assert.strictEqual(briefing.openLoops.length, 2, "Thought bodies duplicating shares must be dropped.");
  for (const loop of briefing.openLoops) {
    assert.ok(/^unique-/.test(loop.preview), `Duplicate thought body survived: ${loop.preview.slice(0, 40)}`);
  }

  // An ambiguous line stays an explicit safe result: no line is guessed.
  const ambiguous = shapeInnerLifeBriefing(innerLifeBriefingFixture({ ambiguous: true }));
  assert.ok(!("sharedLine" in ambiguous), "An ambiguous briefing must not select a line.");
  assert.strictEqual(ambiguous.sharedLineContext.status, "ambiguous");
  assert.strictEqual(ambiguous.sharedLineContext.candidateCount, 3);

  // detail=full recovers the whole aggregate.
  const fullBriefing = shapeInnerLifeBriefing(stored, "full");
  assert.strictEqual(fullBriefing.detail, "full");
  assert.deepStrictEqual(fullBriefing.pendingShares, stored.pendingShares);
  assert.deepStrictEqual(fullBriefing.recentThoughts, stored.recentThoughts);
  assert.deepStrictEqual(stored, innerLifeBriefingFixture(), "Shaping must not mutate the stored briefing.");
}


function aggregateContextService() {
  const snapshot = innerLifeSnapshotLiteFixture();
  const briefing = innerLifeBriefingFixture();
  return createGatewayContextService({
    getSharedLine: async () => sharedLinePacketFixture(),
    searchMemories: async (unusedCore, input) => ({ results: memorySearchRows(input.limit) }),
    listMemories: async (unusedCore, input) => memorySearchRows(input.limit),
    getInnerLifeSnapshot: async () => snapshot,
    listInnerLifeInbox: async () => snapshot.pendingInbox,
    listInnerLifeShares: async () => snapshot.pendingShares,
    listInnerLifeThoughts: async () => briefing.recentThoughts,
    now: () => new Date("2026-08-07T01:32:46.786Z")
  });
}

// innerlife_session_start is the packet a host hook actually injects at the top
// of every session, so it must carry the same bounded contracts as the
// individual tools rather than the stored payloads.
function checkSessionStartPacket() {
  const briefing = innerLifeBriefingFixture();
  const line = sharedLinePacketFixture();

  const shapedBriefing = shapeInnerLifeBriefing(briefing);
  const shapedLine = shapeSharedLinePacket(line, "resume");
  assertWithin("session_start briefing", shapedBriefing, CONTEXT_BUDGET_CEILINGS.innerlifeBriefingDefault);
  assertWithin("session_start shared_line", shapedLine, CONTEXT_BUDGET_CEILINGS.sharedLineGetDefault);

  const injected = { briefing: shapedBriefing, shared_line: shapedLine };
  assertWithin("session_start injected context", injected, CONTEXT_BUDGET_CEILINGS.sessionStartInjection);

  // The unshaped stored payloads are what this replaces.
  assert.ok(
    bytes(injected) * 5 < bytes({ briefing, shared_line: line }),
    "Session start must inject a materially smaller packet than the stored payloads."
  );
  assert.ok(!("agentState" in shapedLine), "Session start must not inject Agent-level state per line.");
  assert.ok(!("text" in shapedBriefing), "Session start must not inject a parallel briefing text block.");
}

async function checkAggregateContext() {
  const service = aggregateContextService();
  const snapshot = innerLifeSnapshotLiteFixture();

  const withQuery = await service.get({}, { agentId: "fixture-agent", detail: "brief", query: "fixture" });
  const noQuery = await service.get({}, { agentId: "fixture-agent", detail: "brief" });

  // Query and no-query paths meet the same ceiling.
  for (const [label, packet] of [["query", withQuery], ["no query", noQuery]]) {
    assertWithin(`gateway_context brief (${label})`, packet, CONTEXT_BUDGET_CEILINGS.gatewayContextBrief);
  }

  // It composes the new default contracts, not a second larger copy.
  assert.strictEqual(withQuery.sharedLine.detail, "resume", "brief must embed the Shared Line resume packet.");
  assert.ok(!("agentState" in withQuery.sharedLine), "brief must not carry Agent-level state.");
  assert.ok(withQuery.memories.length <= 3, "brief must carry at most three Memory summaries.");
  assert.ok(withQuery.innerLife.work, "brief must carry InnerLife status indicators.");
  assert.ok(withQuery.innerLife.pendingShares.length <= 1, "brief must carry at most one candidate preview.");
  assert.ok(!("pendingInbox" in withQuery.innerLife), "brief must not carry Inbox bodies.");

  // One canonical representation: the text field is a summary, not a copy.
  const structuredBytes = bytes({ ...withQuery, text: undefined });
  assert.ok(
    bytes(withQuery.text) * 4 < structuredBytes,
    `brief text is ${bytes(withQuery.text)} bytes against ${structuredBytes} structured; it should be a summary, not a second copy.`
  );
  for (const memory of withQuery.memories) {
    assert.ok(!withQuery.text.includes(memory.bodyPreview), "brief text must not repeat Memory bodies.");
  }
  for (const share of withQuery.innerLife.pendingShares) {
    assert.ok(!withQuery.text.includes(share.preview), "brief text must not repeat share previews.");
  }
  assert.ok(!withQuery.text.includes(withQuery.sharedLine.summary), "brief text must not repeat the line summary.");

  // Identity is preserved and no cross-Agent content enters the packet.
  assert.strictEqual(withQuery.agentId, "fixture-agent");
  assert.strictEqual(withQuery.sharedLine.agentId, "fixture-agent");
  for (const share of withQuery.innerLife.pendingShares) {
    assert.strictEqual(share.agentId, "fixture-agent", "brief must not include cross-Agent shares.");
  }
  const crossAgent = await aggregateContextService().get({}, { agentId: "other-agent", detail: "brief" });
  assert.strictEqual(crossAgent.innerLife.pendingShares.length, 0, "Another Agent must not receive these shares.");
  assert.strictEqual(
    crossAgent.innerLife.work.hasPendingShares,
    false,
    "Cross-Agent indicators must be scoped to the caller."
  );

  // detail=full remains explicit and is not the startup path.
  const full = await service.get({}, { agentId: "fixture-agent", detail: "full" });
  assert.strictEqual(full.detail, "full");
  assert.ok(bytes(full) > bytes(withQuery), "detail=full must remain the larger compatibility payload.");
  assert.deepStrictEqual(
    snapshot,
    innerLifeSnapshotLiteFixture(),
    "Composing context must not mutate the stored snapshot."
  );
}


function checkAutomaticArbiter() {
  const memoryHit = {
    id: "mem_auto_win",
    agentId: "clara",
    action: "INJECT_TOP1",
    policyMode: "canary",
    stateRole: "current",
    sensitivity: "normal",
    relevance: 0.9,
    context: "A relevant durable fact."
  };
  const shareHit = {
    id: "inner_share_auto",
    agentId: "clara",
    status: "pending",
    selected: true,
    relevance: 0.8,
    preview: "A share whose timing gate opened."
  };

  // At most one block per turn: a Memory hit prevents a second InnerLife block.
  const both = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: [memoryHit],
    shareCandidates: [shareHit]
  });
  assert.strictEqual(both.decision, "deliver_one");
  assert.strictEqual(both.selected.domain, "memory", "The stronger candidate must win the single slot.");
  assert.strictEqual(both.suppressed.length, 1, "The losing candidate must be suppressed, not stacked.");
  assert.strictEqual(both.suppressed[0].reason, "one_winner_per_turn");
  assert.ok(both.block, "A winning turn must carry exactly one block.");
  assert.ok(
    both.block.bytes <= AUTO_CONTEXT_HARD_LIMIT_BYTES,
    `Automatic block is ${both.block.bytes} bytes, over the ${AUTO_CONTEXT_HARD_LIMIT_TOKENS}-token hard limit.`
  );
  assert.strictEqual(both.budget.targetTokens, AUTO_CONTEXT_TARGET_TOKENS);
  assert.strictEqual(both.budget.hardLimitTokens, AUTO_CONTEXT_HARD_LIMIT_TOKENS);

  // Selection is not delivery and not use.
  assert.strictEqual(both.selected.evidenceState, "selected");
  const serialized = JSON.stringify(both);
  assert.ok(!/"(delivered|used)"\s*:/.test(serialized), "The arbiter must not claim delivery or use.");
  for (const state of ["selected", "delivered", "used", "ignored", "wrong", "corrected", "unknown"]) {
    assert.ok(both.evidenceStates.includes(state), `Evidence state ${state} must stay distinct.`);
  }

  // Ordinary prompts abstain cleanly.
  const empty = arbitrateAutomaticContext({ agentId: "clara" });
  assert.strictEqual(empty.decision, "abstain");
  assert.strictEqual(empty.block, null);
  assert.strictEqual(empty.reason, "no_eligible_candidate");

  // Invalid, restricted, historical, cross-Agent, and weak candidates are
  // discarded with a recorded reason and never delivered.
  const rejected = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: [
      { ...memoryHit, id: "m_restricted", sensitivity: "restricted" },
      { ...memoryHit, id: "m_historical", stateRole: "historical" },
      { ...memoryHit, id: "m_cross", agentId: "lara" },
      { ...memoryHit, id: "m_weak", relevance: 0.1 },
      { ...memoryHit, id: "m_observe", policyMode: "observe" },
      { ...memoryHit, id: "m_abstain", action: "ABSTAIN" }
    ],
    shareCandidates: [
      { ...shareHit, id: "s_used", status: "used" },
      { ...shareHit, id: "s_cross", agentId: "lara" },
      { ...shareHit, id: "s_not_selected", selected: false }
    ]
  });
  assert.strictEqual(rejected.decision, "abstain", "No eligible candidate must mean abstain, not a fallback pick.");
  const reasons = Object.fromEntries(rejected.candidates.map((entry) => [entry.id, entry.discardReason]));
  assert.strictEqual(reasons.m_restricted, "restricted");
  assert.strictEqual(reasons.m_historical, "historical");
  assert.strictEqual(reasons.m_cross, "cross_agent");
  assert.strictEqual(reasons.m_weak, "weak_relevance");
  assert.strictEqual(reasons.m_observe, "controller_not_in_canary");
  assert.strictEqual(reasons.m_abstain, "controller_did_not_inject");
  assert.strictEqual(reasons.s_cross, "cross_agent");
  // An irrelevant timing candidate is rejected without being marked used.
  assert.strictEqual(reasons.s_not_selected, "share_check_did_not_select");
  assert.strictEqual(reasons.s_used, "not_pending", "An already-used share must not re-enter arbitration.");
  assert.strictEqual(rejected.selected, null, "An abstain turn must select nothing.");
  for (const entry of rejected.candidates) {
    assert.ok(
      !("evidenceState" in entry),
      "Rejecting a timing candidate must not attach a delivery state to it."
    );
  }

  // An oversized winner is trimmed to the shared budget rather than blowing it.
  const huge = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: [{ ...memoryHit, context: "x".repeat(50000) }]
  });
  assert.strictEqual(huge.decision, "deliver_one");
  assert.strictEqual(huge.block.truncated, true);
  assert.ok(huge.block.bytes <= AUTO_CONTEXT_HARD_LIMIT_BYTES);

  // Urgency can let a share win, and the loser is still only suppressed.
  const urgent = arbitrateAutomaticContext({
    agentId: "clara",
    memoryCandidates: [memoryHit],
    shareCandidates: [{ ...shareHit, urgency: 2 }]
  });
  assert.strictEqual(urgent.selected.domain, "innerlife");
  assert.strictEqual(urgent.suppressed[0].domain, "memory");
}

// The measurement contract in the plan is itself testable: the baseline must
// report each field family, not only totals, or a future regression can pass
// its ceiling while quietly moving cost between families.
const REQUIRED_BREAKDOWNS = Object.freeze({
  "memoria_search default": ["resultCount", "bodyBytes", "metadataBytes", "relatedBytes"],
  "shared_line_get resume": [
    "currentPosition",
    "sharedReality",
    "agentState",
    "history",
    "snapshot",
    "arc",
    "text"
  ],
  "shared_line_get full": [
    "currentPosition",
    "sharedReality",
    "agentState",
    "history",
    "snapshot",
    "arc",
    "text"
  ],
  "innerlife_status default": ["profile", "shares", "inbox", "doctor", "counts"],
  "innerlife_briefing default": ["memories", "openLoops", "counts", "inbox", "text"],
  "innerlife_briefing detail=full": ["memories", "shares", "inbox", "thoughts", "text"],
  "automatic candidates offered": ["candidateCount"],
  "automatic selected": ["domain"],
  "automatic delivered block": ["truncated", "targetBytes"]
});

async function checkBaselineScript() {
  const report = await collect();
  assert.deepStrictEqual(report.failures, [], `Baseline reports surfaces over ceiling: ${report.failures.join(", ")}`);
  assert.ok(report.groups.toolProfiles.length >= 2, "Baseline must measure both profiles.");
  assert.ok(report.groups.docs.length >= DOCS_SECTIONS.length, "Baseline must measure every docs section.");
  const fullManifest = report.groups.toolProfiles.find((entry) => entry.name === "tools/list full");
  assert.strictEqual(fullManifest.ceiling, null, "Full-profile payloads must not share the normal-use ceiling.");

  // Every group the measurement contract names must be present.
  for (const group of ["toolProfiles", "docs", "errors", "memory", "sharedLine", "innerLife", "aggregate", "automatic"]) {
    assert.ok(report.groups[group]?.length, `Baseline is missing the ${group} group.`);
  }

  const byName = new Map(
    Object.values(report.groups)
      .flat()
      .map((entry) => [entry.name, entry])
  );
  for (const [name, fields] of Object.entries(REQUIRED_BREAKDOWNS)) {
    const entry = byName.get(name);
    assert.ok(entry, `Baseline is missing the measurement "${name}".`);
    assert.ok(entry.breakdown, `Baseline measurement "${name}" reports no per-family breakdown.`);
    for (const field of fields) {
      assert.ok(
        Object.hasOwn(entry.breakdown, field),
        `Baseline measurement "${name}" does not report the ${field} family.`
      );
    }
  }

  // Candidate, selected, and delivered are three separate measurements, and
  // the delivered block is the only one that shares the automatic budget.
  const delivered = byName.get("automatic delivered block");
  assert.strictEqual(
    delivered.ceiling,
    CONTEXT_BUDGET_CEILINGS.automaticContextHardLimitBytes,
    "The delivered automatic block must be measured against the hard limit."
  );
  assert.ok(
    delivered.bytes <= CONTEXT_BUDGET_CEILINGS.automaticContextTargetTokens * 4,
    `Automatic delivered block is ${delivered.bytes} bytes, over the ${CONTEXT_BUDGET_CEILINGS.automaticContextTargetTokens}-token target.`
  );
  assert.strictEqual(
    byName.get("automatic candidates offered").ceiling,
    null,
    "Offered candidates are diagnostic and must not share the delivery ceiling."
  );
}

async function main() {
  checkProfileResolution();
  checkCoreProfile();
  checkCoreWorkflowsAreComplete();
  checkFullProfileUnchanged();
  checkDocs();
  checkAmbiguityPayload();
  await checkMemorySummarySearch();
  checkSharedLineResume();
  checkInnerLifeSelective();
  checkSessionStartPacket();
  await checkAggregateContext();
  checkAutomaticArbiter();
  await checkBaselineScript();
  process.stdout.write("Context budget smoke passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
