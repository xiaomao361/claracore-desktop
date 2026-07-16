const assert = require("assert");
const {
  RELEASE_API_URL,
  checkForUpdates,
  compareVersions,
  isAllowedUpdateUrl,
  releaseAssetName
} = require("../update/github-release-client");

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      if (body instanceof Error) throw body;
      return body;
    }
  };
}

function release(version, assets = []) {
  return {
    tag_name: `v${version}`,
    name: `ClaraCore Desktop ${version}`,
    html_url: `https://github.com/xiaomao361/claracore-desktop/releases/tag/v${version}`,
    published_at: "2026-07-16T12:00:00Z",
    draft: false,
    prerelease: false,
    assets
  };
}

function asset(name, version) {
  return {
    name,
    state: "uploaded",
    browser_download_url: `https://github.com/xiaomao361/claracore-desktop/releases/download/v${version}/${name}`
  };
}

async function run() {
  assert.equal(compareVersions("0.5.5", "0.5.4"), 1);
  assert.equal(compareVersions("v0.5.4", "0.5.4"), 0);
  assert.equal(compareVersions("0.5.3", "0.5.4"), -1);
  assert.equal(compareVersions("latest", "0.5.4"), null);
  assert.equal(releaseAssetName("0.5.5", "darwin", "arm64"), "ClaraCore-Desktop-0.5.5-arm64.dmg");
  assert.equal(releaseAssetName("0.5.5", "win32", "x64"), "ClaraCore-Desktop-0.5.5-x64-Setup.exe");
  assert.equal(releaseAssetName("0.5.5", "linux", "x64"), null);
  assert.equal(isAllowedUpdateUrl("https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.5.5"), true);
  assert.equal(isAllowedUpdateUrl("https://github.com/other/repo/releases/tag/v0.5.5"), false);
  assert.equal(isAllowedUpdateUrl("javascript:alert(1)"), false);

  let requestedUrl = null;
  const macName = releaseAssetName("0.5.5", "darwin", "arm64");
  const macResult = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      assert.equal(options.headers["User-Agent"], "ClaraCore-Desktop/0.5.4");
      return response(200, release("0.5.5", [asset(macName, "0.5.5")]));
    }
  });
  assert.equal(requestedUrl, RELEASE_API_URL);
  assert.equal(macResult.status, "update-available");
  assert.equal(macResult.assetName, macName);

  const winName = releaseAssetName("0.5.5", "win32", "x64");
  const winResult = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "win32",
    arch: "x64",
    fetchImpl: async () => response(200, release("0.5.5", [asset(winName, "0.5.5")]))
  });
  assert.equal(winResult.status, "update-available");
  assert.equal(winResult.assetName, winName);

  const currentResult = await checkForUpdates({
    currentVersion: "0.5.5",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async () => response(200, release("0.5.5", []))
  });
  assert.equal(currentResult.status, "up-to-date");

  const missingAsset = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "win32",
    arch: "x64",
    fetchImpl: async () => response(200, release("0.5.5", [asset(macName, "0.5.5")]))
  });
  assert.equal(missingAsset.status, "asset-unavailable");

  const noRelease = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async () => response(404, {})
  });
  assert.equal(noRelease.status, "no-release");

  const rateLimited = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async () => response(403, {})
  });
  assert.equal(rateLimited.status, "rate-limited");

  const invalidJson = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async () => response(200, new Error("invalid json"))
  });
  assert.equal(invalidJson.status, "invalid-response");

  const networkError = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async () => {
      throw new Error("offline");
    }
  });
  assert.equal(networkError.status, "network-error");

  const timeout = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "darwin",
    arch: "arm64",
    timeoutMs: 5,
    fetchImpl: (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })
  });
  assert.equal(timeout.status, "timeout");

  const unsupported = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "linux",
    arch: "x64",
    fetchImpl: async () => {
      throw new Error("must not fetch");
    }
  });
  assert.equal(unsupported.status, "unsupported-platform");

  console.log(JSON.stringify({ ok: true, mac: macResult.assetName, windows: winResult.assetName }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
