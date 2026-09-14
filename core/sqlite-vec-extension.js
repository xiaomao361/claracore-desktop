const fs = require("fs");
const path = require("path");

const SQLITE_VEC_VERSION = "0.1.9";

function extensionFilename(platform = process.platform) {
  return `vec0.${platform === "win32" ? "dll" : platform === "darwin" ? "dylib" : "so"}`;
}

function sqliteVecExtensionPath() {
  const relative = path.join(`${process.platform}-${process.arch}`, extensionFilename());
  // A packaged runtime must never fall back to a development node_modules tree.
  const roots = process.resourcesPath
    ? [process.resourcesPath]
    : __dirname.includes(".asar")
      ? [path.resolve(__dirname, "..", "..")]
      : [path.resolve(__dirname, "..", "resources")];
  for (const root of roots) {
    const candidate = path.join(root, "sqlite-vec", relative);
    if (fs.existsSync(candidate)) return candidate;
  }
  if (!process.resourcesPath && !__dirname.includes(".asar")) {
    return require("sqlite-vec").getLoadablePath();
  }
  throw new Error(`sqlite-vec ${SQLITE_VEC_VERSION} resource missing for ${process.platform}-${process.arch}`);
}

module.exports = { SQLITE_VEC_VERSION, extensionFilename, sqliteVecExtensionPath };
