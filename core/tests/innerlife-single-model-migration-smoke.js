const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { ProductDatabase } = require("../db/database");
const { jsonSql } = require("../db/helpers");

const MIGRATION_ID = "007_innerlife_single_model";

async function migrateLegacySettings(databasePath, { light = "", deep = "" }) {
  const database = new ProductDatabase(databasePath);
  await database.initialize();
  await database.exec(`
    DELETE FROM app_settings WHERE key = 'innerlife.model';
    INSERT INTO app_settings (key, value_json) VALUES
      ('innerlife.light_model', ${jsonSql(light)}),
      ('innerlife.deep_model', ${jsonSql(deep)})
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json;
    DELETE FROM schema_migrations WHERE id = '${MIGRATION_ID}';
  `);
  database.close();

  const reopened = new ProductDatabase(databasePath);
  await reopened.initialize();
  return reopened;
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-innerlife-single-model-"));
  try {
    const lightPreferred = await migrateLegacySettings(path.join(dataRoot, "light.db"), {
      light: "legacy-flash",
      deep: "legacy-pro"
    });
    assert.equal((await lightPreferred.getSettings())["innerlife.model"], "legacy-flash");
    lightPreferred.close();

    const deepFallback = await migrateLegacySettings(path.join(dataRoot, "deep.db"), {
      deep: "legacy-only-model"
    });
    assert.equal((await deepFallback.getSettings())["innerlife.model"], "legacy-only-model");
    deepFallback.close();

    console.log(JSON.stringify({
      suite: "innerlife-single-model-migration-smoke",
      migration: MIGRATION_ID,
      lightPreferred: "legacy-flash",
      deepFallback: "legacy-only-model"
    }, null, 2));
  } finally {
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
