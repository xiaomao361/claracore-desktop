const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { builtInEmbeddingLoadState } = require("../db/repositories/memoria/embeddings");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-builtin-lazy-"));
  const database = await initializeProductDatabase(path.join(dataRoot, "claracore.db"));
  try {
    assert.strictEqual(builtInEmbeddingLoadState().started, false, "initializing the database should not load the built-in embedding model");
    await database.updateSettings({
      "memory.embedding.provider": "ollama",
      "memory.embedding.base_url": "http://127.0.0.1:9",
      "memory.embedding.model": "bge-m3-lazy-smoke",
      "memory.embedding.dimension": 1024
    });
    await database.createMemory({ body: "Lazy load smoke memory.", agentId: "clara" });
    await database.getMemoryStats();
    await database.getMemoryMaintenanceReport();
    await database.searchMemories("Lazy load smoke memory", 5);
    assert.strictEqual(
      builtInEmbeddingLoadState().started,
      false,
      "Ollama-backed search and maintenance should not load the built-in embedding model"
    );
    const processed = await database.processPendingEmbeddings(1);
    assert.strictEqual(processed.processed, 1, "pending embedding should be attempted through Ollama");
    assert.strictEqual(processed.results[0].ok, false, "unavailable Ollama endpoint should fail the item without falling back");
    assert.strictEqual(
      builtInEmbeddingLoadState().started,
      false,
      "failed Ollama embedding should not fall back to or load the built-in model"
    );
    console.log(JSON.stringify({ ok: true, builtInLoadState: builtInEmbeddingLoadState() }, null, 2));
  } finally {
    database.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
