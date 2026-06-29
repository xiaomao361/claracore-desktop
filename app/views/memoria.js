function createClaraCoreMemoriaView(context) {
  const {
    dom,
    t,
    getSnapshot,
    escapeHtml,
    refreshRuntimeSnapshotOnly,
    appendLiveLogLine,
    setEmbeddingProgress
  } = context;
  const {
    memorySearchInput, searchMemory, memoryList, memoryAgentFilter, allMemoryList, memoryGraphSummary, memoryGraph,
    deletedMemoryList, restrictedMemoryList, archivedMemoryList, memoryAllLabelList, memoryAllHint, memoryRestrictedHint,
    memoryActiveCount, memoryDeletedCount, memoryEmbeddedCount, memoryPendingEmbeddingCount, memoryRestrictedCount,
    memoryArchivedCount, memoryLabelList, processMemoryEmbeddings, memoryEmbeddingNotice, memoryEmbeddingProgressBar,
    memoryTabs, memoryTabPanels
  } = dom;

  let activeMemoryTab = "search";
  let memoryGraphZoom = 1;
  let memoryGraphPan = { x: 0, y: 0 };
  let memoryGraphState = null;
  let memoryGraphAnimation = null;
  let memoryGraphDrag = null;
  let activeMemoryGraphLayer = "primary";
  let memoryEmbeddingBatchRunning = false;
  let activeMemoryAgentFilter = "";
  const loadedMemoryTabs = { all: false, restricted: false, archive: false };
  const memoryPaging = { pageSize: 20, all: { loaded: 0 }, restricted: { loaded: 0 }, archived: { loaded: 0 }, deleted: { loaded: 0 } };
  let snapshot = null;

  function syncSnapshot() {
    snapshot = getSnapshot();
    return snapshot;
  }

function memoryAgentId(memory) {
  const labels = Array.isArray(memory?.labels) ? memory.labels : [];
  const agentIdLabel = labels.find((label) => String(label || "").startsWith("agent-id:"));
  if (agentIdLabel) return String(agentIdLabel).slice("agent-id:".length);
  const agentLabel = labels.find((label) => String(label || "").startsWith("agent:"));
  return agentLabel ? String(agentLabel).slice("agent:".length) : "";
}

function itemAgentId(item) {
  return item?.agentId || item?.agent_id || item?.metadata?.agentId || "";
}

function filterByAgent(items, agentId, getter = itemAgentId) {
  if (!agentId) return items || [];
  return (items || []).filter((item) => getter(item) === agentId);
}

function renderAgentFilter(select, agentIds, activeValue) {
  if (!select) return "";
  const options = [...new Set((agentIds || []).filter(Boolean))].sort();
  const nextValue = activeValue && options.includes(activeValue) ? activeValue : "";
  select.innerHTML = [
    `<option value="">${escapeHtml(t("sharedLine.filter.allAgents"))}</option>`,
    ...options.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
  ].join("");
  select.value = nextValue;
  return nextValue;
}

function renderMemoryList() {
  sharedInnerLifeView.renderMemoryList();
}

function renderSharedLine() {
  sharedInnerLifeView.renderSharedLine();
}

function renderInnerLife() {
  sharedInnerLifeView.renderInnerLife();
}

function renderBackups() {
  dataView.renderBackups();
}

function renderImportPreview() {
  dataView.renderImportPreview();
}

function memoryItemsHtml(memories, action = "delete", itemClass = "") {
  return memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      const embeddingStatus = memory.embedding_status || "pending";
      const embeddingLabel = t(`memory.embedding.${embeddingStatus}`) || embeddingStatus;
      const embeddingDetail = memory.embedding_error
        ? `<span title="${escapeHtml(memory.embedding_error)}">${escapeHtml(memory.embedding_error)}</span>`
        : `<span>${escapeHtml(memory.embedding_model || "")}</span>`;
      const sourceLabel = memory.search_source ? t(`memory.search.source.${memory.search_source}`) || memory.search_source : "";
      const scoreLabel =
        memory.search_source && Number(memory.search_score) > 0
          ? `${t("memory.search.score")} ${Math.round(Number(memory.search_score) * 100)}%`
          : "";
      const searchMeta =
        sourceLabel || scoreLabel
          ? `<div class="memory-search-rank"><span>${escapeHtml(sourceLabel)}</span><span>${escapeHtml(scoreLabel)}</span></div>`
          : "";
      return `
        <article class="memory-item ${itemClass}" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          ${searchMeta}
          <div class="memory-meta">
            <span>${escapeHtml(memory.created_at || memory.updated_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-embedding ${escapeHtml(embeddingStatus)}">
            <b>${escapeHtml(embeddingLabel)}</b>
            ${embeddingDetail}
          </div>
          <div class="memory-actions">
            ${action === "restore" ? `<button class="secondary" data-memory-action="restore" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>` : ""}
            ${action === "restore-archived" ? `<button class="secondary" data-memory-action="restore-archived" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>` : ""}
            ${action === "delete" ? `<button class="secondary danger-button" data-memory-action="delete" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>` : ""}
            ${action === "delete-restricted" ? `<button class="secondary danger-button" data-memory-action="delete-restricted" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMemoryResults(memories, target = memoryList, options = {}) {
  if (memories.length === 0) {
    target.innerHTML = `<div class="endpoint-empty">${t("memory.empty")}</div>`;
    return;
  }
  const html = memoryItemsHtml(memories, options.action || "delete", options.itemClass || "");
  if (options.append) {
    target.insertAdjacentHTML("beforeend", html);
  } else {
    target.innerHTML = html;
  }
}

function renderDeletedMemoryResults(memories) {
  if (memories.length === 0) {
    deletedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.deleted.empty")}</div>`;
    return;
  }
  deletedMemoryList.innerHTML = memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      return `
        <article class="memory-item deleted" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          <div class="memory-meta">
            <span>${escapeHtml(memory.updated_at || memory.created_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-actions">
            <button class="secondary" data-memory-action="restore" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRestrictedMemoryResults(memories) {
  if (memories.length === 0) {
    restrictedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.restricted.empty")}</div>`;
    return;
  }
  restrictedMemoryList.innerHTML = memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      return `
        <article class="memory-item restricted" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          <div class="memory-meta">
            <span>${escapeHtml(memory.updated_at || memory.created_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-actions">
            <button class="secondary danger-button" data-memory-action="delete-restricted" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderArchivedMemoryResults(memories) {
  if (memories.length === 0) {
    archivedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.archived.empty")}</div>`;
    return;
  }
  archivedMemoryList.innerHTML = memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      return `
        <article class="memory-item archived" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          <div class="memory-meta">
            <span>${escapeHtml(memory.updated_at || memory.created_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-actions">
            <button class="secondary" data-memory-action="restore-archived" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMemoryTabs() {
  for (const tab of memoryTabs) {
    const isActive = tab.dataset.memoryTab === activeMemoryTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  }
  for (const panel of memoryTabPanels) {
    panel.classList.toggle("active", panel.dataset.memoryPanel === activeMemoryTab);
  }
}

function removeLoadMoreButton(kind) {
  document.querySelector(`[data-load-more="${kind}"]`)?.remove();
}

function renderLoadMore(kind) {
  syncSnapshot();
  const totalByKind = {
    all: snapshot?.memoryStats?.activeCount ?? 0,
    restricted: snapshot?.memoryStats?.restrictedCount ?? 0,
    archived: snapshot?.memoryStats?.archivedCount ?? 0,
    deleted: snapshot?.memoryStats?.deletedCount ?? 0
  };
  const loadedByKind = {
    all: memoryPaging.all.loaded,
    restricted: memoryPaging.restricted.loaded,
    archived: memoryPaging.archived.loaded,
    deleted: memoryPaging.deleted.loaded,
    archive: Math.max(memoryPaging.archived.loaded, memoryPaging.deleted.loaded)
  };
  const total = kind === "archive" ? Math.max(totalByKind.archived, totalByKind.deleted) : totalByKind[kind];
  const loaded = loadedByKind[kind] || 0;
  const container =
    kind === "all"
      ? allMemoryList
      : kind === "restricted"
        ? restrictedMemoryList
        : kind === "archive"
          ? archivedMemoryList.parentElement
          : null;
  if (!container) return;
  removeLoadMoreButton(kind);
  if (loaded >= total) return;
  container.insertAdjacentHTML(
    "afterend",
    `<button class="secondary load-more-button" data-load-more="${kind}">${t("memory.loadMore")}</button>`
  );
}

async function loadMemoryTabData(tabName, options = {}) {
  syncSnapshot();
  if (!snapshot) return;
  const force = Boolean(options.force);
  const append = Boolean(options.append);
  if (tabName === "all" && (force || append || !loadedMemoryTabs.all)) {
    const offset = append ? memoryPaging.all.loaded : 0;
    const rows = await window.ClaraCoreDesktop.getMemories({ limit: memoryPaging.pageSize, offset });
    snapshot.memories = append ? [...(snapshot.memories || []), ...rows] : rows;
    memoryPaging.all.loaded = snapshot.memories.length;
    loadedMemoryTabs.all = true;
    if ((rows || []).length > 0) renderMemoryResults(filterByAgent(rows || [], rendererState.activeMemoryAgentFilter, memoryAgentId), allMemoryList, { append });
    memoryAllHint.textContent = t("memory.list.sample", {
      shown: snapshot?.memories?.length || 0,
      total: snapshot?.memoryStats?.activeCount ?? 0
    });
    renderLoadMore("all");
  }
  if (tabName === "restricted" && (force || append || !loadedMemoryTabs.restricted)) {
    const offset = append ? memoryPaging.restricted.loaded : 0;
    const rows = await window.ClaraCoreDesktop.getRestrictedMemories({ limit: memoryPaging.pageSize, offset });
    snapshot.restrictedMemories = append ? [...(snapshot.restrictedMemories || []), ...rows] : rows;
    memoryPaging.restricted.loaded = snapshot.restrictedMemories.length;
    loadedMemoryTabs.restricted = true;
    if ((rows || []).length > 0) renderMemoryResults(filterByAgent(rows || [], rendererState.activeMemoryAgentFilter, memoryAgentId), restrictedMemoryList, { append, action: "delete-restricted", itemClass: "restricted" });
    memoryRestrictedHint.textContent = t("memory.list.sample", {
      shown: snapshot?.restrictedMemories?.length || 0,
      total: snapshot?.memoryStats?.restrictedCount ?? 0
    });
    renderLoadMore("restricted");
  }
  if (tabName === "archive" && (force || append || !loadedMemoryTabs.archive)) {
    const archivedOffset = append ? memoryPaging.archived.loaded : 0;
    const deletedOffset = append ? memoryPaging.deleted.loaded : 0;
    const [archived, deleted] = await Promise.all([
      window.ClaraCoreDesktop.getArchivedMemories({ limit: memoryPaging.pageSize, offset: archivedOffset }),
      window.ClaraCoreDesktop.getDeletedMemories({ limit: memoryPaging.pageSize, offset: deletedOffset })
    ]);
    snapshot.archivedMemories = append ? [...(snapshot.archivedMemories || []), ...archived] : archived;
    snapshot.deletedMemories = append ? [...(snapshot.deletedMemories || []), ...deleted] : deleted;
    memoryPaging.archived.loaded = snapshot.archivedMemories.length;
    memoryPaging.deleted.loaded = snapshot.deletedMemories.length;
    loadedMemoryTabs.archive = true;
    if ((archived || []).length > 0) renderMemoryResults(filterByAgent(archived || [], rendererState.activeMemoryAgentFilter, memoryAgentId), archivedMemoryList, { append, action: "restore-archived", itemClass: "archived" });
    if ((deleted || []).length > 0) renderMemoryResults(filterByAgent(deleted || [], rendererState.activeMemoryAgentFilter, memoryAgentId), deletedMemoryList, { append, action: "restore", itemClass: "deleted" });
    renderLoadMore("archive");
  }
}

function renderMemoryLabels(labels) {
  if (!memoryAllLabelList) return;
  if (labels.length === 0) {
    memoryAllLabelList.innerHTML = `<div class="endpoint-empty">${t("memory.labels.empty")}</div>`;
    return;
  }
  memoryAllLabelList.innerHTML = labels
    .map(
      (item) => `
        <button class="label-row" data-memory-label="${escapeHtml(item.label)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.count)}</strong>
        </button>
      `
    )
    .join("");
}

function graphHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function computeGraphLayout(nodes, edges) {
  const width = 1180;
  const height = 650;
  const centerX = width / 2;
  const centerY = height / 2;
  const degree = new Map();
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }

  const positions = new Map();
  const labelNodes = nodes
    .filter((node) => node.kind === "label")
    .sort((left, right) => (degree.get(right.id) || 0) - (degree.get(left.id) || 0));
  const memoryNodes = nodes.filter((node) => node.kind === "memory");
  const otherNodes = nodes.filter((node) => node.kind !== "label" && node.kind !== "memory");

  memoryNodes.forEach((node, index) => {
    const seed = graphHash(node.id);
    const angle = index * 2.399963229728653 + (seed % 1000) / 1000;
    const radius = Math.sqrt((index + 1) / Math.max(1, memoryNodes.length)) * 245 + ((seed % 70) - 35);
    positions.set(node.id, {
      x: Math.max(24, Math.min(width - 24, centerX + Math.cos(angle) * radius * 1.38)),
      y: Math.max(24, Math.min(height - 24, centerY + Math.sin(angle) * radius * 0.92)),
      size: 2.5 + Math.min(2.5, (degree.get(node.id) || 1) / 6)
    });
  });

  labelNodes.forEach((node, index) => {
    const seed = graphHash(node.id);
    const angle = index * 2.399963229728653 + (seed % 1000) / 700;
    const radius = 95 + Math.sqrt((index + 1) / Math.max(1, labelNodes.length)) * 285 + ((seed % 80) - 40);
    positions.set(node.id, {
      x: Math.max(24, Math.min(width - 24, centerX + Math.cos(angle) * radius * 1.35)),
      y: Math.max(24, Math.min(height - 24, centerY + Math.sin(angle) * radius * 0.86)),
      size: 7 + Math.min(7, (degree.get(node.id) || 1) / 7)
    });
  });

  otherNodes.forEach((node, index) => {
    const angle = (index / Math.max(1, otherNodes.length)) * Math.PI * 2;
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * 90,
      y: centerY + Math.sin(angle) * 90,
      size: 8
    });
  });

  return { width, height, positions, degree };
}

function graphViewBox(width, height) {
  const safeZoom = Math.max(1, Math.min(3, memoryGraphZoom));
  const viewWidth = width / safeZoom;
  const viewHeight = height / safeZoom;
  const x = (width - viewWidth) / 2;
  const y = (height - viewHeight) / 2;
  return `${x.toFixed(1)} ${y.toFixed(1)} ${viewWidth.toFixed(1)} ${viewHeight.toFixed(1)}`;
}

function setMemoryGraphZoom(action) {
  if (action === "in") {
    memoryGraphZoom = Math.min(3, Number((memoryGraphZoom + 0.25).toFixed(2)));
  } else if (action === "out") {
    memoryGraphZoom = Math.max(1, Number((memoryGraphZoom - 0.25).toFixed(2)));
  } else {
    memoryGraphZoom = 1;
    memoryGraphPan = { x: 0, y: 0 };
  }
  drawMemoryGraphCanvas();
}

async function setMemoryGraphLayer(layer) {
  syncSnapshot();
  if (layer === activeMemoryGraphLayer) return;
  if (layer === "restricted" && !window.confirm(t("memory.restricted.confirm"))) return;
  if (layer === "restricted" && !snapshot?.restrictedMemoryGraph) {
    snapshot.restrictedMemoryGraph = await window.ClaraCoreDesktop.getMemoryGraph({ limit: 1000, includeRestricted: true });
  }
  activeMemoryGraphLayer = layer === "restricted" ? "restricted" : "primary";
  memoryGraphZoom = 1;
  memoryGraphPan = { x: 0, y: 0 };
  renderMemoryGraph();
}

function stopMemoryGraphAnimation() {
  if (memoryGraphAnimation) {
    cancelAnimationFrame(memoryGraphAnimation);
    memoryGraphAnimation = null;
  }
}

function drawMemoryGraphCanvas() {
  if (!memoryGraphState) return;
  const { canvas, nodes, edges, positions, width, height } = memoryGraphState;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.max(1, Math.floor(rect.width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(rect.height * pixelRatio));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const fitScale = Math.min(rect.width / width, rect.height / height);
  const scale = fitScale * memoryGraphZoom;
  const offsetX = (rect.width - width * scale) / 2 + memoryGraphPan.x;
  const offsetY = (rect.height - height * scale) / 2 + memoryGraphPan.y;
  canvas.dataset.zoom = String(memoryGraphZoom);
  canvas.dataset.panX = String(Math.round(memoryGraphPan.x));
  canvas.dataset.panY = String(Math.round(memoryGraphPan.y));
  const point = (position) => ({
    x: offsetX + position.x * scale,
    y: offsetY + position.y * scale,
    r: Math.max(1.6, position.size * scale)
  });
  const now = performance.now();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(122, 148, 136, 0.22)";
  ctx.beginPath();
  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    const a = point(from);
    const b = point(to);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  for (const node of nodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    const p = point(position);
    const phase = ((now / 1000) + (graphHash(node.id) % 900) / 1000) * Math.PI * 2 / 2.8;
    const pulse = 1 + Math.sin(phase) * 0.09;
    const radius = p.r * pulse;
    const isRestricted = node.sensitivity === "restricted";
    const fill = node.kind === "label" ? "#c88934" : node.kind === "shared_line" ? "#28745a" : isRestricted ? "#a64036" : "#365f84";
    if (isRestricted) {
      ctx.beginPath();
      ctx.fillStyle = "rgba(166, 64, 54, 0.14)";
      ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    ctx.lineWidth = 1;
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.font = "9px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (const node of nodes) {
    if (node.kind === "memory") continue;
    const position = positions.get(node.id);
    if (!position) continue;
    const p = point(position);
    const label = String(node.label || node.id);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(251, 251, 248, 0.94)";
    ctx.fillStyle = "#202421";
    ctx.strokeText(label, p.x + p.r + 5, p.y);
    ctx.fillText(label, p.x + p.r + 5, p.y);
  }

  memoryGraphAnimation = requestAnimationFrame(drawMemoryGraphCanvas);
}

function renderMemoryOverview() {
  syncSnapshot();
  if (activeMemoryGraphLayer === "restricted" && !snapshot?.restrictedMemoryGraph) {
    activeMemoryGraphLayer = "primary";
    memoryGraphZoom = 1;
    memoryGraphPan = { x: 0, y: 0 };
  }
  const stats = snapshot?.memoryStats || {};
  memoryActiveCount.textContent = stats.activeCount ?? 0;
  memoryDeletedCount.textContent = stats.deletedCount ?? 0;
  memoryEmbeddedCount.textContent = stats.embeddedCount ?? 0;
  memoryPendingEmbeddingCount.textContent = stats.pendingEmbeddingCount ?? 0;
  if (!memoryEmbeddingBatchRunning) {
    const actionableEmbeddings = Number(stats.pendingEmbeddingCount || 0) + Number(stats.failedEmbeddingCount || 0);
    processMemoryEmbeddings.disabled = actionableEmbeddings <= 0;
    if (actionableEmbeddings <= 0) memoryEmbeddingNotice.textContent = t("memory.embedding.nonePending");
    if (actionableEmbeddings <= 0) memoryEmbeddingProgressBar.style.width = "0%";
  }
  memoryRestrictedCount.textContent = stats.restrictedCount ?? 0;
  memoryArchivedCount.textContent = stats.archivedCount ?? 0;
  const labels = stats.labels || [];
  if (labels.length === 0) {
    memoryLabelList.innerHTML = `<span class="quiet">${t("memory.labels.empty")}</span>`;
  } else {
    memoryLabelList.innerHTML = labels
      .slice(0, 12)
      .map((item) => `<button class="tag-button" data-memory-label="${escapeHtml(item.label)}">${escapeHtml(item.label)} <span>${escapeHtml(item.count)}</span></button>`)
      .join("");
  }
  renderMemoryLabels(labels);
  if (!loadedMemoryTabs.all) {
    allMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
  }
  memoryAllHint.textContent = t("memory.list.sample", {
    shown: loadedMemoryTabs.all ? snapshot?.memories?.length || 0 : 0,
    total: stats.activeCount ?? 0
  });
  memoryRestrictedHint.textContent = t("memory.list.sample", {
    shown: loadedMemoryTabs.restricted ? snapshot?.restrictedMemories?.length || 0 : 0,
    total: stats.restrictedCount ?? 0
  });
  if (!loadedMemoryTabs.restricted) {
    restrictedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
  }
  if (!loadedMemoryTabs.archive) {
    archivedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
    deletedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
  }
  renderMemoryGraph();
  renderMemoryTabs();
}

function renderMemoryGraph() {
  syncSnapshot();
  const graph = activeMemoryGraphLayer === "restricted" ? snapshot?.restrictedMemoryGraph || {} : snapshot?.memoryGraph || {};
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  memoryGraphSummary.textContent = t("memory.graph.summary", {
    nodes: nodes.length,
    edges: edges.length
  });
  if (nodes.length === 0 || edges.length === 0) {
    stopMemoryGraphAnimation();
    memoryGraphState = null;
    memoryGraph.innerHTML = `<div class="endpoint-empty">${t("memory.graph.empty")}</div>`;
    return;
  }
  const { width, height, positions, degree } = computeGraphLayout(nodes, edges);
  const positionedNodes = nodes.filter((node) => positions.has(node.id));
  const positionedEdges = edges.filter((edge) => positions.has(edge.from) && positions.has(edge.to));
  stopMemoryGraphAnimation();
  memoryGraph.innerHTML = `
    <div class="graph-toolbar">
      <div>
        <button class="graph-layer ${activeMemoryGraphLayer === "primary" ? "active" : ""}" data-graph-layer="primary">${escapeHtml(t("memory.graph.primaryLayer"))}</button>
        <button class="graph-layer ${activeMemoryGraphLayer === "restricted" ? "active restricted" : ""}" data-graph-layer="restricted">${escapeHtml(t("memory.graph.restrictedLayer"))}</button>
      </div>
      <div class="graph-zoom-controls">
        <button class="secondary" data-graph-zoom="out" aria-label="${escapeHtml(t("memory.graph.zoomOut"))}">−</button>
        <button class="secondary" data-graph-zoom="fit">${escapeHtml(t("memory.graph.fit"))}</button>
        <button class="secondary" data-graph-zoom="in" aria-label="${escapeHtml(t("memory.graph.zoomIn"))}">+</button>
      </div>
      <strong>${escapeHtml(t("memory.graph.summary", { nodes: nodes.length, edges: edges.length }))}</strong>
    </div>
    <div class="graph-canvas">
      <canvas id="memoryGraphCanvas" data-node-count="${positionedNodes.length}" data-edge-count="${positionedEdges.length}" data-restricted-count="${positionedNodes.filter((node) => node.sensitivity === "restricted").length}" aria-label="${escapeHtml(t("memory.graph.title"))}"></canvas>
    </div>
  `;
  memoryGraphState = {
    canvas: document.querySelector("#memoryGraphCanvas"),
    nodes: positionedNodes,
    edges: positionedEdges,
    positions,
    degree,
    width,
    height
  };
  drawMemoryGraphCanvas();
}

  function resetLoadedTabs() {
    loadedMemoryTabs.all = false;
    loadedMemoryTabs.restricted = false;
    loadedMemoryTabs.archive = false;
    memoryPaging.all.loaded = 0;
    memoryPaging.restricted.loaded = 0;
    memoryPaging.archived.loaded = 0;
    memoryPaging.deleted.loaded = 0;
    removeLoadMoreButton("all");
    removeLoadMoreButton("restricted");
    removeLoadMoreButton("archive");
  }

  function getActiveTab() { return activeMemoryTab; }
  function setActiveAgentFilter(value) { activeMemoryAgentFilter = value || ""; }
  function setActiveTab(tabName) { activeMemoryTab = tabName || "search"; }

  function searchMemoryLabel(label) {
    memorySearchInput.value = String(label || "").trim();
    activeMemoryTab = "search";
    renderMemoryTabs();
    searchMemory.click();
  }

  function beginGraphDrag(event) {
    if (!event.target.closest(".graph-canvas")) return;
    memoryGraphDrag = { x: event.clientX, y: event.clientY, startPan: { ...memoryGraphPan } };
    memoryGraph.classList.add("dragging");
  }

  function moveGraphDrag(event) {
    if (!memoryGraphDrag) return;
    memoryGraphPan = { x: memoryGraphDrag.startPan.x + event.clientX - memoryGraphDrag.x, y: memoryGraphDrag.startPan.y + event.clientY - memoryGraphDrag.y };
  }

  function endGraphDrag() {
    if (!memoryGraphDrag) return;
    memoryGraphDrag = null;
    memoryGraph.classList.remove("dragging");
  }

  async function processEmbeddings() {
    if (memoryEmbeddingBatchRunning) return;
    memoryEmbeddingBatchRunning = true;
    processMemoryEmbeddings.disabled = true;
    const snapshot = getSnapshot();
    const progress = { total: Number(snapshot?.memoryStats?.pendingEmbeddingCount || 0), processed: 0, ready: 0, failed: 0 };
    appendLiveLogLine("memoria", "starting full embedding generation");
    try {
      let firstBatch = true;
      while (true) {
        const result = await window.ClaraCoreDesktop.processMemoryEmbeddings({ batchSize: memoryPaging.pageSize, requeue: firstBatch });
        firstBatch = false;
        const results = result?.results || [];
        progress.processed += Number(result?.processed || results.length || 0);
        progress.ready += results.filter((item) => item.ok).length;
        progress.failed += results.filter((item) => !item.ok).length;
        const stats = await window.ClaraCoreDesktop.getMemoryStats();
        progress.total = Math.max(progress.total, progress.processed + Number(stats.pendingEmbeddingCount || 0));
        setEmbeddingProgress(stats, progress);
        if (!result?.processed || Number(stats.pendingEmbeddingCount || 0) <= 0) break;
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
      await refreshRuntimeSnapshotOnly();
      const finalText = progress.failed > 0 ? `${t("memory.embedding.processed", { count: progress.processed })}; ${t("memory.embedding.stopped")}` : t("memory.embedding.processed", { count: progress.processed });
      memoryEmbeddingNotice.textContent = finalText;
      appendLiveLogLine("memoria", finalText);
    } catch (error) {
      console.error(error);
      memoryEmbeddingNotice.textContent = t("memory.embedding.processFailed");
      appendLiveLogLine("memoria", `${t("memory.embedding.processFailed")}: ${error.message || error}`);
    } finally {
      memoryEmbeddingBatchRunning = false;
      const snapshot = getSnapshot();
      const pending = Number(snapshot?.memoryStats?.pendingEmbeddingCount || 0);
      const failed = Number(snapshot?.memoryStats?.failedEmbeddingCount || 0);
      processMemoryEmbeddings.disabled = pending <= 0 && failed <= 0;
    }
  }

  return {
    beginGraphDrag, endGraphDrag, getActiveTab, loadMemoryTabData, memoryAgentId, moveGraphDrag, processEmbeddings,
    renderMemoryGraph, renderMemoryList, renderMemoryOverview, renderMemoryResults, renderMemoryTabs, resetLoadedTabs,
    searchMemoryLabel, setActiveAgentFilter, setActiveTab, setMemoryGraphLayer, setMemoryGraphZoom
  };
}

window.createClaraCoreMemoriaView = createClaraCoreMemoriaView;
