const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const asar = require("@electron/asar");

const root = path.resolve(__dirname, "..");
const platformArg = process.argv.includes("--platform")
  ? process.argv[process.argv.indexOf("--platform") + 1]
  : "darwin";
const windows = platformArg === "win32";
const fullApp = windows
  ? path.join(root, "dist", "win-unpacked")
  : path.join(root, "dist", "mac-arm64", "ClaraCore Desktop.app");
const liteApp = windows
  ? path.join(root, "dist-lite", "win-unpacked")
  : path.join(root, "dist-lite", "mac-arm64", "ClaraCore Desktop.app");

function resourcesPath(appPath) {
  return windows
    ? path.join(appPath, "resources")
    : path.join(appPath, "Contents", "Resources");
}

function installedKilobytes(appPath) {
  return Number.parseInt(execFileSync("du", ["-sk", appPath], { encoding: "utf8" }).trim().split(/\s+/)[0], 10);
}

function asarEntries(appPath) {
  return asar.listPackage(path.join(resourcesPath(appPath), "app.asar"));
}

function packagedMetadata(appPath) {
  const content = asar.extractFile(path.join(resourcesPath(appPath), "app.asar"), "package.json");
  return JSON.parse(content.toString("utf8"));
}

assert(fs.existsSync(fullApp), `Full package is missing: ${fullApp}`);
assert(fs.existsSync(liteApp), `Lite package is missing: ${liteApp}`);

const fullEntries = asarEntries(fullApp).map((entry) => entry.replaceAll("\\", "/"));
const liteEntries = asarEntries(liteApp).map((entry) => entry.replaceAll("\\", "/"));
const fullResources = resourcesPath(fullApp);
const liteResources = resourcesPath(liteApp);
const forbidden = ["@xenova", "onnxruntime", "/sharp/", "/node_modules/"];

assert(fullEntries.some((entry) => entry.includes("/node_modules/@xenova/transformers")), "Full package lost the built-in embedding runtime.");
assert(fs.existsSync(path.join(fullResources, "models")), "Full package lost the built-in model resources.");
assert(!fs.existsSync(path.join(liteResources, "models")), "Lite package still contains built-in model resources.");
assert(!fs.existsSync(path.join(liteResources, "app.asar.unpacked")), "Lite package still contains unpacked production dependencies.");
for (const marker of forbidden) {
  assert(!liteEntries.some((entry) => entry.toLowerCase().includes(marker)), `Lite ASAR still contains ${marker}.`);
}

const metadata = packagedMetadata(liteApp);
assert.equal(metadata.buildFlavor, "lite");

const fullKb = installedKilobytes(fullApp);
const liteKb = installedKilobytes(liteApp);
const savedKb = fullKb - liteKb;
const maxLiteMiB = windows ? 420 : 330;
const minSavedMiB = windows ? 220 : 180;
assert(liteKb <= maxLiteMiB * 1024, `Lite app exceeds ${maxLiteMiB} MiB: ${(liteKb / 1024).toFixed(1)} MiB`);
assert(savedKb >= minSavedMiB * 1024, `Lite app saves less than ${minSavedMiB} MiB: ${(savedKb / 1024).toFixed(1)} MiB`);

console.log(JSON.stringify({
  ok: true,
  platform: platformArg,
  fullMiB: Number((fullKb / 1024).toFixed(1)),
  liteMiB: Number((liteKb / 1024).toFixed(1)),
  savedMiB: Number((savedKb / 1024).toFixed(1)),
  buildFlavor: metadata.buildFlavor,
  liteAsarEntries: liteEntries.length
}, null, 2));
