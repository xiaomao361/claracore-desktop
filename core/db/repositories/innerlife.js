const { createInnerLifeDaemonRepository } = require("./innerlife/daemon");
const { createInnerLifeDigestRepository } = require("./innerlife/digests");
const { createInnerLifeHistoryRepository } = require("./innerlife/history");
const { createInnerLifeInboxRepository } = require("./innerlife/inbox");
const { createInnerLifeProfileRepository } = require("./innerlife/profile");
const { createInnerLifeReadModelRepository } = require("./innerlife/read-models");
const { createInnerLifeReflectionRepository } = require("./innerlife/reflection");
const { createInnerLifeRetentionRepository } = require("./innerlife/retention");
const { createInnerLifeSessionRepository } = require("./innerlife/sessions");
const { createInnerLifeShareRepository } = require("./innerlife/shares");
const { createInnerLifeSourceInboxRepository } = require("./innerlife/source-inbox");
const { composeRepositoryMethods, installRepositoryMethods } = require("../repository-installer");

function installInnerLifeRepository(ProductDatabase, helpers) {
  const methods = composeRepositoryMethods("innerlife", [
    ["profile", createInnerLifeProfileRepository(helpers)],
    ["shares", createInnerLifeShareRepository(helpers)],
    ["inbox", createInnerLifeInboxRepository(helpers)],
    ["daemon", createInnerLifeDaemonRepository(helpers)],
    ["retention", createInnerLifeRetentionRepository(helpers)],
    ["read-models", createInnerLifeReadModelRepository(helpers)],
    ["digests", createInnerLifeDigestRepository(helpers)],
    ["sessions", createInnerLifeSessionRepository(helpers)],
    ["source-inbox", createInnerLifeSourceInboxRepository(helpers)],
    ["history", createInnerLifeHistoryRepository(helpers)],
    ["reflection", createInnerLifeReflectionRepository(helpers)]
  ]);
  installRepositoryMethods(ProductDatabase, "innerlife", methods);
}

module.exports = {
  installInnerLifeRepository
};
