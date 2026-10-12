const memoryControllerToolDefinitions = [
  {
    name: "memory_context_feedback",
    title: "Record Memory Context Feedback",
    description: "Record or inspect explicit observed feedback for this caller's Memory decision. Selection is not delivery; delivery is not use. Records require evidence and deduplicate identical acknowledgements. Missing feedback is unknown. Never infer feedback from a successful tool call.",
    inputSchema: {
      type: "object",
      required: ["decisionId"],
      anyOf: [
        { required: ["action"], properties: { action: { const: "inspect" } } },
        { required: ["feedbackType", "evidenceExcerpt"] }
      ],
      properties: {
        action: { type: "string", enum: ["record", "inspect"] },
        limit: { type: "number", minimum: 1, maximum: 50 },
        offset: { type: "number", minimum: 0 },
        decisionId: { type: "string", minLength: 1, maxLength: 160 },
        feedbackType: { type: "string", enum: ["delivered", "used", "ignored", "wrong", "corrected", "outcome_unknown"] },
        evidenceExcerpt: { type: "string", minLength: 1, maxLength: 500 },
        responseId: { type: "string", maxLength: 160 },
        memoryIds: { type: "array", maxItems: 3, items: { type: "string" } }
      },
      additionalProperties: false
    }
  },
  {
    name: "memory_context",
    title: "Evaluate Memory Context",
    description: "Run the deterministic Memory Controller for the authenticated caller. The operator setting is off by default. Observe mode records bounded decisions without context. Trusted canary may return one bounded current Memory only for an explicitly allowlisted Agent; other callers remain observe-only. Explicit Memoria search and mutation tools remain separate.",
    inputSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          minLength: 1,
          maxLength: 12000
        },
        timeView: {
          type: "string",
          enum: ["current", "historical", "all"],
          description: "State view for controller-owned retrieval. Defaults to current."
        },
        contextBudgetTokens: {
          type: "number",
          minimum: 0,
          maximum: 900
        }
      },
      additionalProperties: false
    }
  }
];

module.exports = {
  memoryControllerToolDefinitions
};
