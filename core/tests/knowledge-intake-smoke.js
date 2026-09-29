const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { saveKnowledgeRootPreference } = require("../knowledge/preferences");
const { previewKnowledgeIntake, commitKnowledgeIntake, knowledgeIndexStatus } = require("../knowledge/intake");
const { readKnowledgeSection, getKnowledgeLinks } = require("../knowledge/library");
const { createGatewayTools } = require("../gateway/tools");
const { serializeGatewayResult } = require("../gateway/result-budget");

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "claracore-intake-"));
  const root = path.join(temporary, "library");
  fs.mkdirSync(root);
  const app = { getPath: () => path.join(temporary, "userdata") };
  const section = (anchor, body = "Agent 整理来源、完整小节和有意义的关联；软件校验并写入，返回真实回执。") => ({
    anchor, heading: "对话整理与软件收录", body,
    source: "对话 01a0c369-ec5e-7162-a68d-a081aa2a3443：用户提出对话整理 MD 也应经软件收录", date: "2026-09-22", attribution: "agent_synthesis"
  });
  try {
    await assert.rejects(previewKnowledgeIntake(app, {}), { code: "not_selected" });
    await saveKnowledgeRootPreference(app, root);
    await assert.rejects(previewKnowledgeIntake(app, { mode: "create", title: "缺少路径", sections: [section("missing-path")] }), { code: "invalid_reference" });
    const caller = { agentId: "codex", clientId: "test", conversationId: "intake-smoke" };
    const { callToolBody, toolDefinitions } = createGatewayTools({ runtimeAppForGateway: () => app,
      currentMcpAgentId: () => caller.agentId, currentCallerContext: () => caller,
      textResult: (value) => ({ content: [{ type: "text", text: serializeGatewayResult(value) }] }) });
    const call = async (name, args) => {
      const result = await callToolBody(name, args, {}, {});
      return { ...JSON.parse(result.content[0].text), isError: Boolean(result.isError) };
    };
    assert(toolDefinitions().some(({ name }) => name === "knowledge_intake_preview"));
    const seed = { mode: "create", path: "notes/共同收录.md", title: "共同维护知识", sections: [section("intake")] };
    const first = await call("knowledge_intake_preview", seed);
    assert.equal(first.status, "preview");
    assert.equal(fs.existsSync(path.join(root, seed.path)), false, "Preview must not write Markdown");
    const saved = await call("knowledge_intake_commit", { token: first.token });
    assert.equal(saved.status, "saved");
    assert.match(fs.readFileSync(path.join(root, seed.path), "utf8"), /^---\nkb_id: desktop-[a-f0-9-]+\n---\n\n# 共同维护知识\n/u);
    assert.equal(saved.index.semantic, "not_built");
    assert.equal((await knowledgeIndexStatus(app)).status, "current");
    assert.equal((await call("knowledge_read", { action: "exact", query: "软件校验" })).total, 1);
    assert.match((await call("knowledge_read", { action: "read", reference: "notes/共同收录.md#intake" })).text, /软件校验/u);
    const linked = { mode: "create", path: "notes/回执边界.md", title: "收录回执的边界", sections: [{
      ...section("receipt", "收录回执证明内容已保存。它补充了[共同收录分工](./共同收录.md#intake)，但不能证明知识已经在后续使用中发挥作用。"),
      relations: [{ reference: "notes/共同收录.md#intake", reason: "补充分工之后的验收边界。", reviewed: true }]
    }] };
    const second = await call("knowledge_intake_preview", linked);
    const secondReceipt = await call("knowledge_intake_commit", { token: second.token });
    assert.equal(secondReceipt.status, "saved");
    const kbId = (relativePath) => /^kb_id: (.+)$/mu.exec(fs.readFileSync(path.join(root, relativePath), "utf8"))?.[1];
    assert.notEqual(kbId(seed.path), kbId(linked.path));
    assert.equal(getKnowledgeLinks(root, seed.path).incomingTotal, 1);
    assert.match(readKnowledgeSection(root, `${linked.path}#receipt`).text, /不能证明/u);
    assert.deepEqual(await call("knowledge_intake_commit", { token: second.token }), secondReceipt);
    const append = { mode: "append", path: seed.path, sections: [section("next", "下一步由用户检查阅读与关联跳转。自动化通过不等于人的使用验收。")] };
    const before = fs.readFileSync(path.join(root, seed.path), "utf8");
    const appendPreview = await previewKnowledgeIntake(app, append);
    const appended = await commitKnowledgeIntake(app, appendPreview.token);
    assert.equal(appended.status, "saved");
    assert.equal(fs.readFileSync(appended.recoveryPath, "utf8"), before);
    assert(fs.readFileSync(path.join(root, seed.path), "utf8").startsWith(before));
    assert.match(readKnowledgeSection(root, `${seed.path}#next`).text, /人的使用验收/u);
    await assert.rejects(previewKnowledgeIntake(app, append), { code: "duplicate_anchor" });
    const another = { ...append, sections: [section("concurrent")] };
    const conflict = await previewKnowledgeIntake(app, another);
    fs.appendFileSync(path.join(root, seed.path), "\n外部编辑器新增内容。\n");
    const externallyEdited = fs.readFileSync(path.join(root, seed.path), "utf8");
    await assert.rejects(commitKnowledgeIntake(app, conflict.token), { code: "conflict" });
    assert.equal(fs.readFileSync(path.join(root, seed.path), "utf8"), externallyEdited);
    assert.equal((await knowledgeIndexStatus(app)).status, "stale");
    const dependency = await previewKnowledgeIntake(app, { ...linked, path: "notes/dependency.md" });
    fs.appendFileSync(path.join(root, seed.path), "\n引用来源变更。\n");
    await assert.rejects(commitKnowledgeIntake(app, dependency.token), { code: "conflict" });
    assert.equal(fs.existsSync(path.join(root, "notes/dependency.md")), false);
    for (const bad of ["../escape.md", "notes/../escape.md", "notes/link/escape.md"]) {
      if (bad.includes("/link/")) fs.symlinkSync(temporary, path.join(root, "notes/link"));
      await assert.rejects(previewKnowledgeIntake(app, { ...seed, path: bad }));
      if (bad.includes("/link/")) fs.unlinkSync(path.join(root, "notes/link"));
    }
    await assert.rejects(previewKnowledgeIntake(app, { ...seed, path: "notes/broken.md", sections: [section("broken", "[缺失](./missing.md#none)")] }), { code: "invalid_links" });
    await assert.rejects(previewKnowledgeIntake(app, { ...seed, path: "notes/reference.md", sections: [section("reference", "[缺失][source]\n\n[source]: ./missing.md#none")] }), { code: "unsupported_link" });
    await assert.rejects(previewKnowledgeIntake(app, { ...linked, path: "notes/unreviewed.md", sections: [{ ...linked.sections[0], relations: [] }] }), { code: "unreviewed_link" });
    await assert.rejects(previewKnowledgeIntake(app, { ...seed, path: "notes/fence.md", sections: [section("fence", "```md\nopen fence"), section("hidden")] }), { code: "invalid_anchor" });
    await assert.rejects(previewKnowledgeIntake(app, { ...seed, path: "notes/date.md", sections: [{ ...section("date"), date: "2026-02-30" }] }), { code: "invalid_draft" });
    const owned = await previewKnowledgeIntake(app, { ...seed, path: "notes/owned.md" }, "one");
    await assert.rejects(commitKnowledgeIntake(app, owned.token, "two"), { code: "preview_mismatch" });
    const other = path.join(temporary, "other"); fs.mkdirSync(other);
    await saveKnowledgeRootPreference(app, other);
    await assert.rejects(commitKnowledgeIntake(app, owned.token, "one"), { code: "preview_mismatch" });
    await saveKnowledgeRootPreference(app, root);
    const pending = await previewKnowledgeIntake(app, { ...seed, path: "inbox/待整理.md", pendingReason: "值得保留但需要更多例子", nextStep: "下次相关研究时补充", sections: [section("pending")] });
    const pendingReceipt = await commitKnowledgeIntake(app, pending.token);
    assert.equal(pendingReceipt.status, "saved"); assert.equal(pendingReceipt.index.excluded, true);
    assert.equal((await call("knowledge_read", { action: "exact", query: "值得保留但需要更多例子" })).total, 0);
    // Inject an index write failure AFTER successful Markdown write. It must be
    // partial, retain the body, and retry without adding duplicate sections.
    const partialPreview = await previewKnowledgeIntake(app, { ...seed, path: "notes/partial.md" });
    const originalRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (to.endsWith("index.json")) { const error = new Error("Injected index failure"); error.code = "EACCES"; throw error; }
      return originalRename(from, to);
    };
    let partial;
    try { partial = await commitKnowledgeIntake(app, partialPreview.token); }
    finally { fs.renameSync = originalRename; }
    assert.equal(partial.status, "partial"); assert.equal(partial.write, "saved"); assert.equal(partial.index.status, "failed");
    assert.match(readKnowledgeSection(root, "notes/partial.md#intake").text, /软件校验/u);
    assert.deepEqual(await commitKnowledgeIntake(app, partialPreview.token), partial);
    assert.equal((await knowledgeIndexStatus(app)).status, "stale");
    const failed = await call("knowledge_intake_commit", { token: "unknown" });
    assert.equal(failed.isError, true); assert.equal(failed.code, "preview_expired");
    assert.equal((await call("knowledge_index_rebuild", {})).status, "current");
    assert.equal((await knowledgeIndexStatus(app)).status, "current");
    console.log(JSON.stringify({ suite: "knowledge-intake", gatewayRoundTrip: true, discussionCuration: true,
      appendRecovery: true, conflictsPreserveBody: true, indexFailureIsPartial: true, realCorpusWrites: 0 }));
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
