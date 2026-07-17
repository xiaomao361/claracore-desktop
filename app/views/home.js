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
    homeOnboarding,
    homeOnboardingSteps,
    clearDemoData,
    demoDataNotice,
    homeRuntimeStatus,
    homeRuntimeDetail,
    homeRuntimeStrip,
    homeAttentionSummary,
    homeAttentionList,
    homeAgentActivityList,
    homeAgentActivityTabs,
    homeAgentViewList,
    homeTraceList,
    homePresenceTitle,
    homePresenceDetail,
    homePresenceEmptyAction,
    homeSharedLineSection,
    homeSharedLineText,
    homeEmergingSection,
    homeEmergingText,
    homeActionableIssue,
    homeVisionField,
    homeHorizonLabel,
    homeVisionCanvas,
    homeVisionFallback,
    homePresenceAgents,
    homeRuntimeDetails,
    healthSummary,
    healthList,
    mcpCommand,
    mcpConfig,
    agentIdentityList,
    gatewayHandshakeList,
    gatewayTraceList,
    httpEndpointList
  } = dom;
  const {
    actionableGatewayErrors,
    agentActivityState,
    formatRelativeTime,
    renderTraceFlow,
    summarizeAgentsFromTraces,
    traceCompactRow,
    tracePriority,
    traceTimeValue,
    traceTimestamp
  } = window.createClaraCoreHomeTrace({
    t,
    escapeHtml,
    safeJsonObject,
    getSnapshot
  });
  const presenceBuilder = window.createClaraCoreHomePresence({ t, actionableGatewayErrors });
  const homeVision = window.createClaraCoreHomeVision({
    canvas: homeVisionCanvas,
    container: homeVisionField,
    fallback: homeVisionFallback
  });
  let activeAgentActivityPeriod = "7d";

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
    if (!moduleGrid) return;
    moduleGrid.innerHTML = modules
      .map((module) => {
        const details = moduleDetails(module)
          .slice(0, 2)
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
    homeRuntimeStatus.textContent =
      healthStatus === "ok" ? t("common.ready") : healthStatus === "error" ? t("status.healthError") : t("common.needsAttention");
    homeRuntimeStatus.className = `runtime-state ${healthStatus === "ok" ? "ok" : healthStatus === "error" ? "error" : "warn"}`;
    if (homeRuntimeDetails && (healthStatus === "error" || attentionItems().length > 0)) {
      homeRuntimeDetails.open = true;
    }
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
    const hasVectorIssues = Boolean(stats.failedEmbeddingCount || stats.pendingEmbeddingCount);
    if (stats.failedEmbeddingCount) {
      items.push({
        tone: "error",
        title: t("home.attention.embeddingFailed"),
        detail: `${stats.failedEmbeddingCount} ${t("home.attention.items")}`,
        actionCommand: "memory-vectors",
        actionLabel: t("home.attention.rebuildMemoryVectors")
      });
    } else if (stats.pendingEmbeddingCount) {
      items.push({
        tone: "warn",
        title: t("home.attention.embeddingPending"),
        detail: `${stats.pendingEmbeddingCount} ${t("home.attention.items")}`,
        actionCommand: "memory-vectors",
        actionLabel: t("home.attention.rebuildMemoryVectors")
      });
    }

    const maintenance = snapshot?.memoryMaintenance || {};
    if (maintenance.status && maintenance.status !== "ok") {
      const issue = (maintenance.issues || [])[0];
      const issueKey = issue?.code ? `memory.maintenance.${issue.code}` : "";
      if (!hasVectorIssues || !["failed_embeddings", "pending_embeddings"].includes(issue?.code)) {
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
    homeAttentionSummary.textContent = items.length ? t("home.attention.actionCount", { count: String(items.length) }) : t("home.attention.clear");
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

  function agentActivityItems() {
    const snapshot = getSnapshot();
    const summary = snapshot?.agentActivitySummary || {};
    const period = summary.periods?.[activeAgentActivityPeriod] || summary.periods?.["7d"] || {};
    return period.agents || [];
  }

  function renderAgentActivity() {
    if (!homeAgentActivityList) return;
    if (homeAgentActivityTabs?.length) {
      homeAgentActivityTabs.forEach((button) => {
        const isActive = button.dataset.agentActivityPeriod === activeAgentActivityPeriod;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }
    const agents = agentActivityItems().slice(0, 3);
    if (!agents.length) {
      homeAgentActivityList.innerHTML = `
        <div class="home-agent-activity-empty">
          <span>${escapeHtml(t("home.agentActivity.empty"))}</span>
        </div>
      `;
      return;
    }
    homeAgentActivityList.innerHTML = agents
      .map((agent) => {
        const total = Number(agent.newMemories || 0) + Number(agent.formedConnections || 0) + Number(agent.confirmedShares || 0) + Number(agent.sharedLineUpdates || 0);
        return `
          <article class="home-agent-activity-card">
            <div class="home-agent-activity-head">
              <strong>${escapeHtml(agent.agentId)}</strong>
              <span>${escapeHtml(t("home.agentActivity.total", { count: String(total) }))}</span>
            </div>
            <div class="home-agent-activity-stats">
              <div><span>${escapeHtml(t("home.agentActivity.newMemories"))}</span><strong>${escapeHtml(agent.newMemories || 0)}</strong></div>
              <div><span>${escapeHtml(t("home.agentActivity.formedConnections"))}</span><strong>${escapeHtml(agent.formedConnections || 0)}</strong></div>
              <div><span>${escapeHtml(t("home.agentActivity.confirmedShares"))}</span><strong>${escapeHtml(agent.confirmedShares || 0)}</strong></div>
              <div><span>${escapeHtml(t("home.agentActivity.sharedLineUpdates"))}</span><strong>${escapeHtml(agent.sharedLineUpdates || 0)}</strong></div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function demoDataActive() {
    const snapshot = getSnapshot();
    const traces = snapshot?.gatewayTraces || [];
    const memories = snapshot?.recentMemories || snapshot?.memories || [];
    const lines = snapshot?.sharedLine?.lines || [];
    return (
      traces.some((trace) => String(trace.id || "").startsWith("ux_trace_")) ||
      memories.some((memory) => String(memory.id || "").startsWith("ux_mem_")) ||
      lines.some((line) => String(line.id || "").startsWith("ux_line_"))
    );
  }

  function coreDataEmpty() {
    const snapshot = getSnapshot();
    const stats = snapshot?.memoryStats || {};
    const totalMemories = Number(stats.totalCount ?? stats.activeCount ?? 0);
    const lines = (snapshot?.sharedLine?.lines || []).filter((line) => line.id !== "line_default");
    const traces = snapshot?.gatewayTraces || [];
    return totalMemories === 0 && lines.length === 0 && traces.length === 0;
  }

  function renderOnboarding() {
    if (!homeOnboarding) return;
    const snapshot = getSnapshot();
    if (!snapshot) return;
    const demoActive = demoDataActive();
    const showPanel = demoActive || coreDataEmpty();
    homeOnboarding.hidden = !showPanel;
    if (!showPanel) return;
    const stepState = {
      connect: !demoActive && (snapshot.gatewayTraces || []).length > 0,
      models: (snapshot.configuration?.memoria?.provider || "disabled") !== "disabled"
    };
    (homeOnboardingSteps || []).forEach((step) => {
      const done = Boolean(stepState[step.dataset.onboardingStep]);
      step.classList.toggle("is-done", done);
      const doneBadge = step.querySelector(".home-onboarding-step-done");
      if (doneBadge) doneBadge.hidden = !done;
    });
    if (dom.loadDemoData) dom.loadDemoData.hidden = demoActive;
    if (clearDemoData) clearDemoData.hidden = !demoActive;
    if (demoDataNotice) demoDataNotice.textContent = demoActive ? t("home.onboarding.demo.active") : "";
  }

  function renderHomeDashboard() {
    const snapshot = getSnapshot();
    if (!snapshot) return;
    const model = presenceBuilder.build(snapshot);
    homePresenceTitle.textContent = model.title;
    homePresenceDetail.textContent = model.detail;
    homePresenceEmptyAction.hidden = model.agents.length > 0;
    homeHorizonLabel.textContent = model.core.currentLineTitle
      ? `${t("home.presence.horizon")} · ${model.core.currentLineTitle}`
      : t("home.presence.horizon");
    homeSharedLineSection.hidden = !model.core.currentSummary;
    homeSharedLineText.textContent = model.core.currentLineTitle
      ? `${model.core.currentLineTitle} · ${model.core.currentSummary}`
      : model.core.currentSummary;
    homeEmergingSection.hidden = !model.core.emergingThought;
    homeEmergingText.textContent = model.core.emergingThought;
    homeActionableIssue.hidden = !model.actionableIssue;
    homeActionableIssue.textContent = model.actionableIssue?.text || "";
    homePresenceAgents.innerHTML = model.agents
      .map(
        (agent) => `
          <span class="home-presence-agent ${escapeHtml(agent.presence)}${agent.arrival ? " arrival" : ""}" style="--agent-color:${escapeHtml(agent.color)}" title="${escapeHtml(agent.label)} · ${escapeHtml(formatRelativeTime(agent.lastObservedAt))}" tabindex="0" aria-label="${escapeHtml(agent.label)} · ${escapeHtml(formatRelativeTime(agent.lastObservedAt))}">
            <i class="home-presence-agent-dot"></i>
            <span class="home-presence-agent-label">${escapeHtml(agent.label)}</span>
          </span>
        `
      )
      .join("");
    homeVision.setModel(model);
  }

  function renderHealth() {
    const snapshot = getSnapshot();
    const health = snapshot?.health;
    if (!healthSummary || !healthList) return;
    if (!health) return;
    healthSummary.textContent = t(`health.${health.status}`) || health.status;
    healthSummary.className = `quiet health-summary ${health.status}`;
    healthList.innerHTML = (health.checks || [])
      .map((check) => {
        const level = check.level || "warn";
        const actionView = healthActionView(check.id);
        const actionLabel = healthActionLabel(check.id);
        const actionTab = healthActionSettingsTab(check.id);
        return `
          <div class="health-item ${escapeHtml(level)}">
            <span class="health-dot"></span>
            <div>
              <strong>${escapeHtml(t(check.labelKey) || check.id)}</strong>
              <small>${escapeHtml(check.detail || "")}</small>
              ${actionView ? `<button class="link-button health-action" data-view-target="${escapeHtml(actionView)}"${actionTab ? ` data-settings-target="${escapeHtml(actionTab)}"` : ""}>${escapeHtml(actionLabel)}</button>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function healthActionView(checkId) {
    return {
      "data-root": "settings",
      database: "settings",
      gateway: "agent-setup",
      embedding: "settings"
    }[checkId] || "";
  }

  function healthActionSettingsTab(checkId) {
    return {
      "data-root": "data",
      database: "data",
      embedding: "models"
    }[checkId] || "";
  }

  function healthActionLabel(checkId) {
    return {
      "data-root": t("health.action.openData"),
      database: t("health.action.openData"),
      gateway: t("health.action.openGateway"),
      embedding: t("health.action.openModels")
    }[checkId] || t("actions.open");
  }

  function eventDetail(event) {
    const metadata = safeJsonObject(event.metadataJson || event.metadata_json || event.metadata, {});
    return metadata.action || metadata.backupId || metadata.path || "";
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

  function isStartupEvent(event) {
    return String(event?.message || "").trim() === "ClaraCore Desktop started";
  }

  function eventTimestamp(event) {
    return traceTimestamp({ createdAt: event?.createdAt || event?.created_at });
  }

  function recentActivitySignals(snapshot) {
    const runtimeEvents = snapshot.runtimeEvents || [];
    const startupEvents = runtimeEvents.filter(isStartupEvent);
    const runtimeSignals = runtimeEvents
      .filter((event) => !isStartupEvent(event))
      .map((event) => ({
        kind: "event",
        level: event.level || "info",
        title: eventMessage(event),
        detail: `${eventSource(event)}${eventDetail(event) ? ` · ${eventDetail(event)}` : ""}`,
        time: eventTimestamp(event)
      }));
    const gatewaySignals = (snapshot.gatewayTraces || []).slice(0, 10).map((trace) => ({
      kind: "gateway",
      level: trace.status === "error" ? "error" : "info",
      title: trace.toolName || t("home.trace.unknownTool"),
      detail: `${trace.agentId || t("home.trace.unknownAgent")} · ${trace.status === "error" ? t("home.trace.statusError") : t("home.trace.statusOk")} · ${trace.durationMs ?? 0}ms`,
      time: traceTimestamp(trace)
    }));
    const startupSignal = startupEvents[0]
      ? [{
          kind: "startup",
          level: "info",
          title: t("home.events.startupSummary"),
          detail: t("home.events.startupSummaryDetail", { count: String(startupEvents.length) }),
          time: eventTimestamp(startupEvents[0])
        }]
      : [];
    return [...runtimeSignals, ...gatewaySignals, ...startupSignal]
      .sort((left, right) => right.time - left.time)
      .slice(0, 6);
  }

  function renderEvents() {
    const snapshot = getSnapshot();
    if (!eventList) return;
    if (!snapshot) return;
    const signals = recentActivitySignals(snapshot);
    if (!signals.length) {
      eventList.innerHTML = `
        <li>
          <strong>${escapeHtml(t("home.events.empty"))}</strong>
          <span>${escapeHtml(t("home.events.emptyBody"))}</span>
        </li>
      `;
      return;
    }
    eventList.innerHTML = signals
      .map(
        (signal) => `
          <li class="${escapeHtml(signal.level || "info")} ${escapeHtml(signal.kind)}">
            <strong>${escapeHtml(signal.title)}</strong>
            <span>${escapeHtml(signal.detail)}${signal.time ? ` · ${escapeHtml(formatRelativeTime(signal.time))}` : ""}</span>
          </li>
        `
      )
      .join("");
  }

  function renderConnections() {
    const snapshot = getSnapshot();
    if (!snapshot?.connections) return;
    if (mcpCommand) mcpCommand.textContent = snapshot.connections.mcpCommand;
    if (mcpConfig) mcpConfig.textContent = snapshot.connections.mcpConfig;
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
    if (!gatewayTraceList) return;
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
    if (!httpEndpointList) return;
    if (endpoints.length === 0) {
      const gatewayError = snapshot.connections.httpGateway?.error;
      httpEndpointList.innerHTML = `<div class="endpoint-empty">${escapeHtml(gatewayError?.message || t("connections.noEndpoints"))}</div>`;
      return;
    }
    httpEndpointList.innerHTML = endpoints
      .map(
        (endpoint) => {
          const label = t(`connections.endpoint.${endpoint.id}`) || endpoint.id;
          const openUrl = endpoint.openUrl || endpoint.url;
          const detail = [
            endpoint.method,
            endpoint.auth === "bearer-token" ? t("connections.auth.bearer") : "",
            endpoint.bind,
            endpoint.portPolicy === "stable-localhost" ? t("connections.portStable") : ""
          ]
            .filter(Boolean)
            .join(" · ");
          return `
          <div class="endpoint-card">
            <div>
              <strong>${escapeHtml(label)}</strong>
              <code>${escapeHtml(endpoint.url)}</code>
              <span>${escapeHtml(detail || endpoint.healthUrl || "")}</span>
              ${endpoint.tokenFile ? `<span>${escapeHtml(t("connections.tokenFile"))}: ${escapeHtml(endpoint.tokenFile)}</span>` : ""}
            </div>
            <div class="endpoint-actions">
              <button class="secondary" data-open-url="${escapeHtml(openUrl)}">${t("actions.open")}</button>
              <button class="secondary" data-copy-endpoint-id="${escapeHtml(endpoint.id)}">${t("actions.copy")}</button>
            </div>
          </div>
        `;
        }
      )
      .join("");
  }

  function actionableGatewayErrorCount() {
    return actionableGatewayErrors(getSnapshot()?.gatewayTraces || []).length;
  }

  function actionableAttentionCount() {
    return attentionItems().length;
  }

  function hasActionableError() {
    return attentionItems().some((item) => item.tone === "error");
  }

  homeAgentActivityTabs?.forEach((button) => {
    button.addEventListener("click", () => {
      activeAgentActivityPeriod = button.dataset.agentActivityPeriod || "7d";
      renderAgentActivity();
    });
  });

  return {
    actionableAttentionCount,
    renderModules,
    renderEvents,
    renderHomeDashboard,
    renderHealth,
    renderConnections,
    actionableGatewayErrorCount,
    hasActionableError,
    setActive: homeVision.setActive,
    getVisionDebugState: homeVision.debugState
  };
}

window.createClaraCoreHomeView = createClaraCoreHomeView;
