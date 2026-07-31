const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { ProductDatabase } = require("../db/database");

const root = path.resolve(__dirname, "../..");
const aggregatorPath = path.join(root, "core/db/repositories/continuity.js");
const modules = {
  agents: [
    "deleteContinuityModelAdjustment",
    "ensureContinuityAgentState",
    "getContinuityAgentState",
    "getContinuityModelAdjustment",
    "listContinuityAgentStates",
    "listContinuityModelAdjustments",
    "setContinuityModelAdjustment",
    "updateContinuityAgentState"
  ],
  lines: [
    "archiveContinuityLine",
    "createContinuityLine",
    "ensureContinuityLineForAgent",
    "ensureDefaultContinuityLine",
    "findContinuityLineIdForAgent",
    "getActiveContinuityLineId",
    "getActiveContinuityLineIdReadOnly",
    "getContinuityLine",
    "listContinuityLines",
    "renameContinuityLine",
    "resolveContinuityLineId",
    "resolveContinuityLineIdReadOnly",
    "restoreContinuityLine",
    "setActiveContinuityLine"
  ]
};

const owners = new Map();
for (const [moduleName, expectedMethods] of Object.entries(modules)) {
  const repositoryModule = require(`../db/repositories/continuity/${moduleName}`);
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
assert(aggregatorLines <= 650, `Continuity repository aggregator grew to ${aggregatorLines} lines.`);
assert(
  aggregatorSource.includes("...createContinuityAgentRepository(helpers)") &&
    aggregatorSource.includes("...createContinuityLineRepository(helpers)"),
  "Continuity repository must compose the extracted modules."
);
for (const methodName of owners.keys()) {
  assert(
    !new RegExp(`async\\s+${methodName}\\s*\\(`).test(aggregatorSource),
    `${methodName} must not move back into the Continuity repository aggregator.`
  );
}

console.log(JSON.stringify({
  suite: "continuity-repository-boundary-smoke",
  aggregatorLines,
  methodCounts: Object.fromEntries(
    Object.entries(modules).map(([moduleName, methods]) => [moduleName, methods.length])
  ),
  methodCount: owners.size
}, null, 2));
