function createClaraCoreHomeUnderstanding({ root, api, t, getSnapshot, onOpenLine }) {
  const select = root.querySelector("#homeTopicSelect");
  const notice = root.querySelector("#homeTopicNotice");
  const body = root.querySelector("#homeUnderstandingBody");
  const markdown = typeof module !== "undefined" && module.exports ? require("../knowledge-markdown") : window.ClaraCoreKnowledgeMarkdown;
  const CATALOG_LIMIT = 10;
  const REFERENCE_LIMIT = 6;
  const PREVIEW_LIMIT = 420;
  let active = false;
  let selectedLineId = "";
  let selectionWasRemoved = false;
  let revision = 0;
  let request = null;
  let attemptedStamp = "";
  let detail = null;
  let detailState = "idle";
  let currentLines = [];
  let references = [];
  let catalogLoadFailed = false;
  let failedCatalog = null;
  let bodyMarkup = null;
  let selectorMarkup = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function preview(value) {
    const characters = Array.from(text(value));
    return characters.length > PREVIEW_LIMIT
      ? `${characters.slice(0, PREVIEW_LIMIT).join("")}…`
      : characters.join("");
  }

  function catalogLines(catalog) {
    const seen = new Set();
    return (Array.isArray(catalog?.lines) ? catalog.lines : []).filter((line) => {
      if (!text(line?.id) || seen.has(line.id)) return false;
      if (line.status === "archived") return false;
      seen.add(line.id);
      return true;
    });
  }

  function packetMatches(packet, lineId) {
    return Boolean(lineId && packet?.lineId === lineId && packet?.currentPosition?.lineId === lineId);
  }

  function invalidate() {
    revision += 1;
    request = null;
  }

  function setStatus(state, message = "") {
    root.dataset.state = state;
    root.setAttribute("aria-busy", state === "loading" ? "true" : "false");
    notice.textContent = message;
    notice.hidden = !message;
  }

  function setBody(markup) {
    markup = renderFusion() + markup;
    if (markup === bodyMarkup) return;
    body.innerHTML = markup;
    bodyMarkup = markup;
  }

  function renderFusion() {
    const ready = root.dataset.state === "ready" && packetMatches(detail, selectedLineId);
    // These are recorded reference shapes, not a relevance search. Unrecognized
    // paths stay in the evidence reader without being assigned to a domain.
    const unique = [...new Set(references)];
    const counts = {
      memory: unique.filter(value => /^mem_[a-zA-Z0-9_-]+$/u.test(value)).length,
      knowledge: unique.filter(value => /^(?:notes|topics)\/[^#]+\.md(?:#[^#]+)?$/u.test(value)).length,
      innerlife: unique.filter(value => /^inner_share_[a-zA-Z0-9_-]+$/u.test(value)).length
    };
    const domains = ["memory", "knowledge", "shared-line", "innerlife"];
    return `<div class="understanding-fusion"><nav class="understanding-sources" aria-label="${escapeHtml(t("home.fusion.label"))}">${domains.map(domain => {
      const linked = ready && (domain === "shared-line" || counts[domain] > 0);
      const action = domain === "shared-line" && ready
        ? `data-understanding-action="open-line" data-shared-line-id="${escapeHtml(selectedLineId)}"`
        : `data-view-target="${domain}"`;
      const status = !ready ? t(root.dataset.state === "error" ? "home.fusion.unavailable" : "home.fusion.awaitTopic")
        : domain === "shared-line" ? t("home.fusion.currentPosition")
          : counts[domain] ? t("home.fusion.references", { count: String(counts[domain]) }) : t("home.fusion.noReference");
      return `<button type="button" class="understanding-source" data-domain="${domain}" data-linked="${linked}" ${action}><span class="understanding-source-heading"><span class="nav-icon nav-icon-${domain}" aria-hidden="true"></span><strong>${escapeHtml(t(`home.fusion.${domain}`))}</strong></span><span class="understanding-source-role">${escapeHtml(t(`home.fusion.${domain}Role`))}</span><span class="understanding-source-status">${escapeHtml(status)}</span></button>`;
    }).join("")}</nav><svg class="understanding-streams" viewBox="0 0 1000 68" preserveAspectRatio="none" aria-hidden="true" focusable="false">${domains.map((domain, index) => `<path data-domain="${domain}" data-linked="${ready && (domain === "shared-line" || counts[domain] > 0)}" d="M${125 + index * 250} 0 C${125 + index * 250} 44 500 18 500 66"/>`).join("")}<circle cx="500" cy="64" r="3"/></svg><p class="understanding-fusion-center">${escapeHtml(t("home.fusion.center"))}</p><p class="understanding-fusion-note">${escapeHtml(t("home.fusion.note"))}</p></div>`;
  }

  function catalogAction() {
    return `<button type="button" class="text-button understanding-catalog-action" data-view-target="shared-line">${escapeHtml(t("home.understanding.allTopics"))}</button>`;
  }

  function fullLineAction(label = "home.understanding.readFull") {
    return `<button type="button" class="text-button understanding-read-action" data-understanding-action="open-line" data-shared-line-id="${escapeHtml(selectedLineId)}">${escapeHtml(t(label))}</button>`;
  }

  function section(titleKey, content, emptyKey, extraClass = "") {
    const value = text(content);
    return `<section class="understanding-section ${extraClass}"><h3>${escapeHtml(t(titleKey))}</h3>${prose(value ? preview(value) : t(emptyKey), !value)}</section>`;
  }

  function prose(value, empty = false) {
    return `<div class="understanding-prose reading-prose${empty ? " understanding-empty-copy" : ""}">${markdown.render(value, "", { reading: true, linkMode: "text" })}</div>`;
  }

  function renderSelector() {
    const selectedLine = currentLines.find((line) => line.id === selectedLineId);
    const visibleLines = currentLines.slice(0, CATALOG_LIMIT);
    if (selectedLine && !visibleLines.some((line) => line.id === selectedLine.id)) {
      visibleLines[visibleLines.length - 1] = selectedLine;
    }
    const placeholder = `<option value=""${selectedLine ? "" : " selected"}>${escapeHtml(t(currentLines.length ? "home.understanding.chooseTopic" : "home.understanding.noTopics"))}</option>`;
    const markup = placeholder + visibleLines.map((line) => `<option value="${escapeHtml(line.id)}"${line.id === selectedLineId ? " selected" : ""}>${escapeHtml(text(line.title) || line.id)}</option>`).join("");
    if (markup !== selectorMarkup) {
      select.innerHTML = markup;
      selectorMarkup = markup;
    }
    select.disabled = !currentLines.length;
  }

  function renderContent() {
    references = [];
    renderSelector();
    if (!currentLines.length) {
      setStatus("empty");
      setBody(`<div class="understanding-empty"><h3>${escapeHtml(t("home.understanding.emptyTitle"))}</h3><p>${escapeHtml(t("home.understanding.emptyBody"))}</p>${catalogAction()}</div>`);
      return;
    }
    if (!selectedLineId) {
      setStatus("unselected", selectionWasRemoved ? t("home.understanding.selectionRemoved") : "");
      setBody(`<div class="understanding-empty"><h3>${escapeHtml(t("home.understanding.chooseTitle"))}</h3><p>${escapeHtml(t("home.understanding.chooseBody"))}</p>${catalogAction()}</div>`);
      return;
    }
    if (detailState === "error") {
      setStatus("error", t("home.understanding.loadFailed"));
      setBody(`<div class="understanding-empty"><p>${escapeHtml(t("home.understanding.loadFailedBody"))}</p><button type="button" class="secondary-button" data-understanding-action="retry">${escapeHtml(t("home.understanding.retry"))}</button>${catalogAction()}</div>`);
      return;
    }
    if (!packetMatches(detail, selectedLineId)) {
      setStatus("loading", t("home.understanding.loading"));
      setBody(`<p class="understanding-empty-copy">${escapeHtml(t("home.understanding.loadingBody"))}</p>`);
      return;
    }

    const position = detail.currentPosition;
    const metadata = position.metadata || {};
    const selected = currentLines.find((line) => line.id === selectedLineId);
    const title = text(selected?.title) || text(position.lineTitle) || text(detail.lineTitle) || selectedLineId;
    const nextStep = text(Object.hasOwn(position, "nextStep") ? position.nextStep : metadata.nextStep);
    const confirmedGround = text(metadata.confirmedGround);
    const provisionalRead = text(metadata.provisionalRead);
    const misreadRisks = text(metadata.misreadRisks);
    const recordedReferences = Array.isArray(position.factsUsed)
      ? position.factsUsed
      : Array.isArray(metadata.factsUsed) ? metadata.factsUsed : [];
    references = recordedReferences.filter((reference) => typeof reference === "string" && reference.trim());
    setStatus("ready");
    setBody(`<div class="understanding-layout" data-has-references="${references.length > 0}">
      <div class="understanding-main">
        <header class="understanding-topic-heading"><p class="understanding-eyebrow">${escapeHtml(t("home.understanding.currentTopic"))}</p><h2>${escapeHtml(title)}</h2></header>
        ${section("home.understanding.position", position.summary, "home.understanding.noPosition", "understanding-position")}
        ${nextStep ? section("home.understanding.nextStep", nextStep, "home.understanding.noNextStep", "understanding-next-step") : ""}
        ${confirmedGround ? section("home.understanding.recordedUnderstanding", confirmedGround, "", "understanding-ground") : ""}
        ${provisionalRead || misreadRisks ? `<section class="understanding-section understanding-unresolved"><h3>${escapeHtml(t("home.understanding.unresolved"))}</h3>${provisionalRead ? prose(preview(provisionalRead)) : ""}${misreadRisks ? prose(preview(misreadRisks)) : ""}</section>` : ""}
        <footer class="understanding-actions">${fullLineAction()}${currentLines.length > CATALOG_LIMIT ? catalogAction() : ""}</footer>
      </div>
      <aside class="understanding-evidence"><h3>${escapeHtml(t("home.understanding.evidence"))}</h3>${references.length ? `<p class="understanding-evidence-note">${escapeHtml(t("home.understanding.evidenceNote"))}</p>` : ""}
        ${references.length ? `<ul class="understanding-reference-list">${references.slice(0, REFERENCE_LIMIT).map((reference, index) => `<li><code class="understanding-reference">${escapeHtml(reference)}</code><button type="button" class="text-button understanding-copy" data-understanding-action="copy-reference" data-reference-index="${index}" aria-label="${escapeHtml(t("home.understanding.copyReferenceNumber", { number: String(index + 1) }))}">${escapeHtml(t("home.understanding.copyReference"))}</button></li>`).join("")}</ul>` : `<p class="understanding-empty-copy">${escapeHtml(t("home.understanding.noReferences"))}</p>`}
        ${references.length > REFERENCE_LIMIT ? fullLineAction("home.understanding.allReferences") : ""}
      </aside>
    </div>`);
  }

  function stampFor(catalog, lineId) {
    const line = currentLines.find((item) => item.id === lineId) || {};
    const position = catalog?.currentPosition?.lineId === lineId ? catalog.currentPosition : {};
    return JSON.stringify([lineId, line.title, line.status, line.active, line.updatedAt, line.positionUpdatedAt, line.summary, line.interpretationStatus, position.id, position.updatedAt, position.summary]);
  }

  function readDetail(stamp) {
    invalidate();
    const currentRevision = revision;
    const lineId = selectedLineId;
    attemptedStamp = stamp;
    detail = null;
    detailState = "loading";
    renderContent();
    request = Promise.resolve().then(() => {
      if (!active || currentRevision !== revision || lineId !== selectedLineId) return null;
      return api.getSharedLine({ lineId });
    }).then((packet) => {
      if (!active || currentRevision !== revision || lineId !== selectedLineId) return;
      if (!packetMatches(packet, lineId)) throw new Error("Shared Line detail identity mismatch");
      detail = packet;
      detailState = "ready";
      renderContent();
    }).catch(() => {
      if (!active || currentRevision !== revision || lineId !== selectedLineId) return;
      detail = null;
      detailState = "error";
      renderContent();
    }).finally(() => {
      if (currentRevision === revision) request = null;
    });
    return request;
  }

  function render() {
    if (!active) return Promise.resolve();
    const catalog = getSnapshot()?.sharedLine;
    if (catalogLoadFailed && catalog === failedCatalog) return Promise.resolve();
    if (!catalog) {
      renderLoading();
      return Promise.resolve();
    }
    catalogLoadFailed = false;
    failedCatalog = null;
    currentLines = catalogLines(catalog);
    if (selectedLineId && !currentLines.some((line) => line.id === selectedLineId)) {
      invalidate();
      selectedLineId = "";
      selectionWasRemoved = true;
      detail = null;
      attemptedStamp = "";
    }
    if (!selectedLineId && !selectionWasRemoved) {
      const catalogCurrentId = [catalog.currentPosition?.lineId, catalog.currentLine?.id]
        .find((lineId) => currentLines.some((line) => line.id === lineId));
      selectedLineId = catalogCurrentId || (currentLines.length === 1 ? currentLines[0].id : "");
    }
    if (!selectedLineId) {
      renderContent();
      return Promise.resolve();
    }
    const stamp = stampFor(catalog, selectedLineId);
    if (stamp !== attemptedStamp || (detailState === "loading" && !request)) return readDetail(stamp);
    renderContent();
    return request || Promise.resolve();
  }

  function setActive(value) {
    active = Boolean(value);
    if (!active) {
      invalidate();
      return Promise.resolve();
    }
    return render();
  }

  function renderLoading() {
    invalidate();
    detail = null;
    attemptedStamp = "";
    detailState = "loading";
    references = [];
    catalogLoadFailed = false;
    failedCatalog = null;
    select.disabled = true;
    setStatus("loading", t("home.understanding.loading"));
    setBody(`<p class="understanding-empty-copy">${escapeHtml(t("home.understanding.loadingBody"))}</p>`);
  }

  function renderLoadError() {
    invalidate();
    detail = null;
    attemptedStamp = "";
    references = [];
    catalogLoadFailed = true;
    failedCatalog = getSnapshot()?.sharedLine;
    select.disabled = true;
    setStatus("error", t("home.understanding.catalogFailed"));
    setBody(`<div class="understanding-empty"><p>${escapeHtml(t("home.understanding.catalogFailedBody"))}</p><button type="button" class="secondary-button" data-home-action="retry">${escapeHtml(t("home.understanding.retry"))}</button></div>`);
  }

  select.addEventListener("change", () => {
    if (!active) return;
    const lineId = select.value || "";
    if (lineId && !currentLines.some((line) => line.id === lineId)) return;
    invalidate();
    selectedLineId = lineId;
    selectionWasRemoved = !lineId;
    detail = null;
    attemptedStamp = "";
    render();
  });

  root.addEventListener("click", async (event) => {
    const button = event.target.closest?.("button[data-understanding-action]");
    if (!active || !button || !root.contains(button)) return;
    const action = button.dataset.understandingAction;
    if (action === "retry") {
      attemptedStamp = "";
      await render();
      return;
    }
    if (action === "open-line") {
      if (!packetMatches(detail, selectedLineId) || button.dataset.sharedLineId !== selectedLineId) return;
      const openRevision = revision;
      const openLineId = selectedLineId;
      const isCurrent = () => active && revision === openRevision && selectedLineId === openLineId;
      try {
        await onOpenLine(button, { isCurrent });
      } catch (_) {
        if (isCurrent()) setStatus("ready", t("home.understanding.openFailed"));
      }
      return;
    }
    if (action === "copy-reference") {
      const reference = references[Number(button.dataset.referenceIndex)];
      if (typeof reference !== "string") return;
      const copyRevision = revision;
      button.disabled = true;
      try {
        const result = await api.copyText(reference);
        if (result === false) throw new Error("Reference copy failed");
        if (active && copyRevision === revision) setStatus("ready", t("home.understanding.referenceCopied"));
      } catch (_) {
        if (active && copyRevision === revision) setStatus("ready", t("home.understanding.copyFailed"));
      } finally {
        button.disabled = false;
      }
    }
  });

  return { setActive, render, renderLoading, renderLoadError };
}

if (typeof window !== "undefined") window.createClaraCoreHomeUnderstanding = createClaraCoreHomeUnderstanding;
if (typeof module !== "undefined") module.exports = { createClaraCoreHomeUnderstanding };
