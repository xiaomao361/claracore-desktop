const { hash, failure } = require("./journal");

const WINDOW_BYTES = 1200;
const OVERLAP_BYTES = 120;
const RECALL_BYTES = 64 * 1024;

// Every code point is covered, including tails of long events. Overlap keeps a
// short phrase across a window boundary available to local semantic retrieval.
function recallWindows(value) {
  const chars = Array.from(value);
  const windows = [];
  let start = 0;
  while (start < chars.length) {
    let end = start, bytes = 0;
    while (end < chars.length && bytes + Buffer.byteLength(chars[end]) <= WINDOW_BYTES) bytes += Buffer.byteLength(chars[end++]);
    windows.push(chars.slice(start, end).join(""));
    if (end === chars.length) break;
    let next = end, overlap = 0;
    while (next > start + 1 && overlap + Buffer.byteLength(chars[next - 1]) <= OVERLAP_BYTES) overlap += Buffer.byteLength(chars[--next]);
    start = next;
  }
  return windows;
}

async function recallEvents(core, app, caller, input, ports) {
  const pool = { memory: [], knowledge: [] };
  const catalog = new Map();
  const cache = new Map();
  const events = [];
  async function lookup(domain, query) {
    const key = hash([domain, query, input.knowledgeMode]);
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => domain === "memory"
      ? ports.memories(core, query) : ports.knowledge(core, app, query, { mode: input.knowledgeMode || "hybrid" }))
      .catch(error => ({ status: "failed", code: error.code || `${domain}_failed`, items: [] })));
    return cache.get(key);
  }
  function collect(domain, result, refs) {
    const items = Array.isArray(result.items) ? result.items.slice(0, 3) : [];
    for (const item of items) {
      const id = item.id || item.reference;
      if (!id) continue;
      const key = `${domain}:${id}`;
      if (!catalog.has(key)) {
        // Three candidates per event/domain are retained; overflow remains a
        // pointer, never a silent assertion that remaining objects don't exist.
        catalog.set(key, item);
      }
      if (!refs.includes(id)) refs.push(id);
    }
  }
  for (const event of input.events) {
    const queries = recallWindows(event.text);
    const row = { eventId: event.id, sourceRef: event.sourceRef, textBytes: Buffer.byteLength(event.text),
      textFullyCovered: true, windowCount: queries.length, domains: {} };
    for (const domain of ["memory", "knowledge"]) {
      const refs = [], outcomes = [];
      // Sequential bounded searches keep model/SQLite concurrency controlled.
      for (const query of queries) {
        const result = await lookup(domain, query);
        collect(domain, result, refs);
        outcomes.push({ status: result.status || "unknown", ...(result.code ? { code: result.code } : {}),
          ...(result.hasMore ? { hasMore: true } : {}) });
      }
      // A source identity query catches previously stored material even when
      // wording changes. It is evidence retrieval, not a semantic classifier.
      if (domain === "knowledge") {
        const result = await lookup(domain, event.sourceRef);
        collect(domain, result, refs);
        outcomes.push({ status: result.status || "unknown", sourceLookup: true, ...(result.code ? { code: result.code } : {}), ...(result.hasMore ? { hasMore: true } : {}) });
      }
      row.domains[domain] = { references: refs.slice(0, 3), omittedReferences: refs.slice(3), outcomes,
        completeCatalog: false, note: "All event text was queried; bounded retrieval is not exhaustive semantic deduplication." };
      for (const id of refs.slice(0, 3)) {
        const item = catalog.get(`${domain}:${id}`);
        if (!pool[domain].some(candidate => (candidate.id || candidate.reference) === id)) pool[domain].push(item);
      }
    }
    events.push(row);
  }
  let continuity;
  try { continuity = await ports.lines(core, caller, { lineId: input.lineId, lineLimit: 50 }); }
  catch (error) { continuity = { status: "failed", code: error.code || "continuity_failed" }; }
  const result = { continuity, events, objects: pool, innerlife: { status: "not_collected" },
    note: "Event text coverage and retrieval quality are separate. Failed or partial searches and omitted pointers must not be treated as absence." };
  if (Buffer.byteLength(JSON.stringify(result)) > RECALL_BYTES) throw failure("event_recall_over_budget");
  return result;
}
module.exports = { recallEvents, recallWindows, WINDOW_BYTES, RECALL_BYTES };
