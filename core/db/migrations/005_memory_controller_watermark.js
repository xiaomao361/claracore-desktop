const WATCHED_TABLES = [
  "memories",
  "memory_labels",
  "memory_label_aliases",
  "memory_links",
  "memory_embeddings"
];

function triggerSql() {
  return WATCHED_TABLES.flatMap((table) => ["insert", "update", "delete"].map((operation) => `
    CREATE TRIGGER IF NOT EXISTS trg_memory_control_${table}_${operation}
    AFTER ${operation.toUpperCase()} ON ${table}
    BEGIN
      UPDATE memory_control_watermarks
      SET revision = revision + 1,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE scope = 'memoria';
    END;
  `)).join("\n");
}

const WATERMARK_SCHEMA = `
  CREATE TABLE IF NOT EXISTS memory_control_watermarks (
    scope TEXT PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT INTO memory_control_watermarks (scope, revision)
  VALUES ('memoria', 0)
  ON CONFLICT(scope) DO NOTHING;
  ${triggerSql()}
`;

module.exports = {
  id: "005_memory_controller_watermark",
  phase: "after-schema",
  async up(database) {
    await database.exec(WATERMARK_SCHEMA);
  },
  schema: WATERMARK_SCHEMA
};
