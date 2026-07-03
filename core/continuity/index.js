async function get(core, input = {}) {
  return core.database.getResumePacket(input || {});
}

async function list(core, input = {}) {
  return core.database.listContinuityLines(input || {});
}

async function gatewayContext(core, input = {}) {
  return core.database.getGatewayContext(input || {});
}

async function save(core, input, options = {}) {
  const currentPosition = await core.database.saveCurrentPosition(input);
  return core.database.getResumePacket({
    lineId: currentPosition.lineId,
    agentId: input?.agentId,
    model: input?.model,
    lite: options.lite === true
  });
}

async function create(core, input, options = {}) {
  const line = await core.database.createContinuityLine(input || {});
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.id, lite: options.lite === true })
  };
}

async function activate(core, lineId, options = {}) {
  const line = await core.database.setActiveContinuityLine(lineId);
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.id, lite: options.lite === true })
  };
}

async function rename(core, lineId, title, options = {}) {
  const line = await core.database.renameContinuityLine(lineId, title);
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.active ? line.id : undefined, lite: options.lite === true })
  };
}

async function archive(core, lineId, options = {}) {
  const line = await core.database.archiveContinuityLine(lineId);
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lite: options.lite === true })
  };
}

async function restore(core, lineId, makeActive = false, options = {}) {
  const line = await core.database.restoreContinuityLine(lineId, makeActive);
  return {
    line,
    sharedLine: await core.database.getResumePacket({ lineId: line.active ? line.id : undefined, lite: options.lite === true })
  };
}

async function createHandoff(core, input, options = {}) {
  const handoff = await core.database.createContinuityHandoff(input);
  return {
    handoff,
    sharedLine: await core.database.getResumePacket({ lineId: input?.lineId, lite: options.lite === true })
  };
}

async function agentState(core, agentId, update) {
  return update
    ? core.database.updateContinuityAgentState(agentId, update)
    : core.database.getContinuityAgentState(agentId);
}

async function modelAdjustments(core) {
  return core.database.listContinuityModelAdjustments();
}

async function modelAdjustment(core, model) {
  return core.database.getContinuityModelAdjustment(model);
}

async function setModelAdjustment(core, input = {}) {
  return core.database.setContinuityModelAdjustment(input);
}

async function deleteModelAdjustment(core, model) {
  return core.database.deleteContinuityModelAdjustment(model);
}

async function compact(core, input = {}) {
  const result = await core.database.compactContinuityLine(input);
  return {
    compact: result,
    sharedLine: await core.database.getResumePacket({ lineId: result.lineId })
  };
}

module.exports = {
  activate,
  agentState,
  archive,
  compact,
  create,
  createHandoff,
  deleteModelAdjustment,
  gatewayContext,
  get,
  list,
  modelAdjustment,
  modelAdjustments,
  rename,
  restore,
  save,
  setModelAdjustment
};
