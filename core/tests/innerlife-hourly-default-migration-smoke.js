const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { ProductDatabase } = require("../db/database");

const MIGRATION_ID = "006_innerlife_hourly_default";

async function reopenWithPendingMigration(databasePath, intervalSeconds) {
  const database = new ProductDatabase(databasePath);
  await database.initialize();
  await database.updateSettings({ "innerlife.loop_seconds": intervalSeconds });
  await database.exec(`DELETE FROM schema_migrations WHERE id = '${MIGRATION_ID}';`);
  database.close();

  const reopened = new ProductDatabase(databasePath);
  await reopened.initialize();
  return reopened;
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-innerlife-hourly-default-"));
  try {
    const oldDefaultPath = path.join(dataRoot, "old-default.db");
    const migratedDefault = await reopenWithPendingMigration(oldDefaultPath, 900);
    assert.equal(
      (await migratedDefault.getSettings())["innerlife.loop_seconds"],
      3600,
      "The former 15-minute default should migrate to one hour."
    );
    migratedDefault.close();

    const customPath = path.join(dataRoot, "custom.db");
    const preservedCustom = await reopenWithPendingMigration(customPath, 1980);
    assert.equal(
      (await preservedCustom.getSettings())["innerlife.loop_seconds"],
      1980,
      "A custom InnerLife interval should remain unchanged."
    );
    preservedCustom.close();

    console.log(JSON.stringify({
      suite: "innerlife-hourly-default-migration-smoke",
      migratedSeconds: 3600,
      preservedCustomSeconds: 1980,
      migration: MIGRATION_ID
    }, null, 2));
  } finally {
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
