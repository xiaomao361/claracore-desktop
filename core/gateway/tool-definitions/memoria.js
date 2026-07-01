const { memoriaCoreToolDefinitions } = require("./memoria-core");
const { memoriaMaintenanceToolDefinitions } = require("./memoria-maintenance");
const { memoriaLabelToolDefinitions } = require("./memoria-labels");
const { memoriaRecordToolDefinitions } = require("./memoria-records");

const memoriaToolDefinitions = [
  ...memoriaCoreToolDefinitions,
  ...memoriaMaintenanceToolDefinitions,
  ...memoriaLabelToolDefinitions,
  ...memoriaRecordToolDefinitions
];

module.exports = {
  memoriaToolDefinitions
};
