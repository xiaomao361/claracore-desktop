// Latest revision per ID, including tombstones, lets independent caches catch up.
// Ordinary SQLite triggers also observe writes from older application versions.
const schema = `
  CREATE TABLE IF NOT EXISTS memory_vector_changes (
    memory_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_memory_vector_changes_revision ON memory_vector_changes(revision);
  DROP TRIGGER IF EXISTS memory_vector_insert;
  DROP TRIGGER IF EXISTS memory_vector_update;
  DROP TRIGGER IF EXISTS memory_vector_delete;
  CREATE TRIGGER memory_vector_insert AFTER INSERT ON memory_embeddings BEGIN
    UPDATE memory_vector_revision SET revision=revision+1 WHERE singleton=1;
    INSERT INTO memory_vector_changes VALUES(NEW.memory_id,(SELECT revision FROM memory_vector_revision WHERE singleton=1)) ON CONFLICT(memory_id) DO UPDATE SET revision=excluded.revision;
  END;
  CREATE TRIGGER memory_vector_update AFTER UPDATE ON memory_embeddings BEGIN
    UPDATE memory_vector_revision SET revision=revision+1 WHERE singleton=1;
    INSERT INTO memory_vector_changes VALUES(OLD.memory_id,(SELECT revision FROM memory_vector_revision WHERE singleton=1)) ON CONFLICT(memory_id) DO UPDATE SET revision=excluded.revision;
    INSERT INTO memory_vector_changes VALUES(NEW.memory_id,(SELECT revision FROM memory_vector_revision WHERE singleton=1)) ON CONFLICT(memory_id) DO UPDATE SET revision=excluded.revision;
  END;
  CREATE TRIGGER memory_vector_delete AFTER DELETE ON memory_embeddings BEGIN
    UPDATE memory_vector_revision SET revision=revision+1 WHERE singleton=1;
    INSERT INTO memory_vector_changes VALUES(OLD.memory_id,(SELECT revision FROM memory_vector_revision WHERE singleton=1)) ON CONFLICT(memory_id) DO UPDATE SET revision=excluded.revision;
  END;
`;
module.exports = {
  id: "011_memory_vector_changes", phase: "after-schema", schema,
  async up(database) { await database.exec("BEGIN IMMEDIATE; " + schema + " COMMIT;"); }
};
