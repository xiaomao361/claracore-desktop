const { createMemoryController } = require("../../memory-controller/controller");
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

async function handleMemoryControllerTool(name, args, context) {
  if (name !== "memory_context") return undefined;
  const { currentCallerContext, database, textResult } = context;
  const caller = currentCallerContext({});
  const agentId = String(caller?.agentId || "").trim();
  if (UNIDENTIFIED_AGENT_IDS.has(agentId)) {
    return textResult({
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
    return textResult({
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
    return textResult({
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
    return textResult({
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
  return textResult({
    ...packet,
    configuredMode,
    canaryEligible,
    context: canaryEligible ? packet.context : ""
  });
}

module.exports = {
  handleMemoryControllerTool
};
