const { LEGACY_TOOL_ROUTES } = require("./tool-compatibility-routes");
const { readInnerLifeRecord } = require("./innerlife-status-page");

async function callLegacyTool(name, args, context, dispatch) {
  if (!Object.hasOwn(LEGACY_TOOL_ROUTES, name)) return undefined;
  const route = LEGACY_TOOL_ROUTES[name];
  let result;
  if (route.projection === "session") {
    // Preserve the old nullable acknowledgement while sharing ownership and
    // database reads with canonical status diagnostics.
    const session = await readInnerLifeRecord(context.core, context.currentMcpAgentId(args), "sessions", args.id);
    result = context.textResult(session ? { session } : { error: "not found", id: args.id });
  } else if (route.legacyDoctor) {
    // Like legacy daemon_status, doctor could initialize an existing
    // profile's daemon row. Keep that only on the old compatibility path.
    result = context.textResult(await context.database.getInnerLifeDoctor(context.currentMcpAgentId(args)));
  } else {
    // Legacy daemon_status used to initialize state. Preserve that historical
    // side effect only here; the current status/daemon read is read-only.
    if (route.initializeDaemon) await context.database.ensureInnerLifeDaemonState(context.currentMcpAgentId(args));
    // Fixed arguments win even when a caller passes an action or source that
    // the old name never allowed to choose.
    const project = route.projection === "record" ? value => value.record
      : route.projection === "sessions" ? value => {
        const { limit, offset, returned, total, hasMore } = value.pages.sessions;
        return { sessions: value.sessions, page: { limit, offset, returned, total, hasMore } };
      } : undefined;
    const input = { ...args, ...route.fixed };
    if (route.name === "innerlife_submit_inbox") input.agentId = context.currentMcpAgentId(args);
    try {
      result = await dispatch(route.name, input, project);
    } catch (error) {
      // The old session catalog uses an exact status enum and has a distinct
      // error message. Do not trim/coerce invalid filters into valid reads.
      if (route.projection === "sessions" && error.message === "Invalid InnerLife status filter.") {
        throw new Error("InnerLife session status must be all, active, or ended.");
      }
      throw error;
    }
  }
  return { ...result, _meta: { ...result._meta, "claracore/compatibility": {
    status: "deprecated", replacementTool: route.name
  } } };
}

module.exports = { callLegacyTool };
