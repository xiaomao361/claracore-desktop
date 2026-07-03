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
    return {
      content: [
        {
          type: "text",
          text: [
            "# ClaraCore Desktop Gateway",
            "",
            "Use this MCP server as the single local entry for ClaraCore Desktop product data.",
            "Each agent must set its own stable CLARACORE_AGENT_ID. Do not reuse another agent's id.",
            "Recommended ids: lara, clara, codex.",
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
            ...toolDefinitions().map((tool) => `- ${tool.name}: ${tool.description}`),
            "",
            "## Verify The Connection",
            "",
            "After installing the MCP config, call gateway_context. Desktop uses CLARACORE_AGENT_ID as the MCP process identity and records successful MCP calls as recent agent activity in Agent Access.",
            "",
            "## Claude Desktop Notes",
            "",
            "Claude Desktop may expose local MCP setup under Developer or Extensions settings depending on app version. ClaraCore still uses the stdio MCP config above; it does not currently ship a .mcpb Desktop Extension package. After changing the config or CLARACORE_AGENT_ID, fully quit and restart Claude Desktop, then call claracore_connection_test once before gateway_context.",
            "",
            "## CLI Fallback",
            "",
            launch.displayCommand,
            "",
            `Source: ${launch.source}`,
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
