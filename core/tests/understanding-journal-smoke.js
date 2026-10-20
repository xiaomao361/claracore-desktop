const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../gateway/understanding/journal.js"), "utf8");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "understanding-journal-sync-"));
try {
  for (const platform of ["win32", "darwin"]) {
    let files = 0, directories = 0, failFile = false, failDirectory = false;
    const simulatedFs = { ...fs, fsyncSync(fd) {
      if (fs.fstatSync(fd).isDirectory()) {
        directories++;
        if (platform === "win32" || failDirectory) throw Object.assign(new Error("directory sync failure"), { code: "EIO" });
      } else {
        files++;
        if (failFile) throw Object.assign(new Error("file sync failure"), { code: "EIO" });
        fs.fsyncSync(fd);
      }
    } };
    const module = { exports: {} };
    vm.runInNewContext(source, {
      module, Buffer, process: { platform },
      require: name => name === "node:fs" ? simulatedFs : require(name)
    });
    const store = module.exports.journal(path.join(root, platform), "fixture", "sync");
    const state = revision => ({ schema: 1, owner: "fixture", submissionId: "sync", revision });
    store.write(state(1));
    assert.equal(store.read().revision, 1);
    assert.equal(files, 1, "Every platform flushes the complete file before replacement");
    assert.equal(directories, platform === "win32" ? 0 : 1);
    failFile = true;
    assert.throws(() => store.write(state(2)), { code: "EIO" });
    assert.equal(store.read().revision, 1, "File flush failure preserves the previous checkpoint");
    assert.ok(!fs.readdirSync(path.join(root, platform, "gateway-understanding")).some(name => name.endsWith(".tmp")));
    if (platform !== "win32") {
      failFile = false; failDirectory = true;
      assert.throws(() => store.write(state(3)), { code: "EIO" }, "Supported directory sync failure must propagate");
      assert.equal(store.read().revision, 3, "A post-rename error retains readable recovery evidence");
    }
  }
  console.log("Understanding journal sync passed: Windows file flush, POSIX directory flush, visible I/O failures and recoverable checkpoints.");
} finally { fs.rmSync(root, { recursive: true, force: true }); }
