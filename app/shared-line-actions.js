function createClaraCoreSharedLineActions({
  desktop,
  dom,
  state,
  t,
  copyValue,
  renderSharedLine
}) {
  let selectionRevision = 0;
  let detailRequestRevision = 0;
  let committedLineId = "";
  let committedPacket = null;
  let lastCatalog = {};
  let failedLineId = "";
  let copying = false;
  let catalogRevision = 0;
  const pendingPages = new Set();

  function activeLines(packet = {}) {
    return (packet.lines || []).filter((line) => line.status !== "archived"
      && (!state.activeSharedLineAgentFilter || (line.agentId || line.metadata?.agentId || "") === state.activeSharedLineAgentFilter));
  }

  function fallbackLine(packet = {}) {
    const lines = activeLines(packet);
    return lines.find((line) => line.active) || lines[0] || null;
  }

  function packetMatchesLine(packet, lineId) {
    return Boolean(
      lineId
      && packet?.lineId === lineId
      && packet?.currentPosition?.lineId === lineId
    );
  }

  function rememberCommittedPacket(lineId, packet) {
    if (!packetMatchesLine(packet, lineId)) return;
    committedLineId = lineId;
    committedPacket = packet;
  }

  if (packetMatchesLine(state.selectedSharedLinePacket, state.selectedSharedLineId)) {
    rememberCommittedPacket(state.selectedSharedLineId, state.selectedSharedLinePacket);
  }

  function invalidatePendingDetail() {
    if (dom.sharedLineResumeNotice) dom.sharedLineResumeNotice.textContent = "";
    selectionRevision += 1;
    detailRequestRevision += 1;
    return selectionRevision;
  }

  function isCurrentDetailRequest(lineId, intentRevision, requestRevision) {
    return (
      state.selectedSharedLineId === lineId
      && selectionRevision === intentRevision
      && detailRequestRevision === requestRevision
    );
  }

  async function readSelectedLine(lineId, catalogPacket = {}) {
    if (!lineId) return null;
    const packet = packetMatchesLine(catalogPacket, lineId) && catalogPacket.overview !== true
      ? catalogPacket
      : await desktop.getSharedLine({ lineId });
    if (!packetMatchesLine(packet, lineId)) {
      throw new Error(
        `Shared Line detail mismatch: requested ${lineId}, received packet ${packet?.lineId || "none"} / position ${packet?.currentPosition?.lineId || "none"}`
      );
    }
    return packet;
  }

  function syncSelectedLineCatalog(catalogPacket = {}) {
    // An overview sample cannot invalidate a selection made on a later page.
    // The next scoped catalog read validates that exact ID against the database.
    if (state.sharedLineCatalog && !catalogPacket.linesPage) {
      lastCatalog = { ...catalogPacket, ...state.sharedLineCatalog };
      return { lineId: state.selectedSharedLineId, didFallBack: false };
    }
    lastCatalog = catalogPacket;
    const lines = activeLines(catalogPacket);
    const selectedStillExists = lines.some((line) => line.id === state.selectedSharedLineId);
    const committedStillExists = lines.some((line) => line.id === committedLineId);
    const fallback = fallbackLine(catalogPacket);
    const nextLineId = selectedStillExists ? state.selectedSharedLineId : fallback?.id || "";
    const previousLineId = state.selectedSharedLineId;

    invalidatePendingDetail();
    if (!committedStillExists) {
      committedLineId = "";
      committedPacket = null;
    }

    if (!nextLineId) {
      state.selectedSharedLineId = "";
      state.selectedSharedLinePacket = null;
      state.sharedLineReadStatus = "empty";
      failedLineId = "";
      if (dom.sharedLineSelectionNotice) dom.sharedLineSelectionNotice.textContent = "";
      return { lineId: "", didFallBack: Boolean(previousLineId) };
    }

    const didFallBack = Boolean(previousLineId && !selectedStillExists);
    state.selectedSharedLineId = nextLineId;
    if (
      !packetMatchesLine(state.selectedSharedLinePacket, nextLineId)
      || state.selectedSharedLinePacket?.overview === true
    ) {
      state.selectedSharedLinePacket = null;
    }
    if (dom.sharedLineSelectionNotice) {
      dom.sharedLineSelectionNotice.textContent = didFallBack ? t("sharedLine.selectionFallback") : "";
    }
    state.sharedLineReadStatus = "loading";
    return { lineId: nextLineId, didFallBack };
  }

  async function hydrateSelectedLine(catalogPacket = {}) {
    const lines = activeLines(catalogPacket);
    if (!lines.some((line) => line.id === state.selectedSharedLineId)) {
      syncSelectedLineCatalog(catalogPacket);
    }
    const lineId = state.selectedSharedLineId;
    if (!lineId) return null;

    state.sharedLineReadStatus = "loading";
    renderSharedLine();
    const intentRevision = selectionRevision;
    const requestRevision = ++detailRequestRevision;
    try {
      const packet = await readSelectedLine(lineId, catalogPacket);
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return null;
      state.selectedSharedLinePacket = packet;
      state.sharedLineReadStatus = "ready";
      failedLineId = "";
      rememberCommittedPacket(lineId, packet);
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = "";
      return packet;
    } catch (error) {
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return null;
      console.error(error);
      const fallback = fallbackLine(catalogPacket);
      if (fallback?.id && fallback.id !== lineId) {
        invalidatePendingDetail();
        state.selectedSharedLineId = fallback.id;
        state.selectedSharedLinePacket = committedLineId === fallback.id
          && packetMatchesLine(committedPacket, fallback.id)
          ? committedPacket
          : null;
        if (dom.sharedLineSelectionNotice) {
          dom.sharedLineSelectionNotice.textContent = t("sharedLine.selectionFallback");
        }
      }
      state.sharedLineReadStatus = "error";
      failedLineId = lineId;
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = t("sharedLine.lineFailed");
      return null;
    }
  }

  async function loadCatalog() {
    if (!desktop.getSharedLines) return lastCatalog;
    const request = ++catalogRevision;
    const agentId = state.activeSharedLineAgentFilter || "";
    state.sharedLineCatalog = { ...lastCatalog, lines: [], archivedLines: [] };
    state.sharedLineCatalogLoading = true;
    state.sharedLineCatalogError = false;
    renderSharedLine();
    try {
      const [active, archived] = await Promise.all([
        desktop.getSharedLines({ agentId, status: "active", limit: 10, offset: 0, selectedLineId: state.selectedSharedLineId }),
        desktop.getSharedLines({ agentId, status: "archived", limit: 10, offset: 0 })
      ]);
      if (request !== catalogRevision) return null;
      const selected = active.selectedLine;
      const lines = selected && !active.items.some(line => line.id === selected.id) ? [...active.items, selected] : active.items;
      const catalog = { ...lastCatalog, lines, archivedLines: archived.items,
        agents: active.agents, linesPage: active, archivedLinesPage: archived };
      state.sharedLineCatalog = catalog;
      syncSelectedLineCatalog(catalog);
      return catalog;
    } catch (error) {
      if (request === catalogRevision) state.sharedLineCatalogError = true;
      console.error(error);
      return null;
    } finally {
      if (request === catalogRevision) { state.sharedLineCatalogLoading = false; renderSharedLine(); }
    }
  }

  async function loadMoreCatalog(status) {
    const key = status === "archived" ? "archivedLines" : "lines";
    const catalog = state.sharedLineCatalog;
    const page = catalog?.[`${key}Page`];
    const token = `${catalogRevision}:${key}`;
    if (!page?.hasMore || pendingPages.has(token)) return;
    const request = catalogRevision;
    pendingPages.add(token);
    state.sharedLineCatalogError = false;
    try {
      const next = await desktop.getSharedLines({ agentId: state.activeSharedLineAgentFilter || "", status, limit: 10, offset: page.offset + page.limit });
      if (request !== catalogRevision || catalog !== state.sharedLineCatalog) return;
      const ids = new Set(catalog[key].map(line => line.id));
      catalog[key] = [...catalog[key], ...next.items.filter(line => !ids.has(line.id))];
      catalog[`${key}Page`] = next;
      lastCatalog = catalog;
    } catch (error) {
      if (request === catalogRevision) state.sharedLineCatalogError = true;
      console.error(error);
    } finally {
      pendingPages.delete(token);
      if (request === catalogRevision) renderSharedLine();
    }
  }

  async function changeAgentFilter() {
    state.activeSharedLineAgentFilter = dom.sharedLineAgentFilter?.value || "";
    invalidatePendingDetail();
    failedLineId = "";
    if (desktop.getSharedLines) {
      const catalog = await loadCatalog();
      if (catalog) await hydrateSelectedLine(catalog);
      renderSharedLine();
      return;
    }
    if (!activeLines(lastCatalog).some(line => line.id === state.selectedSharedLineId)) {
      state.selectedSharedLineId = "";
      state.selectedSharedLinePacket = null;
      state.sharedLineReadStatus = "empty";
    }
    if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = "";
    renderSharedLine();
    if (state.selectedSharedLineId) {
      await hydrateSelectedLine(lastCatalog);
      renderSharedLine();
    }
  }

  async function selectLine(card) {
    return selectLineId(card.dataset.sharedLineId, card);
  }

  async function selectLineId(lineId, card = null) {
    const dialog = card?.closest?.("dialog") || null;
    if (
      !lineId
      || (
        lineId === state.selectedSharedLineId
        && packetMatchesLine(state.selectedSharedLinePacket, lineId)
        && state.sharedLineReadStatus !== "error"
        && dom.sharedLineNotice?.textContent !== t("sharedLine.lineFailed")
      )
    ) {
      if (dialog?.open) dialog.close();
      return;
    }
    const previousLineId = committedLineId || state.selectedSharedLineId;
    const previousPacket = packetMatchesLine(committedPacket, committedLineId) ? committedPacket : null;
    const intentRevision = invalidatePendingDetail();
    const requestRevision = ++detailRequestRevision;
    state.selectedSharedLineId = lineId;
    state.selectedSharedLinePacket = null;
    state.sharedLineReadStatus = "loading";
    card?.setAttribute("aria-busy", "true");
    renderSharedLine();
    try {
      const packet = await readSelectedLine(lineId);
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return;
      state.selectedSharedLinePacket = packet;
      state.sharedLineReadStatus = "ready";
      failedLineId = "";
      rememberCommittedPacket(lineId, packet);
      if (dom.sharedLineSelectionNotice) dom.sharedLineSelectionNotice.textContent = "";
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = "";
      renderSharedLine();
      if (dialog?.open) dialog.close();
    } catch (error) {
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return;
      console.error(error);
      invalidatePendingDetail();
      state.selectedSharedLineId = previousLineId;
      state.selectedSharedLinePacket = previousPacket;
      state.sharedLineReadStatus = "error";
      failedLineId = lineId;
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = t("sharedLine.lineFailed");
      renderSharedLine();
    } finally {
      card?.removeAttribute("aria-busy");
    }
  }

  async function retrySelectedLine() {
    const lineId = failedLineId || state.selectedSharedLineId;
    if (!lineId || state.sharedLineReadStatus === "loading") return;
    await selectLineId(lineId);
  }

  async function copyContinuation() {
    const lineId = state.selectedSharedLineId;
    const packet = state.selectedSharedLinePacket;
    const visible = !state.activeSharedLineAgentFilter || (packet?.currentPosition?.agentId || packet?.agentId) === state.activeSharedLineAgentFilter;
    if (copying || state.sharedLineReadStatus !== "ready" || packet?.overview === true
      || !packetMatchesLine(packet, lineId) || !visible || !String(packet.currentPosition.summary || "").trim()) return false;
    const revision = selectionRevision;
    copying = true;
    state.sharedLineCopying = true;
    if (dom.sharedLineResumeNotice) dom.sharedLineResumeNotice.textContent = "";
    renderSharedLine();
    try {
      const prompt = t("sharedLine.resumePrompt", { id: JSON.stringify(lineId) });
      // Own the notice here: a delayed clipboard acknowledgement must never
      // claim that the newly selected line was copied or sent to an assistant.
      const copied = await copyValue(prompt, "");
      if (revision === selectionRevision && lineId === state.selectedSharedLineId && dom.sharedLineResumeNotice) {
        dom.sharedLineResumeNotice.textContent = t(copied ? "sharedLine.resumeCopied" : "sharedLine.resumeCopyFailed");
      }
      return Boolean(copied);
    } catch (_) {
      if (revision === selectionRevision && dom.sharedLineResumeNotice) dom.sharedLineResumeNotice.textContent = t("sharedLine.resumeCopyFailed");
      return false;
    } finally {
      copying = false;
      state.sharedLineCopying = false;
      renderSharedLine();
    }
  }

  function bindEvents() {
    dom.sharedLineResume?.addEventListener("click", () => copyContinuation());
    dom.sharedLineRetry?.addEventListener("click", () => retrySelectedLine());
    dom.sharedLineAgentFilter?.addEventListener("change", () => changeAgentFilter().catch(console.error));
    document.querySelector("#sharedLineView")?.addEventListener("click", (event) => {
      const more = event.target.closest("[data-shared-line-more]");
      if (more) { loadMoreCatalog(more.dataset.sharedLineMore); return; }
      if (event.target.closest("[data-shared-line-retry-catalog]")) {
        loadCatalog().then(async catalog => { if (catalog) await hydrateSelectedLine(catalog); renderSharedLine(); });
        return;
      }
      const card = event.target.closest("[data-shared-line-action='select']");
      if (!card) return;
      selectLine(card).catch(console.error);
    });
  }

  return {
    bindEvents,
    loadCatalog,
    loadMoreCatalog,
    changeAgentFilter,
    copyContinuation,
    retrySelectedLine,
    hydrateSelectedLine,
    selectLine,
    syncSelectedLineCatalog
  };
}

window.createClaraCoreSharedLineActions = createClaraCoreSharedLineActions;
