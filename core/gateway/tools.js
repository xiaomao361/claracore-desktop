const { createProfileToolDefinitions, normalizeProfile } = require("./tool-profiles");
const { handleSystemTool } = require("./tool-handlers/system");
const { handleMemoryControllerTool } = require("./tool-handlers/memory-controller");
const { handleMemoriaTool } = require("./tool-handlers/memoria");
const { handleSharedLineTool } = require("./tool-handlers/shared-line");
const { handleInnerLifeTool } = require("./tool-handlers/innerlife");

const HANDLERS = [handleSystemTool, handleMemoryControllerTool, handleMemoriaTool, handleSharedLineTool, handleInnerLifeTool];

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

    for (const handler of HANDLERS) {
      const result = await handler(name, args, context);
      if (result !== undefined) return result;
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  return {
    toolDefinitions,
    toolProfile: profile,
    callToolBody
  };
}

module.exports = {
  createGatewayTools
};
