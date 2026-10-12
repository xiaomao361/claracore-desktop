const { createMemoryController } = require("../../memory-controller/controller");
const { createHash } = require("crypto");
const { catalogInput } = require("../catalog-input");
const {
  MEMORY_CONTROLLER_MODES,
  canaryAllowsAgent,
  parseCanaryAgentIds
} = require("../../memory-controller/settings");

const controllers = new WeakMap();
const UNIDENTIFIED_AGENT_IDS = new Set(["", "unknown-agent", "http-agent"]);

function controllerFor(database) {
  let controller = controllers.get(database);
  if (!controller) {
    controller = createMemoryController({ database, mode: "observe" });
    controllers.set(database, controller);
  }
  return controller;
}

// The identity, mode, allowlist, timeView, and canary gates live here and
// nowhere else. Automatic turn context calls this same function rather than
// re-deriving eligibility, so there is exactly one place that can widen it.
async function runMemoryContext(args, context) {
  const { currentCallerContext, database } = context;
  const caller = currentCallerContext({});
  const agentId = String(caller?.agentId || "").trim();
  if (UNIDENTIFIED_AGENT_IDS.has(agentId)) {
    return ({
      decisionId: "",
      action: "NOOP",
      reason: "caller_identity_required",
      candidates: [],
      context: "",
      policyMode: "observe",
      resultStatus: "error"
    });
  }
  const settings = await database.getSettings();
  const configuredMode = String(settings["memory.controller.mode"] || "off").trim().toLowerCase();
  if (!MEMORY_CONTROLLER_MODES.includes(configuredMode)) {
    return ({
      decisionId: "",
      action: "NOOP",
      reason: "invalid_controller_mode",
      candidates: [],
      context: "",
      policyMode: configuredMode,
      resultStatus: "error"
    });
  }
  if (configuredMode === "off") {
    return ({
      decisionId: "",
      action: "NOOP",
      reason: "controller_disabled",
      candidates: [],
      context: "",
      policyMode: "off",
      resultStatus: "completed"
    });
  }
  const allowlist = parseCanaryAgentIds(settings["memory.controller.canary_agent_ids"]);
  if (configuredMode === "canary" && !allowlist.valid) {
    return ({
      decisionId: "",
      action: "NOOP",
      reason: "invalid_canary_allowlist",
      candidates: [],
      context: "",
      policyMode: "off",
      configuredMode,
      canaryEligible: false,
      resultStatus: "error"
    });
  }
  const requestedTimeView = String(args.timeView || "current").trim().toLowerCase();
  const canaryEligible = configuredMode === "canary"
    && canaryAllowsAgent(allowlist.agentIds, agentId)
    && requestedTimeView === "current";
  const mode = canaryEligible ? "canary" : "observe";
  const packet = await controllerFor(database).run({
    prompt: args.prompt,
    agentId,
    clientId: caller.clientId,
    conversationId: caller.conversationId,
    timeView: args.timeView,
    contextBudgetTokens: args.contextBudgetTokens,
    mode
  });
  return {
    ...packet,
    configuredMode,
    canaryEligible,
    context: canaryEligible ? packet.context : ""
  };
}

async function handleMemoryControllerTool(name, args, context) {
  if (name === "memory_context_feedback") {
    const caller = context.currentCallerContext({});
    if (UNIDENTIFIED_AGENT_IDS.has(String(caller?.agentId || "")) || !caller?.clientId) throw new Error("Feedback requires an identified caller and client.");
    if (typeof args.decisionId !== "string" || !args.decisionId.trim() || args.decisionId.length > 160) throw new Error("Feedback requires a bounded decisionId.");
    const event = await context.database.getMemoryControlEvent(args.decisionId);
    if (!event || event.agentId !== caller.agentId
      || (event.clientId || "") !== (caller.clientId || "")
      || (event.conversationId || "") !== (caller.conversationId || "")) {
      throw new Error("Memory decision not found for this caller.");
    }
    if (args.action === "inspect") {
      const { limit, offset } = catalogInput(args);
      const feedback = await context.database.listMemoryControlFeedback({ decisionId: event.id, limit, offset });
      return context.textResult({
        decisionId: event.id, resultStatus: event.resultStatus, policyMode: event.policyMode,
        preparedMemoryIds: event.injectedIds, feedback,
        page: { limit, offset, returned: feedback.length, total: event.feedbackCount, hasMore: offset + feedback.length < event.feedbackCount,
          ...(offset + feedback.length < event.feedbackCount ? { nextRead: { tool: "memory_context_feedback", arguments: { action: "inspect", decisionId: event.id, limit, offset: offset + feedback.length } } } : {}) },
        note: "These are explicit observations. Missing feedback means unknown; a completed decision does not prove delivery, use or task success."
      });
    }
    if (args.action && args.action !== "record") throw new Error("Memory feedback action must be record or inspect.");
    if (args.limit !== undefined || args.offset !== undefined) throw new Error("Feedback page arguments require action=inspect.");
    const allowedTypes = ["delivered", "used", "ignored", "wrong", "corrected", "outcome_unknown"];
    if (!allowedTypes.includes(args.feedbackType)) throw new Error("Invalid Memory feedback type.");
    const evidenceExcerpt = typeof args.evidenceExcerpt === "string" ? args.evidenceExcerpt.trim() : "";
    if (!evidenceExcerpt || evidenceExcerpt.length > 500) throw new Error("Feedback requires a bounded observable evidence excerpt (1–500 characters).");
    if (args.responseId !== undefined && (typeof args.responseId !== "string" || args.responseId.length > 160)) {
      throw new Error("Feedback responseId must be a bounded string.");
    }
    const reportsDelivery = ["delivered", "used"].includes(args.feedbackType);
    let memoryIds = args.memoryIds ?? (reportsDelivery ? event.injectedIds : []);
    const candidates = new Set((event.candidates || []).map((item) => item.id));
    if (!Array.isArray(memoryIds) || memoryIds.length > 3 || memoryIds.some((id) => !candidates.has(id))) {
      throw new Error("Feedback memoryIds must name up to three candidates from this decision.");
    }
    memoryIds = [...new Set(memoryIds)].sort();
    if (reportsDelivery && (event.policyMode !== "canary" || event.resultStatus !== "completed" || !["INJECT_TOP1", "INJECT_TOPK"].includes(event.stageB?.action) || !event.injectedIds?.length)) {
      throw new Error("An observe-only or abstained decision cannot be reported as delivered or used.");
    }
    if (reportsDelivery && (!memoryIds.length || memoryIds.some((id) => !event.injectedIds.includes(id)))) {
      throw new Error("Delivered or used feedback must identify prepared Memory context from this decision.");
    }
    const idempotencyKey = createHash("sha256").update(JSON.stringify([
      caller.agentId, caller.clientId, event.id, args.feedbackType,
      args.responseId || "", memoryIds, evidenceExcerpt
    ])).digest("hex");
    const feedback = await context.database.recordMemoryControlFeedback({
      decisionId: event.id, feedbackType: args.feedbackType,
      source: `gateway:${caller.clientId || caller.agentId}`,
      conversationId: caller.conversationId, responseId: args.responseId,
      memoryIds, evidenceExcerpt, idempotencyKey
    });
    return context.textResult({ feedback, note: "Explicit feedback only; delivery does not establish use or task success." });
  }
  if (name !== "memory_context") return undefined;
  return context.textResult(await runMemoryContext(args, context));
}

module.exports = {
  handleMemoryControllerTool,
  runMemoryContext
};
