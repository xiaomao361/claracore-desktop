const { service } = require("../understanding/adapters");

async function handleUnderstandingTool(name, args, context) {
  const method = { understanding_context: "context", understanding_submit: "submit", understanding_resume: "resume" }[name];
  if (!method) return undefined;
  const caller = context.currentCallerContext(args);
  try {
    const result = await service[method](context.core, context.runtimeAppForGateway(), caller, args);
    return { ...context.textResult(result), ...(["partial", "needs_review"].includes(result.status) || (result.planningStatus && result.planningStatus !== "planned") ? { isError: true } : {}) };
  } catch (error) {
    return { ...context.textResult({ contract: "understanding-v1", status: "failed", code: error.code || "understanding_failed", persisted: "unknown", recovery: "Reuse the original submissionId and caller identity. Never assume a failed response means nothing was written." }), isError: true };
  }
}
module.exports = { handleUnderstandingTool };
