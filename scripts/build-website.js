const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "site-dist");

function validateWebsiteRelease(html, release) {
  const { version } = release;
  if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
    throw new Error("website/release.json must specify a stable release version");
  }
  const versions = [...html.matchAll(/(?:\/v|v)(\d+\.\d+\.\d+)/g)].map(match => match[1]);
  if (!versions.length || versions.some(value => value !== version)) {
    throw new Error(`Website release links and labels must match published version ${version}`);
  }
  const base = "https://github.com/xiaomao361/claracore-desktop/releases";
  const expected = [
    `ClaraCore-Desktop-${version}-arm64.dmg`,
    `ClaraCore-Desktop-${version}-x64-Setup.exe`,
    `ClaraCore-Desktop-${version}-lite-arm64.dmg`,
    `ClaraCore-Desktop-${version}-lite-x64-Setup.exe`
  ].map(name => `${base}/download/v${version}/${name}`).sort();
  const downloads = [...html.matchAll(/href="([^"]*\/releases\/download\/[^"]*)"/g)].map(match => match[1]).sort();
  if (JSON.stringify(downloads) !== JSON.stringify(expected) || !html.includes(`href="${base}/tag/v${version}"`)) {
    throw new Error(`Website must link all four installers and release notes for published version ${version}`);
  }
  return version;
}

async function buildWebsite() {
  const html = await fs.readFile(path.join(root, "website/index.html"), "utf8");
  const release = JSON.parse(await fs.readFile(path.join(root, "website/release.json"), "utf8"));
  const version = validateWebsiteRelease(html, release);
  // Only replace generated output owned by this build, never source or user data.
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(path.join(output, "assets"), { recursive: true });
  for (const file of ["index.html", "styles.css", "site.js"]) {
    await fs.copyFile(path.join(root, "website", file), path.join(output, file));
  }
  for (const [source, name] of [
    ["website/assets/continuity-art.webp", "continuity-art.webp"],
    ["assets/brand/claracore-mark-flat.svg", "claracore-mark-flat.svg"],
    ["assets/brand/claracore-symbol-mono.svg", "claracore-symbol-mono.svg"],
    ["docs/images/how-it-works.svg", "how-it-works.svg"]
  ]) {
    await fs.copyFile(path.join(root, source), path.join(output, "assets", name));
  }
  await fs.writeFile(path.join(output, ".nojekyll"), "");
  console.log(`Built static website for v${version}: site-dist/`);
}

if (require.main === module) {
  buildWebsite().catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { buildWebsite, validateWebsiteRelease };
