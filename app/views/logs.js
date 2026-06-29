function createClaraCoreLogsView({ dom, t, getSnapshot, refreshSnapshot }) {
  let followEnabled = true;
  let refreshTimer = null;
  let refreshInFlight = false;
  const liveLines = [];

  function render() {
    const snapshot = getSnapshot();
    const runtimeSource = snapshot?.runtimeEvents || [];
    const gatewaySource = snapshot?.gatewayTraces || [];
    const runtimeEvents = runtimeSource.map((event) => ({
      createdAt: event.createdAt || "",
      line: `[${event.createdAt || ""}] [${event.level || "info"}/${event.source || "runtime"}] ${event.message || ""}${
        event.metadata && Object.keys(event.metadata).length ? ` ${JSON.stringify(event.metadata)}` : ""
      }`
    }));
    const gatewayEvents = gatewaySource.map((trace) => ({
      createdAt: trace.createdAt || "",
      line: `[${trace.createdAt || ""}] [gateway/${trace.status || "ok"}] ${trace.toolName || "unknown"} ${String(trace.durationMs ?? 0)}ms ${
        trace.error || trace.responseSummary || ""
      }`
    }));
    const lines = [...runtimeEvents, ...gatewayEvents, ...liveLines]
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .slice(-200)
      .map((entry) => entry.line);

    dom.logTerminal.textContent = lines.length ? lines.join("\n") : t("logs.empty");
    dom.logRuntimeCount.textContent = String(runtimeSource.length);
    dom.logGatewayCount.textContent = String(gatewaySource.length);
    dom.logLineCount.textContent = String(lines.length);
    dom.logLastRefresh.textContent = new Date().toLocaleTimeString();
    dom.toggleLogFollow.classList.toggle("active", followEnabled);
    if (followEnabled) {
      dom.logTerminal.scrollTop = dom.logTerminal.scrollHeight;
    }
  }

  function appendLiveLine(source, message) {
    const createdAt = new Date().toISOString();
    liveLines.push({
      createdAt,
      line: `[${createdAt}] [ui/${source}] ${message}`
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

  function clear() {
    if (!window.confirm(t("logs.clearConfirm"))) return;
    dom.clearLogs.disabled = true;
    window.ClaraCoreDesktop.clearLogs()
      .then((result) => {
        liveLines.length = 0;
        return refreshSnapshot().then(() => result);
      })
      .then((result) => {
        appendLiveLine("logs", t("logs.cleared", {
          runtime: result?.runtimeEventsDeleted || 0,
          gateway: result?.gatewayTracesDeleted || 0
        }));
      })
      .catch((error) => {
        console.error(error);
        appendLiveLine("logs", `${t("logs.clearFailed")}: ${error.message || String(error)}`);
      })
      .finally(() => {
        dom.clearLogs.disabled = false;
      });
  }

  return {
    appendLiveLine,
    clear,
    refreshNow,
    render,
    syncRefreshTimer,
    toggleFollow
  };
}

window.createClaraCoreLogsView = createClaraCoreLogsView;
