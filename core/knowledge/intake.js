const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { getKnowledgeRootPreference } = require("./preferences");
const { KnowledgeLibraryError, validateRoot, safePath, collectDocuments, documentSections,
  documentLinks, visibleLines, readKnowledgeDocument } = require("./library");

const previews = new Map();
const TTL = 30 * 60 * 1000;
const { hash, stateDirectory, atomicJson, inventory, semanticCacheStatus } = require("./storage");
const fail = (code, message) => { throw new KnowledgeLibraryError(code, message); };

async function selectedRoot(app) {
  const preference = await getKnowledgeRootPreference(app);
  if (!["ok", "empty_corpus"].includes(preference.status)) {
    fail(preference.status, preference.message || "Select an available knowledge directory in Desktop settings.");
  }
  return validateRoot(preference.root);
}

function field(value, name, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\r\n\0]/u.test(value)) {
    fail("invalid_draft", `${name} must be a nonempty single line (maximum ${max} characters).`);
  }
  return value.trim();
}

// Only new files and append-only sections are supported. Existing bytes and
// anchors are never edited or silently replaced by this intake service.
function targetPath(root, reference, createParents = false) {
  if (typeof reference !== "string" || !/^(notes|topics|inbox)\//u.test(reference)
    || reference.includes("\\") || reference.includes("\0") || !reference.endsWith(".md")
    || reference.split("/").some((part) => !part || part === "." || part === "..")
    || /[#?]/u.test(reference) || reference.length > 500) {
    fail("invalid_reference", "Intake requires a Markdown path inside notes/, topics/ or inbox/.");
  }
  let current = root;
  for (const part of reference.split("/").slice(0, -1)) {
    current = path.join(current, part);
    if (!fs.existsSync(current) && createParents) fs.mkdirSync(current);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) fail("outside_root", "Intake parent must be a real directory.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const full = path.join(root, reference);
  try {
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink() || !stat.isFile()) fail("outside_root", "Intake target must be a regular file.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return full;
}

function normalizeDraft(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("invalid_draft", "Provide a structured draft.");
  const { mode, path: reference } = input;
  if (!["create", "append"].includes(mode)) fail("invalid_draft", "mode must be create or append.");
  const title = mode === "create" ? field(input.title, "title", 240) : "";
  if (!Array.isArray(input.sections) || input.sections.length < 1 || input.sections.length > 20) {
    fail("invalid_draft", "Provide 1..20 complete sections.");
  }
  const sections = input.sections.map((section) => {
    if (!section || typeof section !== "object") fail("invalid_draft", "Invalid section.");
    const anchor = field(section.anchor, "anchor", 100);
    if (!/^[a-zA-Z0-9_-]+$/u.test(anchor)) fail("invalid_anchor", "Use a stable alphanumeric anchor.");
    const heading = field(section.heading, "heading", 240);
    if (typeof section.body !== "string" || !section.body.trim() || Buffer.byteLength(section.body) > 24 * 1024) {
      fail("invalid_draft", "Section body must contain 1..24576 UTF-8 bytes.");
    }
    // One structured section is one stable anchor. Subsections must be submitted
    // separately so metadata and attribution do not silently change scope.
    if (visibleLines(section.body).some(({ value }) => /^(?:#{1,6}\s|\s*<a\s)/u.test(value))) {
      fail("invalid_draft", "Submit headings and anchors as separate structured sections.");
    }
    const source = field(section.source, "source");
    const date = field(section.date, "date", 10);
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(Date.parse(date))
      || new Date(date).toISOString().slice(0, 10) !== date) fail("invalid_draft", "Use a real YYYY-MM-DD source date.");
    if (!["source_statement", "agent_synthesis", "user_stated"].includes(section.attribution)) {
      fail("invalid_draft", "Distinguish source_statement, agent_synthesis and user_stated.");
    }
    const relations = section.relations === undefined ? [] : section.relations;
    if (!Array.isArray(relations) || relations.length > 30) fail("invalid_draft", "Provide at most 30 reviewed relations per section.");
    return { anchor, heading, body: section.body.trim(), source, date, attribution: section.attribution,
      relations: relations.map((relation) => ({ reference: field(relation?.reference, "relation.reference", 600),
        reason: field(relation?.reason, "relation.reason"), reviewed: relation?.reviewed === true })) };
  });
  if (new Set(sections.map((section) => section.anchor)).size !== sections.length) fail("duplicate_anchor", "Draft anchors must be unique.");
  const pending = typeof reference === "string" && reference.startsWith("inbox/");
  const pendingReason = pending ? field(input.pendingReason, "pendingReason") : "";
  const nextStep = pending ? field(input.nextStep, "nextStep") : "";
  const kbId = mode === "create" && typeof reference === "string" && reference.startsWith("notes/")
    ? `desktop-${randomUUID()}` : "";
  return { mode, path: reference, title, sections, pendingReason, nextStep, kbId };
}

function render(draft) {
  const attribution = { source_statement: "来源陈述", agent_synthesis: "Agent 提炼", user_stated: "用户明确表达" };
  const parts = draft.mode === "create" ? [draft.kbId ? `---\nkb_id: ${draft.kbId}\n---\n\n# ${draft.title}` : `# ${draft.title}`] : [];
  if (draft.pendingReason) parts.push(`待整理原因：${draft.pendingReason}\n\n下一步：${draft.nextStep}`);
  for (const section of draft.sections) {
    parts.push(`<a id="${section.anchor}"></a>\n## ${section.heading}\n\n来源：${section.source}\n\n日期：${section.date} · 归属：${attribution[section.attribution]}\n\n${section.body}`);
    for (const relation of section.relations) parts.push(`关联说明：${relation.reason}`);
  }
  const text = parts.join("\n\n") + "\n";
  if (Buffer.byteLength(text) > 48 * 1024) fail("draft_too_large", "Intake draft exceeds 48 KiB.");
  return text;
}

function validateDraft(root, draft) {
  const target = targetPath(root, draft.path);
  const exists = fs.existsSync(target);
  if (draft.mode === "create" && exists) fail("conflict", "Target already exists; read it before preparing an append.");
  if (draft.mode === "append" && !exists) fail("missing_file", "Append target is missing.");
  const before = exists ? readKnowledgeDocument(root, draft.path).text : "";
  const addition = (before ? (before.endsWith("\n") ? "\n" : "\n\n") : "") + render(draft);
  const text = before + addition;
  if (Buffer.byteLength(text) > 512 * 1024) fail("document_too_large", "Result exceeds the document reading limit.");
  for (const { value } of visibleLines(addition)) {
    const prose = value.replace(/(`+).*?\1/gu, "");
    if (/\[[^\]]+\]\s*\[|^\s{0,3}\[[^\]]+\]:|<a\b[^>]*\bhref\s*=|!\[/iu.test(prose)) {
      fail("unsupported_link", "Use inline Markdown links for intake; reference links, HTML links and embedded images are not validated yet.");
    }
  }
  const document = { path: draft.path, text, sections: documentSections(draft.path, text) };
  const anchors = document.sections.map((section) => section.anchor).filter(Boolean);
  if (new Set(anchors).size !== anchors.length) fail("duplicate_anchor", "Result would contain duplicate anchors.");
  if (draft.sections.some((section) => !anchors.includes(section.anchor))) {
    fail("invalid_anchor", "A section anchor is hidden by Markdown syntax, such as an unclosed code fence.");
  }
  const dependencies = {};
  const resolve = (reference) => {
    if (reference === draft.path) return document;
    const found = readKnowledgeDocument(root, reference);
    dependencies[reference] = hash(found.text);
    return found;
  };
  const links = documentLinks(root, document, resolve);
  if (links.broken.length) fail("invalid_links", `Broken link: ${links.broken[0].target} (${links.broken[0].reason}).`);
  for (const section of draft.sections) {
    const edges = links.edges.filter((edge) => edge.sourceAnchor === section.anchor);
    for (const edge of edges) {
      const reference = `${edge.target}${edge.anchor ? `#${edge.anchor}` : ""}`;
      const relation = section.relations.find((item) => item.reference === reference);
      if (!edge.anchor || !relation?.reviewed) fail("unreviewed_link", "Internal links require a section anchor and a reviewed relation with a reason.");
    }
    for (const relation of section.relations) {
      if (!relation.reviewed || !edges.some((edge) => `${edge.target}#${edge.anchor}` === relation.reference)) {
        fail("invalid_relation", "Each relation must correspond to a reviewed inline link in the same section.");
      }
    }
  }
  return { target, before, addition, text, dependencies, links };
}

async function knowledgeIndexStatus(app) {
  const root = await selectedRoot(app);
  const semantic = semanticCacheStatus(app, root);
  let stored;
  try { stored = JSON.parse(fs.readFileSync(path.join(stateDirectory(app, root), "index.json"), "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return { status: "missing", kind: "structural", semantic: semanticCacheStatus(app, root) };
    if (error instanceof SyntaxError) return { status: "corrupt", kind: "structural", semantic: semanticCacheStatus(app, root) };
    throw error;
  }
  if (!stored || !Array.isArray(stored.documents) || typeof stored.updatedAt !== "string") {
    return { status: "corrupt", kind: "structural", semantic: semanticCacheStatus(app, root) };
  }
  return { status: JSON.stringify(stored.documents) === JSON.stringify(inventory(root)) ? "current" : "stale",
    kind: "structural", semantic, updatedAt: stored.updatedAt };
}

async function rebuildKnowledgeIndex(app) {
  const root = await selectedRoot(app);
  const documents = inventory(root);
  atomicJson(path.join(stateDirectory(app, root), "index.json"), { updatedAt: new Date().toISOString(), documents });
  return { ...await knowledgeIndexStatus(app), documentCount: documents.length };
}

async function previewKnowledgeIntake(app, input, owner = "desktop") {
  const root = await selectedRoot(app);
  const draft = normalizeDraft(input);
  const checked = validateDraft(root, draft);
  for (const [key, value] of previews) if (value.expiresAt <= Date.now()) previews.delete(key);
  if (previews.size >= 32) fail("preview_capacity", "Too many active previews; finish them or wait for expiry.");
  const token = randomUUID();
  const expiresAt = Date.now() + TTL;
  previews.set(token, { root, userData: app.getPath("userData"), owner, draft,
    addition: checked.addition, createdAt: new Date().toISOString(),
    revision: hash(checked.before), dependencies: checked.dependencies, expiresAt });
  return { status: "preview", token, expiresAt: new Date(expiresAt).toISOString(), path: draft.path, mode: draft.mode,
    baseRevision: hash(checked.before), addition: checked.addition, links: "valid",
    sections: draft.sections.map(({ anchor, source, date, attribution }) => ({ anchor, source, date, attribution })),
    index: { kind: "structural", semantic: semanticCacheStatus(app, root), excluded: draft.path.startsWith("inbox/") } };
}

async function commitKnowledgeIntake(app, token, owner = "desktop") {
  const root = await selectedRoot(app);
  const preview = previews.get(token);
  if (!preview || preview.expiresAt <= Date.now()) fail("preview_expired", "Prepare a new preview; tokens expire after 30 minutes or restart.");
  if (preview.root !== root || preview.userData !== app.getPath("userData") || preview.owner !== owner) {
    fail("preview_mismatch", "Preview belongs to another directory or caller.");
  }
  if (preview.receipt) return preview.receipt;
  const state = stateDirectory(app, root);
  fs.mkdirSync(state, { recursive: true });
  // Cross-process lock covers Desktop intake callers. External editors are
  // checked by content and inode before append, and exact read-back afterwards.
  const lockPath = path.join(state, "intake.lock");
  let lock;
  try { lock = fs.openSync(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") fail("intake_busy", "Another intake is active, or a crash left a lock; inspect it before recovery."); throw error; }
  let attempted = false;
  let recoveryPath = null;
  let receipt;
  let fd;
  try {
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, token, path: preview.draft.path }));
    const checked = validateDraft(root, preview.draft);
    if (hash(checked.before) !== preview.revision || JSON.stringify(checked.dependencies) !== JSON.stringify(preview.dependencies)) {
      fail("conflict", "The document or a linked source changed after preview; read it and prepare a new preview.");
    }
    const target = targetPath(root, preview.draft.path, true);
    if (preview.draft.mode === "append") {
      recoveryPath = path.join(state, "recovery", `${token}.md`);
      fs.mkdirSync(path.dirname(recoveryPath), { recursive: true });
      const backupFd = fs.openSync(recoveryPath, "wx", 0o600);
      try { fs.writeFileSync(backupFd, checked.before); fs.fsyncSync(backupFd); }
      finally { fs.closeSync(backupFd); }
      if (fs.readFileSync(recoveryPath, "utf8") !== checked.before) fail("backup_failed", "Recovery copy did not match the original.");
      fd = fs.openSync(target, fs.constants.O_RDWR | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
      const opened = fs.fstatSync(fd);
      const current = fs.lstatSync(safePath(root, preview.draft.path));
      if (opened.ino !== current.ino || opened.dev !== current.dev || hash(fs.readFileSync(fd)) !== preview.revision) {
        fail("conflict", "Target changed before append.");
      }
    } else {
      fd = fs.openSync(target, "wx", 0o600);
    }
    attempted = true;
    fs.writeFileSync(fd, checked.addition);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    const written = readKnowledgeDocument(root, preview.draft.path);
    if (written.text !== checked.text) fail("readback_conflict", "Read-back differs from the planned content; inspect the file and recovery copy.");
    const links = documentLinks(root, written);
    let index;
    try {
      atomicJson(path.join(state, "index.json"), { updatedAt: new Date().toISOString(), documents: inventory(root) });
      index = { status: "current", kind: "structural", semantic: semanticCacheStatus(app, root), excluded: preview.draft.path.startsWith("inbox/") };
    } catch (error) { index = { status: "failed", code: error.code || "index_failed", kind: "structural", semantic: semanticCacheStatus(app, root) }; }
    receipt = { status: links.broken.length || index.status === "failed" ? "partial" : "saved", token,
      path: preview.draft.path, write: "saved", readback: "verified", revision: hash(written.text), recoveryPath,
      sections: preview.draft.sections.map(({ anchor, source, date, attribution }) => ({ reference: `${written.path}#${anchor}`, source, date, attribution })),
      links: { status: links.broken.length ? "invalid" : "valid", outgoing: links.edges.length, broken: links.broken.slice(0, 10) }, index };
  } catch (error) {
    if (!attempted) throw error;
    receipt = { status: "partial", token, path: preview.draft.path, write: "uncertain", readback: "failed",
      code: error.code || "write_failed", message: error.message, recoveryPath, index: { status: "stale", semantic: semanticCacheStatus(app, root) } };
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
  // Cache before persisting the receipt: a retry cannot append a second time.
  receipt.createdAt = new Date().toISOString();
  preview.receipt = receipt;
  try { atomicJson(path.join(state, "receipts", `${token}.json`), receipt); }
  catch (error) { receipt.status = "partial"; receipt.receiptPersistence = { status: "failed", code: error.code || "receipt_failed" }; }
  return receipt;
}

function receiptFile(app, root, token) {
  if (typeof token !== "string" || !/^[a-f0-9-]{36}$/u.test(token)) fail("invalid_reference", "Invalid activity reference.");
  const directory = path.join(stateDirectory(app, root), "receipts");
  // The state directory is private application data; refuse linked receipt
  // directories/files rather than treating them as product history.
  for (const part of [stateDirectory(app, root), directory]) {
    if (fs.lstatSync(part).isSymbolicLink()) fail("outside_root", "Receipt directory cannot be a symlink.");
  }
  const full = path.join(directory, `${token}.json`);
  const stat = fs.lstatSync(full);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024) fail("invalid_receipt", "Receipt is not a bounded regular file.");
  return { full, stat };
}

function readReceipt(app, root, token) {
  const { full, stat } = receiptFile(app, root, token);
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(full, "utf8")); }
  catch (error) { if (error instanceof SyntaxError) fail("invalid_receipt", "Receipt is not valid JSON."); throw error; }
  if (!receipt || receipt.token !== token || !["saved", "partial"].includes(receipt.status) || typeof receipt.path !== "string" || receipt.path.length > 500) {
    fail("invalid_receipt", "Receipt has an invalid shape.");
  }
  return { ...receipt, createdAt: receipt.createdAt || stat.mtime.toISOString() };
}

function currentPreviews(app, root) {
  return [...previews.entries()].filter(([, item]) => item.root === root && item.userData === app.getPath("userData") && item.expiresAt > Date.now());
}

async function listKnowledgeActivity(app, { offset = 0, limit = 10 } = {}) {
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) fail("invalid_page", "Use offset >= 0 and limit 1..50.");
  const root = await selectedRoot(app);
  const byId = new Map();
  const issues = [];
  const directory = path.join(stateDirectory(app, root), "receipts");
  try {
    if (fs.lstatSync(directory).isSymbolicLink()) fail("outside_root", "Receipt directory cannot be a symlink.");
    for (const name of fs.readdirSync(directory)) {
      if (!name.endsWith(".json")) continue;
      const token = name.slice(0, -5);
      try {
        const receipt = readReceipt(app, root, token);
        byId.set(token, { id: token, kind: "receipt", path: receipt.path, status: receipt.status,
          createdAt: receipt.createdAt, write: receipt.write, index: receipt.index?.status });
      } catch (error) { issues.push({ file: name, code: error.code || "invalid_receipt" }); }
    }
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  for (const [id, preview] of currentPreviews(app, root)) {
    const receipt = preview.receipt;
    byId.set(id, { id, kind: receipt ? "receipt" : "draft", path: preview.draft.path,
      status: receipt?.status || "preview", createdAt: receipt?.createdAt || preview.createdAt,
      write: receipt?.write, index: receipt?.index?.status });
  }
  const items = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { status: issues.length ? "partial" : "ok", items: items.slice(offset, offset + limit), total: items.length,
    offset, limit, hasMore: offset + limit < items.length, issueCount: issues.length, issues: issues.slice(0, 10) };
}

async function readKnowledgeActivity(app, id) {
  const root = await selectedRoot(app);
  const preview = currentPreviews(app, root).find(([token]) => token === id)?.[1];
  if (preview?.receipt) return { kind: "receipt", ...preview.receipt };
  if (preview) return { kind: "draft", status: "preview", path: preview.draft.path, addition: preview.addition,
    expiresAt: new Date(preview.expiresAt).toISOString(), createdAt: preview.createdAt };
  try { return { kind: "receipt", ...readReceipt(app, root, id) }; }
  catch (error) { if (error.code === "ENOENT") fail("activity_missing", "Draft expired or receipt is unavailable."); throw error; }
}

module.exports = { selectedRoot, previewKnowledgeIntake, commitKnowledgeIntake, knowledgeIndexStatus, rebuildKnowledgeIndex,
  listKnowledgeActivity, readKnowledgeActivity };
