const liteConfig = require("./lite-builder-config");

const defaultIdentity = "zhou wei (A5L4GGX82X)";
const signingIdentity = String(process.env.CSC_NAME || defaultIdentity)
  .replace(/^Developer ID Application:\s*/, "");

module.exports = {
  ...liteConfig,
  forceCodeSigning: true,
  mac: {
    ...liteConfig.mac,
    identity: signingIdentity,
    hardenedRuntime: true,
    entitlements: "resources/entitlements.mac.plist",
    entitlementsInherit: "resources/entitlements.mac.inherit.plist",
    notarize: true
  }
};
