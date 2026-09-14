const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { createReadStream } = require("fs");
const { sqlString } = require("../db/helpers");

async function fileHash(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function retentionCutoff(today, days) {
  const date = new Date(`${today}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== today) throw new Error("Invalid backup day.");
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Invalid backup retention days.");
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}

async function existingRegularFile(file) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Backup cleanup refuses non-regular files.");
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function pruneAutomaticBackups({ database, backupsDir, keepId, today, retentionDays }) {
  const cutoff = retentionCutoff(today, retentionDays);
  const root = await fs.realpath(backupsDir);
  const rows = await database.query(`SELECT id FROM backups
    WHERE json_extract(metadata_json, '$.automatic.version') = 1
      AND json_extract(metadata_json, '$.automatic.day') < ${sqlString(cutoff)}
      AND id != ${sqlString(keepId)} ORDER BY created_at, id;`);
  const deleted = [];
  const pending = [];
  backupLoop: for (const row of rows) {
    const backup = await database.getBackup(row.id);
    const automatic = backup?.metadata?.automatic;
    if (!automatic || automatic.version !== 1) continue;
    // Only the product's managed local directory; never follow an imported path
    // or a symlink to delete an unrelated database.
    if (await fs.realpath(path.dirname(backup.path)) !== root || automatic.localRoot !== root || !backup.path.endsWith(".db")) throw new Error("Automatic backup is outside its managed directory.");
    const copies = [];
    for (const mirror of automatic.mirrors || []) {
      let mirrorRoot;
      try {
        mirrorRoot = await fs.realpath(path.dirname(mirror.path));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        pending.push({ id: backup.id, reason: "mirror_unavailable" });
        continue backupLoop;
      }
      if (path.basename(mirror.path) !== path.basename(backup.path) || mirrorRoot !== mirror.root) throw new Error("Automatic backup mirror directory changed.");
      if (await existingRegularFile(mirror.path)) {
        if (await fileHash(mirror.path) !== mirror.sha256) throw new Error("Automatic backup mirror changed; cleanup stopped.");
        copies.push(mirror.path);
      }
    }
    const localExists = await existingRegularFile(backup.path);
    if (localExists && await fileHash(backup.path) !== automatic.sha256) throw new Error("Automatic backup changed; cleanup stopped.");
    const manifest = backup.metadata?.manifestPath;
    const expectedManifest = backup.path.slice(0, -3) + ".json";
    if (manifest === expectedManifest && automatic.manifestSha256 && await existingRegularFile(manifest)) {
      if (await fileHash(manifest) !== automatic.manifestSha256) throw new Error("Automatic backup manifest changed; cleanup stopped.");
      copies.push(manifest);
    }
    // All paths/hashes are checked before any deletion. Missing files permit
    // resuming a previously interrupted cleanup, but an offline mirror stops it.
    for (const file of copies) await fs.unlink(file);
    if (localExists) await fs.unlink(backup.path);
    await database.deleteBackupRecord(backup.id);
    deleted.push(backup.id);
  }
  return { deleted, pending, cutoff, retentionDays };
}

module.exports = { fileHash, retentionCutoff, pruneAutomaticBackups };
