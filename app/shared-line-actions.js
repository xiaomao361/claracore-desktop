function createClaraCoreSharedLineActions({
  desktop,
  dom,
  state,
  t,
  renderSharedLine
}) {
  let selectionRevision = 0;
  let detailRequestRevision = 0;

  function activeLines(packet = {}) {
    return (packet.lines || []).filter((line) => line.status !== "archived");
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

  function invalidatePendingDetail() {
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
    const lines = activeLines(catalogPacket);
    const selectedStillExists = lines.some((line) => line.id === state.selectedSharedLineId);
    const fallback = fallbackLine(catalogPacket);
    const nextLineId = selectedStillExists ? state.selectedSharedLineId : fallback?.id || "";
    const previousLineId = state.selectedSharedLineId;

    invalidatePendingDetail();

    if (!nextLineId) {
      state.selectedSharedLineId = "";
      state.selectedSharedLinePacket = null;
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
    return { lineId: nextLineId, didFallBack };
  }

  async function hydrateSelectedLine(catalogPacket = {}) {
    const lines = activeLines(catalogPacket);
    if (!lines.some((line) => line.id === state.selectedSharedLineId)) {
      syncSelectedLineCatalog(catalogPacket);
    }
    const lineId = state.selectedSharedLineId;
    if (!lineId) return null;

    const intentRevision = selectionRevision;
    const requestRevision = ++detailRequestRevision;
    try {
      const packet = await readSelectedLine(lineId, catalogPacket);
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return null;
      state.selectedSharedLinePacket = packet;
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = "";
      return packet;
    } catch (error) {
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return null;
      console.error(error);
      const fallback = fallbackLine(catalogPacket);
      if (fallback?.id && fallback.id !== lineId) {
        invalidatePendingDetail();
        state.selectedSharedLineId = fallback.id;
        state.selectedSharedLinePacket = null;
        if (dom.sharedLineSelectionNotice) {
          dom.sharedLineSelectionNotice.textContent = t("sharedLine.selectionFallback");
        }
      }
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = t("sharedLine.lineFailed");
      return null;
    }
  }

  function changeAgentFilter() {
    state.activeSharedLineAgentFilter = dom.sharedLineAgentFilter?.value || "";
    renderSharedLine();
  }

  async function selectLine(card) {
    const lineId = card.dataset.sharedLineId;
    if (!lineId || lineId === state.selectedSharedLineId) return;
    const previousLineId = state.selectedSharedLineId;
    const previousPacket = state.selectedSharedLinePacket;
    const intentRevision = invalidatePendingDetail();
    const requestRevision = ++detailRequestRevision;
    state.selectedSharedLineId = lineId;
    state.selectedSharedLinePacket = null;
    card.setAttribute("aria-busy", "true");
    renderSharedLine();
    try {
      const packet = await readSelectedLine(lineId);
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return;
      state.selectedSharedLinePacket = packet;
      if (dom.sharedLineSelectionNotice) dom.sharedLineSelectionNotice.textContent = "";
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = "";
      renderSharedLine();
    } catch (error) {
      if (!isCurrentDetailRequest(lineId, intentRevision, requestRevision)) return;
      console.error(error);
      invalidatePendingDetail();
      state.selectedSharedLineId = previousLineId;
      state.selectedSharedLinePacket = packetMatchesLine(previousPacket, previousLineId) ? previousPacket : null;
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = t("sharedLine.lineFailed");
      renderSharedLine();
    } finally {
      card.removeAttribute("aria-busy");
    }
  }

  function bindEvents() {
    dom.sharedLineAgentFilter?.addEventListener("change", changeAgentFilter);
    dom.sharedLineList?.addEventListener("click", (event) => {
      const card = event.target.closest("[data-shared-line-action='select']");
      if (!card) return;
      selectLine(card).catch(console.error);
    });
    dom.sharedLineList?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-shared-line-action='select']");
      if (!card) return;
      event.preventDefault();
      card.click();
    });
  }

  return {
    bindEvents,
    changeAgentFilter,
    hydrateSelectedLine,
    selectLine,
    syncSelectedLineCatalog
  };
}

window.createClaraCoreSharedLineActions = createClaraCoreSharedLineActions;
