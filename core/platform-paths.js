const os = require("os");
const path = require("path");

const PRODUCT_USER_DATA_DIR = "ClaraCore Desktop";

function defaultUserDataPath(platform = process.platform, env = process.env) {
  if (platform === "win32") {
    return path.join(env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), PRODUCT_USER_DATA_DIR);
  }
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", PRODUCT_USER_DATA_DIR);
  }
  return path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), PRODUCT_USER_DATA_DIR);
}

module.exports = {
  defaultUserDataPath
};
