const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

function vectorForScore(score) {
  return [score, Math.sqrt(1 - score * score)];
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-search-quality-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  await runtime.saveProductSettings(app, {
    "memory.embedding.provider": "disabled",
    "memory.embedding.model": ""
  });

  const keywordMemory = await runtime.createProductMemory(app, {
    title: "Walnut exact record",
    body: "This record must stay ahead of semantic-only candidates.",
    labels: ["search-quality"]
  });
  const semanticMemories = [];
  for (let index = 0; index < 12; index += 1) {
    semanticMemories.push(await runtime.createProductMemory(app, {
      title: `Semantic candidate ${index + 1}`,
      body: `Semantic-only search fixture ${index + 1}.`,
      labels: ["search-quality"]
    }));
  }
  const weakMemory = await runtime.createProductMemory(app, {
    title: "Weak semantic candidate",
    body: "A low vector score must not become a search result.",
    labels: ["search-quality"]
  });

  const { database } = await runtime.ensureProductCore(app);
  database.createEmbedding = async () => ({ provider: "fixture", model: "fixture", vector: [1, 0] });
  database.vectorMemoryCandidates = async () => semanticMemories.map((memory, index) => ({
    ...memory,
    vector: vectorForScore(0.9 - index * 0.01)
  }));

  const mixed = await database.searchMemories("Walnut exact", 50);
  assert.equal(mixed.results[0]?.id, keywordMemory.id, "A direct keyword hit must rank before semantic-only candidates.");
  assert.equal(mixed.results[0]?.search_source, "keyword");
  assert.equal(
    mixed.results.filter((memory) => memory.search_source === "vector").length,
    10,
    "Semantic-only search results must be capped at 10."
  );

  database.vectorMemoryCandidates = async () => [{
    ...weakMemory,
    vector: vectorForScore(0.54)
  }];
  const unreliable = await database.searchMemories("No lexical match", 50);
  assert.deepEqual(unreliable.results, [], "A vector score below the reliability floor must return no result.");

  console.log(JSON.stringify({
    ok: true,
    keywordFirst: mixed.results[0]?.id === keywordMemory.id,
    semanticCount: mixed.results.filter((memory) => memory.search_source === "vector").length,
    weakResultCount: unreliable.results.length
  }, null, 2));
  database.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
