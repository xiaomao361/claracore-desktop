module.exports = {
  id: "000_gateway_trace_compatibility",
  phase: "before-schema",
  async up(database) {
    const columns = new Set((await database.query("PRAGMA table_info(gateway_traces);")).map((row) => row.name));
    if (!columns.has("id")) return;
    const additions = [
      ["session_id", "ALTER TABLE gateway_traces ADD COLUMN session_id TEXT NOT NULL DEFAULT '';"],
      ["transport", "ALTER TABLE gateway_traces ADD COLUMN transport TEXT NOT NULL DEFAULT 'stdio';"]
    ];
    for (const [column, sql] of additions) {
      if (!columns.has(column)) await database.exec(sql);
    }
  }
};
