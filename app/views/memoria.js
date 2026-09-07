function createClaraCoreMemoriaView(context) {
  const {
    dom,
    t,
    getSnapshot,
    getSnapshotGeneration = () => 0,
    escapeHtml,
    renderMarkdownPreview,
    formatLocalDateTime,
    refreshRuntimeSnapshotOnly,
    appendLiveLogLine,
    setEmbeddingProgress
  } = context;
  const {
    memorySearchInput, searchMemory, memoryList, memoryDetail, memoryAgentFilter, memoryRecentTitle,
    memoryGraphSummary, memoryGraph, memoryAllLabelList, memoryAllHint, memoryTabs, memoryTabPanels,
    memoryOverviewCount, memoryTopicList, memoryProcessFlow, memoryAllAction,
    memoryRecallStatus, memoryRecallList, memoryAllRecallAction,
    memoryDetailDialog, memoryDetailBack, memoryDetailClose, memoryDetailKicker,
    memoryDetailDialogTitle, memoryDetailMeta, memoryLibraryFooter, memoryLibraryLoadMore,
    memoryRecallDetail, memoryKnowledgeWorkbench
  } = dom;

  let activeMemoryTab = "labels";
  let memoryGraphZoom = 1;
  let memoryGraphPan = { x: 0, y: 0 };
  let memoryGraphState = null;
  let memoryGraphAnimation = null;
  let memoryGraphDrag = null;
  let memoryGraphDragMoved = false;
  let memoryGraphMode = "all";
  let memoryGraphSelection = null;
  let memoryGraphHover = null;
  let activeMemoryGraphLayer = "primary";
  let memoryEmbeddingBatchRunning = false;
  let activeMemoryAgentFilter = "";
  let selectedMemoryId = "";
  let visibleMemories = [];
  let searchActive = false;
  let dialogTrigger = null;
  let dialogMode = "";
  let dialogBackMode = "";
  let memoryPageRequestSequence = 0;
  const loadedMemoryTabs = { all: false, graph: false };
  const memoryPaging = { pageSize: 20, all: { loaded: 0, hasMore: true } };
  let snapshot = null;
  const memoryHydration = window.createClaraCoreMemoryHydrationCoordinator({
    getGeneration: getSnapshotGeneration,
    getSnapshot
  });

  function syncSnapshot() {
    snapshot = getSnapshot();
    return snapshot;
  }

  const memoryListRenderer = window.createClaraCoreMemoriaList({
    t,
    escapeHtml,
    renderMarkdownPreview,
    formatLocalDateTime
  });
  const {
    filterByAgent,
    memoryAgentId,
    renderAgentFilter,
    renderMemoryBody,
    renderMemoryLabelsInline,
    vectorMaintenanceCount
  } = memoryListRenderer;

function selectedMemory() {
  return visibleMemories.find((memory) => memory.id === selectedMemoryId) || null;
}

function renderMemoryDetail(memory = selectedMemory()) {
  if (!memoryDetail) return;
  if (!memory) {
    memoryDetail.innerHTML = `<div class="memory-detail-empty"><strong>${escapeHtml(t("memory.detail.emptyTitle"))}</strong><p>${escapeHtml(t("memory.detail.emptyBody"))}</p></div>`;
    return;
  }
  const agentId = memoryAgentId(memory);
  const labels = (memory.labels || []).filter((label) => {
    const value = String(label || "");
    return !value.startsWith("agent-id:") && !value.startsWith("agent:") && !value.startsWith("tool:");
  });
  const timestamp = memory.updated_at || memory.created_at;
  memoryDetail.innerHTML = `
    <div class="memory-detail-content">
      <div class="memory-detail-section">
        <span>${escapeHtml(t("memory.detail.content"))}</span>
        <h3>${escapeHtml(memory.title || t("memory.form.body"))}</h3>
        <div class="memory-detail-body">${renderMemoryBody(memory.body || "")}</div>
      </div>
      <dl class="memory-detail-facts">
        ${agentId ? `<div><dt>${escapeHtml(t("memory.detail.agent"))}</dt><dd>${escapeHtml(agentId)}</dd></div>` : ""}
        ${timestamp ? `<div><dt>${escapeHtml(memory.updated_at && memory.updated_at !== memory.created_at ? t("memory.detail.updated") : t("memory.detail.created"))}</dt><dd>${escapeHtml(formatLocalDateTime(timestamp))}</dd></div>` : ""}
        ${labels.length ? `<div><dt>${escapeHtml(t("memory.detail.labels"))}</dt><dd class="memory-detail-labels">${renderMemoryLabelsInline(labels)}</dd></div>` : ""}
      </dl>
    </div>
  `;
}

function memoryControllerModeLabel(mode) {
  if (mode === "canary") return "受信回召已开启";
  if (mode === "observe") return "观察模式：记录判断结果";
  return "自动回召已关闭";
}

function recallReasonLabel(reason) {
  const labels = {
    controller_disabled: "自动回召已关闭",
    memory_opt_out: "当前请求关闭历史记忆",
    current_turn_instruction: "当前指令独立执行",
    ordinary_current_turn: "当前内容可独立处理",
    explicit_history_request: "这次明确询问过去发生的事",
    continuation_request: "这次需要继续之前的工作",
    stable_preference_request: "这次可能需要长期偏好",
    prior_decision_request: "这次可能需要以前的决定",
    reusable_knowledge_request: "这次可能需要复用以前的方法",
    no_candidates: "没有找到候选记忆",
    restricted_result: "候选记忆受访问限制",
    ineligible_result: "候选记忆已失效或不属于当前范围",
    low_relevance: "相关度没有达到可信门槛",
    ambiguous_top_results: "前两条过于接近，无法可靠选择",
    context_budget_exceeded: "可用上下文空间不足",
    high_confidence_top1: "第一条相关度足够高，并明显领先第二条"
  };
  return labels[String(reason || "")] || reason || "没有记录原因";
}

function recallVerdict(event) {
  if ((event.injectedIds || []).length) return { tone: "returned", title: "已返回给智能体", body: "这条记忆进入了只读上下文；是否真的用于回答仍需后续反馈证明。" };
  if (event.stageB?.action === "INJECT_TOP1" && event.policyMode === "observe") return { tone: "observed", title: "相关，但仅观察", body: "相关性判断通过了；当前模式没有把记忆返回给智能体。" };
  if (event.stageA?.action === "NOOP") return { tone: "quiet", title: "没有启动检索", body: recallReasonLabel(event.stageA?.reason) };
  return { tone: "abstained", title: "已检索，但没有返回", body: recallReasonLabel(event.stageB?.reason || event.stageA?.reason) };
}

function renderRecallEvent(event, compact = false) {
  const verdict = recallVerdict(event);
  const candidates = Array.isArray(event.candidates) ? event.candidates : [];
  if (compact) {
    return `<button type="button" class="memory-recall-row is-${verdict.tone}" data-memory-decision-id="${escapeHtml(event.id)}">
      <span class="memory-recall-node" aria-hidden="true"></span>
      <span><strong>${escapeHtml(event.queryPreview || "未记录对话摘要")}</strong><small>${escapeHtml(verdict.title)} · ${escapeHtml(formatLocalDateTime(event.createdAt))}</small></span>
      <span aria-hidden="true">→</span>
    </button>`;
  }
  return `<article class="memory-recall-event-detail">
    <section><span>这次对话</span><h3>${escapeHtml(event.queryPreview || "未记录对话摘要")}</h3><p>${escapeHtml(formatLocalDateTime(event.createdAt))} · ${escapeHtml(event.agentId || "-")}</p></section>
    <div class="memory-decision-path">
      <div><span>1</span><strong>${event.stageA?.action === "RETRIEVE" ? "判断需要查找记忆" : "跳过记忆检索"}</strong><p>${escapeHtml(recallReasonLabel(event.stageA?.reason))}</p></div>
      <div><span>2</span><strong>${candidates.length ? `找到 ${candidates.length} 条候选` : "没有候选记忆"}</strong><p>${escapeHtml(event.cacheStatus === "hit" ? "使用了仍然有效的检索缓存" : "重新执行了记忆检索")}</p></div>
      <div><span>3</span><strong>${escapeHtml(verdict.title)}</strong><p>${escapeHtml(verdict.body)}</p></div>
    </div>
    ${candidates.length ? `<section class="memory-candidate-list"><h3>相关性候选</h3>${candidates.map((candidate, index) => `<div class="memory-candidate-row"><span>${index + 1}</span><div><strong>${escapeHtml(candidate.title || candidate.id)}</strong><small>${escapeHtml(candidate.source === "keyword+vector" ? "关键词 + 语义" : candidate.source === "vector" ? "语义相似" : "关键词命中")} · 相关分 ${Math.round(Number(candidate.score || 0) * 100)}%</small></div></div>`).join("")}</section>` : ""}
    <p class="memory-evidence-boundary">证据分为候选、通过门槛、返回、送达和使用；各阶段的实际记录证明对应影响。</p>
  </article>`;
}

function setMemoryDialogPane(mode) {
  if (memoryDetail) memoryDetail.hidden = !["memory", "library"].includes(mode);
  if (memoryLibraryFooter) memoryLibraryFooter.hidden = mode !== "library";
  if (memoryRecallDetail) memoryRecallDetail.hidden = mode !== "recall";
  if (memoryKnowledgeWorkbench) memoryKnowledgeWorkbench.hidden = !["labels", "graph"].includes(mode);
}

function renderMemoryLibrary() {
  const total = snapshot?.memoryStats?.activeCount ?? visibleMemories.length;
  memoryDetailKicker.textContent = "MEMORY LIBRARY";
  memoryDetailDialogTitle.textContent = searchActive ? "搜索结果" : "最近载入的长期记忆";
  memoryDetailMeta.textContent = searchActive
    ? `找到 ${visibleMemories.length} 条 · 点击任一条阅读全文`
    : `当前载入 ${visibleMemories.length}${activeMemoryAgentFilter ? "" : ` / ${total}`} 条 · 点击任一条阅读全文`;
  memoryDetail.innerHTML = `<div id="memoryDialogLibrary" class="memory-dialog-library"></div>`;
  memoryListRenderer.renderMemoryResults(visibleMemories, memoryDetail.querySelector("#memoryDialogLibrary"));
  if (memoryLibraryFooter) memoryLibraryFooter.hidden = searchActive || !memoryPaging.all.hasMore;
}

function openMemoryDialog(mode, options = {}) {
  if (!memoryDetailDialog) return;
  if (!memoryDetailDialog.open) dialogTrigger = options.trigger || document.activeElement;
  dialogMode = mode;
  dialogBackMode = options.backMode || "";
  setMemoryDialogPane(mode);
  memoryDetailBack.hidden = !dialogBackMode;
  if (mode === "memory") {
    const memory = selectedMemory();
    memoryDetailKicker.textContent = "MEMORY";
    memoryDetailDialogTitle.textContent = memory?.title || "记忆详情";
    memoryDetailMeta.textContent = "完整内容与持久化依据";
    renderMemoryDetail(memory);
  } else if (mode === "library") {
    renderMemoryLibrary();
  } else if (mode === "recall") {
    const events = getSnapshot()?.memoryController?.recent || [];
    const selected = options.decisionId ? events.filter((event) => event.id === options.decisionId) : events;
    memoryDetailKicker.textContent = "RECALL EVIDENCE";
    memoryDetailDialogTitle.textContent = options.decisionId ? "一次回召为什么这样判断" : "最近的回召判断依据";
    memoryDetailMeta.textContent = options.decisionId ? "从是否需要记忆，到相关性候选，再到是否真实返回" : `最近 ${events.length} 次判断`;
    memoryRecallDetail.innerHTML = selected.length ? selected.map((event) => renderRecallEvent(event)).join("") : `<div class="memory-detail-empty"><strong>还没有回召判断</strong><p>发生相关对话后，这里会显示真实判断证据。</p></div>`;
  } else {
    memoryDetailKicker.textContent = "CONNECTIONS";
    memoryDetailDialogTitle.textContent = mode === "graph" ? "关系与状态链" : "主题与标签";
    memoryDetailMeta.textContent = mode === "graph" ? "关系用于解释记忆连接；回召结果以事件证据为准" : "标签用于组织和缩小检索范围";
    activeMemoryTab = mode;
    renderMemoryTabs();
    loadMemoryTabData(mode).catch(console.error);
  }
  if (!memoryDetailDialog.open) memoryDetailDialog.showModal();
}

function renderMemoryResults(memories, target = memoryList, options = {}) {
  if (target !== memoryList) {
    memoryListRenderer.renderMemoryResults(memories, target, options);
    return;
  }
  visibleMemories = memories || [];
  if (!visibleMemories.some((memory) => memory.id === selectedMemoryId)) {
    selectedMemoryId = visibleMemories[0]?.id || "";
  }
  const displayed = searchActive ? visibleMemories : visibleMemories.slice(0, 6);
  memoryListRenderer.renderMemoryResults(displayed, memoryList, { ...options, selectedId: selectedMemoryId });
  if (searchActive && memoryAllHint) {
    memoryAllHint.textContent = visibleMemories.length
      ? t("memory.search.resultCount", { count: visibleMemories.length })
      : options.emptyMessage || t("memory.search.noReliable", { query: "" });
  }
  if (memoryAllAction) {
    memoryAllAction.hidden = searchActive || visibleMemories.length <= displayed.length;
    memoryAllAction.textContent = `查看最近载入的 ${visibleMemories.length} 条记忆 →`;
  }
  if (dialogMode === "library" && memoryDetailDialog?.open) renderMemoryLibrary();
  else renderMemoryDetail();
}

function renderMemoryList() {
  syncSnapshot();
  const memories = snapshot?.memories || snapshot?.recentMemories || [];
  renderMemoryResults(filterByAgent(memories, activeMemoryAgentFilter, memoryAgentId));
}

function selectMemory(memoryId, options = {}) {
  if (!visibleMemories.some((memory) => memory.id === memoryId)) return;
  selectedMemoryId = memoryId;
  const displayed = searchActive ? visibleMemories : visibleMemories.slice(0, 6);
  memoryListRenderer.renderMemoryResults(displayed, memoryList, { selectedId: selectedMemoryId });
  renderMemoryDetail();
  if (options.focus) memoryList.querySelector(`[data-memory-id="${CSS.escape(memoryId)}"]`)?.focus();
  if (options.open !== false) openMemoryDialog("memory", { trigger: options.trigger || document.activeElement, backMode: options.backMode || "" });
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

function loadMemoryTabData(tabName, options = {}) {
  const targetSnapshot = syncSnapshot();
  if (!targetSnapshot) {
    return Promise.resolve({ applied: false, skipped: true, stale: false });
  }
  const force = Boolean(options.force);
  const append = Boolean(options.append);
  if ((tabName === "all" || tabName === "search") && (force || append || !loadedMemoryTabs.all)) {
    const offset = append ? visibleMemories.length : 0;
    const requestAgentId = activeMemoryAgentFilter;
    const baseRows = append ? [...visibleMemories] : [];
    const requestSequence = ++memoryPageRequestSequence;
    return window.ClaraCoreDesktop.getMemories({
        limit: memoryPaging.pageSize,
        offset,
        agentId: requestAgentId
      })
      .then((rows) => {
        if (requestSequence !== memoryPageRequestSequence || requestAgentId !== activeMemoryAgentFilter) {
          return { applied: false, stale: true };
        }
        const requestSnapshot = syncSnapshot();
        if (!requestSnapshot) return { applied: false, stale: true };
        const merged = append ? [...baseRows, ...rows] : rows;
        const seen = new Set();
        requestSnapshot.memories = merged.filter((memory) => {
          const id = String(memory?.id || "");
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        snapshot = requestSnapshot;
        memoryPaging.all.loaded = requestSnapshot.memories.length;
        memoryPaging.all.hasMore = rows.length === memoryPaging.pageSize
          && (Boolean(requestAgentId) || memoryPaging.all.loaded < (requestSnapshot?.memoryStats?.activeCount ?? 0));
        loadedMemoryTabs.all = true;
        renderMemoryResults(filterByAgent(requestSnapshot.memories, activeMemoryAgentFilter, memoryAgentId));
        memoryAllHint.textContent = t("memory.list.sample", {
          shown: requestSnapshot.memories.length,
          total: requestSnapshot?.memoryStats?.activeCount ?? 0
        });
        if (dialogMode === "library" && memoryDetailDialog?.open) renderMemoryLibrary();
        return { applied: true, stale: false };
      });
  }
  if (tabName === "graph" && (force || !loadedMemoryTabs.graph)) {
    return memoryHydration.run("graph", {
      force,
      load: () => window.ClaraCoreDesktop.getMemoryGraph({ limit: 400 }),
      apply: (graph, requestSnapshot) => {
        requestSnapshot.memoryGraph = graph;
        snapshot = requestSnapshot;
        loadedMemoryTabs.graph = true;
        renderMemoryGraph();
      }
    });
  }
  return Promise.resolve({ applied: false, skipped: true, stale: false });
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

function graphAgentColor(agentId, isDarkTheme = false) {
  const palette = isDarkTheme
    ? ["104, 177, 235", "190, 135, 229", "91, 202, 194", "225, 126, 184", "83, 190, 220", "139, 148, 235"]
    : ["43, 105, 166", "126, 75, 169", "31, 132, 126", "154, 72, 127", "28, 135, 166", "75, 85, 173"];
  const id = String(agentId || "").trim();
  return id ? palette[graphHash(id) % palette.length] : "";
}

function isLinkEdge(edge) {
  return String(edge?.kind || "").startsWith("link:");
}

function linkKindOf(edge) {
  return String(edge?.kind || "").slice(5);
}

function buildGraphModel(graph, mode, selectedNodeId = null) {
  const allNodes = graph.nodes || [];
  const allEdges = graph.edges || [];
  const linkEdges = allEdges.filter(isLinkEdge);
  const stateEdges = linkEdges.filter((edge) => linkKindOf(edge) === "supersedes");
  const effectiveMode = mode === "state"
    ? "state"
    : mode === "network" && linkEdges.length > 0
      ? "network"
      : "all";

  let nodes;
  let edges;
  let stateChains = [];
  let activeStateChainId = null;
  let networkClusters = [];
  let activeNetworkClusterId = null;
  if (effectiveMode === "state") {
    const stateNodeIds = new Set(stateEdges.flatMap((edge) => [edge.from, edge.to]));
    const contradictionEdges = linkEdges.filter(
      (edge) => linkKindOf(edge) === "contradicts" && (stateNodeIds.has(edge.from) || stateNodeIds.has(edge.to))
    );
    const stateGraphEdges = [...stateEdges, ...contradictionEdges];
    const adjacency = new Map();
    const connect = (from, to) => {
      if (!adjacency.has(from)) adjacency.set(from, new Set());
      adjacency.get(from).add(to);
    };
    for (const edge of stateGraphEdges) {
      connect(edge.from, edge.to);
      connect(edge.to, edge.from);
    }
    const nodeById = new Map(allNodes.map((node) => [node.id, node]));
    const remaining = new Set(stateNodeIds);
    while (remaining.size > 0) {
      const [start] = remaining;
      const componentIds = new Set();
      const queue = [start];
      while (queue.length > 0) {
        const id = queue.shift();
        if (componentIds.has(id)) continue;
        componentIds.add(id);
        remaining.delete(id);
        for (const neighbor of adjacency.get(id) || []) queue.push(neighbor);
      }
      const componentEdges = stateGraphEdges.filter(
        (edge) => componentIds.has(edge.from) && componentIds.has(edge.to)
      );
      const currentNodes = [...componentIds]
        .map((id) => nodeById.get(id))
        .filter((node) => node && node.status !== "superseded")
        .sort((left, right) => String(left.label || left.id).localeCompare(String(right.label || right.id)));
      const focusNode = currentNodes[0] || nodeById.get(start);
      stateChains.push({
        id: focusNode?.id || start,
        label: focusNode?.label || focusNode?.id || start,
        nodeIds: [...componentIds],
        nodeCount: componentIds.size,
        edgeCount: componentEdges.filter((edge) => linkKindOf(edge) === "supersedes").length
      });
    }
    stateChains.sort((left, right) => right.edgeCount - left.edgeCount || String(left.label).localeCompare(String(right.label)));
    const activeChain = stateChains.find((chain) => chain.nodeIds.includes(selectedNodeId)) || stateChains[0];
    activeStateChainId = activeChain?.id || null;
    const keep = new Set(activeChain?.nodeIds || []);
    nodes = allNodes.filter((node) => keep.has(node.id) && node.kind === "memory");
    edges = stateGraphEdges.filter((edge) => keep.has(edge.from) && keep.has(edge.to));
  } else if (effectiveMode === "network") {
    const nodeById = new Map(allNodes.filter((node) => node.kind === "memory").map((node) => [node.id, node]));
    const usableEdges = linkEdges.filter((edge) => nodeById.has(edge.from) && nodeById.has(edge.to));
    const adjacency = new Map();
    const connect = (from, to) => {
      if (!adjacency.has(from)) adjacency.set(from, new Set());
      adjacency.get(from).add(to);
    };
    for (const edge of usableEdges) {
      connect(edge.from, edge.to);
      connect(edge.to, edge.from);
    }
    const remaining = new Set(usableEdges.flatMap((edge) => [edge.from, edge.to]));
    while (remaining.size > 0) {
      const [start] = remaining;
      const componentIds = new Set();
      const queue = [start];
      while (queue.length > 0) {
        const id = queue.shift();
        if (componentIds.has(id)) continue;
        componentIds.add(id);
        remaining.delete(id);
        for (const neighbor of adjacency.get(id) || []) queue.push(neighbor);
      }
      const componentEdges = usableEdges.filter(
        (edge) => componentIds.has(edge.from) && componentIds.has(edge.to)
      );
      const localDegree = new Map();
      for (const edge of componentEdges) {
        localDegree.set(edge.from, (localDegree.get(edge.from) || 0) + 1);
        localDegree.set(edge.to, (localDegree.get(edge.to) || 0) + 1);
      }
      const focusNode = [...componentIds]
        .map((id) => nodeById.get(id))
        .filter(Boolean)
        .sort((left, right) =>
          (localDegree.get(right.id) || 0) - (localDegree.get(left.id) || 0)
            || String(left.label || left.id).localeCompare(String(right.label || right.id))
        )[0];
      networkClusters.push({
        id: focusNode?.id || start,
        label: focusNode?.label || focusNode?.id || start,
        nodeIds: [...componentIds],
        nodeCount: componentIds.size,
        edgeCount: componentEdges.length
      });
    }
    networkClusters.sort((left, right) =>
      right.edgeCount - left.edgeCount
        || right.nodeCount - left.nodeCount
        || String(left.label).localeCompare(String(right.label))
    );
    const activeCluster = networkClusters.find((cluster) => cluster.nodeIds.includes(selectedNodeId)) || networkClusters[0];
    activeNetworkClusterId = activeCluster?.id || null;
    const keep = new Set(activeCluster?.nodeIds || []);
    nodes = allNodes.filter((node) => keep.has(node.id) && node.kind === "memory");
    edges = usableEdges.filter((edge) => keep.has(edge.from) && keep.has(edge.to));
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
    edges = allEdges.filter(
      (edge) => !isLinkEdge(edge) && (edge.kind === "uses" || (edge.kind === "labeled" && keptLabels.has(edge.to)))
    );
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
  return {
    nodes,
    edges,
    degree,
    linkDegree,
    neighborhood,
    effectiveMode,
    linkEdgeCount: linkEdges.length,
    stateEdgeCount: stateEdges.length,
    stateChains,
    activeStateChainId,
    networkClusters,
    activeNetworkClusterId
  };
}

function createStateChainLayout(model) {
  const bodies = new Map();
  const supersedes = model.edges.filter((edge) => linkKindOf(edge) === "supersedes");
  const contradictions = model.edges.filter((edge) => linkKindOf(edge) === "contradicts");
  const outgoing = new Map();
  for (const edge of supersedes) {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    outgoing.get(edge.from).push(edge.to);
  }
  const depthMemo = new Map();
  const depthFor = (id, visiting = new Set()) => {
    if (depthMemo.has(id)) return depthMemo.get(id);
    if (visiting.has(id)) return 0;
    const nextVisiting = new Set(visiting).add(id);
    const targets = outgoing.get(id) || [];
    const depth = targets.length ? Math.max(...targets.map((target) => depthFor(target, nextVisiting) + 1)) : 0;
    depthMemo.set(id, depth);
    return depth;
  };
  const chainIds = new Set(supersedes.flatMap((edge) => [edge.from, edge.to]));
  const orderedChainNodes = model.nodes
    .filter((item) => chainIds.has(item.id))
    .sort((left, right) =>
      depthFor(right.id) - depthFor(left.id)
        || (left.status === "superseded" ? 1 : 0) - (right.status === "superseded" ? 1 : 0)
        || String(left.label || left.id).localeCompare(String(right.label || right.id))
    );
  orderedChainNodes.forEach((node, row) => {
    bodies.set(node.id, {
      node,
      row,
      lane: 0,
      x: 0,
      y: row * 94,
      vx: 0,
      vy: 0,
      size: node.status === "superseded" ? 8 : 10
    });
  });
  const contradictionIds = new Set(contradictions.flatMap((edge) => [edge.from, edge.to]));
  const contradictionCounts = new Map();
  for (const node of model.nodes.filter((item) => contradictionIds.has(item.id) && !bodies.has(item.id))) {
    const edge = contradictions.find((item) => item.from === node.id || item.to === node.id);
    const anchorId = edge?.from === node.id ? edge?.to : edge?.from;
    const anchor = bodies.get(anchorId);
    const offsetIndex = contradictionCounts.get(anchorId) || 0;
    contradictionCounts.set(anchorId, offsetIndex + 1);
    bodies.set(node.id, {
      node,
      row: (anchor?.row || 0) + 0.34 + offsetIndex * 0.72,
      lane: 1,
      x: 1,
      y: ((anchor?.row || 0) + 0.34 + offsetIndex * 0.72) * 94,
      vx: 0,
      vy: 0,
      size: 8,
      contradiction: true
    });
  }
  const rowCount = Math.max(1, orderedChainNodes.length, ...[...bodies.values()].map((body) => Math.ceil((body.row || 0) + 1)));
  return { bodies, rowCount, step: () => false, isSettled: () => true };
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
      y: Math.sin(theta) * radius,
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
  const next = ["all", "network", "state"].includes(mode) ? mode : "all";
  if (next === memoryGraphMode) return;
  memoryGraphMode = next;
  memoryGraphZoom = 1;
  memoryGraphPan = { x: 0, y: 0 };
  memoryGraphSelection = null;
  renderMemoryGraph();
}

function selectMemoryGraphNode(nodeId) {
  const previousDialogScroll = memoryDetailDialog?.scrollTop || 0;
  const previousPanelScroll = document.querySelector("#memoryGraphPanel")?.scrollTop || 0;
  const currentModel = memoryGraphState?.model;
  const remainsInCurrentView = Boolean(memoryGraphState?.canvas)
    && (!nodeId || currentModel?.nodes.some((node) => node.id === nodeId));
  memoryGraphSelection = nodeId || null;
  const returnsToStateOverview = currentModel?.effectiveMode === "state" && !nodeId;
  if (returnsToStateOverview || (["state", "network"].includes(currentModel?.effectiveMode) && !remainsInCurrentView)) {
    renderMemoryGraph();
    requestAnimationFrame(() => {
      if (memoryDetailDialog) memoryDetailDialog.scrollTop = previousDialogScroll;
    });
    return;
  }
  renderGraphSidePanel();
  const nextPanel = document.querySelector("#memoryGraphPanel");
  if (nextPanel) nextPanel.scrollTop = previousPanelScroll;
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
          supersedes: "232, 120, 72",
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
          supersedes: "196, 82, 43",
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
  const stateMode = model.effectiveMode === "state";
  const mapMode = model.effectiveMode === "all";
  const networkMode = model.effectiveMode === "network";
  const stateCardWidth = stateMode
    ? Math.min(bodies.some((body) => body.contradiction) ? 280 : 360, Math.max(220, rect.width - 150))
    : 0;
  const stateCardHeight = 68;
  const fitScale = Math.min(
    (rect.width * (stateMode ? 0.72 : mapMode ? 0.76 : 0.72)) / boundsWidth,
    (rect.height * (stateMode ? 0.62 : mapMode ? 0.76 : 0.72)) / boundsHeight,
    stateMode ? 1.25 : 2.6
  );
  const scale = fitScale * memoryGraphZoom;
  const centerX = rect.width / 2 + memoryGraphPan.x;
  const centerY = rect.height / 2 + memoryGraphPan.y;
  const stateRowGap = 86;
  const stateContentHeight = Math.max(stateCardHeight, ((sim.rowCount || 1) - 1) * stateRowGap + stateCardHeight);
  const stateTop = Math.max(34, (rect.height - stateContentHeight) / 2 + stateCardHeight / 2);
  const stateMainX = bodies.some((body) => body.contradiction) ? rect.width * 0.32 : rect.width * 0.53;
  const project = (body) => stateMode
    ? {
        x: stateMainX + (body.lane || 0) * (stateCardWidth + 44),
        y: stateTop + (body.row || 0) * stateRowGap
      }
    : {
        x: centerX + (body.x - boundsCenterX) * scale,
        y: centerY + (body.y - boundsCenterY) * scale
      };

  canvas.dataset.zoom = String(memoryGraphZoom);
  canvas.dataset.panX = String(Math.round(memoryGraphPan.x));
  canvas.dataset.panY = String(Math.round(memoryGraphPan.y));
  canvas.dataset.layoutAspect = (boundsWidth / boundsHeight).toFixed(3);

  const now = performance.now();
  const reducedMotion = document.body?.dataset?.motion === "off";
  const isDarkTheme = document.body?.dataset?.theme === "dark";
  const theme = graphThemeColors(isDarkTheme);
  const selection = memoryGraphSelection;
  const hoveredNode = memoryGraphHover?.type === "node" ? memoryGraphHover.key : null;
  const selectionNeighbors = selection ? model.neighborhood.get(selection) || new Set() : null;
  const nodeVisible = (nodeId) => !selection || nodeId === selection || selectionNeighbors.has(nodeId);

  ctx.fillStyle = isDarkTheme ? "#171d1a" : "#fbfcf9";
  ctx.fillRect(0, 0, rect.width, rect.height);
  ctx.strokeStyle = isDarkTheme ? "rgba(255,255,255,0.025)" : "rgba(35,60,48,0.035)";
  ctx.lineWidth = 1;
  const grid = 36;
  for (let x = grid; x < rect.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rect.height);
    ctx.stroke();
  }
  for (let y = grid; y < rect.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(rect.width, y);
    ctx.stroke();
  }

  if (stateMode) {
    const timelineBodies = bodies
      .filter((body) => !body.contradiction)
      .sort((left, right) => (left.row || 0) - (right.row || 0));
    if (timelineBodies.length > 0) {
      const first = project(timelineBodies[0]);
      const last = project(timelineBodies[timelineBodies.length - 1]);
      const spineX = first.x - stateCardWidth / 2 - 26;
      ctx.beginPath();
      ctx.strokeStyle = isDarkTheme ? "rgba(121, 201, 164, 0.32)" : "rgba(40, 116, 90, 0.24)";
      ctx.lineWidth = 1.5;
      ctx.moveTo(spineX, first.y);
      ctx.lineTo(spineX, last.y);
      ctx.stroke();
      for (const body of timelineBodies) {
        const point = project(body);
        const historical = body.node.status === "superseded";
        ctx.beginPath();
        ctx.strokeStyle = historical
          ? (isDarkTheme ? "rgba(160, 177, 168, 0.45)" : "rgba(80, 105, 94, 0.34)")
          : `rgba(${theme.core}, 0.72)`;
        ctx.lineWidth = historical ? 1.2 : 1.8;
        ctx.moveTo(spineX + 6, point.y);
        ctx.lineTo(point.x - stateCardWidth / 2 - 8, point.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = historical ? (isDarkTheme ? "#171d1a" : "#fbfcf9") : `rgb(${theme.core})`;
        ctx.strokeStyle = historical
          ? (isDarkTheme ? "rgba(160, 177, 168, 0.72)" : "rgba(80, 105, 94, 0.58)")
          : `rgb(${theme.core})`;
        ctx.lineWidth = 1.5;
        ctx.arc(spineX, point.y, historical ? 4 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  const hitEdges = [];
  const hitNodes = [];
  const hoveredEdge = memoryGraphHover?.type === "edge" ? memoryGraphHover.key : null;
  const edgeKey = (edge) => `${edge.from}->${edge.to}:${edge.kind}`;

  for (const edge of model.edges) {
    const a = sim.bodies.get(edge.from);
    const b = sim.bodies.get(edge.to);
    if (!a || !b) continue;
    let pa = project(a);
    let pb = project(b);
    const link = isLinkEdge(edge);
    const kind = link ? linkKindOf(edge) : edge.kind;
    if (stateMode && kind === "supersedes") continue;
    if (stateMode && kind === "supersedes") {
      [pa, pb] = [pb, pa];
    }
    if (stateMode) {
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const inset = Math.min(
        distance * 0.42,
        Math.abs(dx) > Math.abs(dy) ? stateCardWidth / 2 + 10 : stateCardHeight / 2 + 10
      );
      const ux = dx / distance;
      const uy = dy / distance;
      pa = { x: pa.x + ux * inset, y: pa.y + uy * inset };
      pb = { x: pb.x - ux * inset, y: pb.y - uy * inset };
    }
    const strength = Math.max(0.05, Math.min(1, Number(edge.strength) || 0.5));
    let color = theme.edge;
    let alpha = isDarkTheme ? 0.1 : 0.08;
    let width = 0.7;
    let dashed = false;
    let arrow = false;
    if (link) {
      color = theme.linkKinds[kind] || theme.memory;
      alpha = stateMode ? 0.78 : networkMode ? 0.3 + strength * 0.3 : 0.38 + strength * 0.4;
      width = stateMode ? 2.2 : networkMode ? 0.8 + strength * 1.2 : 1 + strength * 2.1;
      dashed = kind === "contradicts";
      arrow = kind === "causes" || kind === "evolved-from" || kind === "part-of" || kind === "supersedes";
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
    if (arrow && incident) {
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const ux = dx / distance;
      const uy = dy / distance;
      const targetInset = stateMode ? 0 : Math.min(14, distance * 0.18);
      const tipX = pb.x - ux * targetInset;
      const tipY = pb.y - uy * targetInset;
      const size = networkMode ? 2.8 + width : 4 + width;
      const baseX = tipX - ux * size * 1.8;
      const baseY = tipY - uy * size * 1.8;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${color}, ${alpha})`;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(baseX - uy * size * 0.62, baseY + ux * size * 0.62);
      ctx.lineTo(baseX + uy * size * 0.62, baseY - ux * size * 0.62);
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
    const agentColor = model.effectiveMode === "all" ? graphAgentColor(node.agentId, isDarkTheme) : "";
    if (agentColor) return `rgb(${agentColor})`;
    return `rgb(${theme.memory})`;
  };

  const stateRoundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };

  for (const body of bodies) {
    const node = body.node;
    const p = project(body);
    if (stateMode) {
      const cardWidth = stateCardWidth;
      const cardHeight = stateCardHeight;
      const x = p.x - cardWidth / 2;
      const y = p.y - cardHeight / 2;
      const historical = node.status === "superseded";
      const contradiction = Boolean(body.contradiction);
      stateRoundRect(x, y, cardWidth, cardHeight, 12);
      ctx.fillStyle = isDarkTheme
        ? historical ? "rgba(29,38,34,0.92)" : "rgba(28,65,51,0.96)"
        : historical ? "rgba(255,255,252,0.96)" : "rgba(232,245,238,0.98)";
      ctx.fill();
      ctx.strokeStyle = contradiction
        ? `rgba(${theme.linkKinds.contradicts}, 0.9)`
        : historical ? (isDarkTheme ? "rgba(160,177,168,0.46)" : "rgba(80,105,94,0.3)") : `rgba(${theme.core}, 0.9)`;
      ctx.lineWidth = node.id === selection ? 2.4 : historical ? 1.2 : 1.8;
      ctx.setLineDash(contradiction ? [5, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      const role = contradiction
        ? t("memory.graph.role.contradiction")
        : historical ? t("memory.graph.role.historical") : t("memory.graph.role.current");
      ctx.font = "700 9px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = contradiction
        ? `rgb(${theme.linkKinds.contradicts})`
        : historical ? (isDarkTheme ? "#9eaea5" : "#65776e") : `rgb(${theme.core})`;
      ctx.textBaseline = "middle";
      ctx.fillText(role.toUpperCase(), x + 12, y + 17);
      ctx.font = "650 12px Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = theme.pillText;
      const title = stateNodeDisplayLabel(node).replace(/(?:\.{3}|…)+$/u, "").trim();
      let clippedTitle = title;
      while (clippedTitle.length > 1 && ctx.measureText(`${clippedTitle}…`).width > cardWidth - 24) {
        clippedTitle = clippedTitle.slice(0, -1);
      }
      if (clippedTitle !== title) clippedTitle = `${clippedTitle.trimEnd()}…`;
      ctx.fillText(clippedTitle, x + 12, y + 40);
      hitNodes.push({ id: node.id, x, y, w: cardWidth, h: cardHeight });
      continue;
    }
    const hasLinks = (model.linkDegree.get(node.id) || 0) > 0;
    const emphasis = node.id === selection || node.id === hoveredNode;
    const sizeFactor = mapMode && node.kind === "memory" ? 0.66 : hasLinks ? 1.08 : 0.82;
    const phaseOffset = ((graphHash(node.id) % 1000) / 1000) * Math.PI * 0.72;
    const phase = (now / 1000) * Math.PI * 2 / 4.6 + phaseOffset;
    const breathWave = mapMode && !reducedMotion ? (Math.sin(phase) + 1) / 2 : 0.5;
    const pulseAmplitude = node.kind === "memory" ? 0.04 : 0.065;
    const pulse = mapMode && !reducedMotion ? 1 + Math.sin(phase) * pulseAmplitude : 1;
    const radius = Math.max(2, body.size * sizeFactor * pulse) * Math.min(1.28, Math.max(0.74, scale / fitScale));
    const visible = nodeVisible(node.id);
    const baseAlpha = node.kind === "memory" ? (mapMode ? 0.68 : 0.82) : 0.9;
    const breathingAlpha = mapMode && !reducedMotion
      ? baseAlpha * (node.kind === "memory" ? 0.9 + breathWave * 0.1 : 0.84 + breathWave * 0.16)
      : baseAlpha;
    const alpha = visible ? breathingAlpha : 0.1;
    if ((node.kind !== "memory" || emphasis) && visible) {
      ctx.beginPath();
      ctx.fillStyle = node.kind === "label"
        ? `rgba(${theme.label}, ${0.08 + breathWave * 0.11})`
        : node.kind === "shared_line"
          ? `rgba(${theme.core}, ${0.09 + breathWave * 0.12})`
          : `rgba(${mapMode ? graphAgentColor(node.agentId, isDarkTheme) || theme.memory : theme.memory}, 0.12)`;
      const haloExpansion = mapMode && !reducedMotion ? 3 + breathWave * 5 : 4;
      ctx.arc(p.x, p.y, radius + haloExpansion, 0, Math.PI * 2);
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

  if (stateMode) {
    memoryGraphState.hitEdges = hitEdges;
    memoryGraphState.hitNodes = hitNodes;
    return;
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

  const focusCandidates = [];
  const structureCandidates = [];
  const memoryCandidates = [];
  for (const body of bodies) {
    const node = body.node;
    if (!nodeVisible(node.id)) continue;
    const linkCount = model.linkDegree.get(node.id) || 0;
    const degree = model.degree.get(node.id) || 0;
    const isFocus = node.id === selection
      || node.id === hoveredNode
      || (selection && !networkMode && selectionNeighbors.has(node.id));
    const candidate = { body, node, rank: (isFocus ? 1000 : 0) + linkCount * 10 + degree };
    if (isFocus) {
      focusCandidates.push(candidate);
    } else if (model.effectiveMode === "all" && node.kind !== "memory" && degree > 2) {
      structureCandidates.push(candidate);
    } else if (model.effectiveMode === "all" && node.kind === "memory" && degree >= 2) {
      memoryCandidates.push(candidate);
    } else if (model.effectiveMode !== "all" && linkCount > 0) {
      memoryCandidates.push(candidate);
    }
  }
  const byRank = (left, right) => right.rank - left.rank || graphHash(left.node.id) - graphHash(right.node.id);
  focusCandidates.sort(byRank);
  structureCandidates.sort(byRank);
  memoryCandidates.sort(byRank);
  const pillCandidates = model.effectiveMode === "all"
    ? [...focusCandidates, ...structureCandidates.slice(0, 11), ...memoryCandidates.slice(0, 14)]
    : [...focusCandidates, ...memoryCandidates.slice(0, networkMode ? 10 : 18)];
  const placedPills = [];
  let pillsDrawn = 0;
  for (const { body, node } of pillCandidates) {
    if (pillsDrawn >= (model.effectiveMode === "all" ? 25 : networkMode ? 12 : 18)) break;
    const p = project(body);
    if (p.x < -40 || p.y < -20 || p.x > rect.width + 40 || p.y > rect.height + 20) continue;
    const text = truncateCanvasText(labelForNode(node), 118);
    const textWidth = ctx.measureText(text).width;
    const pillWidth = Math.min(140, textWidth + 18);
    const pillHeight = 20;
    const positions = [
      [p.x + 11, p.y - pillHeight - 7],
      [p.x + 11, p.y + 7],
      [p.x - pillWidth - 11, p.y - pillHeight - 7],
      [p.x - pillWidth - 11, p.y + 7],
      [p.x + 11, p.y - pillHeight / 2],
      [p.x - pillWidth - 11, p.y - pillHeight / 2]
    ];
    let placement = null;
    for (const [candidateX, candidateY] of positions) {
      const x = Math.min(rect.width - pillWidth - 8, Math.max(8, candidateX));
      const y = Math.min(rect.height - pillHeight - 8, Math.max(8, candidateY));
      const overlaps = placedPills.some((box) =>
        x < box.x + box.w + 6 && x + pillWidth + 6 > box.x && y < box.y + box.h + 5 && y + pillHeight + 5 > box.y
      );
      if (!overlaps) {
        placement = { x, y };
        break;
      }
    }
    if (!placement) continue;
    const { x, y } = placement;
    placedPills.push({ x, y, w: pillWidth, h: pillHeight });
    pillsDrawn += 1;
    roundRect(x, y, pillWidth, pillHeight, 10);
    ctx.globalAlpha = 0.86;
    ctx.fillStyle = theme.pillFill;
    ctx.fill();
    const pillAgentColor = model.effectiveMode === "all" && node.kind === "memory"
      ? graphAgentColor(node.agentId, isDarkTheme)
      : "";
    ctx.strokeStyle = node.kind === "label"
      ? theme.labelPillStroke
      : pillAgentColor ? `rgba(${pillAgentColor}, 0.34)` : theme.sharedLinePillStroke;
    ctx.lineWidth = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.pillText;
    ctx.fillText(text, x + 9, y + pillHeight / 2);
  }
  canvas.dataset.visibleLabelCount = String(pillsDrawn);

  memoryGraphState.hitEdges = hitEdges;
  memoryGraphState.hitNodes = hitNodes;

  if (!sim.isSettled() || (model.effectiveMode === "all" && !reducedMotion)) {
    memoryGraphAnimation = requestAnimationFrame(drawMemoryGraphCanvas);
  }
}

function renderMemoryRecall() {
  const controller = snapshot?.memoryController || {};
  const events = Array.isArray(controller.recent) ? controller.recent : [];
  if (memoryRecallStatus) {
    const mode = controller.mode || "off";
    memoryRecallStatus.className = `memory-recall-status is-${mode}`;
    memoryRecallStatus.innerHTML = `<span>${escapeHtml(memoryControllerModeLabel(mode))}</span><p>${mode === "canary" ? "仅返回第一条同智能体、有效、普通敏感度且高置信记忆。" : mode === "observe" ? "系统完成需求判断、检索和相关性门槛，返回内容为空。" : "仅响应显式搜索，自动评估已关闭。"}</p>`;
  }
  if (memoryRecallList) {
    memoryRecallList.innerHTML = events.length
      ? events.slice(0, 3).map((event) => renderRecallEvent(event, true)).join("")
      : `<div class="endpoint-empty">还没有回召判断记录。</div>`;
  }
  if (memoryAllRecallAction) memoryAllRecallAction.hidden = events.length === 0;
}

function renderMemoryProcess() {
  const stats = snapshot?.memoryStats || {};
  const controller = snapshot?.memoryController || {};
  const labelCount = (stats.labels || []).filter((item) => !/^(agent|agent-id|tool):/.test(String(item.label || ""))).length;
  const steps = [
    ["明确写入", stats.activeCount || 0, "智能体决定长期保留"],
    ["组织关联", labelCount, "标签、关系与状态链"],
    ["判断需要", controller.eventCount || 0, "先看这次是否需要历史"],
    ["检查相关", controller.stageA?.RETRIEVE || 0, "比较语义分数和领先幅度"],
    ["实际返回", controller.eventsWithInjection || 0, "按真实进入上下文的记录计数"]
  ];
  if (memoryProcessFlow) memoryProcessFlow.innerHTML = steps.map(([title, count, body], index) => `<div><span>${index + 1}</span><strong>${title}</strong><small>${body}</small><em>${count} 条</em></div>`).join("");
}

function renderMemoryOverview() {
  syncSnapshot();
  if (activeMemoryGraphLayer === "restricted" && !snapshot?.restrictedMemoryGraph) {
    activeMemoryGraphLayer = "primary";
    memoryGraphZoom = 1;
    memoryGraphPan = { x: 0, y: 0 };
  }
  const stats = snapshot?.memoryStats || {};
  const memories = snapshot?.memories || snapshot?.recentMemories || [];
  const labels = stats.labels || [];
  if (memoryOverviewCount) memoryOverviewCount.textContent = String(stats.activeCount || 0);
  if (!loadedMemoryTabs.all) {
    memoryPaging.all.loaded = memories.length;
    memoryPaging.all.hasMore = memories.length < (stats.activeCount ?? 0);
  }
  const visibleTopics = labels.filter((item) => !/^(agent|agent-id|tool):/.test(String(item.label || ""))).slice(0, 6);
  if (memoryTopicList) memoryTopicList.innerHTML = visibleTopics.length
    ? visibleTopics.map((item) => `<button type="button" data-memory-label="${escapeHtml(item.label)}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.count)}</strong></button>`).join("")
    : `<span class="quiet">记忆形成主题后会显示在这里。</span>`;
  const agentIds = labels
    .map((item) => String(item.label || ""))
    .filter((label) => label.startsWith("agent-id:"))
    .map((label) => label.slice("agent-id:".length));
  const fallbackAgentIds = labels
    .map((item) => String(item.label || ""))
    .filter((label) => label.startsWith("agent:"))
    .map((label) => label.slice("agent:".length));
  activeMemoryAgentFilter = renderAgentFilter(memoryAgentFilter, agentIds.length ? agentIds : fallbackAgentIds, activeMemoryAgentFilter);
  renderMemoryLabels(labels);
  memoryAllHint.textContent = t("memory.list.sample", {
    shown: memories.length,
    total: stats.activeCount ?? 0
  });
  if (loadedMemoryTabs.graph) renderMemoryGraph();
  renderMemoryTabs();
  renderMemoryList();
  renderMemoryProcess();
  renderMemoryRecall();
}

function graphNodeById(nodeId) {
  if (!memoryGraphState) return null;
  return memoryGraphState.model.nodes.find((node) => node.id === nodeId) || null;
}

function stateNodeDisplayLabel(node) {
  const label = String(node?.label || node?.id || "").trim();
  const looksLikeStorageId = /^(?:old_)?memoria_memory_[a-z0-9_-]+$/i.test(label)
    || /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(label);
  if (!looksLikeStorageId) return label;
  const excerpt = String(node?.excerpt || "").trim().split(/\r?\n/)[0];
  return excerpt || label;
}

function linkKindLabel(kind) {
  const key = `memory.graph.link.${kind}`;
  const text = t(key);
  return text === key ? kind : text;
}

function graphEdgeKindLabel(kind) {
  if (String(kind).startsWith("link:")) return linkKindLabel(linkKindOf({ kind }));
  const key = `memory.graph.edge.${kind}`;
  const text = t(key);
  return text === key ? kind : text;
}

function renderGraphSidePanel() {
  const panel = document.querySelector("#memoryGraphPanel");
  if (!panel || !memoryGraphState) return;
  const { model } = memoryGraphState;
  let selection = memoryGraphSelection ? graphNodeById(memoryGraphSelection) : null;
  const isDarkTheme = document.body?.dataset?.theme === "dark";
  if (model.effectiveMode === "state") {
    const activeChain = model.stateChains.find((chain) => chain.id === model.activeStateChainId) || model.stateChains[0];
    if (!selection) selection = graphNodeById(activeChain?.id);
    const supersedes = model.edges.filter((edge) => linkKindOf(edge) === "supersedes");
    const contradictions = model.edges.filter((edge) => linkKindOf(edge) === "contradicts");
    const chainIds = new Set([selection.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of supersedes) {
        if (chainIds.has(edge.from) || chainIds.has(edge.to)) {
          if (!chainIds.has(edge.from)) { chainIds.add(edge.from); changed = true; }
          if (!chainIds.has(edge.to)) { chainIds.add(edge.to); changed = true; }
        }
      }
    }
    const outgoing = new Map();
    for (const edge of supersedes) {
      if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
      outgoing.get(edge.from).push(edge.to);
    }
    const depthMemo = new Map();
    const depthFor = (id, visiting = new Set()) => {
      if (depthMemo.has(id)) return depthMemo.get(id);
      if (visiting.has(id)) return 0;
      const targets = outgoing.get(id) || [];
      const next = new Set(visiting).add(id);
      const depth = targets.length ? Math.max(...targets.map((target) => depthFor(target, next) + 1)) : 0;
      depthMemo.set(id, depth);
      return depth;
    };
    const ordered = [...chainIds]
      .map((id) => graphNodeById(id))
      .filter(Boolean)
      .sort((left, right) =>
        depthFor(right.id) - depthFor(left.id)
          || (left.status === "superseded" ? 1 : 0) - (right.status === "superseded" ? 1 : 0)
          || String(left.label || left.id).localeCompare(String(right.label || right.id))
      );
    const currentNode = ordered.find((node) => node.status !== "superseded") || ordered[0];
    const previousNode = ordered.find((node) => node.status === "superseded");
    const timeline = ordered.map((node) => `
      <button class="state-timeline-item ${node.id === selection.id ? "selected" : ""} ${node.status === "superseded" ? "historical" : "current"}" data-graph-select="${escapeHtml(node.id)}">
        <span class="state-timeline-marker"></span>
        <span>
          <small>${escapeHtml(node.status === "superseded" ? t("memory.graph.role.historical") : t("memory.graph.role.current"))}</small>
          <strong>${escapeHtml(stateNodeDisplayLabel(node))}</strong>
        </span>
      </button>
    `).join("");
    const replacement = supersedes.find((edge) => edge.from === selection.id || edge.to === selection.id);
    const conflictRows = contradictions
      .filter((edge) => edge.from === selection.id || edge.to === selection.id)
      .map((edge) => {
        const otherId = edge.from === selection.id ? edge.to : edge.from;
        const other = graphNodeById(otherId);
        return `<button class="state-conflict" data-graph-select="${escapeHtml(otherId)}"><span></span><strong>${escapeHtml(stateNodeDisplayLabel(other) || otherId)}</strong></button>`;
      })
      .join("");
    panel.innerHTML = `
      <button class="state-overview-back" data-graph-select="">← ${escapeHtml(t("memory.graph.statePanel.backToOverview"))}</button>
      <div class="graph-panel-kicker">${escapeHtml(t("memory.graph.statePanel.kicker"))}</div>
      <div class="graph-panel-title">${escapeHtml(t("memory.graph.statePanel.title"))}</div>
      <div class="graph-panel-hint">${escapeHtml(t("memory.graph.statePanel.explainer"))}</div>
      <div class="state-transition-summary">
        <small>${escapeHtml(t("memory.graph.role.current"))}</small>
        <strong>${escapeHtml(stateNodeDisplayLabel(currentNode))}</strong>
        ${previousNode ? `<span>${escapeHtml(t("memory.graph.statePanel.replaced"))}</span><p>${escapeHtml(stateNodeDisplayLabel(previousNode))}</p>` : ""}
      </div>
      <div class="state-panel-section-label">${escapeHtml(t("memory.graph.statePanel.timeline"))}</div>
      <div class="state-timeline">${timeline}</div>
      ${memoryGraphSelection && selection.excerpt ? `
        <div class="state-panel-section-label">${escapeHtml(t("memory.graph.statePanel.selectedContent"))}</div>
        <div class="state-panel-excerpt">${escapeHtml(selection.excerpt)}</div>
      ` : ""}
      ${replacement?.note ? `
        <div class="state-reason">
          <small>${escapeHtml(t("memory.graph.statePanel.reason"))}</small>
          <p>${escapeHtml(replacement.note)}</p>
        </div>
      ` : ""}
      ${conflictRows ? `
        <div class="state-panel-section-label danger">${escapeHtml(t("memory.graph.statePanel.conflicts"))}</div>
        <div class="state-conflicts">${conflictRows}</div>
      ` : ""}
    `;
    return;
  }
  const networkClusterChooser = model.effectiveMode === "network" ? `
    <div class="graph-panel-kicker">${escapeHtml(t("memory.graph.networkPanel.kicker"))}</div>
    <div class="network-cluster-list">
      ${model.networkClusters.map((cluster) => `
        <button class="network-cluster-choice ${cluster.id === model.activeNetworkClusterId ? "selected" : ""}" data-graph-select="${escapeHtml(cluster.id)}">
          <span class="network-cluster-mark"></span>
          <span>
            <strong>${escapeHtml(cluster.label)}</strong>
            <small>${escapeHtml(t("memory.graph.networkPanel.items", { nodes: cluster.nodeCount, edges: cluster.edgeCount }))}</small>
          </span>
        </button>
      `).join("")}
    </div>
  ` : "";
  if (!selection) {
    const agentCounts = new Map();
    if (model.effectiveMode === "all") {
      for (const node of model.nodes) {
        if (node.kind !== "memory" || !node.agentId) continue;
        agentCounts.set(node.agentId, (agentCounts.get(node.agentId) || 0) + 1);
      }
    }
    const agentLegendRows = [...agentCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([agentId, count]) => `
        <div class="graph-legend-row">
          <span class="graph-legend-swatch agent" style="--agent-color: rgb(${graphAgentColor(agentId, isDarkTheme)})"></span>
          <span>${escapeHtml(agentId)}</span>
          <strong>${count}</strong>
        </div>
      `)
      .join("");
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
      <div class="graph-panel-hint">${escapeHtml(t(model.effectiveMode === "all" ? "memory.graph.panel.mapHint" : "memory.graph.panel.empty"))}</div>
      ${agentLegendRows ? `<div class="graph-panel-kicker">${escapeHtml(t("memory.graph.agentLegend"))}</div><div class="graph-legend agent-legend">${agentLegendRows}</div>` : ""}
      ${networkClusterChooser}
      ${legendRows ? `<div class="graph-legend">${legendRows}</div>` : ""}
    `;
    return;
  }
  const mapMode = model.effectiveMode === "all";
  const incident = model.edges.filter((edge) =>
    (mapMode ? !isLinkEdge(edge) : isLinkEdge(edge))
      && (edge.from === selection.id || edge.to === selection.id)
  );
  const rows = incident.slice(0, 20)
    .map((edge) => {
      const otherId = edge.from === selection.id ? edge.to : edge.from;
      const other = graphNodeById(otherId);
      const kind = isLinkEdge(edge) ? linkKindOf(edge) : edge.kind;
      return `
        <button class="graph-panel-link" data-graph-select="${escapeHtml(otherId)}">
          <span class="graph-panel-link-head">
            <span class="graph-legend-swatch kind-${escapeHtml(kind)}"></span>
            <span class="graph-panel-kind">${escapeHtml(graphEdgeKindLabel(edge.kind))}</span>
            ${isLinkEdge(edge) ? `<span class="graph-panel-strength" style="--link-strength: ${Math.round(Math.max(0.05, Math.min(1, Number(edge.strength) || 0.5)) * 100)}%"></span>` : ""}
          </span>
          <strong>${escapeHtml(other?.label || otherId)}</strong>
          ${edge.note ? `<em>${escapeHtml(edge.note)}</em>` : ""}
        </button>
      `;
    })
    .join("");
  const detail = selection.excerpt || selection.summary || "";
  const kindKey = `memory.graph.kind.${selection.kind}`;
  const selectionAgentColor = mapMode && selection.kind === "memory" ? graphAgentColor(selection.agentId, isDarkTheme) : "";
  panel.innerHTML = `
    <div class="graph-panel-kicker">${escapeHtml(t(kindKey))}</div>
    <div class="graph-panel-title">${escapeHtml(selection.label || selection.id)}</div>
    ${selectionAgentColor ? `<div class="graph-agent-chip"><span style="--agent-color: rgb(${selectionAgentColor})"></span>${escapeHtml(selection.agentId)}</div>` : ""}
    ${detail ? `<div class="graph-panel-excerpt">${escapeHtml(detail)}</div>` : ""}
    <div class="graph-panel-subtitle">${escapeHtml(t(mapMode ? "memory.graph.panel.structure" : "memory.graph.panel.title"))} · ${incident.length}</div>
    ${rows || `<div class="graph-panel-hint subtle">${escapeHtml(t(mapMode ? "memory.graph.panel.noStructure" : "memory.graph.panel.noLinks"))}</div>`}
    ${networkClusterChooser}
  `;
}

function graphHitTest(clientX, clientY) {
  if (!memoryGraphState?.canvas) return null;
  const rect = memoryGraphState.canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  for (const hit of memoryGraphState.hitNodes || []) {
    if (hit.w && hit.h) {
      if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
        return { type: "node", key: hit.id };
      }
      continue;
    }
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
  const model = buildGraphModel(graph, memoryGraphMode, memoryGraphSelection);
  memoryGraphSummary.textContent = t("memory.graph.summary", { nodes: allNodes.length, edges: allEdges.length });
  if (memoryGraphSelection && !model.nodes.some((node) => node.id === memoryGraphSelection)) {
    memoryGraphSelection = null;
  }
  stopMemoryGraphAnimation();
  const stateEmpty = model.effectiveMode === "state" && model.nodes.length === 0;
  const stateMode = model.effectiveMode === "state";
  const stateOverview = stateMode && !stateEmpty && !memoryGraphSelection;
  const stateViewportHeight = 444;
  const stateCanvasHeight = stateMode ? Math.max(stateViewportHeight, model.nodes.length * 86 + 72) : 520;
  memoryGraph.innerHTML = `
    <div class="graph-toolbar">
      <div class="graph-view-switch" aria-label="${escapeHtml(t("memory.graph.viewLabel"))}">
        <button class="graph-layer ${memoryGraphMode === "all" ? "active" : ""}" data-graph-mode="all">${escapeHtml(t("memory.graph.mode.all"))}</button>
        <button class="graph-layer ${memoryGraphMode === "network" ? "active" : ""}" data-graph-mode="network">${escapeHtml(t("memory.graph.mode.network"))}</button>
        <button class="graph-layer ${memoryGraphMode === "state" ? "active" : ""}" data-graph-mode="state">${escapeHtml(t("memory.graph.mode.state"))}</button>
      </div>
      <div class="graph-layer-switch">
        <button class="graph-layer ${activeMemoryGraphLayer === "primary" ? "active" : ""}" data-graph-layer="primary">${escapeHtml(t("memory.graph.primaryLayer"))}</button>
        <button class="graph-layer ${activeMemoryGraphLayer === "restricted" ? "active restricted" : ""}" data-graph-layer="restricted">${escapeHtml(t("memory.graph.restrictedLayer"))}</button>
      </div>
      ${stateMode ? `<div class="state-direction">${escapeHtml(t(stateOverview ? "memory.graph.statePanel.chooseChain" : "memory.graph.statePanel.direction"))}</div>` : `
        <div class="graph-zoom-controls">
          <button class="secondary" data-graph-zoom="out" aria-label="${escapeHtml(t("memory.graph.zoomOut"))}">−</button>
          <button class="secondary" data-graph-zoom="fit">${escapeHtml(t("memory.graph.fit"))}</button>
          <button class="secondary" data-graph-zoom="in" aria-label="${escapeHtml(t("memory.graph.zoomIn"))}">+</button>
        </div>
      `}
      <strong class="graph-toolbar-summary">${escapeHtml(stateOverview
        ? t("memory.graph.statePanel.overviewSummary", { chains: model.stateChains.length, changes: model.stateEdgeCount })
        : t("memory.graph.summary", { nodes: model.nodes.length, edges: model.edges.length }))}</strong>
    </div>
    <div class="graph-body">
      ${stateEmpty ? `
        <div class="graph-state-empty">
          <span class="state-empty-line"></span>
          <strong>${escapeHtml(t("memory.graph.stateEmpty.title"))}</strong>
          <p>${escapeHtml(t("memory.graph.stateEmpty.body"))}</p>
        </div>
      ` : stateOverview ? `
        <section class="state-chain-overview">
          <div class="state-chain-overview-head">
            <div class="graph-panel-kicker">${escapeHtml(t("memory.graph.statePanel.kicker"))}</div>
            <h3>${escapeHtml(t("memory.graph.statePanel.overviewTitle"))}</h3>
            <p>${escapeHtml(t("memory.graph.statePanel.overviewBody"))}</p>
          </div>
          <div class="state-chain-overview-grid">
            ${model.stateChains.map((chain) => `
              <button class="state-chain-overview-card" data-graph-select="${escapeHtml(chain.id)}">
                <span>${escapeHtml(t("memory.graph.role.current"))}</span>
                <strong>${escapeHtml(chain.label)}</strong>
                <small>${escapeHtml(t("memory.graph.statePanel.items", { count: chain.nodeCount }))}</small>
                <em>→</em>
              </button>
            `).join("")}
          </div>
        </section>
      ` : `
        <div class="graph-stage ${stateMode ? "state-stage" : ""}">
          ${stateMode ? `
            <div class="state-chain-explainer">
              <strong>${escapeHtml(t("memory.graph.statePanel.readingTitle"))}</strong>
              <span>${escapeHtml(t("memory.graph.statePanel.readingBody"))}</span>
            </div>
          ` : ""}
          <div class="graph-canvas ${stateMode ? "state-scroll" : ""}" ${stateMode ? `style="height: ${stateViewportHeight}px; min-height: ${stateViewportHeight}px"` : ""}>
            <canvas id="memoryGraphCanvas" style="height: ${stateCanvasHeight}px" data-mode="${escapeHtml(model.effectiveMode)}" data-state-layout="${stateMode ? "timeline" : ""}" data-state-title-clipping="${stateMode ? "pixel" : ""}" data-active-state-chain="${escapeHtml(model.activeStateChainId || "")}" data-node-count="${model.nodes.length}" data-edge-count="${model.edges.length}" data-label-count="${model.nodes.filter((node) => node.kind === "label").length}" data-agent-count="${new Set(model.nodes.filter((node) => node.kind === "memory").map((node) => node.agentId).filter(Boolean)).size}" data-link-count="${model.linkEdgeCount}" data-network-cluster-count="${model.networkClusters.length}" data-active-network-cluster="${escapeHtml(model.activeNetworkClusterId || "")}" data-state-edge-count="${model.stateEdgeCount}" data-restricted-count="${model.nodes.filter((node) => node.sensitivity === "restricted").length}" aria-label="${escapeHtml(t("memory.graph.title"))}"></canvas>
            <div id="memoryGraphTooltip" class="graph-tooltip"></div>
          </div>
        </div>
      `}
      ${stateOverview ? "" : `<aside id="memoryGraphPanel" class="graph-side-panel"></aside>`}
    </div>
  `;
  const canvas = document.querySelector("#memoryGraphCanvas");
  memoryGraphState = {
    canvas,
    model,
    sim: model.effectiveMode === "state" ? createStateChainLayout(model) : createForceLayout(model),
    hitEdges: [],
    hitNodes: []
  };
  renderGraphSidePanel();
  if (!canvas) return;
  bindGraphCanvasEvents(canvas);
  drawMemoryGraphCanvas();
}

  function bindMemoryReader() {
    document.querySelector("#memoryView .memory-page")?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-memory-open]");
      if (!action) return;
      openMemoryDialog(action.dataset.memoryOpen || "library", { trigger: action });
    });
    memoryDetailDialog?.addEventListener("click", (event) => {
      const item = event.target.closest("[data-memory-id]");
      if (!item) return;
      selectMemory(item.dataset.memoryId || "", { trigger: item, backMode: "library" });
    });
    memoryRecallList?.addEventListener("click", (event) => {
      const item = event.target.closest("[data-memory-decision-id]");
      if (item) openMemoryDialog("recall", { trigger: item, decisionId: item.dataset.memoryDecisionId, backMode: "recall" });
    });
    memoryDetailClose?.addEventListener("click", () => memoryDetailDialog.close());
    memoryDetailBack?.addEventListener("click", () => openMemoryDialog(dialogBackMode));
    memoryLibraryLoadMore?.addEventListener("click", () => {
      memoryLibraryLoadMore.disabled = true;
      loadMemoryTabData("all", { append: true })
        .catch((error) => {
          console.error(error);
          showCopyNotice(t("runtime.unavailable"));
        })
        .finally(() => {
          memoryLibraryLoadMore.disabled = false;
        });
    });
    memoryDetailDialog?.addEventListener("close", () => {
      const trigger = dialogTrigger;
      dialogTrigger = null;
      dialogMode = "";
      dialogBackMode = "";
      trigger?.focus();
    });
  }

  function resetLoadedTabs() {
    memoryHydration.invalidate();
    loadedMemoryTabs.all = false;
    loadedMemoryTabs.graph = false;
    memoryPaging.all.loaded = 0;
    memoryPaging.all.hasMore = true;
  }

  function getActiveTab() { return activeMemoryTab; }
  function setActiveAgentFilter(value) { activeMemoryAgentFilter = value || ""; }
  function setActiveTab(tabName) { activeMemoryTab = tabName || "search"; }
  function setSearchActive(value) {
    searchActive = Boolean(value);
    if (memoryRecentTitle) {
      memoryRecentTitle.textContent = t(searchActive ? "memory.search.resultsTitle" : "memory.recent");
    }
  }

  function searchMemoryLabel(label) {
    memorySearchInput.value = String(label || "").trim();
    memoryDetailDialog?.close();
    searchMemory.click();
  }

  function beginGraphDrag(event) {
    if (!event.target.closest(".graph-canvas")) return;
    if (event.target.closest("#memoryGraphCanvas")?.dataset.mode === "state") return;
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
    if (dom.processMemoryEmbeddings) dom.processMemoryEmbeddings.disabled = true;
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
      if (dom.memoryEmbeddingNotice) dom.memoryEmbeddingNotice.textContent = finalText;
      appendLiveLogLine("memoria", finalText);
    } catch (error) {
      console.error(error);
      if (dom.memoryEmbeddingNotice) dom.memoryEmbeddingNotice.textContent = t("memory.embedding.processFailed");
      appendLiveLogLine("memoria", `${t("memory.embedding.processFailed")}: ${error.message || error}`);
    } finally {
      memoryEmbeddingBatchRunning = false;
      const snapshot = getSnapshot();
      if (dom.processMemoryEmbeddings) {
        dom.processMemoryEmbeddings.disabled = vectorMaintenanceCount({ stats: snapshot?.memoryStats || {}, maintenance: snapshot?.memoryMaintenance || {} }) <= 0;
      }
    }
  }

  bindMemoryReader();

  return {
    beginGraphDrag, endGraphDrag, getActiveTab, loadMemoryTabData, memoryAgentId, moveGraphDrag, processEmbeddings,
    renderMemoryGraph, renderMemoryList, renderMemoryOverview, renderMemoryResults, renderMemoryTabs, resetLoadedTabs,
    searchMemoryLabel, selectMemory, selectMemoryGraphNode, setActiveAgentFilter, setActiveTab, setSearchActive, setMemoryGraphLayer, setMemoryGraphMode,
    setMemoryGraphZoom
  };
}

window.createClaraCoreMemoriaView = createClaraCoreMemoriaView;
