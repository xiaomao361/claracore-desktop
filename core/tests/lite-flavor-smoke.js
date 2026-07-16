const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

process.env.CLARACORE_DESKTOP_BUILD_FLAVOR = "lite";

const {
  BUILD_FLAVOR,
  HAS_BUILT_IN_EMBEDDING,
  MEMORY_EMBEDDING_PROVIDERS
} = require("../build-flavor");
const runtime = require("../runtime");

async function main() {
  assert.equal(BUILD_FLAVOR, "lite");
  assert.equal(HAS_BUILT_IN_EMBEDDING, false);
  assert.deepEqual(MEMORY_EMBEDDING_PROVIDERS, ["ollama", "disabled"]);

  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-lite-flavor-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  const { database } = await runtime.ensureProductCore(app);
  const settings = await database.getSettings();
  assert.equal(settings["memory.embedding.provider"], "ollama");
  assert.equal(settings["memory.embedding.model"], "");

  const snapshot = await runtime.buildProductSnapshot(app);
  assert.equal(snapshot.build.flavor, "lite");
  assert.equal(snapshot.build.hasBuiltInEmbedding, false);
  assert.equal(snapshot.configuration.memoria.providerSupported, true);
  assert.deepEqual(snapshot.configuration.memoria.availableProviders, ["ollama", "disabled"]);

  await assert.rejects(
    database.updateSettings({ "memory.embedding.provider": "claracore-built-in" }),
    /not available in this build/
  );

  await database.exec(`
    UPDATE app_settings SET value_json = '"claracore-built-in"' WHERE key = 'memory.embedding.provider';
    UPDATE app_settings SET value_json = '"Xenova/bge-small-zh-v1.5"' WHERE key = 'memory.embedding.model';
  `);
  const existingFullConfiguration = await database.getConfiguration(runtime.resolveProductPaths(app));
  assert.equal(existingFullConfiguration.memoria.provider, "claracore-built-in");
  assert.equal(existingFullConfiguration.memoria.providerSupported, false);
  await assert.rejects(
    database.createEmbedding("Lite must not load the built-in model"),
    /not available in the Lite build/
  );

  runtime.resetCachedDatabase();
  console.log(JSON.stringify({ ok: true, dataRoot, build: snapshot.build }, null, 2));
}

main().catch((error) => {
  runtime.resetCachedDatabase();
  console.error(error);
  process.exit(1);
});
