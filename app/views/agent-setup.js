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

Tools are advertised through a profile. \`core\` is the default and carries the normal connection, recall, continuation, and sharing surface. Send \`X-ClaraCore-Tool-Profile: full\` (or set \`CLARACORE_TOOL_PROFILE=full\` on stdio) only if you need the maintenance, import/export, graph, or retention surface. An unknown value resolves to \`core\`.

After tools appear, follow this sequence exactly:

1. Call \`claracore_connection_test\`.
2. Call \`gateway_context\` with \`detail="brief"\` and without \`lineId\`. If it returns \`SHARED_LINE_ID_REQUIRED\`, choose one of its candidates and retry with that explicit \`lineId\`.
3. In the user's current language, proactively report the truthful connection result, explain ClaraCore's Memory, Shared Line, InnerLife, and Gateway/diagnostics capabilities, summarize only the useful current context you actually found, offer 3-5 natural-language example requests, and suggest one evidence-backed next action when appropriate.

Call \`gateway_docs\` when you need the usage guide. It returns a short summary by default; pass \`section\` (\`start\`, \`memory\`, \`shared-line\`, \`innerlife\`, \`diagnostics\`, \`full\`) for one topic. Tool names and argument schemas come from \`tools/list\`, not from this brief. Re-read both after a Desktop upgrade or MCP reconnect.

## Keep four states separate

- **Connected** means the MCP handshake succeeded. It proves nothing about what your host injects per prompt.
- **Context read** means you explicitly called a tool and received a bounded payload.
- **Automatic injection** is host-side behavior. If your host runs no ClaraCore hook, nothing is injected however healthy this connection is.
- **Actual use** means the content reached your response. Report use only when it did, and only with the evidence the tool requires.

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
