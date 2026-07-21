const LEDGER_SCHEMA = `
  CREATE TABLE IF NOT EXISTS memory_control_events (
    id TEXT PRIMARY KEY,
    policy_version TEXT NOT NULL,
    policy_mode TEXT NOT NULL DEFAULT 'observe',
    agent_id TEXT NOT NULL DEFAULT 'codex',
    client_id TEXT NOT NULL DEFAULT '',
    conversation_id TEXT NOT NULL DEFAULT '',
    session_id TEXT NOT NULL DEFAULT '',
    query_hash TEXT NOT NULL DEFAULT '',
    query_preview TEXT NOT NULL DEFAULT '',
    feature_json TEXT NOT NULL DEFAULT '{}',
    stage_a_action TEXT NOT NULL,
    stage_a_reason TEXT NOT NULL,
    stage_b_action TEXT NOT NULL DEFAULT '',
    stage_b_reason TEXT NOT NULL DEFAULT '',
    search_params_json TEXT NOT NULL DEFAULT '{}',
    candidates_json TEXT NOT NULL DEFAULT '[]',
    injected_ids_json TEXT NOT NULL DEFAULT '[]',
    cache_status TEXT NOT NULL DEFAULT 'none',
    search_latency_ms INTEGER NOT NULL DEFAULT 0,
    total_latency_ms INTEGER NOT NULL DEFAULT 0,
    estimated_tokens INTEGER NOT NULL DEFAULT 0,
    result_status TEXT NOT NULL,
    error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS memory_control_feedback (
    id TEXT PRIMARY KEY,
    decision_id TEXT NOT NULL,
    feedback_type TEXT NOT NULL,
    source TEXT NOT NULL,
    conversation_id TEXT NOT NULL DEFAULT '',
    response_id TEXT NOT NULL DEFAULT '',
    memory_ids_json TEXT NOT NULL DEFAULT '[]',
    evidence_excerpt TEXT NOT NULL DEFAULT '',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    observed_at TEXT,
    idempotency_key TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (decision_id) REFERENCES memory_control_events(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_memory_control_events_created
  ON memory_control_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_memory_control_events_agent_created
  ON memory_control_events(agent_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_memory_control_events_conversation_created
  ON memory_control_events(conversation_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_memory_control_events_query_policy
  ON memory_control_events(query_hash, policy_version, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_memory_control_events_result_created
  ON memory_control_events(result_status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_memory_control_feedback_decision_created
  ON memory_control_feedback(decision_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_memory_control_feedback_type_created
  ON memory_control_feedback(feedback_type, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_control_feedback_idempotency
  ON memory_control_feedback(idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
`;

module.exports = {
  id: "004_memory_controller_ledger",
  phase: "after-schema",
  async up(database) {
    await database.exec(LEDGER_SCHEMA);
  },
  schema: LEDGER_SCHEMA
};
