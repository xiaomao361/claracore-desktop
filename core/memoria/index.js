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

async function get(core, id) {
  return core.database.getMemory(id);
}

async function update(core, id, input) {
  return core.database.updateMemory(id, input);
}

async function tag(core, id, input) {
  return core.database.updateMemoryLabels(id, input);
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

async function graph(core, input = {}) {
  return core.database.getMemoryGraph(input || {});
}

async function createLink(core, input) {
  return core.database.createMemoryLink(input);
}

async function supersede(core, input) {
  return core.database.supersedeMemory(input);
}

async function links(core, input = {}) {
  return core.database.listMemoryLinks(input || {});
}

async function linkSummaries(core, input = {}) {
  return core.database.listMemoryLinkSummaries(input || {});
}

async function deleteLink(core, id) {
  return core.database.deleteMemoryLink(id);
}

async function createRecord(core, input) {
  return core.database.createMemoryRecord(input);
}

async function recordSummary(core, input = {}) {
  return core.database.summarizeMemoryRecords(input || {});
}

async function recordStats(core) {
  return core.database.getMemoryRecordStats();
}

async function records(core, input = {}) {
  return {
    records: await core.database.listMemoryRecords(input || {}),
    stats: await core.database.getMemoryRecordStats()
  };
}

async function record(core, id) {
  return core.database.getMemoryRecord(id);
}

async function recordSummaries(core, input = {}) {
  return core.database.listMemoryRecordSummaries(input || {});
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
    agentId: input?.agentId || input?.agent_id || "",
    timeView: input?.timeView || input?.time_view || "current"
  });
}

// v0.6.6 summary-first recall.
//
// The full record stays available through memoria_get and through
// detail="full". A default read answers "which memory do I want next", not
// "give me everything Memoria stores about these rows".
const SUMMARY_SEARCH_LIMIT = 3;
const SUMMARY_SEARCH_MAX_LIMIT = 25;
const SUMMARY_BODY_BYTES = 1200;
const SUMMARY_TITLE_BYTES = 200;
const SUMMARY_LABEL_LIMIT = 8;

function summaryDetail(value) {
  const detail = String(value || "summary").trim().toLowerCase() || "summary";
  if (!["summary", "full"].includes(detail)) {
    throw new Error("memoria_search detail must be summary or full.");
  }
  return detail;
}

function truncateUtf8Body(value, maxBytes) {
  const text = String(value || "");
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return { text, truncated: false };
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(characters.slice(0, middle).join(""), "utf8") <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return { text: characters.slice(0, low).join(""), truncated: true };
}

function summarizeMemoryResult(memory) {
  const body = truncateUtf8Body(memory?.body, SUMMARY_BODY_BYTES);
  const title = truncateUtf8Body(memory?.title || "", SUMMARY_TITLE_BYTES);
  return {
    id: memory?.id || "",
    title: title.text,
    bodyPreview: body.text,
    bodyTruncated: body.truncated,
    labels: (memory?.labels || []).slice(0, SUMMARY_LABEL_LIMIT),
    stateRole: memory?.stateRole || (memory?.status === "superseded" ? "historical" : "current"),
    supersedes: memory?.supersedes || [],
    supersededBy: memory?.supersededBy || [],
    source: memory?.search_source || "keyword",
    score: Number((memory?.search_score || 0).toFixed(4)),
    updatedAt: memory?.updated_at || memory?.updatedAt || null,
    detailRef: { tool: "memoria_get", arguments: { id: memory?.id || "" } }
  };
}

async function searchSummary(core, input = {}) {
  const detail = summaryDetail(input.detail);
  const requestedLimit = Number.parseInt(String(input.limit ?? SUMMARY_SEARCH_LIMIT), 10);
  const limit = Math.max(
    1,
    Math.min(Number.isFinite(requestedLimit) ? requestedLimit : SUMMARY_SEARCH_LIMIT, SUMMARY_SEARCH_MAX_LIMIT)
  );
  const result = await search(core, { ...input, limit });

  if (detail === "full") return { detail, ...result };

  const results = (result?.results || []).map(summarizeMemoryResult);
  return {
    detail,
    mode: result?.mode || "keyword",
    query: result?.query || "",
    timeView: result?.timeView || "current",
    results,
    resultPage: {
      requestedLimit: Number.isFinite(requestedLimit) ? requestedLimit : SUMMARY_SEARCH_LIMIT,
      appliedLimit: limit,
      returned: results.length,
      requestCapped: Number.isFinite(requestedLimit) && requestedLimit > limit,
      mayHaveMore: results.length === limit
    },
    // A silent embedding failure downgrades hybrid search to keyword-only, so
    // the fact is reported. The message itself is operational detail.
    degraded: Boolean(result?.error),
    relatedRef: { tool: "memoria_link_list", arguments: {} },
    detailRef: { tool: "memoria_search", arguments: { query: result?.query || "", detail: "full" } }
  };
}

async function list(core, input = {}) {
  const paging = normalizeListInput(input, 20);
  return core.database.listMemories(paging.limit, "", { offset: paging.offset, agentId: paging.agentId });
}

async function listSummaries(core, input = {}) {
  return core.database.listMemorySummariesPage(input || {});
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

async function maintenanceRun(core, input = {}) {
  return core.database.runMemoryMaintenance(input || {});
}

async function maintenanceAudit(core, input = {}) {
  return core.database.getMemoryAuditReport(input || {});
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

async function processEmbeddings(core, limit = 1) {
  return core.database.processPendingEmbeddings(limit);
}

module.exports = {
  archive,
  archiveDormant,
  archived,
  archiveSuggestions,
  create,
  createLabelAlias,
  createLink,
  createRecord,
  deleted,
  deleteLabelAlias,
  deleteLink,
  embed,
  get,
  graph,
  labelAliases,
  links,
  linkSummaries,
  list,
  listSummaries,
  maintenance,
  maintenanceAudit,
  maintenanceRun,
  merge,
  mergeSuggestions,
  processEmbeddings,
  recordStats,
  recordSummary,
  record,
  recordSummaries,
  records,
  remove,
  restore,
  restoreArchived,
  restrict,
  restricted,
  search,
  searchSummary,
  stats,
  summarizeMemoryResult,
  SUMMARY_BODY_BYTES,
  SUMMARY_SEARCH_LIMIT,
  SUMMARY_SEARCH_MAX_LIMIT,
  supersede,
  tag,
  unrestrict,
  update
};
