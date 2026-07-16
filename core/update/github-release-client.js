const RELEASE_API_URL = "https://api.github.com/repos/xiaomao361/claracore-desktop/releases/latest";
const RELEASE_PATH_PREFIX = "/xiaomao361/claracore-desktop/releases/";
const DEFAULT_TIMEOUT_MS = 8000;

function parseVersion(value) {
  const match = String(value || "").trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
}

function releaseAssetName(version, platform, arch) {
  if (platform === "darwin" && arch === "arm64") {
    return `ClaraCore-Desktop-${version}-arm64.dmg`;
  }
  if (platform === "win32" && arch === "x64") {
    return `ClaraCore-Desktop-${version}-x64-Setup.exe`;
  }
  return null;
}

function isAllowedUpdateUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "github.com" && url.pathname.startsWith(RELEASE_PATH_PREFIX);
  } catch (_error) {
    return false;
  }
}

function result(status, currentVersion, platform, arch, details = {}) {
  return {
    status,
    currentVersion,
    platform,
    arch,
    latestVersion: null,
    releaseName: null,
    releaseUrl: null,
    publishedAt: null,
    assetName: null,
    assetUrl: null,
    ...details
  };
}

async function checkForUpdates({
  currentVersion,
  platform = process.platform,
  arch = process.arch,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  const currentParts = parseVersion(currentVersion);
  if (!currentParts) return result("invalid-current-version", currentVersion, platform, arch);
  if (!releaseAssetName(currentVersion, platform, arch)) {
    return result("unsupported-platform", currentVersion, platform, arch);
  }
  if (typeof fetchImpl !== "function") {
    return result("network-error", currentVersion, platform, arch, { errorCode: "fetch-unavailable" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  let response;
  try {
    response = await fetchImpl(RELEASE_API_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": `ClaraCore-Desktop/${currentVersion}`
      },
      signal: controller.signal
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError" || controller.signal.aborted;
    return result(timedOut ? "timeout" : "network-error", currentVersion, platform, arch, {
      errorCode: timedOut ? "timeout" : "request-failed"
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 404) return result("no-release", currentVersion, platform, arch);
  if (response.status === 403 || response.status === 429) {
    return result("rate-limited", currentVersion, platform, arch);
  }
  if (!response.ok) {
    return result("network-error", currentVersion, platform, arch, { httpStatus: response.status });
  }

  let release;
  try {
    release = await response.json();
  } catch (_error) {
    return result("invalid-response", currentVersion, platform, arch);
  }

  if (!release || typeof release !== "object" || Array.isArray(release)) {
    return result("invalid-response", currentVersion, platform, arch);
  }
  const latestParts = parseVersion(release.tag_name);
  const latestVersion = latestParts ? latestParts.join(".") : null;
  const comparison = latestVersion ? compareVersions(latestVersion, currentVersion) : null;
  if (
    !latestVersion ||
    comparison === null ||
    release.draft === true ||
    release.prerelease === true ||
    !isAllowedUpdateUrl(release.html_url) ||
    typeof release.published_at !== "string" ||
    !Array.isArray(release.assets)
  ) {
    return result("invalid-response", currentVersion, platform, arch);
  }

  const releaseDetails = {
    latestVersion,
    releaseName: typeof release.name === "string" && release.name.trim() ? release.name.trim() : release.tag_name,
    releaseUrl: release.html_url,
    publishedAt: release.published_at
  };
  if (comparison <= 0) return result("up-to-date", currentVersion, platform, arch, releaseDetails);

  const expectedAssetName = releaseAssetName(latestVersion, platform, arch);
  const asset = release.assets.find(
    (candidate) =>
      candidate &&
      candidate.name === expectedAssetName &&
      candidate.state === "uploaded" &&
      isAllowedUpdateUrl(candidate.browser_download_url)
  );
  if (!asset) {
    return result("asset-unavailable", currentVersion, platform, arch, {
      ...releaseDetails,
      assetName: expectedAssetName
    });
  }

  return result("update-available", currentVersion, platform, arch, {
    ...releaseDetails,
    assetName: asset.name,
    assetUrl: asset.browser_download_url
  });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  RELEASE_API_URL,
  checkForUpdates,
  compareVersions,
  isAllowedUpdateUrl,
  parseVersion,
  releaseAssetName
};
