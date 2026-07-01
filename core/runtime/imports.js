const { createProductArchiveRuntime } = require("./imports/product-archive");
const { createLegacyMemoriaRuntime } = require("./imports/legacy-memoria");
const { createLegacyContinuityRuntime } = require("./imports/legacy-continuity");
const { createLegacyInnerLifeRuntime } = require("./imports/legacy-innerlife");

function createImportRuntime(deps) {
  return {
    ...createProductArchiveRuntime(deps),
    ...createLegacyMemoriaRuntime(deps),
    ...createLegacyContinuityRuntime(deps),
    ...createLegacyInnerLifeRuntime(deps)
  };
}

module.exports = {
  createImportRuntime
};
