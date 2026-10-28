const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveSource, validatePublication, verifyCheckout } = require("./release-preflight");

const repository = "example/desktop";
const sourceSha = "a".repeat(40);
const otherSha = "b".repeat(40);
const version = "1.2.3";
const publishTag = "v1.2.3";
const calls = [];
function api(endpoint) {
  calls.push(endpoint);
  if (endpoint.includes("/commits/")) return { sha: sourceSha };
  if (endpoint.endsWith(`/releases/tags/${publishTag}`)) return { tag_name: publishTag, assets: [] };
  throw new Error(`Unexpected API request: ${endpoint}`);
}

assert.equal(resolveSource({ repository, sourceRef: "aaaaaaa" }, api), sourceSha);
assert.equal(calls[0], `repos/${repository}/commits/aaaaaaa`);
calls.length = 0;
assert.equal(resolveSource({ repository, sourceRef: "feature/release" }, api), sourceSha);
assert(calls[0].endsWith("/feature%2Frelease"));
calls.length = 0;
assert.equal(resolveSource({ repository, defaultSha: sourceSha }, api), sourceSha);
assert(calls[0].endsWith(sourceSha));
calls.length = 0;
assert.equal(resolveSource({ repository, publishTag, defaultSha: otherSha }, api), sourceSha);
assert(calls[0].endsWith(`refs%2Ftags%2F${publishTag}`), "Publishing resolves the actual tag, not a same-named branch or moving main");
assert.throws(() => resolveSource({ repository, sourceRef: "missing" }, () => { throw new Error("Not Found"); }), /Not Found/);
assert.throws(() => resolveSource({ repository, sourceRef: "bad" }, () => ({ sha: "aaaaaaa" })), /full commit SHA/);
const publication = { repository, sourceSha, version, publishTag };
assert.doesNotThrow(() => validatePublication(publication, api));
assert.throws(() => validatePublication({ ...publication, version: "1.2.4" }, api), /package version differ/);
assert.throws(() => validatePublication({ ...publication, publishTag: "main" }, api), /stable vX.Y.Z/);
assert.throws(() => validatePublication(publication, () => ({ sha: otherSha })), /different commits/);
assert.throws(() => validatePublication(publication, endpoint => {
  if (endpoint.includes("/commits/")) return { sha: sourceSha };
  throw new Error("Release unavailable");
}), /Release unavailable/);
assert.throws(() => validatePublication(publication, endpoint => endpoint.includes("/commits/")
  ? { sha: sourceSha } : { tag_name: publishTag }), /asset inventory is unavailable/);
assert.throws(() => validatePublication(publication, endpoint => endpoint.includes("/commits/")
  ? { sha: sourceSha } : { tag_name: publishTag, assets: [{ name: "SHA256SUMS-windows.txt" }] }), /Refusing to replace/);
assert.doesNotThrow(() => validatePublication(publication, endpoint => endpoint.includes("/commits/")
  ? { sha: sourceSha } : { tag_name: publishTag, assets: [{ name: "SHA256SUMS-macos.txt" }] }));
assert.throws(() => verifyCheckout({ ...publication, expectedSha: otherSha }, api), /resolved build source/);
assert.doesNotThrow(() => verifyCheckout({ ...publication, expectedSha: sourceSha }, api));
assert.doesNotThrow(() => verifyCheckout({ sourceSha, expectedSha: sourceSha }, () => { throw new Error("No publication requested"); }));
const failedCli = spawnSync(process.execPath, [path.join(__dirname, "release-preflight.js"), "verify"], {
  encoding: "utf8", timeout: 5000,
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, EXPECTED_SOURCE_SHA: "invalid", PUBLISH_TAG: "" }
});
assert.ifError(failedCli.error);
assert.equal(failedCli.status, 1, "A failed preflight must fail the CI step");
assert(!failedCli.stdout.includes('"verified":true'), "Failed verification must not emit a success receipt");
console.log(JSON.stringify({ suite: "release-preflight", fullShaResolution: true, tagSourceVersionMatch: true,
  missingRemoteFails: true, existingAssetsProtected: true, checkoutVerified: true, passed: true }));
