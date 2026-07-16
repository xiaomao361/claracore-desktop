function createClaraCoreHomePresence({ t, actionableGatewayErrors }) {
  const PRESENCE_WINDOW_MS = 15 * 60 * 1000;
  const BRIGHT_WINDOW_MS = 90 * 1000;
  const PALETTE = ["#5b8ff9", "#6c7ee8", "#4fa6a0", "#a06bd6", "#d27b69", "#b18a45"];
  const previousObservedByAgent = new Map();
  let hasBuiltSnapshot = false;

  function compactText(value, max = 180) {
    const text = String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function traceTimestamp(trace) {
    const raw = String(trace?.createdAt || trace?.created_at || "").trim();
    if (!raw) return 0;
    const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
    const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(normalized) ? normalized : `${normalized}Z`);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function stableAgentColor(agentId) {
    let hash = 2166136261;
    for (const char of String(agentId || "unknown").toLowerCase()) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return PALETTE[Math.abs(hash >>> 0) % PALETTE.length];
  }

  function agentLabel(agentId) {
    const raw = String(agentId || t("home.presence.unknownAgent"));
    const tail = raw.split(":").filter(Boolean).pop() || raw;
    return tail.replace(/(^|[-_\s])([a-z])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`);
  }

  function isExplicitlyActive(trace) {
    return Boolean(trace?.inFlight || trace?.in_flight || ["active", "running", "in_progress"].includes(trace?.status));
  }

  function recentAgents(traces, now) {
    const sorted = [...(traces || [])].sort((left, right) => traceTimestamp(right) - traceTimestamp(left));
    const latestByAgent = new Map();
    for (const trace of sorted) {
      const agentId = String(trace?.agentId || trace?.agent_id || "").trim();
      const observedAt = traceTimestamp(trace);
      if (!agentId || !observedAt || now - observedAt > PRESENCE_WINDOW_MS || latestByAgent.has(agentId)) continue;
      latestByAgent.set(agentId, trace);
    }
    const agents = [...latestByAgent.entries()].slice(0, 3).map(([id, trace], index) => {
      const lastObservedAt = traceTimestamp(trace);
      const age = Math.max(0, now - lastObservedAt);
      const presence = isExplicitlyActive(trace) ? "active" : age <= BRIGHT_WINDOW_MS ? "recent" : "fading";
      const previousObservedAt = previousObservedByAgent.get(id) || 0;
      return {
        id,
        label: agentLabel(id),
        color: stableAgentColor(id),
        presence,
        lastObservedAt,
        toolName: compactText(trace.toolName || trace.tool_name, 48),
        source: "gateway-trace",
        orbitIndex: index,
        arrival: hasBuiltSnapshot && lastObservedAt > previousObservedAt
      };
    });
    latestByAgent.forEach((trace, id) => previousObservedByAgent.set(id, traceTimestamp(trace)));
    hasBuiltSnapshot = true;
    return agents;
  }

  function currentSharedLine(snapshot) {
    const sharedLine = snapshot?.sharedLine || {};
    const position = sharedLine.currentPosition || sharedLine.current_position || {};
    const title = position.lineTitle || position.line_title || sharedLine.currentLine?.title || sharedLine.current_line?.title || "";
    return {
      title: compactText(title, 80),
      summary: compactText(position.summary || position.currentState || position.current_state, 220)
    };
  }

  function emergingThought(snapshot) {
    const innerLife = snapshot?.innerLife || {};
    const candidates = [...(innerLife.pendingShares || []), ...(innerLife.inbox || [])];
    const item = candidates.find((candidate) => {
      const status = String(candidate?.status || "").toLowerCase();
      return !status || ["pending", "waiting", "candidate", "ready"].includes(status);
    });
    if (!item) return "";
    return compactText(item.body || item.content || item.message || item.summary || item.text || item.prompt, 180);
  }

  function actionableIssue(snapshot) {
    const healthIssue = (snapshot?.health?.checks || []).find((check) => check.level === "error");
    if (healthIssue) {
      return {
        tone: "error",
        text: compactText(healthIssue.detail || t(healthIssue.labelKey) || healthIssue.id, 160)
      };
    }
    const traceIssue = actionableGatewayErrors(snapshot?.gatewayTraces || [])[0];
    if (!traceIssue) return null;
    return {
      tone: "error",
      text: compactText(traceIssue.error || traceIssue.toolName || t("home.presence.actionRequired"), 160)
    };
  }

  function build(snapshot, now = Date.now()) {
    const agents = recentAgents(snapshot?.gatewayTraces || [], now);
    const sharedLine = currentSharedLine(snapshot);
    const issue = actionableIssue(snapshot);
    const dominant = agents[0] || null;
    const coreState = issue ? "error" : agents.some((agent) => agent.presence === "active") ? "active" : agents.length ? "recent" : "quiet";
    const title = dominant
      ? dominant.presence === "active"
        ? t("home.presence.agentActive", { agent: dominant.label })
        : dominant.presence === "recent"
          ? t("home.presence.agentJustHere", { agent: dominant.label })
          : t("home.presence.agentRecentlyHere", { agent: dominant.label })
      : t("home.presence.noRecentAgents");
    const detail = dominant?.toolName
      ? t("home.presence.observedThrough", { tool: dominant.toolName })
      : agents.length
        ? t("home.presence.observedActivity")
        : t("home.presence.quietDetail");

    return {
      core: {
        state: coreState,
        dominantColor: dominant?.color || "#7f95ad",
        currentLineTitle: sharedLine.title,
        currentSummary: sharedLine.summary,
        emergingThought: emergingThought(snapshot)
      },
      title,
      detail,
      agents,
      actionableIssue: issue
    };
  }

  return { build, stableAgentColor, traceTimestamp };
}

window.createClaraCoreHomePresence = createClaraCoreHomePresence;
