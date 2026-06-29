const packageJson = require("../package.json");

const PRODUCT_VERSION = packageJson.version;

function getProductVersion() {
  return PRODUCT_VERSION;
}

module.exports = {
  PRODUCT_VERSION,
  getProductVersion
};
