const continuity = require("../../continuity");
const { BUILD_FLAVOR, HAS_BUILT_IN_EMBEDDING } = require("../../build-flavor");

async function handleSystemTool(name, args, context) {
  const {
    database,
    currentCallerContext,
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
            "## First Connection",
            "",
            "1. Call claracore_connection_test once after installing or changing the MCP config.",
            "2. Read this gateway_docs guide.",
            "3. Call shared_line_list with status=active.",
            "4. Call gateway_context with an explicit lineId when selection is required.",
            "5. Proactively tell the user the truthful connection result, what ClaraCore enables, and what resumable context you found.",
            "",
            "## What ClaraCore Lets You Do",
            "",
            "- Memory: remember and retrieve durable facts, preferences, decisions, and prior knowledge when they matter. Search before writing; do not store ordinary chat automatically.",
            "- Shared Line: find where ongoing work stopped and continue without starting over. Select the intended active line before reading or updating it.",
            "- InnerLife: keep and revisit background thoughts, then share them when they are useful and timely. Do not automatically promote thoughts into Memory or Shared Line.",
            "- Gateway and diagnostics: verify connection and inspect bounded evidence when a tool call or runtime behavior fails.",
            "",
            "## Tell The User",
            "",
            "After reading current context, respond in the user's current language without waiting for them to ask how to use ClaraCore.",
            "Include the truthful connection result, the four capabilities above in natural language, a bounded summary of actual context, 3-5 example requests, and one evidence-backed next action when appropriate.",
            "If context is empty or ambiguous, say so. Never claim a line, memory, thought, model, or health state that tools did not return.",
            "",
            "## Current Context",
            "",
            "Call shared_line_list with status=active first. Then call gateway_context with the intended lineId when selection is required. Read only the context needed to help the user begin.",
            "",
            "## Identity And Safety",
            "",
            "Use a stable persona id for each calling agent. Streamable HTTP callers send X-ClaraCore-Agent-ID, X-ClaraCore-Client-ID, and X-ClaraCore-Conversation-ID. Stdio fallback callers set CLARACORE_AGENT_ID plus optional CLARACORE_CLIENT_ID and CLARACORE_CONVERSATION_ID. Caller conversation ids never replace domain ids such as InnerLife sessionId.",
            "Preferred ids: lara, clara, codex. If an old tool-prefixed id needs consolidation, use agent_identity_merge instead of editing SQLite.",
            "",
            "Safety boundaries:",
            "",
            "- Do not read local source files as the normal workflow.",
            "- Do not mutate SQLite directly.",
            "- Do not stop or replace external legacy ClaraCore services.",
            HAS_BUILT_IN_EMBEDDING
              ? "- Do not treat the built-in Memory embedding model as a chat or InnerLife model. It is only for local 512-dimensional Memory embeddings."
              : "- This Lite build does not include the ClaraCore built-in Memory embedding model. Use Ollama or disable semantic embeddings.",
            "",
            "## Model Defaults",
            "",
            HAS_BUILT_IN_EMBEDDING
              ? "- Memory embedding defaults to ClaraCore built-in Xenova/bge-small-zh-v1.5."
              : "- Memory embedding uses Ollama in this Lite build. Select an installed Ollama embedding model before testing or embedding.",
            `- Desktop build flavor: ${BUILD_FLAVOR}.`,
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
            "### Evaluate automatic Memory retrieval",
            "",
            "1. Call memory_context with the current user prompt when the host is evaluating automatic recall.",
            "2. Off is the default. Observe returns bounded evidence with an empty context.",
            "3. The optional trusted canary returns at most one current project-scoped Memory belonging to the authenticated caller. The persisted allowlist defaults to all authenticated Agents; unidentified callers and historical/all views remain context-free.",
            "4. Treat canary context as prior read-only evidence. Verify current code, runtime, data, and user statements before using it, and never mutate Memory solely because of that block.",
            "5. Use explicit memoria_search for user-requested research, maintenance, audit, or historical comparison.",
            "",
            "### Record a durable fact or decision",
            "",
            "1. Call memoria_search with the topic first.",
            "2. If an existing memory is the same fact, call memoria_update.",
            "3. If a confirmed new state replaces an old fact, call memoria_create for the new fact, then memoria_supersede with currentMemoryId=new and historicalMemoryId=old.",
            "4. If two facts conflict but the current one is unclear, connect them with contradicts instead of superseding either one.",
            "5. If it is independent and new, call memoria_create. Add stable labels.",
            "",
            "### Connect related memories",
            "",
            "1. Call memoria_link_list before adding more links.",
            "2. Call memoria_link_create with kind related, causes, evolved-from, contradicts, or part-of. Use memoria_supersede for confirmed replacement.",
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
            "- Use memoria_update when correcting or refining the same fact. For a confirmed changed state, create the new fact and call memoria_supersede; it preserves the old fact as historical.",
            "- memoria_supersede direction is currentMemoryId (new/current fact) -> historicalMemoryId (old fact). Never delete or archive history merely because it is no longer current.",
            "- Use memoria_search timeView=current by default, historical for prior state, and all only when comparing both.",
            "- Use memoria_link_create after creating or finding related memories. Link kinds: related, causes, evolved-from, contradicts, part-of. Use contradicts when the conflict is unresolved.",
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
            "- Shared Line context is optional for InnerLife digestion. Pass lineId when one line matters; if multiple lines are active and lineId is omitted, briefing, digest, daemon tick, and provided-context share checks continue with sharedLineContext.status=ambiguous.",
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
                      ...launch.env,
                      CLARACORE_AGENT_ID: "<agent-stable-id>",
                      CLARACORE_CLIENT_ID: "<codex-app|claude-code|hermes>",
                      CLARACORE_CONVERSATION_ID: "<optional-host-conversation-id>",
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
            "Replace the agent and client placeholders before use. Set the conversation value only when the stdio client relaunches or refreshes the MCP process per host conversation; otherwise remove CLARACORE_CONVERSATION_ID so a stale id is not traced across unrelated conversations.",
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
    const caller = currentCallerContext(args);
    const summary = await database.getSummary();
    const daemonState = await database.ensureInnerLifeDaemonState(agentId);
    return textResult({
      ok: true,
      agentId,
      clientId: caller.clientId,
      conversationId: caller.conversationId,
      transport: caller.transport,
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
      next: "Call gateway_docs, then shared_line_list with status=active, then gateway_context with lineId when needed.",
      nextCalls: ["gateway_docs", "shared_line_list", "gateway_context"],
      afterOnboarding:
        "Tell the user what ClaraCore enables and summarize the current resumable context in the user's language."
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
