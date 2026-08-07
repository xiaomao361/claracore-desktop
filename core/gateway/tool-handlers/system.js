const { getGatewayContext } = require("../context");
const { buildGatewayDocs } = require("../docs");
const { arbitrateAutomaticContext } = require("../auto-context");
const { createTurnContextService } = require("../turn-context");
const { createInnerLifeRelevanceScorer } = require("../../innerlife/relevance");
const { runMemoryContext } = require("./memory-controller");
const innerlife = require("../../innerlife");
const { meaningfulTokens } = require("../../db/helpers");

// One wiring of the collection ports. Memory retrieval reuses the Memory
// Controller handler's own gate logic; InnerLife relevance uses the read-only
// scorer, never innerlife_share_check, which would write a row per check.
const turnContextService = createTurnContextService({
  runMemoryController: (core, input) => runMemoryContext({ prompt: input.prompt }, core.handlerContext),
  listPendingShares: (core, agentId, limit) =>
    innerlife.pendingShares(core, "pending", limit, agentId),
  scoreShareRelevance: createInnerLifeRelevanceScorer({ meaningfulTokens })
});

async function handleSystemTool(name, args, context) {
  const {
    core,
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
    const input = args || {};
    const prompt = String(input.prompt || "").trim();
    const hasCandidates = Array.isArray(input.memoryCandidates) || Array.isArray(input.shareCandidates);
    // Never merge the two paths silently. A precedence rule would just hide the
    // ambiguity; refusing makes the caller say which contract it meant.
    if (prompt && hasCandidates) {
      throw new Error(
        "gateway_auto_context accepts either prompt or the candidate arrays, not both. Pass prompt for the server-owned path."
      );
    }

    const agentId = currentMcpAgentId(args);
    if (!prompt) {
      return textResult(arbitrateAutomaticContext({ ...input, agentId }));
    }

    const collected = await turnContextService.collect(
      { ...core, handlerContext: context },
      { prompt, agentId }
    );
    return textResult({
      ...arbitrateAutomaticContext({
        agentId,
        memoryCandidates: collected.memoryCandidates,
        shareCandidates: collected.shareCandidates,
        domainStatus: collected.domainStatus
      }),
      latencyMs: collected.latencyMs
    });
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
