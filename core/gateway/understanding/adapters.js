const memoria = require("../../memoria");
const continuity = require("../../continuity");
const innerlife = require("../../innerlife");
const { createMaterialReference, resolveMaterialReference } = require("../../innerlife/material-reference");
const { shapeSharedLinePacket } = require("../../continuity/resume-detail");
const { compactMemory } = require("../context");
const { boundedText } = require("../bounded-response");
const { searchKnowledge } = require("../../knowledge/search");
const { selectedRoot, previewKnowledgeIntake, commitKnowledgeIntake } = require("../../knowledge/intake");
const { readKnowledgeDocument, readKnowledgeSection } = require("../../knowledge/library");
const { sqlString } = require("../../db/helpers");
const { hash, failure } = require("./journal");
const { createUnderstandingService, ownerKey } = require("./service");
const { catalogRevision, validateLineSelection, READ_LINE_SYSTEM } = require("./line-selection");

const positionRevision = position => hash([position.summary, position.interpretationStatus, position.factsUsed || [], position.metadata || {}]);
async function readPosition(core, lineId) {
  const current = await core.database.getCurrentPosition(lineId);
  // A line with no position has SQL LEFT JOIN nulls. Only that known empty
  // shape is normalized; malformed persisted positions remain visible errors.
  if (current.positionId === "position_default" && !current.summary) return { ...current, factsUsed: [], metadata: {} };
  if (!Array.isArray(current.factsUsed) || !current.metadata || typeof current.metadata !== "object") throw failure("invalid_current_position");
  return current;
}
async function selectedLine(core, caller, lineId, allowArchived = false) {
  const line = await core.database.getContinuityLine(lineId);
  if (!line || line.agentId !== caller.agentId || (!allowArchived && line.status !== "active")) throw failure("line_not_available_to_caller");
  return line;
}
async function lines(core, caller, input) {
  if (input.lineId) {
    await selectedLine(core, caller, input.lineId);
    const packet = await continuity.get(core, { lineId: input.lineId, lite: true });
    return { status: "selected", selected: shapeSharedLinePacket(packet, "resume"), revision: positionRevision(packet.currentPosition), unresolved: [
      packet.sharedReality?.provisionalRead && { kind: "provisional", body: boundedText(packet.sharedReality.provisionalRead, 600), reference: input.lineId },
      packet.sharedReality?.misreadRisks && { kind: "question", body: boundedText(packet.sharedReality.misreadRisks, 600), reference: input.lineId }
    ].filter(Boolean) };
  }
  const limit = input.lineLimit === undefined ? 10 : input.lineLimit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw failure("invalid_line_limit");
  const page = await continuity.listSummaries(core, { agentId: caller.agentId, status: "active", limit });
  const candidates = await Promise.all(page.items.filter(line => line.id !== "line_default").map(async line => {
    const position = await readPosition(core, line.id);
    if (position.summary !== line.summary || position.interpretationStatus !== line.interpretationStatus) throw failure("line_catalog_changed");
    return { id: line.id, title: boundedText(line.title, 240), summary: boundedText(line.summary, 400), revision: positionRevision(position),
      detailRef: { tool: "shared_line_get", arguments: { lineId: line.id } } };
  }));
  return { status: candidates.length ? "selection_required" : "none", candidates, total: page.total, hasMore: page.total > page.items.length,
    note: "No global fallback, activation or creation. Select an exact matching objective; ordinary questions may have no line." };
}

async function prepare(core, app, caller, state, op, key) {
  if (op.kind === "memory") {
    if (op.existingId) {
      const memory = await memoria.get(core, op.existingId);
      if (!memory || memory.status !== "active" || memory.sensitivity !== "normal" || memory.body !== op.body) throw failure("conflict");
      return { existingId: memory.id };
    }
    const matches = await core.database.query(`SELECT id FROM memories WHERE body = ${sqlString(op.body)} AND status = 'active' AND sensitivity = 'normal' LIMIT 1;`);
    return matches.length ? { existingId: matches[0].id } : { source: `understanding:${key}` };
  }
  if (op.kind === "knowledge") {
    const attribution = { source: "source_statement", provisional: "agent_synthesis", confirmed: "user_stated" }[op.certainty];
    if (op.attribution !== attribution || !/^\d{4}-\d{2}-\d{2}$/u.test(op.date || "")) throw failure("knowledge_attribution_required");
    if (op.certainty === "confirmed" && !op.quotes.some(q => state.input.events.find(e => e.id === q.eventId)?.speaker === "user")) throw failure("confirmed_user_evidence_required");
    const root = await selectedRoot(app);
    const matches = await searchKnowledge(app, { query: op.sourceRef, mode: "exact", limit: 10 }, {});
    for (const item of matches.items || []) {
      const section = readKnowledgeSection(root, item.reference);
      const attributionLabel = { source_statement: "来源陈述", agent_synthesis: "Agent 提炼", user_stated: "用户明确表达" }[op.attribution];
      if (section.text.includes(`来源：${op.sourceRef}\n`) && section.text.includes(`归属：${attributionLabel}\n`)
        && section.text.endsWith(`\n\n${op.body}`)) return { rootHash: hash(root), existingReference: item.reference, sectionRevision: hash(section.text) };
    }
    if (matches.hasMore) throw failure("knowledge_deduplication_needs_review");
    // Deterministic new file: a retry cannot append a second section or overwrite
    // an existing note. Broader append/edit operations remain explicit tools.
    const draft = { mode: "create", path: `notes/understanding-${key}.md`, title: op.title || "Shared reference",
      sections: [{ anchor: "evidence", heading: op.title || "Evidence", body: op.body, source: op.sourceRef, date: op.date, attribution: op.attribution }] };
    const kbId = `desktop-understanding-${key}`;
    const preview = await previewKnowledgeIntake(app, draft, ownerKey(caller), { kbId });
    return { rootHash: hash(root), draft, kbId, token: preview.token, addition: preview.addition, revision: hash(preview.addition) };
  }
  if (op.kind === "line_create") {
    if (state.input.lineId) throw failure("line_selection_required");
    const candidates = await lines(core, caller, { lineLimit: 50 });
    const revision = catalogRevision(candidates);
    if (candidates.hasMore || (candidates.candidates.length && (state.lineSelection?.decision !== "new" || state.lineCatalogRevision !== revision))) throw failure("line_selection_required");
    if (state.lineCatalogRevision && state.lineCatalogRevision !== revision) throw failure("conflict");
    if (!op.title) throw failure("line_title_required");
    return { lineId: `line_understanding_${key}`, catalogRevision: revision, candidateIds: candidates.candidates.map(line => line.id) };
  }
  if (["position", "line_archive"].includes(op.kind)) {
    await selectedLine(core, caller, op.lineId);
    const revision = positionRevision(await readPosition(core, op.lineId));
    if (state.selectedLineRevision && state.selectedLineRevision !== revision) throw failure("conflict");
    return { lineId: op.lineId, baseRevision: revision };
  }
  if (op.kind === "material") {
    const dependency = /^operation:([0-9]+)$/u.exec(op.existingId || "");
    if (dependency) {
      const item = state.plan.operations[Number(dependency[1])];
      if (item === op || !item || !["completed", "unchanged", "partial"].includes(item.status) || !item.reference) throw failure("dependency_pending");
      return { reference: item.reference, materialReference: await createMaterialReference(core, app, caller.agentId, item.reference) };
    }
    if (!state.input.events.some(e => op.eventIds.includes(e.id) && e.sourceRef === op.sourceRef)) throw failure("source_reference_required");
    return { reference: op.sourceRef, materialReference: await createMaterialReference(core, app, caller.agentId, op.sourceRef) };
  }
  throw failure("unsupported_understanding_operation");
}

async function apply(core, app, caller, state, op, key) {
  const prepared = op.prepared;
  if (op.kind === "memory") {
    if (prepared.existingId) {
      const current = await memoria.get(core, prepared.existingId);
      if (!current || current.body !== op.body || current.status !== "active" || current.sensitivity !== "normal") throw failure("conflict");
      return { status: "unchanged", reference: current.id, detailRef: { tool: "memoria_get", arguments: { id: current.id } } };
    }
    const rows = await core.database.query(`SELECT id, body, status FROM memories WHERE id IN (SELECT memory_id FROM memory_labels WHERE label = ${sqlString(prepared.source)}) LIMIT 2;`);
    if (rows.length > 1 || (rows.length && (rows[0].body !== op.body || rows[0].status !== "active"))) throw failure("recovery_needs_review");
    // The source marker is inserted with the record in the same SQLite script.
    // A pre-marker crash is detected by exact body below, never duplicated.
    const exact = rows[0] || (await core.database.query(`SELECT id FROM memories WHERE body = ${sqlString(op.body)} AND status = 'active' AND sensitivity = 'normal' LIMIT 1;`))[0];
    const memory = exact || await memoria.create(core, { body: op.body, title: op.title || "", agentId: caller.agentId, sensitivity: "normal", source: prepared.source, labels: [prepared.source] });
    if (exact) await core.database.markMemoryEmbeddingPending(memory.id);
    return { status: "completed", reference: memory.id, detailRef: { tool: "memoria_get", arguments: { id: memory.id } } };
  }
  if (op.kind === "knowledge") {
    const root = await selectedRoot(app);
    if (hash(root) !== prepared.rootHash) throw failure("conflict");
    if (prepared.existingReference) {
      const section = readKnowledgeSection(root, prepared.existingReference);
      if (hash(section.text) !== prepared.sectionRevision) throw failure("conflict");
      return { status: "unchanged", reference: prepared.existingReference, detailRef: { tool: "knowledge_read", arguments: { action: "read", reference: prepared.existingReference } } };
    }
    let document;
    try { document = readKnowledgeDocument(root, prepared.draft.path); }
    catch (error) { if (error.code !== "missing_file" && error.code !== "ENOENT") throw error; }
    const reference = `${prepared.draft.path}#evidence`;
    const detailRef = { tool: "knowledge_read", arguments: { action: "read", reference } };
    if (document) {
      if (hash(document.text) !== prepared.revision) throw failure("recovery_needs_review");
      // A missing acknowledgment cannot establish whether index update finished.
      return { status: "partial", code: "write_recovered_index_unverified", reference, detailRef };
    }
    let token = prepared.token;
    let result;
    try { result = await commitKnowledgeIntake(app, token, ownerKey(caller)); }
    catch (error) {
      if (error.code !== "preview_expired") throw error;
      const preview = await previewKnowledgeIntake(app, prepared.draft, ownerKey(caller), { kbId: prepared.kbId });
      // Recovery regenerates precisely the planned bytes, including kb_id.
      if (preview.addition !== prepared.addition) throw failure("recovery_needs_review");
      token = preview.token;
      result = await commitKnowledgeIntake(app, token, ownerKey(caller));
    }
    if (result.write !== "saved") throw failure("knowledge_write_unverified");
    return { status: result.status === "saved" ? "completed" : "partial", ...(result.status === "partial" ? { code: "knowledge_index_or_links_partial" } : {}), reference, detailRef };
  }
  if (["position", "line_create", "line_archive"].includes(op.kind)) {
    const lineId = prepared.lineId;
    if (op.kind === "line_create") {
      const existing = await core.database.getContinuityLine(lineId);
      if (existing && (existing.title !== op.title || existing.agentId !== caller.agentId)) throw failure("conflict");
      if (!existing) {
        const candidates = await lines(core, caller, { lineLimit: 50 });
        if (candidates.hasMore || catalogRevision(candidates) !== prepared.catalogRevision) throw failure("conflict");
        await continuity.create(core, { id: lineId, agentId: caller.agentId, title: op.title, makeActive: false, expectedActiveLineIds: prepared.candidateIds }, { lite: true });
      }
    }
    const line = await selectedLine(core, caller, lineId, op.kind === "line_archive");
    const source = `understanding:${key}`;
    const history = await core.database.query(`SELECT id FROM continuity_position_history WHERE line_id = ${sqlString(lineId)} AND source = ${sqlString(source)} LIMIT 1;`);
    const current = await readPosition(core, lineId);
    if (!history.length) {
      if (line.status !== "active" || current.factsUsed.includes(source)) throw failure("recovery_needs_review");
      if (op.kind === "line_create" && current.summary) throw failure("conflict");
      if (prepared.baseRevision && positionRevision(current) !== prepared.baseRevision) throw failure("conflict");
      await continuity.save(core, { lineId, agentId: caller.agentId, summary: op.body,
        interpretationStatus: op.certainty === "confirmed" ? "confirmed" : "needs_review",
        ...(op.nextStep !== undefined ? { nextStep: op.nextStep } : op.kind === "line_archive" ? { nextStep: "" } : {}),
        factsUsed: [...new Set([...current.factsUsed, source, ...op.eventIds.map(id => state.input.events.find(e => e.id === id).sourceRef),
          ...state.plan.operations.map(item => item.reference).filter(Boolean)])], source, expectedPosition: current, confirmOverwrite: state.input.grants.overwriteConfirmed }, { lite: true });
    }
    if (op.kind === "line_archive" && line.status !== "archived") {
      // Do not archive over progress saved by another writer after our snapshot.
      const latest = await core.database.getCurrentPosition(lineId);
      if (!latest.factsUsed.includes(source) || latest.summary !== op.body) throw failure("conflict");
      await continuity.archive(core, lineId, { lite: true, expectedPosition: latest });
    }
    return { status: "completed", reference: lineId, detailRef: { tool: "shared_line_get", arguments: { lineId } } };
  }
  if (op.kind === "material") {
    if (!prepared.materialReference) throw failure("legacy_material_reference_needs_review");
    await resolveMaterialReference(core, app, prepared.materialReference, caller.agentId);
    const rows = await core.database.query(`SELECT id FROM innerlife_inbox WHERE agent_id = ${sqlString(caller.agentId)} AND json_extract(metadata_json, '$.understandingOperation') = ${sqlString(key)} LIMIT 1;`);
    const inbox = rows[0] || await innerlife.submitInbox(core, { agentId: caller.agentId, source: "shared_understanding", body: `Material reference: ${prepared.reference}`,
      metadata: { understandingOperation: key, reference: prepared.reference, materialReference: prepared.materialReference,
        submissionId: state.submissionId, evidenceState: "collected_not_delivered" } });
    return { status: "completed", reference: inbox.id, detailRef: { tool: "innerlife_status", arguments: { detail: "full", section: "inbox", recordId: inbox.id } } };
  }
  throw failure("unsupported_understanding_operation");
}

const service = createUnderstandingService({
  lines, prepare, apply,
  matchLine: async (core, query, catalog) => {
    const raw = await core.database.innerLifeGenerate({ system: READ_LINE_SYSTEM, prompt: JSON.stringify({ query, catalog }), timeoutMs: 30000 });
    if (!raw) return null;
    if (Buffer.byteLength(raw) > 6000) throw failure("invalid_line_selection");
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw failure("invalid_line_selection"); }
    const selection = validateLineSelection(parsed, [{ id: "query", text: query }]);
    if (selection.decision === "new") throw failure("read_cannot_create_line");
    return selection;
  },
  captureRevision: async (core, caller, input) => {
    if (!input.lineId) return null;
    await selectedLine(core, caller, input.lineId);
    return positionRevision(await readPosition(core, input.lineId));
  },
  memories: async (core, query) => {
    const result = await memoria.search(core, { query, limit: 3 });
    const items = Array.isArray(result) ? result : result.results;
    if (!Array.isArray(items)) throw failure("invalid_memory_search_result");
    return { status: result.error ? "partial" : "ok", ...(result.error ? { code: "memory_semantic_unavailable" } : {}),
      items: items.slice(0, 3).map(memory => ({ ...compactMemory(memory, 600), evidenceState: "stored_fact_confirmation_not_reverified" })), hasMore: items.length >= 3 };
  },
  knowledge: async (core, app, query, options = {}) => {
    const mode = options.mode || "hybrid";
    if (!["exact", "hybrid"].includes(mode)) throw failure("invalid_knowledge_mode");
    const result = await searchKnowledge(app, { query, mode, limit: 3 }, mode === "exact" ? {} : await core.database.getSettings());
    return { status: result.status, ...(result.semanticError ? { code: result.semanticError.code || result.semanticError } : {}), items: (result.items || []).slice(0, 3).map(item => ({ reference: item.reference, preview: boundedText(item.preview, 600), source: boundedText(item.source, 400), date: item.date,
      contentRole: "source_material_not_user_belief", detailRef: item.detailRef })), hasMore: result.hasMore, note: "Local hybrid recall preserves explicit semantic/index failures. A miss does not establish absence or semantic uniqueness." };
  },
  share: async (core, caller, query, lineId) => {
    const result = await innerlife.checkShareTiming(core, { agentId: caller.agentId, context: query, ...(lineId ? { lineId } : {}) });
    const share = result.share;
    const eligible = ["approved", "deferred"].includes(share?.status) && result.check?.decision === "use";
    return { status: eligible ? "selected_for_review" : "withheld", items: eligible ? [{ id: share.id, preview: boundedText(share.body, 600), evidenceState: "selected_not_delivered", detailRef: { tool: "innerlife_share_check", arguments: { shareId: share.id, context: query } } }] : [], note: "Caller still reviews conversational register; no delivery/use mark is written." };
  },
  generate: (core, input) => core.database.innerLifeGenerate(input)
});
module.exports = { service, prepare, apply, lines, positionRevision };
