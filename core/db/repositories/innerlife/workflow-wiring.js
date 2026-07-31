const { generateOrTemplate } = require("../../../innerlife/policy");
const { createInnerLifeDigestRunService } = require("../../../innerlife/services/digest-run");
const { createInnerLifeShareTimingService } = require("../../../innerlife/services/share-timing");
const { createInnerLifeDigestRunStore } = require("./digest-run-store");
const { createInnerLifeShareTimingStore } = require("./share-timing-store");

function createInnerLifeWorkflowWiring(helpers) {
  const digestRunStore = createInnerLifeDigestRunStore(helpers);
  const digestRunService = createInnerLifeDigestRunService({
    ensureProfile: (database, agentId) => database.ensureInnerLifeProfile(agentId),
    generateDigest: (database, input) => generateOrTemplate(database, input),
    getDigestRun: (database, id) => database.getInnerLifeDigestRun(id),
    getOptionalResumePacket: (database, input, agentId) => (
      database.getOptionalInnerLifeResumePacket(input, agentId)
    ),
    getSnapshotLite: (database, agentId) => database.getInnerLifeSnapshotLite(agentId),
    listInboxPage: (database, input) => database.listInnerLifeInboxPage(input),
    listMemories: (database, limit) => database.listMemories(limit),
    newId: helpers.newId,
    persistDigestRun: digestRunStore.persist,
    pruneDigestRuns: digestRunStore.prune,
    resolveAgentIdentity: helpers.resolveAgentIdentity
  });

  const shareTimingStore = createInnerLifeShareTimingStore(helpers);
  const shareTimingService = createInnerLifeShareTimingService({
    ensureProfile: (database, agentId) => database.ensureInnerLifeProfile(agentId),
    findAvailableShareId: shareTimingStore.findAvailableShareId,
    getOptionalResumePacket: (database, input, agentId) => (
      database.getOptionalInnerLifeResumePacket(input, agentId)
    ),
    getShare: (database, id) => database.getInnerLifeShare(id),
    getShareCheck: (database, id) => database.getInnerLifeShareCheck(id),
    getSnapshotLite: (database, agentId) => database.getInnerLifeSnapshotLite(agentId),
    meaningfulTokens: helpers.meaningfulTokens,
    newId: helpers.newId,
    recordCheck: shareTimingStore.recordCheck,
    resolveAgentIdentity: helpers.resolveAgentIdentity
  });

  return Object.freeze({
    digests: Object.freeze({ digestRunService, digestRunStore }),
    shares: Object.freeze({ shareTimingService })
  });
}

module.exports = {
  createInnerLifeWorkflowWiring
};
