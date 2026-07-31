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

function installInnerLifeRepository(ProductDatabase, helpers) {
  Object.assign(ProductDatabase.prototype, {
    ...createInnerLifeProfileRepository(helpers),
    ...createInnerLifeShareRepository(helpers),
    ...createInnerLifeInboxRepository(helpers),
    ...createInnerLifeDaemonRepository(helpers),
    ...createInnerLifeRetentionRepository(helpers),
    ...createInnerLifeReadModelRepository(helpers),
    ...createInnerLifeDigestRepository(helpers),
    ...createInnerLifeSessionRepository(helpers),
    ...createInnerLifeSourceInboxRepository(helpers),
    ...createInnerLifeHistoryRepository(helpers),
    ...createInnerLifeReflectionRepository(helpers)
  });
}

module.exports = {
  installInnerLifeRepository
};
