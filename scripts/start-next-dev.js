#!/usr/bin/env node

const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

const dataRoot =
  process.env.CLARACORE_DESKTOP_DATA_DIR ||
  path.join(os.homedir(), "Library", "Application Support", "claracore-desktop-next", "data");
const userDataRoot =
  process.env.CLARACORE_DESKTOP_USER_DATA_DIR ||
  path.dirname(dataRoot);

const child = spawn(
  path.join(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron"),
  ["."],
  {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    env: {
      ...process.env,
      CLARACORE_DESKTOP_DATA_DIR: dataRoot,
      CLARACORE_DESKTOP_USER_DATA_DIR: userDataRoot,
      CLARACORE_DESKTOP_TEST_INSTANCE: "1"
    }
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
