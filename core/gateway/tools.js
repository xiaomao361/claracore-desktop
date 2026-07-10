const { toolDefinitions } = require("./tool-definitions");
const { handleSystemTool } = require("./tool-handlers/system");
const { handleMemoriaTool } = require("./tool-handlers/memoria");
const { handleSharedLineTool } = require("./tool-handlers/shared-line");
const { handleInnerLifeTool } = require("./tool-handlers/innerlife");

const HANDLERS = [handleSystemTool, handleMemoriaTool, handleSharedLineTool, handleInnerLifeTool];

function createGatewayTools({ serverInfo, currentMcpAgentId, currentCallerContext, gatewayLaunchConfig, runtimeAppForGateway, textResult }) {
  async function callToolBody(name, args = {}, paths, database) {
    const core = { paths, database };
    const context = {
      serverInfo,
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
    callToolBody
  };
}

module.exports = {
  createGatewayTools
};
