const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { SQLITE_VEC_VERSION, extensionFilename } = require("../core/sqlite-vec-extension");

function stageSqliteVec(platform = process.platform, arch = process.arch, resourcesRoot = path.resolve(__dirname, "../resources")) {
  const packageName = `sqlite-vec-${platform === "win32" ? "windows" : platform}-${arch}`;
  const filename = extensionFilename(platform);
  const source = require.resolve(`${packageName}/${filename}`);
  const metadata = JSON.parse(fs.readFileSync(path.join(path.dirname(source), "package.json"), "utf8"));
  if (metadata.version !== SQLITE_VEC_VERSION) throw new Error(`Unexpected ${packageName} version: ${metadata.version}`);
  const destination = path.join(resourcesRoot, "sqlite-vec", `${platform}-${arch}`);
  fs.mkdirSync(destination, { recursive: true });
  const bytes = fs.readFileSync(source);
  fs.writeFileSync(path.join(destination, filename), bytes);
  const manifest = {
    package: packageName, version: SQLITE_VEC_VERSION, platform, arch, filename,
    // Signing may change the dylib bytes. This is the pre-signing provenance hash.
    sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
  fs.writeFileSync(path.join(destination, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

module.exports = async function beforePack(context) {
  const { Arch } = require("builder-util");
  stageSqliteVec(context.electronPlatformName, Arch[context.arch]);
};
module.exports.stageSqliteVec = stageSqliteVec;
if (require.main === module) console.log(JSON.stringify(stageSqliteVec(), null, 2));
