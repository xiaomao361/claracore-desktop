const { shapeInnerLifeStatus } = require("../innerlife/selective");
const { boundedText, catalogPage, shapeInnerLifeSessionCatalogEntry } = require("./bounded-response");
const { catalogInput } = require("./catalog-input");

const SECTIONS = ["sessions", "inbox", "digestRuns", "shares"];

function readRef(section, id) {
  return { tool: "innerlife_status", arguments: { detail: "full", section, recordId: id } };
}

// Keep the UI snapshot intact. Agent diagnostics are catalogs with explicit
// one-record expansion, not the union of every body and history collection.
async function statusPage(core, agentId, input = {}) {
  const section = input.section || "overview";
  if (!["overview", ...SECTIONS].includes(section)) throw new Error("Invalid InnerLife status section.");
  if (input.status && !["sessions", "inbox", "shares"].includes(section)) {
    throw new Error("Status filtering requires a sessions, inbox or shares section.");
  }
  const statuses = {
    sessions: ["all", "active", "ended"],
    inbox: ["all", "pending", "processing", "processed", "failed"],
    shares: ["all", "drafting", "pending", "approved", "rejected", "used", "deferred", "discarded"]
  };
  if (input.status && !statuses[section].includes(input.status)) throw new Error("Invalid InnerLife status filter.");
  if (input.recordId !== undefined && (typeof input.recordId !== "string" || !input.recordId.trim())) throw new Error("Record id must be a nonempty string.");
  if (input.recordId && ["status", "offset", "limit"].some(key => input[key] !== undefined)) throw new Error("Record reads cannot also request a catalog page or status filter.");
  const database = core.database;
  if (input.recordId) {
    const readers = {
      sessions: "getInnerLifeSession", inbox: "getInnerLifeInboxItem",
      digestRuns: "getInnerLifeDigestRun", shares: "getInnerLifeShare"
    };
    if (!readers[section]) throw new Error("A record read requires a specific InnerLife section.");
    const record = await database[readers[section]](input.recordId);
    if (!record || (record.agentId || record.agent_id) !== agentId) {
      throw new Error("InnerLife record not found for this Agent.");
    }
    return { detail: "full", mode: "full", section, record };
  }
  const { limit, offset } = catalogInput(input);
  const readers = {
    sessions: () => database.listInnerLifeSessionsPage({ agentId, limit, offset, status: input.status }),
    inbox: () => database.listInnerLifeInboxPage({ agentId, limit, offset, status: input.status || "all" }),
    digestRuns: () => database.listInnerLifeDigestRunsPage({ agentId, limit, offset }),
    shares: () => database.listInnerLifeShareSummariesPage({ agentId, limit, offset, status: input.status || "all" })
  };
  const status = shapeInnerLifeStatus(await database.getInnerLifeSnapshotLite(agentId));
  const result = { ...status, detail: "full", mode: "full", section, pages: {} };
  for (const name of section === "overview" ? SECTIONS : [section]) {
    const page = await readers[name]();
    result[name === "shares" ? "recentShares" : name] = page.items.map((item) => name === "sessions"
      ? shapeInnerLifeSessionCatalogEntry(item)
      : {
          id: item.id, agentId: item.agentId || item.agent_id,
          status: item.status, ...(item.source ? { source: item.source } : {}),
          preview: boundedText(item.preview || item.body || item.summary, 600),
          createdAt: item.createdAt || item.created_at || null,
          detailRef: readRef(name, item.id)
        });
    result.pages[name] = {
      ...catalogPage(page.items, page.total, page),
      ...(offset + page.items.length < page.total ? { nextRead: { tool: "innerlife_status", arguments: {
        detail: "full", section: name, limit, offset: offset + page.items.length,
        ...(input.status ? { status: input.status } : {})
      } } } : {})
    };
  }
  return result;
}

module.exports = { statusPage };
