const { createMemoryController } = require("../../memory-controller/controller");

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
  if (!["off", "observe"].includes(configuredMode)) {
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
  const mode = configuredMode;
  if (mode === "off") {
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
    context: ""
  });
}

module.exports = {
  handleMemoryControllerTool
};
