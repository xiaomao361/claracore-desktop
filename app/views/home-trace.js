function createClaraCoreHomeTrace({ t, escapeHtml, safeJsonObject, getSnapshot }) {
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

  const ACTIONABLE_ERROR_WINDOW_MS = 30 * 60 * 1000;

  function actionableGatewayErrors(traces) {
    const resolved = resolvedGatewayErrorKeys(traces || []);
    const oldestActionable = Date.now() - ACTIONABLE_ERROR_WINDOW_MS;
    return (traces || []).filter((trace) => {
      if (trace.status !== "error") return false;
      // Errors older than the window are history for Agent Access / Logs,
      // not something the operator can still act on from Home.
      if (traceTimeValue(trace) < oldestActionable) return false;
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

  return {
    actionableGatewayErrors,
    agentActivityState,
    formatRelativeTime,
    renderTraceFlow,
    summarizeAgentsFromTraces,
    traceCompactRow,
    tracePriority,
    traceRequest,
    traceResolutionKey,
    traceResponseText,
    traceTimeValue,
    traceTimestamp
  };
}

window.createClaraCoreHomeTrace = createClaraCoreHomeTrace;
