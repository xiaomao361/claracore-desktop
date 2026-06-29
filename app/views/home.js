function createClaraCoreHomeView(context) {
  const {
    dom,
    t,
    getSnapshot,
    escapeHtml,
    safeJsonObject,
    itemAgentId,
    filterByAgent,
    formatMode
  } = context;
  const {
    moduleGrid,
    eventList,
    homeCognitiveUpdated,
    homeCognitiveSystems,
    homeAgentViewList,
    homeTraceList,
    healthSummary,
    healthList,
    mcpCommand,
    mcpConfig,
    gatewayTraceList,
    httpEndpointList
  } = dom;

function serviceBadge(module) {
  if (module.state === "planned") {
    return `<span class="badge planned">${t("common.planned")}</span>`;
  }
  if (module.present && module.state === "paused") {
    return `<span class="badge paused">${t("common.paused")}</span>`;
  }
  if (module.present) {
    return `<span class="badge ok">${t("common.ready")}</span>`;
  }
  if (!module.required) {
    return `<span class="badge optional">${t("common.optionalMissing")}</span>`;
  }
  return `<span class="badge missing">${t("common.missing")}</span>`;
}

function moduleTone(module) {
  if (module.state === "planned") return "is-planned";
  if (!module.present && module.required) return "needs-attention";
  if (module.state === "paused") return "is-paused";
  return "is-ready";
}

function moduleIcon(module) {
  const icons = {
    gateway: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.8 5.2A7.8 7.8 0 1 0 15.8 18.8"></path>
        <path d="M7 15.8c2.4-2.5 4.5-3.7 6.4-3.6 1.6.1 2.7 1.1 4.1 1 1.2 0 2.1-.6 3-1.8"></path>
        <circle cx="17.3" cy="12" r="1.8"></circle>
      </svg>
    `,
    memoria: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16.2 5.5A7.2 7.2 0 1 0 16.2 18.5"></path>
        <path d="M7.2 16c2.1-2.3 4.1-3.4 5.8-3.3 1.5.1 2.5 1 3.8.9 1.1 0 2-.6 2.8-1.7"></path>
        <circle cx="16.8" cy="12" r="3.3"></circle>
        <circle cx="16.8" cy="12" r=".8"></circle>
      </svg>
    `,
    continuity: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 14.8c3-3.5 5.8-5.2 8.2-5.1 2.1.1 3.4 1.5 5.3 1.4"></path>
        <path d="M17 7.2l2.8 3.8-3.8 2.8"></path>
        <path d="M7.2 18.4A7.5 7.5 0 0 1 8 5.8"></path>
      </svg>
    `,
    innerlife: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.3 6.4A6.8 6.8 0 1 0 15.3 17.6"></path>
        <path d="M8.2 15.1c1.9-1.9 3.7-2.8 5.2-2.7 1.2.1 2 .8 3.1.8"></path>
        <path d="M17.2 9.2c1.8 1.1 1.8 4.5 0 5.6"></path>
        <circle cx="16.3" cy="12" r="1.2"></circle>
      </svg>
    `
  };
  return icons[module.id] || icons.gateway;
}

function moduleDetails(module) {
  const snapshot = getSnapshot();
  if (module.state === "planned") {
    return [
      [t("common.status"), t("common.planned")],
      [t("home.model.mode"), formatMode(snapshot?.mode)],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "gateway") {
    return [
      [t("module.gateway.address"), t("module.gateway.localGateway")],
      [t("module.gateway.protocol"), "MCP"],
      [t("module.gateway.auth"), t("common.local")],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "memoria") {
    const stats = snapshot?.memoryStats || {};
    const maintenance = snapshot?.memoryMaintenance || {};
    const vectorSummary = `${stats.embeddedCount ?? 0} / ${stats.pendingEmbeddingCount ?? 0}${stats.failedEmbeddingCount ? ` / ${stats.failedEmbeddingCount}` : ""}`;
    return [
      [t("module.memoria.agentSurface"), t("module.memoria.readyForAgents")],
      [t("module.memoria.records"), `${stats.activeCount ?? 0} / ${stats.totalCount ?? 0}`],
      [t("module.memoria.vectors"), vectorSummary],
      [t("module.memoria.restricted"), String(stats.restrictedCount ?? 0)],
      [t("module.memoria.maintenance"), maintenance.status === "ok" ? t("common.ok") : t("common.needsAttention")]
    ];
  }
  if (module.id === "continuity") {
    return [
      [t("home.model.provider"), t("common.sqlite")],
      [t("module.continuity.role"), t("module.continuity.sharedLine")],
      [t("common.status"), module.present ? t("common.ok") : t("common.missing")],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "innerlife") {
    const innerLife = snapshot?.innerLife || {};
    const counts = innerLife.counts || {};
    const daemon = innerLife.daemon || {};
    const agentIds = [
      ...(innerLife.sessions || []).map(itemAgentId),
      ...(innerLife.digestRuns || []).map(itemAgentId),
      ...(innerLife.inbox || []).map(itemAgentId),
      ...(innerLife.pendingShares || []).map(itemAgentId),
      ...(innerLife.recentShares || []).map(itemAgentId)
    ];
    const agentCount = new Set(agentIds.filter(Boolean)).size;
    return [
      [t("module.innerlife.agentSurface"), "MCP + CLI"],
      [t("module.innerlife.agents"), String(agentCount)],
      [t("module.innerlife.inbox"), `${counts.pending_inbox_count ?? 0} / ${counts.processed_inbox_count ?? 0}`],
      [t("module.innerlife.shares"), `${counts.pending_shares_count ?? 0} / ${counts.used_shares_count ?? 0}`],
      [t("module.innerlife.sessions"), `${counts.active_sessions_count ?? 0} / ${counts.ended_sessions_count ?? 0}`],
      [t("module.innerlife.daemon"), daemon.enabled ? (daemon.status || t("common.ready")) : t("common.paused")]
    ];
  }
  return [
    [t("common.status"), t("common.paused")],
    [t("module.innerlife.reason"), t("common.manual")],
    [t("module.innerlife.nextRun"), t("module.innerlife.whenEnabled")],
    [t("common.path"), module.servicePath]
  ];
}

function renderModules(modules) {
  moduleGrid.innerHTML = modules
    .map((module) => {
      const details = moduleDetails(module)
        .map(
          ([label, value]) => `
            <div class="module-detail">
              <span>${label}</span>
              <strong>${value}</strong>
            </div>
          `
        )
        .join("");
      return `
        <article class="module-card ${module.id} ${moduleTone(module)}">
          <header>
            <div class="module-icon">${moduleIcon(module)}</div>
            <div>
              <strong>${module.label}</strong>
              <p>${t(`module.${module.id}.description`)}</p>
            </div>
            ${serviceBadge(module)}
          </header>
          <div class="module-details">${details}</div>
        </article>
      `;
    })
    .join("");
}

function renderEvents() {
  const snapshot = getSnapshot();
  if (!snapshot) return;
  const plannedModules = snapshot.modules.filter((module) => module.state === "planned");
  const requiredMissing = snapshot.modules.filter((module) => module.required && !module.present && module.state !== "planned");
  const innerLife = snapshot.modules.find((module) => module.id === "innerlife");
  const events = [
    {
      title:
        plannedModules.length > 0
          ? t("event.requiredFound.title")
          : requiredMissing.length === 0
            ? t("event.requiredFound.title")
            : t("event.requiredMissing.title"),
      detail:
        plannedModules.length > 0
          ? t("event.requiredFound.detail")
          : requiredMissing.length === 0
            ? t("event.requiredFound.detail")
          : requiredMissing.map((module) => module.label).join(", ")
    },
    {
      title: snapshot.data.databasePresent ? t("event.memoryFound.title") : t("event.memoryMissing.title"),
      detail: snapshot.data.databasePath
    },
    {
      title: innerLife?.present ? t("event.innerLifeFound.title") : t("event.innerLifeMissing.title"),
      detail: t("event.innerLife.detail")
    }
  ];

  eventList.innerHTML = events
    .map(
      (event) => `
        <li>
          <strong>${event.title}</strong>
          <span>${event.detail}</span>
        </li>
      `
    )
    .join("");
}

function homeSystemSnapshots() {
  const snapshot = getSnapshot();
  const stats = snapshot?.memoryStats || {};
  const maintenance = snapshot?.memoryMaintenance || {};
  const firstMemoryIssue = (maintenance.issues || [])[0];
  const sharedLine = snapshot?.sharedLine || {};
  const lines = sharedLine.lines || [];
  const activeLines = lines.filter((line) => line.status !== "archived");
  const handoffs = sharedLine.handoffs || [];
  const innerLife = snapshot?.innerLife || {};
  const counts = innerLife.counts || {};
  const daemon = innerLife.daemon || {};
  const agentIds = new Set(
    [
      ...lines.map((line) => safeJsonObject(line.metadata, {}).agentId || line.agentId),
      ...(innerLife.sessions || []).map(itemAgentId),
      ...(innerLife.digestRuns || []).map(itemAgentId),
      ...(innerLife.inbox || []).map(itemAgentId),
      ...(innerLife.pendingShares || []).map(itemAgentId),
      ...(innerLife.recentShares || []).map(itemAgentId)
    ].filter(Boolean)
  );
  return [
    {
      id: "gateway",
      title: t("home.cognitive.gateway"),
      health: "ok",
      rows: [
        [t("home.cognitive.surface"), "stdio MCP"],
        [t("home.cognitive.mcpTools"), t("home.cognitive.gatewayToolsReady")],
        [t("home.cognitive.lifecycle"), t("home.cognitive.gatewayLifecycleReady")],
        [t("home.cognitive.next"), t("home.cognitive.gatewayNext")]
      ]
    },
    {
      id: "memoria",
      title: t("home.cognitive.memoria"),
      health: maintenance.status === "ok" ? "ok" : "warn",
      rows: [
        [t("home.cognitive.totalMemories"), stats.totalCount ?? 0],
        [t("home.cognitive.activeMemories"), stats.activeCount ?? 0],
        [t("home.cognitive.labels"), Array.isArray(stats.labels) ? stats.labels.length : 0],
        [t("home.cognitive.vectors"), `${stats.embeddedCount ?? 0}/${stats.pendingEmbeddingCount ?? 0}`],
        maintenance.status === "ok"
          ? [t("home.cognitive.maintenance"), t("common.ok")]
          : [t("home.cognitive.issue"), `${firstMemoryIssue?.code || maintenance.status} ${firstMemoryIssue?.count ?? ""}`.trim()]
      ]
    },
    {
      id: "shared-line",
      title: t("home.cognitive.sharedLine"),
      health: sharedLine.currentPosition?.summary ? "ok" : "warn",
      rows: [
        [t("home.cognitive.totalLines"), lines.length],
        [t("home.cognitive.activeLines"), activeLines.length],
        [t("home.cognitive.handoffs"), handoffs.length],
        [t("home.cognitive.agents"), agentIds.size]
      ]
    },
    {
      id: "innerlife",
      title: t("home.cognitive.innerLife"),
      health: daemon.status === "error" ? "error" : daemon.enabled ? "ok" : "warn",
      rows: [
        [t("home.cognitive.pendingShares"), counts.pending_shares_count ?? 0],
        [t("home.cognitive.activeEvents"), counts.events_count ?? 0],
        [t("home.cognitive.sessions"), counts.active_sessions_count ?? 0],
        [t("home.cognitive.daemon"), daemon.enabled ? daemon.status || t("common.ready") : t("common.paused")]
      ]
    }
  ];
}

function homeAgentIds() {
  const snapshot = getSnapshot();
  const sharedLine = snapshot?.sharedLine || {};
  const innerLife = snapshot?.innerLife || {};
  const ids = [
    ...(sharedLine.lines || []).map((line) => safeJsonObject(line.metadata, {}).agentId || line.agentId),
    ...(innerLife.sessions || []).map(itemAgentId),
    ...(innerLife.digestRuns || []).map(itemAgentId),
    ...(innerLife.inbox || []).map(itemAgentId),
    ...(innerLife.pendingShares || []).map(itemAgentId),
    ...(innerLife.recentShares || []).map(itemAgentId),
    ...(snapshot?.gatewayTraces || []).map((trace) => trace.agentId)
  ].filter(Boolean);
  const unique = [...new Set(ids)];
  const priority = ["clara", "lara"].filter((agentId) => unique.includes(agentId));
  const rest = unique.filter((agentId) => !priority.includes(agentId));
  if (unique.length) return [...priority, ...rest].slice(0, 2);
  return ["codex"];
}

function compactHomeText(value, max = 118) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[•·]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] || "";
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function memoryMatchesAgent(memory, agentId) {
  const labels = Array.isArray(memory.labels) ? memory.labels : [];
  return labels.some((label) => label === `agent:${agentId}` || label === `agent-id:${agentId}` || label.endsWith(`:${agentId}`));
}

function latestAgentText(items, agentId, fields) {
  const match = (items || []).find((item) => itemAgentId(item) === agentId);
  if (!match) return "";
  for (const field of fields) {
    if (match[field]) return String(match[field]);
  }
  return "";
}

function homeAgentView(agentId) {
  const snapshot = getSnapshot();
  const sharedLine = snapshot?.sharedLine || {};
  const lines = sharedLine.lines || [];
  const current = lines.find((line) => {
    const metadata = safeJsonObject(line.metadata, {});
    return (metadata.agentId || line.agentId) === agentId && line.status !== "archived";
  }) || (sharedLine.line?.status !== "archived" ? sharedLine.line : null);
  const innerLife = snapshot?.innerLife || {};
  const sessions = filterByAgent(innerLife.sessions || [], agentId);
  const activeSession = sessions.find((session) => session.status === "active") || sessions[0];
  const pendingShares = filterByAgent(innerLife.pendingShares || [], agentId);
  const traces = (snapshot?.gatewayTraces || []).filter((trace) => trace.agentId === agentId);
  const matchedMemories = (snapshot?.memories || []).filter((memory) => memoryMatchesAgent(memory, agentId));
  const recentFocus =
    latestAgentText(pendingShares, agentId, ["summary", "content", "body", "thought", "output"]) ||
    latestAgentText(filterByAgent(innerLife.inbox || [], agentId), agentId, ["body", "summary", "content"]);
  return {
    agentId,
    displayName: agentId,
    lineTitle: current?.title || t("home.agentView.noActiveLine"),
    lineBody: compactHomeText(current?.summary || sharedLine.currentPosition?.summary) || t("home.agentView.noCurrentPosition"),
    recalledMemories: matchedMemories.length,
    pendingThoughts: pendingShares.length,
    gatewayDecisions: traces.length,
    currentScene: activeSession ? activeSession.host || activeSession.externalSessionId || activeSession.id : t("home.agentView.none"),
    recentFocus: recentFocus || t("home.agentView.none")
  };
}

function renderHomeDashboard() {
  const snapshot = getSnapshot();
  if (!snapshot) return;
  homeCognitiveUpdated.textContent = t("home.cognitive.updated");
  homeCognitiveSystems.innerHTML = homeSystemSnapshots()
    .map(
      (system) => `
        <article class="cognitive-system-card ${escapeHtml(system.health)}">
          <div class="cognitive-system-title">
            <strong>${escapeHtml(system.title)}</strong>
            <span class="badge ${escapeHtml(system.health === "error" ? "missing" : system.health === "warn" || system.health === "planned" ? "planned" : "ok")}">${escapeHtml(system.health === "planned" ? t("common.planned") : system.health)}</span>
          </div>
          <div class="cognitive-system-rows">
            ${system.rows
              .map(
                ([label, value]) => `
                  <div class="kv-row">
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");

  homeAgentViewList.innerHTML = homeAgentIds()
    .map(homeAgentView)
    .map(
      (agent) => `
        <article class="home-agent-card">
          <div class="home-agent-head">
            <strong>${escapeHtml(agent.displayName)}</strong>
            <span>${escapeHtml(agent.lineTitle)}</span>
          </div>
          <p>${escapeHtml(agent.lineBody)}</p>
          <div class="home-agent-stats">
            <div><span>${escapeHtml(t("home.agentView.recalledMemories"))}</span><strong>${escapeHtml(agent.recalledMemories)}</strong></div>
            <div><span>${escapeHtml(t("home.agentView.pendingThoughts"))}</span><strong>${escapeHtml(agent.pendingThoughts)}</strong></div>
            <div><span>${escapeHtml(t("home.agentView.gatewayDecisions"))}</span><strong>${escapeHtml(agent.gatewayDecisions)}</strong></div>
          </div>
          <div class="home-agent-meta">
            <div><span>${escapeHtml(t("home.agentView.currentScene"))}</span><strong>${escapeHtml(agent.currentScene)}</strong></div>
            <div><span>${escapeHtml(t("home.agentView.recentFocus"))}</span><strong>${escapeHtml(agent.recentFocus)}</strong></div>
          </div>
        </article>
      `
    )
    .join("");

  const traces = snapshot.gatewayTraces || [];
  if (!traces.length) {
    homeTraceList.innerHTML = `<div class="endpoint-empty">${t("home.trace.empty")}</div>`;
  } else {
    homeTraceList.innerHTML = traces
      .slice(0, 5)
      .map(
        (trace) => `
          <article class="home-trace-row ${escapeHtml(trace.status || "")}">
            <div>
              <strong>${escapeHtml(trace.toolName || "unknown")}</strong>
              <span>${escapeHtml(trace.error || trace.responseSummary || "")}</span>
            </div>
            <code>${escapeHtml(trace.status || "ok")} · ${escapeHtml(String(trace.durationMs ?? 0))}ms</code>
          </article>
        `
      )
      .join("");
  }
}

function renderHealth() {
  const snapshot = getSnapshot();
  const health = snapshot?.health;
  if (!health) return;
  healthSummary.textContent = t(`health.${health.status}`) || health.status;
  healthSummary.className = `quiet health-summary ${health.status}`;
  healthList.innerHTML = (health.checks || [])
    .map((check) => {
      const level = check.level || "warn";
      return `
        <div class="health-item ${escapeHtml(level)}">
          <span class="health-dot"></span>
          <div>
            <strong>${escapeHtml(t(check.labelKey) || check.id)}</strong>
            <small>${escapeHtml(check.detail || "")}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderConnections() {
  const snapshot = getSnapshot();
  if (!snapshot?.connections) return;
  mcpCommand.textContent = snapshot.connections.mcpCommand;
  mcpConfig.textContent = snapshot.connections.mcpConfig;
  const traces = snapshot.gatewayTraces || [];
  if (traces.length === 0) {
    gatewayTraceList.innerHTML = `<div class="endpoint-empty">${t("connections.noGatewayTraces")}</div>`;
  } else {
    gatewayTraceList.innerHTML = traces
      .slice(0, 8)
      .map(
        (trace) => `
          <div class="endpoint-card trace-card ${escapeHtml(trace.status || "")}">
            <div>
              <strong>${escapeHtml(trace.toolName || "")}</strong>
              <code>${escapeHtml(trace.status || "")} · ${escapeHtml(String(trace.durationMs ?? 0))}ms</code>
              <span>${escapeHtml(trace.error || trace.responseSummary || "")}</span>
              <small>${escapeHtml(trace.createdAt || "")}</small>
            </div>
          </div>
        `
      )
      .join("");
  }
  const endpoints = snapshot.connections.httpEndpoints || [];
  if (endpoints.length === 0) {
    httpEndpointList.innerHTML = `<div class="endpoint-empty">${t("connections.noEndpoints")}</div>`;
    return;
  }
  httpEndpointList.innerHTML = endpoints
    .map(
      (endpoint) => {
        const label = t(`connections.endpoint.${endpoint.id}`) || endpoint.id;
        const openUrl = endpoint.openUrl || endpoint.url;
        const copyUrl = endpoint.copyUrl || endpoint.url;
        const detail = [endpoint.method, endpoint.auth === "bearer-token" ? t("connections.auth.bearer") : "", endpoint.bind]
          .filter(Boolean)
          .join(" · ");
        return `
        <div class="endpoint-card">
          <div>
            <strong>${escapeHtml(label)}</strong>
            <code>${escapeHtml(endpoint.url)}</code>
            <span>${escapeHtml(detail || endpoint.healthUrl || "")}</span>
          </div>
          <div class="endpoint-actions">
            <button class="secondary" data-open-url="${escapeHtml(openUrl)}">${t("actions.open")}</button>
            <button class="secondary" data-copy-url="${escapeHtml(copyUrl)}">${t("actions.copy")}</button>
          </div>
        </div>
      `;
      }
    )
    .join("");
}

  return {
    renderModules,
    renderEvents,
    renderHomeDashboard,
    renderHealth,
    renderConnections
  };
}

window.createClaraCoreHomeView = createClaraCoreHomeView;
