const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase, ProductDatabase } = require("../db/database");
const { sqlString } = require("../db/helpers");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-vector-projection-test-"));
  const dbPath = path.join(root, "source.db");
  let database = await initializeProductDatabase(dbPath);
  let second;
  const configure = (db) => {
    db.vectorEngine = "sqlite-vec";
    db.createEmbedding = async () => ({ provider: "fixture", model: "one", vector: [1, 0] });
  };
  const search = (query = "no lexical match", options = {}) => database.searchMemories(query, 50, { agentId: "codex", ...options });
  const insert = async (id, vector, options = {}) => {
    await database.exec(`
      INSERT INTO memories(id,title,body,status,sensitivity,created_at,updated_at) VALUES(${sqlString(id)},${sqlString(options.title || "fixture")},'fixture body',${sqlString(options.status || "active")},${sqlString(options.sensitivity || "normal")},'2026-01-01 00:00:00','2026-01-01 00:00:00');
      INSERT INTO memory_labels(memory_id,label) VALUES(${sqlString(id)},${sqlString(`agent-id:${options.agent || "codex"}`)});
      INSERT INTO memory_embeddings(memory_id,provider,model,dimension,status,vector_json)
      VALUES(${sqlString(id)},'fixture',${sqlString(options.model || "one")},${Number(options.dimension || 2)},${sqlString(options.embeddingStatus || "ready")},${vector === null ? "NULL" : sqlString(typeof vector === "string" ? vector : JSON.stringify(vector))});
    `);
  };
  try {
    configure(database);
    await insert("excluded-restricted", [1, 0], { sensitivity: "restricted" });
    await insert("excluded-agent", [1, 0], { agent: "other" });
    await insert("excluded-model", [1, 0], { model: "two" });
    await insert("excluded-dimension", [1, 0, 0], { dimension: 3 });
    await insert("historical", [1, 0], { status: "superseded" });
    await insert("valid", [0.8, 0.6]);
    const sourceVectors = await database.query("SELECT memory_id,vector_json FROM memory_embeddings ORDER BY memory_id;");
    // Simulate the pre-009 source shape with real vectors already present.
    await database.exec("DROP TRIGGER memory_vector_insert; DROP TRIGGER memory_vector_update; DROP TRIGGER memory_vector_delete; DROP TABLE memory_vector_revision; DROP TABLE memory_vector_changes; DROP INDEX idx_memory_embeddings_space; DELETE FROM schema_migrations WHERE id IN ('009_memory_vector_revision','010_memory_embedding_space_index','011_memory_vector_changes');");
    database.close();
    database = await initializeProductDatabase(dbPath);
    configure(database);
    assert.deepEqual(await database.query("SELECT memory_id,vector_json FROM memory_embeddings ORDER BY memory_id;"), sourceVectors);
    await require("../db/migrations/009_memory_vector_revision").up(database);
    await require("../db/migrations/010_memory_embedding_space_index").up(database);
    await require("../db/migrations/011_memory_vector_changes").up(database);
    assert.deepEqual((await database.query("PRAGMA index_info(idx_memory_embeddings_space);")).map((row) => row.name), ["provider", "model", "dimension", "status", "memory_id"]);
    assert.equal((await database.query("SELECT count(*) AS n FROM memory_vector_revision;"))[0].n, 1, "Migration replay preserves a single source revision row");
    // Different space keeps these threshold cases independent of stronger hits.
    for (const [id, score] of [["floor", 0.55], ["above", 0.5501], ["below", 0.55 - 1e-9]]) {
      await insert(id, [score, Math.sqrt(1-score*score)], { model: "threshold" });
    }
    database.createEmbedding = async () => ({ provider: "fixture", model: "threshold", vector: [1, 0] });
    assert.deepEqual((await search()).results.map((row) => row.id), ["above", "floor"], "Float32 rounding must not promote a just-below-floor source score");
    configure(database);
    let result = await search();
    assert.equal(result.error, null);
    assert.deepEqual(result.results.map((item) => item.id), ["valid"]);
    assert(Math.abs(result.results[0].search_score - 0.8) < 1e-6);
    assert.equal(result.vectorSearch.status, "ready");
    const cachedRevision = result.vectorSearch.revision;
    assert.equal((await search()).vectorSearch.revision, cachedRevision);
    assert.deepEqual((await search(undefined, { timeView: "historical" })).results.map((item) => item.id), ["historical"]);
    // Eligibility is read from the live source, not frozen into the projection.
    await database.deleteMemory("valid");
    assert.deepEqual((await search()).results, []);
    await database.restoreMemory("valid");
    assert.equal((await search()).results[0].id, "valid");
    await database.exec("UPDATE memory_labels SET label='agent-id:other' WHERE memory_id='valid';");
    assert.deepEqual((await search()).results, []);
    await database.exec("UPDATE memory_labels SET label='agent-id:codex' WHERE memory_id='valid';");
    // Source changes from another connection invalidate the process-local cache.
    second = new ProductDatabase(dbPath);
    const normalProjection = database.queryVectorProjection.bind(database);
    database.queryVectorProjection = async (setup, select) => normalProjection(setup.replace(
      "DROP TABLE temp.vector_input;",
      "CREATE TEMP TABLE assert_incremental(n INTEGER CHECK(n=1)); INSERT INTO assert_incremental SELECT count(*) FROM vector_input; DROP TABLE assert_incremental; DROP TABLE temp.vector_input;"
    ), select);
    await second.exec("UPDATE memory_embeddings SET vector_json='[0,1]' WHERE memory_id='valid';");
    assert.deepEqual((await search()).results, []);
    await second.exec("UPDATE memory_embeddings SET vector_json='[0.8,0.6]' WHERE memory_id='valid';");
    assert.equal((await search()).results[0].id, "valid");
    // Moving spaces removes the old cached row and restores it on return.
    await second.exec("UPDATE memory_embeddings SET model='two' WHERE memory_id='valid';");
    database.queryVectorProjection = normalProjection;
    assert.deepEqual((await search()).results, []);
    await second.exec("UPDATE memory_embeddings SET model='one' WHERE memory_id='valid';");
    assert.equal((await search()).results[0].id, "valid");
    await second.exec("DELETE FROM memory_embeddings WHERE memory_id='valid';");
    assert.deepEqual((await search()).results, []);
    await second.exec("INSERT INTO memory_embeddings(memory_id,provider,model,dimension,status,vector_json) VALUES('valid','fixture','one',2,'ready','[0.8,0.6]');");
    assert.equal((await search()).results[0].id, "valid");
    configure(second);
    assert.equal((await second.searchMemories("no lexical match", 50, {agentId:"codex"})).results[0].id,"valid");
    await database.exec("DELETE FROM memory_embeddings WHERE memory_id='valid';");
    assert.deepEqual((await search()).results, []);
    assert.deepEqual((await second.searchMemories("no lexical match",50,{agentId:"codex"})).results, [], "Lagging independent cache consumes deletion tombstone");
    await database.exec("INSERT INTO memory_embeddings(memory_id,provider,model,dimension,status,vector_json) VALUES('valid','fixture','one',2,'ready','[0.8,0.6]');");
    assert.equal((await search()).results[0].id,"valid");
    assert.equal((await second.searchMemories("no lexical match",50,{agentId:"codex"})).results[0].id,"valid");
    second.close(); second = null;

    // More than K exact ties, deliberately inserted in reverse ID order.
    for (let index = 12; index >= 0; index -= 1) await insert(`tie-${String(index).padStart(2, "0")}`, [1, 0]);
    result = await search();
    assert.deepEqual(result.results.map((item) => item.id), Array.from({ length: 10 }, (_, i) => `tie-${String(i).padStart(2, "0")}`));
    await insert("Z-import", [1, 0]);
    await insert("a-import", [1, 0]);
    await insert("A-import", [1, 0]);
    const tiedIds = [...Array.from({ length: 13 }, (_, i) => `tie-${String(i).padStart(2, "0")}`), "Z-import", "a-import", "A-import"].sort((a, b) => a.localeCompare(b)).slice(0, 10);
    assert.deepEqual((await search()).results.map((row) => row.id), tiedIds, "Imported IDs keep legacy localeCompare tie order");
    await insert("keyword", [0, 1], { title: "Walnut exact match" });
    assert.equal((await search("Walnut exact")).results[0].id, "keyword");
    await insert("keyword-vector", [1, 0], { title: "Walnut exact shared match" });
    assert.equal((await search("Walnut exact")).results[0].search_source, "keyword+vector");

    // Failure classes remain distinct; invalid rows never masquerade as misses.
    for (const [raw, reason] of [
      ["broken JSON", "invalid_json"], ["[]", "empty_vector"], ["{}", "not_array"],
      ["[1,0,0]", "dimension_mismatch"], ["[null,0]", "non_numeric"],
      ["[1e999,0]", "non_finite_float32"], ["[0,0]", "zero_norm"], [null, "missing_vector"],
      ["[1e-50,0]", "unusable_norm"]
    ]) {
      await insert("invalid", raw);
      const failed = await search("Walnut exact");
      assert.equal(failed.vectorSearch.status, "failed");
      assert(failed.error.includes(reason), failed.error);
      assert(failed.results.some((row) => row.id === "keyword"), "Independent keyword results survive");
      await database.exec("DELETE FROM memory_embeddings WHERE memory_id='invalid'; DELETE FROM memory_labels WHERE memory_id='invalid'; DELETE FROM memories WHERE id='invalid';");
      assert.equal((await search()).error, null, "A source repair recovers the projection");
    }
    await insert("not-ready", null, { embeddingStatus: "pending" });
    assert.equal((await search()).error, null, "Pending embeddings are excluded, not malformed ready vectors");

    const cacheRoot = database.vectorCacheRoot;
    const sourceBefore = await database.query("SELECT count(*) AS n FROM memory_embeddings;");
    const backupPath = path.join(root, "backup.db");
    await database.exec(`VACUUM INTO ${sqlString(backupPath)};`);
    const backup = new ProductDatabase(backupPath);
    try {
      assert.equal((await backup.query("PRAGMA quick_check;"))[0].quick_check, "ok");
      assert.deepEqual(await backup.query("SELECT count(*) AS n FROM memory_embeddings;"), sourceBefore);
      assert.deepEqual(await backup.query("SELECT name FROM sqlite_master WHERE sql LIKE '%USING vec0%';"), []);
      configure(backup);
      assert.equal((await backup.searchMemories("no lexical match", 50, { agentId: "codex" })).vectorSearch.status, "ready");
    } finally { backup.close(); }
    database.close();
    await assert.rejects(fs.stat(cacheRoot), { code: "ENOENT" });
    database = await initializeProductDatabase(dbPath);
    configure(database);
    assert.equal((await search()).error, null, "Reopen rebuilds a disposable cache");
    const originalProjection = database.queryVectorProjection.bind(database);
    database.queryVectorProjection = async () => { throw new Error("fixture extension unavailable"); };
    const unavailable = await search("Walnut exact");
    assert.equal(unavailable.vectorSearch.status, "failed");
    assert.match(unavailable.error, /extension unavailable/);
    assert(unavailable.results.some((row) => row.id === "keyword"));
    database.queryVectorProjection = originalProjection;
    assert.equal((await search()).error, null);
    await database.exec(`
      WITH RECURSIVE seq(x) AS (SELECT 0 UNION ALL SELECT x+1 FROM seq WHERE x<4104)
      INSERT INTO memories(id,title,body) SELECT printf('many-%04d',x),'fixture','fixture' FROM seq;
      INSERT INTO memory_labels(memory_id,label) SELECT id,CASE WHEN id<'many-0075' THEN 'agent-id:codex' ELSE 'agent-id:other' END FROM memories WHERE id LIKE 'many-%';
      INSERT INTO memory_embeddings(memory_id,provider,model,dimension,status,vector_json)
      SELECT id,'fixture','many-ties',2,'ready','[1,0]' FROM memories WHERE id LIKE 'many-%';
    `);
    database.createEmbedding = async () => ({ provider: "fixture", model: "many-ties", vector: [1, 0] });
    const expanded = await search();
    assert.equal(expanded.vectorSearch.candidateLimit, 128, "Grow K until the tied boundary is complete");
    assert.equal(expanded.vectorSearch.queryMode, "knn");
    const fullTies = await search(undefined, { agentId: "" });
    assert.equal(fullTies.vectorSearch.queryMode, "full-scan", "More than the native K limit must still cover the complete set");
    assert.deepEqual(fullTies.results.map((row) => row.id), Array.from({ length: 10 }, (_, i) => `many-${String(i).padStart(4, "0")}`));
    database.queryVectorProjection = async (setup, select) => originalProjection(`${setup} INSERT INTO deliberately_missing_table VALUES(1);`, select);
    assert.equal((await search()).vectorSearch.status, "failed", "Interrupted rebuild is not a normal empty result");
    database.queryVectorProjection = originalProjection;
    assert.equal((await search()).error, null, "Interrupted rebuild is safely repeatable");
    database.queryVectorProjection = async (...args) => {
      await database.exec("UPDATE memory_embeddings SET embedded_at=CURRENT_TIMESTAMP WHERE memory_id='valid';");
      return originalProjection(...args);
    };
    assert.match((await search()).error, /VECTOR_SOURCE_CHANGED/, "A racing source revision must not use stale projection ranks");
    database.queryVectorProjection = originalProjection;
    assert.equal((await search()).error, null);
    console.log(JSON.stringify({ suite: "vector-projection", sqlite: database.sqlite ? "node" : "cli", passed: true, coverage: ["space-and-eligibility", "ties", "keyword-merge", "cross-connection-invalidation", "invalid-inputs", "backup-rebuild", "extension-failure"] }));
  } finally {
    second?.close();
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
