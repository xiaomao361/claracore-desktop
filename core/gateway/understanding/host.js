const fs = require("node:fs");
const path = require("node:path");
const { journal, hash, failure } = require("./journal");
const { normalizeInput } = require("./planner");
const { ownerKey } = require("./service");

function toolPayload(result) {
  let value = result;
  if (Array.isArray(result?.content)) {
    try { value = JSON.parse(result.content.find(item => item.type === "text")?.text || ""); }
    catch { throw failure("understanding_contract_unavailable"); }
  }
  return value;
}
function parseReceipt(result, submissionId) {
  const value = toolPayload(result);
  if (value?.contract !== "understanding-v1" || value.submissionId !== submissionId) throw failure("invalid_host_receipt");
  return value;
}

// This opt-in adapter consumes real host events. It does not install hooks,
// scrape transcripts, invent user evidence, or infer an end from inactivity.
function createUnderstandingHost({ callTool, stateDirectory, caller, enabled = false, allowModel = false,
  grants = {}, capabilities = {}, lineId = "" }) {
  caller = Object.freeze({ ...caller });
  grants = Object.freeze({ ...grants });
  capabilities = Object.freeze({ ...capabilities });
  const owner = ownerKey(caller);
  if (typeof callTool !== "function" || !path.isAbsolute(stateDirectory || "")) throw failure("invalid_host_configuration");
  const root = path.join(stateDirectory, hash(owner));
  function idFor(turnId, checkpointId = "final") {
    if (typeof turnId !== "string" || !turnId || turnId.length > 160 || typeof checkpointId !== "string" || !checkpointId || checkpointId.length > 160) throw failure("stable_host_event_id_required");
    return `host-${hash([caller.conversationId, turnId, checkpointId])}`;
  }
  const recoveryRef = (turnId, checkpointId) => ({ method: "resume", turnId, checkpointId: checkpointId || "final" });
  async function deliver(store, state, resume, replan = false) {
    try {
      let result = await callTool(resume ? "understanding_resume" : "understanding_submit", resume
        ? { submissionId: state.submissionId, execute: true, ...(replan ? { replan: true } : {}) } : state.payload);
      if (resume && toolPayload(result)?.code === "submission_not_found") result = await callTool("understanding_submit", state.payload);
      const receipt = parseReceipt(result, state.submissionId);
      state.receipt = receipt;
      state.status = receipt.status === "completed" ? "completed" : "attention";
      delete state.code;
    } catch (error) {
      state.status = error.code === "understanding_contract_unavailable" ? "attention" : "pending";
      state.code = error.code || "transport_error";
    }
    store.write(state);
    return { status: state.status, submissionId: state.submissionId, ...(state.code ? { code: state.code } : {}),
      receipt: state.receipt || null, recoveryRef: recoveryRef(state.turnId, state.checkpointId), lineLifecycle: "unchanged_by_host" };
  }
  async function resumeKnown(turnId, checkpointId, replan = false) {
    if (!enabled) return { status: "disabled", calls: 0 };
    const submissionId = idFor(turnId, checkpointId);
    const store = journal(root, owner, submissionId);
    return store.locked(async () => {
      const state = store.read();
      if (!state || state.hostOutbox !== true) throw failure("host_checkpoint_not_found");
      if (state.status === "completed") return { status: "completed", submissionId, receipt: state.receipt, recoveryRef: recoveryRef(turnId, checkpointId) };
      return deliver(store, state, true, replan);
    });
  }
  return {
    async onEvent(event) {
      if (!enabled) return { status: "disabled", calls: 0 };
      if (event.turnKind === "goal_continuation") return { status: "skipped", reason: "non_user_goal_continuation", calls: 0 };
      if (event.kind === "turn_started") {
        const context = await callTool("understanding_context", { query: event.query, ...(event.lineId || lineId ? { lineId: event.lineId || lineId } : {}), allowModel });
        if (context?.isError || toolPayload(context)?.contract !== "understanding-v1") return { status: "attention", code: "context_unavailable", result: context, hostDelivery: "unknown", used: "unknown" };
        return { status: "context_prepared", result: context, hostDelivery: "unknown", used: "unknown" };
      }
      if (!["checkpoint", "turn_completed", "conversation_ended"].includes(event.kind)) throw failure("unsupported_host_event");
      if (event.kind === "conversation_ended" && capabilities.endCallback !== true) return { status: "unsupported", code: "end_callback_unavailable", lineLifecycle: "unchanged", calls: 0 };
      if (capabilities.rawEvidence !== true || capabilities.stableTurnIds !== true) return { status: "unsupported", code: "host_evidence_capability_missing", calls: 0 };
      if (event.kind === "conversation_ended" && (!event.events || !event.events.length)) return { status: "no_new_delta", lineLifecycle: "unchanged", note: "End does not complete or archive an objective. Incremental checkpoints remain authoritative." };
      if (event.kind === "checkpoint" && !event.checkpointId) throw failure("stable_checkpoint_id_required");
      const checkpointId = event.checkpointId || "final";
      const submissionId = idFor(event.turnId, checkpointId);
      // Authority belongs to the configured host boundary, not to message text
      // or event-supplied grants. The server still applies its evidence gates.
      const normalized = normalizeInput({ submissionId, events: event.events, allowModel, grants, lineId: event.lineId || lineId });
      const payload = { ...normalized, execute: true };
      const fingerprint = hash(normalized);
      const store = journal(root, owner, submissionId);
      return store.locked(async () => {
        let state = store.read();
        if (state && (state.hostOutbox !== true || state.fingerprint !== fingerprint)) throw failure("host_checkpoint_conflict");
        if (state?.status === "completed") return { status: "completed", submissionId, receipt: state.receipt, recoveryRef: recoveryRef(event.turnId, checkpointId) };
        const existed = Boolean(state);
        if (!state) {
          state = { schema: 1, owner, submissionId, hostOutbox: true, fingerprint, turnId: event.turnId, checkpointId, payload,
            status: "pending", createdAt: new Date().toISOString() };
          store.write(state);
        }
        return deliver(store, state, existed);
      });
    },
    resume: ({ turnId, checkpointId = "final", replan = false }) => resumeKnown(turnId, checkpointId, replan === true),
    async recoverPending({ offset = 0, limit = 10 } = {}) {
      if (!enabled) return { status: "disabled", calls: 0 };
      if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw failure("invalid_host_page");
      const directory = path.join(root, "gateway-understanding");
      let files;
      try { files = fs.readdirSync(directory).filter(file => /^[a-f0-9]{64}\.json$/u.test(file)).sort(); }
      catch (error) { if (error.code === "ENOENT") return { items: [], offset, limit, total: 0, hasMore: false }; throw error; }
      const items = [];
      for (const file of files.slice(offset, offset + limit)) {
        const target = path.join(directory, file);
        const stat = fs.lstatSync(target);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) throw failure("host_checkpoint_corrupt");
        const state = JSON.parse(fs.readFileSync(target, "utf8"));
        if (state.owner !== owner || !state.hostOutbox) throw failure("host_checkpoint_corrupt");
        if (state.status === "pending") items.push(await resumeKnown(state.turnId, state.checkpointId));
      }
      return { items, offset, limit, total: files.length, hasMore: offset + limit < files.length };
    },
    capabilities: { enabled, rawEvidence: capabilities.rawEvidence === true, stableTurnIds: capabilities.stableTurnIds === true,
      endCallback: capabilities.endCallback === true, installsConfiguration: false }
  };
}
module.exports = { createUnderstandingHost, parseReceipt };
