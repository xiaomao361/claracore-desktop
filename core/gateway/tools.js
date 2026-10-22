const { handleKnowledgeTool } = require("./tool-handlers/knowledge");
const { handleUnderstandingTool } = require("./tool-handlers/understanding");
const { createProfileToolDefinitions, normalizeProfile } = require("./tool-profiles");
const { handleSystemTool } = require("./tool-handlers/system");
const { handleMemoryControllerTool } = require("./tool-handlers/memory-controller");
const { handleMemoriaTool } = require("./tool-handlers/memoria");
const { handleSharedLineTool } = require("./tool-handlers/shared-line");
const { handleInnerLifeTool } = require("./tool-handlers/innerlife");
const { callLegacyTool } = require("./tool-compatibility");
const { callableToolDefinitions } = require("./tool-definitions");

const HANDLERS = [handleUnderstandingTool, handleKnowledgeTool, handleSystemTool, handleMemoryControllerTool, handleMemoriaTool, handleSharedLineTool, handleInnerLifeTool];

function createGatewayTools({ serverInfo, currentMcpAgentId, currentCallerContext, gatewayLaunchConfig, runtimeAppForGateway, textResult, toolProfile }) {
  const profile = normalizeProfile(typeof toolProfile === "function" ? toolProfile() : toolProfile);
  const toolDefinitions = createProfileToolDefinitions(profile);

  async function callToolBody(name, args = {}, paths, database) {
    const core = { paths, database };
    const context = {
      serverInfo,
      toolProfile: profile,
      currentMcpAgentId,
      currentCallerContext: currentCallerContext || (() => ({ agentId: currentMcpAgentId({}) })),
      gatewayLaunchConfig,
      runtimeAppForGateway,
      textResult,
      toolDefinitions,
      paths,
      database,
      core
    };

    async function dispatch(toolName, input, project) {
      // Adapt legacy wire shapes before serialization/budget enforcement, so
      // compatibility does not parse and serialize the same result twice.
      const handlerContext = project ? { ...context, textResult: value => textResult(project(value)) } : context;
      for (const handler of HANDLERS) {
        const result = await handler(toolName, input, handlerContext);
        if (result !== undefined) return result;
      }
      throw new Error(`Unknown tool: ${toolName}`);
    }
    const legacy = await callLegacyTool(name, args, context, dispatch);
    return legacy === undefined ? dispatch(name, args) : legacy;
  }

  return {
    toolDefinitions,
    toolProfile: profile,
    callableToolDefinitions,
    callToolBody
  };
}

module.exports = {
  createGatewayTools
};
