const fs = require("node:fs");
const path = require("node:path");
const { selectedRoot } = require("./intake");
const { collectDocuments, readKnowledgeDocument, KnowledgeLibraryError } = require("./library");
const { hash, stateDirectory, atomicJson, readCache, inventory } = require("./storage");
const { createKnowledgeEmbedder, normalizedVector } = require("./embedding");
const fail = (code, message) => { throw new KnowledgeLibraryError(code, message); };
const WINDOW = 256;
const STEP = 224;

function documentCreated(text) {
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(text)?.[1] || "";
  return /^created:\s*["']?(\d{4}-\d{2}-\d{2})(?:["']?\s*)$/mu.exec(header)?.[1] || "";
}
function sourceLabel(source) {
  // Labels are display text only. The selected section remains the authority
  // for complete URLs; never present a clipped URL as a navigable source.
  return source.replace(/\[([^\]]+)\]\([^\s)]+\)/gu, "$1")
    .replace(/https?:\/\/[^\s<>]+/gu, (url) => { try { return new URL(url).hostname; } catch { return ""; } })
    .slice(0, 160);
}

function snapshot(root) {
  const documents = [];
  const sections = [];
  const windows = [];
  const references = new Set();
  for (const reference of collectDocuments(root)) {
    const document = readKnowledgeDocument(root, reference);
    documents.push({ path: reference, revision: hash(document.text), anchors: document.sections.map(({ anchor }) => anchor) });
    for (const section of document.sections) {
      const id = `${reference}${section.anchor ? `#${section.anchor}` : ""}`;
      if (references.has(id)) fail("duplicate_anchor", `Knowledge reference is ambiguous: ${id}`);
      references.add(id);
      const metadataText = section.text;
      const source = /^(?:来源|Source)\s*[:：]\s*(.+)$/imu.exec(metadataText)?.[1] || "";
      const date = /^(?:日期|Date|created)\s*[:：]\s*(\d{4}-\d{2}-\d{2})/imu.exec(metadataText)?.[1] || "";
      sections.push({ ...section, reference: id, source: source.slice(0, 200), sourceTruncated: source.length > 200,
        sourceLabel: sourceLabel(source), date, documentDate: documentCreated(document.text) });
      const characters = Array.from(section.text);
      for (let start = 0, ordinal = 0; start < characters.length; start += STEP, ordinal += 1) {
        const text = characters.slice(start, start + WINDOW).join("");
        windows.push({ reference: id, ordinal, contentHash: hash(text), text, start });
        if (start + WINDOW >= characters.length) break;
      }
    }
  }
  return { documents, sections, windows, signature: hash(JSON.stringify(documents)) };
}
function validateIndex(index) {
  if (!index || index.schema !== 1 || typeof index.signature !== "string" || typeof index.modelKey !== "string"
    || !Array.isArray(index.entries) || index.entries.length > 6000 || !Number.isInteger(index.dimension) || index.dimension < 1 || index.dimension > 4096) {
    fail("index_corrupt", "Knowledge semantic index has an invalid shape.");
  }
  const ids = new Set();
  for (const entry of index.entries) {
    if (typeof entry.reference !== "string" || !Number.isInteger(entry.ordinal) || entry.ordinal < 0 || typeof entry.contentHash !== "string") fail("index_corrupt", "Knowledge index contains an invalid entry.");
    const id = `${entry.reference}:${entry.ordinal}`;
    if (ids.has(id)) fail("index_corrupt", "Knowledge index contains duplicate entries.");
    ids.add(id);
    try { normalizedVector(entry.vector, index.dimension); } catch { fail("index_corrupt", "Knowledge index contains an invalid vector."); }
  }
  return index;
}
function matchesPlan(index, plan) {
  return index.entries.length === plan.windows.length && index.entries.every((entry, i) => {
    const window = plan.windows[i];
    return entry.reference === window.reference && entry.ordinal === window.ordinal && entry.contentHash === window.contentHash;
  });
}

async function rebuildKnowledgeSearchIndex(app, settings, { batchSize = 20 } = {}, ports = {}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) fail("invalid_page", "Index batch size must be 1..50.");
  const root = await selectedRoot(app);
  const plan = snapshot(root);
  if (plan.windows.length > 6000) fail("index_capacity", "Corpus exceeds the current 6000-window local index capacity; exact search remains available.");
  const embedder = await (ports.createEmbedder || createKnowledgeEmbedder)(settings);
  const directory = stateDirectory(app, root);
  fs.mkdirSync(directory, { recursive: true });
  const lockPath = path.join(directory, "semantic.lock");
  let lock;
  try { lock = fs.openSync(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") fail("index_busy", "Another index batch is active or a stopped process left a lock. Check it before recovery."); throw error; }
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    const stagePath = path.join(directory, "semantic-building.json");
    let stage;
    try { stage = readCache(stagePath); if (stage) validateIndex(stage); }
    catch (error) { stage = null; if (error.code !== "index_corrupt") throw error; }
    if (!stage || stage.signature !== plan.signature || stage.modelKey !== embedder.key
      || !stage.entries.every((entry, i) => plan.windows[i]?.contentHash === entry.contentHash && plan.windows[i]?.reference === entry.reference && plan.windows[i]?.ordinal === entry.ordinal)) {
      stage = { schema: 1, signature: plan.signature, modelKey: embedder.key, model: embedder.descriptor, dimension: 0, entries: [] };
    }
    let previous;
    try { previous = readCache(path.join(directory, "semantic.json")); if (previous) validateIndex(previous); }
    catch (error) { previous = null; if (error.code !== "index_corrupt") throw error; }
    const reusable = new Map(previous?.modelKey === embedder.key ? previous.entries.map((entry) => [entry.contentHash, entry.vector]) : []);
    let encoded = 0;
    const started = Date.now();
    for (let i = stage.entries.length; i < plan.windows.length && encoded < batchSize; i += 1) {
      const window = plan.windows[i];
      const vector = normalizedVector(reusable.get(window.contentHash) || await embedder.embed(window.text), stage.dimension || undefined);
      if (!stage.dimension) stage.dimension = vector.length;
      stage.entries.push({ reference: window.reference, ordinal: window.ordinal, contentHash: window.contentHash, vector });
      encoded += 1;
      // Persist small, resumable batches, not a long-lived main-process job.
      if (Date.now() - started > 15000) break;
    }
    if ((await selectedRoot(app)) !== root || hash(JSON.stringify(inventory(root))) !== plan.signature) {
      fail("index_stale", "Knowledge changed while encoding; no active index was replaced.");
    }
    const current = await (ports.createEmbedder || createKnowledgeEmbedder)(settings);
    if (current.key !== embedder.key) fail("model_changed", "Embedding model changed while encoding; retry the rebuild.");
    // Empty corpora use a marker dimension; no vectors are searched.
    if (!stage.dimension) stage.dimension = 1;
    stage.updatedAt = new Date().toISOString();
    if (Buffer.byteLength(JSON.stringify(stage)) > 64 * 1024 * 1024 - 1) fail("index_capacity", "Semantic cache exceeds 64 MiB; the active index is unchanged.");
    atomicJson(stagePath, stage);
    const complete = stage.entries.length === plan.windows.length;
    if (complete) atomicJson(path.join(directory, "semantic.json"), stage);
    return { status: complete ? "current" : "building", kind: "semantic", processed: stage.entries.length,
      total: plan.windows.length, remaining: plan.windows.length - stage.entries.length, model: stage.model,
      documentCount: plan.documents.length, sectionCount: plan.sections.length, updatedAt: stage.updatedAt };
  } finally { fs.closeSync(lock); fs.unlinkSync(lockPath); }
}

function preview(section, position = 0) {
  return { reference: section.reference, path: section.path, anchor: section.anchor, heading: section.heading.slice(0, 120),
    sectionRevision: hash(section.text), source: section.source, sourceTruncated: section.sourceTruncated,
    sourceLabel: section.sourceLabel, date: section.date, documentDate: section.documentDate,
    preview: section.text.slice(Math.max(0, position - 60), position + 240),
    detailRef: { tool: "knowledge_read", arguments: { action: "read", reference: section.reference } } };
}
function searchOptions(input) {
  const { query, mode = "exact", limit = 10, offset = 0, minimumScore = 0.55, textMatch = "literal" } = input || {};
  if (typeof query !== "string" || !query.trim() || query.length > 500) fail("invalid_query", "Provide query text of 1..500 characters.");
  if (!["exact", "semantic", "hybrid"].includes(mode)) fail("invalid_mode", "Choose exact, semantic or hybrid.");
  if (!["literal", "folded"].includes(textMatch)) fail("invalid_mode", "Choose literal or folded text matching.");
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) fail("invalid_page", "Use offset >= 0 and limit 1..50.");
  if (typeof minimumScore !== "number" || !Number.isFinite(minimumScore) || minimumScore < -1 || minimumScore > 1) fail("invalid_score", "minimumScore must be within -1..1.");
  return { query: textMatch === "folded" ? query.trim() : query, mode, limit, offset, minimumScore, textMatch };
}
async function searchKnowledge(app, input, settings = {}, ports = {}) {
  const { query, mode, limit, offset, minimumScore, textMatch } = searchOptions(input);
  const root = await selectedRoot(app);
  const plan = snapshot(root);
  const normalize = text => textMatch === "folded" ? text.toLowerCase() : text;
  const needle = normalize(query);
  const position = text => normalize(text).indexOf(needle);
  const exact = plan.sections.filter((section) => position(section.text) >= 0);
  if (textMatch === "folded") {
    const rank = section => position(section.heading) >= 0 ? 0 : position(section.title) >= 0 ? 1 : 2;
    exact.sort((a, b) => rank(a) - rank(b));
  }
  const exactByRef = new Map(exact.map((section, i) => [section.reference, i]));
  let scores = new Map();
  let indexStatus = "not_required";
  let semanticError = null;
  if (mode !== "exact") {
    try {
      const index = readCache(path.join(stateDirectory(app, root), "semantic.json"));
      if (!index) fail("index_missing", "Build the local semantic index first.");
      validateIndex(index);
      if (index.signature !== plan.signature || !matchesPlan(index, plan)) fail("index_stale", "Knowledge has changed; rebuild the semantic index.");
      const embedder = await (ports.createEmbedder || createKnowledgeEmbedder)(settings);
      if (embedder.key !== index.modelKey) fail("model_changed", "The configured model changed; rebuild the semantic index.");
      if (plan.windows.length) {
        // Query length is bounded; split/average long queries without silently
        // dropping a suffix at the model context limit.
        const chars = Array.from(query);
        const vectors = [];
        for (let i = 0; i < chars.length; i += WINDOW) vectors.push(normalizedVector(await embedder.embed(chars.slice(i, i + WINDOW).join("")), index.dimension));
        const queryVector = normalizedVector(vectors[0].map((_, i) => vectors.reduce((sum, vector) => sum + vector[i], 0) / vectors.length));
        for (let i = 0; i < index.entries.length; i += 1) {
          const entry = index.entries[i];
          const vector = normalizedVector(entry.vector, index.dimension);
          const score = Math.max(-1, Math.min(1, vector.reduce((sum, value, j) => sum + value * queryVector[j], 0)));
          if (score >= minimumScore && (!scores.has(entry.reference) || score > scores.get(entry.reference).score)) {
            scores.set(entry.reference, { score, start: plan.windows[i].start });
          }
        }
      }
      const current = await (ports.createEmbedder || createKnowledgeEmbedder)(settings);
      if (current.key !== embedder.key) fail("model_changed", "The model changed during search.");
      indexStatus = "current";
    } catch (error) {
      if (mode === "semantic") throw error;
      semanticError = { code: error.code || "semantic_failed", message: error.message };
      indexStatus = semanticError.code;
      scores = new Map();
    }
  }
  if ((await selectedRoot(app)) !== root || hash(JSON.stringify(inventory(root))) !== plan.signature) fail("index_stale", "Knowledge changed during search; retry against current text.");
  const semantic = [...scores.entries()].sort((a, b) => b[1].score - a[1].score || a[0].localeCompare(b[0]));
  const semanticRank = new Map(semantic.map(([reference], i) => [reference, i]));
  let sections = mode === "exact" ? exact : plan.sections.filter((section) => scores.has(section.reference) || (mode === "hybrid" && exactByRef.has(section.reference)));
  const rrf = (reference) => (exactByRef.has(reference) ? 1 / (60 + exactByRef.get(reference) + 1) : 0)
    + (semanticRank.has(reference) ? 1 / (60 + semanticRank.get(reference) + 1) : 0);
  if (mode === "semantic") sections.sort((a, b) => scores.get(b.reference).score - scores.get(a.reference).score || a.reference.localeCompare(b.reference));
  if (mode === "hybrid") sections.sort((a, b) => rrf(b.reference) - rrf(a.reference) || a.reference.localeCompare(b.reference));
  return { status: semanticError ? "partial" : sections.length ? "ok" : "no_results", mode, total: sections.length, offset, limit,
    hasMore: offset + limit < sections.length, rootFingerprint: hash(root), source: "current_markdown", index: { status: indexStatus }, ...(semanticError ? { semanticError } : {}),
    items: sections.slice(offset, offset + limit).map((section) => ({
      ...preview(section, exactByRef.has(section.reference) ? position(section.text) : Array.from(section.text).slice(0, scores.get(section.reference)?.start || 0).join("").length),
      matchedBy: [...(exactByRef.has(section.reference) ? ["exact"] : []), ...(scores.has(section.reference) ? ["semantic"] : [])],
      ...(scores.has(section.reference) ? { semanticScore: scores.get(section.reference).score } : {}),
      ...(mode === "hybrid" ? { rankScore: rrf(section.reference) } : {})
    })) };
}
module.exports = { searchKnowledge, rebuildKnowledgeSearchIndex, snapshot, validateIndex };
