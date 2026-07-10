-- ClaraCore Desktop unified product database draft.
-- This schema is for the new Desktop-owned product core only.
-- It must not be applied to existing ~/.claracore service databases.
-- Keep schema changes additive until product migration tooling exists.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secret_refs (
  key TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'not-configured',
  ref TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  title TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  sensitivity TEXT NOT NULL DEFAULT 'normal',
  source_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  source_path TEXT,
  imported_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS memory_labels (
  memory_id TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (memory_id, label),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_label_aliases (
  alias TEXT PRIMARY KEY,
  canonical_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memory_embeddings (
  memory_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dimension INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  vector_json TEXT,
  vector_ref TEXT,
  error TEXT,
  embedded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_links (
  id TEXT PRIMARY KEY,
  from_memory_id TEXT NOT NULL,
  to_memory_id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'related',
  strength REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (from_memory_id, to_memory_id, kind),
  FOREIGN KEY (from_memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (to_memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  record_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  value_json TEXT NOT NULL DEFAULT '{}',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  local_date TEXT NOT NULL DEFAULT '',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  schema_version INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'manual_desktop',
  source_agent TEXT,
  source_run_id TEXT,
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  memory_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS continuity_lines (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT 'codex',
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS current_positions (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  interpretation_status TEXT NOT NULL DEFAULT 'draft',
  facts_used_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES continuity_lines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS continuity_position_history (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  position_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  interpretation_status TEXT NOT NULL DEFAULT 'draft',
  facts_used_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'desktop',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES continuity_lines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS continuity_snapshots (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  position_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  interpretation_status TEXT NOT NULL DEFAULT 'draft',
  facts_used_json TEXT NOT NULL DEFAULT '[]',
  reason TEXT NOT NULL DEFAULT 'save',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES continuity_lines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS continuity_handoffs (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  completed_json TEXT NOT NULL DEFAULT '[]',
  open_items_json TEXT NOT NULL DEFAULT '[]',
  next_step TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (line_id) REFERENCES continuity_lines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS continuity_agent_state (
  agent_id TEXT PRIMARY KEY,
  communication_style TEXT NOT NULL DEFAULT '',
  relationship_position TEXT NOT NULL DEFAULT '',
  long_term_preferences_json TEXT NOT NULL DEFAULT '[]',
  boundaries_json TEXT NOT NULL DEFAULT '[]',
  stable_patterns_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS continuity_model_adjustments (
  model TEXT PRIMARY KEY,
  forbidden_phrases_json TEXT NOT NULL DEFAULT '[]',
  forbidden_patterns_json TEXT NOT NULL DEFAULT '[]',
  inject_prompt TEXT NOT NULL DEFAULT '',
  updated_by TEXT NOT NULL DEFAULT 'desktop',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS innerlife_profiles (
  agent_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  profile_json TEXT NOT NULL DEFAULT '{}',
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS innerlife_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT 'default',
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS innerlife_inbox (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT 'my-agent',
  source TEXT NOT NULL DEFAULT 'desktop',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS innerlife_thoughts (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  body TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES innerlife_events(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS innerlife_shares (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  thought_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  body TEXT NOT NULL,
  decision_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (thought_id) REFERENCES innerlife_thoughts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS innerlife_share_actions (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (share_id) REFERENCES innerlife_shares(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS innerlife_digest_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'completed',
  input_json TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS innerlife_share_checks (
  id TEXT PRIMARY KEY,
  share_id TEXT,
  agent_id TEXT NOT NULL,
  session_id TEXT,
  context TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (share_id) REFERENCES innerlife_shares(id) ON DELETE SET NULL,
  FOREIGN KEY (session_id) REFERENCES innerlife_sessions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS innerlife_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'local-user',
  host TEXT NOT NULL DEFAULT 'desktop',
  external_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  briefing_json TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE (agent_id, external_session_id),
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS innerlife_daemon_state (
  agent_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'paused',
  enabled INTEGER NOT NULL DEFAULT 0,
  last_tick_at TEXT,
  next_run_at TEXT,
  last_result TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT '',
  tick_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gateway_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  last_seen_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gateway_traces (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT 'my-agent',
  client_id TEXT NOT NULL DEFAULT '',
  conversation_id TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  transport TEXT NOT NULL DEFAULT 'stdio',
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  request_json TEXT NOT NULL DEFAULT '{}',
  response_summary TEXT NOT NULL DEFAULT '',
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS runtime_events (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_memories_status_updated ON memories(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_memory_labels_label ON memory_labels(label);
CREATE INDEX IF NOT EXISTS idx_memory_label_aliases_canonical ON memory_label_aliases(canonical_label);
CREATE INDEX IF NOT EXISTS idx_memory_links_from ON memory_links(from_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_links_to ON memory_links(to_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_records_type_time ON memory_records(record_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_memory_records_status_time ON memory_records(status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_continuity_lines_status_updated ON continuity_lines(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_continuity_position_history_line_created ON continuity_position_history(line_id, created_at);
CREATE INDEX IF NOT EXISTS idx_continuity_snapshots_line_created ON continuity_snapshots(line_id, created_at);
CREATE INDEX IF NOT EXISTS idx_innerlife_events_agent_status ON innerlife_events(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_innerlife_inbox_agent_status ON innerlife_inbox(agent_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_innerlife_share_actions_share_created ON innerlife_share_actions(share_id, created_at);
CREATE INDEX IF NOT EXISTS idx_innerlife_digest_runs_agent_created ON innerlife_digest_runs(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_innerlife_share_checks_share_created ON innerlife_share_checks(share_id, created_at);
CREATE INDEX IF NOT EXISTS idx_innerlife_sessions_agent_status ON innerlife_sessions(agent_id, status, started_at);
CREATE INDEX IF NOT EXISTS idx_innerlife_daemon_state_status_next ON innerlife_daemon_state(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_gateway_traces_created ON gateway_traces(created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_traces_agent_created ON gateway_traces(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_traces_client_created ON gateway_traces(client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_traces_conversation_created ON gateway_traces(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_traces_tool_created ON gateway_traces(tool_name, created_at);
CREATE INDEX IF NOT EXISTS idx_gateway_traces_transport_created ON gateway_traces(transport, created_at);
CREATE INDEX IF NOT EXISTS idx_runtime_events_created ON runtime_events(created_at);
