const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { ProductDatabase } = require("../db/database");
const {
  composeRepositoryMethods,
  installRepositoryMethods,
  listInstalledRepositoryMethods
} = require("../db/repository-installer");

const root = path.resolve(__dirname, "../..");
const installed = listInstalledRepositoryMethods(ProductDatabase);
const installedNames = new Set(installed.map((entry) => entry.name));
const ownerCounts = {};

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(entryPath);
    return entry.isFile() && path.extname(entry.name) === ".js" ? [entryPath] : [];
  });
}

for (const entry of installed) {
  assert.strictEqual(
    typeof ProductDatabase.prototype[entry.name],
    "function",
    `${entry.owner}.${entry.name} must remain installed on ProductDatabase.prototype.`
  );
  ownerCounts[entry.owner] = (ownerCounts[entry.owner] || 0) + 1;
}

assert.strictEqual(installedNames.size, installed.length, "Installed repository method names must be globally unique.");
assert.deepStrictEqual(
  Object.keys(ownerCounts).sort(),
  ["continuity", "innerlife", "memoria", "memory-controller", "system"],
  "Every repository domain must install through the collision-safe installer."
);

class ProbeDatabase {
  baseMethod() {}
}

assert.throws(
  () => installRepositoryMethods(ProbeDatabase, "probe", { baseMethod() {} }),
  /baseMethod \(ProductDatabase\)/,
  "Repository methods must not overwrite ProductDatabase methods."
);
assert.throws(
  () => installRepositoryMethods(ProbeDatabase, "probe", { toString() {} }),
  /toString \(prototype chain\)/,
  "Repository methods must not shadow inherited prototype methods."
);

const composed = composeRepositoryMethods("probe", [
  ["left", { leftMethod() {} }],
  ["right", { rightMethod() {} }]
]);
installRepositoryMethods(ProbeDatabase, "probe", composed);
assert.throws(
  () => installRepositoryMethods(ProbeDatabase, "second", { leftMethod() {} }),
  /leftMethod \(probe\)/,
  "Repository domains must not overwrite one another."
);
assert.throws(
  () => composeRepositoryMethods("probe", [
    ["left", { duplicateMethod() {} }],
    ["right", { duplicateMethod() {} }]
  ]),
  /duplicateMethod is owned by both left and right/,
  "Repository method groups must reject collisions before installation."
);

const installerPath = path.join(root, "core/db/repository-installer.js");
const directPrototypeAssignments = listJavaScriptFiles(path.join(root, "core/db"))
  .filter((filePath) => filePath !== installerPath)
  .filter((filePath) => /\bProductDatabase\.prototype\b/.test(fs.readFileSync(filePath, "utf8")))
  .map((filePath) => path.relative(root, filePath));
assert.deepStrictEqual(
  directPrototypeAssignments,
  [],
  "Database modules must not bypass the collision-safe repository installer."
);

console.log(JSON.stringify({
  suite: "repository-composition-smoke",
  methodCount: installed.length,
  ownerCounts
}, null, 2));
