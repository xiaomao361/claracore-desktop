const assert = require("assert/strict");
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");

const appRoot = process.argv[2];
assert(appRoot && path.isAbsolute(appRoot), "Pass the absolute path to the .app or Windows unpacked directory");
const mac = process.platform === "darwin";
const executable = mac ? path.join(appRoot, "Contents/MacOS/ClaraCore Desktop") : path.join(appRoot, "ClaraCore Desktop.exe");
const resources = mac ? path.join(appRoot, "Contents/Resources") : path.join(appRoot, "resources");
const probe = path.join(resources, "app.asar/core/tests/sqlite-vec-packaged-probe.js");
assert(fs.existsSync(executable), "Packaged executable missing");
for (const disabled of ["0", "1"]) {
  const child = spawnSync(executable, [probe], {
    encoding: "utf8", timeout: 60000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", CLARACORE_DESKTOP_DISABLE_NODE_SQLITE: disabled }
  });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, child.stderr || child.stdout);
  const result = JSON.parse(child.stdout);
  assert.equal(result.engine, disabled === "1" ? "cli" : "node");
  console.log(JSON.stringify(result));
}
