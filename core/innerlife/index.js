async function snapshot(core, agentId = "all") {
  return core.database.getInnerLifeSnapshot(agentId);
}

async function snapshotLite(core, agentId = "all") {
  return core.database.getInnerLifeSnapshotLite(agentId);
}

async function sessions(core, input = {}) {
  return core.database.listInnerLifeSessionsPage(input);
}

async function recentSessions(core, agentId, limit = 20) {
  return core.database.listInnerLifeSessions(agentId, limit);
}

async function digestRuns(core, input = {}) {
  return core.database.listInnerLifeDigestRunsPage(input);
}

async function inbox(core, input = {}) {
  return core.database.listInnerLifeInboxPage(input);
}

async function doctor(core, agentId = "codex") {
  return core.database.getInnerLifeDoctor(agentId);
}

async function briefing(core, input = {}) {
  return core.database.getInnerLifeBriefing(input);
}

async function updateProfile(core, input = {}) {
  return core.database.updateInnerLifeProfile(input);
}

async function profiles(core, input = {}) {
  return core.database.listInnerLifeProfiles(input);
}

async function deleteProfile(core, input = {}) {
  return core.database.deleteInnerLifeProfile(input);
}

async function submitInbox(core, input) {
  return core.database.submitInnerLifeInbox(input);
}

async function startSession(core, input) {
  return core.database.startInnerLifeSession(input);
}

async function endSession(core, sessionId, input) {
  return core.database.endInnerLifeSession(sessionId, input);
}

async function processOnce(core, input) {
  return core.database.processInnerLifeOnce(input);
}

async function digest(core, input) {
  return core.database.runInnerLifeDigest(input);
}

async function checkShareTiming(core, input) {
  return core.database.checkInnerLifeShareTiming(input);
}

async function pendingShares(core, status = "pending", limit = 20, agentId = "all") {
  return core.database.listInnerLifeShares(status, limit, agentId);
}

async function shareActions(core, shareId = null, limit = 20, agentId = "all") {
  return core.database.listInnerLifeShareActions(shareId, limit, agentId);
}

async function setDaemon(core, input) {
  return core.database.setInnerLifeDaemonState(input);
}

async function daemonStatus(core, agentId) {
  return core.database.ensureInnerLifeDaemonState(agentId);
}

async function tickDaemon(core, input) {
  return core.database.tickInnerLifeDaemon(input);
}

async function markShare(core, id, action, reason = "", agentId = "", deliveryEvidence = null) {
  return core.database.markInnerLifeShare(id, action, reason, agentId, deliveryEvidence);
}

async function reviewShare(core, id, decision, reason = "") {
  return core.database.reviewInnerLifeShare(id, decision, reason);
}

async function applyShareToMemory(core, id) {
  return core.database.applyInnerLifeShareToMemory(id);
}

async function applyShareToSharedLine(core, id) {
  return core.database.applyInnerLifeShareToSharedLine(id);
}

async function history(core, input = {}) {
  return core.database.getInnerLifeHistory(input?.agentId, input?.limit);
}

async function experiences(core, input = {}) {
  return core.database.listInnerLifeExperiences(input?.agentId, input?.limit);
}

async function summaries(core, input = {}) {
  return core.database.listInnerLifeSummaries(input?.agentId, input?.limit);
}

async function explore(core, input) {
  return core.database.exploreInnerLife(input);
}

async function converge(core, input) {
  return core.database.convergeInnerLife(input);
}

module.exports = {
  applyShareToMemory,
  applyShareToSharedLine,
  briefing,
  checkShareTiming,
  converge,
  daemonStatus,
  deleteProfile,
  digest,
  digestRuns,
  doctor,
  endSession,
  experiences,
  explore,
  history,
  inbox,
  markShare,
  pendingShares,
  processOnce,
  profiles,
  recentSessions,
  reviewShare,
  sessions,
  setDaemon,
  shareActions,
  snapshot,
  snapshotLite,
  startSession,
  submitInbox,
  summaries,
  tickDaemon,
  updateProfile
};
