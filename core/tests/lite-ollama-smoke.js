const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

process.env.CLARACORE_DESKTOP_BUILD_FLAVOR = "lite";

const { initializeProductDatabase } = require("../db/database");
const { builtInEmbeddingLoadState } = require("../db/repositories/memoria/embeddings");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-lite-ollama-"));
  const database = await initializeProductDatabase(path.join(dataRoot, "claracore.db"));
  try {
    await database.updateSettings({
      "memory.embedding.provider": "ollama",
      "memory.embedding.base_url": "http://127.0.0.1:11434",
      "memory.embedding.model": "bge-m3"
    });
    const embedding = await database.createEmbedding("ClaraCore Lite Ollama embedding smoke test.");
    assert.equal(embedding.provider, "ollama");
    assert.equal(embedding.model, "bge-m3");
    assert(embedding.vector.length > 0, "Ollama returned an empty embedding vector.");
    assert.equal(builtInEmbeddingLoadState().started, false, "Lite attempted to load the built-in embedding runtime.");
    console.log(JSON.stringify({
      ok: true,
      provider: embedding.provider,
      model: embedding.model,
      dimension: embedding.vector.length,
      builtInLoadState: builtInEmbeddingLoadState()
    }, null, 2));
  } finally {
    database.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
