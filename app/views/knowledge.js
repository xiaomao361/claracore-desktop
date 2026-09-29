(function (scope) {
  function createClaraCoreKnowledgeView({ dom, api, t, markdown, formatLocalDateTime }) {
    let active = false;
    let generation = 0;
    let readVersion = 0;
    let catalogVersion = 0;
    let activityVersion = 0;
    let root = "";
    let selected = "";
    let currentDocument = null;
    let history = [];
    let referenceVersion = 0;
    let referenceSelected = "";
    let referenceDocument = null;
    let referenceHistory = [];
    const mainPosition = () => ({ reference: selected, scrollTop: dom.knowledgeMainPane.scrollTop || 0 });
    const referencePosition = () => ({ reference: referenceSelected, scrollTop: dom.knowledgeReferencePane.scrollTop || 0 });
    let offset = 0;
    let activityOffset = 0;
    let incomingOffset = 0;
    let outgoingOffset = 0;
    let capturePreview = null;
    let captureVersion = 0;
    let captureBusy = false;
    let saveUncertain = false;
    const escape = markdown.escape;
    const status = (element, key, values) => { element.textContent = t(key, values); };
    const errorText = (error) => t("knowledge.page.error", { error: error?.message || String(error) });
    const fresh = (version) => active && version === generation;
    const pathOf = (reference) => reference.split("#")[0];
    const anchorOf = (reference) => reference.includes("#") ? reference.slice(reference.indexOf("#") + 1) : "";
    const refLink = (reference, label) => `<a href="#knowledge:${encodeURIComponent(reference)}" data-knowledge-ref="${escape(reference)}">${escape(label)}</a>`;
    const updateCopyLabel = () => status(dom.knowledgeCopyReference, anchorOf(selected) ? "knowledge.page.copy" : "knowledge.page.copyDocument");

    let searchVersion = 0;
    let searchOffset = 0;
    let searchInput = null;
    let building = false;
    let pauseBuild = false;
    let indexVersion = 0;
    let semanticState = "checking";
    let semanticProgress = null;
    const semanticStates = new Set(["checking", "not_built", "current", "stale", "corrupt", "unavailable", "paused", "error", "model"]);
    function syncSemanticOptions() {
      const mode = dom.knowledgeSearchMode.value || "exact";
      const state = building ? "building" : semanticState;
      dom.knowledgeSemanticOptions.hidden = mode === "exact" && !building;
      status(dom.knowledgeSearchModeHint, `knowledge.search.modeHint.${mode}`);
      status(dom.knowledgeSemanticHeading, `knowledge.search.state.${state}`);
      status(dom.knowledgeSemanticHint, `knowledge.search.help.${state}`);
      dom.knowledgeSemanticOptions.dataset.state = state;
      dom.knowledgeSemanticBuild.hidden = state === "current" || state === "model" || building;
      dom.knowledgeSemanticBuild.disabled = state === "checking" || building || dom.knowledgeSearchSubmit.disabled;
      status(dom.knowledgeSemanticBuild, state === "unavailable" ? "knowledge.search.check" : state === "paused" ? "knowledge.search.resume" : state === "not_built" ? "knowledge.search.prepare" : "knowledge.search.update");
      dom.knowledgeSemanticPause.hidden = !building;
      dom.knowledgeSemanticPause.disabled = pauseBuild || !building;
      dom.knowledgeSemanticSettings.hidden = state !== "model";
      dom.knowledgeSemanticProgress.hidden = !building && (state !== "paused" || !semanticProgress);
      if (semanticProgress) {
        dom.knowledgeSemanticProgress.max = Math.max(1, semanticProgress.total);
        dom.knowledgeSemanticProgress.value = semanticProgress.processed;
      } else dom.knowledgeSemanticProgress.removeAttribute("value");
    }
    function semanticFailure(code) {
      indexVersion += 1;
      semanticState = ({ index_missing: "not_built", index_stale: "stale", model_changed: "model_changed", index_corrupt: "corrupt", model_unavailable: "model", model_disabled: "model", local_model_required: "model", model_timeout: "model", invalid_embedding: "model" })[code] || "error";
      semanticProgress = null;
      syncSemanticOptions();
    }
    function searchFailure(result) {
      const key = `knowledge.search.issue.${result.code}`;
      const known = ["index_missing", "index_stale", "index_corrupt", "model_changed", "model_unavailable", "model_disabled", "local_model_required", "model_timeout", "invalid_embedding", "index_busy"];
      return known.includes(result.code) ? t(key) : t("knowledge.search.failed", result);
    }
    function searchMetadata(item) {
      const parts = [item.reference];
      if (item.date) parts.push(t("knowledge.search.sectionDate", { date: item.date }));
      if (item.documentDate) parts.push(t("knowledge.search.documentDate", { date: item.documentDate }));
      if (item.sourceLabel || item.source) parts.push(t("knowledge.search.sourceLabel", { source: item.sourceLabel || item.source }));
      if (item.sourceTruncated) parts.push(t("knowledge.search.sourceDetails"));
      return parts.map(escape).join(" · ");
    }
    function resetSearch() {
      searchVersion += 1;
      searchInput = null;
      pauseBuild = true;
      semanticState = "checking"; semanticProgress = null;
      dom.knowledgeSearchResults.innerHTML = "";
      dom.knowledgeSearchStatus.textContent = "";
      dom.knowledgeSearchPagination.hidden = true;
      dom.knowledgeSearchPrevious.disabled = dom.knowledgeSearchNext.disabled = true;
      dom.knowledgeSearchSubmit.disabled = dom.knowledgeSemanticBuild.disabled = true;
    }
    async function runSearch() {
      if (!searchInput) return;
      const request = ++searchVersion, version = generation;
      dom.knowledgeSearchResults.innerHTML = "";
      dom.knowledgeSearchPagination.hidden = true;
      dom.knowledgeSearchPrevious.disabled = dom.knowledgeSearchNext.disabled = true;
      status(dom.knowledgeSearchStatus, "knowledge.page.loading");
      try {
        const result = await api.searchKnowledge({ ...searchInput, offset: searchOffset, limit: 10 });
        if (!fresh(version) || request !== searchVersion) return;
        if (result.status === "failed") { dom.knowledgeSearchStatus.textContent = searchFailure(result); semanticFailure(result.code); return; }
        if (result.status === "partial") semanticFailure(result.semanticError?.code);
        status(dom.knowledgeSearchStatus, result.status === "partial" ? "knowledge.search.partial" : result.total ? "knowledge.search.count" : "knowledge.search.empty", { count: result.total, code: result.semanticError?.code });
        dom.knowledgeSearchResults.innerHTML = result.items.map((item) => `<div class="knowledge-document-row">${refLink(item.reference, item.heading || item.reference)}<small>${searchMetadata(item)}</small><p>${escape(item.preview)}</p></div>`).join("");
        dom.knowledgeSearchPrevious.disabled = searchOffset === 0;
        dom.knowledgeSearchNext.disabled = !result.hasMore;
        dom.knowledgeSearchPagination.hidden = searchOffset === 0 && !result.hasMore;
      } catch (error) { if (fresh(version) && request === searchVersion) { dom.knowledgeSearchStatus.textContent = error.code ? searchFailure(error) : errorText(error); if (error.code) semanticFailure(error.code); } }
    }
    dom.knowledgeSearchForm.addEventListener("submit", (event) => {
      event.preventDefault(); searchOffset = 0;
      searchInput = { query: dom.knowledgeSearchQuery.value, mode: dom.knowledgeSearchMode.value || "exact", textMatch: "folded" }; runSearch();
    });
    dom.knowledgeSearchPrevious.addEventListener("click", () => { searchOffset = Math.max(0, searchOffset - 10); runSearch(); });
    dom.knowledgeSearchNext.addEventListener("click", () => { searchOffset += 10; runSearch(); });
    dom.knowledgeSearchMode.addEventListener("change", () => { syncSemanticOptions(); if (active && !building) loadIndex(); });
    dom.knowledgeSemanticPause.addEventListener("click", () => { pauseBuild = true; dom.knowledgeSemanticPause.disabled = true; status(dom.knowledgeSemanticStatus, "knowledge.search.pausing"); });
    dom.knowledgeSemanticBuild.addEventListener("click", async () => {
      if (building) return;
      if (semanticState === "unavailable") { semanticState = "checking"; syncSemanticOptions(); await loadIndex(); return; }
      building = true; pauseBuild = false; indexVersion += 1;
      const version = generation;
      syncSemanticOptions();
      dom.knowledgeSemanticBuild.disabled = true; dom.knowledgeSemanticPause.hidden = false; dom.knowledgeSemanticPause.disabled = false;
      status(dom.knowledgeSemanticStatus, "knowledge.search.starting");
      dom.knowledgeRefresh.disabled = true;
      try {
        do {
          const result = await api.rebuildKnowledgeSearchIndex({ batchSize: 20 });
          if (!fresh(version)) break;
          if (result.status === "failed") { semanticFailure(result.code); dom.knowledgeSemanticStatus.textContent = searchFailure(result); break; }
          semanticState = result.status === "current" ? "current" : "paused";
          semanticProgress = { processed: result.processed, total: result.total };
          syncSemanticOptions();
          status(dom.knowledgeSemanticStatus, "knowledge.search.progress", { ...result, state: t(`knowledge.search.${result.status === "current" ? "current" : pauseBuild ? "paused" : "building"}`) });
          if (result.status === "current") {
            // Refresh the structural cache as part of this explicit update.
            // Its failure must not undo or misreport the completed vectors.
            try {
              const structural = await api.rebuildKnowledgeIndex();
              if (!fresh(version)) break;
              dom.knowledgeIndexAlert.hidden = structural.status === "current";
              status(dom.knowledgeIndexStatus, `knowledge.index.${structural.status}`);
            } catch (error) {
              if (!fresh(version)) break;
              dom.knowledgeIndexAlert.hidden = false;
              dom.knowledgeIndexStatus.textContent = errorText(error);
            }
            if (!pauseBuild && searchInput && searchInput.mode !== "exact"
              && searchInput.query === dom.knowledgeSearchQuery.value
              && searchInput.mode === dom.knowledgeSearchMode.value) {
              searchOffset = 0;
              await runSearch();
            }
            break;
          }
        } while (!pauseBuild && fresh(version));
      } catch (error) { if (fresh(version)) { semanticFailure(error.code); dom.knowledgeSemanticStatus.textContent = errorText(error); } }
      finally { building = false; if (active) { dom.knowledgeRefresh.disabled = false; syncSemanticOptions(); if (!fresh(version)) loadIndex(); } }
    });

    function clearReader() {
      currentDocument = null;
      updateCopyLabel();
      dom.knowledgeReaderPath.textContent = "";
      dom.knowledgeReaderBody.innerHTML = `<p>${escape(t("knowledge.page.select"))}</p>`;
      dom.knowledgeReaderStatus.textContent = "";
      dom.knowledgeContents.hidden = true;
      dom.knowledgeRelations.hidden = true;
      dom.knowledgeCopyReference.disabled = true;
    }

    function captureControls() {
      for (const element of dom.knowledgeCaptureForm.querySelectorAll("input, textarea, button")) element.disabled = captureBusy || saveUncertain;
      dom.knowledgeCaptureSave.disabled = captureBusy || !capturePreview;
      dom.knowledgeCaptureCancel.disabled = captureBusy;
    }

    function invalidateCapture() {
      captureVersion += 1;
      capturePreview = null;
      dom.knowledgeCapturePreviewPanel.hidden = true;
      dom.knowledgeCaptureAddition.textContent = "";
      captureControls();
    }

    async function loadCatalog(version = generation) {
      const request = ++catalogVersion;
      status(dom.knowledgeCatalogStatus, "knowledge.page.loading");
      dom.knowledgePrevious.disabled = dom.knowledgeNext.disabled = true;
      dom.knowledgeCatalogList.innerHTML = "";
      try {
        const page = await api.listKnowledgeDocuments({ offset, limit: 10, folder: dom.knowledgeFolder.value });
        if (!fresh(version) || request !== catalogVersion) return;
        const folders = new Map();
        for (const item of page.items) {
          const folder = item.path.split("/").slice(0, -1).join("/");
          if (!folders.has(folder)) folders.set(folder, []);
          folders.get(folder).push(item);
        }
        dom.knowledgeCatalogList.innerHTML = [...folders].map(([folder, items]) => {
          const label = { notes: "knowledge.page.notes", topics: "knowledge.page.topics", inbox: "knowledge.page.inbox" }[folder];
          return `<details class="knowledge-folder-group" open><summary>${escape(label ? t(label) : folder)}</summary>${items.map(item => `<div class="knowledge-document-row">${refLink(item.path, item.title)}<small>${escape(item.path)}</small></div>`).join("")}</details>`;
        }).join("");
        status(dom.knowledgeCatalogStatus, page.total ? "knowledge.page.count" : "knowledge.page.emptyCollection", { count: page.total, start: offset + 1, end: offset + page.items.length });
        dom.knowledgePrevious.disabled = offset === 0;
        dom.knowledgeNext.disabled = !page.hasMore;
        for (const link of dom.knowledgeCatalogList.querySelectorAll("a")) {
          if (link.dataset.knowledgeRef === pathOf(selected)) link.setAttribute("aria-current", "page");
        }
      } catch (error) {
        if (fresh(version) && request === catalogVersion) dom.knowledgeCatalogStatus.textContent = errorText(error);
      }
    }

    async function loadActivity(version = generation, append = false) {
      const request = ++activityVersion;
      if (!append) { activityOffset = 0; dom.knowledgeActivityList.innerHTML = ""; }
      dom.knowledgeMoreActivity.disabled = true;
      try {
        const page = await api.listKnowledgeActivity({ offset: activityOffset, limit: 10 });
        if (!fresh(version) || request !== activityVersion) return;
        const html = page.items.map((item) => `<button type="button" class="knowledge-activity-row" data-knowledge-activity="${escape(item.id)}"><span>${escape(item.path)}</span><small>${escape(t(`knowledge.activity.${item.status}`))} · ${escape(formatLocalDateTime(item.createdAt))}</small></button>`).join("");
        dom.knowledgeActivityList.insertAdjacentHTML("beforeend", html);
        status(dom.knowledgeActivityStatus, page.status === "partial" ? "knowledge.page.activityPartial" : page.total ? "knowledge.page.activityCount" : "knowledge.page.noActivity", { count: page.status === "partial" ? page.issueCount : page.total });
        activityOffset += page.items.length;
        dom.knowledgeMoreActivity.hidden = !page.hasMore;
      } catch (error) { if (fresh(version) && request === activityVersion) dom.knowledgeActivityStatus.textContent = errorText(error); }
      finally { if (fresh(version) && request === activityVersion) dom.knowledgeMoreActivity.disabled = false; }
    }

    async function loadIndex(version = generation) {
      const request = ++indexVersion;
      try {
        const result = await api.getKnowledgeIndexStatus();
        if (fresh(version) && request === indexVersion) {
          dom.knowledgeIndexAlert.hidden = result.status === "current";
          status(dom.knowledgeIndexStatus, `knowledge.index.${result.status}`);
          if (!building) {
            if (semanticState !== "paused" || result.semantic === "current") semanticState = semanticStates.has(result.semantic) ? result.semantic : "unavailable";
            syncSemanticOptions();
          }
        }
      } catch (error) { if (fresh(version) && request === indexVersion) { dom.knowledgeIndexAlert.hidden = false; dom.knowledgeIndexStatus.textContent = errorText(error); if (!building) { semanticState = "unavailable"; syncSemanticOptions(); } } }
    }

    async function refresh() {
      const version = ++generation;
      resetSearch();
      dom.knowledgeSemanticStatus.textContent = "";
      readVersion += 1;
      dom.knowledgeRefresh.disabled = true;
      dom.knowledgeRebuild.disabled = true;
      status(dom.knowledgePageStatus, "knowledge.page.loading");
      dom.knowledgeCatalogList.innerHTML = "";
      dom.knowledgeActivityList.innerHTML = "";
      dom.knowledgeMoreActivity.hidden = true;
      dom.knowledgePrevious.disabled = dom.knowledgeNext.disabled = true;
      dom.knowledgeCapturePreview.disabled = true;
      dom.knowledgeIndexStatus.textContent = "";
      dom.knowledgeIndexAlert.hidden = true;
      const previousSelection = selected;
      const previousScroll = dom.knowledgeMainPane.scrollTop || 0;
      closeReference();
      dom.knowledgeWorkspace.hidden = true;
      dom.knowledgePageStatus.hidden = false;
      dom.knowledgeToggleCatalog.disabled = dom.knowledgeToggleSearch.disabled = true;
      clearReader();
      try {
        const preference = await api.getKnowledgeRootPreference();
        if (!fresh(version)) return;
        if (root !== preference.root) {
          if (capturePreview) status(dom.knowledgeCaptureNotice, "knowledge.capture.rootChanged");
          saveUncertain = false;
          invalidateCapture(); selected = ""; history = []; offset = 0;
        }
        root = preference.root || "";
        dom.knowledgePageRoot.textContent = root || "";
        dom.knowledgeBack.disabled = history.length === 0;
        const ready = ["ok", "empty_corpus"].includes(preference.status);
        if (!ready) {
          status(dom.knowledgePageStatus, `knowledge.directory.${({ not_selected: "notSelected", root_missing: "rootMissing", permission_denied: "permissionDenied" })[preference.status] || "invalid"}`);
          dom.knowledgeCapturePreview.disabled = true;
          dom.knowledgeCatalogStatus.textContent = "";
          dom.knowledgeActivityStatus.textContent = "";
          return;
        }
        status(dom.knowledgePageStatus, "knowledge.page.ready", { count: preference.documentCount });
        dom.knowledgePageStatus.hidden = true;
        dom.knowledgeWorkspace.hidden = false;
        dom.knowledgeToggleCatalog.disabled = dom.knowledgeToggleSearch.disabled = false;
        captureControls();
        dom.knowledgeRebuild.disabled = false;
        dom.knowledgeSearchSubmit.disabled = false;
        dom.knowledgeSemanticBuild.disabled = building;
        await Promise.all([loadCatalog(version), loadActivity(version), loadIndex(version)]);
        if (fresh(version) && selected && selected === previousSelection) await openDocument(selected, false, false, previousScroll);
      } catch (error) {
        if (fresh(version)) {
          dom.knowledgePageRoot.textContent = "";
          dom.knowledgeCatalogStatus.textContent = dom.knowledgeActivityStatus.textContent = "";
          dom.knowledgePageStatus.textContent = errorText(error);
        }
      }
      finally { if (fresh(version)) dom.knowledgeRefresh.disabled = false; }
    }

    function focusAnchor(reference, focus = true, referencePane = false) {
      const body = referencePane ? dom.knowledgeReferenceBody : dom.knowledgeReaderBody;
      const pane = referencePane ? dom.knowledgeReferencePane : dom.knowledgeMainPane;
      const message = referencePane ? dom.knowledgeReferenceStatus : dom.knowledgeReaderStatus;
      const anchor = anchorOf(reference);
      const section = [...body.querySelectorAll("[data-knowledge-anchor]")].find((node) => node.dataset.knowledgeAnchor === anchor);
      for (const item of body.querySelectorAll(".knowledge-section")) item.classList.toggle("knowledge-section-current", Boolean(anchor) && item === section);
      if (anchor && !section) {
        status(message, "knowledge.page.missingAnchor", { anchor });
        pane.scrollTop = 0;
        return;
      }
      if (focus) {
        const target = section || body;
        target.focus({ preventScroll: true });
        // Scroll only this pane; scrollIntoView would also move the page/main reader.
        pane.scrollTop = section && target.getBoundingClientRect
          ? (pane.scrollTop || 0) + target.getBoundingClientRect().top - pane.getBoundingClientRect().top - 24 : 0;
      }
    }

    function markReference() {
      for (const link of dom.knowledgeReaderBody.querySelectorAll("[data-knowledge-ref]")) {
        if (referenceSelected && link.dataset.knowledgeRef === referenceSelected) link.setAttribute("data-reference-open", "true");
        else link.removeAttribute("data-reference-open");
      }
    }

    function closeReference(focus = false) {
      referenceVersion += 1;
      referenceSelected = ""; referenceDocument = null; referenceHistory = [];
      dom.knowledgeReferencePane.hidden = dom.knowledgeDivider.hidden = true;
      dom.knowledgePanes.classList.remove("has-reference");
      dom.knowledgeReferenceBody.innerHTML = "";
      dom.knowledgeReferenceStatus.textContent = dom.knowledgeReferencePath.textContent = "";
      dom.knowledgeReferenceContents.hidden = true;
      dom.knowledgeReferenceContentsList.innerHTML = "";
      dom.knowledgeReferencePromote.disabled = dom.knowledgeReferenceBack.disabled = true;
      markReference();
      if (focus) dom.knowledgeReaderBody.focus({ preventScroll: true });
    }

    async function openReference(reference, remember = true, restoredScroll = null) {
      const version = generation, request = ++referenceVersion;
      if (remember && referenceSelected && referenceSelected !== reference) {
        referenceHistory.push(referencePosition()); referenceHistory = referenceHistory.slice(-50);
      }
      referenceSelected = reference; referenceDocument = null;
      dom.knowledgeReferencePane.hidden = dom.knowledgeDivider.hidden = false;
      dom.knowledgePanes.classList.add("has-reference");
      dom.knowledgeReferenceBack.disabled = referenceHistory.length === 0;
      dom.knowledgeReferencePromote.disabled = true;
      dom.knowledgeReferenceBody.innerHTML = "";
      dom.knowledgeReferenceContents.hidden = true;
      dom.knowledgeReferencePath.textContent = pathOf(reference);
      status(dom.knowledgeReferenceStatus, "knowledge.page.loading");
      markReference();
      try {
        const document = await api.readKnowledgeDocument(pathOf(reference));
        if (!fresh(version) || request !== referenceVersion) return;
        referenceDocument = document;
        dom.knowledgeReferenceBody.innerHTML = markdown.renderDocument(document, "reference");
        dom.knowledgeReferenceStatus.textContent = "";
        dom.knowledgeReferencePromote.disabled = false;
        dom.knowledgeReferenceContentsList.innerHTML = document.sections.filter(section => section.anchor)
          .map(section => refLink(`${document.path}#${section.anchor}`, section.heading)).join("");
        dom.knowledgeReferenceContents.hidden = !document.sections.some(section => section.anchor);
        focusAnchor(reference, restoredScroll === null, true);
        if (restoredScroll !== null) dom.knowledgeReferencePane.scrollTop = restoredScroll;
      } catch (error) {
        if (fresh(version) && request === referenceVersion) dom.knowledgeReferenceStatus.textContent = errorText(error);
      }
    }

    async function loadLinks(version, request, appendDirection = "") {
      try {
        const links = await api.getKnowledgeLinks(currentDocument.path, { incomingOffset, outgoingOffset, limit: 10 });
        if (!fresh(version) || request !== readVersion) return;
        const rows = (items, incoming) => items.map((edge) => {
          const reference = incoming ? `${edge.source}${edge.sourceAnchor ? `#${edge.sourceAnchor}` : ""}` : `${edge.target}${edge.anchor ? `#${edge.anchor}` : ""}`;
          return `<div class="knowledge-document-row">${refLink(reference, incoming ? edge.source : edge.label)}<small>${escape(reference)}</small></div>`;
        }).join("");
        if (appendDirection !== "outgoing") {
          if (!appendDirection) dom.knowledgeIncoming.innerHTML = "";
          dom.knowledgeIncoming.insertAdjacentHTML("beforeend", rows(links.incoming, true) || (incomingOffset === 0 ? `<p class="quiet">${escape(t("knowledge.page.noIncoming"))}</p>` : ""));
          incomingOffset += links.incoming.length;
        }
        if (appendDirection !== "incoming") {
          if (!appendDirection) dom.knowledgeOutgoing.innerHTML = "";
          dom.knowledgeOutgoing.insertAdjacentHTML("beforeend", rows(links.outgoing, false) || (outgoingOffset === 0 ? `<p class="quiet">${escape(t("knowledge.page.noOutgoing"))}</p>` : ""));
          outgoingOffset += links.outgoing.length;
        }
        status(dom.knowledgeLinksStatus, links.brokenTotal ? "knowledge.page.brokenLinks" : "knowledge.page.linkCounts", { count: links.brokenTotal, incoming: links.incomingTotal, outgoing: links.outgoingTotal });
        if (links.brokenTotal) dom.knowledgeLinksStatus.textContent += ` ${links.broken.map((edge) => `${edge.target}${edge.anchor ? `#${edge.anchor}` : ""} (${edge.reason})`).join("; ")}`;
        dom.knowledgeMoreIncoming.hidden = incomingOffset >= links.incomingTotal;
        dom.knowledgeMoreOutgoing.hidden = outgoingOffset >= links.outgoingTotal;
      } catch (error) { if (fresh(version) && request === readVersion) dom.knowledgeLinksStatus.textContent = errorText(error); }
    }

    async function openDocument(reference, remember = true, focus = true, restoredScroll = null) {
      const version = generation;
      const request = ++readVersion;
      if (remember && selected && selected !== reference) { history.push(mainPosition()); history = history.slice(-50); }
      selected = reference;
      clearReader();
      dom.knowledgeBack.disabled = history.length === 0;
      dom.knowledgeReaderPath.textContent = pathOf(reference);
      status(dom.knowledgeReaderStatus, "knowledge.page.loading");
      try {
        const document = await api.readKnowledgeDocument(pathOf(reference));
        if (!fresh(version) || request !== readVersion) return;
        currentDocument = document;
        dom.knowledgeReaderBody.innerHTML = markdown.renderDocument(document);
        dom.knowledgeCopyReference.disabled = false;
        dom.knowledgeReaderStatus.textContent = "";
        dom.knowledgeContentsList.innerHTML = document.sections.filter((section) => section.anchor).map((section) => refLink(`${document.path}#${section.anchor}`, section.heading)).join("");
        dom.knowledgeContents.hidden = !document.sections.some((section) => section.anchor);
        dom.knowledgeRelations.hidden = false;
        dom.knowledgeIncoming.innerHTML = dom.knowledgeOutgoing.innerHTML = "";
        dom.knowledgeMoreIncoming.hidden = dom.knowledgeMoreOutgoing.hidden = true;
        status(dom.knowledgeLinksStatus, "knowledge.page.loading");
        incomingOffset = outgoingOffset = 0;
        focusAnchor(reference, focus && restoredScroll === null);
        if (restoredScroll !== null) dom.knowledgeMainPane.scrollTop = restoredScroll;
        markReference();
        for (const item of dom.knowledgeCatalogList.querySelectorAll("a")) {
          if (item.dataset.knowledgeRef === document.path) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current");
        }
        await loadLinks(version, request);
      } catch (error) {
        if (fresh(version) && request === readVersion) {
          dom.knowledgeReaderBody.innerHTML = "";
          dom.knowledgeReaderStatus.textContent = errorText(error);
        }
      }
    }

    async function openActivity(id) {
      const version = generation;
      const request = ++readVersion;
      closeReference();
      if (selected) { history.push(mainPosition()); history = history.slice(-50); }
      selected = "";
      clearReader();
      dom.knowledgeBack.disabled = history.length === 0;
      status(dom.knowledgeReaderStatus, "knowledge.page.loading");
      try {
        const item = await api.readKnowledgeActivity(id);
        if (!fresh(version) || request !== readVersion) return;
        dom.knowledgeReaderPath.textContent = item.path;
        status(dom.knowledgeReaderStatus, `knowledge.activity.${item.status}`);
        if (item.kind === "draft") {
          dom.knowledgeReaderBody.innerHTML = `<h2>${escape(t("knowledge.page.draftTitle"))}</h2><p>${escape(t("knowledge.page.draftHint", { time: formatLocalDateTime(item.expiresAt) }))}</p><pre>${escape(item.addition)}</pre>`;
        } else {
          const semantic = item.index?.semantic;
          const searchHint = item.index?.excluded ? "excluded" : semantic === "current" ? "current"
            : semantic === "stale" || semantic === "not_built" ? "update" : "unknown";
          dom.knowledgeReaderBody.innerHTML = `<h2>${escape(t("knowledge.page.receiptTitle"))}</h2><p>${escape(t(item.status === "saved" ? "knowledge.page.receiptSaved" : "knowledge.page.receiptPartial"))}</p><p>${escape(t(`knowledge.page.receiptSearch.${searchHint}`))}</p><div class="knowledge-receipt-links">${(item.sections || []).map((section) => refLink(section.reference, section.reference)).join("") || refLink(item.path, item.path)}</div><details><summary>${escape(t("knowledge.page.receiptDetails"))}</summary><pre>${escape(JSON.stringify(item, null, 2))}</pre></details>`;
        }
        dom.knowledgeReaderBody.focus({ preventScroll: true });
        dom.knowledgeMainPane.scrollTop = 0;
      } catch (error) { if (fresh(version) && request === readVersion) dom.knowledgeReaderStatus.textContent = errorText(error); }
    }

    async function previewMaterial(event) {
      event?.preventDefault();
      if (captureBusy || saveUncertain) return;
      if (dom.knowledgeCaptureForm.reportValidity && !dom.knowledgeCaptureForm.reportValidity()) return;
      const version = ++captureVersion;
      captureBusy = true; capturePreview = null; captureControls();
      dom.knowledgeCapturePreviewPanel.hidden = true;
      status(dom.knowledgeCaptureNotice, "knowledge.page.loading");
      try {
        const raw = dom.knowledgeCaptureBody.value || dom.knowledgeCaptureSource.value;
        const fence = "`".repeat(Math.max(3, ...[...raw.matchAll(/`+/gu)].map((match) => match[0].length + 1)));
        if (new TextEncoder().encode(`${fence}text\n${raw}\n${fence}`).length > 24 * 1024) {
          dom.knowledgeCaptureBody.setAttribute("aria-invalid", "true");
          status(dom.knowledgeCaptureNotice, "knowledge.capture.tooLong");
          dom.knowledgeCaptureBody.focus();
          return;
        }
        const id = scope.crypto.randomUUID();
        const result = await api.previewKnowledgeIntake({ mode: "create", path: `inbox/${dom.knowledgeCaptureDate.value}-${id}.md`, title: dom.knowledgeCaptureTitle.value,
          pendingReason: dom.knowledgeCaptureReason.value, nextStep: t("knowledge.capture.nextStep"),
          sections: [{ anchor: `material-${id}`, heading: t("knowledge.capture.original"), body: `${fence}text\n${raw}\n${fence}`,
            source: dom.knowledgeCaptureSource.value, date: dom.knowledgeCaptureDate.value, attribution: "source_statement" }] });
        if (version !== captureVersion) return;
        capturePreview = result;
        dom.knowledgeCaptureAddition.textContent = result.addition;
        dom.knowledgeCapturePreviewPanel.hidden = false;
        status(dom.knowledgeCaptureNotice, "knowledge.capture.previewReady");
      } catch (error) { if (version === captureVersion) dom.knowledgeCaptureNotice.textContent = errorText(error); }
      finally { captureBusy = false; captureControls(); }
    }

    async function saveMaterial() {
      if (!capturePreview || captureBusy) return;
      captureBusy = true; captureControls();
      const savedRoot = root;
      status(dom.knowledgeCaptureNotice, "knowledge.capture.saving");
      try {
        const receipt = await api.commitKnowledgeIntake(capturePreview.token);
        capturePreview = null; saveUncertain = false;
        status(dom.knowledgeCaptureNotice, receipt.status === "saved" ? "knowledge.capture.saved" : "knowledge.capture.partial");
        if (savedRoot === root) dom.knowledgeCaptureNotice.insertAdjacentHTML("beforeend", ` ${refLink(receipt.path, t("knowledge.capture.open"))}`);
        else status(dom.knowledgeCaptureNotice, "knowledge.capture.savedElsewhere", { root: savedRoot });
        if (active) await Promise.all([loadCatalog(), loadActivity(), loadIndex()]);
      } catch (error) {
        saveUncertain = true;
        dom.knowledgeCaptureNotice.textContent = `${t("knowledge.capture.retry")} ${errorText(error)}`;
      } finally { captureBusy = false; captureControls(); }
    }

    for (const [button, panel] of [[dom.knowledgeToggleCatalog, dom.knowledgeCatalog], [dom.knowledgeToggleSearch, dom.knowledgeSearchPanel], [dom.knowledgeToggleTools, dom.knowledgeTools]]) {
      button.addEventListener("click", () => {
        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden && panel !== dom.knowledgeCatalog) {
          const otherButton = panel === dom.knowledgeSearchPanel ? dom.knowledgeToggleTools : dom.knowledgeToggleSearch;
          const otherPanel = panel === dom.knowledgeSearchPanel ? dom.knowledgeTools : dom.knowledgeSearchPanel;
          otherPanel.hidden = true; otherButton.setAttribute("aria-expanded", "false");
        }
        if (panel === dom.knowledgeSearchPanel && !panel.hidden) { dom.knowledgeSearchQuery.focus(); if (!building) loadIndex(); }
      });
    }
    dom.knowledgeReferenceClose.addEventListener("click", () => closeReference(true));
    dom.knowledgeReferenceBack.addEventListener("click", () => {
      if (referenceHistory.length) { const position = referenceHistory.pop(); openReference(position.reference, false, position.scrollTop); }
    });
    dom.knowledgeReferencePromote.addEventListener("click", async () => {
      if (!referenceDocument) return;
      const reference = referenceSelected;
      const promotedVersion = referenceVersion;
      // Resolve the same paragraph in the wider main pane rather than reusing
      // pixels from a differently wrapped document.
      await openDocument(reference);
      if (selected === reference && currentDocument && referenceVersion === promotedVersion) closeReference();
    });
    const divider = dom.knowledgeDivider;
    function resizePanes(value) {
      const percent = Math.min(70, Math.max(30, value));
      dom.knowledgePanes.style.setProperty("--knowledge-main-width", `${percent}%`);
      divider.setAttribute("aria-valuenow", String(Math.round(percent)));
    }
    divider.addEventListener("keydown", (event) => {
      const value = Number(divider.getAttribute("aria-valuenow"));
      const next = { ArrowLeft: value - 2, ArrowRight: value + 2, Home: 30, End: 70 }[event.key];
      if (next !== undefined) { event.preventDefault(); resizePanes(next); }
    });
    let dragging = null;
    divider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      dragging = event.pointerId; divider.setPointerCapture(event.pointerId);
    });
    divider.addEventListener("pointermove", (event) => {
      if (dragging !== event.pointerId) return;
      const bounds = dom.knowledgePanes.getBoundingClientRect();
      if (bounds.width) resizePanes((event.clientX - bounds.left) / bounds.width * 100);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) divider.addEventListener(type, () => { dragging = null; });

    dom.knowledgeRefresh.addEventListener("click", refresh);
    dom.knowledgeFolder.addEventListener("change", () => { offset = 0; dom.knowledgeCatalogList.scrollTop = 0; loadCatalog(); });
    dom.knowledgePrevious.addEventListener("click", () => { offset = Math.max(0, offset - 10); dom.knowledgeCatalogList.scrollTop = 0; loadCatalog(); });
    dom.knowledgeNext.addEventListener("click", () => { offset += 10; dom.knowledgeCatalogList.scrollTop = 0; loadCatalog(); });
    dom.knowledgeBack.addEventListener("click", () => { if (history.length) { const position = history.pop(); openDocument(position.reference, false, true, position.scrollTop); } });
    dom.knowledgeMoreActivity.addEventListener("click", () => loadActivity(generation, true));
    for (const [element, direction] of [[dom.knowledgeMoreIncoming, "incoming"], [dom.knowledgeMoreOutgoing, "outgoing"]]) {
      element.addEventListener("click", async () => { element.disabled = true; try { await loadLinks(generation, readVersion, direction); } finally { element.disabled = false; } });
    }
    dom.knowledgeRebuild.addEventListener("click", async () => {
      const version = generation;
      dom.knowledgeRebuild.disabled = true;
      status(dom.knowledgeIndexStatus, "knowledge.page.loading");
      try { await api.rebuildKnowledgeIndex(); if (fresh(version)) await loadIndex(version); }
      catch (error) { if (fresh(version)) dom.knowledgeIndexStatus.textContent = errorText(error); }
      finally { if (fresh(version)) dom.knowledgeRebuild.disabled = false; }
    });
    dom.knowledgeCopyReference.addEventListener("click", async () => {
      try { await api.copyText(selected); status(dom.knowledgeReaderStatus, "knowledge.page.copied"); }
      catch (error) { dom.knowledgeReaderStatus.textContent = errorText(error); }
    });
    dom.knowledgeView.addEventListener("click", async (event) => {
      const internal = event.target.closest("[data-knowledge-ref]");
      const external = event.target.closest("[data-knowledge-external]");
      const activity = event.target.closest("[data-knowledge-activity]");
      if (internal) {
        event.preventDefault();
        const reference = internal.dataset.knowledgeRef;
        if (dom.knowledgeContentsList.contains(internal)) {
          selected = reference; updateCopyLabel(); dom.knowledgeReaderStatus.textContent = ""; focusAnchor(reference);
        } else if (dom.knowledgeReferenceContentsList.contains(internal)) {
          referenceSelected = reference; dom.knowledgeReferenceStatus.textContent = ""; focusAnchor(reference, true, true); markReference();
        } else if (dom.knowledgeReaderBody.contains(internal) || dom.knowledgeRelations.contains(internal) || dom.knowledgeReferenceBody.contains(internal)) {
          await openReference(reference);
        } else { closeReference(); await openDocument(reference); }
      }
      else if (external) {
        event.preventDefault();
        try { if (!await api.openKnowledgeSource(external.dataset.knowledgeExternal)) throw new Error(t("knowledge.page.sourceBlocked")); }
        catch (error) { (dom.knowledgeReferencePane.contains(external) ? dom.knowledgeReferenceStatus : dom.knowledgeReaderStatus).textContent = errorText(error); }
      } else if (activity) await openActivity(activity.dataset.knowledgeActivity);
    });
    dom.knowledgeCaptureForm.addEventListener("submit", previewMaterial);
    dom.knowledgeCaptureForm.addEventListener("input", () => {
      if (!captureBusy && !saveUncertain) {
        dom.knowledgeCaptureBody.removeAttribute("aria-invalid");
        invalidateCapture();
      }
    });
    dom.knowledgeCaptureSave.addEventListener("click", saveMaterial);
    dom.knowledgeCaptureCancel.addEventListener("click", () => {
      if (captureBusy) return;
      saveUncertain = false;
      invalidateCapture();
      status(dom.knowledgeCaptureNotice, "knowledge.capture.cancelled");
    });
    const now = new Date();
    dom.knowledgeCaptureDate.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return {
      setActive(value) { active = value; if (active) return refresh(); generation += 1; readVersion += 1; closeReference(); },
      refresh, openDocument, openActivity, openReference, closeReference,
      // State contains pointers only, for automated race/flow checks.
      state: () => ({ active, selected, root, history: history.map(item => item.reference), referenceSelected, referenceHistory: referenceHistory.map(item => item.reference), capturePending: Boolean(capturePreview), saveUncertain })
    };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { createClaraCoreKnowledgeView };
  scope.createClaraCoreKnowledgeView = createClaraCoreKnowledgeView;
})(typeof window === "undefined" ? globalThis : window);
