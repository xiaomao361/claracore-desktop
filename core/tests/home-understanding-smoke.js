const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const { createClaraCoreHomeUnderstanding } = require("../../app/views/home-understanding");
const { createClaraCoreHomeConnection } = require("../../app/views/home-connection");
const markdown = require("../../app/knowledge-markdown");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

// These fixtures match compactSharedLinePacket and the selected-line IPC packet.
function line(id, overrides = {}) {
  return {
    id, title: `Topic ${id}`, status: "active", active: id === "current",
    summary: `Catalog preview ${id}`, updatedAt: "2026-10-19T01:00:00Z",
    positionUpdatedAt: "2026-10-19T01:00:00Z", ...overrides
  };
}

function catalog(lines = [line("current"), line("parallel")], currentId = "current") {
  return {
    overview: true, lines,
    currentPosition: { id: `pos-${currentId}`, lineId: currentId, summary: "Overview only", updatedAt: "2026-10-19T01:00:00Z" }
  };
}

function packet(id, overrides = {}) {
  return {
    lineId: id, lineTitle: `Topic ${id}`,
    currentPosition: {
      id: `pos-${id}`, lineId: id, lineTitle: `Topic ${id}`,
      summary: `Position for ${id}`, interpretationStatus: "confirmed",
      factsUsed: [], metadata: {}, ...overrides
    },
    sharedReality: { confirmedGround: "GLOBAL SHARED REALITY MUST NOT BE RECLASSIFIED" },
    handoffs: [{ nextStep: "OLD HANDOFF MUST NOT BECOME CURRENT NEXT STEP" }]
  };
}

function fixture(initialCatalog = catalog(), read = async ({ lineId }) => packet(lineId)) {
  const { document, window } = parseHTML('<section id="homeUnderstanding"><select id="homeTopicSelect"></select><p id="homeTopicNotice" role="status"></p><div id="homeUnderstandingBody"></div></section>');
  const root = document.querySelector("#homeUnderstanding");
  const select = root.querySelector("select");
  const body = root.querySelector("#homeUnderstandingBody");
  let snapshot = {
    sharedLine: initialCatalog,
    innerLife: { pendingShares: [{ body: "PRIVATE PENDING THOUGHT MUST STAY PRIVATE" }] }
  };
  let reads = [];
  let copied = [];
  let opened = [];
  let openGuards = [];
  let readFunction = read;
  let copyFunction = async (reference) => { copied.push(reference); return true; };
  const api = new Proxy({
    getSharedLine(input) { reads.push(input); return readFunction(input); },
    copyText(reference) { return copyFunction(reference); }
  }, {
    get(target, name) {
      assert(name in target, `Home cannot access ${String(name)}`);
      return target[name];
    }
  });
  const controller = createClaraCoreHomeUnderstanding({
    root, api, t: (key, values = {}) => `${key}${values.number ? ` ${values.number}` : ""}`,
    getSnapshot: () => new Proxy(snapshot, { get(target, name) {
      assert.equal(name, "sharedLine", "Home understanding must not inspect pending thoughts or scan other modules");
      return target[name];
    } }),
    onOpenLine(button, { isCurrent }) { opened.push(button.dataset.sharedLineId); openGuards.push(isCurrent); }
  });
  function choose(id) {
    const option = [...select.querySelectorAll("option")].find((item) => item.getAttribute("value") === id);
    assert(option, `Missing selection ${id}`);
    for (const item of select.querySelectorAll("option")) item.selected = item === option;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  }
  return {
    root, body, select, controller, reads, copied, opened, openGuards, choose,
    setCatalog(value) { snapshot.sharedLine = value; },
    setRead(value) { readFunction = value; },
    setCopy(value) { copyFunction = value; }
  };
}

async function selectedReadAndSemanticBoundaries() {
  const f = fixture(catalog(), async ({ lineId }) => packet(lineId, {
    summary: `Summary ${lineId}`,
    nextStep: `Next ${lineId}`,
    factsUsed: ["mem_verified_123", "/tmp/source with spaces.md#section", "https://example.com/source"],
    metadata: { confirmedGround: `Recorded understanding ${lineId}`, provisionalRead: `Provisional ${lineId}`, misreadRisks: `Risk ${lineId}` }
  }));
  await f.controller.render();
  assert.equal(f.reads.length, 0, "Inactive Home must not read details");
  await f.controller.setActive(true);
  assert.deepEqual(f.reads, [{ lineId: "current" }]);
  assert.equal(f.root.dataset.state, "ready");
  assert.match(f.body.textContent, /Summary current/u);
  assert.match(f.body.textContent, /Next current/u);
  assert.match(f.body.textContent, /Recorded understanding current/u);
  assert.match(f.body.textContent, /Provisional current/u);
  assert.match(f.body.textContent, /Risk current/u);
  assert.equal(f.body.querySelectorAll("a").length, 0, "References must not open arbitrary paths or URLs");
  assert(!f.body.textContent.includes("PRIVATE PENDING"));
  assert(!f.body.textContent.includes("GLOBAL SHARED REALITY"));
  assert(!f.body.textContent.includes("OLD HANDOFF"));
  f.choose("parallel");
  await settle();
  assert.deepEqual(f.reads, [{ lineId: "current" }, { lineId: "parallel" }]);
  assert.match(f.body.textContent, /Summary parallel/u);
  assert(!f.body.textContent.includes("Summary current"));
  f.body.querySelector('[data-understanding-action="open-line"]').click();
  await settle();
  assert.deepEqual(f.opened, ["parallel"], "Full reading must preserve the selected exact line");
  assert.equal(f.openGuards[0](), true);
  f.body.querySelector('[data-reference-index="1"]').click();
  await settle();
  assert.deepEqual(f.copied, ["/tmp/source with spaces.md#section"]);
  const renderedButton = f.body.querySelector('[data-understanding-action="open-line"]');
  const renderedOption = f.select.querySelector('[value="parallel"]');
  await f.controller.render();
  assert.equal(f.reads.length, 2, "Unchanged catalog must not poll details");
  assert.equal(f.body.querySelector('[data-understanding-action="open-line"]'), renderedButton, "Unchanged refreshes must preserve actionable DOM and focus");
  assert.equal(f.select.querySelector('[value="parallel"]'), renderedOption, "Unchanged refreshes must preserve selector DOM");
  const updated = catalog();
  updated.lines[1].positionUpdatedAt = "2026-10-19T02:00:00Z";
  f.setCatalog(updated);
  await f.controller.render();
  assert.deepEqual(f.reads.at(-1), { lineId: "parallel" });
  assert.equal(f.reads.length, 3, "Selected catalog version changes must hydrate fresh detail");
  assert.equal(f.openGuards[0](), false, "An old full-read operation cannot navigate after its record has changed");
  f.body.querySelector('[data-understanding-action="open-line"]').click();
  await settle();
  assert.equal(f.openGuards[1](), true);
  await f.controller.setActive(false);
  assert.equal(f.openGuards[1](), false, "Leaving Home invalidates pending navigation");
  updated.lines[1].positionUpdatedAt = "2026-10-19T03:00:00Z";
  await f.controller.render();
  assert.equal(f.reads.length, 3);
}

async function choicesAndEmptyState() {
  const empty = fixture(catalog([], ""));
  await empty.controller.setActive(true);
  assert.equal(empty.root.dataset.state, "empty");
  assert.equal(empty.select.disabled, true);
  assert.equal(empty.reads.length, 0);

  const multiple = fixture(catalog([line("first"), line("second")], "missing"));
  await multiple.controller.setActive(true);
  assert.equal(multiple.root.dataset.state, "unselected");
  assert.equal(multiple.reads.length, 0, "Multiple candidates cannot silently choose the first");
  multiple.choose("second");
  await settle();
  assert.deepEqual(multiple.reads, [{ lineId: "second" }]);
  multiple.setCatalog(catalog([line("first"), line("second", { status: "archived", active: true })], "first"));
  await multiple.controller.render();
  assert.equal(multiple.root.dataset.state, "unselected");
  assert.match(multiple.root.textContent, /selectionRemoved/u);
  assert.equal(multiple.reads.length, 1, "An archived selection must not silently become another topic");

  const single = fixture(catalog([line("only", { active: false, status: undefined }), line("archived", { status: "archived", active: true })], "missing"));
  await single.controller.setActive(true);
  assert.deepEqual(single.reads, [{ lineId: "only" }], "A non-current but active-status line remains selectable");

  const currentLine = fixture({ lines: [line("first"), line("second")], currentLine: { id: "second" } });
  await currentLine.controller.setActive(true);
  assert.deepEqual(currentLine.reads, [{ lineId: "second" }]);

  const many = fixture(catalog(Array.from({ length: 15 }, (_, index) => line(`line-${index}`)), "line-14"));
  await many.controller.setActive(true);
  assert.equal([...many.select.querySelectorAll("option")].filter((option) => option.getAttribute("value")).length, 10);
  assert(many.select.querySelector('[value="line-14"]'), "Keep the selected topic in the bounded selector");
  assert(many.body.querySelector('[data-view-target="shared-line"]'), "Overflow must lead to the Shared Line catalog");
}

async function staleResponsesAndInactiveReads() {
  const first = deferred();
  const second = deferred();
  const f = fixture(catalog(), ({ lineId }) => lineId === "current" ? first.promise : second.promise);
  const initial = f.controller.setActive(true);
  await settle();
  f.choose("parallel");
  await settle();
  second.resolve(packet("parallel", { summary: "NEW SELECTED CONTENT" }));
  await settle();
  first.resolve(packet("current", { summary: "STALE CONTENT" }));
  await initial;
  assert.match(f.body.textContent, /NEW SELECTED CONTENT/u);
  assert(!f.body.textContent.includes("STALE CONTENT"));

  const old = deferred();
  const fresh = deferred();
  let count = 0;
  const refresh = fixture(catalog(), () => ++count === 1 ? old.promise : fresh.promise);
  const oldRead = refresh.controller.setActive(true);
  await settle();
  const changed = catalog();
  changed.lines[0].positionUpdatedAt = "changed";
  refresh.setCatalog(changed);
  const freshRead = refresh.controller.render();
  await settle();
  fresh.resolve(packet("current", { summary: "FRESH VERSION" }));
  await freshRead;
  old.reject(new Error("Old request failed"));
  await oldRead;
  assert.equal(refresh.root.dataset.state, "ready");
  assert.match(refresh.body.textContent, /FRESH VERSION/u);

  const paused = fixture();
  const activation = paused.controller.setActive(true);
  await paused.controller.setActive(false);
  await activation;
  assert.equal(paused.reads.length, 0, "Deactivation before I/O must cancel the scheduled read");
  await paused.controller.setActive(true);
  assert.equal(paused.reads.length, 1);

  const navigating = fixture();
  await navigating.controller.setActive(true);
  navigating.body.querySelector('[data-understanding-action="open-line"]').click();
  await settle();
  assert.equal(navigating.openGuards[0](), true);
  navigating.choose("parallel");
  assert.equal(navigating.openGuards[0](), false, "Changing topic invalidates pending navigation immediately");
  await settle();
}

async function failureAndRecovery() {
  const f = fixture(catalog(), async () => { throw new Error("Offline"); });
  await f.controller.setActive(true);
  assert.equal(f.root.dataset.state, "error");
  assert.match(f.root.textContent, /loadFailed/u);
  assert(!f.body.textContent.includes("noPosition"));
  await f.controller.render();
  assert.equal(f.reads.length, 1, "Failure must not cause a silent retry loop");
  f.setRead(async ({ lineId }) => packet(lineId));
  f.body.querySelector('[data-understanding-action="retry"]').click();
  await settle();
  assert.equal(f.root.dataset.state, "ready");
  assert.equal(f.reads.length, 2);
  f.controller.renderLoadError();
  assert.equal(f.root.dataset.state, "error");
  assert(f.body.querySelector('[data-home-action="retry"]'), "Catalog errors must delegate snapshot retry");
  assert(!f.body.textContent.includes("emptyTitle"));
  const readsBeforeFailureRender = f.reads.length;
  await f.controller.render();
  assert.equal(f.root.dataset.state, "error", "A failed snapshot read must not be repaired by rendering the same stale catalog");
  assert.equal(f.reads.length, readsBeforeFailureRender);
  f.controller.renderLoading();
  assert.equal(f.root.getAttribute("aria-busy"), "true");
  await f.controller.render();
  assert.equal(f.root.getAttribute("aria-busy"), "false");

  const initial = fixture(null);
  await initial.controller.setActive(true);
  assert.equal(initial.root.dataset.state, "loading", "The initial missing snapshot is loading, not an empty catalog");
  initial.controller.renderLoadError();
  await initial.controller.render();
  assert.equal(initial.root.dataset.state, "error");
  initial.setCatalog(catalog());
  await initial.controller.render();
  assert.equal(initial.root.dataset.state, "ready", "A new successful catalog can recover a failed snapshot read");

  for (const badPacket of [
    { ...packet("current"), lineId: "parallel" },
    packet("current", { lineId: "parallel" })
  ]) {
    const mismatch = fixture(catalog(), async () => badPacket);
    await mismatch.controller.setActive(true);
    assert.equal(mismatch.root.dataset.state, "error", "Both packet and position identity must match");
    assert(!mismatch.body.textContent.includes("Position for"));
  }
}

async function honestMissingFieldsAndSafeLongContent() {
  const summary = `SUMMARY IS A POSITION, NOT CONSENSUS ${"长内容🙂".repeat(250)} <img src=x onerror=alert(1)>`;
  const rawReference = '  javascript:alert("<script>unsafe</script>")  ';
  const f = fixture(catalog([line("current", { title: '<svg onload="alert(1)">Topic</svg>' })]), async () => packet("current", {
    summary,
    factsUsed: [rawReference, ...Array.from({ length: 8 }, (_, index) => `reference-${index}`)],
    metadata: { currentInterpretation: "UNRELATED METADATA INTERPRETATION", nextStep: "Current recorded next step" }
  }));
  await f.controller.setActive(true);
  assert.equal(f.body.querySelectorAll("script, img, svg:not(.understanding-streams), a").length, 0, "All stored content must be rendered as text");
  assert.match(f.body.textContent, /SUMMARY IS A POSITION/u);
  assert.equal(f.body.querySelectorAll(".understanding-ground").length, 0, "Confirmed interpretation status does not establish shared understanding");
  assert(!f.body.textContent.includes("UNRELATED METADATA INTERPRETATION"));
  assert.match(f.body.textContent, /Current recorded next step/u);
  assert.equal(Array.from(f.body.querySelector(".understanding-position .understanding-prose").textContent).length, 421);
  assert.equal(f.body.querySelectorAll(".understanding-reference").length, 6);
  assert.equal(f.body.querySelector(".understanding-reference").textContent, rawReference, "References remain verbatim");
  const all = [...f.body.querySelectorAll('[data-understanding-action="open-line"]')];
  assert.equal(all.length, 3, "The source node, long text and reference overflow share the same full-read route");
  for (const button of all) button.click();
  await settle();
  assert.deepEqual(f.opened, ["current", "current", "current"]);
  f.body.querySelector('[data-reference-index="0"]').click();
  await settle();
  assert.equal(f.copied[0], rawReference);
  f.setCopy(async () => false);
  f.body.querySelector('[data-reference-index="0"]').click();
  await settle();
  assert.match(f.root.querySelector("#homeTopicNotice").textContent, /copyFailed/u);

  const missing = fixture(catalog(), async ({ lineId }) => packet(lineId, { summary: "", metadata: { factsUsed: ["STALE METADATA REFERENCE"] } }));
  await missing.controller.setActive(true);
  assert.match(missing.body.textContent, /noReferences/u);
  assert.match(missing.body.textContent, /noPosition/u);
  assert.equal(missing.body.querySelector(".understanding-next-step"), null, "A topic without a plan must not look like an unfinished task");
  assert(!missing.body.textContent.includes("STALE METADATA REFERENCE"), "An explicit empty factsUsed array is authoritative");

  const metadata = fixture(catalog(), async ({ lineId }) => packet(lineId, { factsUsed: undefined, metadata: { factsUsed: ["legacy-reference"] } }));
  await metadata.controller.setActive(true);
  assert.match(metadata.body.textContent, /legacy-reference/u);
}

function browserExport() {
  const context = { window: {} };
  const source = fs.readFileSync(path.join(__dirname, "../../app/views/home-understanding.js"), "utf8");
  vm.runInNewContext(source, context);
  assert.equal(typeof context.window.createClaraCoreHomeUnderstanding, "function");
  for (const locale of ["zh", "en"]) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../../app/i18n/${locale}.js`), "utf8"), context);
  }
  const keys = new Set([...source.matchAll(/"(home\.understanding\.[A-Za-z]+)"/g)].map((match) => match[1]));
  for (const key of Object.keys(context.window.ClaraCoreTranslationsZh)) {
    if (key.startsWith("home.fusion.") || key.startsWith("home.connection.")) keys.add(key);
  }
  for (const key of keys) {
    const zh = context.window.ClaraCoreTranslationsZh[key];
    const en = context.window.ClaraCoreTranslationsEn[key];
    assert.equal(typeof zh, "string", `Missing Chinese translation: ${key}`);
    assert.equal(typeof en, "string", `Missing English translation: ${key}`);
    const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    assert.deepEqual(placeholders(zh), placeholders(en), `Different translation placeholders: ${key}`);
  }
}

function actualMarkupAndReadingContracts() {
  const { document, window } = parseHTML(fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8"));
  const context = vm.createContext({ window, document, console, setTimeout, clearTimeout });
  function load(relativePath) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8"), context, { filename: relativePath });
  }
  for (const file of ["app/dom.js", "app/utils.js", "app/i18n/zh.js", "app/i18n/en.js"]) load(file);
  const dom = window.ClaraCoreDom;
  const seenIds = new Set();
  for (const element of document.querySelectorAll("[id]")) {
    assert(!seenIds.has(element.id), `Duplicate production DOM id: ${element.id}`);
    seenIds.add(element.id);
  }
  const localized = [
    ...document.querySelectorAll("#homeView [data-i18n], #homeView [data-i18n-aria-label], .reading-mechanism [data-i18n]")
  ];
  for (const element of localized) {
    const key = element.getAttribute("data-i18n") || element.getAttribute("data-i18n-aria-label");
    assert.equal(typeof window.ClaraCoreTranslationsZh[key], "string", `Missing Chinese static translation: ${key}`);
    assert.equal(typeof window.ClaraCoreTranslationsEn[key], "string", `Missing English static translation: ${key}`);
  }
  const elementsInOrder = [...document.querySelectorAll("*")];
  const before = (first, second) => elementsInOrder.indexOf(first) < elementsInOrder.indexOf(second);
  assert.equal(document.querySelectorAll("details.reading-mechanism").length, 0);
  assert.equal(document.querySelector('[data-view="trace"]'), null);
  assert.equal(document.querySelector('#traceView'), null);
  assert(document.querySelector('#homeView #homeMilestoneList'));
  assert(document.querySelector('#logsView #traceOpenDetail'));
  assert(document.querySelector('#logsView #traceDetailDialog'));
  const disclosure = document.querySelector("#homePresenceDisclosure");
  assert.equal(disclosure.hasAttribute("open"), false);
  assert(before(disclosure, document.querySelector("#homeUnderstanding")), "Connection belongs beside the heading, above the reading surface");
  assert.equal(document.querySelector("#homeVisionCanvas"), null, "The standalone scene must be retired");
  assert.equal(dom.homeActionableIssue.closest("details"), null, "Errors must remain outside folded activity");
  // LinkeDOM does not implement the native HTMLDetailsElement.open property.
  disclosure.open = false;
  for (const file of ["app/views/home-trace.js", "app/views/home-presence.js", "app/views/home-connection.js", "app/views/home.js"]) load(file);
  const snapshot = { sharedLine: catalog(), gatewayTraces: [], health: { checks: [{ level: "error", detail: "ACTIONABLE HEALTH ERROR" }] } };
  const translate = (key, values = {}) => (window.ClaraCoreTranslationsZh[key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
  const multipleAgents = window.createClaraCoreHomePresence({ t: translate, actionableGatewayErrors: () => [] }).build({
    gatewayTraces: Array.from({ length: 7 }, (_, index) => ({ agentId: `agent-${index}`, createdAt: new Date(Date.now() - index * 1000).toISOString(), toolName: "observed" }))
  });
  assert.equal(multipleAgents.agents.length, 7, "The real presence builder must not silently truncate the foreground model to three Agents");
  const home = window.createClaraCoreHomeView({ dom, t: translate, getSnapshot: () => snapshot, ...window.ClaraCoreUtils, formatMode: (value) => value });
  home.setActive(true);
  home.setActive(false);
  assert.equal(home.getConnectionDebugState().animated, false, "Leaving Home must stop motion");
  home.setActive(true);
  home.renderHomeDashboard();
  assert.equal(dom.homeActionableIssue.hidden, false);
  assert.equal(dom.homeActionableIssue.getAttribute("role"), "alert");
  assert.match(dom.homeActionableIssue.textContent, /ACTIONABLE HEALTH ERROR/u);
  assert(dom.homeActionableIssue.querySelector('[data-view-target="logs"]'));
  snapshot.health.checks = [];
  snapshot.memoryStats = { pendingEmbeddingCount: 1 };
  snapshot.memoryMaintenance = { status: "pending", counts: { pendingEmbeddings: 1 }, issues: [] };
  home.renderHomeDashboard();
  assert.equal(home.actionableAttentionCount(), 1, "Pending audit must not duplicate the existing queue reminder");
  snapshot.memoryMaintenance = { status: "needs_repair", issues: [{ code: "orphan_labels", count: 1 }] };
  home.renderHomeDashboard();
  assert.equal(home.actionableAttentionCount(), 2, "An independent repair issue must remain visible beside pending work");
  home.renderLoadError();
  assert.equal(dom.homeActionableIssue.hidden, false);
  assert.equal(dom.homeActionableIssue.closest("details"), null);

  load("app/knowledge-markdown.js");
  load("app/views/shared-innerlife.js");
  // The renderer's app.js exposes this same existing DOM binding globally.
  context.sharedLineNotice = dom.sharedLineNotice;
  const fullReferences = Array.from({ length: 8 }, (_, index) => `reference-${index + 1}`);
  fullReferences[7] = '<script>unsafe()</script> / eighth reference with spaces';
  const longPosition = `Beginning ${"完整正文。".repeat(100)}FINAL POSITION MARKER`;
  const selectedPacket = packet("parallel", { summary: longPosition, factsUsed: fullReferences });
  const sharedState = { activeSharedLineAgentFilter: "", selectedSharedLineId: "parallel", selectedSharedLinePacket: selectedPacket };
  const reader = window.createClaraCoreSharedInnerLifeView({ dom, t: translate, getSnapshot: () => snapshot, ...window.ClaraCoreUtils, state: sharedState, renderMemoryResults() {}, memoryAgentId: () => "" });
  reader.renderSharedLine();
  assert.equal(dom.sharedLineNext.closest(".stage-next").hidden, true, "Historical handoffs must not become a current plan");
  selectedPacket.currentPosition.metadata.nextStep = "A current recorded plan";
  reader.renderSharedLine();
  assert.equal(dom.sharedLineNext.closest(".stage-next").hidden, false);
  assert(dom.sharedLineNext.textContent.includes("A current recorded plan"));
  selectedPacket.currentPosition.nextStep = "";
  reader.renderSharedLine();
  assert.equal(dom.sharedLineNext.closest(".stage-next").hidden, true, "An explicit empty plan overrides older metadata");
  sharedState.sharedLineReadStatus = "loading";
  reader.renderSharedLine();
  assert.equal(dom.sharedLineResume.disabled, true);
  sharedState.sharedLineReadStatus = "error";
  reader.renderSharedLine();
  assert.equal(dom.sharedLineResume.disabled, true);
  assert.equal(dom.sharedLineRetry.hidden, false);
  sharedState.sharedLineReadStatus = "ready";
  reader.renderSharedLine();
  assert.equal(dom.sharedLineResume.disabled, false);
  assert.equal(dom.sharedLineRetry.hidden, true);
  assert.equal(dom.sharedLineReferencesSection.hidden, false);
  assert.equal(dom.sharedLineReferences.querySelectorAll("li").length, 8, "All references must remain reachable in the full reader");
  assert.match(dom.sharedLineReferences.textContent, /reference-7/u);
  assert(dom.sharedLineReferences.textContent.includes(fullReferences[7]), "The eighth reference must remain verbatim");
  assert.equal(dom.sharedLineReferences.querySelectorAll("script, img, a").length, 0, "Full-read references must also remain plain text");
  assert.match(dom.sharedLineSummary.textContent, /FINAL POSITION MARKER/u, "Full reading must include the complete position beyond the Home preview");
  selectedPacket.currentPosition.factsUsed = [];
  selectedPacket.currentPosition.metadata.factsUsed = ["STALE METADATA REFERENCE"];
  reader.renderSharedLine();
  assert.equal(dom.sharedLineReferencesSection.hidden, true, "Full reader and Home must agree that an explicit empty current array is authoritative");
}

async function fusionReferenceBoundaries() {
  const f = fixture(catalog(), async ({ lineId }) => packet(lineId, {
    factsUsed: ["mem_verified_123", "mem_verified_123", "notes/source.md#section", "inner_share_saved", "https://example.com/memory", "/tmp/knowledge.md", "Unknown mention of InnerLife"]
  }));
  await f.controller.setActive(true);
  assert.equal(f.body.querySelectorAll(".understanding-source").length, 4);
  for (const domain of ["memory", "knowledge", "shared-line", "innerlife"]) {
    assert.equal(f.body.querySelector(`[data-domain="${domain}"]`).dataset.linked, "true");
  }
  assert.equal(f.body.querySelectorAll(".understanding-streams path[data-linked=true]").length, 4);
  assert(f.body.querySelector('[data-domain="shared-line"][data-shared-line-id="current"]'));
  const empty = fixture(catalog(), async ({ lineId }) => packet(lineId, {
    factsUsed: [], metadata: { factsUsed: ["mem_old", "notes/old.md#old", "inner_share_old"] }
  }));
  await empty.controller.setActive(true);
  assert.equal(empty.body.querySelectorAll('.understanding-source[data-linked="true"]').length, 1, "Explicit empty references light only the selected Shared Line");
  assert.equal(empty.body.querySelector('[data-domain="innerlife"]').dataset.linked, "false", "Pending thoughts and global activity cannot imply a topic relationship");
  const unknown = fixture(catalog(), async ({ lineId }) => packet(lineId, { factsUsed: ["/tmp/knowledge.md", "https://example.com/memory"] }));
  await unknown.controller.setActive(true);
  assert.equal(unknown.body.querySelectorAll('.understanding-source[data-linked="true"]').length, 1, "Arbitrary paths and URL names do not identify source domains");
  unknown.controller.renderLoadError();
  assert.equal(unknown.body.querySelectorAll('.understanding-source[data-linked="true"]').length, 0, "A failed read cannot preserve successful source links");
}

function connectionTruthAndLifecycle() {
  const { document } = parseHTML(fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8"));
  const root = document.querySelector("#homeConnection");
  let clock = 1000000;
  let scheduled = null;
  let snapshot = { connections: { httpGateway: { ok: true, toolConcurrency: { activeByAgent: {} } } } };
  let observed = [];
  const build = () => ({ agents: observed.filter(agent => clock - agent.lastObservedAt <= 900000), agentLabel: id => id === "codex" ? "Codex" : id });
  const connection = createClaraCoreHomeConnection({ root, t: (key, args = {}) => `${key} ${args.agent || ""}`, getSnapshot: () => snapshot, buildPresence: build, now: () => clock,
    setTimer(fn, delay) { scheduled = { fn, delay }; return 1; }, clearTimer() { scheduled = null; }
  });
  connection.renderLoading();
  connection.setActive(true);
  assert.equal(root.dataset.state, "loading");
  connection.render();
  assert.equal(root.dataset.state, "quiet", "A ready gateway with no calls is awaiting connection, never online");
  assert.equal(root.dataset.animate, "false");
  observed = [{ id: "codex", label: "Codex", presence: "active", lastObservedAt: clock }];
  connection.render();
  assert.equal(root.dataset.state, "recent", "A persisted active-looking trace cannot prove live interaction");
  assert.equal(root.dataset.animate, "true");
  assert.equal(scheduled.delay, 90001);
  root.querySelector("#homeConnectionMotion").click();
  assert.equal(root.dataset.animate, "false");
  assert.equal(root.querySelector("#homeConnectionMotion").getAttribute("aria-pressed"), "true");
  root.querySelector("#homeConnectionMotion").click();
  snapshot.connections.httpGateway = { ok: true, toolConcurrency: { activeByAgent: { codex: 1, ignored: 0 } } };
  connection.render();
  assert.equal(root.dataset.state, "active", "Only the live running-call counter supports current interaction");
  assert.equal(scheduled.delay, 10001);
  clock += 10001;
  let fire = scheduled.fn; scheduled = null; fire();
  assert.equal(root.dataset.state, "recent", "An old live-counter snapshot cannot sustain interaction indefinitely");
  snapshot.connections.httpGateway = { ok: true, toolConcurrency: { activeByAgent: {} } };
  connection.render();
  clock = 1090001;
  fire = scheduled.fn; scheduled = null; fire();
  assert.equal(root.dataset.state, "fading");
  assert.equal(root.dataset.animate, "false", "Old activity must stop breathing");
  clock = 1900001;
  fire = scheduled.fn; scheduled = null; fire();
  assert.equal(root.dataset.state, "quiet", "Presence expires without polling the Gateway");
  assert.equal(scheduled, null);
  snapshot.connections.httpGateway = { ok: true, toolConcurrency: { activeByAgent: { codex: 2 } } };
  connection.render();
  assert.equal(root.dataset.state, "active");
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new document.defaultView.Event("visibilitychange"));
  assert.equal(root.dataset.animate, "false");
  assert.equal(scheduled, null);
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  clock += 10001;
  document.dispatchEvent(new document.defaultView.Event("visibilitychange"));
  assert.equal(root.dataset.state, "unknown", "An expired positive counter without a recent trace remains unknown");
  snapshot.connections.httpGateway = { ok: false };
  connection.render();
  assert.equal(root.dataset.state, "unavailable");
  connection.renderLoadError();
  assert.equal(root.dataset.state, "error", "Read failure is not an empty successful connection");
  assert.equal(root.dataset.animate, "false");
  connection.setActive(false);
  assert.equal(connection.debugState().timerScheduled, false);
  snapshot = {};
  connection.render();
  assert.equal(root.dataset.state, "unknown");
  assert.equal(root.dataset.animate, "false");
  assert.equal(connection.debugState().canvas, false);
}

async function structuredReadingAndSafeMarkup() {
  const summary = "【本线说明】 同一条线，保留历史。\n\n【最近进展】\n- 本地检查通过。\n- **等待用户观察**；服务尚未部署。\n\n# 待确认\n原文保留 `--disable-write` 与 192.0.2.10:8768。";
  const nextStep = "①复核 12 月的增长，保留 3,263 元原数。②核对 2026-12-15 的期限。③先保留两份 .bak，再观察。";
  const f = fixture(catalog(), async ({ lineId }) => packet(lineId, { summary, nextStep }));
  await f.controller.setActive(true);
  const position = f.body.querySelector(".understanding-position .reading-prose");
  assert.equal(position.querySelectorAll("ul li").length, 2);
  assert.equal(position.querySelector("strong").textContent, "【本线说明】");
  assert(position.querySelector("h4"));
  assert([...position.querySelectorAll("strong")].some(node => node.textContent === "等待用户观察"));
  assert.equal(position.querySelector("code").textContent, "--disable-write");
  const tasks = f.body.querySelectorAll(".understanding-next-step .reading-numbered li");
  assert.equal(tasks.length, 3);
  assert.deepEqual([...tasks].map(node => node.querySelector(".reading-number-marker").textContent), ["①", "②", "③"]);
  assert(tasks[0].textContent.includes("3,263"));
  assert(tasks[1].textContent.includes("2026-12-15"));
  assert.equal(f.body.querySelector(".understanding-layout").dataset.hasReferences, "false");
  const hostile = '<img src=x onerror=alert(1)> **<script>evil()</script>** [run](javascript:evil()) https://example.com/a <a id="raw"></a>';
  const { document } = parseHTML(`<div id="formatted">${markdown.render(hostile, "", { reading: true, linkMode: "text" })}</div>`);
  assert.equal(document.querySelectorAll("img, script, a").length, 0);
  assert(document.querySelector("#formatted").textContent.includes("javascript:evil()"));
  assert(document.querySelector("#formatted").textContent.includes('<a id="raw"></a>'), "Raw stored HTML must stay visible as escaped text");
  const ambiguous = parseHTML(markdown.render("①文件名 `。②` 保留原样。", "", { reading: true, linkMode: "text" })).document;
  assert.equal(ambiguous.querySelectorAll(".reading-numbered").length, 0, "Code containing a circled number must not be split into tasks");
  assert(markdown.inline("【**Knowledge emphasis**】", "notes/example.md").includes("<strong>Knowledge emphasis</strong>"), "Reading label support must not change Knowledge's default inline emphasis");
  assert(markdown.inline("【https://example.com】", "notes/example.md").includes("<a "), "Knowledge's default URL handling remains active inside brackets");
  const numbered = parseHTML(markdown.render("10. First\n12. Original numbering", "", { reading: true, linkMode: "text" })).document;
  assert.deepEqual([...numbered.querySelectorAll("li")].map(node => node.getAttribute("value")), ["10", "12"]);
}

function concurrentAgentIdentityAndActivity() {
  const { document } = parseHTML(fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8"));
  const root = document.querySelector("#homeConnection");
  let clock = 1000000;
  let snapshot = { connections: { httpGateway: { ok: true, toolConcurrency: { activeByAgent: {} } } } };
  let observed = [];
  const build = () => ({ agents: observed, agentLabel: id => id === "codex" ? "Codex" : id });
  const connection = createClaraCoreHomeConnection({ root, t: (key, values = {}) => `${key} ${values.count || ""}`, getSnapshot: () => snapshot, buildPresence: build, now: () => clock, setTimer: () => 1, clearTimer() {} });
  connection.render(); connection.setActive(true);
  observed = ["codex", "lara", "clara", "claude"].map((id, index) => ({ id, label: id, lastObservedAt: clock - index * 5000 }));
  snapshot.connections.httpGateway = { ok: true, toolConcurrency: { activeByAgent: { codex: 1, lara: 2 } } };
  connection.render();
  const roster = root.querySelector("#homePresenceAgents");
  assert.equal([...roster.children].filter(node => !node.hidden).length, 4, "Four Agents are visible concurrently outside the disclosure");
  assert.equal(roster.closest("details"), null);
  const codex = roster.querySelector('[data-agent-id="codex"]');
  const lara = roster.querySelector('[data-agent-id="lara"]');
  assert.equal(codex.dataset.presence, "active");
  assert.equal(lara.dataset.presence, "active");
  assert.equal(roster.querySelector('[data-agent-id="clara"]').dataset.presence, "recent");
  assert.equal(new Set([...roster.children].map(node => node.dataset.shape)).size, 4);
  assert.notEqual(codex.style.getPropertyValue("--agent-hue"), lara.style.getPropertyValue("--agent-hue"));
  const textNode = codex.querySelector("strong").firstChild;
  const pulse = codex.dataset.arrival;
  connection.render();
  assert.equal(codex, roster.querySelector('[data-agent-id="codex"]'));
  assert.equal(codex.querySelector("strong").firstChild, textNode, "Unchanged observations preserve the name text node");
  assert.equal(codex.dataset.arrival, pulse, "The same trace cannot replay arrival");
  observed = observed.map(item => item.id === "codex" ? { ...item, lastObservedAt: clock + 1 } : item); clock += 1;
  connection.render();
  assert.notEqual(codex.dataset.arrival, pulse, "A new observation produces one response");
  const shape = codex.dataset.shape, hue = codex.style.getPropertyValue("--agent-hue");
  observed = [...observed].reverse(); connection.render();
  assert.equal(codex.dataset.shape, shape); assert.equal(codex.style.getPropertyValue("--agent-hue"), hue);
  observed.push({ id: '<script>agent</script>', label: '<script>agent</script>', lastObservedAt: clock });
  connection.render();
  assert.equal(connection.debugState().foregroundCount, 4);
  assert.equal(root.querySelector("#homeConnectionOverflow").hidden, false);
  root.querySelector("#homeConnectionOverflow").click();
  assert.equal(root.querySelector("#homePresenceDisclosure").open, true);
  assert.equal(root.querySelectorAll("script").length, 0);
  assert(root.querySelector("#homePresenceDetail").textContent.includes("home.connection.agent"));
  root.querySelector("#homeConnectionMotion").click();
  assert.equal(root.dataset.animate, "false");
  assert.equal(roster.querySelectorAll("[data-arrival]").length, 0);
  connection.renderLoadError();
  assert.equal(roster.children.length, 0, "A failed snapshot must clear apparently current Agent observations");
  assert.equal(root.dataset.state, "error");
  connection.setActive(false);
}

async function main() {
  browserExport();
  await selectedReadAndSemanticBoundaries();
  await choicesAndEmptyState();
  await staleResponsesAndInactiveReads();
  await failureAndRecovery();
  await honestMissingFieldsAndSafeLongContent();
  await fusionReferenceBoundaries();
  await structuredReadingAndSafeMarkup();
  concurrentAgentIdentityAndActivity();
  connectionTruthAndLifecycle();
  actualMarkupAndReadingContracts();
  console.log("Home understanding offline smoke passed: exact read-only selection, bounded catalogs, current-version hydration, race protection, truthful errors, recorded understanding, references, and private-content boundaries.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
