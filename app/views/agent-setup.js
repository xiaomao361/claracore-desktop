function createClaraCoreAgentSetupView({ dom, t, getSnapshot, copyValue }) {
  function buildMarkdown() {
    const snapshot = getSnapshot();
    if (!snapshot?.connections) return t("common.checking");
    const endpoints =
      (snapshot.connections.httpEndpoints || [])
        .map((endpoint) => {
          const lines = [
            `- ${t(`connections.endpoint.${endpoint.id}`) || endpoint.id}: ${endpoint.method || "GET"} ${endpoint.url}`
          ];
          if (endpoint.authHeader) lines.push(`  - Header: ${endpoint.authHeader}`);
          if (endpoint.copyUrl) lines.push(`  - Copy URL: ${endpoint.copyUrl}`);
          return lines.join("\n");
        })
        .join("\n") || "- No HTTP endpoints are exposed yet.";
    return `# ClaraCore Agent Setup

ClaraCore Desktop is agent-first: this software is built for agents to operate and for humans to inspect. Treat Agent Access as the primary integration surface.

Desktop owns the product Gateway, Memoria, Shared Line, and InnerLife state for this app. Old local ClaraCore services are references and import sources only. Do not stop or mutate them from this setup.

## Agent Use Order

1. Connect through the Gateway MCP config below.
2. Call \`gateway_context\` first.
3. Use exposed product Gateway tools for Memory, Shared Line, InnerLife, traces, diagnostics, import/export, and maintenance.
4. Use CLI fallback only when MCP is unavailable or when a local recovery script needs it.

## Connection Mode

- Current recommended path: stdio MCP, configured in the agent client with the JSON below.
- Current URL path: Desktop also exposes a localhost HTTP Agent Gateway when the app is running.
- Human copy step: copy this setup note, the MCP config, or a local URL with its bearer token into the agent client.
- LAN path: intentionally disabled by default. Do not bind this beyond localhost unless the user explicitly enables a token-protected LAN mode.

## Gateway MCP

\`\`\`json
${snapshot.connections.mcpConfig}
\`\`\`

## First Context Call

After connecting, call \`gateway_context\` first. It returns the current Shared Line, recent Memory, InnerLife state, Doctor guidance, and recovery advice in one packet.

## CLI Fallback

Run these from the app root when MCP is unavailable:

\`\`\`bash
cd "${snapshot.appRoot}"
node core/cli.js stats
node core/cli.js recall --query "what should I know before continuing?"
node core/cli.js shared-line get
node core/cli.js innerlife status
node core/cli.js innerlife doctor --agent codex
\`\`\`

For writes, keep content factual and agent-scoped:

\`\`\`bash
node core/cli.js store --body "observable fact" --labels codex
node core/cli.js shared-line update --summary "current resumable position"
node core/cli.js innerlife inbox --agent codex --body "material to digest later"
\`\`\`

## Runtime Paths

- App root: ${snapshot.appRoot}
- Data root: ${snapshot.data.root}
- Product database: ${snapshot.data.databasePath}
- Gateway command: ${snapshot.connections.mcpCommand}
- Desktop Gateway runtime: ${snapshot.connections.pythonSource}
- Desktop Gateway Python: ${snapshot.connections.python}
- Gateway env: ${snapshot.connections.gatewayEnvPath}

## Runtime Boundary

- Current Desktop product core: Node/Electron + Desktop-owned SQLite.
- Current Desktop Gateway: Node/Electron stdio MCP.
- Legacy/reference Memoria service: Python CLI, FastAPI, MCP stdio, usually conda env \`zhouwei\`.
- Legacy/reference Continuity service: Python CLI, FastAPI, MCP stdio, usually conda env \`zhouwei\`.
- Legacy/reference InnerLife service: Python package/CLI, FastAPI, MCP stdio, daemon scripts; Python 3.10+ or project venv.
- Hidden migration helpers can read old service databases as one-off migration sources. Normal product use should not start or depend on those Python services.

## HTTP Management Endpoints

${endpoints}

Use \`Authorization: Bearer <token>\` for HTTP requests. \`/agent/setup\` returns this setup as JSON; \`/gateway/context\` returns the first context packet an agent should read.

## Product Surface

- Gateway: available for status, unified context, Memory tools, Shared Line tools, and InnerLife tools
- Memoria: available for fact storage, search, update, labels, archives, records, and maintenance
- Shared Line: available for current position, active line, resume packet, and handoff
- InnerLife: available for session lifecycle, inbox, digest, share timing, daemon controls, and Doctor guidance

## Troubleshooting

- If MCP tools are missing, confirm the command above uses the same Data root as Desktop.
- If an old local Gateway is running, leave it alone during this product-core development phase.
- If you need a custom data directory, set CLARACORE_DESKTOP_DATA_DIR before launching Desktop.
`;
  }

  function render() {
    dom.agentSetupMarkdown.textContent = buildMarkdown();
  }

  function copy() {
    return copyValue(buildMarkdown(), t("agentSetup.copied"), dom.agentSetupNotice);
  }

  return {
    copy,
    render
  };
}

window.createClaraCoreAgentSetupView = createClaraCoreAgentSetupView;
