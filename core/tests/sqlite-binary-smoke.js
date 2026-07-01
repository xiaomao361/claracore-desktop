const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { bundledSqlitePath } = require("../sqlite-binary");

const APP_ROOT = path.resolve(__dirname, "..", "..");
const EXPECTED_BINARIES = [
  {
    platform: "darwin",
    arch: "arm64",
    relativePath: "darwin-arm64/sqlite3",
    sha256: "125681bd38d9cf9e10d46b115efe34879a928736fa0b3f6db33133792d89b6e8",
    executable: true
  },
  {
    platform: "darwin",
    arch: "x64",
    relativePath: "darwin-x64/sqlite3",
    sha256: "534f6cb4f5259a7ea24b0548875252f696baf49df33553bb56b7381438952ca3",
    executable: true
  },
  {
    platform: "win32",
    arch: "arm64",
    relativePath: "win32-arm64/sqlite3.exe",
    sha256: "770182f8aa2e1784a018b2995fedabf7a1bae23ff48653f0adee3c6dc2e81d9d",
    executable: false
  },
  {
    platform: "win32",
    arch: "x64",
    relativePath: "win32-x64/sqlite3.exe",
    sha256: "0bf6020e303a1a49dd576bbe259f8c2a05db689408a2f1f968714f5cf63714af",
    executable: false
  }
];

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const verified = [];
  for (const binary of EXPECTED_BINARIES) {
    const filePath = path.join(APP_ROOT, "resources", "sqlite", binary.relativePath);
    assert(fs.existsSync(filePath), `Missing bundled sqlite binary: ${binary.relativePath}`);
    assert(sha256(filePath) === binary.sha256, `Bundled sqlite hash mismatch: ${binary.relativePath}`);
    if (binary.executable) {
      const mode = fs.statSync(filePath).mode;
      assert((mode & 0o111) !== 0, `Bundled sqlite is not executable: ${binary.relativePath}`);
    }
    assert(
      bundledSqlitePath(binary.platform, binary.arch) === filePath,
      `sqlite resolver did not find ${binary.relativePath}`
    );
    verified.push(binary.relativePath);
  }
  console.log(JSON.stringify({ ok: true, verified }, null, 2));
}

if (require.main === module) {
  main();
}
