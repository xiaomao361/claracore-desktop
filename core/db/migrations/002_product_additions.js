const { DEFAULT_AGENT_ID } = require("../../config");
const { jsonSql, parseJson, sqlString } = require("../helpers");

async function addMissingColumns(database, table, additions) {
  const allowedTables = new Set(["memory_records", "current_positions", "continuity_lines", "gateway_traces"]);
  if (!allowedTables.has(table)) throw new Error(`Unsupported migration table: ${table}`);
  const columns = new Set((await database.query(`PRAGMA table_info(${table});`)).map((row) => row.name));
  for (const [column, sql] of additions) {
    if (!columns.has(column)) await database.exec(sql);
  }
}

async function normalizeLegacyContinuityDefaultAgent(database) {
  const positionRows = await database.query(`
    SELECT id, metadata_json FROM current_positions
    WHERE metadata_json LIKE '%"agentId"%default%';
  `);
  for (const row of positionRows) {
    const metadata = parseJson(row.metadata_json, {});
    if (metadata?.agentId !== "default") continue;
    metadata.agentId = DEFAULT_AGENT_ID;
    await database.exec(`
      UPDATE current_positions SET metadata_json = ${jsonSql(metadata)}
      WHERE id = ${sqlString(row.id)};
    `);
  }
  await database.exec(`
    DELETE FROM continuity_agent_state WHERE agent_id = 'default';
    UPDATE continuity_agent_state
    SET communication_style = '', relationship_position = '',
        long_term_preferences_json = '[]', boundaries_json = '[]',
        stable_patterns_json = '[]', notes = '', updated_at = CURRENT_TIMESTAMP
    WHERE agent_id = ${sqlString(DEFAULT_AGENT_ID)}
      AND (communication_style LIKE '%毛仔%' OR relationship_position LIKE '%姐姐%'
        OR relationship_position LIKE '%弟弟%' OR notes LIKE '%毛仔%'
        OR notes LIKE '%Clara%' OR notes LIKE '%Lara%');
  `);
}

module.exports = {
  id: "002_product_additions",
  phase: "after-schema",
  async up(database) {
    await addMissingColumns(database, "memory_records", [
      ["user_id", "ALTER TABLE memory_records ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local-user';"],
      ["local_date", "ALTER TABLE memory_records ADD COLUMN local_date TEXT NOT NULL DEFAULT '';"],
      ["timezone", "ALTER TABLE memory_records ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai';"],
      ["schema_version", "ALTER TABLE memory_records ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;"],
      ["note", "ALTER TABLE memory_records ADD COLUMN note TEXT;"],
      ["source_agent", "ALTER TABLE memory_records ADD COLUMN source_agent TEXT;"],
      ["source_run_id", "ALTER TABLE memory_records ADD COLUMN source_run_id TEXT;"],
      ["dedupe_key", "ALTER TABLE memory_records ADD COLUMN dedupe_key TEXT;"]
    ]);
    await addMissingColumns(database, "current_positions", [
      ["metadata_json", "ALTER TABLE current_positions ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';"]
    ]);
    await addMissingColumns(database, "continuity_lines", [
      ["agent_id", "ALTER TABLE continuity_lines ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'codex';"]
    ]);
    await addMissingColumns(database, "gateway_traces", [
      ["session_id", "ALTER TABLE gateway_traces ADD COLUMN session_id TEXT NOT NULL DEFAULT '';"],
      ["transport", "ALTER TABLE gateway_traces ADD COLUMN transport TEXT NOT NULL DEFAULT 'stdio';"]
    ]);
    await database.exec(`
      UPDATE memory_records SET local_date = substr(occurred_at, 1, 10) WHERE local_date = '';
      UPDATE continuity_lines SET agent_id = 'codex' WHERE agent_id IS NULL OR agent_id = '' OR agent_id = 'default';
      CREATE INDEX IF NOT EXISTS idx_memory_records_user_type_time ON memory_records(user_id, record_type, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memory_records_user_local_date ON memory_records(user_id, local_date);
      CREATE INDEX IF NOT EXISTS idx_continuity_lines_agent_status_updated ON continuity_lines(agent_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_gateway_traces_agent_created ON gateway_traces(agent_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_gateway_traces_transport_created ON gateway_traces(transport, created_at DESC);
      WITH ranked_current_positions AS (
        SELECT rowid AS rid,
          ROW_NUMBER() OVER (PARTITION BY line_id ORDER BY julianday(updated_at) DESC,
            CASE WHEN id = 'position_' || line_id THEN 0 ELSE 1 END, rowid DESC) AS rank
        FROM current_positions
      )
      DELETE FROM current_positions WHERE rowid IN (SELECT rid FROM ranked_current_positions WHERE rank > 1);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_current_positions_line_unique ON current_positions(line_id);
      CREATE TABLE IF NOT EXISTS continuity_agent_state (
        agent_id TEXT PRIMARY KEY, communication_style TEXT NOT NULL DEFAULT '',
        relationship_position TEXT NOT NULL DEFAULT '', long_term_preferences_json TEXT NOT NULL DEFAULT '[]',
        boundaries_json TEXT NOT NULL DEFAULT '[]', stable_patterns_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS continuity_model_adjustments (
        model TEXT PRIMARY KEY, forbidden_phrases_json TEXT NOT NULL DEFAULT '[]',
        forbidden_patterns_json TEXT NOT NULL DEFAULT '[]', inject_prompt TEXT NOT NULL DEFAULT '',
        updated_by TEXT NOT NULL DEFAULT 'desktop', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_records_dedupe
      ON memory_records(user_id, record_type, dedupe_key) WHERE dedupe_key IS NOT NULL;
    `);
    await normalizeLegacyContinuityDefaultAgent(database);
  }
};
