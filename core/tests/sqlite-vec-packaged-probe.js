// Run ONLY via a packaged Electron executable with ELECTRON_RUN_AS_NODE=1.
const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { sqliteVecExtensionPath } = require("../sqlite-vec-extension");
const { initializeProductDatabase } = require("../db/database");

async function main() {
  assert(__dirname.includes(".asar"), "Probe must run from the actual package ASAR");
  const extensionPath = sqliteVecExtensionPath();
  assert(!extensionPath.includes("node_modules"), "Package must load the standalone native resource");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-packaged-vec-"));
  let database;
  try {
    database = await initializeProductDatabase(path.join(root, "test.db"));
    database.vectorEngine = "sqlite-vec";
    database.createEmbedding = async () => ({ provider: "test", model: "test", vector: [1, 0] });
    await database.exec("INSERT INTO memories(id,title,body) VALUES('probe','fixture','fixture'); INSERT INTO memory_embeddings(memory_id,provider,model,dimension,status,vector_json) VALUES('probe','test','test',2,'ready','[1,0]');");
    const result = await database.searchMemories("unmatched", 10);
    assert.equal(result.error, null);
    assert.equal(result.results[0].id, "probe");
    assert.equal(result.results[0].search_score, 1);
    assert.equal(result.vectorSearch.status, "ready");
    await database.exec("UPDATE memory_embeddings SET vector_json='[0,1]' WHERE memory_id='probe';");
    const changed = await database.searchMemories("unmatched", 10);
    assert.equal(changed.error, null);
    assert.equal(changed.results.length, 0);
    await database.exec("DELETE FROM memory_embeddings WHERE memory_id='probe';");
    assert.equal((await database.searchMemories("unmatched", 10)).vectorSearch.projectedCount, 0);
    console.log(JSON.stringify({ suite: "packaged-sqlite-vec", engine: database.sqlite ? "node" : "cli", extensionPath, electron: process.versions.electron, passed: true }));
  } finally { database?.close(); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
