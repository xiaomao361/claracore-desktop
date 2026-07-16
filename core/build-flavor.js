const packageMetadata = require("../package.json");

const FULL_BUILD_FLAVOR = "full";
const LITE_BUILD_FLAVOR = "lite";

function normalizeBuildFlavor(value) {
  return String(value || "").trim().toLowerCase() === LITE_BUILD_FLAVOR
    ? LITE_BUILD_FLAVOR
    : FULL_BUILD_FLAVOR;
}

const packagedFlavor = normalizeBuildFlavor(packageMetadata.buildFlavor);
const BUILD_FLAVOR = packagedFlavor === LITE_BUILD_FLAVOR
  ? LITE_BUILD_FLAVOR
  : normalizeBuildFlavor(process.env.CLARACORE_DESKTOP_BUILD_FLAVOR);
const HAS_BUILT_IN_EMBEDDING = BUILD_FLAVOR === FULL_BUILD_FLAVOR;
const MEMORY_EMBEDDING_PROVIDERS = HAS_BUILT_IN_EMBEDDING
  ? ["claracore-built-in", "ollama", "disabled"]
  : ["ollama", "disabled"];

function buildFlavorInfo() {
  return {
    flavor: BUILD_FLAVOR,
    hasBuiltInEmbedding: HAS_BUILT_IN_EMBEDDING,
    memoryEmbeddingProviders: [...MEMORY_EMBEDDING_PROVIDERS]
  };
}

module.exports = {
  BUILD_FLAVOR,
  FULL_BUILD_FLAVOR,
  HAS_BUILT_IN_EMBEDDING,
  LITE_BUILD_FLAVOR,
  MEMORY_EMBEDDING_PROVIDERS,
  buildFlavorInfo,
  normalizeBuildFlavor
};
