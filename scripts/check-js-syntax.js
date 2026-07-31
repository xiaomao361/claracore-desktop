const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const appRoot = path.resolve(__dirname, "..");
const sourceEntries = ["app.js", "app", "core", "electron", "scripts"];
const sourceExtensions = new Set([".js", ".cjs", ".mjs"]);
const ignoredDirectories = new Set(["node_modules", "dist", "dist-lite"]);

async function collectJavaScriptFiles(root = appRoot) {
  const files = [];

  async function visit(targetPath) {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
        await visit(path.join(targetPath, entry.name));
      }
      return;
    }
    if (sourceExtensions.has(path.extname(targetPath))) files.push(targetPath);
  }

  for (const entry of sourceEntries) {
    await visit(path.join(root, entry));
  }
  return files.sort();
}

function checkJavaScriptFile(filePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--check", filePath], {
      cwd: appRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ filePath, error, stdout, stderr });
    });
    child.on("close", (code, signal) => {
      resolve({ filePath, code, signal, stdout, stderr });
    });
  });
}

async function checkJavaScriptSyntax(files, requestedWorkers = 0) {
  const availableWorkers = typeof os.availableParallelism === "function"
    ? os.availableParallelism()
    : os.cpus().length;
  const workerCount = Math.max(
    1,
    Math.min(Number.parseInt(String(requestedWorkers || 0), 10) || availableWorkers, 8, files.length)
  );
  const failures = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const filePath = files[nextIndex];
      nextIndex += 1;
      const result = await checkJavaScriptFile(filePath);
      if (result.error || result.code !== 0 || result.signal) failures.push(result);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return { failures, workerCount };
}

async function main() {
  const startedAt = Date.now();
  const files = await collectJavaScriptFiles();
  const { failures, workerCount } = await checkJavaScriptSyntax(
    files,
    process.env.CLARACORE_SYNTAX_CHECK_WORKERS
  );

  if (failures.length) {
    for (const failure of failures.sort((left, right) => left.filePath.localeCompare(right.filePath))) {
      const relativePath = path.relative(appRoot, failure.filePath);
      console.error(`JavaScript syntax check failed: ${relativePath}`);
      if (failure.error) console.error(failure.error);
      if (failure.stdout) process.stderr.write(failure.stdout);
      if (failure.stderr) process.stderr.write(failure.stderr);
      if (failure.signal) console.error(`Terminated by signal ${failure.signal}.`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    suite: "javascript-syntax-check",
    fileCount: files.length,
    workerCount,
    durationMs: Date.now() - startedAt
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  checkJavaScriptSyntax,
  collectJavaScriptFiles
};
