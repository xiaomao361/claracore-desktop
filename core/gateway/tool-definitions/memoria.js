const { memoriaCoreToolDefinitions } = require("./memoria-core");
const { memoriaMaintenanceToolDefinitions } = require("./memoria-maintenance");
const { memoriaLabelToolDefinitions } = require("./memoria-labels");
const { memoriaLinkToolDefinitions } = require("./memoria-links");
const { memoriaRecordToolDefinitions } = require("./memoria-records");

const memoriaToolDefinitions = [
  ...memoriaCoreToolDefinitions,
  ...memoriaMaintenanceToolDefinitions,
  ...memoriaLabelToolDefinitions,
  ...memoriaLinkToolDefinitions,
  ...memoriaRecordToolDefinitions
];

module.exports = {
  memoriaToolDefinitions
};
