const DIRECT_AGENT_REFERENCES = Object.freeze([
  { table: "continuity_agent_state", column: "agent_id", strategy: "singleton-safe" },
  { table: "continuity_lines", column: "agent_id", strategy: "direct", updatedAt: true },
  { table: "gateway_sessions", column: "agent_id", strategy: "direct" },
  { table: "gateway_traces", column: "agent_id", strategy: "direct" },
  { table: "innerlife_daemon_state", column: "agent_id", strategy: "singleton-safe" },
  { table: "innerlife_digest_runs", column: "agent_id", strategy: "direct" },
  { table: "innerlife_events", column: "agent_id", strategy: "direct" },
  { table: "innerlife_inbox", column: "agent_id", strategy: "direct" },
  { table: "innerlife_profiles", column: "agent_id", strategy: "singleton-safe" },
  { table: "innerlife_sessions", column: "agent_id", strategy: "session-collision" },
  { table: "innerlife_share_actions", column: "agent_id", strategy: "direct" },
  { table: "innerlife_share_checks", column: "agent_id", strategy: "direct" },
  { table: "innerlife_shares", column: "agent_id", strategy: "direct", updatedAt: true },
  { table: "memory_control_events", column: "agent_id", strategy: "direct" },
  { table: "memory_records", column: "source_agent", strategy: "direct", updatedAt: true }
].map((reference) => Object.freeze(reference)));

module.exports = {
  DIRECT_AGENT_REFERENCES
};
