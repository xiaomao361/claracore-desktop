const { systemToolDefinitions } = require("./tool-definitions/system");
const { memoryControllerToolDefinitions } = require("./tool-definitions/memory-controller");
const { memoriaToolDefinitions } = require("./tool-definitions/memoria");
const { sharedLineToolDefinitions } = require("./tool-definitions/shared-line");
const { innerlifeToolDefinitions } = require("./tool-definitions/innerlife");

function toolDefinitions() {
  return [
    ...systemToolDefinitions,
    ...memoryControllerToolDefinitions,
    ...memoriaToolDefinitions,
    ...sharedLineToolDefinitions,
    ...innerlifeToolDefinitions
  ];
}

module.exports = {
  toolDefinitions
};
