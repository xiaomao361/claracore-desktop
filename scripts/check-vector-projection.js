const { spawnSync } = require("child_process");
const path = require("path");

for (const disabled of ["0", "1"]) {
  for (const test of ["vector-projection-smoke.js", "memory-search-boundaries-smoke.js"]) {
    const child = spawnSync(process.execPath, [path.resolve(__dirname, "../core/tests", test)], {
      stdio: "inherit", timeout: process.platform === "win32" ? 180000 : 60000,
      env: { ...process.env, CLARACORE_DESKTOP_DISABLE_NODE_SQLITE: disabled, CLARACORE_DESKTOP_VECTOR_ENGINE: "sqlite-vec" }
    });
    if (child.error) throw child.error;
    if (child.status !== 0) process.exit(child.status || 1);
  }
}
