const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { ProductDatabase } = require("../db/database");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-backup-boundaries-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR = path.join(root, "userData");
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = "1";
  const app = { getPath: (name) => path.join(root, name), isPackaged: false };
  await runtime.saveProductSettings(app, { "memory.embedding.provider": "disabled" });
  const { database, paths } = await runtime.ensureProductCore(app);
  try {
    await database.exec(`
      WITH RECURSIVE seq(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM seq WHERE x < 601)
      INSERT INTO memories (id, title, body, status, sensitivity, created_at, updated_at)
      SELECT printf('boundary_%04d', x), 'Fixture', 'Original body', 'active', 'normal',
        datetime('2020-01-01', '+' || x || ' seconds'),
        datetime('2020-01-01', '+' || x || ' seconds') FROM seq;
    `);
    const backup = await runtime.createProductBackup(app);
    const exported = await runtime.exportProductDataJson(app);
    await database.exec("UPDATE memories SET body = 'Changed old body' WHERE id = 'boundary_0001';");
    const originalQuery = ProductDatabase.prototype.query;
    const originalCopy = fs.copyFile;
    let replacementAttempts = 0;
    ProductDatabase.prototype.query = async function query(sql, ...args) {
      if (this.dbPath.startsWith(paths.backupsDir + path.sep) && this.dbPath !== backup.path && sql.includes("PRAGMA quick_check")) {
        return [{ quick_check: "injected verification failure" }];
      }
      return originalQuery.call(this, sql, ...args);
    };
    fs.copyFile = async (source, destination, ...args) => {
      if (destination === paths.databasePath) replacementAttempts += 1;
      return originalCopy(source, destination, ...args);
    };
    try {
      await assert.rejects(runtime.restoreProductBackup(app, backup.id), /Safety backup verification failed/);
      await assert.rejects(runtime.importProductDataJson(app, { filePath: exported.path }), /Safety backup verification failed/);
      assert.equal(replacementAttempts, 0, "Failed safety backups must block both replacement paths.");
      assert.equal((await database.getMemory("boundary_0001")).body, "Changed old body");
      await database.exec("UPDATE memories SET title = 'Still writable' WHERE id = 'boundary_0001';");
    } finally {
      ProductDatabase.prototype.query = originalQuery;
      fs.copyFile = originalCopy;
    }
    // Differences outside the old newest-500 window still count; previews stay bounded.
    await database.exec(`
      UPDATE memories SET body = 'Changed old body' WHERE id <= 'boundary_0020';
      DELETE FROM memories WHERE id IN ('boundary_0021', 'boundary_0022');
      INSERT INTO memories (id, title, body, status, sensitivity)
      VALUES ('new_memory', 'New', 'New body', 'active', 'normal');
    `);
    const preview = await runtime.previewProductRestore(app, backup.id);
    assert.equal(preview.memoryDiff.changedCount, 20);
    assert.equal(preview.memoryDiff.restoredCount, 2);
    assert.equal(preview.memoryDiff.removedCount, 1);
    assert.equal(preview.memoryDiff.keptCount, 579);
    assert.equal(preview.memoryDiff.changed.length, 8);
    assert.ok(preview.memoryDiff.changed.every((row) => !Object.hasOwn(row, "body")));
    console.log("Backup failure and full-count preview boundaries passed.");
  } finally {
    database.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
