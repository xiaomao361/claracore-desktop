function createClaraCoreMemoriaView(context) {
  const {
    dom,
    t,
    getSnapshot,
    escapeHtml,
    renderMarkdownPreview,
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
  const loadedMemoryTabs = { all: false, restricted: false, archive: false, graph: false };
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
  syncSnapshot();
  const memories = filterByAgent(snapshot?.memories || [], activeMemoryAgentFilter, memoryAgentId);
  renderMemoryResults(memories);
}

function renderMemoryBody(body) {
  return renderMarkdownPreview ? renderMarkdownPreview(body) : `<p>${escapeHtml(body)}</p>`;
}

function renderMemoryLabelsInline(labels) {
  return (labels || [])
    .slice(0, 8)
    .map((label) => `<span>${escapeHtml(label)}</span>`)
    .join("");
}

function renderLabelOverview(labels) {
  const visibleLabels = (labels || []).slice(0, 10);
  if (visibleLabels.length === 0) {
    memoryLabelList.innerHTML = `<span class="quiet">${t("memory.labels.empty")}</span>`;
    return;
  }
  const maxCount = Math.max(...visibleLabels.map((item) => Number(item.count || 0)), 1);
  memoryLabelList.innerHTML = `
    <div class="label-overview-list">
      ${visibleLabels
        .map((item) => {
          const count = Number(item.count || 0);
          const strength = Math.max(12, Math.round((count / maxCount) * 100));
          return `
            <button class="label-overview-row" data-memory-label="${escapeHtml(item.label)}" style="--label-strength: ${strength}%">
              <span class="label-overview-name">${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(count)}</strong>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function vectorMaintenanceCount(input = {}) {
  const stats = input.stats || {};
  const maintenance = input.maintenance || {};
  const counts = maintenance.counts || {};
  return (
    Number(stats.pendingEmbeddingCount || 0) +
    Number(stats.failedEmbeddingCount || 0) +
    Number(counts.missingEmbeddings || 0) +
    Number(counts.failedEmbeddings || 0) +
    Number(counts.staleEmbeddings || 0)
  );
}

function memoryItemsHtml(memories, action = "delete", itemClass = "") {
  return memories
    .map((memory) => {
      const labels = renderMemoryLabelsInline(memory.labels || []);
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
          ${renderMemoryBody(memory.body)}
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
      const labels = renderMemoryLabelsInline(memory.labels || []);
      return `
        <article class="memory-item deleted" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          ${renderMemoryBody(memory.body)}
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
      const labels = renderMemoryLabelsInline(memory.labels || []);
      return `
        <article class="memory-item restricted" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          ${renderMemoryBody(memory.body)}
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
      const labels = renderMemoryLabelsInline(memory.labels || []);
      return `
        <article class="memory-item archived" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          ${renderMemoryBody(memory.body)}
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
    const rows = await window.ClaraCoreDesktop.getMemories({ limit: memoryPaging.pageSize, offset, agentId: activeMemoryAgentFilter });
    snapshot.memories = append ? [...(snapshot.memories || []), ...rows] : rows;
    memoryPaging.all.loaded = snapshot.memories.length;
    loadedMemoryTabs.all = true;
    if ((rows || []).length > 0) renderMemoryResults(filterByAgent(rows || [], activeMemoryAgentFilter, memoryAgentId), allMemoryList, { append });
    memoryAllHint.textContent = t("memory.list.sample", {
      shown: snapshot?.memories?.length || 0,
      total: snapshot?.memoryStats?.activeCount ?? 0
    });
    renderLoadMore("all");
  }
  if (tabName === "restricted" && (force || append || !loadedMemoryTabs.restricted)) {
    const offset = append ? memoryPaging.restricted.loaded : 0;
    const rows = await window.ClaraCoreDesktop.getRestrictedMemories({ limit: memoryPaging.pageSize, offset, agentId: activeMemoryAgentFilter });
    snapshot.restrictedMemories = append ? [...(snapshot.restrictedMemories || []), ...rows] : rows;
    memoryPaging.restricted.loaded = snapshot.restrictedMemories.length;
    loadedMemoryTabs.restricted = true;
    if ((rows || []).length > 0) renderMemoryResults(filterByAgent(rows || [], activeMemoryAgentFilter, memoryAgentId), restrictedMemoryList, { append, action: "delete-restricted", itemClass: "restricted" });
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
      window.ClaraCoreDesktop.getArchivedMemories({ limit: memoryPaging.pageSize, offset: archivedOffset, agentId: activeMemoryAgentFilter }),
      window.ClaraCoreDesktop.getDeletedMemories({ limit: memoryPaging.pageSize, offset: deletedOffset, agentId: activeMemoryAgentFilter })
    ]);
    snapshot.archivedMemories = append ? [...(snapshot.archivedMemories || []), ...archived] : archived;
    snapshot.deletedMemories = append ? [...(snapshot.deletedMemories || []), ...deleted] : deleted;
    memoryPaging.archived.loaded = snapshot.archivedMemories.length;
    memoryPaging.deleted.loaded = snapshot.deletedMemories.length;
    loadedMemoryTabs.archive = true;
    if ((archived || []).length > 0) renderMemoryResults(filterByAgent(archived || [], activeMemoryAgentFilter, memoryAgentId), archivedMemoryList, { append, action: "restore-archived", itemClass: "archived" });
    if ((deleted || []).length > 0) renderMemoryResults(filterByAgent(deleted || [], activeMemoryAgentFilter, memoryAgentId), deletedMemoryList, { append, action: "restore", itemClass: "deleted" });
    renderLoadMore("archive");
  }
  if (tabName === "graph" && (force || !loadedMemoryTabs.graph)) {
    snapshot.memoryGraph = await window.ClaraCoreDesktop.getMemoryGraph({ limit: 100 });
    loadedMemoryTabs.graph = true;
    renderMemoryGraph();
  }
}

function renderMemoryLabels(labels) {
  if (!memoryAllLabelList) return;
  if (labels.length === 0) {
    memoryAllLabelList.innerHTML = `<div class="endpoint-empty">${t("memory.labels.empty")}</div>`;
    return;
  }
  const visibleLabels = labels.slice(0, 80);
  const featured = visibleLabels.slice(0, 4);
  const rest = visibleLabels.slice(4);
  const maxCount = Math.max(...visibleLabels.map((item) => Number(item.count || 0)), 1);
  const labelTone = (label) => {
    const text = String(label || "");
    if (text.startsWith("agent") || text.startsWith("agent-id")) return "agent";
    if (text.startsWith("系统:")) return "system";
    if (text.startsWith("tool:")) return "tool";
    if (text.startsWith("项目:") || text === "claracore") return "project";
    return "default";
  };
  const strength = (count) => Math.max(10, Math.round((Number(count || 0) / maxCount) * 100));
  memoryAllLabelList.innerHTML = `
    <div class="label-board">
      <div class="label-feature-grid">
        ${featured
          .map(
            (item) => `
              <button class="label-feature-card ${labelTone(item.label)}" data-memory-label="${escapeHtml(item.label)}" style="--label-strength: ${strength(item.count)}%">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.count)}</strong>
              </button>
            `
          )
          .join("")}
      </div>
      <div class="label-mini-grid">
        ${rest
          .map(
            (item) => `
              <button class="label-mini-card ${labelTone(item.label)}" data-memory-label="${escapeHtml(item.label)}" style="--label-strength: ${strength(item.count)}%">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.count)}</strong>
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
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
  const width = 900;
  const height = 680;
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

  const spherePoint = (index, total, seed, radiusScale = 1) => {
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const z = 1 - (2 * (index + 0.5)) / Math.max(1, total);
    const ring = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = index * goldenAngle + (seed % 628) / 100;
    const jitter = ((seed % 200) - 100) / 2500;
    const nx = (Math.cos(theta) * ring + jitter) * radiusScale;
    const ny = (z * 0.9 + jitter * 0.6) * radiusScale;
    const nz = (Math.sin(theta) * ring - jitter) * radiusScale;
    return { nx, ny, nz };
  };

  const setSpherePosition = (node, index, total, radiusScale, size) => {
    const seed = graphHash(node.id);
    const point = spherePoint(index, total, seed, radiusScale);
    positions.set(node.id, {
      ...point,
      x: centerX + point.nx * width * 0.34,
      y: centerY + point.ny * height * 0.38,
      z: point.nz,
      size
    });
  };

  memoryNodes.forEach((node, index) => {
    setSpherePosition(node, index, memoryNodes.length, 0.82, 2.2 + Math.min(3.4, (degree.get(node.id) || 1) / 5));
  });

  labelNodes.forEach((node, index) => {
    setSpherePosition(node, index, labelNodes.length, 1.02, 6 + Math.min(8, (degree.get(node.id) || 1) / 7));
  });

  otherNodes.forEach((node, index) => {
    setSpherePosition(node, index, otherNodes.length, 0.5, 8 + Math.min(7, (degree.get(node.id) || 1) / 5));
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
  stopMemoryGraphAnimation();
  drawMemoryGraphCanvas();
}

async function setMemoryGraphLayer(layer) {
  syncSnapshot();
  if (layer === activeMemoryGraphLayer) return;
  if (layer === "restricted" && !window.confirm(t("memory.restricted.confirm"))) return;
  if (layer === "restricted" && !snapshot?.restrictedMemoryGraph) {
    snapshot.restrictedMemoryGraph = await window.ClaraCoreDesktop.getMemoryGraph({ limit: 1000, includeRestricted: true, force: true });
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
  const { canvas, nodes, edges, positions, degree } = memoryGraphState;
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

  const now = performance.now();
  const reducedMotion = document.body?.dataset?.motion === "off";
  const rotation = reducedMotion ? 0.42 : now / 32000;
  const tilt = -0.18;
  const centerX = rect.width / 2 + memoryGraphPan.x;
  const centerY = rect.height / 2 + memoryGraphPan.y;
  const sphereRadius = Math.min(rect.width, rect.height) * 0.42 * memoryGraphZoom;
  canvas.dataset.zoom = String(memoryGraphZoom);
  canvas.dataset.panX = String(Math.round(memoryGraphPan.x));
  canvas.dataset.panY = String(Math.round(memoryGraphPan.y));
  const project = (position) => {
    const nx = Number.isFinite(position.nx) ? position.nx : 0;
    const ny = Number.isFinite(position.ny) ? position.ny : 0;
    const nz = Number.isFinite(position.nz) ? position.nz : position.z || 0;
    const cosY = Math.cos(rotation);
    const sinY = Math.sin(rotation);
    const rx = nx * cosY + nz * sinY;
    const rz = nz * cosY - nx * sinY;
    const cosX = Math.cos(tilt);
    const sinX = Math.sin(tilt);
    const ry = ny * cosX - rz * sinX;
    const depth = rz * cosX + ny * sinX;
    const perspective = 1 / (1.9 - depth * 0.44);
    return {
      x: centerX + rx * sphereRadius * perspective,
      y: centerY + ry * sphereRadius * perspective,
      r: Math.max(1.4, position.size * perspective * memoryGraphZoom),
      depth,
      perspective
    };
  };
  const safeDegree = (nodeId) => Math.max(1, degree?.get(nodeId) || 1);
  const isDarkTheme = document.body?.dataset?.theme === "dark";
  const graphTheme = isDarkTheme
    ? {
        backgroundStops: [
          [0, "rgba(32, 42, 36, 0.96)"],
          [0.46, "rgba(24, 30, 27, 0.98)"],
          [1, "rgba(18, 23, 20, 1)"]
        ],
        edge: "82, 128, 106",
        memory: "99, 155, 215",
        restricted: "214, 118, 101",
        core: "121, 201, 164",
        shell: "121, 201, 164",
        labelHalo: "rgba(215, 159, 75, 0.16)",
        sharedLineHalo: "rgba(121, 201, 164, 0.16)",
        nodeStroke: "rgba(232, 242, 235, 0.58)",
        pillFill: "rgba(34, 41, 37, 0.92)",
        pillText: "#edf4ee",
        labelPillStroke: "rgba(215, 159, 75, 0.36)",
        sharedLinePillStroke: "rgba(121, 201, 164, 0.34)"
      }
    : {
        backgroundStops: [
          [0, "rgba(232, 242, 235, 0.88)"],
          [0.46, "rgba(250, 250, 247, 0.98)"],
          [1, "rgba(244, 245, 239, 1)"]
        ],
        edge: "82, 107, 98",
        memory: "54, 95, 132",
        restricted: "166, 64, 54",
        core: "40, 116, 90",
        shell: "54, 95, 132",
        labelHalo: "rgba(189, 127, 40, 0.13)",
        sharedLineHalo: "rgba(40, 116, 90, 0.13)",
        nodeStroke: "rgba(255, 255, 255, 0.9)",
        pillFill: "rgba(255, 255, 252, 0.88)",
        pillText: "#202421",
        labelPillStroke: "rgba(189, 127, 40, 0.28)",
        sharedLinePillStroke: "rgba(40, 116, 90, 0.28)"
      };
  const nodeColor = (node) => {
    if (node.kind === "label") return isDarkTheme ? "#d79f4b" : "#bd7f28";
    if (node.kind === "shared_line") return isDarkTheme ? "#79c9a4" : "#28745a";
    if (node.sensitivity === "restricted") return isDarkTheme ? "#d67665" : "#a64036";
    return isDarkTheme ? "#639bd7" : "#365f84";
  };
  const labelForNode = (node) => String(node.label || node.id || "");
  const truncateCanvasText = (text, maxWidth) => {
    const source = String(text || "");
    if (ctx.measureText(source).width <= maxWidth) return source;
    let next = source;
    while (next.length > 3 && ctx.measureText(`${next}...`).width > maxWidth) {
      next = next.slice(0, -1);
    }
    return `${next}...`;
  };
  const roundRect = (x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const background = ctx.createRadialGradient(rect.width * 0.55, rect.height * 0.44, 40, rect.width * 0.55, rect.height * 0.44, Math.max(rect.width, rect.height) * 0.72);
  for (const [stop, color] of graphTheme.backgroundStops) {
    background.addColorStop(stop, color);
  }
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, rect.width, rect.height);

  const shellGradient = ctx.createRadialGradient(centerX - sphereRadius * 0.22, centerY - sphereRadius * 0.28, sphereRadius * 0.06, centerX, centerY, sphereRadius * 1.04);
  shellGradient.addColorStop(0, `rgba(${graphTheme.core}, ${isDarkTheme ? 0.2 : 0.16})`);
  shellGradient.addColorStop(0.58, `rgba(${graphTheme.shell}, ${isDarkTheme ? 0.08 : 0.06})`);
  shellGradient.addColorStop(1, `rgba(${graphTheme.shell}, 0)`);
  ctx.beginPath();
  ctx.arc(centerX, centerY, sphereRadius * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = shellGradient;
  ctx.fill();

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.strokeStyle = `rgba(${graphTheme.shell}, ${isDarkTheme ? 0.16 : 0.12})`;
  ctx.lineWidth = 0.8;
  for (const factor of [0.42, 0.66, 0.86, 1]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, sphereRadius * factor, sphereRadius * factor * 0.46, rotation * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const angle of [-0.75, -0.32, 0.28, 0.68]) {
    ctx.beginPath();
    ctx.ellipse(0, 0, sphereRadius * 0.96, sphereRadius * 0.26, angle + rotation * 0.22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  const projectedNodes = nodes
    .map((node) => {
      const position = positions.get(node.id);
      return position ? { node, p: project(position) } : null;
    })
    .filter(Boolean);
  const projectedById = new Map(projectedNodes.map((item) => [item.node.id, item.p]));

  const edgeDrawList = edges
    .map((edge) => {
      const a = projectedById.get(edge.from);
      const b = projectedById.get(edge.to);
      if (!a || !b) return null;
      return { edge, a, b, depth: (a.depth + b.depth) / 2 };
    })
    .filter(Boolean)
    .sort((left, right) => left.depth - right.depth);

  for (const item of edgeDrawList) {
    const { edge, a, b, depth } = item;
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    const middleX = (a.x + b.x) / 2;
    const middleY = (a.y + b.y) / 2;
    const curve = Math.max(-42, Math.min(42, (a.depth - b.depth) * 38 + (a.x - b.x) * 0.02));
    const depthAlpha = Math.max(0.12, Math.min(1, (depth + 1.1) / 2.1));
    const alpha = Math.min(isDarkTheme ? 0.4 : 0.28, ((isDarkTheme ? 0.055 : 0.04) + (safeDegree(edge.from) + safeDegree(edge.to)) / 900) * depthAlpha);
    ctx.beginPath();
    ctx.lineWidth = (isDarkTheme ? 0.72 : 0.62) + Math.max(0, depth) * 0.42;
    ctx.strokeStyle = `rgba(${graphTheme.edge}, ${alpha})`;
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(middleX + curve, middleY - curve, b.x, b.y);
    ctx.stroke();
  }

  const nodeDrawList = projectedNodes.sort((left, right) => left.p.depth - right.p.depth);
  for (const { node, p } of nodeDrawList) {
    const phase = ((now / 1000) + (graphHash(node.id) % 900) / 1000) * Math.PI * 2 / 2.8;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(phase) * 0.045;
    const front = Math.max(0.28, Math.min(1, (p.depth + 1.05) / 2.05));
    const radius = p.r * pulse * (0.72 + front * 0.42);
    const isRestricted = node.sensitivity === "restricted";
    if (node.kind !== "memory") continue;
    if (isRestricted || p.depth > 0.35) {
      ctx.beginPath();
      ctx.fillStyle = isRestricted
        ? `rgba(${graphTheme.restricted}, ${isDarkTheme ? 0.16 : 0.12})`
        : `rgba(${graphTheme.memory}, ${isDarkTheme ? 0.12 : 0.08})`;
      ctx.arc(p.x, p.y, radius + 3.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.fillStyle = isRestricted
      ? `rgba(${graphTheme.restricted}, ${0.42 + front * 0.44})`
      : `rgba(${graphTheme.memory}, ${0.28 + front * 0.52})`;
    ctx.strokeStyle = graphTheme.nodeStroke;
    ctx.lineWidth = 0.7 + front * 0.5;
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  const hubNodes = projectedNodes
    .filter((item) => item.node.kind !== "memory")
    .sort((left, right) => left.p.depth - right.p.depth);
  for (const { node, p } of hubNodes) {
    const color = nodeColor(node);
    const front = Math.max(0.34, Math.min(1, (p.depth + 1.05) / 2.05));
    const radius = Math.max(4, p.r * (0.58 + front * 0.48));
    const phase = ((now / 1000) + (graphHash(node.id) % 1000) / 1000) * Math.PI * 2 / 3.6;
    const halo = radius + 5 + (reducedMotion ? 0 : Math.sin(phase) * 1.5);
    ctx.beginPath();
    ctx.fillStyle = node.kind === "label"
      ? graphTheme.labelHalo
      : graphTheme.sharedLineHalo;
    ctx.globalAlpha = 0.45 + front * 0.55;
    ctx.arc(p.x, p.y, halo, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.strokeStyle = graphTheme.nodeStroke;
    ctx.lineWidth = 1.4;
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.font = "600 10px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  const labeledHubs = [...hubNodes]
    .filter(({ p }) => p.depth > -0.2)
    .sort((left, right) => {
      const rank = safeDegree(right.node.id) - safeDegree(left.node.id);
      return rank || right.p.depth - left.p.depth;
    })
    .slice(0, 34)
    .sort((left, right) => left.p.depth - right.p.depth);
  for (const { node, p } of labeledHubs) {
    const label = truncateCanvasText(labelForNode(node), node.kind === "label" ? 106 : 132);
    const textWidth = ctx.measureText(label).width;
    const pillWidth = Math.min(148, textWidth + 18);
    const pillHeight = 22;
    const x = Math.min(rect.width - pillWidth - 8, Math.max(8, p.x + p.r + 8));
    const y = Math.min(rect.height - pillHeight - 8, Math.max(8, p.y - pillHeight / 2));
    roundRect(x, y, pillWidth, pillHeight, 11);
    const front = Math.max(0.35, Math.min(1, (p.depth + 1.05) / 2.05));
    ctx.globalAlpha = 0.58 + front * 0.42;
    ctx.fillStyle = graphTheme.pillFill;
    ctx.fill();
    ctx.strokeStyle = node.kind === "label" ? graphTheme.labelPillStroke : graphTheme.sharedLinePillStroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = graphTheme.pillText;
    ctx.fillText(label, x + 9, y + pillHeight / 2);
    ctx.globalAlpha = 1;
  }

  if (!reducedMotion) {
    memoryGraphAnimation = requestAnimationFrame(drawMemoryGraphCanvas);
  }
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
    const actionableEmbeddings = vectorMaintenanceCount({ stats, maintenance: snapshot?.memoryMaintenance || {} });
    processMemoryEmbeddings.disabled = actionableEmbeddings <= 0;
    if (actionableEmbeddings <= 0) memoryEmbeddingNotice.textContent = t("memory.embedding.nonePending");
    if (actionableEmbeddings <= 0) memoryEmbeddingProgressBar.style.width = "0%";
  }
  memoryRestrictedCount.textContent = stats.restrictedCount ?? 0;
  memoryArchivedCount.textContent = stats.archivedCount ?? 0;
  const labels = stats.labels || [];
  const agentIds = labels
    .map((item) => String(item.label || ""))
    .filter((label) => label.startsWith("agent-id:"))
    .map((label) => label.slice("agent-id:".length));
  const fallbackAgentIds = labels
    .map((item) => String(item.label || ""))
    .filter((label) => label.startsWith("agent:"))
    .map((label) => label.slice("agent:".length));
  activeMemoryAgentFilter = renderAgentFilter(memoryAgentFilter, agentIds.length ? agentIds : fallbackAgentIds, activeMemoryAgentFilter);
  renderLabelOverview(labels);
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
  if (loadedMemoryTabs.graph) renderMemoryGraph();
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
    loadedMemoryTabs.graph = false;
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
    if (!memoryGraphAnimation) drawMemoryGraphCanvas();
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
    const progress = {
      total: vectorMaintenanceCount({ stats: snapshot?.memoryStats || {}, maintenance: snapshot?.memoryMaintenance || {} }),
      processed: 0,
      ready: 0,
      failed: 0
    };
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
      processMemoryEmbeddings.disabled = vectorMaintenanceCount({ stats: snapshot?.memoryStats || {}, maintenance: snapshot?.memoryMaintenance || {} }) <= 0;
    }
  }

  return {
    beginGraphDrag, endGraphDrag, getActiveTab, loadMemoryTabData, memoryAgentId, moveGraphDrag, processEmbeddings,
    renderMemoryGraph, renderMemoryList, renderMemoryOverview, renderMemoryResults, renderMemoryTabs, resetLoadedTabs,
    searchMemoryLabel, setActiveAgentFilter, setActiveTab, setMemoryGraphLayer, setMemoryGraphZoom
  };
}

window.createClaraCoreMemoriaView = createClaraCoreMemoriaView;
