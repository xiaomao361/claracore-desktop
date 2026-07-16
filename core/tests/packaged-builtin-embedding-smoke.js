const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..", "..");

function packagePaths() {
  if (process.platform === "win32") {
    const resources = path.join(root, "dist", "win-unpacked", "resources");
    return {
      executable: path.join(root, "dist", "win-unpacked", "ClaraCore Desktop.exe"),
      resources
    };
  }
  if (process.platform === "darwin") {
    const bundle = path.join(root, "dist", `mac-${process.arch}`, "ClaraCore Desktop.app");
    return {
      executable: path.join(bundle, "Contents", "MacOS", "ClaraCore Desktop"),
      resources: path.join(bundle, "Contents", "Resources")
    };
  }
  throw new Error(`Packaged built-in embedding smoke does not support ${process.platform}.`);
}

function assertWindowsSharpRuntime(resources) {
  if (process.platform !== "win32") return;
  const releaseDir = path.join(resources, "app.asar.unpacked", "node_modules", "sharp", "build", "Release");
  const requiredFiles = [
    "sharp-win32-x64.node",
    "libvips-cpp.dll",
    "libvips-42.dll",
    "libglib-2.0-0.dll",
    "libgobject-2.0-0.dll"
  ];
  const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(releaseDir, file)));
  assert.deepStrictEqual(missing, [], `Packaged Windows sharp runtime is incomplete: ${missing.join(", ")}`);
}

function main() {
  const { executable, resources } = packagePaths();
  assert.ok(fs.existsSync(executable), `Packaged executable is missing: ${executable}`);
  assertWindowsSharpRuntime(resources);

  const smokeScript = path.join(resources, "app.asar", "core", "tests", "builtin-embedding-smoke.js");
  const result = spawnSync(executable, [smokeScript], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1"
    },
    timeout: 5 * 60 * 1000
  });
  if (result.error) throw result.error;
  assert.strictEqual(result.status, 0, `Packaged built-in embedding failed:\n${result.stderr || result.stdout}`);
  assert.match(result.stdout, /"dimensions"\s*:\s*512/, `Packaged embedding did not report 512 dimensions:\n${result.stdout}`);

  console.log(JSON.stringify({
    ok: true,
    platform: process.platform,
    arch: process.arch,
    executable,
    dimensions: 512
  }, null, 2));
}

main();
