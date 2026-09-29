const { selectedRoot, previewKnowledgeIntake, commitKnowledgeIntake, knowledgeIndexStatus, rebuildKnowledgeIndex } = require("../../knowledge/intake");
const { listKnowledgeDocuments, readKnowledgeSection, getKnowledgeLinks, collectDocuments,
  readKnowledgeDocument, KnowledgeLibraryError } = require("../../knowledge/library");

const { searchKnowledge, rebuildKnowledgeSearchIndex } = require("../../knowledge/search");

async function handleKnowledgeTool(name, args, context) {
  if (!["knowledge_read", "knowledge_intake_preview", "knowledge_intake_commit", "knowledge_index_rebuild"].includes(name)) return undefined;
  const app = context.runtimeAppForGateway();
  const caller = context.currentCallerContext(args);
  const owner = JSON.stringify([caller.agentId || "", caller.clientId || "", caller.conversationId || ""]);
  try {
    let result;
    if (name === "knowledge_index_rebuild") result = args.semantic ? await rebuildKnowledgeSearchIndex(app, await context.database.getSettings(), args) : await rebuildKnowledgeIndex(app);
    else if (name === "knowledge_intake_preview") result = await previewKnowledgeIntake(app, args, owner);
    else if (name === "knowledge_intake_commit") result = await commitKnowledgeIntake(app, args.token, owner);
    else {
      const root = await selectedRoot(app);
      if (args.action === "catalog") result = listKnowledgeDocuments(root, args);
      else if (["exact", "search"].includes(args.action)) {
        const input = { ...args, textMatch: "literal", mode: args.action === "exact" ? "exact" : args.mode || "exact" };
        result = await searchKnowledge(app, input, input.mode === "exact" ? {} : await context.database.getSettings());
      }
      else if (args.action === "read") result = readKnowledgeSection(root, args.reference);
      else if (args.action === "links") result = getKnowledgeLinks(root, args.reference, args);
      else if (args.action === "status") result = await knowledgeIndexStatus(app);
      else throw new KnowledgeLibraryError("invalid_action", "Unknown knowledge read action.");
    }
    return { ...context.textResult(result), ...(result.status === "partial" ? { isError: true } : {}) };
  } catch (error) {
    return { ...context.textResult({ status: "failed", code: error.code || "knowledge_failed", message: error.message }), isError: true };
  }
}
module.exports = { handleKnowledgeTool };
