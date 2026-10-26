const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "site-dist");

async function buildWebsite() {
  const { version } = require("../package.json");
  const html = await fs.readFile(path.join(root, "website/index.html"), "utf8");
  const versions = [...html.matchAll(/(?:\/v|v)(\d+\.\d+\.\d+)/g)].map(match => match[1]);
  if (!versions.length || versions.some(value => value !== version)) {
    throw new Error(`Website release links and labels must match package version ${version}`);
  }
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

module.exports = { buildWebsite };
