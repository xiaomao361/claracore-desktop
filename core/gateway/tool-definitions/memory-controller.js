const memoryControllerToolDefinitions = [
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
