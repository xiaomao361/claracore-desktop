function createClaraCoreAgentSetupView({ dom, t, getSnapshot, copyValue }) {
  function currentConnectionMaterial() {
    const snapshot = getSnapshot();
    if (!snapshot?.connections) return null;
    const httpEndpoints = snapshot.connections.httpEndpoints || [];
    const streamableEndpoint = httpEndpoints.find((endpoint) => endpoint.id === "streamable-http-mcp");
    if (!streamableEndpoint?.url || !streamableEndpoint?.authHeader || !snapshot.connections.mcpConfig) return null;
    return {
      httpEndpoint: streamableEndpoint.url,
      httpAuthorization: streamableEndpoint.authHeader,
      stdioConfig: snapshot.connections.mcpConfig
    };
  }

  function buildMarkdown() {
    const material = currentConnectionMaterial();
    if (!material) return "";
    return `# Connect to ClaraCore Desktop

You are being invited to connect to ClaraCore Desktop. Prefer the current Streamable HTTP MCP setup below when your client supports it. If it does not, use the generated stdio fallback. Decide the transport yourself; do not ask the human to choose.

## Preferred: Streamable HTTP MCP

- Endpoint: \`${material.httpEndpoint}\`
- Authorization: \`${material.httpAuthorization}\`
- Send \`X-ClaraCore-Agent-ID\` with your own stable persona id.
- Send \`X-ClaraCore-Client-ID\` with a truthful client id.
- Send \`X-ClaraCore-Conversation-ID\` when your host provides a stable conversation id.

## Fallback: stdio MCP

\`\`\`json
${material.stdioConfig}
\`\`\`

Replace the identity placeholders with your own stable persona id and truthful client id. Never reuse another agent's id.

If you can update and reload your own MCP configuration, do so now. If you cannot, tell the human the exact client settings screen or file to open and give them the single exact config block to paste. Do not answer only "please configure MCP".

After tools appear, follow this sequence exactly:

1. Call \`claracore_connection_test\`.
2. Call \`gateway_docs\` and read **First Connection** and **What ClaraCore Lets You Do**.
3. Call \`shared_line_list\` with \`status=active\`.
4. Call \`gateway_context\`, passing an explicit \`lineId\` when selection is required.
5. In the user's current language, proactively report the truthful connection result, explain ClaraCore's Memory, Shared Line, InnerLife, and Gateway/diagnostics capabilities, summarize only the useful current context you actually found, offer 3-5 natural-language example requests, and suggest one evidence-backed next action when appropriate.

## Current Memory Controller Contract

- \`memory_context\` is the authenticated, observe-only Memory Controller entry point. It is off by default; when the operator enables observe mode, it records bounded recall decisions but returns no injectable context.
- Do not treat \`memory_context\` as a replacement for explicit \`memoria_search\`. Use \`memoria_search\` when the user asks to recall, research, audit, or compare prior state.
- Read the live \`gateway_docs\` and available tool list as the authoritative contract after every Desktop upgrade or MCP reconnect.

Do not claim connection success before the test succeeds. Connecting or reading onboarding material must not create user content in Memory, Shared Line, or InnerLife.`;
  }

  function render() {
    const ready = Boolean(currentConnectionMaterial());
    dom.copyAgentSetup.disabled = !ready;
    dom.agentSetupStatus.textContent = ready ? t("agentSetup.ready") : t("agentSetup.starting");
  }

  async function copy() {
    const markdown = buildMarkdown();
    if (!markdown) {
      dom.agentSetupNotice.textContent = t("agentSetup.starting");
      return false;
    }
    try {
      const copied = await copyValue(markdown, t("agentSetup.copied"), dom.agentSetupNotice);
      if (!copied) dom.agentSetupNotice.textContent = t("agentSetup.copyFailed");
      return copied;
    } catch (error) {
      dom.agentSetupNotice.textContent = t("agentSetup.copyFailed");
      return false;
    }
  }

  return {
    copy,
    render
  };
}

window.createClaraCoreAgentSetupView = createClaraCoreAgentSetupView;
