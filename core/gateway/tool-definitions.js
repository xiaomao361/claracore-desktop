const { systemToolDefinitions } = require("./tool-definitions/system");
const { memoriaToolDefinitions } = require("./tool-definitions/memoria");
const { sharedLineToolDefinitions } = require("./tool-definitions/shared-line");
const { innerlifeToolDefinitions } = require("./tool-definitions/innerlife");

function toolDefinitions() {
  return [
    ...systemToolDefinitions,
    ...memoriaToolDefinitions,
    ...sharedLineToolDefinitions,
    ...innerlifeToolDefinitions
  ];
}

module.exports = {
  toolDefinitions
};
