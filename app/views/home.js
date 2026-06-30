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
    agentIdentityList,
    gatewayHandshakeList,
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
      const errors = actionableGatewayErrors(traces).length;
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
      const archivedLines = sharedLine.archivedLines || [];
      return [
        [t("home.cognitive.activeLines"), String(activeLines.length)],
        [t("sharedLine.stats.archived"), String(archivedLines.length)],
        [t("sharedLine.stats.history"), String((sharedLine.history || []).length)]
      ];
    }
    if (module.id === "innerlife") {
      const innerLife = snapshot?.innerLife || {};
      const counts = innerLife.counts || {};
      const daemon = innerLife.daemon || {};
      const daemonStatus = daemon.enabled ? (t(`innerLife.state.${daemon.status}`) || daemon.status || t("common.ready")) : t("common.paused");
      return [
        [t("module.innerlife.shares"), `${counts.pending_shares_count ?? 0} / ${counts.used_shares_count ?? 0}`],
        [t("module.innerlife.sessions"), `${counts.active_sessions_count ?? 0} / ${counts.ended_sessions_count ?? 0}`],
        [t("module.innerlife.daemon"), daemonStatus]
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
    const gatewayErrors = actionableGatewayErrors(snapshot?.gatewayTraces || []).length;
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
      actionableGatewayErrors(traces).length > 0 ||
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
      const issueKey = issue?.code ? `memory.maintenance.${issue.code}` : "";
      items.push({
        tone: "warn",
        title: issueKey ? t(issueKey) : t("module.memoria.maintenance"),
        detail: t("home.attention.memoryMaintenanceDetail", {
          count: issue?.count ?? "",
          action: t("memory.embedding.processPending")
        }),
        actionCommand: "memory-vectors",
        actionLabel: t("home.attention.rebuildMemoryVectors")
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

    const traceError = actionableGatewayErrors(snapshot?.gatewayTraces || [])[0];
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
              ${item.actionCommand ? `<button class="link-button attention-action" data-attention-action="${escapeHtml(item.actionCommand)}">${escapeHtml(item.actionLabel || t("actions.open"))}</button>` : ""}
              ${item.actionView ? `<button class="link-button attention-action" data-view-target="${escapeHtml(item.actionView)}">${escapeHtml(item.actionLabel || t("actions.open"))}</button>` : ""}
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
    const innerLifeProfileIds = (innerLife.profiles || []).map((profile) => profile.agentId || profile.agent_id).filter(Boolean);
    const ids = [
      ...innerLifeProfileIds,
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
    return labels.some((label) =>
      agentAliases(agentId).some((alias) => label === `agent:${alias}` || label === `agent-id:${alias}` || label.endsWith(`:${alias}`))
    );
  }

  function agentAliases(agentId) {
    const raw = String(agentId || "").trim();
    const tail = raw.split(":").filter(Boolean).pop() || "";
    return [...new Set([raw, tail].filter(Boolean))];
  }

  function sameAgent(left, right) {
    if (!left || !right) return false;
    const leftAliases = new Set(agentAliases(left));
    return agentAliases(right).some((alias) => leftAliases.has(alias));
  }

  function filterByAgentAlias(items, agentId, getter = itemAgentId) {
    if (!agentId) return items || [];
    return (items || []).filter((item) => sameAgent(getter(item), agentId));
  }

  function hasAgentShareMatch(shares, agentIds) {
    return (shares || []).some((share) => (agentIds || []).some((agentId) => sameAgent(itemAgentId(share), agentId)));
  }

  function latestAgentText(items, agentId, fields) {
    const match = (items || []).find((item) => sameAgent(itemAgentId(item), agentId));
    if (!match) return "";
    for (const field of fields) {
      if (match[field]) return String(match[field]);
    }
    return "";
  }

  function homeAgentView(agentId, options = {}) {
    const snapshot = getSnapshot();
    const sharedLine = snapshot?.sharedLine || {};
    const lines = sharedLine.lines || [];
    const current = lines.find((line) => {
      const metadata = safeJsonObject(line.metadata, {});
      return sameAgent(metadata.agentId || line.agentId, agentId) && line.status !== "archived";
    }) || (sharedLine.line?.status !== "archived" ? sharedLine.line : null);
    const innerLife = snapshot?.innerLife || {};
    const sessions = filterByAgentAlias(innerLife.sessions || [], agentId);
    const activeSession = sessions.find((session) => session.status === "active") || sessions[0];
    const allPendingShares = innerLife.pendingShares || [];
    const agentPendingShares = filterByAgentAlias(allPendingShares, agentId);
    const pendingShares = agentPendingShares.length || !options.useGlobalPendingFallback ? agentPendingShares : allPendingShares;
    const traces = filterByAgentAlias(snapshot?.gatewayTraces || [], agentId, (trace) => trace.agentId);
    const recentMemories = snapshot?.recentMemories || snapshot?.memories || [];
    const matchedMemories = recentMemories.filter((memory) => memoryMatchesAgent(memory, agentId));
    const recentFocus =
      latestAgentText(pendingShares, agentId, ["summary", "content", "body", "thought", "output"]) ||
      latestAgentText(filterByAgentAlias(innerLife.inbox || [], agentId), agentId, ["body", "summary", "content"]);
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

  function truncateTraceText(value, maxLength = 150) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
  }

  function traceResponseText(trace) {
    const raw = trace.error || trace.responseSummary || "";
    const parsed = safeJsonObject(raw, null);
    if (parsed) {
      const parts = [];
      if (Object.prototype.hasOwnProperty.call(parsed, "ok")) {
        parts.push(parsed.ok ? t("home.trace.resultOk") : t("home.trace.resultError"));
      }
      if (parsed.transport) parts.push(`${t("home.trace.transport")} ${parsed.transport}`);
      if (parsed.server?.name) parts.push(parsed.server.name);
      if (parsed.modules) {
        const modules = Object.entries(parsed.modules)
          .slice(0, 4)
          .map(([key, value]) => `${key}:${value}`)
          .join(" / ");
        if (modules) parts.push(modules);
      }
      if (parsed.database?.initialized !== undefined) {
        parts.push(parsed.database.initialized ? t("home.trace.databaseReady") : t("home.trace.databasePending"));
      }
      if (parts.length) return truncateTraceText(parts.join(" · "));
    }
    return truncateTraceText(raw);
  }

  function traceRequestText(trace) {
    const request = trace.request && typeof trace.request === "object" ? trace.request : {};
    const entries = Object.entries(request).filter(([key, value]) => key !== "agentId" && value !== undefined && value !== null && String(value) !== "");
    if (!entries.length) return t("home.trace.noRequest");
    return truncateTraceText(
      entries
        .slice(0, 3)
        .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
        .join(" · "),
      90
    );
  }

  function renderTraceFlow(trace) {
    const status = trace.status === "error" ? "error" : "ok";
    const statusText = status === "error" ? t("home.trace.statusError") : t("home.trace.statusOk");
    const agentId = trace.agentId || t("home.trace.unknownAgent");
    const toolName = trace.toolName || t("home.trace.unknownTool");
    const responseText = traceResponseText(trace) || (status === "error" ? t("home.trace.resultError") : t("home.trace.resultOk"));
    return `
      <article class="home-trace-flow ${escapeHtml(status)}">
        <header class="trace-flow-head">
          <div>
            <strong>${escapeHtml(toolName)}</strong>
            <span>${escapeHtml(agentId)}</span>
          </div>
          <code>${escapeHtml(statusText)} · ${escapeHtml(String(trace.durationMs ?? 0))}ms</code>
        </header>
        <div class="trace-chain" aria-label="${escapeHtml(t("home.trace.chain"))}">
          <div class="trace-node agent">
            <span class="trace-node-dot"></span>
            <small>${escapeHtml(t("home.trace.agent"))}</small>
            <strong>${escapeHtml(agentId)}</strong>
          </div>
          <span class="trace-link"></span>
          <div class="trace-node gateway">
            <span class="trace-node-dot"></span>
            <small>${escapeHtml(t("home.trace.gateway"))}</small>
            <strong>${escapeHtml(t("home.trace.desktopGateway"))}</strong>
          </div>
          <span class="trace-link"></span>
          <div class="trace-node tool">
            <span class="trace-node-dot"></span>
            <small>${escapeHtml(t("home.trace.tool"))}</small>
            <strong>${escapeHtml(toolName)}</strong>
          </div>
          <span class="trace-link"></span>
          <div class="trace-node result ${escapeHtml(status)}">
            <span class="trace-node-dot"></span>
            <small>${escapeHtml(t("home.trace.result"))}</small>
            <strong>${escapeHtml(statusText)}</strong>
          </div>
        </div>
        <div class="trace-flow-detail">
          <div>
            <span>${escapeHtml(t("home.trace.request"))}</span>
            <strong>${escapeHtml(traceRequestText(trace))}</strong>
          </div>
          <div>
            <span>${escapeHtml(t("home.trace.response"))}</span>
            <strong>${escapeHtml(responseText)}</strong>
          </div>
        </div>
        <small class="trace-flow-time">${escapeHtml(formatRelativeTime(traceTimestamp(trace)))}</small>
      </article>
    `;
  }

  function traceTimeValue(trace) {
    return traceTimestamp(trace);
  }

  function traceRequest(trace) {
    return trace?.request && typeof trace.request === "object" ? trace.request : {};
  }

  function traceResolutionKey(trace) {
    const request = traceRequest(trace);
    const target =
      request.lineId ||
      request.line_id ||
      request.id ||
      request.memoryId ||
      request.memory_id ||
      request.sessionId ||
      request.session_id ||
      request.shareId ||
      request.share_id ||
      "";
    if (!target) return "";
    return [trace.agentId || "", trace.toolName || "", String(target)].join("::");
  }

  function resolvedGatewayErrorKeys(traces) {
    const sorted = [...(traces || [])].sort((left, right) => traceTimestamp(left) - traceTimestamp(right));
    const latestByKey = new Map();
    for (const trace of sorted) {
      const key = traceResolutionKey(trace);
      if (!key) continue;
      latestByKey.set(key, trace);
    }
    const resolved = new Set();
    for (const [key, trace] of latestByKey.entries()) {
      if (trace.status === "ok") resolved.add(key);
    }
    return resolved;
  }

  function actionableGatewayErrors(traces) {
    const resolved = resolvedGatewayErrorKeys(traces || []);
    return (traces || []).filter((trace) => {
      if (trace.status !== "error") return false;
      const key = traceResolutionKey(trace);
      return !key || !resolved.has(key);
    });
  }

  function tracePriority(trace) {
    const resolved = resolvedGatewayErrorKeys(getSnapshot()?.gatewayTraces || []);
    const key = traceResolutionKey(trace);
    return trace.status === "error" && (!key || !resolved.has(key)) ? 1 : 0;
  }

  function traceCompactRow(trace) {
    const status = trace.status === "error" ? "error" : "ok";
    const statusText = status === "error" ? t("home.trace.statusError") : t("home.trace.statusOk");
    return `
      <article class="trace-compact-row ${escapeHtml(status)}">
        <span class="trace-compact-dot"></span>
        <div>
          <strong>${escapeHtml(trace.toolName || t("home.trace.unknownTool"))}</strong>
          <small>${escapeHtml(trace.agentId || t("home.trace.unknownAgent"))}</small>
        </div>
        <code>${escapeHtml(statusText)} · ${escapeHtml(String(trace.durationMs ?? 0))}ms</code>
      </article>
    `;
  }

  function renderHomeDashboard() {
    const snapshot = getSnapshot();
    if (!snapshot) return;
    homeCognitiveUpdated.textContent = t("home.cognitive.updated");
    renderRuntimeOverview();
    renderAttentionQueue();

    const agentIds = homeAgentIds();
    const useGlobalPendingFallback = Boolean((snapshot?.innerLife?.pendingShares || []).length) && !hasAgentShareMatch(snapshot?.innerLife?.pendingShares || [], agentIds);
    homeAgentViewList.innerHTML = agentIds
      .map((agentId, index) => homeAgentView(agentId, { useGlobalPendingFallback: useGlobalPendingFallback && index === 0 }))
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

    const traces = [...(snapshot.gatewayTraces || [])].sort((a, b) => {
      const priorityDiff = tracePriority(b) - tracePriority(a);
      if (priorityDiff) return priorityDiff;
      return traceTimeValue(b) - traceTimeValue(a);
    });
    if (!traces.length) {
      homeTraceList.innerHTML = `<div class="endpoint-empty">${escapeHtml(t("home.trace.empty"))}</div>`;
    } else {
      const featuredTrace = traces[0];
      const compactTraces = traces.slice(1, 5);
      const hiddenCount = Math.max(0, traces.length - 5);
      homeTraceList.innerHTML = `
        ${renderTraceFlow(featuredTrace)}
        ${
          compactTraces.length
            ? `
              <section class="trace-compact-list">
                <div class="trace-compact-heading">
                  <span>${escapeHtml(t("home.trace.recent"))}</span>
                  <strong>${escapeHtml(t("home.trace.showing", { shown: compactTraces.length + 1, total: traces.length }))}</strong>
                </div>
                ${compactTraces.map((trace) => traceCompactRow(trace)).join("")}
              </section>
            `
            : ""
        }
        ${hiddenCount ? `<div class="trace-more">${escapeHtml(t("home.trace.more", { count: hiddenCount }))}</div>` : ""}
      `;
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

  function eventMessage(event) {
    const message = String(event.message || "").trim();
    const knownMessages = {
      "ClaraCore Desktop started": "home.events.message.desktopStarted",
      "Processed pending Memory embedding batch": "home.events.message.memoryEmbeddingBatch",
      "Processed all pending Memory embeddings": "home.events.message.memoryEmbeddingAll",
      "Memoria maintenance completed": "home.events.message.memoriaMaintenance",
      "Backup deleted": "home.events.message.backupDeleted",
      "Product database imported from JSON": "home.events.message.productJsonImported"
    };
    return t(knownMessages[message] || "") || message || event.source || t("home.events.title");
  }

  function eventSource(event) {
    const source = String(event.source || "").trim();
    const knownSources = {
      desktop: "home.events.source.desktop",
      memoria: "home.events.source.memoria",
      runtime: "home.events.source.runtime",
      backup: "home.events.source.backup"
    };
    return t(knownSources[source] || "") || source;
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
            <strong>${escapeHtml(eventMessage(event))}</strong>
            <span>${escapeHtml(eventSource(event))}${eventDetail(event) ? ` · ${escapeHtml(eventDetail(event))}` : ""}</span>
          </li>
        `
      )
      .join("");
  }

  function traceTimestamp(trace) {
    const raw = String(trace?.createdAt || "").trim();
    if (!raw) return 0;
    const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
    const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return t("common.notTracked");
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return t("connections.time.now");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t("connections.time.minutes", { count: String(minutes) });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("connections.time.hours", { count: String(hours) });
    const days = Math.floor(hours / 24);
    return t("connections.time.days", { count: String(days) });
  }

  function agentActivityState(trace) {
    if (!trace) return { className: "idle", label: t("connections.agentRecorded") };
    if (trace.status === "error") return { className: "error", label: t("home.trace.statusError") };
    const age = Date.now() - traceTimestamp(trace);
    if (age <= 5 * 60 * 1000) return { className: "active", label: t("connections.agentJustCalled") };
    if (age <= 60 * 60 * 1000) return { className: "recent", label: t("connections.agentRecentlyCalled") };
    return { className: "idle", label: t("connections.agentRecorded") };
  }

  function summarizeAgentsFromTraces(traces) {
    const byAgent = new Map();
    const sorted = [...(traces || [])].sort((left, right) => traceTimestamp(right) - traceTimestamp(left));
    for (const trace of sorted) {
      const agentId = trace.agentId || t("home.trace.unknownAgent");
      const existing = byAgent.get(agentId) || {
        agentId,
        count: 0,
        errors: 0,
        latest: null
      };
      existing.count += 1;
      if (trace.status === "error") existing.errors += 1;
      if (!existing.latest) existing.latest = trace;
      byAgent.set(agentId, existing);
    }
    return [...byAgent.values()].sort((left, right) => traceTimestamp(right.latest) - traceTimestamp(left.latest));
  }

  function renderConnections() {
    const snapshot = getSnapshot();
    if (!snapshot?.connections) return;
    mcpCommand.textContent = snapshot.connections.mcpCommand;
    mcpConfig.textContent = snapshot.connections.mcpConfig;
    const identity = snapshot.connections.agentIdentity || {};
    const examples = identity.examples || [];
    if (agentIdentityList) {
      agentIdentityList.innerHTML = `
        <div class="endpoint-card">
          <div>
            <strong>${escapeHtml(identity.envKey || "CLARACORE_AGENT_ID")}</strong>
            <code>${escapeHtml(examples.join(" · ") || "<agent-stable-id>")}</code>
            <span>${escapeHtml(t("agentSetup.identityBody"))}</span>
          </div>
        </div>
      `;
    }
    const traces = snapshot.gatewayTraces || [];
    const agents = summarizeAgentsFromTraces(traces);
    if (gatewayHandshakeList) {
      if (agents.length === 0) {
        gatewayHandshakeList.innerHTML = `<div class="endpoint-empty">${t("connections.noConnectedAgents")}</div>`;
      } else {
        gatewayHandshakeList.innerHTML = agents
          .slice(0, 8)
          .map(
            (agent) => {
              const state = agentActivityState(agent.latest);
              return `
              <article class="agent-roster-card ${escapeHtml(state.className)}">
                <div class="agent-roster-main">
                  <strong>${escapeHtml(agent.agentId)}</strong>
                  <span>${escapeHtml(agent.latest?.toolName || t("home.trace.unknownTool"))}</span>
                </div>
                <div class="agent-roster-meta">
                  <span class="agent-state">${escapeHtml(state.label)}</span>
                  <code>${escapeHtml(formatRelativeTime(traceTimestamp(agent.latest)))}</code>
                  <small>${escapeHtml(t("connections.agentCalls", { count: String(agent.count), errors: String(agent.errors) }))}</small>
                </div>
              </article>
            `;
            }
          )
          .join("");
      }
    }
    if (traces.length === 0) {
      gatewayTraceList.innerHTML = `<div class="endpoint-empty">${t("connections.noGatewayTraces")}</div>`;
    } else {
      gatewayTraceList.innerHTML = `
        <div class="gateway-activity-header">
          <span>${escapeHtml(t("connections.activityTime"))}</span>
          <span>${escapeHtml(t("connections.activityAgent"))}</span>
          <span>${escapeHtml(t("connections.activityTool"))}</span>
          <span>${escapeHtml(t("common.status"))}</span>
          <span>${escapeHtml(t("connections.activityDuration"))}</span>
        </div>
        ${traces
          .slice(0, 20)
          .map((trace) => {
            const status = trace.status === "error" ? "error" : "ok";
            return `
              <div class="gateway-activity-row ${escapeHtml(status)}">
                <time>${escapeHtml(formatRelativeTime(traceTimestamp(trace)))}</time>
                <strong>${escapeHtml(trace.agentId || t("home.trace.unknownAgent"))}</strong>
                <span>${escapeHtml(trace.toolName || t("home.trace.unknownTool"))}</span>
                <code>${escapeHtml(status === "error" ? t("home.trace.statusError") : t("home.trace.statusOk"))}</code>
                <small>${escapeHtml(String(trace.durationMs ?? 0))}ms</small>
              </div>
            `;
          })
          .join("")}
      `;
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
