const MCP_SERVER_INSTRUCTIONS = [
  "Use ClaraCore selectively for continuity across conversations and workspaces.",
  "Search Memoria and Shared Line when the user asks about history, continuation, previous decisions, or personal preferences.",
  "For explicit shared-understanding work, use understanding_context and submit bounded evidence deltas via understanding_submit; the Gateway plans all domains. Existing authority only, no automatic whole-conversation capture. Inspect plan and per-item receipts through understanding_resume.",
  "At user-message boundaries, review only relevant pending InnerLife shares instead of broadly loading all data.",
  "Write Memoria only for explicit durable decisions or when the user asks you to remember something; search before creating a fact.",
  "Do not use ClaraCore merely because its tools are available, and never promote InnerLife output into Memoria or Shared Line automatically."
].join(" ");

module.exports = { MCP_SERVER_INSTRUCTIONS };
