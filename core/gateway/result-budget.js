const DEFAULT_GATEWAY_RESULT_MAX_BYTES = 128 * 1024;

function serializeGatewayResult(value, maxBytes = DEFAULT_GATEWAY_RESULT_MAX_BYTES) {
  const serialized = JSON.stringify(value, null, 2);
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes <= maxBytes) return serialized;
  return JSON.stringify({
    error: "response_too_large",
    code: "GATEWAY_RESPONSE_TOO_LARGE",
    bytes,
    maxBytes,
    message: "The requested result exceeds the Gateway response budget. Narrow the catalog, select one object, or request a paged/artifact result."
  }, null, 2);
}

module.exports = {
  DEFAULT_GATEWAY_RESULT_MAX_BYTES,
  serializeGatewayResult
};
