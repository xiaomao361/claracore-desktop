const { spawn } = require("child_process");
const path = require("path");

const scriptPath = process.argv[2];

if (!scriptPath) {
  console.error("Usage: node core/tests/run-ui-smoke.js <smoke-test.js>");
  process.exit(2);
}

const appRoot = path.resolve(__dirname, "..", "..");
const nodePaths = [
  path.join(appRoot, "node_modules"),
  process.env.CLARACORE_PLAYWRIGHT_NODE_PATH || "",
  process.env.NODE_PATH || ""
].filter(Boolean);

const child = spawn(process.execPath, [path.resolve(appRoot, scriptPath)], {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_PATH: nodePaths.join(path.delimiter)
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
