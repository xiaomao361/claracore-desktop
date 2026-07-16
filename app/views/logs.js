function createClaraCoreLogsView({ dom, t, escapeHtml, formatLocalDateTime, getSnapshot, refreshSnapshot }) {
  let followEnabled = true;
  let refreshTimer = null;
  let refreshInFlight = false;
  let activeFilter = "all";
  const liveLines = [];
  const html = typeof escapeHtml === "function"
    ? escapeHtml
    : (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);

  function matchesFilter(entry) {
    if (activeFilter === "all") return true;
    if (activeFilter === "errors") return entry.status === "error";
    return entry.kind === activeFilter;
  }

  function render() {
    const snapshot = getSnapshot();
    const runtimeSource = snapshot?.runtimeEvents || [];
    const gatewaySource = snapshot?.gatewayTraces || [];
    const timeFlow = buildTimeFlow(snapshot);
    const decayAudit = snapshot?.decayAudit || {};
    const runtimeEvents = runtimeSource.map((event) => ({
      createdAt: event.createdAt || "",
      kind: "runtime",
      status: event.level || "info",
      line: `[${formatLocalDateTime(event.createdAt)}] [${event.level || "info"}/${event.source || "runtime"}] ${event.message || ""}${
        event.metadata && Object.keys(event.metadata).length ? ` ${JSON.stringify(event.metadata)}` : ""
      }`
    }));
    const gatewayEvents = gatewaySource.map((trace) => ({
      createdAt: trace.createdAt || "",
      kind: "gateway",
      status: trace.status || "ok",
      line: `[${formatLocalDateTime(trace.createdAt)}] [gateway/${trace.status || "ok"}] ${trace.toolName || "unknown"} ${String(trace.durationMs ?? 0)}ms ${
        trace.error || trace.responseSummary || ""
      }`
    }));
    const lines = [...runtimeEvents, ...gatewayEvents, ...liveLines]
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .filter(matchesFilter)
      .slice(-200)
      .map((entry) => entry.line);

    dom.logTerminal.textContent = lines.length ? lines.join("\n") : t("logs.empty");
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
      statusLine?.classList.add("unavailable");
      return;
    }
    const errorCount = runtimeEvents.filter((event) => event.level === "error").length
      + gatewayTraces.filter((trace) => trace.status === "error").length;
    dom.logStatusSummary.textContent = errorCount
      ? t("logs.statusErrors", { count: String(errorCount) })
      : t("logs.statusOk");
    statusLine?.classList.add(errorCount ? "error" : "ok");
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
      dom.logTimeFlowList.innerHTML = `<div class="endpoint-empty">${html(t("logs.timeFlowEmpty"))}</div>`;
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
              <p>${html(preview(item.summary) || t("logs.timeFlowNoDetail"))}</p>
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
      createdAt,
      kind: "ui",
      status: "info",
      line: `[${formatLocalDateTime(createdAt)}] [ui/${source}] ${message}`
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

  function closeAdvancedDiagnostics() {
    if (dom.logAdvancedDiagnostics) dom.logAdvancedDiagnostics.open = false;
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
