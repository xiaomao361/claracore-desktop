function normalizeListInput(input, fallbackLimit = 20) {
  if (typeof input === "number" || typeof input === "string") {
    return {
      limit: Math.max(1, Number.parseInt(String(input), 10) || fallbackLimit),
      offset: 0,
      agentId: ""
    };
  }
  return {
    limit: Math.max(1, Number.parseInt(String(input?.limit || fallbackLimit), 10) || fallbackLimit),
    offset: Math.max(0, Number.parseInt(String(input?.offset || 0), 10) || 0),
    agentId: String(input?.agentId || input?.agent_id || "").trim()
  };
}

async function create(core, input) {
  return core.database.createMemory(input);
}

async function update(core, id, input) {
  return core.database.updateMemory(id, input);
}

async function remove(core, id) {
  return core.database.deleteMemory(id);
}

async function archive(core, id) {
  return core.database.archiveMemory(id);
}

async function restore(core, id) {
  return core.database.restoreMemory(id);
}

async function restoreArchived(core, id) {
  return core.database.restoreArchivedMemory(id);
}

async function restrict(core, id) {
  return core.database.setMemorySensitivity(id, "restricted");
}

async function unrestrict(core, id) {
  return core.database.setMemorySensitivity(id, "normal");
}

async function stats(core) {
  return core.database.getMemoryStats();
}

async function createRecord(core, input) {
  return core.database.createMemoryRecord(input);
}

async function records(core, input = {}) {
  return {
    records: await core.database.listMemoryRecords(input || {}),
    stats: await core.database.getMemoryRecordStats()
  };
}

async function createLabelAlias(core, input) {
  return core.database.createMemoryLabelAlias(input);
}

async function deleteLabelAlias(core, alias) {
  return core.database.deleteMemoryLabelAlias(alias);
}

async function labelAliases(core) {
  return core.database.listMemoryLabelAliases();
}

async function search(core, input) {
  if (typeof input === "string") return core.database.searchMemories(input, 50);
  const query = String(input?.query || "").trim();
  const limit = Math.max(1, Number.parseInt(String(input?.limit || 50), 10) || 50);
  return core.database.searchMemories(query, limit, {
    agentId: input?.agentId || input?.agent_id || ""
  });
}

async function list(core, input = {}) {
  const paging = normalizeListInput(input, 20);
  return core.database.listMemories(paging.limit, "", { offset: paging.offset, agentId: paging.agentId });
}

async function restricted(core, input = {}) {
  const paging = normalizeListInput(input, 20);
  return core.database.listRestrictedMemories(paging.limit, { offset: paging.offset, agentId: paging.agentId });
}

async function deleted(core, input = {}) {
  const paging = normalizeListInput(input, 20);
  return core.database.listDeletedMemories(paging.limit, { offset: paging.offset, agentId: paging.agentId });
}

async function archived(core, input = {}) {
  const paging = normalizeListInput(input, 20);
  return core.database.listArchivedMemories(paging.limit, { offset: paging.offset, agentId: paging.agentId });
}

async function maintenance(core) {
  return core.database.getMemoryMaintenanceReport();
}

async function mergeSuggestions(core, input = {}) {
  return core.database.getMemoryMergeSuggestions(input || {});
}

async function merge(core, input = {}) {
  return core.database.mergeMemories(input || {});
}

async function archiveSuggestions(core, input = {}) {
  return core.database.getMemoryArchiveSuggestions(input || {});
}

async function archiveDormant(core, input = {}) {
  return core.database.archiveDormantMemories(input || {});
}

async function embed(core, id) {
  return core.database.embedMemory(id);
}

module.exports = {
  archive,
  archiveDormant,
  archived,
  archiveSuggestions,
  create,
  createLabelAlias,
  createRecord,
  deleted,
  deleteLabelAlias,
  embed,
  labelAliases,
  list,
  maintenance,
  merge,
  mergeSuggestions,
  records,
  remove,
  restore,
  restoreArchived,
  restrict,
  restricted,
  search,
  stats,
  unrestrict,
  update
};
