const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const packageMetadata = require("../package.json");

const projectRoot = path.resolve(__dirname, "..");
const defaultIdentity = "Developer ID Application: zhou wei (A5L4GGX82X)";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (process.platform !== "darwin") {
  fail("DMG signing and notarization require macOS.");
}

const flavor = process.argv[2];
if (!["full", "lite"].includes(flavor)) {
  fail("Usage: node scripts/notarize-dmg.js <full|lite>");
}

const arch = process.arch;
if (!["arm64", "x64"].includes(arch)) {
  fail(`Unsupported macOS architecture: ${arch}`);
}

const outputDirectory = flavor === "lite" ? "dist-lite" : "dist";
const flavorSegment = flavor === "lite" ? "-lite" : "";
const artifactName = `ClaraCore-Desktop-${packageMetadata.version}${flavorSegment}-${arch}.dmg`;
const artifactPath = path.join(projectRoot, outputDirectory, artifactName);
const keychainProfile = process.env.APPLE_KEYCHAIN_PROFILE || "claracore-notary";
const signingIdentity = process.env.CLARACORE_SIGNING_IDENTITY || defaultIdentity;

if (!fs.existsSync(artifactPath)) {
  fail(`DMG artifact not found: ${artifactPath}`);
}

run("codesign", ["--force", "--timestamp", "--sign", signingIdentity, artifactPath]);
run("codesign", ["--verify", "--verbose=2", artifactPath]);
run("xcrun", [
  "notarytool",
  "submit",
  artifactPath,
  "--keychain-profile",
  keychainProfile,
  "--wait"
]);
run("xcrun", ["stapler", "staple", artifactPath]);
run("xcrun", ["stapler", "validate", artifactPath]);
run("spctl", [
  "--assess",
  "--type",
  "open",
  "--context",
  "context:primary-signature",
  "--verbose=4",
  artifactPath
]);

console.log(JSON.stringify({
  ok: true,
  artifactPath,
  keychainProfile,
  signingIdentity
}, null, 2));
