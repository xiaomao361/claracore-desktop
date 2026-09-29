const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  KnowledgeLibraryError,
  getKnowledgeLinks,
  listKnowledgeDocuments,
  readKnowledgeDocument,
  readKnowledgeSection
} = require("../knowledge/library");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "claracore-knowledge-read-"));
try {
  assert.deepEqual(listKnowledgeDocuments(root), { status: "empty_corpus", total: 0, items: [], offset: 0, limit: 10 });
  fs.mkdirSync(path.join(root, "notes"));
  fs.writeFileSync(path.join(root, "notes", "a.md"), [
    "---", "kb_id: sample", "created: 2026-09-22", "---", "# 第一篇", "", "<a id=\"first\"></a>", "## 有来源的结论",
    "来源：一次明确的讨论。", "", "```md", "## 这是代码，不是小节", "```", "",
    "<a id=\"second\"></a>", "## 相关补充", "详见 [另一篇](./b.md#target)。"
  ].join("\n"));
  fs.writeFileSync(path.join(root, "notes", "b.md"), "# 第二篇\n\n<a id=\"target\"></a>\n## 被引用的小节\n内容。\n[回到第一篇](./a.md#second)\n");

  const page = listKnowledgeDocuments(root, { limit: 1 });
  assert.equal(page.status, "ok");
  assert.equal(page.total, 2);
  assert.equal(page.items.length, 1);
  assert.equal(page.hasMore, true);
  assert.equal(listKnowledgeDocuments(root, { offset: 1, limit: 1 }).items.length, 1);

  const document = readKnowledgeDocument(root, "notes/a.md");
  assert.equal(document.sections.length, 3);
  assert.equal(document.sections.find((item) => item.anchor === "first")?.heading, "有来源的结论");
  assert.equal(document.sections.some((item) => item.heading === "这是代码，不是小节"), false);
  const section = readKnowledgeSection(root, "notes/a.md#second");
  assert.equal(section.heading, "相关补充");
  assert.match(section.text, /另一篇/u);
  const links = getKnowledgeLinks(root, "notes/a.md");
  assert.equal(links.status, "ok");
  assert.deepEqual(links.outgoing.map((edge) => `${edge.target}#${edge.anchor}`), ["notes/b.md#target"]);
  assert.deepEqual(links.incoming.map((edge) => `${edge.source}#${edge.sourceAnchor}`), ["notes/b.md#target"]);
  assert.equal(links.incomingTotal, 1);
  assert.equal(getKnowledgeLinks(root, "notes/a.md", { incomingOffset: 1 }).incoming.length, 0);
  assert.throws(() => getKnowledgeLinks(root, "notes/a.md", { limit: 51 }), { code: "invalid_page" });
  fs.appendFileSync(path.join(root, "notes", "b.md"), "[缺失文档](./missing.md#section)\n");
  const brokenLinks = getKnowledgeLinks(root, "notes/b.md");
  assert.equal(brokenLinks.status, "invalid_links");
  assert.equal(brokenLinks.brokenTotal, 1);
  assert.equal(brokenLinks.broken[0].reason, "missing_file");

  for (const reference of ["../outside.md", "notes/../outside.md", "/etc/passwd", "notes/missing.md"]) {
    assert.throws(() => readKnowledgeSection(root, reference), KnowledgeLibraryError);
  }
  assert.throws(() => readKnowledgeSection(root, "notes/a.md#missing"), { code: "anchor_missing" });
  fs.symlinkSync(path.join(root, "notes", "a.md"), path.join(root, "notes", "linked.md"));
  assert.throws(() => readKnowledgeDocument(root, "notes/linked.md"), { code: "outside_root" });
  assert.throws(() => listKnowledgeDocuments(root), { code: "outside_root" });
  fs.unlinkSync(path.join(root, "notes", "linked.md"));
  assert.throws(() => listKnowledgeDocuments(path.join(root, "unmounted")), { code: "root_missing" });
  console.log("Knowledge library read boundary: ok");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
