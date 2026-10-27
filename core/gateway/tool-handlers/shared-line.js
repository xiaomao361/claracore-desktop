const continuity = require("../../continuity");
const { shapeSharedLinePacket, normalizeSharedLineDetail } = require("../../continuity/resume-detail");
const {
  catalogPage,
  shapeHandoffAck,
  shapeSharedLineCatalogEntry,
  shapeSharedLineDescriptor
} = require("../bounded-response");

function shapeSharedLineMutation(result, detail) {
  return {
    ...(result.line ? { line: shapeSharedLineDescriptor(result.line) } : {}),
    ...(result.sharedLine ? { sharedLine: shapeSharedLinePacket(result.sharedLine, detail) } : {}),
    ...(result.handoff ? { handoff: shapeHandoffAck(result.handoff) } : {}),
    persisted: true
  };
}

async function handleSharedLineTool(name, args, context) {
  const { core, currentMcpAgentId, textResult } = context;
  if (["shared_line_create", "shared_line_activate", "shared_line_rename", "shared_line_archive",
    "shared_line_restore", "shared_line_update", "shared_line_handoff_create", "shared_line_compact"].includes(name)) {
    // Validate presentation arguments before any write. Otherwise an invalid
    // detail could save successfully and then throw while shaping its receipt.
    normalizeSharedLineDetail(args?.detail);
  }

  if (name === "shared_line_get") {
    // A single-line read should not repeat every active/archived line and
    // every agent state. Those collections belong to shared_line_list and the
    // Desktop UI snapshot; keep this MCP response scoped to the selected line.
    // v0.6.6: detail defaults to a resume packet; full recovers the stored one.
    const packet = await continuity.get(core, { ...(args || {}), lite: true });
    return textResult(shapeSharedLinePacket(packet, args?.detail, { model: args?.model }));
  }

  if (name === "shared_line_list") {
    const page = await continuity.listSummaries(core, args);
    return textResult({
      lines: page.items.map(shapeSharedLineCatalogEntry),
      page: catalogPage(page.items, page.total, page)
    });
  }

  if (name === "shared_line_create") {
    const result = await continuity.create(core, args, { lite: true });
    return textResult(shapeSharedLineMutation(result, args?.detail));
  }

  if (name === "shared_line_activate") {
    const result = await continuity.activate(core, args.lineId, { lite: true });
    return textResult(shapeSharedLineMutation(result, args?.detail));
  }

  if (name === "shared_line_rename") {
    return textResult(shapeSharedLineMutation(await continuity.rename(core, args.lineId, args.title, { lite: true }), args?.detail));
  }

  if (name === "shared_line_archive") {
    return textResult(shapeSharedLineMutation(await continuity.archive(core, args.lineId, { lite: true }), args?.detail));
  }

  if (name === "shared_line_restore") {
    return textResult(shapeSharedLineMutation(
      await continuity.restore(core, args.lineId, Boolean(args.makeActive), { lite: true }),
      args?.detail
    ));
  }

  if (name === "shared_line_update") {
    const packet = await continuity.save(core, args, { lite: true });
    return textResult({
      ...shapeSharedLinePacket(packet, args?.detail, { model: args?.model }),
      persisted: true,
      receipt: {
        operation: "shared_line_update",
        lineId: packet.lineId,
        positionId: packet.currentPosition?.positionId || "",
        readBack: { tool: "shared_line_get", arguments: { lineId: packet.lineId, detail: "full" } }
      }
    });
  }

  if (name === "shared_line_handoff_create") {
    const result = await continuity.createHandoff(core, args, { lite: true });
    return textResult(shapeSharedLineMutation(result, args?.detail));
  }

  if (name === "shared_line_agent_state") {
    const agentId = currentMcpAgentId(args);
    return textResult({
      agentState: await continuity.agentState(core, agentId, args.update)
    });
  }

  if (name === "shared_line_model_adjustment") {
    const { action } = args;
    if (!["list", "get", "set", "delete"].includes(action)) throw new Error("Model adjustment action must be list, get, set or delete.");
    if (action !== "list" && typeof args.model !== "string") throw new Error("Model adjustment action requires model.");
    if (action === "list" && args.model !== undefined) throw new Error("List adjustments does not accept model.");
    if (action !== "set" && ["forbiddenPhrases", "forbiddenPatterns", "injectPrompt", "updatedBy"].some(key => args[key] !== undefined)) throw new Error("Adjustment writes require action=set.");
    if (action === "list") return textResult({ models: await continuity.modelAdjustments(core) });
    if (action === "get") return textResult({ modelAdjustment: await continuity.modelAdjustment(core, args.model) });
    if (action === "set") return textResult({ modelAdjustment: await continuity.setModelAdjustment(core, args) });
    return textResult(await continuity.deleteModelAdjustment(core, args.model));
  }

  if (name === "shared_line_compact") {
    const result = await continuity.compact(core, args);
    return textResult({
      compact: result.compact,
      sharedLine: shapeSharedLinePacket(result.sharedLine, args?.detail),
      persisted: true
    });
  }

  return undefined;
}

module.exports = {
  handleSharedLineTool
};
