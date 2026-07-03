const fs = require("fs");
const path = require("path");

function candidateResourceRoots() {
  const roots = [];
  if (process.resourcesPath) {
    roots.push(path.join(process.resourcesPath, "sqlite"));
  }
  if (__dirname.includes(".asar")) {
    // ELECTRON_RUN_AS_NODE has no process.resourcesPath; resolve the packaged
    // Resources directory relative to app.asar instead.
    roots.push(path.join(path.resolve(__dirname, "..", ".."), "sqlite"));
  }
  roots.push(path.resolve(__dirname, "..", "resources", "sqlite"));
  return roots;
}

function bundledSqlitePath(platform = process.platform, arch = process.arch) {
  const executable = platform === "win32" ? "sqlite3.exe" : "sqlite3";
  const relativePath = path.join(`${platform}-${arch}`, executable);
  for (const root of candidateResourceRoots()) {
    const candidate = path.join(root, relativePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  return "";
}

function sqliteCommand() {
  return bundledSqlitePath() || "sqlite3";
}

module.exports = {
  bundledSqlitePath,
  sqliteCommand
};
