const fs = require("node:fs/promises");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const { KnowledgeLibraryError, inspectKnowledgeRoot } = require("./library");

const SETTINGS_FILE = "knowledge-root.json";

function settingsPath(app) {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

async function getKnowledgeRootPreference(app) {
  let settings;
  try {
    settings = JSON.parse(await fs.readFile(settingsPath(app), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { root: "", status: "not_selected" };
    if (error instanceof SyntaxError) throw new KnowledgeLibraryError("config_corrupt", "Knowledge root setting is invalid JSON.");
    throw error;
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings) || typeof settings.root !== "string") {
    throw new KnowledgeLibraryError("config_corrupt", "Knowledge root setting has an invalid shape.");
  }
  if (!settings.root) return { root: "", status: "not_selected" };
  try {
    return inspectKnowledgeRoot(settings.root);
  } catch (error) {
    if (!(error instanceof KnowledgeLibraryError)) throw error;
    return { root: settings.root, status: error.code, message: error.message };
  }
}

async function saveKnowledgeRootPreference(app, root) {
  if (typeof root !== "string" || (root && !path.isAbsolute(root))) {
    throw new KnowledgeLibraryError("invalid_root", "Choose an absolute knowledge directory.");
  }
  if (root) inspectKnowledgeRoot(root);
  const target = settingsPath(app);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify({ root }, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return getKnowledgeRootPreference(app);
}

module.exports = { getKnowledgeRootPreference, saveKnowledgeRootPreference };
