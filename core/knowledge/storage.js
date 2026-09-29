const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const { collectDocuments, readKnowledgeDocument, KnowledgeLibraryError } = require("./library");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const stateDirectory = (app, root) => path.join(app.getPath("userData"), "knowledge-state", hash(root));
function atomicJson(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value) + "\n", { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function inventory(root) {
  return collectDocuments(root).map((reference) => {
    const document = readKnowledgeDocument(root, reference);
    return { path: reference, revision: hash(document.text), anchors: document.sections.map(({ anchor }) => anchor) };
  });
}
function readCache(target) {
  try {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024) throw new KnowledgeLibraryError("index_corrupt", "Knowledge index is not a bounded regular file.");
    return JSON.parse(fs.readFileSync(target, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new KnowledgeLibraryError("index_corrupt", "Knowledge index contains invalid JSON.");
    throw error;
  }
}
function semanticCacheStatus(app, root, documents) {
  try {
    const cached = readCache(path.join(stateDirectory(app, root), "semantic.json"));
    if (!cached) return "not_built";
    if (cached.schema !== 1 || !Array.isArray(cached.entries) || typeof cached.signature !== "string") return "corrupt";
    return cached.signature === hash(JSON.stringify(documents || inventory(root))) ? "current" : "stale";
  } catch (error) { return error.code === "index_corrupt" ? "corrupt" : "unavailable"; }
}
module.exports = { hash, stateDirectory, atomicJson, inventory, readCache, semanticCacheStatus };
