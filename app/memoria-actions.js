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
    if (memoriaView.getActiveTab() === "search") {
      await search();
      return;
    }
    await loadMemoryTabData(memoriaView.getActiveTab(), { force: true });
  }

  async function selectTab(tab) {
    const nextTab = tab.dataset.memoryTab || "search";
    if (nextTab === "archive" && memoriaView.getActiveTab() !== "archive" && !window.confirm(t("memory.restricted.confirm"))) {
      renderMemoryTabs();
      return;
    }
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

  async function handleDeleteAction(button) {
    if (!window.confirm(t("memory.delete.confirm"))) return;
    button.disabled = true;
    await desktop.deleteMemory(button.dataset.memoryId);
    await refresh();
    showCopyNotice(t("memory.form.deleted"));
  }

  function bindActiveList(list, actionName = "delete") {
    list?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-memory-action]");
      if (!button || button.dataset.memoryAction !== actionName) return;
      await handleDeleteAction(button);
    });
  }

  function bindArchivedList() {
    dom.archivedMemoryList?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-memory-action='restore-archived']");
      if (!button) return;
      button.disabled = true;
      try {
        await desktop.restoreArchivedMemory(button.dataset.memoryId);
        await refresh();
        showCopyNotice(t("memory.archive.restoreDone"));
      } catch (error) {
        console.error(error);
        showCopyNotice(t("memory.form.saveFailed"));
      }
    });
  }

  function bindDeletedList() {
    dom.deletedMemoryList?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-memory-action='restore']");
      if (!button) return;
      button.disabled = true;
      try {
        await desktop.restoreMemory(button.dataset.memoryId);
        await refresh();
        showCopyNotice(t("memory.form.restored"));
      } catch (error) {
        console.error(error);
        showCopyNotice(t("memory.form.saveFailed"));
      }
    });
  }

  function bindEvents() {
    dom.searchMemory?.addEventListener("click", () => search().catch(console.error));
    dom.memoryAgentFilter?.addEventListener("change", () => changeAgentFilter().catch(console.error));
    dom.processMemoryEmbeddings?.addEventListener("click", () => memoriaView.processEmbeddings().catch(console.error));
    dom.memorySearchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") search().catch(console.error);
    });
    dom.memoryTabs?.forEach((tab) => {
      tab.addEventListener("click", () => selectTab(tab).catch(console.error));
    });
    bindLabelList(dom.memoryLabelList);
    bindLabelList(dom.memoryAllLabelList);
    bindLoadMore();
    bindGraph();
    bindActiveList(dom.memoryList);
    bindActiveList(dom.restrictedMemoryList, "delete-restricted");
    bindArchivedList();
    bindDeletedList();
  }

  return {
    bindEvents,
    search,
    searchLabel
  };
}

window.createClaraCoreMemoriaActions = createClaraCoreMemoriaActions;
