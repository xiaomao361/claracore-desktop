function createClaraCoreMemoriaActions({
  desktop,
  dom,
  memoriaView,
  state,
  t,
  refresh,
  showCopyNotice,
  renderMemoryResults,
  renderMemoryTabs,
  loadMemoryTabData
}) {
  async function search() {
    const selectedAgentId = dom.memoryAgentFilter?.value || state.activeMemoryAgentFilter || "";
    state.activeMemoryAgentFilter = selectedAgentId;
    memoriaView.setActiveAgentFilter(selectedAgentId);
    const query = String(dom.memorySearchInput.value || "").trim();
    if (!query) {
      await loadMemoryTabData("search", { force: true });
      return;
    }
    const response = await desktop.searchMemories({
      query,
      agentId: selectedAgentId
    });
    const results = Array.isArray(response) ? response : response?.results || [];
    document.querySelector('[data-load-more="all"]')?.remove();
    renderMemoryResults(results);
    if (response?.error) showCopyNotice(t("memory.search.fallback"));
  }

  async function changeAgentFilter() {
    state.activeMemoryAgentFilter = dom.memoryAgentFilter.value || "";
    memoriaView.setActiveAgentFilter(state.activeMemoryAgentFilter);
    await search();
  }

  async function selectTab(tab) {
    const nextTab = tab.dataset.memoryTab || "labels";
    memoriaView.setActiveTab(nextTab);
    renderMemoryTabs();
    try {
      await loadMemoryTabData(nextTab);
    } catch (error) {
      console.error(error);
      showCopyNotice(t("runtime.unavailable"));
    }
  }

  function searchLabel(label) {
    memoriaView.searchMemoryLabel(label);
  }

  function bindLabelList(list) {
    list?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-memory-label]");
      if (!button) return;
      searchLabel(button.dataset.memoryLabel || "");
    });
  }

  function bindLoadMore() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-load-more]");
      if (!button) return;
      button.disabled = true;
      loadMemoryTabData(button.dataset.loadMore, { append: true })
        .catch((error) => {
          console.error(error);
          showCopyNotice(t("runtime.unavailable"));
        })
        .finally(() => {
          button.disabled = false;
        });
    });
  }

  function bindGraph() {
    dom.memoryGraph?.addEventListener("click", (event) => {
      const zoomButton = event.target.closest("[data-graph-zoom]");
      if (zoomButton) {
        memoriaView.setMemoryGraphZoom(zoomButton.dataset.graphZoom || "fit");
        return;
      }
      const layerButton = event.target.closest("[data-graph-layer]");
      if (layerButton) {
        memoriaView.setMemoryGraphLayer(layerButton.dataset.graphLayer || "primary").catch((error) => {
          console.error(error);
          showCopyNotice(t("runtime.unavailable"));
        });
        return;
      }
      const modeButton = event.target.closest("[data-graph-mode]");
      if (modeButton) {
        memoriaView.setMemoryGraphMode(modeButton.dataset.graphMode || "network");
        return;
      }
      const selectButton = event.target.closest("[data-graph-select]");
      if (selectButton) {
        memoriaView.selectMemoryGraphNode(selectButton.dataset.graphSelect || null);
      }
    });
    dom.memoryGraph?.addEventListener("wheel", (event) => {
      if (!event.target.closest(".graph-canvas")) return;
      event.preventDefault();
      memoriaView.setMemoryGraphZoom(event.deltaY < 0 ? "in" : "out");
    });
    dom.memoryGraph?.addEventListener("mousedown", (event) => {
      memoriaView.beginGraphDrag(event);
    });
    window.addEventListener("mousemove", (event) => {
      memoriaView.moveGraphDrag(event);
    });
    window.addEventListener("mouseup", () => {
      memoriaView.endGraphDrag();
    });
  }

  function bindMemorySelection() {
    dom.memoryList?.addEventListener("click", (event) => {
      const item = event.target.closest("[data-memory-id]");
      if (item) memoriaView.selectMemory(item.dataset.memoryId || "");
    });
    dom.memoryList?.addEventListener("keydown", (event) => {
      const item = event.target.closest("[data-memory-id]");
      if (!item) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        memoriaView.selectMemory(item.dataset.memoryId || "", { focus: true });
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const items = [...dom.memoryList.querySelectorAll("[data-memory-id]")];
      const index = items.indexOf(item);
      const nextIndex = event.key === "ArrowDown" ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
      memoriaView.selectMemory(items[nextIndex]?.dataset.memoryId || "", { focus: true });
    });
  }

  function bindEvents() {
    dom.searchMemory?.addEventListener("click", () => search().catch(console.error));
    dom.memoryAgentFilter?.addEventListener("change", () => changeAgentFilter().catch(console.error));
    dom.memorySearchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") search().catch(console.error);
    });
    dom.memoryTabs?.forEach((tab) => {
      tab.addEventListener("click", () => selectTab(tab).catch(console.error));
    });
    bindLabelList(dom.memoryAllLabelList);
    dom.memoryAdvancedDetails?.addEventListener("toggle", () => {
      if (!dom.memoryAdvancedDetails.open) return;
      loadMemoryTabData(memoriaView.getActiveTab()).catch(console.error);
    });
    bindLoadMore();
    bindGraph();
    bindMemorySelection();
  }

  return {
    bindEvents,
    search,
    searchLabel
  };
}

window.createClaraCoreMemoriaActions = createClaraCoreMemoriaActions;
