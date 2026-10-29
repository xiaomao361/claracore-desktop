const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function githubJson(endpoint) {
  return JSON.parse(execFileSync("gh", ["api", endpoint], {
    encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024
  }));
}

function checkRepository(repository) {
  assert(/^[\w.-]+\/[\w.-]+$/.test(repository || ""), "A GitHub owner/repository is required");
}

function checkSha(sha) {
  assert(/^[a-f0-9]{40}$/.test(sha || ""), "Source must resolve to a full commit SHA");
  return sha;
}

function windowsAssets(version) {
  return [
    `ClaraCore-Desktop-${version}-x64-Setup.exe`,
    `ClaraCore-Desktop-${version}-lite-x64-Setup.exe`,
    "SHA256SUMS-windows.txt"
  ];
}

// GitHub's tag endpoint omits drafts, even for authenticated callers.
// Only a real 404 permits the authenticated release-list fallback.
function readRelease(repository, tag, api) {
  try { return api(`repos/${repository}/releases/tags/${encodeURIComponent(tag)}`); }
  catch (error) {
    if (error.status !== 404 && !/HTTP 404|"status":\s*"?404/.test(String(error.message))) throw error;
    for (let page = 1; page <= 100; page += 1) {
      const releases = api(`repos/${repository}/releases?per_page=100&page=${page}`);
      assert(Array.isArray(releases), "Release inventory is unavailable");
      const release = releases.find(item => item.tag_name === tag);
      if (release) return release;
      if (releases.length < 100) throw new Error(`Existing GitHub Release is required: ${tag}`);
    }
    throw new Error("Release inventory exceeds the bounded lookup limit");
  }
}

function validatePublication({ repository, sourceSha, version, publishTag }, api = githubJson) {
  if (!publishTag) return;
  checkRepository(repository);
  checkSha(sourceSha);
  assert(/^v\d+\.\d+\.\d+$/.test(publishTag), "publish_tag must be a stable vX.Y.Z tag");
  assert.equal(publishTag, `v${version}`, "Release tag and checked-out package version differ");
  const target = api(`repos/${repository}/commits/${encodeURIComponent(`refs/tags/${publishTag}`)}`);
  assert.equal(checkSha(target.sha), sourceSha, "Release tag and build source point to different commits");
  const release = readRelease(repository, publishTag, api);
  assert.equal(release.tag_name, publishTag, "Existing GitHub Release is required");
  assert(Array.isArray(release.assets), "GitHub Release asset inventory is unavailable");
  const collisions = release.assets.filter(asset => windowsAssets(version).includes(asset.name));
  assert.equal(collisions.length, 0, `Refusing to replace existing release assets: ${collisions.map(asset => asset.name).join(", ")}`);
}

function resolveSource({ repository, sourceRef, defaultSha, publishTag }, api = githubJson) {
  checkRepository(repository);
  const ref = sourceRef || (publishTag ? `refs/tags/${publishTag}` : checkSha(defaultSha));
  const sourceSha = checkSha(api(`repos/${repository}/commits/${encodeURIComponent(ref)}`).sha);
  if (publishTag) {
    validatePublication({ repository, sourceSha, version: publishTag.slice(1), publishTag }, api);
  }
  return sourceSha;
}

function verifyCheckout({ sourceSha, expectedSha, version, publishTag, repository }, api = githubJson) {
  checkSha(sourceSha);
  checkSha(expectedSha);
  assert.equal(sourceSha, expectedSha, "Checked-out commit differs from the resolved build source");
  validatePublication({ repository, sourceSha, version, publishTag }, api);
}

function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const publishTag = process.env.PUBLISH_TAG || "";
  const mode = process.argv[2];
  if (mode === "resolve") {
    const sourceSha = resolveSource({ repository, publishTag,
      sourceRef: process.env.SOURCE_REF || "", defaultSha: process.env.DEFAULT_SOURCE_SHA });
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `source_sha=${sourceSha}\n`);
    console.log(JSON.stringify({ sourceSha, publishTag, resolved: true }));
  } else if (mode === "verify") {
    const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const { version } = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    verifyCheckout({ repository, publishTag, sourceSha, version, expectedSha: process.env.EXPECTED_SOURCE_SHA });
    console.log(JSON.stringify({ sourceSha, version, publishTag, verified: true }));
  } else {
    throw new Error("Usage: node scripts/release-preflight.js resolve|verify");
  }
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`Release preflight failed: ${error.message}`); process.exitCode = 1; }
}

module.exports = { resolveSource, validatePublication, verifyCheckout, windowsAssets };
