const assert = require("assert");
const {
  RELEASE_API_URL,
  RELEASE_PAGE_URL,
  checkForUpdates,
  compareVersions,
  isAllowedUpdateUrl
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

async function run() {
  assert.equal(compareVersions("0.5.5", "0.5.4"), 1);
  assert.equal(compareVersions("v0.5.4", "0.5.4"), 0);
  assert.equal(compareVersions("0.5.3", "0.5.4"), -1);
  assert.equal(compareVersions("latest", "0.5.4"), null);
  assert.equal(isAllowedUpdateUrl("https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.5.5"), true);
  assert.equal(isAllowedUpdateUrl("https://github.com/other/repo/releases/tag/v0.5.5"), false);
  assert.equal(isAllowedUpdateUrl("javascript:alert(1)"), false);

  let requestedUrl = null;
  const macResult = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async (url, options) => {
      requestedUrl = url;
      assert.equal(options.headers["User-Agent"], "ClaraCore-Desktop/0.5.4");
      return response(200, release("0.5.5"));
    }
  });
  assert.equal(requestedUrl, RELEASE_API_URL);
  assert.equal(macResult.status, "update-available");
  assert.equal(macResult.releaseUrl, "https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.5.5");
  assert.equal(macResult.assetUrl, null);

  const winResult = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "win32",
    arch: "x64",
    fetchImpl: async () => response(200, release("0.5.5"))
  });
  assert.equal(winResult.status, "update-available");
  assert.equal(winResult.releaseUrl, macResult.releaseUrl);

  const currentResult = await checkForUpdates({
    currentVersion: "0.5.5",
    platform: "darwin",
    arch: "arm64",
    fetchImpl: async () => response(200, release("0.5.5", []))
  });
  assert.equal(currentResult.status, "up-to-date");

  const noAssetsRequired = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "win32",
    arch: "x64",
    fetchImpl: async () => response(200, release("0.5.5"))
  });
  assert.equal(noAssetsRequired.status, "update-available");

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
  assert.equal(networkError.releaseUrl, RELEASE_PAGE_URL);

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

  const genericPlatform = await checkForUpdates({
    currentVersion: "0.5.4",
    platform: "linux",
    arch: "x64",
    fetchImpl: async () => response(200, release("0.5.5"))
  });
  assert.equal(genericPlatform.status, "update-available");

  console.log(JSON.stringify({ ok: true, releaseUrl: macResult.releaseUrl, genericPlatform: genericPlatform.platform }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
