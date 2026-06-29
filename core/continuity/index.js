async function get(core, input = {}) {
  return core.database.getResumePacket(input || {});
}

async function gatewayContext(core, input = {}) {
  return core.database.getGatewayContext(input || {});
}

async function save(core, input) {
  await core.database.saveCurrentPosition(input);
  return core.database.getResumePacket({ lineId: input?.lineId });
}

async function create(core, input) {
  const line = await core.database.createContinuityLine(input || {});
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.id })
  };
}

async function activate(core, lineId) {
  const line = await core.database.setActiveContinuityLine(lineId);
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.id })
  };
}

async function rename(core, lineId, title) {
  const line = await core.database.renameContinuityLine(lineId, title);
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.active ? line.id : undefined })
  };
}

async function archive(core, lineId) {
  const line = await core.database.archiveContinuityLine(lineId);
  return {
    line,
    sharedLine: await core.database.getResumePacket()
  };
}

async function restore(core, lineId, makeActive = false) {
  const line = await core.database.restoreContinuityLine(lineId, makeActive);
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.active ? line.id : undefined })
  };
}

async function createHandoff(core, input) {
  const handoff = await core.database.createContinuityHandoff(input);
  return {
    handoff,
    sharedLine: await core.database.getResumePacket({ lineId: input?.lineId })
  };
}

module.exports = {
  activate,
  archive,
  create,
  createHandoff,
  gatewayContext,
  get,
  rename,
  restore,
  save
};
