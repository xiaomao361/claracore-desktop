const fs = require("node:fs");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");

const hash = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
function failure(code) { return Object.assign(new Error(code), { code }); }

// Execution evidence, not another authoritative fact store. No transcript is
// collected in the background. Only explicitly submitted bounded deltas live here.
function journal(dataRoot, owner, submissionId) {
  const directory = path.join(dataRoot, "gateway-understanding");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(directory).isSymbolicLink()) throw failure("unsafe_journal_directory");
  const key = hash([owner, submissionId]);
  const target = path.join(directory, `${key}.json`);
  const lockPath = path.join(directory, "execution.lock");
  function read() {
    try {
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) throw failure("journal_corrupt");
      const value = JSON.parse(fs.readFileSync(target, "utf8"));
      if (value.schema !== 1 || value.owner !== owner || value.submissionId !== submissionId) throw failure("journal_corrupt");
      return value;
    } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  function write(value) {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > 256 * 1024) throw failure("journal_capacity_exceeded");
    const temporary = `${target}.${randomUUID()}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temporary, "wx", 0o600);
      fs.writeFileSync(fd, serialized); fs.fsyncSync(fd);
      fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, target);
      const dir = fs.openSync(directory, "r");
      try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  async function locked(callback) {
    let fd;
    try { fd = fs.openSync(lockPath, "wx", 0o600); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      // A dead process is observable; an old timestamp alone is never a lease.
      let lock;
      try { lock = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch { throw failure("journal_lock_needs_review"); }
      if (!Number.isInteger(lock.pid) || lock.pid < 1) throw failure("journal_lock_needs_review");
      try { process.kill(lock.pid, 0); throw failure("understanding_busy"); }
      catch (check) { if (check.code !== "ESRCH") throw check; }
      // Do not unlink another recovery's replacement lock.
      const stale = fs.statSync(lockPath);
      if (lock.nonce !== JSON.parse(fs.readFileSync(lockPath, "utf8")).nonce) throw failure("understanding_busy");
      const recovery = `${lockPath}.${stale.ino}.recovery`;
      let recoveryFd;
      try { recoveryFd = fs.openSync(recovery, "wx", 0o600); }
      catch { throw failure("journal_lock_needs_review"); }
      try {
        const current = fs.statSync(lockPath);
        if (current.ino !== stale.ino) throw failure("understanding_busy");
        fs.unlinkSync(lockPath);
        fd = fs.openSync(lockPath, "wx", 0o600);
      } finally { fs.closeSync(recoveryFd); fs.unlinkSync(recovery); }
    }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, nonce: randomUUID() })); fs.fsyncSync(fd);
      return await callback();
    } finally { fs.closeSync(fd); fs.unlinkSync(lockPath); }
  }
  return { key, read, write, locked };
}
module.exports = { journal, hash, failure };
