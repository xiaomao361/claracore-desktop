async function snapshot(core) {
  return core.database.getInnerLifeSnapshot();
}

async function sessions(core, input = {}) {
  return core.database.listInnerLifeSessionsPage(input);
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

async function setDaemon(core, input) {
  return core.database.setInnerLifeDaemonState(input);
}

async function tickDaemon(core, input) {
  return core.database.tickInnerLifeDaemon(input);
}

async function markShare(core, id, action, reason = "") {
  return core.database.markInnerLifeShare(id, action, reason);
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
  checkShareTiming,
  converge,
  digest,
  digestRuns,
  doctor,
  endSession,
  experiences,
  explore,
  history,
  inbox,
  markShare,
  processOnce,
  reviewShare,
  sessions,
  setDaemon,
  snapshot,
  startSession,
  submitInbox,
  summaries,
  tickDaemon
};
