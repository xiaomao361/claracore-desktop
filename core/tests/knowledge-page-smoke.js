const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const markdown = require("../../app/knowledge-markdown");
const { createClaraCoreKnowledgeView } = require("../../app/views/knowledge");
const library = require("../knowledge/library");
const intake = require("../knowledge/intake");
const preferences = require("../knowledge/preferences");
const { registerIpcHandlers } = require("../../electron/ipc-handlers");
const { ipcChannel } = require("../../electron/ipc-contracts");

const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
async function until(predicate) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert(predicate(), "State did not settle");
}
async function main() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "claracore-knowledge-page-"));
  const root = path.join(fixture, "library"); fs.mkdirSync(root);
  const app = { getPath: () => path.join(fixture, "userdata") };
  const { document, window } = parseHTML(fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8"));
  const context = vm.createContext({ window, document });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../app/dom.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../app/i18n/zh.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../app/i18n/en.js"), "utf8"), context);
  const dom = window.ClaraCoreDom;
  const dictionary = window.ClaraCoreTranslationsZh;
  const english = window.ClaraCoreTranslationsEn;
  for (const element of dom.knowledgeView.querySelectorAll("[data-i18n], [data-i18n-aria-label]")) {
    const key = element.getAttribute("data-i18n") || element.getAttribute("data-i18n-aria-label");
    assert.equal(typeof dictionary[key], "string", `Missing Chinese UI translation: ${key}`);
    assert.equal(typeof english[key], "string", `Missing English UI translation: ${key}`);
  }
  for (const key of Object.keys(dictionary).filter((name) => name.startsWith("knowledge."))) {
    assert.equal(typeof english[key], "string", `Missing English knowledge translation: ${key}`);
    const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
    assert.deepEqual(placeholders(dictionary[key]), placeholders(english[key]), `Translation placeholders differ: ${key}`);
  }
  const t = (key, values = {}) => {
    assert.equal(typeof dictionary[key], "string", `Missing translation: ${key}`);
    return dictionary[key].replace(/\{(\w+)\}/gu, (_, name) => values[name] ?? "");
  };
  // LinkeDOM does not select a first option implicitly like a browser does.
  dom.knowledgeFolder.querySelector("option").selected = true;
  let openedExternal = "";
  let copiedReference = "";
  const api = {
    searchKnowledge: input => require("../knowledge/search").searchKnowledge(app, input),
    getKnowledgeRootPreference: () => preferences.getKnowledgeRootPreference(app),
    getKnowledgeIndexStatus: () => intake.knowledgeIndexStatus(app),
    listKnowledgeDocuments: async (options) => library.listKnowledgeDocuments(await intake.selectedRoot(app), options),
    readKnowledgeDocument: async (reference) => library.readKnowledgeDocument(await intake.selectedRoot(app), reference),
    getKnowledgeLinks: async (reference, options) => library.getKnowledgeLinks(await intake.selectedRoot(app), reference, options),
    listKnowledgeActivity: (options) => intake.listKnowledgeActivity(app, options),
    readKnowledgeActivity: (id) => intake.readKnowledgeActivity(app, id),
    previewKnowledgeIntake: (input) => intake.previewKnowledgeIntake(app, input),
    commitKnowledgeIntake: (token) => intake.commitKnowledgeIntake(app, token),
    rebuildKnowledgeIndex: () => intake.rebuildKnowledgeIndex(app),
    copyText: async (reference) => { copiedReference = reference; return true; },
    openKnowledgeSource: async (url) => { openedExternal = url; return true; }
  };
  const view = createClaraCoreKnowledgeView({ dom, api, t, markdown, formatLocalDateTime: (value) => value });
  try {
    await view.setActive(true);
    assert.match(dom.knowledgePageStatus.textContent, /尚未选择/u);
    assert.equal(dom.knowledgeCapturePreview.disabled, true);
    await preferences.saveKnowledgeRootPreference(app, root);
    fs.mkdirSync(path.join(root, "notes"));
    fs.mkdirSync(path.join(root, "topics"));
    fs.writeFileSync(path.join(root, "notes/a.md"), '---\nkb_id: test\ncreated: 2026-09-24\n---\n# 第一篇\n\n<a id="first"></a>\n## 来源与理解\n**完整小节**，详见[第二篇](./b.md#target)。\n\n来源：https://example.org/source\n\n<script>globalThis.compromised=true</script>\n\n| 条件 | 结果 |\n| --- | --- |\n| 明确来源 | 保留归属 |\n');
    fs.writeFileSync(path.join(root, "notes/b.md"), '# 第二篇\n\n<a id="target"></a>\n## 回执边界\n[第一篇](./a.md#first)\n');
    fs.writeFileSync(path.join(root, "topics/map.md"), '# 阅读主题\n\n[第一篇](../notes/a.md#first)\n');
    for (let index = 0; index < 10; index += 1) fs.writeFileSync(path.join(root, `notes/extra-${index}.md`), `# Extra ${index}\n`);
    await view.refresh();
    assert.equal(dom.knowledgeSemanticOptions.hidden, true);
    assert.equal(dom.knowledgeSearchPagination.hidden, true);
    assert.equal(dom.knowledgeSemanticHeading.textContent, t("knowledge.search.state.not_built"));
    assert.equal(dom.knowledgeSemanticBuild.textContent, t("knowledge.search.prepare"));
    assert.equal(dom.knowledgeIndexAlert.hidden, false, "Missing structural index needs a recovery action");
    dom.knowledgeToggleSearch.click();
    assert.equal(dom.knowledgeSearchPanel.hidden, false);
    dom.knowledgeToggleTools.click();
    assert.equal(dom.knowledgeSearchPanel.hidden, true, "Only one expanded tool panel stays open");
    assert.equal(dom.knowledgeToggleSearch.getAttribute("aria-expanded"), "false");
    dom.knowledgeToggleSearch.click();
    dom.knowledgeSearchQuery.value = "不存在的查询";
    dom.knowledgeSearchForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => dom.knowledgeSearchStatus.textContent === t("knowledge.search.empty"));
    assert.equal(dom.knowledgeSearchPagination.hidden, true, "Empty search does not show paging");

    dom.knowledgeSearchQuery.value = "完整小节";
    dom.knowledgeSearchForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => dom.knowledgeSearchResults.querySelectorAll("a").length === 1);
    assert.match(dom.knowledgeSearchResults.textContent, /文档创建 2026-09-24/u);
    assert.match(dom.knowledgeSearchResults.textContent, /来源：example.org/u);
    assert(!dom.knowledgeSearchResults.textContent.includes("小节日期"));
    dom.knowledgeSearchResults.querySelector("a").click();
    await until(() => view.state().selected === "notes/a.md#first");
    dom.knowledgeSearchMode.querySelector('[value="hybrid"]').selected = true;
    dom.knowledgeSearchMode.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(dom.knowledgeSemanticOptions.hidden, false, "Semantic controls appear only for semantic modes");
    dom.knowledgeSearchForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => dom.knowledgeSearchStatus.textContent === t("knowledge.search.partial"));
    assert.equal(dom.knowledgeSearchResults.querySelectorAll("a").length, 1);

    const indexBatch = deferred();
    let buildCalls = 0;
    api.rebuildKnowledgeSearchIndex = async () => { buildCalls += 1; return indexBatch.promise; };
    dom.knowledgeSemanticBuild.click();
    await until(() => buildCalls === 1);
    dom.knowledgeSemanticPause.click();
    assert.equal(dom.knowledgeSemanticStatus.textContent, t("knowledge.search.pausing"));
    indexBatch.resolve({ status: "building", processed: 20, total: 40 });
    await until(() => dom.knowledgeSemanticStatus.textContent.includes("已暂停"));
    assert.equal(buildCalls, 1);
    assert.equal(dom.knowledgeSemanticBuild.textContent, t("knowledge.search.resume"));
    assert.equal(dom.knowledgeSemanticProgress.value, 20);
    assert.equal(dom.knowledgeSemanticProgress.max, 40);
    const originalSearch = api.searchKnowledge;
    let resumedSearches = 0;
    api.searchKnowledge = async (input) => { resumedSearches += 1; return { ...await originalSearch({ ...input, mode: "exact" }), mode: input.mode }; };
    api.rebuildKnowledgeSearchIndex = async () => { buildCalls += 1; return { status: "current", processed: 40, total: 40 }; };
    await until(() => !dom.knowledgeSemanticBuild.disabled);
    dom.knowledgeSemanticBuild.click();
    await until(() => resumedSearches === 1 && dom.knowledgeSearchStatus.textContent === t("knowledge.search.count", { count: 1 }));
    assert.equal(buildCalls, 2);
    assert.equal(dom.knowledgeIndexAlert.hidden, true, "Explicit semantic update also refreshes the structural cache");
    assert.equal(dom.knowledgeSemanticBuild.hidden, true, "Ready data has no redundant rebuild action");
    assert.equal(dom.knowledgeSemanticProgress.hidden, true);
    api.searchKnowledge = originalSearch;
    const originalIndexStatus = api.getKnowledgeIndexStatus;
    api.getKnowledgeIndexStatus = async () => ({ status: "current", semantic: "stale" });
    await view.refresh();
    assert.equal(dom.knowledgeSemanticHeading.textContent, t("knowledge.search.state.stale"));
    assert.equal(dom.knowledgeSemanticBuild.hidden, false);
    assert.equal(dom.knowledgeSemanticBuild.textContent, t("knowledge.search.update"));
    // Do not replace a newer, unsubmitted query after an explicit update.
    let recoverySearches = 0;
    api.searchKnowledge = async input => { recoverySearches += 1; return originalSearch({ ...input, mode: "exact" }); };
    dom.knowledgeSearchForm.dispatchEvent(new window.Event("submit", { cancelable: true }));
    await until(() => recoverySearches === 1);
    const editedQueryBuild = deferred();
    api.rebuildKnowledgeSearchIndex = () => editedQueryBuild.promise;
    dom.knowledgeSemanticBuild.click();
    dom.knowledgeSearchQuery.value = "新的未提交查询";
    editedQueryBuild.resolve({ status: "current", processed: 40, total: 40 });
    await until(() => dom.knowledgeSemanticPause.hidden);
    assert.equal(recoverySearches, 1);
    assert.equal(dom.knowledgeSearchQuery.value, "新的未提交查询");
    await view.refresh();
    dom.knowledgeSearchQuery.value = "完整小节";
    dom.knowledgeSearchForm.dispatchEvent(new window.Event("submit", { cancelable: true }));
    await until(() => recoverySearches === 2);
    const finalPausedBatch = deferred();
    api.rebuildKnowledgeSearchIndex = () => finalPausedBatch.promise;
    dom.knowledgeSemanticBuild.click();
    dom.knowledgeSemanticPause.click();
    finalPausedBatch.resolve({ status: "current", processed: 40, total: 40 });
    await until(() => dom.knowledgeSemanticPause.hidden);
    assert.equal(recoverySearches, 2, "Pause during the final batch must not retry the query");
    // A failed structural refresh remains visible while a successful semantic
    // update can still resume the valid search.
    await view.refresh();
    dom.knowledgeSearchQuery.value = "完整小节";
    dom.knowledgeSearchForm.dispatchEvent(new window.Event("submit", { cancelable: true }));
    await until(() => recoverySearches === 3);
    const rebuildStructure = api.rebuildKnowledgeIndex;
    api.rebuildKnowledgeIndex = async () => { throw new Error("structural update denied"); };
    api.rebuildKnowledgeSearchIndex = async () => ({ status: "current", processed: 40, total: 40 });
    dom.knowledgeSemanticBuild.click();
    await until(() => recoverySearches === 4 && dom.knowledgeSemanticPause.hidden);
    assert.equal(dom.knowledgeIndexAlert.hidden, false);
    assert.match(dom.knowledgeIndexStatus.textContent, /structural update denied/u);
    assert.equal(dom.knowledgeSemanticHeading.textContent, t("knowledge.search.state.current"));
    api.rebuildKnowledgeIndex = rebuildStructure;
    api.searchKnowledge = originalSearch;
    await view.refresh();
    const lateIndexStatus = deferred();
    api.getKnowledgeIndexStatus = () => lateIndexStatus.promise;
    dom.knowledgeSearchMode.dispatchEvent(new window.Event("change", { bubbles: true }));
    api.rebuildKnowledgeSearchIndex = async () => ({ status: "failed", code: "model_unavailable", message: "offline" });
    dom.knowledgeSemanticBuild.click();
    await until(() => !dom.knowledgeSemanticSettings.hidden);
    assert.equal(dom.knowledgeSemanticBuild.hidden, true, "Model failure directs to settings instead of rebuilding repeatedly");
    assert.equal(dom.knowledgeSemanticHeading.textContent, t("knowledge.search.state.model"));
    assert.equal(dom.knowledgeSemanticStatus.textContent, t("knowledge.search.issue.model_unavailable"));
    lateIndexStatus.resolve({ status: "current", semantic: "current" });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dom.knowledgeSemanticHeading.textContent, t("knowledge.search.state.model"), "A late status read cannot erase the model recovery action");
    assert.equal(dom.knowledgeSemanticProgress.hidden, true);
    api.getKnowledgeIndexStatus = originalIndexStatus;
    await view.refresh();

    assert.equal(dom.knowledgeCatalogList.querySelectorAll("a").length, 10);
    assert.equal(dom.knowledgeNext.disabled, false);
    dom.knowledgeCatalogList.scrollTop = 90;
    dom.knowledgeNext.click();
    await until(() => dom.knowledgeCatalogList.querySelectorAll("a").length === 3);
    assert.equal(dom.knowledgeCatalogList.scrollTop, 0, "Paging starts at the top of the next catalog page");
    assert.equal(dom.knowledgePrevious.disabled, false);
    await view.openDocument("notes/a.md#first");
    assert.equal(dom.knowledgeCopyReference.textContent, t("knowledge.page.copy"));
    dom.knowledgeCopyReference.click();
    await until(() => copiedReference === "notes/a.md#first");
    assert.equal(dom.knowledgeReaderStatus.textContent, "已复制指针。");
    assert.match(dom.knowledgeReaderBody.textContent, /来源与理解/u);
    assert.equal(dom.knowledgeReaderBody.querySelectorAll("table").length, 1);
    assert.equal(dom.knowledgeReaderBody.querySelectorAll("script").length, 0);
    assert.equal(dom.knowledgeReaderBody.querySelectorAll("[data-knowledge-anchor=first]").length, 1);
    assert.equal(dom.knowledgeIncoming.querySelectorAll("a").length, 2);
    assert.match(dom.knowledgeReaderBody.innerHTML, /&lt;script&gt;/u);
    const originalBody = dom.knowledgeReaderBody.innerHTML;
    dom.knowledgeMainPane.scrollTop = 123;
    dom.knowledgeReaderBody.querySelector('[data-knowledge-ref="notes/b.md#target"]').click();
    await until(() => dom.knowledgeReferenceBody.textContent.includes("回执边界"));
    assert.equal(view.state().selected, "notes/a.md#first");
    assert.equal(view.state().referenceSelected, "notes/b.md#target");
    assert.equal(dom.knowledgeMainPane.scrollTop, 123);
    assert.equal(dom.knowledgeReaderBody.textContent.includes("来源与理解"), true);
    assert(dom.knowledgeReferenceBody.querySelector('[data-knowledge-anchor="target"]').classList.contains("knowledge-section-current"));
    assert.equal(dom.knowledgeReferencePane.hidden, false);
    assert(dom.knowledgeReaderBody.querySelector("[data-reference-open]"));
    dom.knowledgeReferencePane.scrollTop = 87;
    dom.knowledgeReferenceBody.querySelector('[data-knowledge-ref="notes/a.md#first"]').click();
    await until(() => dom.knowledgeReferenceBody.textContent.includes("来源与理解"));
    assert.equal(view.state().selected, "notes/a.md#first");
    assert.equal(dom.knowledgeMainPane.scrollTop, 123);
    assert.equal(new Set([...document.querySelectorAll("[id]")].map(node => node.id)).size, document.querySelectorAll("[id]").length, "Dual readers must not duplicate IDs");
    dom.knowledgeReferenceBack.click();
    await until(() => dom.knowledgeReferenceBody.textContent.includes("回执边界"));
    assert.equal(dom.knowledgeReferencePane.scrollTop, 87);
    dom.knowledgeReferencePromote.click();
    await until(() => view.state().selected === "notes/b.md#target" && dom.knowledgeReferencePane.hidden);
    assert.match(dom.knowledgeReaderBody.textContent, /回执边界/u);
    dom.knowledgeBack.click();
    await until(() => dom.knowledgeReaderBody.textContent.includes("来源与理解"));
    assert.equal(dom.knowledgeMainPane.scrollTop, 123);
    assert.equal(dom.knowledgeReaderBody.innerHTML, originalBody);
    await view.openDocument("notes/a.md");
    assert.equal(dom.knowledgeCopyReference.textContent, t("knowledge.page.copyDocument"));
    dom.knowledgeCopyReference.click();
    await until(() => copiedReference === "notes/a.md");
    assert.equal(dom.knowledgeReaderStatus.textContent, "已复制指针。");
    dom.knowledgeReaderBody.querySelector("[data-knowledge-external]").click();
    await until(() => openedExternal === "https://example.org/source");
    dom.knowledgeContentsList.querySelector("a").click();
    assert.equal(dom.knowledgeCopyReference.textContent, t("knowledge.page.copy"));
    assert.equal(dom.knowledgeReferencePane.hidden, true, "Table of contents stays in its pane");
    dom.knowledgeToggleCatalog.click();
    assert.equal(dom.knowledgeCatalog.hidden, true);
    assert.equal(dom.knowledgeToggleCatalog.getAttribute("aria-expanded"), "false");
    dom.knowledgeToggleCatalog.click();
    assert.equal(dom.knowledgeCatalog.hidden, false);
    const key = new window.Event("keydown", { cancelable: true }); key.key = "End";
    dom.knowledgeDivider.dispatchEvent(key);
    assert.equal(dom.knowledgeDivider.getAttribute("aria-valuenow"), "70");
    await view.openReference("notes/b.md#missing");
    assert.match(dom.knowledgeReferenceStatus.textContent, /找不到小节/u);
    await view.openReference("notes/missing.md");
    assert.equal(dom.knowledgeReferenceBody.textContent, "");
    assert.match(dom.knowledgeReferenceStatus.textContent, /未能完成/u);
    assert.equal(dom.knowledgeReferencePromote.disabled, true);
    assert.match(dom.knowledgeReaderBody.textContent, /来源与理解/u);
    // Late responses cannot replace a newer target or reopen a closed reference.
    const read = api.readKnowledgeDocument;
    const delayed = deferred();
    api.readKnowledgeDocument = reference => reference === "notes/a.md" ? delayed.promise : read(reference);
    const pending = view.openReference("notes/a.md");
    await view.openReference("notes/b.md#target");
    delayed.resolve(await read("notes/a.md")); await pending;
    assert.match(dom.knowledgeReferenceBody.textContent, /回执边界/u);
    const closed = deferred(); api.readKnowledgeDocument = () => closed.promise;
    const closing = view.openReference("notes/a.md"); dom.knowledgeReferenceClose.click();
    closed.resolve(await read("notes/a.md")); await closing;
    assert.equal(dom.knowledgeReferencePane.hidden, true);
    assert.equal(dom.knowledgeReferenceBody.textContent, "");
    api.readKnowledgeDocument = read;
    await view.openDocument("notes/a.md#missing");
    assert.match(dom.knowledgeReaderStatus.textContent, /找不到小节/u);
    await view.openDocument("notes/missing.md");
    assert.equal(dom.knowledgeReaderBody.textContent, "");
    assert.match(dom.knowledgeReaderStatus.textContent, /missing/u);
    // A slow old document must not replace the newly selected document.
    const old = deferred();
    const originalRead = api.readKnowledgeDocument;
    api.readKnowledgeDocument = (reference) => reference === "notes/a.md" ? old.promise : originalRead(reference);
    const oldRead = view.openDocument("notes/a.md#first");
    await view.openDocument("notes/b.md#target");
    old.resolve(library.readKnowledgeDocument(root, "notes/a.md"));
    await oldRead;
    assert.equal(view.state().selected, "notes/b.md#target");
    assert.match(dom.knowledgeReaderBody.textContent, /回执边界/u);
    api.readKnowledgeDocument = originalRead;
    // Material capture preserves literal Markdown, with no semantic claim or
    // hidden source fetch. Preview remains unwritten until explicit submission.
    dom.knowledgeCaptureTitle.value = "用户提供的材料";
    dom.knowledgeCaptureDate.value = "2026-09-22";
    dom.knowledgeCaptureSource.value = "https://example.org/article";
    dom.knowledgeCaptureReason.value = "下次讨论时整理";
    dom.knowledgeCaptureBody.value = "# 原文标题\n\n```js\n<script>unsafe</script>\n```\n[原文链接](https://example.org/original)";
    dom.knowledgeCaptureForm.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => !dom.knowledgeCaptureSave.disabled);
    assert.equal(fs.existsSync(path.join(root, "inbox")), false);
    assert.match(dom.knowledgeCaptureAddition.textContent, /# 原文标题/u);
    const drafts = await intake.listKnowledgeActivity(app);
    assert.equal(drafts.items[0].kind, "draft");
    assert.equal(JSON.stringify(drafts).includes("# 原文标题"), false, "Activity list must omit draft bodies");
    await view.openActivity(drafts.items[0].id);
    assert.match(dom.knowledgeReaderBody.textContent, /尚未保存的拟稿/u);
    // Transport uncertainty keeps the token; retry reuses it even if the first
    // operation really saved the material before its response was lost.
    const commit = api.commitKnowledgeIntake;
    let lost = true;
    api.commitKnowledgeIntake = async (token) => { const result = await commit(token); if (lost) { lost = false; throw new Error("response lost"); } return result; };
    dom.knowledgeCaptureSave.click();
    await until(() => view.state().saveUncertain);
    assert.equal(dom.knowledgeCapturePreview.disabled, true);
    assert.equal(dom.knowledgeCaptureSave.disabled, false);
    dom.knowledgeCaptureSave.click();
    await until(() => !view.state().capturePending);
    assert.equal(fs.readdirSync(path.join(root, "inbox")).length, 1);
    await until(() => dom.knowledgeCaptureNotice.textContent.includes("已保存到待整理"));
    const activity = await intake.listKnowledgeActivity(app);
    assert.equal(activity.items[0].kind, "receipt");
    await view.openActivity(activity.items[0].id);
    assert(dom.knowledgeReaderBody.querySelector("[data-knowledge-ref]"));
    assert.match(dom.knowledgeReaderBody.textContent, /收录时材料在待整理/u);
    assert.equal(library.listKnowledgeDocuments(root, { folder: "inbox" }).total, 1);
    assert.equal(library.listKnowledgeDocuments(root).total, 13);
    assert.equal((await intake.knowledgeIndexStatus(app)).status, "current");
    assert.equal(dom.knowledgeIndexAlert.hidden, true, "Current structural index does not show maintenance action");
    // Receipt corruption is reported alongside readable records, never as an
    // empty successful list.
    const receipt = await intake.readKnowledgeActivity(app, activity.items[0].id);
    const state = fs.readdirSync(path.join(app.getPath(), "knowledge-state"))[0];
    const receiptDirectory = path.join(app.getPath(), "knowledge-state", state, "receipts");
    fs.writeFileSync(path.join(receiptDirectory, "11111111-1111-1111-1111-111111111111.json"), "{broken");
    const partial = await intake.listKnowledgeActivity(app);
    assert.equal(partial.status, "partial"); assert.equal(partial.issueCount, 1);
    assert(partial.items.some((item) => item.id === receipt.token));
    await view.refresh();
    assert.match(dom.knowledgeActivityStatus.textContent, /部分记录无法读取/u);
    // Root switching and unmounting clear old content instead of labelling it
    // as current material in a different corpus.
    const other = path.join(fixture, "other"); fs.mkdirSync(other);
    await preferences.saveKnowledgeRootPreference(app, other);
    await view.refresh();
    assert.equal(view.state().selected, "");
    assert.equal(dom.knowledgeCatalogList.querySelectorAll("a").length, 0);
    assert.equal(dom.knowledgeActivityList.querySelectorAll("button").length, 0);
    fs.rmdirSync(other);
    await view.refresh();
    assert.match(dom.knowledgePageStatus.textContent, /挂载/u);
    assert.equal(dom.knowledgeRebuild.disabled, true);
    assert.equal(dom.knowledgeReaderBody.querySelectorAll("[data-knowledge-anchor]").length, 0);
    // Isolated syntax/security checks: no scripts, OS links or remote images.
    const hostile = markdown.render('[run](javascript:alert) <img src=x onerror=run()> `https://private.invalid`\n\n````md\n```\n[not a link](./a.md#first)\n````', "notes/x.md");
    const safe = parseHTML(`<div>${hostile}</div>`).document;
    assert.equal(safe.querySelectorAll("script, img, [onerror], a").length, 0);
    assert.equal(markdown.resolveLink("notes/a.md", "../../outside.md#x"), null);
    assert.equal(markdown.resolveLink("notes/a.md", "https://user:password@example.org"), null);
    assert.deepEqual(markdown.resolveLink("notes/a.md", "../topics/map.md#topic"), { reference: "topics/map.md#topic" });
    assert.deepEqual(markdown.resolveLink("notes/a.md", "#first"), { reference: "notes/a.md#first" });
    const handlers = new Map();
    const externalCalls = [];
    registerIpcHandlers({ app, ipcMain: { handle: (channel, callback) => handlers.set(channel, callback) },
      shell: { openExternal: async (url) => externalCalls.push(url) } });
    const openSource = handlers.get(ipcChannel("openKnowledgeSource"));
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "https://user:secret@example.org"]) {
      assert.equal(await openSource({}, url), false);
    }
    assert.equal(await openSource({}, "https://example.org"), true);
    assert.deepEqual(externalCalls, ["https://example.org/"]);
    await preferences.saveKnowledgeRootPreference(app, root);
    assert.equal((await handlers.get(ipcChannel("searchKnowledge"))({}, { query: "  eXTRA  " })).total, 10, "Human IPC normalizes case and surrounding spaces");
    assert.equal((await handlers.get(ipcChannel("listKnowledgeDocuments"))({}, { folder: "inbox" })).total, 1);
    assert.equal((await handlers.get(ipcChannel("readKnowledgeActivity"))({}, receipt.token)).kind, "receipt");
    for (const element of document.querySelectorAll('#knowledgeView input, #knowledgeView select, #knowledgeView textarea')) {
      assert(document.querySelector(`label[for="${element.id}"]`), `Missing label for ${element.id}`);
    }
    assert(document.querySelector('[data-view="knowledge"]'));
    console.log(JSON.stringify({ suite: "knowledge-page", environment: "in-memory DOM, no host UI", pagination: true,
      internalLinksAndBacklinks: true, dualPaneHistoryAndScroll: true, referenceRaceAndFailure: true, latestReadWins: true, captureRetryIdempotent: true, receiptCorruptionVisible: true, sourceEscaping: true, realCorpusWrites: 0 }));
  } finally { view.setActive(false); fs.rmSync(fixture, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
