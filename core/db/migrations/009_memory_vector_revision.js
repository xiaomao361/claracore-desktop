// Only ordinary SQLite objects live in the source DB. Older applications and
// backup readers do not need sqlite-vec to open or write it.
const schema = `
  CREATE TABLE IF NOT EXISTS memory_vector_revision (
    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
    revision INTEGER NOT NULL
  );
  INSERT OR IGNORE INTO memory_vector_revision VALUES(1, 0);
  CREATE TRIGGER IF NOT EXISTS memory_vector_insert AFTER INSERT ON memory_embeddings BEGIN
    UPDATE memory_vector_revision SET revision = revision + 1 WHERE singleton = 1;
  END;
  CREATE TRIGGER IF NOT EXISTS memory_vector_update AFTER UPDATE ON memory_embeddings BEGIN
    UPDATE memory_vector_revision SET revision = revision + 1 WHERE singleton = 1;
  END;
  CREATE TRIGGER IF NOT EXISTS memory_vector_delete AFTER DELETE ON memory_embeddings BEGIN
    UPDATE memory_vector_revision SET revision = revision + 1 WHERE singleton = 1;
  END;
`;

module.exports = {
  id: "009_memory_vector_revision", phase: "after-schema", schema,
  async up(database) { await database.exec(schema); }
};
