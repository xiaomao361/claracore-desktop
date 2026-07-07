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
            "3. Call gateway_context at the start of work to read Memory, Shared Line, InnerLife, Doctor guidance, and recovery advice in one packet.",
            "",
            "## Identity",
            "",
            "Set a stable CLARACORE_AGENT_ID for each agent process. Do not reuse another agent's id.",
            "Preferred ids: lara, clara, codex. If an old tool-prefixed id needs consolidation, use agent_identity_merge instead of editing SQLite.",
            "",
            "## What You Can Rely On",
            "",
            "- Memory is the factual store. Use memoria_search before assuming context, and memoria_store only for observable facts.",
            "- Shared Line is the resumable current-position layer. Use shared_line_get or gateway_context before updating it.",
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
            "## MCP Config",
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
            "claracore_connection_test -> gateway_docs -> gateway_context",
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
      transport: "stdio",
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
      next: "Call gateway_context to read the current agent packet."
    });
  }

  if (name === "gateway_context") {
    return textResult(await database.getGatewayContext(args));
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
