const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { ProductDatabase } = require("../db/database");

const root = path.resolve(__dirname, "../..");
const aggregatorPath = path.join(root, "core/db/repositories/innerlife.js");
const factoryModules = [
  "daemon",
  "digests",
  "history",
  "inbox",
  "profile",
  "read-models",
  "reflection",
  "retention",
  "sessions",
  "shares",
  "source-inbox"
];

const owners = new Map();
const methodCounts = {};

for (const moduleName of factoryModules) {
  const repositoryModule = require(`../db/repositories/innerlife/${moduleName}`);
  const factories = Object.values(repositoryModule).filter((value) => typeof value === "function");
  assert.strictEqual(factories.length, 1, `${moduleName} must export exactly one repository factory.`);
  const methods = Object.keys(factories[0]({}));
  assert(methods.length > 0, `${moduleName} must own at least one repository method.`);
  methodCounts[moduleName] = methods.length;
  for (const methodName of methods) {
    assert(!owners.has(methodName), `${methodName} is owned by both ${owners.get(methodName)} and ${moduleName}.`);
    owners.set(methodName, moduleName);
    assert.strictEqual(
      typeof ProductDatabase.prototype[methodName],
      "function",
      `${methodName} must remain installed on ProductDatabase.prototype.`
    );
  }
}

const aggregatorSource = fs.readFileSync(aggregatorPath, "utf8");
const aggregatorLines = aggregatorSource.trimEnd().split("\n").length;
assert(aggregatorLines <= 80, `InnerLife repository aggregator grew to ${aggregatorLines} lines.`);
assert(!/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/.test(aggregatorSource), "InnerLife repository aggregator must not own SQL.");
assert(!/\bthis\.(?:query|exec)\b/.test(aggregatorSource), "InnerLife repository aggregator must only compose focused modules.");

console.log(JSON.stringify({
  suite: "innerlife-repository-boundary-smoke",
  aggregatorLines,
  methodCount: owners.size,
  methodCounts
}, null, 2));
