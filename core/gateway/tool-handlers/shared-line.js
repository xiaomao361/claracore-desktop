const continuity = require("../../continuity");

async function handleSharedLineTool(name, args, context) {
  const { core, currentMcpAgentId, textResult } = context;

  if (name === "shared_line_get") {
    // A single-line read should not repeat every active/archived line and
    // every agent state. Those collections belong to shared_line_list and the
    // Desktop UI snapshot; keep this MCP response scoped to the selected line.
    return textResult(await continuity.get(core, { ...(args || {}), lite: true }));
  }

  if (name === "shared_line_list") {
    return textResult({
      lines: await continuity.list(core, args)
    });
  }

  if (name === "shared_line_create") {
    return textResult(await continuity.create(core, args, { lite: true }));
  }

  if (name === "shared_line_activate") {
    return textResult(await continuity.activate(core, args.lineId, { lite: true }));
  }

  if (name === "shared_line_rename") {
    return textResult(await continuity.rename(core, args.lineId, args.title, { lite: true }));
  }

  if (name === "shared_line_archive") {
    return textResult(await continuity.archive(core, args.lineId, { lite: true }));
  }

  if (name === "shared_line_restore") {
    return textResult(await continuity.restore(core, args.lineId, Boolean(args.makeActive), { lite: true }));
  }

  if (name === "shared_line_update") {
    return textResult(await continuity.save(core, args, { lite: true }));
  }

  if (name === "shared_line_handoff_create") {
    return textResult(await continuity.createHandoff(core, args, { lite: true }));
  }

  if (name === "shared_line_agent_state") {
    const agentId = currentMcpAgentId(args);
    return textResult({
      agentState: await continuity.agentState(core, agentId, args.update)
    });
  }

  if (name === "shared_line_model_adjustment_list") {
    return textResult({ models: await continuity.modelAdjustments(core) });
  }

  if (name === "shared_line_model_adjustment_get") {
    return textResult({ modelAdjustment: await continuity.modelAdjustment(core, args.model) });
  }

  if (name === "shared_line_model_adjustment_set") {
    return textResult({ modelAdjustment: await continuity.setModelAdjustment(core, args) });
  }

  if (name === "shared_line_model_adjustment_delete") {
    return textResult(await continuity.deleteModelAdjustment(core, args.model));
  }

  if (name === "shared_line_compact") {
    return textResult(await continuity.compact(core, args));
  }

  return undefined;
}

module.exports = {
  handleSharedLineTool
};
