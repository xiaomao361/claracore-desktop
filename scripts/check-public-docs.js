const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const entries = ["README.md", "README.zh-CN.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "docs", "website/README.md", "assets/README.md", "app/README.md", "core"];

function collect(entry) {
  const absolute = path.join(root, entry);
  if (fs.statSync(absolute).isFile()) return entry.endsWith(".md") ? [entry] : [];
  return fs.readdirSync(absolute).flatMap(name => collect(path.join(entry, name)));
}

function checkPublicDocs() {
  const files = entries.flatMap(collect);
  let links = 0;
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    assert(!/\/(?:Users|Volumes)\//.test(source), `Personal machine path in ${file}`);
    const targets = [
      ...[...source.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1]),
      ...[...source.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1])
    ];
    for (const raw of targets) {
      const target = raw.replace(/^<|>$/g, "");
      if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(target)) continue;
      const relative = decodeURIComponent(target.split(/[?#]/)[0]);
      if (!relative) continue;
      const absolute = path.resolve(root, path.dirname(file), relative);
      assert(absolute.startsWith(`${root}${path.sep}`), `Link escapes repository in ${file}: ${target}`);
      assert(fs.existsSync(absolute), `Broken link in ${file}: ${target}`);
      links += 1;
    }
  }
  console.log(JSON.stringify({ suite: "public-docs", files: files.length, localLinks: links }));
}

if (require.main === module) checkPublicDocs();
module.exports = { checkPublicDocs };
