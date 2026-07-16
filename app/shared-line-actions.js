function createClaraCoreSharedLineActions({
  desktop,
  dom,
  state,
  t,
  renderSharedLine
}) {
  function activeLines(packet = {}) {
    return (packet.lines || []).filter((line) => line.status !== "archived");
  }

  function fallbackLine(packet = {}) {
    const lines = activeLines(packet);
    return lines.find((line) => line.active) || lines[0] || null;
  }

  async function readSelectedLine(lineId, catalogPacket = {}) {
    if (!lineId) return null;
    if (catalogPacket.lineId === lineId) return catalogPacket;
    return desktop.getSharedLine({ lineId });
  }

  async function syncSelectedLine(catalogPacket = {}) {
    const lines = activeLines(catalogPacket);
    const selectedStillExists = lines.some((line) => line.id === state.selectedSharedLineId);
    const fallback = fallbackLine(catalogPacket);
    const nextLineId = selectedStillExists ? state.selectedSharedLineId : fallback?.id || "";

    if (!nextLineId) {
      state.selectedSharedLineId = "";
      state.selectedSharedLinePacket = null;
      return;
    }

    const didFallBack = Boolean(state.selectedSharedLineId && !selectedStillExists);
    state.selectedSharedLineId = nextLineId;
    try {
      state.selectedSharedLinePacket = await readSelectedLine(nextLineId, catalogPacket);
      if (dom.sharedLineSelectionNotice) {
        dom.sharedLineSelectionNotice.textContent = didFallBack ? t("sharedLine.selectionFallback") : "";
      }
    } catch (error) {
      console.error(error);
      const fallbackId = fallback?.id || "";
      state.selectedSharedLineId = fallbackId;
      state.selectedSharedLinePacket = fallbackId ? await readSelectedLine(fallbackId, catalogPacket).catch(() => catalogPacket) : null;
      if (dom.sharedLineSelectionNotice) dom.sharedLineSelectionNotice.textContent = t("sharedLine.selectionFallback");
    }
  }

  function changeAgentFilter() {
    state.activeSharedLineAgentFilter = dom.sharedLineAgentFilter?.value || "";
    renderSharedLine();
  }

  async function selectLine(card) {
    const lineId = card.dataset.sharedLineId;
    if (!lineId || lineId === state.selectedSharedLineId) return;
    card.setAttribute("aria-busy", "true");
    try {
      const packet = await desktop.getSharedLine({ lineId });
      state.selectedSharedLineId = lineId;
      state.selectedSharedLinePacket = packet;
      if (dom.sharedLineSelectionNotice) dom.sharedLineSelectionNotice.textContent = "";
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = "";
      renderSharedLine();
    } catch (error) {
      console.error(error);
      if (dom.sharedLineNotice) dom.sharedLineNotice.textContent = t("sharedLine.lineFailed");
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
    selectLine,
    syncSelectedLine
  };
}

window.createClaraCoreSharedLineActions = createClaraCoreSharedLineActions;
