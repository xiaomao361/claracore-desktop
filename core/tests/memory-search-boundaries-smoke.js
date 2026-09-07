const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-search-boundaries-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR = path.join(root, "userData");
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
  const app = { getPath: (name) => path.join(root, name), isPackaged: false };
  const settings = { "memory.embedding.provider": "ollama", "memory.embedding.model": "fixture", "memory.embedding.dimension": 2 };
  await runtime.saveProductSettings(app, settings);
  const { database } = await runtime.ensureProductCore(app);
  try {
    await database.exec(`
      WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM seq WHERE x < 606)
      INSERT INTO memories (id, title, body, status, sensitivity)
      SELECT printf('search_%04d', x), 'Fixture', 'Fixture body',
        CASE WHEN x = 605 THEN 'superseded' ELSE 'active' END,
        CASE WHEN x = 604 THEN 'restricted' ELSE 'normal' END FROM seq;
      INSERT INTO memory_labels (memory_id, label)
      SELECT id, CASE WHEN id = 'search_0606' THEN 'agent-id:my-agent' ELSE 'agent-id:codex' END FROM memories;
      INSERT INTO memory_embeddings (memory_id, provider, model, dimension, status, vector_json, embedded_at)
      SELECT id, CASE WHEN id = 'search_0601' THEN 'other-provider' ELSE 'ollama' END,
        CASE WHEN id = 'search_0602' THEN 'old-model' ELSE 'fixture' END,
        CASE WHEN id = 'search_0603' THEN 3 ELSE 2 END, 'ready',
        CASE WHEN id < 'search_0600' THEN '[0,1]' ELSE '[1,0]' END,
        CASE WHEN id = 'search_0600' THEN '2000-01-01' ELSE '2026-01-01' END FROM memories;
    `);
    database.createEmbedding = async () => ({ provider: "ollama", model: "fixture", vector: [1, 0] });
    const candidateQuery = database.vectorMemoryCandidates.bind(database);
    const pages = [];
    database.vectorMemoryCandidates = async (...args) => {
      const rows = await candidateQuery(...args);
      pages.push(rows.length);
      return rows;
    };
    const result = await database.searchMemories("semantic query without lexical match", 50, { agentId: "codex" });
    assert.deepEqual(result.results.map((row) => row.id), ["search_0600"], "Retrieve the oldest match and exclude wrong model, provider, dimension, status, sensitivity and agent.");
    assert.deepEqual(pages, [200, 200, 200, 0], "Exact page multiples terminate without truncating retrieval.");
    const history = await database.searchMemories("semantic query without lexical match", 50, { agentId: "codex", timeView: "historical" });
    assert.deepEqual(history.results.map((row) => row.id), ["search_0605"]);
    await runtime.saveProductSettings(app, settings);
    assert.equal((await database.getMemory("search_0600")).embedding_status, "ready", "Saving unchanged settings must preserve vectors.");
    await runtime.saveProductSettings(app, { "memory.embedding.model": "new-fixture" });
    assert.equal((await database.getMemory("search_0600")).embedding_status, "pending", "Changed models must queue active vectors for rebuilding.");
    assert.equal((await database.getMemory("search_0604")).embedding_status, "ready", "A settings change must not enqueue restricted memories for external embedding.");
    database.createEmbedding = async () => ({ provider: "ollama", model: "new-fixture", vector: [1, 0] });
    const afterSwitch = await database.searchMemories("semantic query without lexical match", 50, { agentId: "codex" });
    assert.deepEqual(afterSwitch.results, []);
    await database.embedMemory("search_0600");
    const rebuilt = await database.searchMemories("semantic query without lexical match", 50, { agentId: "codex" });
    assert.deepEqual(rebuilt.results.map((row) => row.id), ["search_0600"]);
    let releaseEmbedding;
    let reportStarted;
    const started = new Promise((resolve) => { reportStarted = resolve; });
    database.createEmbedding = async () => {
      reportStarted();
      return new Promise((resolve) => { releaseEmbedding = resolve; });
    };
    const pendingEmbedding = database.embedMemory("search_0600");
    await started;
    await runtime.saveProductSettings(app, { "memory.embedding.model": "third-fixture" });
    releaseEmbedding({ provider: "ollama", model: "new-fixture", vector: [1, 0] });
    await pendingEmbedding;
    assert.equal((await database.getMemory("search_0600")).embedding_status, "pending", "An old in-flight response must not overwrite a new model's rebuild queue.");
    let rejectEmbedding;
    let reportFailureStarted;
    const failureStarted = new Promise((resolve) => { reportFailureStarted = resolve; });
    database.createEmbedding = async () => {
      reportFailureStarted();
      return new Promise((_resolve, reject) => { rejectEmbedding = reject; });
    };
    const failingEmbedding = database.embedMemory("search_0600");
    const rejected = assert.rejects(failingEmbedding, /old request failed/);
    await failureStarted;
    await runtime.saveProductSettings(app, { "memory.embedding.model": "fourth-fixture" });
    rejectEmbedding(new Error("old request failed"));
    await rejected;
    assert.equal((await database.getMemory("search_0600")).embedding_status, "pending", "An old request failure must not remove a new model's rebuild work.");
    console.log("Memory search pagination, isolation and model-switch boundaries passed.");
  } finally {
    database.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
