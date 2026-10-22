const { knowledgeToolDefinitions } = require("./tool-definitions/knowledge");
const { understandingToolDefinitions } = require("./tool-definitions/understanding");
const { systemToolDefinitions } = require("./tool-definitions/system");
const { memoryControllerToolDefinitions } = require("./tool-definitions/memory-controller");
const { memoriaToolDefinitions } = require("./tool-definitions/memoria");
const { sharedLineToolDefinitions } = require("./tool-definitions/shared-line");
const { innerlifeToolDefinitions } = require("./tool-definitions/innerlife");
const legacyDefinitions = require("./tool-definitions/legacy.json");
const { LEGACY_TOOL_ROUTES } = require("./tool-compatibility-routes");

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

// Callable compatibility aliases are deliberately absent from the current
// full catalog. Protocol validation must still accept their known names.
function callableToolDefinitions() {
  return [...toolDefinitions(), ...legacyDefinitions.filter(tool => LEGACY_TOOL_ROUTES[tool.name])];
}

module.exports = {
  toolDefinitions,
  callableToolDefinitions,
  legacyDefinitions
};
