function createClaraCoreInnerLifeActions({ desktop, dom, state, getSnapshot, renderInnerLife }) {
  let revision = 0;
  const pendingPages = new Set();

  async function loadSnapshot() {
    const request = ++revision;
    const owner = getSnapshot();
    const agentId = state.activeInnerLifeAgentFilter || "";
    state.innerLifeLoadStatus = "loading";
    state.innerLifePageError = "";
    renderInnerLife();
    try {
      const result = await desktop.getInnerLife({ agentId });
      if (request !== revision || owner !== getSnapshot()) return false;
      if (agentId && result.agentId !== agentId) throw new Error("InnerLife agent mismatch.");
      state.innerLifeSnapshot = result;
      state.activeInnerLifeAgentFilter = result.agentId;
      state.innerLifeLoadStatus = "ready";
      return true;
    } catch (error) {
      if (request !== revision || owner !== getSnapshot()) return false;
      console.error(error);
      state.innerLifeLoadStatus = "error";
      return false;
    } finally {
      if (request === revision) renderInnerLife();
    }
  }

  const collections = {
    sessions: { page: "sessionsPage", fetch: input => desktop.getInnerLifeSessions(input) },
    digestRuns: { page: "digestRunsPage", fetch: input => desktop.getInnerLifeDigestRuns(input) },
    inbox: { page: "inboxPage", fetch: input => desktop.getInnerLifeInbox({ ...input, status: "all" }) },
    unsharedShares: { page: "unsharedSharesPage", fetch: input => desktop.getInnerLifeShares({ ...input, status: "unshared" }) },
    sharedShares: { page: "sharedSharesPage", fetch: input => desktop.getInnerLifeShares({ ...input, status: "used" }) }
  };
  async function loadMoreCollection(key) {
    const config = collections[key];
    const current = state.innerLifeSnapshot;
    if (!config || !current || state.innerLifeLoadStatus !== "ready") return;
    const page = current[config.page];
    if (!page?.hasMore) return;
    const token = `${revision}:${key}`;
    if (pendingPages.has(token)) return;
    pendingPages.add(token);
    const request = revision;
    state.innerLifePageError = "";
    try {
      const result = await config.fetch({ agentId: current.agentId, limit: 10, offset: page.offset + page.limit });
      if (request !== revision || current !== state.innerLifeSnapshot) return;
      if (result.agentId && result.agentId !== current.agentId) throw new Error("InnerLife page agent mismatch.");
      const ids = new Set((current[key] || []).map(item => item.id));
      current[key] = [...(current[key] || []), ...(result.items || []).filter(item => !ids.has(item.id))];
      current[config.page] = { ...result, items: undefined, hasMore: result.hasMore ?? result.offset + result.items.length < result.total };
    } catch (error) {
      if (request === revision) state.innerLifePageError = key;
      console.error(error);
    } finally {
      pendingPages.delete(token);
      if (request === revision) renderInnerLife();
    }
  }
  async function changeAgentFilter() {
    state.activeInnerLifeAgentFilter = dom.innerLifeAgentFilter.value || "";
    return loadSnapshot();
  }
  function bindEvents() {
    dom.innerLifeAgentFilter?.addEventListener("change", () => changeAgentFilter());
    document.querySelector("#innerlifeView")?.addEventListener("click", event => {
      const more = event.target.closest("[data-innerlife-more]");
      if (more) loadMoreCollection(more.dataset.innerlifeMore);
      if (event.target.closest("[data-innerlife-retry]")) loadSnapshot();
    });
  }
  return { bindEvents, changeAgentFilter, loadSnapshot, loadMoreCollection,
    loadMoreSessions: () => loadMoreCollection("sessions"),
    loadMoreDigestRuns: () => loadMoreCollection("digestRuns"),
    loadMoreInbox: () => loadMoreCollection("inbox") };
}
window.createClaraCoreInnerLifeActions = createClaraCoreInnerLifeActions;
