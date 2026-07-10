module.exports = {
  id: "003_multi_agent_caller_context",
  phase: "before-schema",
  async up(database) {
    const columns = new Set((await database.query("PRAGMA table_info(gateway_traces);")).map((row) => row.name));
    // A fresh database has no table yet; schema.sql will create the v0.5 shape.
    if (!columns.has("id")) return;
    if (!columns.has("client_id")) {
      await database.exec("ALTER TABLE gateway_traces ADD COLUMN client_id TEXT NOT NULL DEFAULT '';");
    }
    if (!columns.has("conversation_id")) {
      await database.exec("ALTER TABLE gateway_traces ADD COLUMN conversation_id TEXT NOT NULL DEFAULT '';");
    }
    await database.exec(`
      UPDATE gateway_traces
      SET conversation_id = session_id
      WHERE conversation_id = '' AND session_id != '';

      CREATE INDEX IF NOT EXISTS idx_gateway_traces_client_created
      ON gateway_traces(client_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_gateway_traces_conversation_created
      ON gateway_traces(conversation_id, created_at DESC);
    `);
  }
};
