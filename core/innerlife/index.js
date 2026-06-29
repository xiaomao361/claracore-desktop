async function snapshot(core) {
  return core.database.getInnerLifeSnapshot();
}

async function sessions(core, input = {}) {
  return core.database.listInnerLifeSessionsPage(input);
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

module.exports = {
  applyShareToMemory,
  applyShareToSharedLine,
  checkShareTiming,
  digest,
  doctor,
  endSession,
  sessions,
  markShare,
  processOnce,
  reviewShare,
  setDaemon,
  snapshot,
  startSession,
  submitInbox,
  tickDaemon
};
