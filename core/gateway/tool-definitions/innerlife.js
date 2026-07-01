const { innerlifeSessionToolDefinitions } = require("./innerlife-session");
const { innerlifeProfileToolDefinitions } = require("./innerlife-profile");
const { innerlifeShareToolDefinitions } = require("./innerlife-shares");
const { innerlifeDaemonToolDefinitions } = require("./innerlife-daemon");
const { innerlifeHistoryToolDefinitions } = require("./innerlife-history");

const innerlifeToolDefinitions = [
  ...innerlifeSessionToolDefinitions,
  ...innerlifeProfileToolDefinitions,
  ...innerlifeShareToolDefinitions,
  ...innerlifeDaemonToolDefinitions,
  ...innerlifeHistoryToolDefinitions
];

module.exports = {
  innerlifeToolDefinitions
};
