const packageMetadata = require("../package.json");

const defaultIdentity = "zhou wei (A5L4GGX82X)";
const signingIdentity = String(process.env.CSC_NAME || defaultIdentity)
  .replace(/^Developer ID Application:\s*/, "");

module.exports = {
  ...packageMetadata.build,
  forceCodeSigning: true,
  mac: {
    ...packageMetadata.build.mac,
    identity: signingIdentity,
    hardenedRuntime: true,
    entitlements: "resources/entitlements.mac.plist",
    entitlementsInherit: "resources/entitlements.mac.inherit.plist",
    notarize: true
  }
};
