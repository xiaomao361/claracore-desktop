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
const { createInnerLifeDaemonTickService } = require("../../innerlife/services/daemon-tick");
const { composeRepositoryMethods, installRepositoryMethods } = require("../repository-installer");

function installInnerLifeRepository(ProductDatabase, helpers) {
  const tickInnerLifeDaemon = createInnerLifeDaemonTickService({
    completeFailure: (database, input) => database.completeInnerLifeDaemonTickFailure(input),
    completeIdle: (database, input) => database.completeInnerLifeDaemonTickIdle(input),
    completeSuccess: (database, input) => database.completeInnerLifeDaemonTickSuccess(input),
    ensureDaemonState: (database, agentId) => database.ensureInnerLifeDaemonState(agentId),
    getLockKey: (database, agentId) => `${database.dbPath}:${agentId}`,
    getSettings: (database) => database.getSettings(),
    getSnapshot: (database, agentId) => database.getInnerLifeSnapshot(agentId),
    ingestSources: (database, input) => database.ingestInnerLifeSources(input),
    innerLifeRetrySeconds: helpers.innerLifeRetrySeconds,
    isDaemonDue: (database, agentId) => database.isInnerLifeDaemonTickDue(agentId),
    listPendingInbox: (database, status, limit) => database.listInnerLifeInbox(status, limit),
    listPendingInboxPage: (database, input) => database.listInnerLifeInboxPage(input),
    markRunning: (database, agentId) => database.markInnerLifeDaemonTickRunning(agentId),
    processOnce: (database, input) => database.processInnerLifeOnce(input),
    resolveAgentIdentity: helpers.resolveAgentIdentity
  });
  const methods = composeRepositoryMethods("innerlife", [
    ["profile", createInnerLifeProfileRepository(helpers)],
    ["shares", createInnerLifeShareRepository(helpers)],
    ["inbox", createInnerLifeInboxRepository(helpers)],
    ["daemon", createInnerLifeDaemonRepository(helpers, { tickInnerLifeDaemon })],
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
