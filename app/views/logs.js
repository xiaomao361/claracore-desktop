function createClaraCoreLogsView({ dom, t, escapeHtml, formatLocalDateTime, getSnapshot, refreshSnapshot }) {
  let followEnabled = true;
  let refreshTimer = null;
  let refreshInFlight = false;
  let activeFilter = "all";
  let activeEntries = [];
  let lastDetailTrigger = null;
  const liveLines = [];
  const html = typeof escapeHtml === "function"
    ? escapeHtml
    : (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);

  function matchesFilter(entry) {
    if (activeFilter === "all") return true;
    if (activeFilter === "errors") return entry.status === "error";
    return entry.kind === activeFilter;
  }

  function safeJson(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (_error) {
      return String(value || "");
    }
  }

  function buildLogEntries(snapshot) {
    const runtimeEntries = (snapshot?.runtimeEvents || []).map((event, index) => ({
      id: `runtime:${event.id || event.createdAt || index}`,
      createdAt: event.createdAt || "",
      kind: "runtime",
      status: event.level || "info",
      source: event.source || t("logs.source.runtime"),
      title: event.source || t("logs.source.runtime"),
      summary: event.message || "",
      raw: event
    }));
    const gatewayEntries = (snapshot?.gatewayTraces || []).map((trace, index) => ({
      id: `gateway:${trace.id || trace.createdAt || index}`,
      createdAt: trace.createdAt || "",
      kind: "gateway",
      status: trace.status || "ok",
      source: t("logs.source.gateway"),
      title: trace.toolName || "unknown",
      summary: trace.error || trace.responseSummary || "",
      meta: `${String(trace.durationMs ?? 0)}ms${trace.agentId ? ` · ${trace.agentId}` : ""}`,
      raw: trace
    }));
    return [...runtimeEntries, ...gatewayEntries, ...liveLines]
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  }

  function render() {
    const snapshot = getSnapshot();
    const runtimeSource = snapshot?.runtimeEvents || [];
    const gatewaySource = snapshot?.gatewayTraces || [];
    const timeFlow = buildTimeFlow(snapshot);
    const decayAudit = snapshot?.decayAudit || {};
    activeEntries = buildLogEntries(snapshot);
    const visibleEntries = activeEntries
      .filter(matchesFilter)
      .slice(-200);

    renderEventStream(visibleEntries);
    renderIssueSummary(activeEntries);
    renderStatus(snapshot, runtimeSource, gatewaySource);
    if (dom.logDecayIssueCount) {
      dom.logDecayIssueCount.textContent = decayAudit.counts?.issues
        ? t("logs.decayIssueCount", { count: String(decayAudit.counts.issues) })
        : t("logs.decayClear");
    }
    if (dom.logLastRefresh) {
      dom.logLastRefresh.textContent = t("logs.lastRefreshAt", { time: new Date().toLocaleTimeString() });
    }
    if (dom.logFilter) dom.logFilter.value = activeFilter;
    dom.toggleLogFollow.classList.toggle("active", followEnabled);
    renderDecayAudit(decayAudit);
    renderTimeFlow(timeFlow);
    if (followEnabled) {
      dom.logTerminal.scrollTop = dom.logTerminal.scrollHeight;
    }
  }

  function renderStatus(snapshot, runtimeEvents, gatewayTraces) {
    if (!dom.logStatusSummary) return;
    const statusLine = dom.logStatusSummary.closest(".log-status-line");
    statusLine?.classList.remove("ok", "error", "unavailable");
    if (!snapshot) {
      dom.logStatusSummary.textContent = t("logs.statusUnavailable");
      if (dom.logLoadedRange) dom.logLoadedRange.textContent = "";
      if (dom.logShowErrors) dom.logShowErrors.hidden = true;
      statusLine?.classList.add("unavailable");
      return;
    }
    const errorCount = runtimeEvents.filter((event) => event.level === "error").length
      + gatewayTraces.filter((trace) => trace.status === "error").length;
    dom.logStatusSummary.textContent = errorCount
      ? t("logs.statusErrors", { count: String(errorCount) })
      : t("logs.statusOk");
    statusLine?.classList.add(errorCount ? "error" : "ok");
    if (dom.logLoadedRange) {
      dom.logLoadedRange.textContent = t("logs.loadedRange", {
        runtime: String(runtimeEvents.length),
        gateway: String(gatewayTraces.length)
      });
    }
    if (dom.logShowErrors) dom.logShowErrors.hidden = errorCount === 0;
  }

  function eventRow(entry, compact = false) {
    const detail = preview(entry.summary) || t("logs.event.noSummary");
    return `
      <button type="button" class="log-event-row ${entry.status === "error" ? "error" : ""} ${compact ? "compact" : ""}" data-log-event-id="${html(entry.id)}">
        <time datetime="${html(entry.createdAt)}">${html(formatLocalDateTime(entry.createdAt))}</time>
        <span class="log-event-kind">${html(entry.source)}</span>
        <span class="log-event-copy">
          <strong>${html(entry.title)}</strong>
          <span>${html(detail)}</span>
        </span>
        <span class="log-event-status">${html(entry.status)}</span>
      </button>
    `;
  }

  function renderEventStream(entries) {
    if (!dom.logTerminal) return;
    dom.logTerminal.innerHTML = entries.length
      ? entries.map((entry) => eventRow(entry)).join("")
      : `<div class="endpoint-empty">${html(t("logs.empty"))}</div>`;
  }

  function renderIssueSummary(entries) {
    if (!dom.logIssueSummary || !dom.logIssueList) return;
    const issues = entries.filter((entry) => entry.status === "error").slice(-3).reverse();
    dom.logIssueSummary.hidden = issues.length === 0;
    if (dom.logIssueCount) dom.logIssueCount.textContent = t("logs.issue.count", { count: String(issues.length) });
    dom.logIssueList.innerHTML = issues.map((entry) => eventRow(entry, true)).join("");
  }

  function renderDecayAudit(decayAudit = {}) {
    if (!dom.logDecayList) return;
    const issues = Array.isArray(decayAudit.issues) ? decayAudit.issues : [];
    if (!issues.length) {
      dom.logDecayList.innerHTML = `
        <article class="decay-audit-item ok">
          <span class="time-flow-dot"></span>
          <div>
            <strong>${html(t("logs.decayClear"))}</strong>
            <p>${html(decayAudit.summary || t("logs.decayClearBody"))}</p>
          </div>
        </article>
      `;
      return;
    }
    dom.logDecayList.innerHTML = issues
      .slice(0, 6)
      .map((item) => {
        const examples = (item.items || [])
          .slice(0, 3)
          .map((entry) => entry.title || entry.summary || entry.id || entry.agentId || "")
          .filter(Boolean)
          .join(" · ");
        return `
          <article class="decay-audit-item ${html(item.level || "info")}">
            <span class="time-flow-dot"></span>
            <div>
              <div>
                <strong>${html(t(`logs.decay.${item.code}`) || item.code || "")}</strong>
                <span>${html(item.level || "info")} · ${html(String(item.count ?? 0))}</span>
              </div>
              <p>${html(item.message || "")}</p>
              ${examples ? `<small>${html(examples)}</small>` : ""}
              ${item.action ? `<small>${html(item.action)}</small>` : ""}
            </div>
          </article>
        `;
      })
      .join("");
  }

  function parseTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
    const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function preview(value, maxLength = 170) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
  }

  function pushTimeItem(items, item) {
    const occurredAt = item.occurredAt || item.updatedAt || item.createdAt || "";
    if (!occurredAt) return;
    items.push({
      ...item,
      occurredAt,
      timeValue: parseTime(occurredAt)
    });
  }

  function buildTimeFlow(snapshot) {
    const items = [];
    (snapshot?.recentMemories || snapshot?.memories || []).forEach((memory) => {
      pushTimeItem(items, {
        type: "memory",
        source: t("logs.source.memory"),
        status: memory.status || "active",
        title: memory.title || t("nav.memory"),
        summary: memory.body || "",
        ref: memory.id,
        agentId: memory.sourceAgent || memory.agentId || "",
        occurredAt: memory.updatedAt || memory.updated_at || memory.createdAt || memory.created_at
      });
    });
    const sharedLine = snapshot?.sharedLine || {};
    (sharedLine.history || []).forEach((item) => {
      pushTimeItem(items, {
        type: "shared-line",
        source: t("logs.source.sharedLine"),
        status: item.interpretationStatus || "draft",
        title: sharedLine.lineTitle || t("nav.sharedLine"),
        summary: item.summary || "",
        ref: item.positionId || item.id || item.lineId || "",
        agentId: sharedLine.agentId || item.agentId || "",
        occurredAt: item.createdAt
      });
    });
    (sharedLine.snapshots || []).forEach((item) => {
      pushTimeItem(items, {
        type: "shared-line",
        source: t("logs.source.sharedLine"),
        status: item.reason || "snapshot",
        title: t("sharedLine.snapshots"),
        summary: item.summary || "",
        ref: item.positionId || item.id || item.lineId || "",
        agentId: sharedLine.agentId || item.agentId || "",
        occurredAt: item.createdAt
      });
    });
    const innerLife = snapshot?.innerLife || {};
    (innerLife.inbox || []).forEach((item) => {
      pushTimeItem(items, {
        type: "innerlife",
        source: t("logs.source.innerLife"),
        status: item.status || "pending",
        title: item.source || t("innerLife.inbox"),
        summary: item.body || "",
        ref: item.id,
        agentId: item.agentId || item.agent_id || "",
        occurredAt: item.processedAt || item.createdAt
      });
    });
    (innerLife.digestRuns || []).forEach((item) => {
      pushTimeItem(items, {
        type: "innerlife",
        source: t("logs.source.innerLife"),
        status: item.status || "completed",
        title: item.mode || t("innerLife.digests"),
        summary: item.summary || "",
        ref: item.id,
        agentId: item.agentId || item.agent_id || "",
        occurredAt: item.completedAt || item.createdAt
      });
    });
    (innerLife.shareChecks || []).forEach((item) => {
      pushTimeItem(items, {
        type: "innerlife",
        source: t("logs.source.innerLife"),
        status: item.decision || "check",
        title: t("innerLife.checkTiming"),
        summary: item.reason || item.context || "",
        ref: item.id,
        agentId: item.agentId || item.agent_id || "",
        occurredAt: item.createdAt
      });
    });
    (innerLife.recentShares || []).forEach((item) => {
      pushTimeItem(items, {
        type: "innerlife",
        source: t("logs.source.innerLife"),
        status: item.status || "share",
        title: t("innerLife.shareQueue"),
        summary: item.body || "",
        ref: item.id,
        agentId: item.agent_id || item.agentId || "",
        occurredAt: item.updated_at || item.updatedAt || item.created_at || item.createdAt
      });
    });
    (snapshot?.gatewayTraces || []).forEach((trace) => {
      pushTimeItem(items, {
        type: "gateway",
        source: t("logs.source.gateway"),
        status: trace.status || "ok",
        title: trace.toolName || "unknown",
        summary: trace.error || trace.responseSummary || "",
        ref: trace.id,
        agentId: trace.agentId || "",
        occurredAt: trace.createdAt
      });
    });
    (snapshot?.runtimeEvents || []).forEach((event) => {
      pushTimeItem(items, {
        type: "runtime",
        source: t("logs.source.runtime"),
        status: event.level || "info",
        title: event.source || "runtime",
        summary: event.message || "",
        ref: event.id,
        agentId: "",
        occurredAt: event.createdAt
      });
    });
    return items
      .filter((item) => item.timeValue > 0)
      .sort((left, right) => right.timeValue - left.timeValue || String(right.ref || "").localeCompare(String(left.ref || "")))
      .slice(0, 80);
  }

  function renderTimeFlow(items) {
    if (!dom.logTimeFlowList) return;
    if (!items.length) {
      dom.logTimeFlowList.innerHTML = `<div class="endpoint-empty">${html(t("logs.sequenceEmpty"))}</div>`;
      return;
    }
    dom.logTimeFlowList.innerHTML = items
      .slice(0, 40)
      .map((item) => {
        const meta = [item.agentId, item.ref].filter(Boolean).join(" · ");
        return `
          <article class="time-flow-item ${html(item.type)} ${item.status === "error" ? "error" : ""}">
            <span class="time-flow-dot"></span>
            <div class="time-flow-body">
              <div>
                <strong>${html(item.title || item.source)}</strong>
                <span>${html(item.source)} · ${html(item.status || "")}</span>
              </div>
              <p>${html(preview(item.summary) || t("logs.sequenceNoDetail"))}</p>
              <small>${html(formatLocalDateTime(item.occurredAt))}${meta ? ` · ${html(meta)}` : ""}</small>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function appendLiveLine(source, message) {
    const createdAt = new Date().toISOString();
    liveLines.push({
      id: `ui:${Date.now()}:${liveLines.length}`,
      createdAt,
      kind: "ui",
      status: "info",
      source: source || t("logs.source.ui"),
      title: source || t("logs.source.ui"),
      summary: message,
      raw: { createdAt, source, message }
    });
    while (liveLines.length > 80) liveLines.shift();
    render();
  }

  function syncRefreshTimer(activeView) {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (activeView !== "logs" || !followEnabled) return;
    refreshTimer = setInterval(async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        await refreshSnapshot();
      } catch (error) {
        console.error(error);
      } finally {
        refreshInFlight = false;
      }
    }, 2000);
  }

  function toggleFollow(activeView) {
    followEnabled = !followEnabled;
    dom.toggleLogFollow.classList.toggle("active", followEnabled);
    syncRefreshTimer(activeView);
    render();
  }

  function setFilter(value) {
    activeFilter = value || "all";
    render();
  }

  function setDetailPane(mode) {
    if (dom.logEventDetail) dom.logEventDetail.hidden = mode !== "event";
    if (dom.logDecayPanel) dom.logDecayPanel.hidden = mode !== "decay";
    if (dom.logSequencePanel) dom.logSequencePanel.hidden = mode !== "sequence";
  }

  function openDetail(trigger) {
    if (!dom.logDetailDialog) return;
    lastDetailTrigger = trigger || document.activeElement;
    if (!dom.logDetailDialog.open) dom.logDetailDialog.showModal();
    dom.logDetailClose?.focus();
  }

  function openEventDetail(id, trigger) {
    const entry = activeEntries.find((item) => item.id === id);
    if (!entry || !dom.logEventDetail) return;
    setDetailPane("event");
    dom.logDetailKicker.textContent = t("logs.event.kicker");
    dom.logDetailTitle.textContent = entry.title;
    dom.logDetailMeta.textContent = [entry.source, entry.status, formatLocalDateTime(entry.createdAt), entry.meta]
      .filter(Boolean)
      .join(" · ");
    dom.logEventDetail.innerHTML = `
      <div class="log-event-readable">
        <strong>${html(t("logs.event.summary"))}</strong>
        <p>${html(entry.summary || t("logs.event.noSummary"))}</p>
      </div>
      <div class="log-event-raw">
        <strong>${html(t("logs.event.raw"))}</strong>
        <pre>${html(safeJson(entry.raw))}</pre>
      </div>
    `;
    openDetail(trigger);
  }

  function openDiagnosticDetail(mode, trigger) {
    setDetailPane(mode);
    dom.logDetailKicker.textContent = t("logs.advanced.kicker");
    dom.logDetailMeta.textContent = mode === "sequence" ? t("logs.timeFlowBody") : t("logs.decayAuditBody");
    dom.logDetailTitle.textContent = mode === "sequence" ? t("logs.timeFlow") : t("logs.decayAudit");
    openDetail(trigger);
  }

  function closeDetail() {
    if (dom.logDetailDialog?.open) dom.logDetailDialog.close();
  }

  function closeAdvancedDiagnostics() {
    closeDetail();
  }

  function refreshNow() {
    dom.refreshLogs.disabled = true;
    appendLiveLine("logs", t("logs.refreshing"));
    refreshSnapshot()
      .then(() => {
        appendLiveLine("logs", t("logs.refreshed"));
      })
      .catch((error) => {
        console.error(error);
        appendLiveLine("logs", `${t("logs.refreshFailed")}: ${error.message || String(error)}`);
      })
      .finally(() => {
        dom.refreshLogs.disabled = false;
      });
  }

  function bindEventRowContainer(container) {
    container?.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-log-event-id]");
      if (trigger) openEventDetail(trigger.dataset.logEventId, trigger);
    });
  }

  bindEventRowContainer(dom.logTerminal);
  bindEventRowContainer(dom.logIssueList);
  document.querySelectorAll("[data-log-detail]").forEach((trigger) => {
    trigger.addEventListener("click", () => openDiagnosticDetail(trigger.dataset.logDetail, trigger));
  });
  dom.logShowErrors?.addEventListener("click", () => setFilter("errors"));
  dom.logDetailClose?.addEventListener("click", closeDetail);
  dom.logDetailDialog?.addEventListener("click", (event) => {
    if (event.target === dom.logDetailDialog) closeDetail();
  });
  dom.logDetailDialog?.addEventListener("close", () => {
    const trigger = lastDetailTrigger;
    lastDetailTrigger = null;
    if (trigger?.isConnected) trigger.focus();
  });

  return {
    appendLiveLine,
    closeAdvancedDiagnostics,
    refreshNow,
    render,
    setFilter,
    syncRefreshTimer,
    toggleFollow
  };
}

window.createClaraCoreLogsView = createClaraCoreLogsView;
