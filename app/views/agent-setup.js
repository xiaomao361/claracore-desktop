function createClaraCoreAgentSetupView({ dom, t, getSnapshot, copyValue }) {
  function buildMarkdown() {
    const snapshot = getSnapshot();
    if (!snapshot?.connections) return t("common.checking");
    const agentIdentity = snapshot.connections.agentIdentity || {};
    const agentExamples = agentIdentity.examples || ["lara", "clara", "codex"];
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
    return `# ClaraCore Agent Instructions

You are an external agent being connected to ClaraCore Desktop. Read this note, install or verify the MCP server config below, then use the listed MCP tools instead of trying to inspect local source files.

If you cannot edit your own MCP settings, tell the user exactly where to paste the JSON config and ask them to fully restart the agent client. After restart, call \`claracore_connection_test\`, then \`gateway_docs\`, then \`gateway_context\`.

## Your Immediate Tasks

1. Make sure the MCP server named \`claracore-desktop\` is installed with the JSON in "Gateway MCP" below.
2. Use your own stable \`${agentIdentity.envKey || "CLARACORE_AGENT_ID"}\` value. Do not reuse another agent's id.
3. After MCP tools are available, call \`claracore_connection_test\`.
4. Call \`gateway_docs\` to learn ClaraCore's product boundary and tool contract.
5. Call \`gateway_context\` before doing useful work.

---

# ClaraCore Agent Setup

ClaraCore Desktop is agent-first: this software is built for agents to operate and for humans to inspect. Treat Agent Access as the primary integration surface.

Desktop owns the product Gateway, Memoria, Shared Line, and InnerLife state for this app. Old local ClaraCore services are references and import sources only. Do not stop or mutate them from this setup.

## Agent Use Order

1. Install ClaraCore Desktop as an MCP server in your own agent client.
2. Set \`${agentIdentity.envKey || "CLARACORE_AGENT_ID"}\` to your own stable agent id.
3. Call \`gateway_docs\` for the product/tool boundary, then \`gateway_context\` for the current working packet. Desktop uses your configured \`${agentIdentity.envKey || "CLARACORE_AGENT_ID"}\` as the MCP process identity.
4. Use exposed product Gateway tools for Memory, Shared Line, InnerLife, traces, diagnostics, import/export, and maintenance.
5. Use CLI fallback only when MCP is unavailable or when a local recovery script needs it.

## Agent Identity Contract

\`${agentIdentity.envKey || "CLARACORE_AGENT_ID"}\` belongs to the calling agent. Do not share one id across agents.

Recommended stable ids:

${agentExamples.map((item) => `- \`${item}\``).join("\n")}

If you are a new agent, choose one stable id before writing any data. Keep using it in every ClaraCore MCP call.

## Connection Mode

- ClaraCore Desktop should stay open as the local agent service.
- Current MCP path: stdio MCP, configured in the agent client with the JSON below.
- Local helper URL: Desktop exposes a localhost HTTP Agent Gateway while the app is running. Its port is assigned at startup; use the current URL from Agent Access or \`/agent/setup\`, and do not hard-code the port.
- Human copy step: this brief is for an agent to read and install itself. The MCP config is a fallback for manual setup.
- LAN path: intentionally disabled by default. Do not bind this beyond localhost unless the user explicitly enables a token-protected LAN mode.

## Gateway MCP

\`\`\`json
${snapshot.connections.mcpConfig}
\`\`\`

## Claude Desktop Setup

Claude Desktop newer builds may show MCP entry points under Settings -> Extensions. For custom local servers, keep using the generated stdio MCP config above. If Claude Desktop offers a custom extension install flow, use it only after ClaraCore ships an explicit \`.mcpb\` package; this app currently publishes the stdio config as the supported path.

Manual setup:

1. Open Claude Desktop settings and find the MCP or Extensions developer config entry.
2. Add or replace the \`claracore-desktop\` server with the JSON above.
3. Set \`${agentIdentity.envKey || "CLARACORE_AGENT_ID"}\` to this Claude agent's stable id, for example \`claude\` or \`clara\`.
4. Fully quit and restart Claude Desktop so the stdio process is relaunched with the new environment.
5. In Claude, call \`claracore_connection_test\` once, then call \`gateway_docs\`, then call \`gateway_context\`.

If tools do not appear after a Claude Desktop update, verify the JSON is valid, confirm the command path still exists, and fully restart the app rather than only closing its window.

## First Context Call

After installing, call \`gateway_docs\`, then \`gateway_context\`.

\`gateway_docs\` explains the agent-facing product boundary without requiring source access. \`gateway_context\` returns the current Shared Line, recent Memory, InnerLife state, Doctor guidance, and recovery advice in one packet.
Any successful MCP call appears in Agent Access as recent agent activity.

Do not invent tool names. If you are uncertain, call \`gateway_docs\` and use the names in its Available Tools list.

## Common MCP Recipes

### Resume work

1. Call \`gateway_context\`.
2. Read the current Shared Line and recent Memory.
3. Continue from the current state instead of starting a new thread of work.

### Record a durable fact or decision

1. Call \`memoria_search\` with the topic first.
2. If an existing memory is the same fact, call \`memoria_update\`.
3. If it is new, call \`memoria_create\`.
4. Add labels such as \`agent-id:<your-agent-id>\`, project labels, and stable topic labels.

### Connect related memories

1. Call \`memoria_link_list\` before adding more links.
2. Call \`memoria_link_create\` with \`kind\` set to \`related\`, \`causes\`, \`evolved-from\`, \`contradicts\`, or \`part-of\`.
3. Add a short \`note\` explaining why the link exists.

### Update the current Shared Line

1. Call \`shared_line_get\` or \`gateway_context\`.
2. Call \`shared_line_update\` after meaningful progress, handoff, or a changed interpretation.
3. Use \`interpretationStatus: "needs_review"\` when the state is uncertain.

### Diagnose Gateway state

1. Call \`claracore_status\` for product health and configuration.
2. Call \`gateway_trace_list\` to inspect recent tool calls.
3. Do not mutate SQLite directly.

## Module Playbook

### Memory / Memoria

- Always search first with \`memoria_search\` before creating a new memory.
- Use \`memoria_create\` only for durable, factual, reviewable information. Keep one memory focused on one fact or decision.
- Add useful labels at write time, especially \`agent-id:<your-agent-id>\`, project/module labels, and stable topic labels.
- Use \`memoria_update\` when correcting or refining the same fact. Do not create duplicate memories for the same fact.
- Use \`memoria_link_create\` after creating or finding related memories. Prefer:
  - \`related\` for loose association
  - \`causes\` when one fact caused another
  - \`evolved-from\` when a newer decision replaces an older one
  - \`contradicts\` when two memories conflict and need review
  - \`part-of\` when one memory belongs inside a broader topic
- Give links a short \`note\` explaining why the connection exists, and set \`strength\` only when you have a reason.
- Use \`memoria_link_list\` to inspect a memory neighborhood before adding more links.
- Use \`memoria_record_create\` for structured recurring logs or metrics, not prose facts. Include \`recordType\`, \`value\`, \`occurredAt\`, and a stable \`dedupeKey\` when the event might be imported or written again.

### Shared Line

- Treat Shared Line as the current resumable working position, not as long-term fact storage.
- Read \`shared_line_get\` or \`gateway_context\` before updating.
- Use \`shared_line_update\` after meaningful progress, handoff, or a changed interpretation. Keep \`summary\` concise and actionable.
- Use \`interpretationStatus: "needs_review"\` when the state is uncertain and the next agent should be cautious.
- Use \`shared_line_handoff\` when explicitly handing work to another agent or future session.

### InnerLife

- Use \`innerlife_session_start\` at the beginning of a real work session when you want session-aware afterthoughts and share timing.
- Use \`innerlife_session_end\` with a short summary when the work session ends.
- Use \`innerlife_submit_inbox\`, \`innerlife_submit_fact\`, or \`innerlife_submit_continuity\` for material that should be digested later, not for immediate factual recall.
- Use \`innerlife_pending_shares\` and \`innerlife_share_check\` before surfacing a waiting share to the user. Do not force a share into the conversation if timing does not fit.
- Use \`innerlife_doctor\` when InnerLife seems idle, paused, or misconfigured.

### Gateway / Diagnostics

- Use \`claracore_status\` for product health and \`gateway_trace_list\` to inspect recent tool calls.
- Keep tool calls bounded. The operator can see Gateway traces.
- Never mutate SQLite directly; use MCP tools.

## CLI Fallback

Run these from the app root when MCP is unavailable:

\`\`\`bash
cd "${snapshot.appRoot}"
node core/cli.js stats
node core/cli.js recall --query "what should I know before continuing?"
node core/cli.js shared-line get
node core/cli.js innerlife status
node core/cli.js innerlife doctor --agent <agent-id>
\`\`\`

For writes, keep content factual and agent-scoped:

\`\`\`bash
node core/cli.js store --body "observable fact" --labels agent-id:<agent-id>
node core/cli.js shared-line update --summary "current resumable position"
node core/cli.js innerlife inbox --agent <agent-id> --body "material to digest later"
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

Use \`Authorization: Bearer <token>\` for HTTP requests. \`/agent/setup\` returns this setup as JSON; \`/gateway/context\` returns the first context packet an agent should read. HTTP is a helper surface; MCP remains the product tool contract.

## Product Surface

- Gateway: available for status, unified context, Memory tools, Shared Line tools, and InnerLife tools
- Memoria: available for fact storage, search, update, labels, archives, records, and maintenance
- Shared Line: available for latest progress, active line, archived lines, compressed records, and resume packet
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
