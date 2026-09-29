const fs = require("fs");
const path = require("path");

const CATALOG_DIRS = ["notes", "topics"];
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_DOCUMENT_BYTES = 512 * 1024;

class KnowledgeLibraryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "KnowledgeLibraryError";
    this.code = code;
  }
}

function rethrowFileError(error) {
  if (error?.code === "EACCES" || error?.code === "EPERM") {
    throw new KnowledgeLibraryError("permission_denied", "Knowledge files cannot be read.");
  }
  throw error;
}

function validateRoot(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) {
    throw new KnowledgeLibraryError("root_not_selected", "Choose an absolute knowledge directory.");
  }
  let stat;
  try {
    stat = fs.lstatSync(root);
  } catch (error) {
    if (error.code === "ENOENT") throw new KnowledgeLibraryError("root_missing", "Knowledge directory is unavailable.");
    if (error.code === "EACCES" || error.code === "EPERM") throw new KnowledgeLibraryError("permission_denied", "Knowledge directory cannot be read.");
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new KnowledgeLibraryError("invalid_root", "Knowledge root must be a directory, not a symbolic link.");
  }
  return path.resolve(root);
}

function safePath(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0")) {
    throw new KnowledgeLibraryError("invalid_reference", "Choose a relative path within the knowledge directory.");
  }
  const segments = relativePath.replace(/\\/g, "/").split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new KnowledgeLibraryError("invalid_reference", "Knowledge path cannot leave the selected directory.");
  }
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === "ENOENT") throw new KnowledgeLibraryError("missing_file", "Knowledge document is missing.");
      if (error.code === "EACCES" || error.code === "EPERM") throw new KnowledgeLibraryError("permission_denied", "Knowledge document cannot be read.");
      throw error;
    }
    if (stat.isSymbolicLink()) throw new KnowledgeLibraryError("outside_root", "Knowledge path contains a symbolic link.");
  }
  if (path.extname(current).toLowerCase() !== ".md" || !fs.statSync(current).isFile()) {
    throw new KnowledgeLibraryError("invalid_reference", "Knowledge reference must name a Markdown file.");
  }
  return current;
}

function collectDocuments(root, folders = CATALOG_DIRS) {
  const documents = [];
  for (const folder of folders) {
    const base = path.join(root, folder);
    let baseStat;
    try {
      baseStat = fs.lstatSync(base);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      rethrowFileError(error);
    }
    if (baseStat.isSymbolicLink()) throw new KnowledgeLibraryError("outside_root", "Knowledge catalog contains a symbolic link.");
    if (!baseStat.isDirectory()) throw new KnowledgeLibraryError("invalid_root", "Knowledge catalog folder is not a directory.");
    const stack = [base];
    while (stack.length) {
      const directory = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
      } catch (error) {
        rethrowFileError(error);
      }
      for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new KnowledgeLibraryError("outside_root", "Knowledge catalog contains a symbolic link.");
        if (entry.isDirectory()) stack.push(full);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          documents.push(path.relative(root, full).split(path.sep).join("/"));
        }
      }
    }
  }
  return documents.sort((a, b) => a.localeCompare(b));
}

function visibleLines(text) {
  let fence = null;
  return text.split(/\r?\n/u).flatMap((value, index) => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/u.exec(value)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return [];
    }
    return fence ? [] : [{ number: index + 1, value }];
  });
}

function slug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, "").trim().replace(/\s+/gu, "-");
}

function documentSections(relativePath, text) {
  const visible = visibleLines(text);
  const headings = [];
  const counts = new Map();
  let pending = null;
  for (const { number, value } of visible) {
    const anchor = /^<a id="([a-zA-Z0-9_-]+)"><\/a>\s*$/u.exec(value);
    if (anchor) {
      pending = { id: anchor[1], line: number };
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(value);
    if (heading) {
      const base = slug(heading[2]);
      const seen = counts.get(base) || 0;
      counts.set(base, seen + 1);
      headings.push({ line: number, start: pending?.line || number, level: heading[1].length,
        heading: heading[2], anchor: pending?.id || `${base}${seen ? `-${seen}` : ""}` });
      pending = null;
    } else if (value.trim()) pending = null;
  }
  const lines = text.split(/\r?\n/u);
  const title = headings.find((item) => item.level === 1)?.heading || path.basename(relativePath, ".md");
  if (!headings.length || headings[0].start > 1) {
    headings.unshift({ line: 1, start: 1, level: 0, heading: title, anchor: "" });
  }
  return headings.map((item, index) => ({
    path: relativePath,
    anchor: item.anchor,
    heading: item.heading,
    title,
    line: item.line,
    endLine: index + 1 < headings.length ? headings[index + 1].start - 1 : lines.length,
    text: lines.slice(item.line - 1, index + 1 < headings.length ? headings[index + 1].start - 1 : lines.length).join("\n").trim()
  })).filter((item) => item.text && !(item.text.startsWith("---") && /^kb_id:/mu.test(item.text)));
}

function readKnowledgeDocument(rootInput, relativePath) {
  const root = validateRoot(rootInput);
  const full = safePath(root, relativePath);
  const size = fs.statSync(full).size;
  if (size > MAX_DOCUMENT_BYTES) throw new KnowledgeLibraryError("document_too_large", "Knowledge document exceeds the reading limit.");
  let text;
  try {
    text = fs.readFileSync(full, "utf8");
  } catch (error) {
    rethrowFileError(error);
  }
  return { path: relativePath.replace(/\\/g, "/"), text, sections: documentSections(relativePath, text) };
}

function listKnowledgeDocuments(rootInput, { offset = 0, limit = DEFAULT_PAGE_SIZE, folder = "" } = {}) {
  const root = validateRoot(rootInput);
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new KnowledgeLibraryError("invalid_page", "Knowledge page must use a nonnegative offset and limit 1..50.");
  }
  if (!["", "notes", "topics", "inbox"].includes(folder)) {
    throw new KnowledgeLibraryError("invalid_folder", "Choose notes, topics or inbox.");
  }
  const all = collectDocuments(root, folder ? [folder] : CATALOG_DIRS);
  if (!all.length) return { status: "empty_corpus", total: 0, items: [], offset, limit };
  const items = all.slice(offset, offset + limit).map((relativePath) => {
    const document = readKnowledgeDocument(root, relativePath);
    return { path: relativePath, title: document.sections.find((section) => section.heading)?.title || path.basename(relativePath, ".md"),
      sectionCount: document.sections.length };
  });
  return { status: "ok", total: all.length, items, offset, limit, hasMore: offset + items.length < all.length };
}

function inspectKnowledgeRoot(rootInput) {
  const root = validateRoot(rootInput);
  const documents = collectDocuments(root);
  return { root, status: documents.length ? "ok" : "empty_corpus", documentCount: documents.length };
}

function readKnowledgeSection(rootInput, reference) {
  if (typeof reference !== "string") throw new KnowledgeLibraryError("invalid_reference", "Knowledge reference is required.");
  const delimiter = reference.indexOf("#");
  const relativePath = delimiter < 0 ? reference : reference.slice(0, delimiter);
  const anchor = delimiter < 0 ? "" : reference.slice(delimiter + 1);
  const document = readKnowledgeDocument(rootInput, relativePath);
  if (!anchor) return document;
  const section = document.sections.find((item) => item.anchor === anchor);
  if (!section) throw new KnowledgeLibraryError("anchor_missing", "Knowledge section anchor is missing.");
  return { status: "ok", ...section };
}

function documentLinks(root, document, resolveDocument = (reference) => readKnowledgeDocument(root, reference)) {
  const edges = [];
  const broken = [];
  const external = [];
  const linkPattern = /(?<!!)\[([^\]\n]+)\]\((<[^>]+>|[^)\s]+)\)/gu;
  for (const { number, value } of visibleLines(document.text)) {
    const withoutCode = value.replace(/(`+).*?\1/gu, "");
    for (const match of withoutCode.matchAll(linkPattern)) {
      const href = match[2].replace(/^<|>$/gu, "");
      if (/^[a-z][a-z0-9+.-]*:/iu.test(href) || href.startsWith("/")) {
        external.push({ source: document.path, line: number, target: href });
        continue;
      }
      let decoded;
      try {
        decoded = decodeURIComponent(href);
      } catch {
        broken.push({ source: document.path, line: number, target: href, reason: "invalid_link" });
        continue;
      }
      const delimiter = decoded.indexOf("#");
      const filePart = delimiter < 0 ? decoded : decoded.slice(0, delimiter);
      const anchor = delimiter < 0 ? "" : decoded.slice(delimiter + 1);
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(document.path), filePart || path.posix.basename(document.path)));
      const sourceSection = [...document.sections].reverse().find((section) => section.line <= number);
      const edge = { source: document.path, sourceAnchor: sourceSection?.anchor || "", line: number,
        target, anchor, label: match[1].slice(0, 240) };
      if (target === ".." || target.startsWith("../") || path.posix.isAbsolute(target)) {
        external.push(edge);
        continue;
      }
      edges.push(edge);
      try {
        const targetDocument = resolveDocument(target);
        if (anchor && !targetDocument.sections.some((section) => section.anchor === anchor)) {
          broken.push({ ...edge, reason: "missing_anchor" });
        }
      } catch (error) {
        if (!(error instanceof KnowledgeLibraryError)) throw error;
        broken.push({ ...edge, reason: error.code });
      }
    }
  }
  return { edges, broken, external };
}

function getKnowledgeLinks(rootInput, reference, { incomingOffset = 0, outgoingOffset = 0, limit = DEFAULT_PAGE_SIZE } = {}) {
  if (![incomingOffset, outgoingOffset].every((value) => Number.isInteger(value) && value >= 0)
    || !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new KnowledgeLibraryError("invalid_page", "Knowledge links require nonnegative offsets and limit 1..50.");
  }
  const root = validateRoot(rootInput);
  const selected = readKnowledgeDocument(root, reference);
  const outgoing = documentLinks(root, selected);
  const incoming = [];
  const broken = [...outgoing.broken];
  for (const relativePath of collectDocuments(root)) {
    if (relativePath === selected.path) continue;
    const links = documentLinks(root, readKnowledgeDocument(root, relativePath));
    incoming.push(...links.edges.filter((edge) => edge.target === selected.path));
    broken.push(...links.broken.filter((edge) => edge.target === selected.path));
  }
  return { status: broken.length ? "invalid_links" : "ok", path: selected.path,
    outgoing: outgoing.edges.slice(outgoingOffset, outgoingOffset + limit), outgoingTotal: outgoing.edges.length,
    incoming: incoming.slice(incomingOffset, incomingOffset + limit), incomingTotal: incoming.length,
    broken: broken.slice(0, limit), brokenTotal: broken.length, externalReferences: outgoing.external.length };
}

module.exports = {
  validateRoot,
  safePath,
  collectDocuments,
  documentSections,
  documentLinks,
  visibleLines,
  KnowledgeLibraryError,
  getKnowledgeLinks,
  inspectKnowledgeRoot,
  listKnowledgeDocuments,
  readKnowledgeDocument,
  readKnowledgeSection
};
