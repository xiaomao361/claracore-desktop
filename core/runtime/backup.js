const path = require("path");
const fs = require("fs/promises");
const { ProductDatabase, initializeProductDatabase } = require("../db/database");

function createBackupRuntime({ ensureProductCore, productVersion, sqlString, timestampForFilename }) {
  async function createProductBackup(app) {
    const { paths, database } = await ensureProductCore(app);
    const createdAt = new Date();
    const backupStem = `claracore-backup-${timestampForFilename(createdAt)}`;
    const backupPath = path.join(paths.backupsDir, `${backupStem}.db`);
    const manifestPath = path.join(paths.backupsDir, `${backupStem}.json`);
    const summary = await database.getSummary();
    const backup = await database.createDatabaseBackup(backupPath, {
      productVersion,
      createdAt: createdAt.toISOString(),
      sourceDatabase: paths.databasePath,
      manifestPath,
      summary
    });
    let verification = {
      ok: false,
      quickCheck: "not-run"
    };
    try {
      const backupDatabase = new ProductDatabase(backupPath);
      const quickRows = await backupDatabase.query("PRAGMA quick_check;");
      const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
      const backupSummary = await backupDatabase.getSummary();
      verification = {
        ok: quickCheck === "ok",
        quickCheck,
        summary: backupSummary
      };
    } catch (error) {
      verification = {
        ok: false,
        quickCheck: "error",
        error: error.message
      };
    }
    const verifiedBackup = await database.updateBackup(backup.id, verification.ok ? "verified" : "failed", {
      verification
    });
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: verifiedBackup.id,
          productVersion,
          createdAt: verifiedBackup.created_at,
          sourceDatabase: paths.databasePath,
          backupDatabase: backupPath,
          status: verifiedBackup.status,
          summary,
          verification
        },
        null,
        2
      ),
      "utf8"
    );
    return {
      ...verifiedBackup,
      metadata: {
        ...(verifiedBackup.metadata || {}),
        manifestPath
      }
    };
  }

  async function resolveVerifiedBackup(app, backupId) {
    const { paths, database } = await ensureProductCore(app);
    const backup = await database.getBackup(backupId);
    if (!backup) throw new Error("Backup not found.");
    if (backup.status !== "verified") throw new Error("Only verified backups can be restored.");
    const backupPath = path.resolve(backup.path);
    const backupsRoot = path.resolve(paths.backupsDir);
    if (!backupPath.startsWith(`${backupsRoot}${path.sep}`)) {
      throw new Error("Backup must be inside the product backup directory.");
    }
    const candidate = new ProductDatabase(backupPath);
    const quickRows = await candidate.query("PRAGMA quick_check;");
    const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
    if (quickCheck !== "ok") {
      throw new Error(`Backup quick_check failed: ${quickCheck}`);
    }
    return {
      paths,
      database,
      backup,
      backupPath,
      quickCheck,
      candidate
    };
  }

  async function restorePreviewMemoryRows(database) {
    const rows = await database.query(`
      SELECT
        id,
        COALESCE(NULLIF(title, ''), substr(body, 1, 80), id) AS title,
        substr(body, 1, 160) AS body_preview,
        body,
        updated_at,
        created_at
      FROM memories
      WHERE status = 'active'
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 500;
    `);
    return rows.map((row) => ({
      id: row.id,
      title: row.title || row.id,
      bodyPreview: row.body_preview || "",
      body: row.body || "",
      updatedAt: row.updated_at || "",
      createdAt: row.created_at || ""
    }));
  }

  function summarizeRestoreMemoryDiff(currentRows, targetRows) {
    const currentById = new Map(currentRows.map((row) => [row.id, row]));
    const targetById = new Map(targetRows.map((row) => [row.id, row]));
    const removed = currentRows.filter((row) => !targetById.has(row.id));
    const restored = targetRows.filter((row) => !currentById.has(row.id));
    const changed = targetRows.filter((target) => {
      const current = currentById.get(target.id);
      if (!current) return false;
      return current.title !== target.title || current.body !== target.body || current.updatedAt !== target.updatedAt;
    });
    const keptCount = targetRows.filter((row) => currentById.has(row.id)).length - changed.length;
    const previewRow = ({ body: _body, ...row }) => row;
    return {
      removedCount: removed.length,
      restoredCount: restored.length,
      changedCount: changed.length,
      keptCount: Math.max(0, keptCount),
      limit: 8,
      removed: removed.slice(0, 8).map(previewRow),
      restored: restored.slice(0, 8).map(previewRow),
      changed: changed.slice(0, 8).map(previewRow)
    };
  }

  async function previewProductRestore(app, backupId) {
    const { database, backup, quickCheck, candidate } = await resolveVerifiedBackup(app, backupId);
    const currentMemories = await restorePreviewMemoryRows(database);
    const targetMemories = await restorePreviewMemoryRows(candidate);
    return {
      backup,
      quickCheck,
      current: await database.getSummary(),
      target: await candidate.getSummary(),
      memoryDiff: summarizeRestoreMemoryDiff(currentMemories, targetMemories)
    };
  }

  async function restoreProductBackup(app, backupId) {
    const { paths, backup, backupPath } = await resolveVerifiedBackup(app, backupId);

    const safetyBackup = await createProductBackup(app);
    await fs.copyFile(backupPath, paths.databasePath);
    const restoredDatabase = await initializeProductDatabase(paths.databasePath);
    const restoredSafetyBackup = await restoredDatabase.registerBackupRecord({
      id: safetyBackup.id,
      path: safetyBackup.path,
      status: safetyBackup.status,
      metadata: {
        ...(safetyBackup.metadata || {}),
        restoredDatabaseRegistered: true,
        restoredAfterBackupId: backup.id,
        restoredAfterBackupPath: backup.path
      }
    });
    await restoredDatabase.exec(`
      INSERT INTO runtime_events (id, level, source, message, metadata_json)
      VALUES (
        'event_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}',
        'info',
        'backup',
        'Database restored from verified backup',
        ${sqlString(
          JSON.stringify({
            restoredBackupId: backup.id,
            restoredBackupPath: backup.path,
            safetyBackupId: restoredSafetyBackup.id,
            safetyBackupPath: restoredSafetyBackup.path
          })
        )}
      );
    `);
    return {
      restored: true,
      backup,
      safetyBackup: restoredSafetyBackup,
      summary: await restoredDatabase.getSummary()
    };
  }

  function backupFileInsideRoot(filePath, backupsRoot) {
    const resolved = path.resolve(filePath || "");
    const root = path.resolve(backupsRoot);
    return resolved.startsWith(`${root}${path.sep}`);
  }

  async function deleteProductBackup(app, backupId) {
    const { paths, database } = await ensureProductCore(app);
    const backup = await database.getBackup(backupId);
    if (!backup) throw new Error("Backup not found.");
    if (!backupFileInsideRoot(backup.path, paths.backupsDir)) {
      throw new Error("Backup must be inside the product backup directory.");
    }
    const deletedFiles = [];
    const missingFiles = [];
    const candidateFiles = [
      backup.path,
      backup.metadata?.manifestPath
    ].filter(Boolean);
    for (const filePath of candidateFiles) {
      if (!backupFileInsideRoot(filePath, paths.backupsDir)) continue;
      try {
        await fs.rm(filePath, { force: false });
        deletedFiles.push(filePath);
      } catch (error) {
        if (error?.code === "ENOENT") {
          missingFiles.push(filePath);
          continue;
        }
        throw error;
      }
    }
    const deleted = await database.deleteBackupRecord(backup.id);
    await database.recordRuntimeEvent({
      level: "info",
      source: "backup",
      message: "Backup deleted",
      metadata: {
        backupId: backup.id,
        path: backup.path,
        deletedFiles,
        missingFiles
      }
    });
    return {
      deleted: true,
      backup: deleted,
      deletedFiles,
      missingFiles
    };
  }

  return {
    createProductBackup,
    deleteProductBackup,
    previewProductRestore,
    restoreProductBackup
  };
}

module.exports = {
  createBackupRuntime
};
