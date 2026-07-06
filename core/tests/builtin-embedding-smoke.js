const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-builtin-embedding-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  const { database } = await runtime.ensureProductCore(app);
  const embedding = await database.createEmbedding("ClaraCore 内置向量模型 smoke");
  if (embedding.provider !== "claracore-built-in") {
    throw new Error(`Unexpected provider: ${embedding.provider}`);
  }
  if (embedding.model !== "Xenova/bge-small-zh-v1.5") {
    throw new Error(`Unexpected model: ${embedding.model}`);
  }
  if (!Array.isArray(embedding.vector) || embedding.vector.length !== 512) {
    throw new Error(`Expected 512 dimensions, got ${embedding.vector?.length || 0}`);
  }

  console.log(JSON.stringify({ ok: true, provider: embedding.provider, model: embedding.model, dimensions: embedding.vector.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
