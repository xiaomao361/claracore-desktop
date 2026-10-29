function createClaraCoreLogsView({ dom, t, escapeHtml, formatLocalDateTime, getSnapshot, refreshSnapshot }) {
  let followEnabled = true;
  let refreshTimer = null;
  let refreshInFlight = false;
  let activeFilter = "all";
  let activeEntries = [];
  let lastDetailTrigger = null;
  let refreshError = "";
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

  const toolActions = {
    claracore_connection_test: "connection", gateway_docs: "guide",
    gateway_context: "context", gateway_auto_context: "context", gateway_turn_context: "context",
    memoria_search: "searchMemory", memoria_recall: "searchMemory", memoria_get: "readMemory",
    memoria_create: "saveMemory", memory_context_feedback: "feedback",
    shared_line_get: "readLine", shared_line_list: "listLines", shared_line_update: "updateLine",
    knowledge_search: "searchSources", knowledge_read: "readSources",
    innerlife_share_check: "checkShare"
  };
  const knownStatuses = new Set(["ok", "error", "info", "warn", "running", "pending", "partial", "disabled", "cancelled", "skipped"]);

  function statusLabel(status) {
    return t(`logs.status.${knownStatuses.has(status) ? status : "unknown"}`);
  }

  function gatewayEntry(trace, index) {
    let status = trace.error ? "error" : trace.status || "unknown";
    // The stored preview can be truncated. Never repair it or infer payload/use
    // from transport success, text fragments, tool name, or response length.
    let payload;
    try { payload = JSON.parse(trace.responseSummary); } catch (_) { /* bounded or legacy preview */ }
    if (status === "ok" && trace.toolName === "memoria_get" && payload?.error) status = "error";
    if (status === "ok" && trace.toolName === "memoria_search" && (payload?.degraded === true || payload?.error)) status = "partial";
    let summary = t(`logs.result.${status === "ok" ? "completed" : status === "error" ? "failed" : "unknown"}`);
    if (status === "partial" && trace.toolName === "memoria_search") summary = t("logs.result.degraded");
    if (status === "ok" && trace.toolName === "memoria_search" && Array.isArray(payload?.results)) {
      summary = payload.results.length ? t("logs.result.matches", { count: String(payload.results.length) }) : t("logs.result.noMatches");
    }
    if (status === "ok" && trace.toolName === "gateway_auto_context") {
      if (payload?.decision === "abstain") summary = t("logs.result.abstain");
      else if (payload?.decision === "deliver_one" && typeof payload.block?.body === "string" && payload.block.body) summary = t("logs.result.prepared");
      else if (payload?.decision === "deliver_context" && Array.isArray(payload.blocks) && payload.blocks.some(block => typeof block?.body === "string" && block.body)) summary = t("logs.result.prepared");
    }
    return {
      id: `gateway:${trace.id || trace.createdAt || index}`,
      createdAt: trace.createdAt || "", kind: "gateway", status,
      source: t("logs.source.gateway"),
      title: t(`logs.action.${Object.hasOwn(toolActions, trace.toolName) ? toolActions[trace.toolName] : "request"}`), summary,
      meta: `${trace.durationMs == null ? "" : `${trace.durationMs}ms`}${trace.agentId ? ` · ${trace.agentId}` : ""}`,
      raw: trace
    };
  }

  function buildLogEntries(snapshot) {
    const runtimeEntries = (snapshot?.runtimeEvents || []).map((event, index) => ({
      id: `runtime:${event.id || event.createdAt || index}`,
      createdAt: event.createdAt || "",
      kind: "runtime",
      status: event.level || "unknown",
      source: event.source || t("logs.source.runtime"),
      title: event.source || t("logs.source.runtime"),
      summary: event.message || "",
      raw: event
    }));
    const gatewayEntries = (snapshot?.gatewayTraces || []).map(gatewayEntry);
    return [...runtimeEntries, ...gatewayEntries, ...liveLines]
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  }

  function render() {
    const snapshot = getSnapshot();
    const runtimeSource = snapshot?.runtimeEvents || [];
    const gatewaySource = snapshot?.gatewayTraces || [];
    const timeFlow = buildTimeFlow(snapshot);
    const decayAudit = snapshot?.decayAudit;
    activeEntries = buildLogEntries(snapshot);
    const visibleEntries = activeEntries
      .filter(matchesFilter)
      .slice(-200);

    renderEventStream(visibleEntries);
    renderIssueSummary(activeEntries);
    renderStatus(snapshot, runtimeSource, gatewaySource);
    if (dom.logDecayIssueCount) {
      dom.logDecayIssueCount.textContent = Array.isArray(decayAudit?.issues)
        ? decayAudit.issues.length ? t("logs.decayIssueCount", { count: String(decayAudit.issues.length) }) : t("logs.decayClear")
        : t("logs.decayUnavailable");
    }
    if (dom.logLastRefresh) {
      const updatedAt = snapshot?.logsUpdatedAt || snapshot?.generatedAt;
      dom.logLastRefresh.textContent = updatedAt ? t("logs.lastRefreshAt", { time: formatLocalDateTime(updatedAt) }) : "";
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
    if (!snapshot || !Array.isArray(snapshot.runtimeEvents) || !Array.isArray(snapshot.gatewayTraces)) {
      dom.logStatusSummary.textContent = t(refreshError ? "logs.refreshStale" : "logs.statusUnavailable");
      if (dom.logLoadedRange) dom.logLoadedRange.textContent = "";
      if (dom.logShowErrors) dom.logShowErrors.hidden = !activeEntries.some(entry => entry.status === "error");
      statusLine?.classList.add("unavailable");
      return;
    }
    const errorCount = activeEntries.filter(entry => entry.status === "error").length;
    const unknownCount = activeEntries.filter(entry => !knownStatuses.has(entry.status)).length;
    const partialCount = activeEntries.filter(entry => entry.status === "partial").length;
    dom.logStatusSummary.textContent = refreshError ? t("logs.refreshStale") : unknownCount || partialCount
      ? t("logs.statusIncomplete", { count: String(unknownCount), errors: String(errorCount), partial: String(partialCount) })
      : errorCount ? t("logs.statusErrors", { count: String(errorCount) }) : t("logs.statusOk");
    statusLine?.classList.add(refreshError || errorCount ? "error" : unknownCount || partialCount ? "unavailable" : "ok");
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
        <span class="log-event-status">${html(statusLabel(entry.status))}</span>
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

  function renderDecayAudit(decayAudit) {
    if (!dom.logDecayList) return;
    if (!decayAudit || !Array.isArray(decayAudit.issues)) {
      dom.logDecayList.innerHTML = `<div class="endpoint-empty">${html(t("logs.decayUnavailable"))}</div>`;
      return;
    }
    const issues = decayAudit.issues;
    if (!issues.length) {
      dom.logDecayList.innerHTML = `
        <article class="decay-audit-item ok">
          <span class="time-flow-dot"></span>
          <div>
            <strong>${html(t("logs.decayClear"))}</strong>
            <p>${html(t("logs.decayClearBody"))}</p>
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
        const known = ["memory_dormant", "shared_line_review", "innerlife_old_shares", "innerlife_old_inbox", "innerlife_daemon_error"].includes(item.code);
        return `
          <article class="decay-audit-item ${html(item.level || "info")}">
            <span class="time-flow-dot"></span>
            <div>
              <div>
                <strong>${html(t(known ? `logs.decay.${item.code}` : "logs.decay.unknown"))}</strong>
                <span>${html(statusLabel(item.level || "unknown"))} · ${html(item.count == null ? t("logs.countUnknown") : String(item.count))}</span>
              </div>
              <p>${html(t(known ? `logs.decayBody.${item.code}` : "logs.decayBody.unknown"))}</p>
              ${examples ? `<small>${html(examples)}</small>` : ""}
              <details><summary>${html(t("logs.event.raw"))}</summary><pre>${html(safeJson(item))}</pre></details>
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
    (snapshot?.gatewayTraces || []).forEach((trace, index) => {
      const entry = gatewayEntry(trace, index);
      pushTimeItem(items, { ...entry, type: "gateway", ref: trace.id, agentId: trace.agentId || "", occurredAt: trace.createdAt });
    });
    (snapshot?.runtimeEvents || []).forEach((event) => {
      pushTimeItem(items, {
        type: "runtime",
        source: t("logs.source.runtime"),
        status: event.level || "unknown",
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
                <span>${html(item.source)} · ${html(item.type === "gateway" || item.type === "runtime" ? statusLabel(item.status) : item.status || "")}</span>
              </div>
              <p>${html(preview(item.summary) || t("logs.sequenceNoDetail"))}</p>
              <small>${html(formatLocalDateTime(item.occurredAt))}${meta ? ` · ${html(meta)}` : ""}</small>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function appendLiveLine(source, message, status = "info") {
    const createdAt = new Date().toISOString();
    liveLines.push({
      id: `ui:${Date.now()}:${liveLines.length}`,
      createdAt,
      kind: "ui",
      status,
      source: source || t("logs.source.ui"),
      title: source || t("logs.source.ui"),
      summary: message,
      raw: { createdAt, source, message, status }
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
        refreshError = "";
        render();
      } catch (error) {
        recordRefreshFailure(error);
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
    dom.logDetailMeta.textContent = [entry.source, statusLabel(entry.status), formatLocalDateTime(entry.createdAt), entry.meta]
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

  function recordRefreshFailure(error) {
    const wasFailed = Boolean(refreshError);
    refreshError = error?.message || String(error);
    // Following can fail repeatedly. Keep one visible error per failure episode.
    if (!wasFailed) appendLiveLine(t("logs.source.ui"), `${t("logs.refreshFailed")}: ${refreshError}`, "error");
    else render();
  }

  async function refreshNow() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    dom.refreshLogs.disabled = true;
    appendLiveLine(t("logs.source.ui"), t("logs.refreshing"));
    try {
      await refreshSnapshot();
      refreshError = "";
      appendLiveLine(t("logs.source.ui"), t("logs.refreshed"));
    } catch (error) {
      recordRefreshFailure(error);
    } finally {
      refreshInFlight = false;
      dom.refreshLogs.disabled = false;
    }
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
