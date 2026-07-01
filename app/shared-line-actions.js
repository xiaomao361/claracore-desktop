function createClaraCoreSharedLineActions({
  desktop,
  dom,
  state,
  t,
  setSharedLineSnapshot,
  renderSharedLine,
  copyValue,
  showCopyNotice
}) {
  function setTab(tabName) {
    dom.sharedLineTabs?.forEach((tab) => tab.classList.toggle("active", tab.dataset.sharedLineTab === tabName));
    dom.sharedLineTabPanels?.forEach((panel) => panel.classList.toggle("active", panel.dataset.sharedLinePanel === tabName));
  }

  function changeAgentFilter() {
    state.activeSharedLineAgentFilter = dom.sharedLineAgentFilter.value || "";
    renderSharedLine();
  }

  async function activateLine(button) {
    const action = button.dataset.sharedLineAction;
    const lineId = button.dataset.sharedLineId;
    button.setAttribute("aria-busy", "true");
    if (action !== "select") dom.sharedLineNotice.textContent = t("common.checking");
    try {
      let result;
      if (action === "select") {
        state.selectedSharedLineId = lineId;
        result = { sharedLine: await desktop.getSharedLine({ lineId }) };
        dom.sharedLineNotice.textContent = "";
      } else if (action === "archive") {
        if (!window.confirm(t("sharedLine.archiveConfirm"))) {
          dom.sharedLineNotice.textContent = "";
          return;
        }
        result = await desktop.archiveSharedLine(lineId);
        showCopyNotice(t("sharedLine.lineArchived"), dom.sharedLineNotice);
      }
      if (!result?.sharedLine) return;
      setSharedLineSnapshot(result.sharedLine);
      renderSharedLine();
    } catch (error) {
      console.error(error);
      dom.sharedLineNotice.textContent = t("sharedLine.lineFailed");
    } finally {
      button.removeAttribute("aria-busy");
    }
  }

  function bindEvents() {
    dom.sharedLineTabs?.forEach((tab) => {
      tab.addEventListener("click", () => setTab(tab.dataset.sharedLineTab || "lines"));
    });
    dom.sharedLineAgentFilter?.addEventListener("change", changeAgentFilter);
    dom.sharedLineList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-shared-line-action]");
      if (!button) return;
      activateLine(button).catch(console.error);
    });
    dom.sharedLineList?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest("[data-shared-line-action]");
      if (!card) return;
      event.preventDefault();
      card.click();
    });
    dom.copySharedLineResume?.addEventListener("click", () => {
      copyValue(dom.sharedLineResume.textContent, t("sharedLine.resumeCopied"), dom.sharedLineNotice).catch(console.error);
    });
  }

  return {
    activateLine,
    bindEvents,
    changeAgentFilter,
    setTab
  };
}

window.createClaraCoreSharedLineActions = createClaraCoreSharedLineActions;
