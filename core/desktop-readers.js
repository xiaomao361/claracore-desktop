// Read-only, bounded readers for explicit Desktop selections.
const { sqlString } = require("./db/helpers");
const pageNumber = (value, fallback, max) => Math.max(0, Math.min(max, Number.parseInt(String(value ?? fallback), 10) || fallback));

async function getSharedLines(database, input = {}) {
  const page = await database.listContinuityLineSummaries(input);
  const agents = await database.query("SELECT DISTINCT agent_id FROM continuity_lines WHERE status != 'deleted' AND agent_id != '' ORDER BY agent_id;");
  const selected = input.selectedLineId ? await database.getContinuityLine(input.selectedLineId) : null;
  const selectedLine = selected && selected.status === "active" && (!input.agentId || selected.agentId === input.agentId)
    ? { id: selected.id, agentId: selected.agentId, title: selected.title, summary: String(selected.summary || "").slice(0, 1000), status: selected.status, updatedAt: selected.updatedAt } : null;
  return { ...page, selectedLine, hasMore: page.offset + page.items.length < page.total, agents: agents.map(row => row.agent_id) };
}

async function getInnerLifeShares(database, input = {}) {
  const agentId = String(input.agentId || "").trim();
  if (!agentId || agentId === "all") throw new Error("Select an InnerLife agent.");
  const status = input.status || "unshared";
  if (!["used", "unshared"].includes(status)) throw new Error("Unsupported share catalog status.");
  const limit = Math.max(1, pageNumber(input.limit, 10, 50));
  const offset = pageNumber(input.offset, 0, Number.MAX_SAFE_INTEGER);
  // Unshared is a historical reading catalog, not the current candidate pool.
  const where = `s.agent_id = ${sqlString(agentId)} AND ${status === "used" ? "s.status = 'used'" : "s.status IN ('pending', 'approved', 'deferred')"}`;
  const [items, totals] = await Promise.all([
    database.query(`SELECT s.id, s.agent_id, s.status, substr(s.body, 1, 800) AS body,
      length(s.body) > 800 AS truncated, s.created_at, s.updated_at,
      (SELECT a.metadata_json FROM innerlife_share_actions a WHERE a.share_id = s.id AND a.action = 'used'
       ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS delivery_metadata_json
      FROM innerlife_shares s WHERE ${where}
      ORDER BY s.updated_at DESC, s.created_at DESC, s.id DESC LIMIT ${limit} OFFSET ${offset};`),
    database.query(`SELECT COUNT(*) AS total FROM innerlife_shares s WHERE ${where};`)
  ]);
  const total = Number(totals[0]?.total || 0);
  return { agentId, status, limit, offset, total, hasMore: offset + items.length < total,
    items: items.map(({ delivery_metadata_json, ...item }) => {
      let deliveryEvidence = null;
      try { deliveryEvidence = JSON.parse(delivery_metadata_json || "{}").deliveryEvidence || null; } catch (_) { /* Unknown evidence stays unverified. */ }
      return { ...item, deliveryEvidence };
    }) };
}

async function getInnerLife(database, input = {}) {
  const profiles = await database.query("SELECT agent_id AS agentId, display_name AS displayName, enabled FROM innerlife_profiles ORDER BY updated_at DESC, agent_id ASC;");
  const agentId = String(input.agentId || profiles[0]?.agentId || "").trim();
  if (!agentId) return { agentId: "", profiles: [], unsharedShares: [], sharedShares: [] };
  if (!profiles.some(profile => profile.agentId === agentId)) throw new Error("InnerLife agent not found.");
  const snapshot = await database.getInnerLifeSnapshot(agentId);
  const [unsharedSharesPage, sharedSharesPage] = await Promise.all([
    getInnerLifeShares(database, { agentId }), getInnerLifeShares(database, { agentId, status: "used" })
  ]);
  return { ...snapshot, agentId,
    profiles: profiles.map(profile => snapshot.profiles.find(item => item.agentId === profile.agentId) || profile),
    unsharedShares: unsharedSharesPage.items, sharedShares: sharedSharesPage.items,
    unsharedSharesPage, sharedSharesPage };
}

async function getInnerLifeText(database, input = {}) {
  const id = String(input.id || "").trim();
  const agentId = String(input.agentId || "").trim();
  if (!id || !agentId || agentId === "all") throw new Error("A record and its agent are required.");
  const offset = pageNumber(input.offset, 0, Number.MAX_SAFE_INTEGER);
  const limit = 16000;
  // Only these constant SQL shapes can be selected by a renderer request.
  const sources = {
    share: "SELECT id, agent_id, body FROM innerlife_shares",
    event: "SELECT id, agent_id, body FROM innerlife_events",
    digest: "SELECT id, agent_id, summary AS body FROM innerlife_digest_runs",
    thought: "SELECT t.id, e.agent_id, t.body FROM innerlife_thoughts t JOIN innerlife_events e ON e.id = t.event_id"
  };
  const kind = input.kind || "share";
  const source = Object.hasOwn(sources, kind) ? sources[kind] : null;
  if (!source) throw new Error("Unsupported InnerLife record kind.");
  const rows = await database.query(`SELECT id, agent_id AS agentId, substr(body, ${offset + 1}, ${limit}) AS body, length(body) AS total
    FROM (${source}) WHERE id = ${sqlString(id)} AND agent_id = ${sqlString(agentId)} LIMIT 1;`);
  if (!rows[0]) throw new Error("InnerLife record not found for this agent.");
  const row = rows[0];
  const nextOffset = Math.min(offset + limit, row.total);
  return { ...row, offset, nextOffset, hasMore: nextOffset < row.total };
}

module.exports = { getSharedLines, getInnerLife, getInnerLifeShares, getInnerLifeText };
