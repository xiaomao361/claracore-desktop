const lite = require("./lite-builder-config");

// Local installation checkpoint; product version comes from package.json.
module.exports = {
  ...lite,
  directories: { ...lite.directories, output: "out/understanding-lite-20261015.4" },
  extraMetadata: { ...lite.extraMetadata, localBuildId: "understanding-20261015.4" },
  mac: { ...lite.mac, identity: "-", hardenedRuntime: true, notarize: false,
    entitlements: "resources/entitlements.mac.plist", entitlementsInherit: "resources/entitlements.mac.inherit.plist" },
  dmg: { ...lite.dmg, artifactName: "ClaraCore-Desktop-${version}-understanding-20261015.4-lite-${arch}.${ext}" }
};
