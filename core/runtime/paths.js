const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");

const DESKTOP_SETTINGS_FILE = "desktop-settings.json";
let cachedDesktopSettings = null;

function desktopSettingsPath(app) {
  return path.join(app.getPath("userData"), DESKTOP_SETTINGS_FILE);
}

function readDesktopSettings(app, options = {}) {
  if (!options.fresh && cachedDesktopSettings) return cachedDesktopSettings;
  try {
    const raw = fsSync.readFileSync(desktopSettingsPath(app), "utf8");
    const parsed = JSON.parse(raw);
    const settings = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    if (!options.fresh) cachedDesktopSettings = settings;
    return settings;
  } catch (_error) {
    if (!options.fresh) cachedDesktopSettings = {};
    return {};
  }
}

function resolveDataRoot(app) {
  if (process.env.CLARACORE_DESKTOP_DATA_DIR) {
    return path.resolve(process.env.CLARACORE_DESKTOP_DATA_DIR);
  }
  const configuredDataRoot = String(readDesktopSettings(app).dataRoot || "").trim();
  if (configuredDataRoot) {
    return path.resolve(configuredDataRoot);
  }
  // Keep ClaraCore product data under one explicit child folder so Electron
  // userData cache files do not mix with the product database and exports.
  return path.join(app.getPath("userData"), "data");
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
  desktopSettingsPath,
  ensureProductDirectories,
  readDesktopSettings,
  resolveDataRoot,
  resolveProductPaths
};
