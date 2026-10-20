const lite = require("./lite-builder-config");

// Local GUI preview. Keep the product/Agent Guide version aligned with source;
// the build ID distinguishes this installer from the daily-use 0.9.2 package.
module.exports = {
  ...lite,
  directories: { ...lite.directories, output: "out/gui-lite-20261019.4" },
  extraMetadata: { ...lite.extraMetadata, localBuildId: "gui-20261019.4" },
  mac: {
    ...lite.mac,
    identity: "-",
    hardenedRuntime: true,
    notarize: false,
    entitlements: "resources/entitlements.mac.plist",
    entitlementsInherit: "resources/entitlements.mac.inherit.plist"
  },
  dmg: { ...lite.dmg, artifactName: "ClaraCore-Desktop-${version}-gui-20261019.4-lite-${arch}.${ext}" }
};
