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
    homeRuntimePanel,
    homeRuntimeStatus,
    homeRuntimeDetail,
    homeRuntimeStrip,
    homeAttentionSummary,
    homeAttentionList,
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

  function moduleTarget(moduleId) {
    return {
      gateway: "agent-setup",
      memoria: "memory",
      continuity: "shared-line",
      innerlife: "innerlife"
    }[moduleId] || "home";
  }

  function moduleLabel(module) {
    return t(`home.moduleLabel.${module.id}`) || module.label;
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
        [t("home.model.mode"), formatMode(snapshot?.mode)]
      ];
    }
    if (module.id === "gateway") {
      const traces = snapshot?.gatewayTraces || [];
      const errors = traces.filter((trace) => trace.status === "error").length;
      return [
        [t("home.cognitive.surface"), "stdio MCP"],
        [t("home.gateway.calls"), String(traces.length)],
        [t("home.gateway.errors"), String(errors)]
      ];
    }
    if (module.id === "memoria") {
      const stats = snapshot?.memoryStats || {};
      const maintenance = snapshot?.memoryMaintenance || {};
      return [
        [t("module.memoria.records"), `${stats.activeCount ?? 0} / ${stats.totalCount ?? 0}`],
        [t("module.memoria.vectors"), `${stats.embeddedCount ?? 0} / ${stats.pendingEmbeddingCount ?? 0}`],
        [t("module.memoria.maintenance"), maintenance.status === "ok" ? t("common.ok") : t("common.needsAttention")]
      ];
    }
    if (module.id === "continuity") {
      const sharedLine = snapshot?.sharedLine || {};
      const lines = sharedLine.lines || [];
      const activeLines = lines.filter((line) => line.status !== "archived");
      return [
        [t("home.cognitive.activeLines"), String(activeLines.length)],
        [t("home.cognitive.handoffs"), String((sharedLine.handoffs || []).length)],
        [t("common.status"), sharedLine.currentPosition?.summary ? t("common.ready") : t("common.needsAttention")]
      ];
    }
    if (module.id === "innerlife") {
      const innerLife = snapshot?.innerLife || {};
      const counts = innerLife.counts || {};
      const daemon = innerLife.daemon || {};
      return [
        [t("module.innerlife.shares"), `${counts.pending_shares_count ?? 0} / ${counts.used_shares_count ?? 0}`],
        [t("module.innerlife.sessions"), `${counts.active_sessions_count ?? 0} / ${counts.ended_sessions_count ?? 0}`],
        [t("module.innerlife.daemon"), daemon.enabled ? (daemon.status || t("common.ready")) : t("common.paused")]
      ];
    }
    return [[t("common.status"), t("common.paused")]];
  }

  function renderModules(modules) {
    moduleGrid.innerHTML = modules
      .map((module) => {
        const details = moduleDetails(module)
          .map(
            ([label, value]) => `
              <div class="module-detail">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </div>
            `
          )
          .join("");
        return `
          <article class="module-card ${escapeHtml(module.id)} ${moduleTone(module)}">
            <header>
              <div class="module-icon">${moduleIcon(module)}</div>
              <div>
                <strong>${escapeHtml(moduleLabel(module))}</strong>
                <p>${escapeHtml(t(`module.${module.id}.description`))}</p>
              </div>
              ${serviceBadge(module)}
            </header>
            <div class="module-details">${details}</div>
            <button class="link-button" data-view-target="${escapeHtml(moduleTarget(module.id))}">${escapeHtml(t("home.modules.open"))}</button>
          </article>
        `;
      })
      .join("");
  }

  function runtimeMetricItems() {
    const snapshot = getSnapshot();
    const stats = snapshot?.memoryStats || {};
    const sharedLine = snapshot?.sharedLine || {};
    const innerLife = snapshot?.innerLife || {};
    const counts = innerLife.counts || {};
    const gatewayErrors = (snapshot?.gatewayTraces || []).filter((trace) => trace.status === "error").length;
    const healthStatus = snapshot?.health?.status || "warn";
    return [
      {
        id: "core",
        label: t("home.runtime.core"),
        value: healthStatus === "ok" ? t("common.ready") : t("common.needsAttention"),
        tone: healthStatus === "error" ? "error" : healthStatus === "ok" ? "ok" : "warn"
      },
      {
        id: "gateway",
        label: t("home.cognitive.gateway"),
        value: gatewayErrors ? `${gatewayErrors} ${t("home.gateway.errors")}` : t("home.runtime.agentReady"),
        tone: gatewayErrors ? "error" : "ok"
      },
      {
        id: "memoria",
        label: t("home.cognitive.memoria"),
        value: `${stats.activeCount ?? 0} / ${stats.pendingEmbeddingCount ?? 0}`,
        tone: stats.failedEmbeddingCount ? "error" : stats.pendingEmbeddingCount ? "warn" : "ok"
      },
      {
        id: "shared-line",
        label: t("home.cognitive.sharedLine"),
        value: sharedLine.currentPosition?.summary ? t("common.ready") : t("home.agentView.noActiveLine"),
        tone: sharedLine.currentPosition?.summary ? "ok" : "warn"
      },
      {
        id: "innerlife",
        label: t("home.cognitive.innerLife"),
        value: `${counts.pending_shares_count ?? 0} ${t("home.cognitive.pendingShares")}`,
        tone: innerLife.daemon?.status === "error" ? "error" : counts.pending_shares_count ? "warn" : "ok"
      }
    ];
  }

  function renderRuntimeOverview() {
    const snapshot = getSnapshot();
    if (!snapshot) return;
    const healthStatus = snapshot.health?.status || "warn";
    const orbState = runtimeOrbState(snapshot);
    if (homeRuntimePanel) {
      homeRuntimePanel.dataset.orbState = orbState;
    }
    homeRuntimeStatus.textContent =
      healthStatus === "ok" ? t("common.ready") : healthStatus === "error" ? t("status.healthError") : t("common.needsAttention");
    homeRuntimeStatus.className = `runtime-state ${healthStatus === "ok" ? "ok" : healthStatus === "error" ? "error" : "warn"}`;
    homeRuntimeDetail.textContent = `${formatMode(snapshot.mode)} · ${snapshot.data?.databasePresent ? t("status.databaseReady") : t("status.databaseMissing")}`;
    homeRuntimeStrip.innerHTML = runtimeMetricItems()
      .map(
        (item) => `
          <article class="runtime-metric ${escapeHtml(item.tone)}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </article>
        `
      )
      .join("");
  }

  function runtimeOrbState(snapshot) {
    const traces = snapshot?.gatewayTraces || [];
    const counts = snapshot?.innerLife?.counts || {};
    const daemon = snapshot?.innerLife?.daemon || {};
    const stats = snapshot?.memoryStats || {};
    const hasError =
      snapshot?.health?.status === "error" ||
      daemon.status === "error" ||
      traces.some((trace) => trace.status === "error") ||
      Boolean(stats.failedEmbeddingCount);
    if (hasError) return "error";

    const pendingWork =
      snapshot?.health?.status === "warn" ||
      Boolean(stats.pendingEmbeddingCount) ||
      Boolean(counts.pending_shares_count) ||
      Boolean(counts.pending_inbox_count);
    if (pendingWork) return "warning";

    const activeWork =
      traces.length > 0 ||
      Boolean(counts.active_sessions_count) ||
      Boolean((snapshot?.sharedLine?.currentPosition || {}).summary);
    if (activeWork) return "active";

    return "quiet";
  }

  function attentionItems() {
    const snapshot = getSnapshot();
    const items = [];
    const healthChecks = snapshot?.health?.checks || [];
    healthChecks
      .filter((check) => check.level && check.level !== "ok")
      .slice(0, 4)
      .forEach((check) => {
        items.push({
          tone: check.level === "error" ? "error" : "warn",
          title: t(check.labelKey) || check.id,
          detail: check.detail || t("common.needsAttention")
        });
      });

    const stats = snapshot?.memoryStats || {};
    if (stats.failedEmbeddingCount) {
      items.push({
        tone: "error",
        title: t("home.attention.embeddingFailed"),
        detail: `${stats.failedEmbeddingCount} ${t("home.attention.items")}`
      });
    } else if (stats.pendingEmbeddingCount) {
      items.push({
        tone: "warn",
        title: t("home.attention.embeddingPending"),
        detail: `${stats.pendingEmbeddingCount} ${t("home.attention.items")}`
      });
    }

    const maintenance = snapshot?.memoryMaintenance || {};
    if (maintenance.status && maintenance.status !== "ok") {
      const issue = (maintenance.issues || [])[0];
      items.push({
        tone: "warn",
        title: t("module.memoria.maintenance"),
        detail: `${issue?.code || maintenance.status} ${issue?.count ?? ""}`.trim()
      });
    }

    const daemon = snapshot?.innerLife?.daemon || {};
    if (daemon.status === "error") {
      items.push({
        tone: "error",
        title: t("module.innerlife.daemon"),
        detail: daemon.lastError || t("status.healthError")
      });
    }

    const traceError = (snapshot?.gatewayTraces || []).find((trace) => trace.status === "error");
    if (traceError) {
      items.push({
        tone: "error",
        title: t("home.trace.title"),
        detail: traceError.error || traceError.toolName || t("status.healthError")
      });
    }

    return items.slice(0, 5);
  }

  function renderAttentionQueue() {
    const items = attentionItems();
    homeAttentionSummary.textContent = items.length ? `${items.length} ${t("common.needsAttention")}` : t("home.attention.clear");
    if (!items.length) {
      homeAttentionList.innerHTML = `
        <div class="attention-empty">
          <span class="attention-dot"></span>
          <div>
            <strong>${escapeHtml(t("home.attention.clear"))}</strong>
            <small>${escapeHtml(t("home.attention.clearBody"))}</small>
          </div>
        </div>
      `;
      return;
    }
    homeAttentionList.innerHTML = items
      .map(
        (item) => `
          <article class="attention-item ${escapeHtml(item.tone)}">
            <span class="attention-dot"></span>
            <div>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.detail)}</small>
            </div>
          </article>
        `
      )
      .join("");
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

  function compactHomeText(value, max = 150) {
    const text = String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/[•·]/g, " ")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0] || "";
    const compact = text.replace(/\s+/g, " ").trim();
    return compact.length > max ? `${compact.slice(0, max - 1)}...` : compact;
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
    renderRuntimeOverview();
    renderAttentionQueue();

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

    const traces = [...(snapshot.gatewayTraces || [])].sort((a, b) => (a.status === "error" ? -1 : 0) - (b.status === "error" ? -1 : 0));
    if (!traces.length) {
      homeTraceList.innerHTML = `<div class="endpoint-empty">${escapeHtml(t("home.trace.empty"))}</div>`;
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

  function eventDetail(event) {
    const metadata = safeJsonObject(event.metadataJson || event.metadata_json || event.metadata, {});
    return metadata.action || metadata.backupId || metadata.path || event.createdAt || "";
  }

  function renderEvents() {
    const snapshot = getSnapshot();
    if (!snapshot) return;
    const events = snapshot.runtimeEvents || [];
    if (!events.length) {
      eventList.innerHTML = `
        <li>
          <strong>${escapeHtml(t("home.events.empty"))}</strong>
          <span>${escapeHtml(t("home.events.emptyBody"))}</span>
        </li>
      `;
      return;
    }
    eventList.innerHTML = events
      .slice(0, 6)
      .map(
        (event) => `
          <li class="${escapeHtml(event.level || "info")}">
            <strong>${escapeHtml(event.message || event.source || t("home.events.title"))}</strong>
            <span>${escapeHtml(event.source || "")}${eventDetail(event) ? ` · ${escapeHtml(eventDetail(event))}` : ""}</span>
          </li>
        `
      )
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
