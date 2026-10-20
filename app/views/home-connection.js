function createClaraCoreHomeConnection({ root, t, getSnapshot, buildPresence, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const title = root.querySelector("#homePresenceTitle");
  const detail = root.querySelector("#homePresenceDetail");
  const agents = root.querySelector("#homePresenceAgents");
  const overflow = root.querySelector("#homeConnectionOverflow");
  const motion = root.querySelector("#homeConnectionMotion");
  const document = root.ownerDocument;
  const nodes = new Map();
  const observedStamps = new Map();
  const VISIBLE_LIMIT = 4;
  const OBSERVATION_LIMIT = 20;
  let active = false;
  let paused = false;
  let timer = null;
  let state = "loading";
  let observedGateway = null;
  let gatewayObservedAt = 0;
  let hasRendered = false;
  let foregroundCount = 0;

  const shapes = {
    compass: '<path d="M20 4 33 12v16l-13 8L7 28V12Z"/><path d="m15 25 3-9 8-3-3 9Z"/>',
    seed: '<path d="M20 34C5 25 8 10 29 6c5 15 1 25-9 28Z"/><path d="M14 29 26 12m-8 12 9-1"/>',
    star: '<path d="m20 4 4 10 11 2-8 8 1 11-8-6-9 6 2-11-8-8 11-2Z"/>',
    orbit: '<circle cx="20" cy="20" r="9"/><ellipse cx="20" cy="20" rx="17" ry="7" transform="rotate(-35 20 20)"/>',
    bloom: '<path d="M20 20C4 19 7 4 16 8c4 2 4 8 4 12Zm0 0C21 4 36 7 32 16c-2 4-8 4-12 4Zm0 0c16 1 13 16 4 12-4-2-4-8-4-12Zm0 0C19 36 4 33 8 24c2-4 8-4 12-4Z"/>'
  };
  function identity(id) {
    let hash = 2166136261;
    for (const char of id) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
    const seed = hash >>> 0;
    const known = { codex: [250, "compass"], lara: [160, "seed"], clara: [290, "bloom"], claude: [32, "star"] }[id.toLowerCase()];
    return { hue: known?.[0] ?? seed % 360, shape: known?.[1] || Object.keys(shapes)[seed % 5], phase: -(seed % 36) / 10 };
  }
  function stopTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }
  function syncMotion() {
    const animate = active && !document.hidden && !paused && ["active", "recent"].includes(state);
    root.dataset.animate = String(animate);
    if (!animate) for (const node of nodes.values()) delete node.dataset.arrival;
    motion.setAttribute("aria-pressed", String(paused));
    motion.textContent = t(paused ? "home.connection.resumeMotion" : "home.connection.pauseMotion");
  }
  function setState(value, label, description) {
    state = value;
    root.dataset.state = value;
    if (title.textContent !== label) title.textContent = label;
    if (detail.textContent !== description) detail.textContent = description;
    root.setAttribute("aria-busy", String(value === "loading"));
    syncMotion();
  }
  function renderRoster(items, currentTime) {
    const ids = new Set(items.map(item => item.id));
    for (const [id, node] of nodes) if (!ids.has(id)) { node.remove(); nodes.delete(id); observedStamps.delete(id); }
    for (const [index, item] of items.entries()) {
      let node = nodes.get(item.id);
      if (!node) {
        const appearance = identity(item.id);
        node = document.createElement("div");
        node.className = "home-agent-signature";
        node.setAttribute("role", "listitem");
        node.dataset.agentId = item.id;
        node.dataset.shape = appearance.shape;
        node.style.setProperty("--agent-hue", String(appearance.hue));
        node.style.setProperty("--agent-phase", `${appearance.phase}s`);
        node.innerHTML = `<span class="home-agent-mark" aria-hidden="true"><i class="home-agent-arrival"></i><svg viewBox="0 0 40 40" focusable="false">${shapes[appearance.shape]}<circle class="home-agent-heart" cx="20" cy="20" r="2"/></svg><span class="home-agent-initial"></span></span><span class="home-agent-copy"><strong></strong><small></small></span>`;
        nodes.set(item.id, node);
      }
      // Reuse each Agent's node so unchanged snapshots do not restart motion or
      // replace a selected name. The stable mark is independent of list order.
      for (const [selector, value] of [
        ["strong", item.label],
        ["small", t(`home.connection.agent${item.presence[0].toUpperCase()}${item.presence.slice(1)}`)],
        [".home-agent-initial", Array.from(item.label).slice(0, 1).join("")]
      ]) {
        const element = node.querySelector(selector);
        if (element.textContent !== value) element.textContent = value;
      }
      node.dataset.presence = item.presence;
      node.hidden = index >= VISIBLE_LIMIT;
      if (node.hidden) delete node.dataset.arrival;
      node.title = item.id;
      const stamp = observedStamps.get(item.id) || 0;
      if (!node.hidden && hasRendered && item.lastObservedAt > stamp && currentTime - item.lastObservedAt <= 90000) {
        node.dataset.arrival = node.dataset.arrival === "a" ? "b" : "a";
      }
      observedStamps.set(item.id, Math.max(stamp, item.lastObservedAt || 0));
      if (agents.children[index] !== node) agents.insertBefore(node, agents.children[index] || null);
    }
    foregroundCount = Math.min(items.length, VISIBLE_LIMIT);
    agents.hidden = !items.length;
    if (overflow) {
      overflow.hidden = items.length <= VISIBLE_LIMIT;
      overflow.textContent = t("home.connection.moreAgents", { count: String(items.length - VISIBLE_LIMIT) });
    }
    hasRendered = true;
  }
  function render(model = buildPresence(getSnapshot(), now())) {
    stopTimer();
    const currentTime = now();
    const gateway = getSnapshot()?.connections?.httpGateway;
    if (gateway !== observedGateway) { observedGateway = gateway; gatewayObservedAt = currentTime; }
    const staleActivity = currentTime - gatewayObservedAt > 10000;
    // HTTP has no persistent online session. Only a fresh per-Agent live
    // counter establishes current interaction; traces establish recent visits.
    const counterIds = Object.entries(gateway?.toolConcurrency?.activeByAgent || {})
      .filter(([id, count]) => id && Number.isInteger(count) && count > 0).map(([id]) => id);
    const liveIds = gateway?.ok === true && !staleActivity ? counterIds : [];
    const observed = (model.agents || []).filter(agent => agent.lastObservedAt <= currentTime && currentTime - agent.lastObservedAt <= 900000)
      .map(agent => ({ ...agent, presence: currentTime - agent.lastObservedAt <= 90000 ? "recent" : "fading" }));
    const byId = new Map(observed.map(agent => [agent.id, agent]));
    for (const id of liveIds) byId.set(id, { ...byId.get(id), id, label: model.agentLabel(id), presence: "active" });
    const items = [...byId.values()].sort((left, right) => Number(right.presence === "active") - Number(left.presence === "active") || (right.lastObservedAt || 0) - (left.lastObservedAt || 0) || left.id.localeCompare(right.id)).slice(0, OBSERVATION_LIMIT);
    const value = gateway?.ok === false ? "unavailable" : liveIds.length ? "active" : items.some(item => item.presence === "recent") ? "recent" : items.length ? "fading" : gateway?.ok === true && !(staleActivity && counterIds.length) ? "quiet" : "unknown";
    renderRoster(items, currentTime);
    const label = items.length ? t(value === "active" ? "home.connection.interactingCount" : "home.connection.observedCount", { count: String(value === "active" ? liveIds.length : items.length) }) : t(`home.connection.${value}`);
    setState(value, ["unavailable", "unknown"].includes(value) ? t(`home.connection.${value}`) : label, t(`home.connection.${value}Detail`));
    const more = items.slice(VISIBLE_LIMIT).map(item => `${item.label} · ${t(`home.connection.agent${item.presence[0].toUpperCase()}${item.presence.slice(1)}`)}`).join(" / ");
    if (more) detail.textContent += ` ${more}`;
    if (active && !document.hidden) {
      const boundaries = observed.flatMap(agent => [agent.lastObservedAt + 90001, agent.lastObservedAt + 900001]).filter(at => at > currentTime);
      if (liveIds.length) boundaries.push(gatewayObservedAt + 10001);
      if (boundaries.length) timer = setTimer(() => { timer = null; render(); }, Math.min(...boundaries) - currentTime);
    }
  }
  function clearRoster() {
    for (const node of nodes.values()) node.remove();
    nodes.clear(); observedStamps.clear(); hasRendered = false;
    agents.hidden = true;
    foregroundCount = 0;
    if (overflow) overflow.hidden = true;
  }
  function renderLoading() {
    stopTimer(); clearRoster();
    setState("loading", t("home.connection.loading"), t("home.connection.loadingDetail"));
  }
  function renderLoadError() {
    stopTimer(); clearRoster();
    setState("error", t("home.connection.error"), t("home.connection.errorDetail"));
  }
  overflow?.addEventListener("click", () => { root.querySelector("#homePresenceDisclosure").open = true; });
  motion.addEventListener("click", () => { paused = !paused; syncMotion(); });
  document.addEventListener("visibilitychange", () => {
    stopTimer();
    if (active && !document.hidden && !["loading", "error"].includes(state)) render();
    else syncMotion();
  });
  return {
    render, renderLoading, renderLoadError,
    setActive(value) {
      active = Boolean(value); stopTimer();
      if (active && !["loading", "error"].includes(state)) render();
      else syncMotion();
    },
    debugState: () => ({ state, active, paused, timerScheduled: timer !== null, animated: root.dataset.animate === "true", canvas: false, agentCount: nodes.size, foregroundCount })
  };
}
if (typeof window !== "undefined") window.createClaraCoreHomeConnection = createClaraCoreHomeConnection;
if (typeof module !== "undefined") module.exports = { createClaraCoreHomeConnection };
