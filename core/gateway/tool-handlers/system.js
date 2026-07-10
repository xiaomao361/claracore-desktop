const continuity = require("../../continuity");

async function handleSystemTool(name, args, context) {
  const {
    database,
    currentMcpAgentId,
    gatewayLaunchConfig,
    paths,
    serverInfo,
    textResult,
    toolDefinitions
  } = context;

  if (name === "claracore_status") {
    return textResult({
      dataRoot: paths.dataRoot,
      database: await database.getSummary(),
      configuration: await database.getConfiguration({
        dataRoot: paths.dataRoot
      })
    });
  }

  if (name === "gateway_docs") {
    const launch = gatewayLaunchConfig(paths);
    const tools = toolDefinitions();
    return {
      content: [
        {
          type: "text",
          text: [
            "# ClaraCore Desktop Agent Guide",
            "",
            "You are connected to ClaraCore Desktop through MCP. Treat MCP tools as the product contract.",
            "Do not assume you can inspect the packaged app source code. Packaged Desktop runs from app.asar, and source files are not the agent-facing interface.",
            "",
            "## First Calls",
            "",
            "1. Call claracore_connection_test once after installing or changing the MCP config.",
            "2. Call gateway_docs when you need the product/tool boundary.",
            "3. Call shared_line_list with status=active, then call gateway_context with lineId when your agent owns multiple active lines.",
            "",
            "## Identity",
            "",
            "Use a stable agent id for each calling agent. Streamable HTTP callers send X-ClaraCore-Agent-ID. Stdio fallback callers set CLARACORE_AGENT_ID for the process. Do not reuse another agent's id.",
            "Preferred ids: lara, clara, codex. If an old tool-prefixed id needs consolidation, use agent_identity_merge instead of editing SQLite.",
            "",
            "## What You Can Rely On",
            "",
            "- Memory is the factual store. Use memoria_search before assuming context, and memoria_create only for observable facts or decisions.",
            "- Shared Line is the resumable current-position layer. List active lines first, then use shared_line_get or gateway_context with lineId when selection is ambiguous.",
            "- InnerLife is reviewable background thought/share state. Use innerlife_briefing or innerlife_doctor when you need more than the compact gateway_context packet.",
            "- Gateway traces are visible to the operator, so tool calls should be intentional and bounded.",
            "",
            "## What You Should Not Rely On",
            "",
            "- Do not read local source files as the normal workflow.",
            "- Do not mutate SQLite directly.",
            "- Do not stop or replace external legacy ClaraCore services.",
            "- Do not treat the built-in Memory embedding model as a chat or InnerLife model. It is only for local 512-dimensional Memory embeddings.",
            "",
            "## Model Defaults",
            "",
            "- Memory embedding defaults to ClaraCore built-in Xenova/bge-small-zh-v1.5.",
            "- InnerLife defaults to an OpenAI-compatible DeepSeek provider when configured by Desktop.",
            "- If a provider is disabled or unreachable, tools should report that state instead of inventing model output.",
            "",
            "Do not invent tool names. If you are uncertain, call gateway_docs and use the names in Available Tools.",
            "",
            "## Common Recipes",
            "",
            "### Resume work",
            "",
            "1. Call shared_line_list with status=active. If your agent owns multiple active lines, choose one and pass its lineId to gateway_context.",
            "2. Read the selected Shared Line and recent Memory from gateway_context.",
            "3. Continue from the selected state instead of starting a new thread of work.",
            "",
            "### Record a durable fact or decision",
            "",
            "1. Call memoria_search with the topic first.",
            "2. If an existing memory is the same fact, call memoria_update.",
            "3. If it is new, call memoria_create.",
            "4. Add labels such as agent-id:<your-agent-id>, project labels, and stable topic labels.",
            "",
            "### Connect related memories",
            "",
            "1. Call memoria_link_list before adding more links.",
            "2. Call memoria_link_create with kind related, causes, evolved-from, contradicts, or part-of.",
            "3. Add a short note explaining why the link exists.",
            "",
            "### Update the current Shared Line",
            "",
            "1. Call shared_line_list with status=active. When more than one active line belongs to your agent, choose the intended line.",
            "2. Pass that explicit lineId to shared_line_get or gateway_context, then to shared_line_update after meaningful progress.",
            "3. A request without lineId is allowed only when your agent owns zero or one active non-default line. SHARED_LINE_ID_REQUIRED means no write occurred; list and retry with lineId.",
            "4. Use interpretationStatus=needs_review when the state is uncertain.",
            "",
            "### Diagnose Gateway state",
            "",
            "1. Call claracore_status for product health and configuration.",
            "2. Call gateway_trace_list to inspect recent tool calls.",
            "3. Do not mutate SQLite directly.",
            "",
            "## Module Playbook",
            "",
            "### Memory / Memoria",
            "",
            "- Search first with memoria_search before creating a new memory.",
            "- Use memoria_create only for durable, factual, reviewable information. Keep one memory focused on one fact or decision.",
            "- Add useful labels at write time, especially agent-id:<your-agent-id>, project/module labels, and stable topic labels.",
            "- Use memoria_update when correcting or refining the same fact. Do not create duplicate memories for the same fact.",
            "- Use memoria_link_create after creating or finding related memories. Link kinds: related, causes, evolved-from, contradicts, part-of.",
            "- Add a short link note explaining why the connection exists. Use strength only when you have a reason.",
            "- Use memoria_link_list to inspect a memory neighborhood before adding more links.",
            "- Use memoria_record_create for structured recurring logs or metrics, not prose facts. Include recordType, value, occurredAt, and a stable dedupeKey when the event might be written again.",
            "",
            "### Shared Line",
            "",
            "- Treat Shared Line as the current resumable working position, not as long-term fact storage.",
            "- Call shared_line_list first. If your agent owns multiple active lines, always pass the intended lineId to shared_line_get, gateway_context, and shared_line_update.",
            "- SHARED_LINE_ID_REQUIRED is a safe refusal: no line was changed. Select a candidate and retry with lineId.",
            "- Use shared_line_update after meaningful progress, handoff, or a changed interpretation. Keep summary concise and actionable.",
            "- Use interpretationStatus=needs_review when state is uncertain and the next agent should be cautious.",
            "- Use shared_line_handoff when explicitly handing work to another agent or future session.",
            "",
            "### InnerLife",
            "",
            "- Use innerlife_session_start at the beginning of a real work session when you want session-aware afterthoughts and share timing.",
            "- Use innerlife_session_end with a short summary when the work session ends.",
            "- Use innerlife_submit_inbox, innerlife_submit_fact, or innerlife_submit_continuity for material that should be digested later, not for immediate factual recall.",
            "- Use innerlife_pending_shares and innerlife_share_check before surfacing a waiting share to the user.",
            "- Use innerlife_doctor when InnerLife seems idle, paused, or misconfigured.",
            "",
            "### Gateway / Diagnostics",
            "",
            "- Use claracore_status for product health and gateway_trace_list to inspect recent tool calls.",
            "- Keep tool calls bounded. The operator can see Gateway traces.",
            "- Never mutate SQLite directly; use MCP tools.",
            "",
            "## MCP Config",
            "",
            "Prefer the Streamable HTTP MCP endpoint shown in Agent Access when your client supports it. Use this generated stdio config only as a compatibility fallback.",
            "",
            "```json",
            JSON.stringify(
              {
                mcpServers: {
                  "claracore-desktop": {
                    type: "stdio",
                    command: launch.command,
                    args: launch.args,
                    env: {
                      CLARACORE_AGENT_ID: "<agent-stable-id>",
                      CLARACORE_DESKTOP_DATA_DIR: paths.dataRoot
                    }
                  }
                }
              },
              null,
              2
            ),
            "```",
            "",
            "## Available Tools",
            "",
            ...tools.map((tool) => `- ${tool.name}: ${tool.description}`),
            "",
            "## Useful Startup Sequence",
            "",
            "claracore_connection_test -> gateway_docs -> shared_line_list(status=active) -> gateway_context(lineId when needed)",
            "",
            "## CLI Fallback",
            "",
            "Use this only when MCP is unavailable and the operator has granted local shell access:",
            "",
            launch.displayCommand,
            "",
            `Source: ${launch.source}`,
            `Data root: ${paths.dataRoot}`,
            "",
            "Keep old ClaraCore service processes untouched during this product-core development phase."
          ].join("\n")
        }
      ]
    };
  }

  if (name === "claracore_connection_test") {
    const agentId = currentMcpAgentId(args);
    const summary = await database.getSummary();
    const daemonState = await database.ensureInnerLifeDaemonState(agentId);
    return textResult({
      ok: true,
      agentId,
      transport: "mcp",
      server: serverInfo,
      dataRoot: paths.dataRoot,
      database: {
        initialized: Boolean(summary.initialized),
        path: paths.databasePath
      },
      modules: {
        gateway: "available",
        memoria: summary.memories_count > 0 ? "ready" : "empty",
        continuity: summary.continuity_lines_count > 0 ? "ready" : "empty",
        innerlife: daemonState?.status || "paused"
      },
      timestamp: new Date().toISOString(),
      next: "Call shared_line_list with status=active, then call gateway_context with lineId when needed."
    });
  }

  if (name === "gateway_context") {
    return textResult(await continuity.gatewayContext({ database }, args));
  }

  if (name === "gateway_trace_list") {
    return textResult({
      traces: await database.listGatewayTraces(args)
    });
  }

  if (name === "agent_identity_merge") {
    return textResult(await database.mergeAgentIdentity(args));
  }

  return undefined;
}

module.exports = {
  handleSystemTool
};
