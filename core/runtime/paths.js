const path = require("path");
const fs = require("fs/promises");

function resolveDataRoot(app) {
  if (process.env.CLARACORE_DESKTOP_DATA_DIR) {
    return path.resolve(process.env.CLARACORE_DESKTOP_DATA_DIR);
  }
  return path.join(app.getPath("userData"), "product-dev");
}

function resolveProductPaths(app) {
  const dataRoot = resolveDataRoot(app);
  const appRoot = path.resolve(__dirname, "..", "..");
  return {
    appRoot,
    dataRoot,
    databasePath: path.join(dataRoot, "claracore.db"),
    backupsDir: path.join(dataRoot, "backups"),
    exportsDir: path.join(dataRoot, "exports"),
    runtimeDir: path.join(dataRoot, "runtime"),
    logsDir: path.join(dataRoot, "logs")
  };
}

async function ensureProductDirectories(app) {
  const paths = resolveProductPaths(app);
  await Promise.all([
    fs.mkdir(paths.dataRoot, { recursive: true }),
    fs.mkdir(paths.backupsDir, { recursive: true }),
    fs.mkdir(paths.exportsDir, { recursive: true }),
    fs.mkdir(paths.runtimeDir, { recursive: true }),
    fs.mkdir(paths.logsDir, { recursive: true })
  ]);
  return paths;
}

module.exports = {
  ensureProductDirectories,
  resolveDataRoot,
  resolveProductPaths
};
