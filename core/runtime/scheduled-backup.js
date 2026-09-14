const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { ProductDatabase } = require("../db/database");
const { fileHash, pruneAutomaticBackups } = require("./backup-retention");

async function verifyBackupFile(file) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-backup-verify-"));
  const restored = path.join(root, "restored.db");
  const database = new ProductDatabase(restored);
  try {
    await fs.copyFile(file, restored);
    const rows = await database.query("PRAGMA quick_check;");
    if (Object.values(rows[0] || {})[0] !== "ok") throw new Error("Scheduled backup integrity check failed.");
    if ((await database.query("PRAGMA foreign_key_check;")).length) throw new Error("Scheduled backup has invalid references.");
    // An empty SQLite database also passes quick_check. Require the product's
    // tables before accepting this snapshot as the replacement restore point.
    await database.getSummary();
  } finally {
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
  return fileHash(file);
}

async function performScheduledBackup({ database, createBackup, today, backupsDir }, progress) {
  const settings = await database.getSettings();
  if (settings["backup.enabled"] === false || settings["backup.schedule"] !== "daily") return { skipped: "manual_or_disabled" };
  if (settings["backup.last_run_date"] === today) return { skipped: "already_completed" };
  let backup = settings["backup.last_local_date"] === today
    ? await database.getBackup(settings["backup.last_local_id"])
    : null;
  let created = false;
  if (!backup || backup.status !== "verified") {
    backup = await createBackup();
    if (backup?.status !== "verified") throw new Error("Scheduled backup was not verified.");
    await database.updateSettings({ "backup.last_local_date": today, "backup.last_local_id": backup.id });
    created = true;
  }
  const sourceHash = await verifyBackupFile(backup.path);
  const localRoot = await fs.realpath(backupsDir || path.dirname(backup.path));
  if (created) {
    const manifestPath = backup.metadata?.manifestPath;
    const manifestSha256 = manifestPath === backup.path.slice(0, -3) + ".json" ? await fileHash(manifestPath) : null;
    backup = await database.updateBackup(backup.id, backup.status, {
      automatic: { version: 1, day: today, localRoot, sha256: sourceHash, manifestSha256, mirrors: [] }
    });
  }
  const mirrorDir = String(settings["backup.mirror_dir"] || "").trim();
  let mirrorPath = null;
  progress.stage = "mirror";
  if (mirrorDir) {
    // Do not create a missing external mount path on the internal disk.
    if (!path.isAbsolute(mirrorDir) || !(await fs.stat(mirrorDir)).isDirectory()) throw new Error("Backup mirror directory is unavailable.");
    const mirrorRoot = await fs.realpath(mirrorDir);
    if (mirrorRoot === localRoot) throw new Error("Additional backup directory must differ from the local backup directory.");
    mirrorPath = path.join(mirrorDir, path.basename(backup.path));
    try {
      await fs.copyFile(backup.path, mirrorPath, fs.constants.COPYFILE_EXCL);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    if (await verifyBackupFile(mirrorPath) !== sourceHash) throw new Error("Backup mirror does not match the verified local snapshot.");
    if (backup.metadata?.automatic) {
      const automatic = backup.metadata.automatic;
      const mirrors = (automatic.mirrors || []).filter((item) => item.path !== mirrorPath && item.root !== mirrorRoot);
      mirrors.push({ path: mirrorPath, root: mirrorRoot, sha256: sourceHash });
      backup = await database.updateBackup(backup.id, backup.status, { automatic: { ...automatic, mirrors } });
    }
  }
  progress.stage = "retention";
  const retention = await pruneAutomaticBackups({ database, backupsDir: localRoot, keepId: backup.id,
    today, retentionDays: Number(settings["backup.retention_days"] ?? 7) });
  await database.recordRuntimeEvent({ level: retention.pending.length ? "warn" : "info", source: "backup",
    message: retention.pending.length ? "Automatic backup verified; expired backup cleanup is pending" : "Automatic backup verified",
    metadata: { backupId: backup.id, mirrorPath, retention } });
  await database.updateSettings({ "backup.last_run_date": today });
  return { backupId: backup.id, path: backup.path, mirrorPath, sha256: sourceHash, retention };
}

async function runScheduledBackup(input) {
  const progress = { stage: "local" };
  try { return await performScheduledBackup(input, progress); }
  catch (error) {
    try {
      await input.database.recordRuntimeEvent({ level: "error", source: "backup",
        message: "Automatic backup did not complete",
        metadata: { stage: progress.stage, day: input.today, code: error.code || "BACKUP_FAILED" } });
    } catch (recordError) { console.error("Could not record backup failure:", recordError); }
    throw error;
  }
}

module.exports = { runScheduledBackup };
