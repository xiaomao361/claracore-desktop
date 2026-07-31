const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { ProductDatabase } = require("../db/database");

const root = path.resolve(__dirname, "../..");
const aggregatorPath = path.join(root, "core/db/repositories/system.js");
const modules = {
  "agent-activity": ["getAgentActivitySummary"],
  "gateway-traces": [
    "cleanupGatewayTraces",
    "ensureGatewayTraceCompatibility",
    "getGatewayTrace",
    "listGatewayTraces",
    "recordGatewayTrace"
  ]
};

const owners = new Map();
for (const [moduleName, expectedMethods] of Object.entries(modules)) {
  const repositoryModule = require(`../db/repositories/system/${moduleName}`);
  const factories = Object.values(repositoryModule).filter((value) => typeof value === "function");
  assert.strictEqual(factories.length, 1, `${moduleName} must export exactly one repository factory.`);
  const methods = Object.keys(factories[0]({})).sort();
  assert.deepStrictEqual(methods, [...expectedMethods].sort(), `${moduleName} method ownership changed.`);
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
assert(aggregatorLines <= 650, `System repository aggregator grew to ${aggregatorLines} lines.`);
assert(
  aggregatorSource.includes("...createGatewayTraceRepository(helpers)") &&
    aggregatorSource.includes("...createAgentActivityRepository(helpers)"),
  "System repository must compose the extracted Trace modules."
);
for (const methodName of owners.keys()) {
  assert(
    !new RegExp(`async\\s+${methodName}\\s*\\(`).test(aggregatorSource),
    `${methodName} must not move back into the system repository aggregator.`
  );
}

console.log(JSON.stringify({
  suite: "system-repository-boundary-smoke",
  aggregatorLines,
  methodOwners: Object.fromEntries(owners)
}, null, 2));
