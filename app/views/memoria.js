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
    memorySearchInput, searchMemory, memoryList, memoryAgentFilter, memoryGraphSummary, memoryGraph,
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
  let memoryGraphDragMoved = false;
  let memoryGraphMode = "network";
  let memoryGraphSelection = null;
  let memoryGraphHover = null;
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

  const memoryListRenderer = window.createClaraCoreMemoriaList({
    t,
    escapeHtml,
    renderMarkdownPreview,
    memoryLabelList
  });
  const {
    filterByAgent,
    memoryAgentId,
    renderAgentFilter,
    renderLabelOverview,
    renderMemoryBody,
    renderMemoryLabelsInline,
    renderMemoryResults,
    vectorMaintenanceCount
  } = memoryListRenderer;

function renderMemoryList() {
  syncSnapshot();
  const memories = filterByAgent(snapshot?.memories || [], activeMemoryAgentFilter, memoryAgentId);
  renderMemoryResults(memories, memoryList);
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
      ? memoryList
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
  if ((tabName === "all" || tabName === "search") && (force || append || !loadedMemoryTabs.all)) {
    const offset = append ? memoryPaging.all.loaded : 0;
    const rows = await window.ClaraCoreDesktop.getMemories({ limit: memoryPaging.pageSize, offset, agentId: activeMemoryAgentFilter });
    snapshot.memories = append ? [...(snapshot.memories || []), ...rows] : rows;
    memoryPaging.all.loaded = snapshot.memories.length;
    loadedMemoryTabs.all = true;
    renderMemoryResults(filterByAgent(snapshot.memories || [], activeMemoryAgentFilter, memoryAgentId), memoryList);
    memoryAllHint.textContent = t("memory.list.sample", {
      shown: snapshot?.memories?.length || 0,
      total: snapshot?.memoryStats?.activeCount ?? 0
    });
    renderLoadMore("all");
  }
  if (tabName === "archive" && (force || append || !loadedMemoryTabs.restricted)) {
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
    snapshot.memoryGraph = await window.ClaraCoreDesktop.getMemoryGraph({ limit: 400 });
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

function isLinkEdge(edge) {
  return String(edge?.kind || "").startsWith("link:");
}

function linkKindOf(edge) {
  return String(edge?.kind || "").slice(5);
}

function buildGraphModel(graph, mode) {
  const allNodes = graph.nodes || [];
  const allEdges = graph.edges || [];
  const linkEdges = allEdges.filter(isLinkEdge);
  const effectiveMode = mode === "network" && linkEdges.length > 0 ? "network" : "all";

  let nodes;
  let edges;
  if (effectiveMode === "network") {
    const keep = new Set();
    for (const edge of linkEdges) {
      keep.add(edge.from);
      keep.add(edge.to);
    }
    for (const edge of allEdges) {
      if (edge.kind === "uses" && keep.has(edge.to)) keep.add(edge.from);
    }
    nodes = allNodes.filter((node) => keep.has(node.id) && node.kind !== "label");
    edges = allEdges.filter((edge) => edge.kind !== "labeled" && keep.has(edge.from) && keep.has(edge.to));
  } else {
    const labelDegree = new Map();
    for (const edge of allEdges) {
      if (edge.kind !== "labeled") continue;
      labelDegree.set(edge.to, (labelDegree.get(edge.to) || 0) + 1);
    }
    const sortedLabels = [...labelDegree.entries()].sort((left, right) => right[1] - left[1]);
    const hubLabels = sortedLabels.filter(([, count]) => count >= 3);
    const keptLabels = new Set(
      (hubLabels.length > 0 ? hubLabels : sortedLabels).slice(0, 40).map(([labelId]) => labelId)
    );
    nodes = allNodes.filter((node) => node.kind !== "label" || keptLabels.has(node.id));
    edges = allEdges.filter((edge) => edge.kind !== "labeled" || keptLabels.has(edge.to));
  }

  const degree = new Map();
  const linkDegree = new Map();
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
    if (isLinkEdge(edge)) {
      linkDegree.set(edge.from, (linkDegree.get(edge.from) || 0) + 1);
      linkDegree.set(edge.to, (linkDegree.get(edge.to) || 0) + 1);
    }
  }
  const neighborhood = new Map();
  const addNeighbor = (a, b) => {
    if (!neighborhood.has(a)) neighborhood.set(a, new Set());
    neighborhood.get(a).add(b);
  };
  for (const edge of edges) {
    addNeighbor(edge.from, edge.to);
    addNeighbor(edge.to, edge.from);
  }
  return { nodes, edges, degree, linkDegree, neighborhood, effectiveMode, linkEdgeCount: linkEdges.length };
}

function createForceLayout(model) {
  const { nodes, edges, degree } = model;
  const bodies = new Map();
  nodes.forEach((node, index) => {
    const seed = graphHash(node.id);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const radius = 40 + 210 * Math.sqrt((index + 0.5) / Math.max(1, nodes.length));
    const theta = index * goldenAngle + (seed % 628) / 100;
    bodies.set(node.id, {
      node,
      x: Math.cos(theta) * radius,
      y: Math.sin(theta) * radius * 0.82,
      vx: 0,
      vy: 0,
      size: node.kind === "memory"
        ? 3.2 + Math.min(5, (degree.get(node.id) || 1) * 0.9)
        : node.kind === "label"
          ? 5 + Math.min(7, (degree.get(node.id) || 1) / 7)
          : 8
    });
  });

  const springs = edges
    .map((edge) => {
      const a = bodies.get(edge.from);
      const b = bodies.get(edge.to);
      if (!a || !b) return null;
      if (isLinkEdge(edge)) {
        const strength = Math.max(0.05, Math.min(1, Number(edge.strength) || 0.5));
        return { a, b, rest: 105 - strength * 45, k: 0.055 + strength * 0.055 };
      }
      if (edge.kind === "uses") return { a, b, rest: 130, k: 0.02 };
      return { a, b, rest: 165, k: 0.008 };
    })
    .filter(Boolean);

  let alpha = 1;
  const bodyList = [...bodies.values()];
  const step = () => {
    if (alpha <= 0.02) return false;
    for (let i = 0; i < bodyList.length; i += 1) {
      const a = bodyList[i];
      for (let j = i + 1; j < bodyList.length; j += 1) {
        const b = bodyList[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 0.01) {
          dx = ((graphHash(a.node.id) % 10) - 5) / 10 || 0.3;
          dy = ((graphHash(b.node.id) % 10) - 5) / 10 || -0.3;
          distSq = dx * dx + dy * dy;
        }
        const force = Math.min(6, 1300 / distSq) * alpha;
        const dist = Math.sqrt(distSq);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    for (const spring of springs) {
      const dx = spring.b.x - spring.a.x;
      const dy = spring.b.y - spring.a.y;
      const dist = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));
      const stretch = (dist - spring.rest) * spring.k * alpha;
      const fx = (dx / dist) * stretch;
      const fy = (dy / dist) * stretch;
      spring.a.vx += fx;
      spring.a.vy += fy;
      spring.b.vx -= fx;
      spring.b.vy -= fy;
    }
    for (const body of bodyList) {
      body.vx -= body.x * 0.012 * alpha;
      body.vy -= body.y * 0.014 * alpha;
      body.vx *= 0.8;
      body.vy *= 0.8;
      body.x += body.vx;
      body.y += body.vy;
    }
    alpha *= 0.965;
    return true;
  };

  return { bodies, step, isSettled: () => alpha <= 0.02 };
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
    snapshot.restrictedMemoryGraph = await window.ClaraCoreDesktop.getMemoryGraph({ limit: 1000, includeRestricted: true, force: true });
  }
  activeMemoryGraphLayer = layer === "restricted" ? "restricted" : "primary";
  memoryGraphZoom = 1;
  memoryGraphPan = { x: 0, y: 0 };
  memoryGraphSelection = null;
  renderMemoryGraph();
}

function setMemoryGraphMode(mode) {
  const next = mode === "all" ? "all" : "network";
  if (next === memoryGraphMode) return;
  memoryGraphMode = next;
  memoryGraphZoom = 1;
  memoryGraphPan = { x: 0, y: 0 };
  memoryGraphSelection = null;
  renderMemoryGraph();
}

function selectMemoryGraphNode(nodeId) {
  memoryGraphSelection = nodeId || null;
  renderGraphSidePanel();
  drawMemoryGraphCanvas();
}

function stopMemoryGraphAnimation() {
  if (memoryGraphAnimation) {
    cancelAnimationFrame(memoryGraphAnimation);
    memoryGraphAnimation = null;
  }
}

function graphThemeColors(isDarkTheme) {
  return isDarkTheme
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
        label: "215, 159, 75",
        nodeStroke: "rgba(232, 242, 235, 0.58)",
        pillFill: "rgba(34, 41, 37, 0.92)",
        pillText: "#edf4ee",
        labelPillStroke: "rgba(215, 159, 75, 0.36)",
        sharedLinePillStroke: "rgba(121, 201, 164, 0.34)",
        linkKinds: {
          related: "99, 155, 215",
          causes: "176, 128, 224",
          "evolved-from": "215, 159, 75",
          contradicts: "214, 118, 101",
          "part-of": "121, 201, 164"
        }
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
        label: "189, 127, 40",
        nodeStroke: "rgba(255, 255, 255, 0.9)",
        pillFill: "rgba(255, 255, 252, 0.88)",
        pillText: "#202421",
        labelPillStroke: "rgba(189, 127, 40, 0.28)",
        sharedLinePillStroke: "rgba(40, 116, 90, 0.28)",
        linkKinds: {
          related: "54, 95, 132",
          causes: "122, 75, 176",
          "evolved-from": "189, 127, 40",
          contradicts: "166, 64, 54",
          "part-of": "40, 116, 90"
        }
      };
}

function drawMemoryGraphCanvas() {
  stopMemoryGraphAnimation();
  if (!memoryGraphState) return;
  const { canvas, model, sim } = memoryGraphState;
  if (!canvas || !canvas.isConnected) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
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

  const reducedMotion = document.body?.dataset?.motion === "off";
  if (!sim.isSettled()) {
    sim.step();
    sim.step();
  }

  const bodies = [...sim.bodies.values()];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const body of bodies) {
    if (body.x < minX) minX = body.x;
    if (body.x > maxX) maxX = body.x;
    if (body.y < minY) minY = body.y;
    if (body.y > maxY) maxY = body.y;
  }
  const boundsWidth = Math.max(60, maxX - minX);
  const boundsHeight = Math.max(60, maxY - minY);
  const boundsCenterX = (minX + maxX) / 2;
  const boundsCenterY = (minY + maxY) / 2;
  const fitScale = Math.min((rect.width * 0.84) / boundsWidth, (rect.height * 0.82) / boundsHeight, 2.6);
  const scale = fitScale * memoryGraphZoom;
  const centerX = rect.width / 2 + memoryGraphPan.x;
  const centerY = rect.height / 2 + memoryGraphPan.y;
  const project = (body) => ({
    x: centerX + (body.x - boundsCenterX) * scale,
    y: centerY + (body.y - boundsCenterY) * scale
  });

  canvas.dataset.zoom = String(memoryGraphZoom);
  canvas.dataset.panX = String(Math.round(memoryGraphPan.x));
  canvas.dataset.panY = String(Math.round(memoryGraphPan.y));

  const now = performance.now();
  const isDarkTheme = document.body?.dataset?.theme === "dark";
  const theme = graphThemeColors(isDarkTheme);
  const selection = memoryGraphSelection;
  const selectionNeighbors = selection ? model.neighborhood.get(selection) || new Set() : null;
  const nodeVisible = (nodeId) => !selection || nodeId === selection || selectionNeighbors.has(nodeId);

  const background = ctx.createRadialGradient(rect.width * 0.55, rect.height * 0.44, 40, rect.width * 0.55, rect.height * 0.44, Math.max(rect.width, rect.height) * 0.72);
  for (const [stop, color] of theme.backgroundStops) {
    background.addColorStop(stop, color);
  }
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, rect.width, rect.height);

  const hitEdges = [];
  const hitNodes = [];
  const hoveredEdge = memoryGraphHover?.type === "edge" ? memoryGraphHover.key : null;
  const edgeKey = (edge) => `${edge.from}->${edge.to}:${edge.kind}`;

  for (const edge of model.edges) {
    const a = sim.bodies.get(edge.from);
    const b = sim.bodies.get(edge.to);
    if (!a || !b) continue;
    const pa = project(a);
    const pb = project(b);
    const link = isLinkEdge(edge);
    const kind = link ? linkKindOf(edge) : edge.kind;
    const strength = Math.max(0.05, Math.min(1, Number(edge.strength) || 0.5));
    let color = theme.edge;
    let alpha = isDarkTheme ? 0.1 : 0.08;
    let width = 0.7;
    let dashed = false;
    let arrow = false;
    if (link) {
      color = theme.linkKinds[kind] || theme.memory;
      alpha = 0.38 + strength * 0.4;
      width = 1 + strength * 2.1;
      dashed = kind === "contradicts";
      arrow = kind === "causes" || kind === "evolved-from" || kind === "part-of";
    } else if (edge.kind === "uses") {
      color = theme.core;
      alpha = 0.2;
      width = 0.9;
    }
    const incident = !selection || edge.from === selection || edge.to === selection;
    if (!incident) alpha *= 0.08;
    const isHovered = hoveredEdge === edgeKey(edge);
    if (isHovered) {
      alpha = Math.min(1, alpha + 0.3);
      width += 0.9;
    }
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${color}, ${alpha})`;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (arrow && incident !== false) {
      const t = 0.62;
      const ax = pa.x + (pb.x - pa.x) * t;
      const ay = pa.y + (pb.y - pa.y) * t;
      const angle = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      const size = 4.5 + width;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color}, ${alpha})`;
      ctx.moveTo(ax + Math.cos(angle) * size, ay + Math.sin(angle) * size);
      ctx.lineTo(ax + Math.cos(angle + 2.5) * size, ay + Math.sin(angle + 2.5) * size);
      ctx.lineTo(ax + Math.cos(angle - 2.5) * size, ay + Math.sin(angle - 2.5) * size);
      ctx.closePath();
      ctx.fill();
    }
    if (link) {
      hitEdges.push({ key: edgeKey(edge), edge, ax: pa.x, ay: pa.y, bx: pb.x, by: pb.y });
    }
  }

  const nodeColor = (node) => {
    if (node.kind === "label") return `rgb(${theme.label})`;
    if (node.kind === "shared_line") return `rgb(${theme.core})`;
    if (node.sensitivity === "restricted") return `rgb(${theme.restricted})`;
    return `rgb(${theme.memory})`;
  };

  for (const body of bodies) {
    const node = body.node;
    const p = project(body);
    const phase = ((now / 1000) + (graphHash(node.id) % 900) / 1000) * Math.PI * 2 / 2.8;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(phase) * 0.045;
    const hasLinks = (model.linkDegree.get(node.id) || 0) > 0;
    const radius = Math.max(2.2, body.size * pulse * (hasLinks ? 1.25 : 0.85)) * Math.min(1.5, Math.max(0.75, scale / fitScale));
    const visible = nodeVisible(node.id);
    const baseAlpha = node.kind === "memory" ? (hasLinks ? 0.92 : 0.5) : 0.85;
    const alpha = visible ? baseAlpha : 0.1;
    if ((hasLinks || node.kind !== "memory") && visible) {
      ctx.beginPath();
      ctx.fillStyle = node.kind === "label"
        ? `rgba(${theme.label}, 0.12)`
        : node.kind === "shared_line"
          ? `rgba(${theme.core}, 0.14)`
          : `rgba(${theme.memory}, 0.12)`;
      ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = nodeColor(node);
    ctx.strokeStyle = theme.nodeStroke;
    ctx.lineWidth = node.id === selection ? 2 : 0.9;
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (node.id === selection) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${theme.core}, 0.8)`;
      ctx.lineWidth = 1.4;
      ctx.arc(p.x, p.y, radius + 5.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    hitNodes.push({ id: node.id, x: p.x, y: p.y, r: Math.max(radius + 3, 7) });
  }

  ctx.font = "620 10.5px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
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
    const cornerRadius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + cornerRadius, y);
    ctx.arcTo(x + w, y, x + w, y + h, cornerRadius);
    ctx.arcTo(x + w, y + h, x, y + h, cornerRadius);
    ctx.arcTo(x, y + h, x, y, cornerRadius);
    ctx.arcTo(x, y, x + w, y, cornerRadius);
    ctx.closePath();
  };

  const pillCandidates = [];
  const hoveredNode = memoryGraphHover?.type === "node" ? memoryGraphHover.key : null;
  for (const body of bodies) {
    const node = body.node;
    if (!nodeVisible(node.id)) continue;
    const linkCount = model.linkDegree.get(node.id) || 0;
    const isFocus = node.id === selection || node.id === hoveredNode || (selection && selectionNeighbors.has(node.id));
    const isHub = node.kind !== "memory" ? (model.degree.get(node.id) || 0) > 2 : linkCount > 0;
    if (!isFocus && !isHub) continue;
    pillCandidates.push({ body, node, rank: (isFocus ? 100 : 0) + linkCount + (model.degree.get(node.id) || 0) / 10 });
  }
  pillCandidates.sort((left, right) => right.rank - left.rank);
  const placedPills = [];
  let pillsDrawn = 0;
  for (const { body, node } of pillCandidates) {
    if (pillsDrawn >= 22) break;
    const p = project(body);
    if (p.x < -40 || p.y < -20 || p.x > rect.width + 40 || p.y > rect.height + 20) continue;
    const text = truncateCanvasText(labelForNode(node), 118);
    const textWidth = ctx.measureText(text).width;
    const pillWidth = Math.min(140, textWidth + 18);
    const pillHeight = 20;
    let x = Math.min(rect.width - pillWidth - 8, Math.max(8, p.x + 12));
    let y = Math.min(rect.height - pillHeight - 8, Math.max(8, p.y - pillHeight - 8));
    let overlaps = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      overlaps = placedPills.some((box) =>
        x < box.x + box.w + 6 && x + pillWidth + 6 > box.x && y < box.y + box.h + 5 && y + pillHeight + 5 > box.y
      );
      if (!overlaps) break;
      y = Math.min(rect.height - pillHeight - 8, Math.max(8, y + pillHeight + 6));
    }
    if (overlaps) continue;
    placedPills.push({ x, y, w: pillWidth, h: pillHeight });
    pillsDrawn += 1;
    roundRect(x, y, pillWidth, pillHeight, 10);
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = theme.pillFill;
    ctx.fill();
    ctx.strokeStyle = node.kind === "label" ? theme.labelPillStroke : theme.sharedLinePillStroke;
    ctx.lineWidth = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.pillText;
    ctx.fillText(text, x + 9, y + pillHeight / 2);
  }

  memoryGraphState.hitEdges = hitEdges;
  memoryGraphState.hitNodes = hitNodes;

  if (!sim.isSettled() || !reducedMotion) {
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
  memoryAllHint.textContent = t("memory.list.sample", {
    shown: snapshot?.memories?.length || 0,
    total: stats.activeCount ?? 0
  });
  const maintenanceDetails = document.querySelector("#memoryMaintenanceDetails");
  if (maintenanceDetails) {
    const vectorIssues = Number(stats.pendingEmbeddingCount || 0) + Number(stats.failedEmbeddingCount || 0);
    if (vectorIssues > 0) maintenanceDetails.open = true;
  }
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

function graphNodeById(nodeId) {
  if (!memoryGraphState) return null;
  return memoryGraphState.model.nodes.find((node) => node.id === nodeId) || null;
}

function linkKindLabel(kind) {
  const key = `memory.graph.link.${kind}`;
  const text = t(key);
  return text === key ? kind : text;
}

function renderGraphSidePanel() {
  const panel = document.querySelector("#memoryGraphPanel");
  if (!panel || !memoryGraphState) return;
  const { model } = memoryGraphState;
  const selection = memoryGraphSelection ? graphNodeById(memoryGraphSelection) : null;
  if (!selection) {
    const kindCounts = new Map();
    for (const edge of model.edges) {
      if (!isLinkEdge(edge)) continue;
      const kind = linkKindOf(edge);
      kindCounts.set(kind, (kindCounts.get(kind) || 0) + 1);
    }
    const legendRows = [...kindCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(
        ([kind, count]) => `
          <div class="graph-legend-row">
            <span class="graph-legend-swatch kind-${escapeHtml(kind)}"></span>
            <span>${escapeHtml(linkKindLabel(kind))}</span>
            <strong>${count}</strong>
          </div>
        `
      )
      .join("");
    panel.innerHTML = `
      <div class="graph-panel-hint">${escapeHtml(t("memory.graph.panel.empty"))}</div>
      ${legendRows ? `<div class="graph-legend">${legendRows}</div>` : ""}
      ${model.effectiveMode === "all" && memoryGraphMode === "network" ? `<div class="graph-panel-hint subtle">${escapeHtml(t("memory.graph.networkEmpty"))}</div>` : ""}
    `;
    return;
  }
  const incident = model.edges.filter(
    (edge) => isLinkEdge(edge) && (edge.from === selection.id || edge.to === selection.id)
  );
  const rows = incident
    .map((edge) => {
      const otherId = edge.from === selection.id ? edge.to : edge.from;
      const other = graphNodeById(otherId);
      const strength = Math.max(0.05, Math.min(1, Number(edge.strength) || 0.5));
      const kind = linkKindOf(edge);
      return `
        <button class="graph-panel-link" data-graph-select="${escapeHtml(otherId)}">
          <span class="graph-panel-link-head">
            <span class="graph-legend-swatch kind-${escapeHtml(kind)}"></span>
            <span class="graph-panel-kind">${escapeHtml(linkKindLabel(kind))}</span>
            <span class="graph-panel-strength" style="--link-strength: ${Math.round(strength * 100)}%"></span>
          </span>
          <strong>${escapeHtml(other?.label || otherId)}</strong>
          ${edge.note ? `<em>${escapeHtml(edge.note)}</em>` : ""}
        </button>
      `;
    })
    .join("");
  panel.innerHTML = `
    <div class="graph-panel-title">${escapeHtml(selection.label || selection.id)}</div>
    <div class="graph-panel-subtitle">${escapeHtml(t("memory.graph.panel.title"))} · ${incident.length}</div>
    ${rows || `<div class="graph-panel-hint subtle">${escapeHtml(t("memory.graph.panel.noLinks"))}</div>`}
  `;
}

function graphHitTest(clientX, clientY) {
  if (!memoryGraphState?.canvas) return null;
  const rect = memoryGraphState.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  for (const hit of memoryGraphState.hitNodes || []) {
    const dx = x - hit.x;
    const dy = y - hit.y;
    if (dx * dx + dy * dy <= hit.r * hit.r) return { type: "node", key: hit.id };
  }
  let best = null;
  for (const hit of memoryGraphState.hitEdges || []) {
    const abx = hit.bx - hit.ax;
    const aby = hit.by - hit.ay;
    const lengthSq = abx * abx + aby * aby;
    if (lengthSq < 1) continue;
    const tSeg = Math.max(0, Math.min(1, ((x - hit.ax) * abx + (y - hit.ay) * aby) / lengthSq));
    const px = hit.ax + abx * tSeg;
    const py = hit.ay + aby * tSeg;
    const dx = x - px;
    const dy = y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 6 && (!best || dist < best.dist)) {
      best = { type: "edge", key: hit.key, edge: hit.edge, dist, x: px, y: py };
    }
  }
  return best;
}

function updateGraphTooltip(hit, clientX, clientY) {
  const tooltip = document.querySelector("#memoryGraphTooltip");
  if (!tooltip || !memoryGraphState?.canvas) return;
  if (!hit || hit.type !== "edge") {
    tooltip.classList.remove("visible");
    return;
  }
  const edge = hit.edge;
  const kind = linkKindOf(edge);
  const strength = Math.max(0.05, Math.min(1, Number(edge.strength) || 0.5));
  tooltip.innerHTML = `
    <strong>${escapeHtml(linkKindLabel(kind))} · ${Math.round(strength * 100)}%</strong>
    ${edge.note ? `<span>${escapeHtml(edge.note)}</span>` : ""}
  `;
  const wrapper = memoryGraphState.canvas.parentElement.getBoundingClientRect();
  tooltip.style.left = `${Math.min(wrapper.width - 230, Math.max(6, clientX - wrapper.left + 14))}px`;
  tooltip.style.top = `${Math.max(6, clientY - wrapper.top - 12)}px`;
  tooltip.classList.add("visible");
}

function bindGraphCanvasEvents(canvas) {
  canvas.addEventListener("mousemove", (event) => {
    if (memoryGraphDrag) return;
    const hit = graphHitTest(event.clientX, event.clientY);
    const key = hit ? `${hit.type}:${hit.key}` : null;
    const previous = memoryGraphHover ? `${memoryGraphHover.type}:${memoryGraphHover.key}` : null;
    memoryGraphHover = hit ? { type: hit.type, key: hit.key } : null;
    canvas.style.cursor = hit ? "pointer" : "grab";
    updateGraphTooltip(hit, event.clientX, event.clientY);
    if (key !== previous && !memoryGraphAnimation) drawMemoryGraphCanvas();
  });
  canvas.addEventListener("mouseleave", () => {
    memoryGraphHover = null;
    updateGraphTooltip(null);
  });
  canvas.addEventListener("click", (event) => {
    if (memoryGraphDragMoved) return;
    const hit = graphHitTest(event.clientX, event.clientY);
    if (hit?.type === "node") {
      selectMemoryGraphNode(hit.key === memoryGraphSelection ? null : hit.key);
    } else if (!hit) {
      if (memoryGraphSelection) selectMemoryGraphNode(null);
    }
  });
}

function renderMemoryGraph() {
  syncSnapshot();
  const graph = activeMemoryGraphLayer === "restricted" ? snapshot?.restrictedMemoryGraph || {} : snapshot?.memoryGraph || {};
  const allNodes = graph.nodes || [];
  const allEdges = graph.edges || [];
  if (allNodes.length === 0 || allEdges.length === 0) {
    stopMemoryGraphAnimation();
    memoryGraphState = null;
    memoryGraphSummary.textContent = t("memory.graph.summary", { nodes: 0, edges: 0 });
    memoryGraph.innerHTML = `<div class="endpoint-empty">${t("memory.graph.empty")}</div>`;
    return;
  }
  const model = buildGraphModel(graph, memoryGraphMode);
  memoryGraphSummary.textContent = t("memory.graph.summary", {
    nodes: model.nodes.length,
    edges: model.edges.length
  });
  if (memoryGraphSelection && !model.nodes.some((node) => node.id === memoryGraphSelection)) {
    memoryGraphSelection = null;
  }
  stopMemoryGraphAnimation();
  memoryGraph.innerHTML = `
    <div class="graph-toolbar">
      <div>
        <button class="graph-layer ${memoryGraphMode === "network" ? "active" : ""}" data-graph-mode="network">${escapeHtml(t("memory.graph.mode.network"))}</button>
        <button class="graph-layer ${memoryGraphMode === "all" ? "active" : ""}" data-graph-mode="all">${escapeHtml(t("memory.graph.mode.all"))}</button>
      </div>
      <div>
        <button class="graph-layer ${activeMemoryGraphLayer === "primary" ? "active" : ""}" data-graph-layer="primary">${escapeHtml(t("memory.graph.primaryLayer"))}</button>
        <button class="graph-layer ${activeMemoryGraphLayer === "restricted" ? "active restricted" : ""}" data-graph-layer="restricted">${escapeHtml(t("memory.graph.restrictedLayer"))}</button>
      </div>
      <div class="graph-zoom-controls">
        <button class="secondary" data-graph-zoom="out" aria-label="${escapeHtml(t("memory.graph.zoomOut"))}">−</button>
        <button class="secondary" data-graph-zoom="fit">${escapeHtml(t("memory.graph.fit"))}</button>
        <button class="secondary" data-graph-zoom="in" aria-label="${escapeHtml(t("memory.graph.zoomIn"))}">+</button>
      </div>
      <strong>${escapeHtml(t("memory.graph.summary", { nodes: model.nodes.length, edges: model.edges.length }))}</strong>
    </div>
    <div class="graph-body">
      <div class="graph-canvas">
        <canvas id="memoryGraphCanvas" data-mode="${escapeHtml(model.effectiveMode)}" data-node-count="${model.nodes.length}" data-edge-count="${model.edges.length}" data-link-count="${model.linkEdgeCount}" data-restricted-count="${model.nodes.filter((node) => node.sensitivity === "restricted").length}" aria-label="${escapeHtml(t("memory.graph.title"))}"></canvas>
        <div id="memoryGraphTooltip" class="graph-tooltip"></div>
      </div>
      <aside id="memoryGraphPanel" class="graph-side-panel"></aside>
    </div>
  `;
  const canvas = document.querySelector("#memoryGraphCanvas");
  memoryGraphState = {
    canvas,
    model,
    sim: createForceLayout(model),
    hitEdges: [],
    hitNodes: []
  };
  bindGraphCanvasEvents(canvas);
  renderGraphSidePanel();
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
    memoryGraphDragMoved = false;
    memoryGraph.classList.add("dragging");
  }

  function moveGraphDrag(event) {
    if (!memoryGraphDrag) return;
    const deltaX = event.clientX - memoryGraphDrag.x;
    const deltaY = event.clientY - memoryGraphDrag.y;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) memoryGraphDragMoved = true;
    memoryGraphPan = { x: memoryGraphDrag.startPan.x + deltaX, y: memoryGraphDrag.startPan.y + deltaY };
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
    searchMemoryLabel, selectMemoryGraphNode, setActiveAgentFilter, setActiveTab, setMemoryGraphLayer, setMemoryGraphMode,
    setMemoryGraphZoom
  };
}

window.createClaraCoreMemoriaView = createClaraCoreMemoriaView;
