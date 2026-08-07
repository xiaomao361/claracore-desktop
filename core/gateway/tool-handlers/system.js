const { getGatewayContext } = require("../context");
const { buildGatewayDocs } = require("../docs");
const { arbitrateAutomaticContext } = require("../auto-context");

async function handleSystemTool(name, args, context) {
  const {
    database,
    currentCallerContext,
    currentMcpAgentId,
    gatewayLaunchConfig,
    paths,
    serverInfo,
    textResult,
    toolProfile
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
    const docs = buildGatewayDocs({
      section: args?.section,
      launch: gatewayLaunchConfig(paths),
      paths,
      toolProfile
    });
    return {
      content: [
        {
          type: "text",
          text: docs.text
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
      toolProfile,
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
      next: "Call gateway_context with detail=brief and without lineId; retry with a returned candidate only after SHARED_LINE_ID_REQUIRED. Call gateway_docs only when you need the usage guide.",
      nextCalls: ["gateway_context"],
      afterOnboarding:
        "Tell the user what ClaraCore enables and summarize the current resumable context in the user's language."
    });
  }

  if (name === "gateway_context") {
    return textResult(await getGatewayContext({ database }, args));
  }

  if (name === "gateway_auto_context") {
    return textResult(
      arbitrateAutomaticContext({ ...(args || {}), agentId: currentMcpAgentId(args) })
    );
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
