const { knowledgeToolDefinitions } = require("./tool-definitions/knowledge");
const { understandingToolDefinitions } = require("./tool-definitions/understanding");
const { systemToolDefinitions } = require("./tool-definitions/system");
const { memoryControllerToolDefinitions } = require("./tool-definitions/memory-controller");
const { memoriaToolDefinitions } = require("./tool-definitions/memoria");
const { sharedLineToolDefinitions } = require("./tool-definitions/shared-line");
const { innerlifeToolDefinitions } = require("./tool-definitions/innerlife");

function toolDefinitions() {
  return [
    ...understandingToolDefinitions,
    ...systemToolDefinitions,
    ...knowledgeToolDefinitions,
    ...memoryControllerToolDefinitions,
    ...memoriaToolDefinitions,
    ...sharedLineToolDefinitions,
    ...innerlifeToolDefinitions
  ];
}

module.exports = {
  toolDefinitions
};
