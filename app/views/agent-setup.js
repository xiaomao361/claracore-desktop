function createClaraCoreAgentSetupView({ dom, t, getSnapshot, copyValue, formatLocalDateTime = value => value, refreshSnapshot }) {
  let noticeKey = "";
  let refreshInFlight = false;
  let refreshFailed = false;
  let copying = false;

  function currentConnectionMaterial() {
    const snapshot = getSnapshot();
    if (snapshot?.connections?.httpGateway?.ok !== true || snapshot.connections.httpGateway.error) return null;
    const httpEndpoints = Array.isArray(snapshot.connections.httpEndpoints) ? snapshot.connections.httpEndpoints : [];
    const streamableEndpoint = httpEndpoints.find((endpoint) => endpoint.id === "streamable-http-mcp");
    if (!streamableEndpoint?.url || !streamableEndpoint?.authHeader) return null;
    return {
      httpEndpoint: streamableEndpoint.url,
      httpAuthorization: streamableEndpoint.authHeader
    };
  }

  function buildMarkdown() {
    const material = currentConnectionMaterial();
    if (!material) return "";
    return `# Connect to ClaraCore Desktop

You are being invited to connect to ClaraCore Desktop. The user continues chatting in their usual agent; Desktop lets them inspect saved information, ongoing topics, and sourced material. Use the Streamable HTTP MCP setup below. Keep Desktop running. If your client does not support Streamable HTTP, report that incompatibility and request a client upgrade.

## Streamable HTTP MCP

- Endpoint: \`${material.httpEndpoint}\`
- Authorization: \`${material.httpAuthorization}\`
- Send \`X-ClaraCore-Agent-ID\` with your own stable persona id.
- Send \`X-ClaraCore-Client-ID\` with a truthful client id.
- Send \`X-ClaraCore-Conversation-ID\` when your host provides a stable conversation id.

Use your own stable persona id and truthful client id. Never reuse another agent's id, even to open a line copied from another agent. The setup brief contains a local access credential: keep it private and do not include it in public messages, reports, source control, or saved user content.

If you can update and reload your own MCP configuration, do so now. If you cannot, tell the human the exact client settings screen or file to open and give them the single exact config block to paste. Do not answer only "please configure MCP".

Tools are advertised through a profile. \`core\` is the default and carries the normal connection, recall, continuation, and sharing surface. Send \`X-ClaraCore-Tool-Profile: core-compat\` for the previous 38-tool catalog, or \`X-ClaraCore-Tool-Profile: full\` for specialized and maintenance tools. Configure the header and reconnect; live catalog refresh is not assumed. Profiles control discovery, not authority. An unknown value resolves to \`core\`.

After tools appear, follow this sequence exactly:

1. Call \`claracore_connection_test\`. If it fails or returns an incomplete result, explain the specific result and stop dependent reads. A ready local service is not proof that this client connected.
2. If the user supplied a specific Shared Line ID, read that exact ID with \`shared_line_get\`. Otherwise call \`shared_line_get\` without \`lineId\`. If it returns \`SHARED_LINE_ID_REQUIRED\`, use a returned candidate only when the user intent uniquely identifies it; otherwise show its bounded candidates and ask which topic they mean. Do not choose an unrelated line or change the active line. If no content is found, report that without creating any.
3. Report the connection test and the context actually read separately, in the user's language. Explain that Memory keeps saved information, Shared Lines keep ongoing topics, and Knowledge keeps sources. Optional InnerLife reflections are not confirmed facts. Examples may include a plant-care preference, a work discussion to resume, and finding a saved article. These are examples only: do not save them or require a task, deadline, or next step. Offer a useful action only when supported by the user's intent and actual results.

Call \`gateway_docs\` when you need the versioned usage guide. It returns a short summary by default; pass \`section\` (\`start\`, \`memory\`, \`shared-line\`, \`innerlife\`, \`diagnostics\`, \`full\`) for one topic, or pass \`query\` to search maintained guide passages. Tool names and argument schemas come from \`tools/list\`, not from the guide. Re-read both after a Desktop upgrade or MCP reconnect.

## Keep four states separate

- **Connected** means the MCP handshake succeeded. It proves nothing about what your host injects per prompt.
- **Context read** means you explicitly called a tool and received a bounded payload.
- **Automatic injection** is host-side behavior. If your host runs no ClaraCore hook, nothing is injected however healthy this connection is.
- **Actual use** means the content reached your response. Report use only when it did, and only with the evidence the tool requires.

Do not claim connection success before the test succeeds. Connecting or reading onboarding material must not create user content in Memory, Shared Line, or InnerLife.`;
  }

  function render() {
    const snapshot = getSnapshot();
    const connections = snapshot?.connections || {};
    const gateway = connections.httpGateway || {};
    const material = currentConnectionMaterial();
    const ready = Boolean(material);
    const issue = Boolean(gateway.error || gateway.ok === false);
    dom.copyAgentSetup.disabled = !ready || copying || refreshFailed;
    dom.agentSetupStatus.textContent = t(refreshFailed ? "agentSetup.unconfirmed" : ready ? "agentSetup.ready" : issue ? "agentSetup.unavailable" : gateway.ok === true ? "agentSetup.materialMissing" : "agentSetup.starting");
    dom.agentSetupStatus.className = `agent-setup-status ${refreshFailed || issue ? "is-error" : ready ? "is-ready" : "is-pending"}`;
    if (dom.refreshAgentSetup) dom.refreshAgentSetup.disabled = refreshInFlight;
    renderEvidence(snapshot);
    if (dom.agentSetupNotice) dom.agentSetupNotice.textContent = noticeKey ? t(noticeKey) : "";

    const setState = (element, state, key) => {
      if (!element) return;
      element.textContent = t(key);
      element.className = `agent-access-state ${state}`;
    };
    setState(
      dom.agentGatewayStatus,
      refreshFailed || issue ? "is-error" : gateway.ok === true ? "is-ready" : "is-pending",
      refreshFailed ? "agentSetup.state.unconfirmed" : issue ? "agentSetup.state.issue" : gateway.ok === true ? "agentSetup.state.ready" : "agentSetup.state.starting"
    );
    setState(
      dom.agentHttpStatus,
      refreshFailed || issue ? "is-error" : material?.httpEndpoint ? "is-ready" : "is-pending",
      refreshFailed ? "agentSetup.state.unconfirmed" : issue ? "agentSetup.state.issue" : material?.httpEndpoint ? "agentSetup.state.ready" : gateway.ok === true ? "agentSetup.materialMissing" : "agentSetup.state.starting"
    );
    setState(
      dom.agentGuideStatus,
      connections.agentGuide?.version ? "is-ready" : "is-pending",
      connections.agentGuide?.version ? "agentSetup.state.versioned" : "agentSetup.state.starting"
    );
    if (dom.agentGuideVersion) {
      dom.agentGuideVersion.textContent = connections.agentGuide?.version
        ? `gateway_docs · v${connections.agentGuide.version}`
        : "gateway_docs";
    }
  }

  async function copy() {
    if (copying) return false;
    if (refreshFailed) {
      noticeKey = "agentSetup.refreshFailed";
      render();
      return false;
    }
    const material = currentConnectionMaterial();
    const markdown = buildMarkdown();
    if (!markdown) {
      noticeKey = "agentSetup.unavailable";
      dom.agentSetupNotice.textContent = t(noticeKey);
      return false;
    }
    copying = true;
    render();
    try {
      const copied = await copyValue(markdown, "");
      const current = currentConnectionMaterial();
      if (refreshFailed || !current || current.httpEndpoint !== material.httpEndpoint || current.httpAuthorization !== material.httpAuthorization) {
        noticeKey = "agentSetup.materialChanged";
        return false;
      }
      noticeKey = copied ? "agentSetup.copied" : "agentSetup.copyFailed";
      dom.agentSetupNotice.textContent = t(noticeKey);
      return copied;
    } catch (error) {
      noticeKey = "agentSetup.copyFailed";
      dom.agentSetupNotice.textContent = t(noticeKey);
      return false;
    } finally {
      copying = false;
      render();
    }
  }

  function traceTime(trace) {
    const value = String(trace?.createdAt || "");
    const iso = value.includes("T") ? value : value.replace(" ", "T");
    const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function renderEvidence(snapshot) {
    if (!dom.agentConnectionEvidence) return;
    if (refreshFailed) {
      dom.agentConnectionEvidence.textContent = t("agentSetup.refreshFailed");
      return;
    }
    if (!Array.isArray(snapshot?.gatewayTraces)) {
      dom.agentConnectionEvidence.textContent = t("agentSetup.observationUnavailable");
      return;
    }
    const traces = [...snapshot.gatewayTraces].sort((a, b) => traceTime(b) - traceTime(a));
    const latest = traces[0];
    if (!latest) {
      dom.agentConnectionEvidence.textContent = t("agentSetup.noRequests");
      return;
    }
    const test = traces.find(trace => trace.toolName === "claracore_connection_test");
    const identity = [latest.agentId, latest.clientId].filter(Boolean).join(" / ") || t("agentSetup.identityUnknown");
    const time = traceTime(latest) ? formatLocalDateTime(latest.createdAt) : t("common.notTracked");
    const request = t("agentSetup.lastRequest", { identity, time });
    if (!test) {
      dom.agentConnectionEvidence.textContent = `${request} ${t("agentSetup.noTestInRange")}`;
      return;
    }
    const testIdentity = [test.agentId, test.clientId].filter(Boolean).join(" / ") || t("agentSetup.identityUnknown");
    const testTime = traceTime(test) ? formatLocalDateTime(test.createdAt) : t("common.notTracked");
    const testKey = test.error || test.status === "error" ? "agentSetup.testFailed" : test.status === "ok" ? "agentSetup.testCompleted" : "agentSetup.testUnknown";
    dom.agentConnectionEvidence.textContent = `${request} ${t(testKey, { identity: testIdentity, time: testTime })} ${t("agentSetup.observationScope")}`;
  }

  async function refresh() {
    if (refreshInFlight || typeof refreshSnapshot !== "function") return;
    refreshInFlight = true;
    noticeKey = "";
    render();
    try {
      await refreshSnapshot();
      refreshFailed = false;
    } catch (_) {
      refreshFailed = true;
    } finally {
      refreshInFlight = false;
      render();
    }
  }

  return {
    copy,
    refresh,
    render
  };
}

window.createClaraCoreAgentSetupView = createClaraCoreAgentSetupView;
