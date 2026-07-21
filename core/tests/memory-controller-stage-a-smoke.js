const assert = require("assert");
const fixtures = require("../memory-controller/fixtures/stage-a-prompts.json");
const { evaluateFixtures } = require("../memory-controller/evaluation");

const report = evaluateFixtures(fixtures, { iterations: 200 });

assert.equal(report.failures.length, 0, JSON.stringify(report.failures, null, 2));
assert.equal(report.matrix.falsePositive, 0, "Stage A fixture has false positives.");
assert.equal(report.matrix.falseNegative, 0, "Stage A fixture has false negatives.");
assert.ok(report.matrix.truePositive > 0 && report.matrix.trueNegative > 0, "Stage A fixture must include both classes.");
assert.ok(report.latencyMs.p95 < 20, `Stage A p95 exceeded 20 ms: ${report.latencyMs.p95}`);

console.log(JSON.stringify({
  suite: "memory-controller-stage-a-smoke",
  ...report
}, null, 2));
