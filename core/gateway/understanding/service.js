const { journal, hash, failure } = require("./journal");
const { DOMAINS, SYSTEM, normalizeInput, validatePlan } = require("./planner");
const { recallEvents } = require("./recall");
const { assessLineSelection, scopePlannedLine } = require("./line-selection");

function ownerKey(caller) {
  if (!caller.agentId || !caller.conversationId) throw failure("conversation_identity_required");
  return JSON.stringify([caller.agentId, caller.clientId || "", caller.conversationId]);
}
function targetRef(op) {
  if (op.detailRef) return op.detailRef;
  const prepared = op.prepared;
  if (!prepared) return null;
  if (prepared.lineId) return { tool: "shared_line_get", arguments: { lineId: prepared.lineId } };
  if (prepared.existingId) return { tool: "memoria_get", arguments: { id: prepared.existingId } };
  const reference = prepared.existingReference || (prepared.draft?.path ? `${prepared.draft.path}#evidence` : "");
  return reference ? { tool: "knowledge_read", arguments: { action: "read", reference } } : null;
}
function receipt(state) {
  const items = (state.plan?.operations || []).map((op, index) => ({ index, kind: op.kind, domain: op.domain, eventIds: op.eventIds,
    rationale: op.rationale, status: op.status || "planned", code: op.code || null, reference: op.reference || null,
    detailRef: targetRef(op) }));
  const pendingCoverage = state.lineSelectionError || state.plan?.coverage.some(row => DOMAINS.some(domain => row[domain].status === "pending"));
  const incomplete = items.some(item => !["completed", "unchanged"].includes(item.status));
  const successful = items.some(item => ["completed", "unchanged", "partial"].includes(item.status));
  const status = !state.plan ? state.planningStatus : incomplete || pendingCoverage ? (successful ? "partial" : state.executed ? "needs_review" : "planned") : state.executed ? "completed" : "planned";
  return { contract: "understanding-v1", submissionId: state.submissionId, status, planningStatus: state.planningStatus,
    planner: state.planner, items, coverage: state.plan?.coverage || [],
    contextIssues: state.lineSelectionError ? [{ domain: "continuity", code: state.lineSelectionError }] : [],
    ...(state.lineSelection ? { lineSelection: state.lineSelection } : {}),
    planRef: { tool: "understanding_resume", arguments: { submissionId: state.submissionId, detail: "plan" } },
    recoveryRef: { tool: "understanding_resume", arguments: { submissionId: state.submissionId, execute: true } },
    hostDelivery: "unknown", used: "unknown", atomicAcrossDomains: false };
}

function createUnderstandingService(ports) {
  async function context(core, app, caller, input = {}) {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query || Buffer.byteLength(query) > 1500) throw failure("bounded_query_required");
    const settled = await Promise.allSettled([
      ports.lines(core, caller, input), ports.memories(core, query), ports.knowledge(core, app, query, { mode: input.knowledgeMode || "hybrid" }),
      input.reviewShares === true ? ports.share(core, caller, query, input.lineId) : Promise.resolve({ status: "not_collected", items: [] })
    ]);
    const packet = { contract: "understanding-v1", query, domains: {}, unresolved: [], hostDelivery: "unknown", used: "unknown" };
    for (let index = 0; index < settled.length; index++) {
      const domain = ["continuity", "memory", "knowledge", "innerlife"][index];
      const outcome = settled[index];
      packet.domains[domain] = outcome.status === "fulfilled" ? outcome.value : { status: "failed", code: outcome.reason?.code || `${domain}_failed`, items: [] };
    }
    packet.unresolved = packet.domains.continuity.unresolved || [];
    if (input.allowModel === true && !input.lineId && packet.domains.continuity.status === "selection_required" && ports.matchLine) {
      const catalog = packet.domains.continuity;
      try {
        const selection = await ports.matchLine(core, query, catalog);
        if (!selection) catalog.selectionStatus = "model_unavailable";
        else {
          const issue = assessLineSelection(selection, catalog);
          if (issue) { catalog.selectionStatus = issue; catalog.selection = selection; }
          else if (selection.decision === "reuse") {
            const selected = await ports.lines(core, caller, { lineId: selection.lineId });
            if (selected.revision !== catalog.candidates.find(line => line.id === selection.lineId).revision) catalog.selectionStatus = "conflict";
            else packet.domains.continuity = { ...selected, selection };
          } else { catalog.status = "none"; catalog.selectionStatus = "no_matching_objective"; catalog.selection = selection; }
        }
      } catch (error) { catalog.selectionStatus = error.code || "line_matching_failed"; }
    }
    // Domain adapters project bounded previews with explicit detail references.
    const maxBytes = input.lineLimit > 10 ? 64 * 1024 : 24 * 1024;
    packet.budget = { maxBytes, explicitCatalogExpansion: input.lineLimit > 10 };
    if (Buffer.byteLength(JSON.stringify(packet)) > maxBytes) throw failure("understanding_context_over_budget");
    return packet;
  }

  async function plan(core, app, caller, state, store) {
    if (!state.input.allowModel) {
      state.planningStatus = "model_permission_required";
      store.write(state); return;
    }
    // Freeze the selected position BEFORE semantic judgment, not after a slow
    // model call that may race another writer's progress.
    if (ports.captureRevision) {
      try {
        state.selectedLineRevision = await ports.captureRevision(core, caller, state.input);
        delete state.lineSelectionError;
      } catch (error) {
        state.selectedLineRevision = null;
        state.lineSelectionError = error.code || "line_selection_failed";
      }
      store.write(state);
    }
    try {
      const existing = await recallEvents(core, app, caller, state.input, ports);
      state.recall = { events: existing.events, note: existing.note };
      store.write(state);
      const output = await ports.generate(core, { system: SYSTEM, prompt: JSON.stringify({ events: state.input.events, selectedLineId: state.input.lineId, existing }), timeoutMs: 30000 });
      if (!output) { state.planningStatus = "model_unavailable"; store.write(state); return; }
      state.plan = validatePlan(output, state.input);
      scopePlannedLine(state, existing.continuity);
      for (const op of state.plan.operations) {
        const denied = gate(state, op);
        if (denied) { op.status = "blocked"; op.code = denied; }
      }
      state.planningStatus = "planned";
      state.planner = { owner: "gateway", engine: "existing_configured_chat_model", validation: "structural_and_exact_quotes", semanticQuality: "not_independently_verified" };
      // Persist the semantic decision before preparing or mutating any domain.
      store.write(state);
    } catch (error) {
      state.planningStatus = error.code || "planner_failed";
      state.planner = { owner: "gateway", status: "failed", automaticFallback: false };
      store.write(state);
    }
    if (state.planningStatus === "planned") {
      // Freeze domain preconditions in the reviewable plan, not at the later
      // approval/execution time. Material dependencies resolve after their item.
      for (const [index, op] of state.plan.operations.entries()) {
        if (op.status === "blocked" || op.kind === "material") continue;
        try { op.prepared = await ports.prepare(core, app, caller, state, op, hash([store.key, index])); }
        catch (error) { op.status = "needs_review"; op.code = error.code || "preparation_failed"; }
        store.write(state);
      }
    }
  }

  function gate(state, op) {
    if (!state.input.grants[op.domain]) return "authorization_required";
    if (["memory", "knowledge"].includes(op.kind) && !(op.kind === "memory" && op.existingId)
      && state.recall?.events.some(event => op.eventIds.includes(event.eventId) && event.domains[op.domain]?.omittedReferences.length)) return "recall_candidates_need_review";
    if (op.domain === "continuity" && state.lineSelectionError) return state.lineSelectionError;
    if (["memory", "line_create", "line_archive"].includes(op.kind) || op.certainty === "confirmed") {
      if (op.certainty !== "confirmed" || !op.quotes.some(q => state.input.events.find(e => e.id === q.eventId)?.speaker === "user")) return "confirmed_user_evidence_required";
    }
    if (op.kind === "line_create" && !state.input.grants.createLine) return "line_creation_authorization_required";
    if (op.kind === "line_archive" && (!state.input.grants.archiveLine || !op.completed)) return "objective_completion_evidence_required";
    if (op.kind === "position" && (!(state.input.lineId || state.resolvedLineId) || op.lineId !== (state.input.lineId || state.resolvedLineId))) return "exact_line_selection_required";
    if (op.kind === "line_archive" && (!state.input.lineId || op.lineId !== state.input.lineId)) return "exact_line_selection_required";
    if (op.kind === "line_create" && state.lineSelection && state.lineSelection.decision !== "new") return "line_selection_required";
    if (op.kind === "knowledge" && !state.input.events.some(e => op.eventIds.includes(e.id) && e.sourceRef === op.sourceRef)) return "source_reference_required";
    return null;
  }

  async function execute(core, app, caller, state, store) {
    if (!state.plan) return;
    state.executed = true; store.write(state);
    for (const [index, op] of state.plan.operations.entries()) {
      if (["completed", "unchanged", "partial", "needs_review"].includes(op.status)) continue;
      const denied = gate(state, op);
      if (denied) { op.status = "blocked"; op.code = denied; store.write(state); continue; }
      const operationKey = hash([store.key, index]);
      try {
        if (!op.prepared) {
          op.prepared = await ports.prepare(core, app, caller, state, op, operationKey);
          store.write(state);
        }
        // A running item after a crash is reconciled by its domain adapter,
        // never assumed absent and blindly appended again.
        op.status = "running"; delete op.code; store.write(state);
        const result = await ports.apply(core, app, caller, state, op, operationKey);
        if (!["completed", "unchanged", "partial"].includes(result?.status)) throw failure("invalid_domain_receipt");
        Object.assign(op, result); store.write(state);
      } catch (error) {
        op.status = ["conflict", "recovery_needs_review", "line_selection_required", "SHARED_LINE_CONFIRM_OVERWRITE_REQUIRED"].includes(error.code) ? "needs_review" : "failed";
        op.code = error.code || "domain_operation_failed";
        store.write(state);
      }
    }
  }

  return {
    context,
    async submit(core, app, caller, input) {
      const normalized = normalizeInput(input);
      const owner = ownerKey(caller);
      const store = journal(core.paths.dataRoot, owner, normalized.submissionId);
      return store.locked(async () => {
        let state = store.read();
        const fingerprint = hash(normalized);
        if (state && state.fingerprint !== fingerprint) throw failure("submission_id_conflict");
        if (!state) {
          state = { schema: 1, owner, submissionId: normalized.submissionId, fingerprint, input: normalized, planningStatus: "pending", createdAt: new Date().toISOString() };
          store.write(state);
          await plan(core, app, caller, state, store);
        }
        if (input.execute === true) await execute(core, app, caller, state, store);
        return receipt(state);
      });
    },
    async resume(core, app, caller, input) {
      if (typeof input.submissionId !== "string" || !input.submissionId || input.submissionId.length > 160) throw failure("submission_id_required");
      const store = journal(core.paths.dataRoot, ownerKey(caller), input.submissionId);
      return store.locked(async () => {
        const state = store.read();
        if (!state) throw failure("submission_not_found");
        if (input.replan === true && !state.plan) await plan(core, app, caller, state, store);
        if (input.execute === true) await execute(core, app, caller, state, store);
        const plan = state.plan ? { ...state.plan, operations: state.plan.operations.map(op => {
          const { prepared, ...fields } = op;
          return { ...fields, detailRef: targetRef(op) };
        }),
          evidence: state.input.events.map(({ id, speaker, sourceRef }) => ({ id, speaker, sourceRef })), grants: state.input.grants,
          lineId: state.input.lineId, recall: state.recall || null } : null;
        if (input.detail === "plan") {
          const { items, coverage, ...summary } = receipt(state);
          return { ...summary, plan };
        }
        return receipt(state);
      });
    }
  };
}
module.exports = { createUnderstandingService, ownerKey, receipt };
