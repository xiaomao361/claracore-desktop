function createClaraCoreInnerLifeActions({
  desktop,
  dom,
  state,
  getSnapshot,
  renderInnerLife,
  itemAgentId
}) {
  async function loadMoreCollection({ loadingKey, listKey, totalsKey, pageKey, fetchPage }) {
    const snapshot = getSnapshot();
    if (!snapshot?.innerLife || state[loadingKey]) return;
    state[loadingKey] = true;
    const agentId = state.activeInnerLifeAgentFilter || "all";
    const currentItems = snapshot.innerLife[listKey] || [];
    const offset = agentId === "all"
      ? currentItems.length
      : currentItems.filter((item) => itemAgentId(item) === agentId).length;
    try {
      const page = await fetchPage({ agentId, offset });
      const existingIds = new Set(currentItems.map((item) => item.id));
      snapshot.innerLife[listKey] = [
        ...currentItems,
        ...(page.items || []).filter((item) => !existingIds.has(item.id))
      ];
      state[totalsKey][agentId] = page.total ?? snapshot.innerLife[listKey].length;
      if (agentId === "all") {
        snapshot.innerLife[pageKey] = {
          ...(snapshot.innerLife[pageKey] || {}),
          total: page.total ?? snapshot.innerLife[listKey].length,
          hasMore: Boolean(page.hasMore)
        };
      }
    } catch (error) {
      console.error(error);
    } finally {
      state[loadingKey] = false;
      renderInnerLife();
    }
  }

  function loadMoreSessions() {
    return loadMoreCollection({
      loadingKey: "innerLifeSessionsLoading",
      listKey: "sessions",
      totalsKey: "innerLifeSessionTotals",
      pageKey: "sessionsPage",
      fetchPage: ({ agentId, offset }) => desktop.getInnerLifeSessions({ agentId, limit: 50, offset })
    });
  }

  function loadMoreDigestRuns() {
    return loadMoreCollection({
      loadingKey: "innerLifeDigestRunsLoading",
      listKey: "digestRuns",
      totalsKey: "innerLifeDigestTotals",
      pageKey: "digestRunsPage",
      fetchPage: ({ agentId, offset }) => desktop.getInnerLifeDigestRuns({ agentId, limit: 50, offset })
    });
  }

  function loadMoreInbox() {
    return loadMoreCollection({
      loadingKey: "innerLifeInboxLoading",
      listKey: "inbox",
      totalsKey: "innerLifeInboxTotals",
      pageKey: "inboxPage",
      fetchPage: ({ agentId, offset }) => desktop.getInnerLifeInbox({ agentId, status: "all", limit: 50, offset })
    });
  }

  function changeAgentFilter() {
    state.activeInnerLifeAgentFilter = dom.innerLifeAgentFilter.value || "";
    renderInnerLife();
  }

  async function openAdvancedView() {
    if (!dom.innerLifeAdvancedDetails?.open || dom.innerLifeAdvancedDetails.dataset.loaded === "true") return;
    dom.innerLifeAdvancedDetails.dataset.loaded = "true";
    await Promise.all([loadMoreSessions(), loadMoreDigestRuns(), loadMoreInbox()]);
  }

  function bindEvents() {
    dom.innerLifeAgentFilter?.addEventListener("change", changeAgentFilter);
    dom.innerLifeAdvancedDetails?.addEventListener("toggle", () => openAdvancedView().catch(console.error));
  }

  return {
    bindEvents,
    changeAgentFilter,
    loadMoreDigestRuns,
    loadMoreInbox,
    loadMoreSessions
  };
}

window.createClaraCoreInnerLifeActions = createClaraCoreInnerLifeActions;
