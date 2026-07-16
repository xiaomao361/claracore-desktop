const packageMetadata = require("../package.json");

const base = packageMetadata.build;

module.exports = {
  ...base,
  npmRebuild: false,
  directories: {
    ...base.directories,
    output: "dist-lite"
  },
  files: [
    ...base.files,
    "!node_modules/**/*"
  ],
  extraResources: base.extraResources.filter((resource) => resource.to !== "models"),
  extraMetadata: {
    buildFlavor: "lite"
  },
  dmg: {
    ...base.dmg,
    artifactName: "ClaraCore-Desktop-${version}-lite-${arch}.${ext}"
  },
  nsis: {
    ...base.nsis,
    artifactName: "ClaraCore-Desktop-${version}-lite-${arch}-Setup.${ext}"
  }
};
