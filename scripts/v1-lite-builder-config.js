const lite = require("./lite-builder-config");

// Local 1.0.0 installer for user review; publication uses the signed release recipe.
module.exports = {
  ...lite,
  directories: { ...lite.directories, output: "out/v1.0.0-lite" },
  extraMetadata: { ...lite.extraMetadata, localBuildId: "v1.0.0-20261019.1" },
  mac: {
    ...lite.mac,
    identity: "-",
    hardenedRuntime: true,
    notarize: false,
    entitlements: "resources/entitlements.mac.plist",
    entitlementsInherit: "resources/entitlements.mac.inherit.plist"
  }
};
