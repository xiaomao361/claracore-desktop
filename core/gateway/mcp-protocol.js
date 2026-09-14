const LEGACY_PROTOCOL_VERSION = "2025-06-18";
const MODERN_PROTOCOL_VERSION = "2026-07-28";
const SUPPORTED_PROTOCOL_VERSIONS = Object.freeze([
  MODERN_PROTOCOL_VERSION,
  LEGACY_PROTOCOL_VERSION
]);

const PROTOCOL_ERAS = Object.freeze({
  LEGACY: "legacy",
  MODERN: "modern"
});

const PROTOCOL_ERROR_CODES = Object.freeze({
  INVALID_PARAMS: -32602,
  METHOD_NOT_FOUND: -32601,
  HEADER_MISMATCH: -32020,
  MISSING_REQUIRED_CLIENT_CAPABILITY: -32021,
  UNSUPPORTED_PROTOCOL_VERSION: -32022
});

const DEFAULT_CACHE_TTL_MS = 0; // Catalog depends on Agent/profile/language; do not allow stale cross-context reuse.
const DEFAULT_CACHE_SCOPE = "private";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

class McpProtocolError extends Error {
  constructor(message, { code, data, httpStatus = 400 } = {}) {
    super(message);
    this.name = "McpProtocolError";
    this.code = code;
    this.data = data;
    this.httpStatus = httpStatus;
  }
}

function invalidParams(message) {
  return new McpProtocolError(message, {
    code: PROTOCOL_ERROR_CODES.INVALID_PARAMS
  });
}

function headerMismatch(message) {
  return new McpProtocolError(message, {
    code: PROTOCOL_ERROR_CODES.HEADER_MISMATCH
  });
}

function unsupportedProtocolVersion(requested) {
  return new McpProtocolError("Unsupported protocol version", {
    code: PROTOCOL_ERROR_CODES.UNSUPPORTED_PROTOCOL_VERSION,
    data: {
      supported: [...SUPPORTED_PROTOCOL_VERSIONS],
      requested: String(requested || "")
    }
  });
}

function methodNotFound(method) {
  return new McpProtocolError(`Method not found: ${String(method || "")}`, {
    code: PROTOCOL_ERROR_CODES.METHOD_NOT_FOUND,
    httpStatus: 404
  });
}

function detectProtocolEra(message) {
  if (message?.method === "initialize") return PROTOCOL_ERAS.LEGACY;
  const meta = message?.params?._meta;
  if (
    isRecord(meta) &&
    (
      Object.hasOwn(meta, "io.modelcontextprotocol/protocolVersion") ||
      Object.hasOwn(meta, "io.modelcontextprotocol/clientCapabilities") ||
      Object.hasOwn(meta, "io.modelcontextprotocol/clientInfo")
    )
  ) {
    return PROTOCOL_ERAS.MODERN;
  }
  return PROTOCOL_ERAS.LEGACY;
}

function validateModernRequest(message) {
  if (!isRecord(message?.params)) {
    throw invalidParams("Modern MCP requests require an object params field.");
  }
  const meta = message.params._meta;
  if (!isRecord(meta)) {
    throw invalidParams("Modern MCP requests require params._meta.");
  }

  const protocolVersion = meta["io.modelcontextprotocol/protocolVersion"];
  if (typeof protocolVersion !== "string" || !protocolVersion.trim()) {
    throw invalidParams("Modern MCP requests require io.modelcontextprotocol/protocolVersion.");
  }
  if (protocolVersion !== MODERN_PROTOCOL_VERSION) {
    throw unsupportedProtocolVersion(protocolVersion);
  }

  const clientCapabilities = meta["io.modelcontextprotocol/clientCapabilities"];
  if (!isRecord(clientCapabilities)) {
    throw invalidParams("Modern MCP requests require io.modelcontextprotocol/clientCapabilities.");
  }

  const clientInfo = meta["io.modelcontextprotocol/clientInfo"];
  if (
    clientInfo !== undefined &&
    (
      !isRecord(clientInfo) ||
      typeof clientInfo.name !== "string" ||
      !clientInfo.name.trim() ||
      typeof clientInfo.version !== "string" ||
      !clientInfo.version.trim()
    )
  ) {
    throw invalidParams("io.modelcontextprotocol/clientInfo must include non-empty name and version strings.");
  }

  return {
    protocolVersion,
    clientCapabilities,
    clientInfo: clientInfo || null
  };
}

function resultMeta(serverInfo, existingMeta) {
  const meta = isRecord(existingMeta) ? { ...existingMeta } : {};
  if (isRecord(serverInfo)) {
    meta["io.modelcontextprotocol/serverInfo"] = { ...serverInfo };
  }
  return Object.keys(meta).length ? meta : undefined;
}

function completeResult(result = {}, { serverInfo } = {}) {
  if (!isRecord(result)) {
    throw new TypeError("MCP results must be objects.");
  }
  const complete = {
    ...result,
    resultType: "complete"
  };
  const meta = resultMeta(serverInfo, result._meta);
  if (meta) complete._meta = meta;
  return complete;
}

function deterministicTools(tools) {
  if (!Array.isArray(tools)) throw new TypeError("MCP tools must be an array.");
  const names = new Set();
  const copy = tools.map((tool) => {
    if (!isRecord(tool) || typeof tool.name !== "string" || !tool.name.trim()) {
      throw new TypeError("Every MCP tool must have a non-empty name.");
    }
    if (names.has(tool.name)) throw new TypeError(`Duplicate MCP tool name: ${tool.name}`);
    names.add(tool.name);
    return tool;
  });
  return copy.sort((left, right) => {
    if (left.name < right.name) return -1;
    if (left.name > right.name) return 1;
    return 0;
  });
}

function createToolsListResult(tools, {
  serverInfo,
  ttlMs = DEFAULT_CACHE_TTL_MS,
  cacheScope = DEFAULT_CACHE_SCOPE
} = {}) {
  return completeResult({
    tools: deterministicTools(tools),
    ttlMs,
    cacheScope
  }, { serverInfo });
}

function createDiscoverResult({
  serverInfo,
  capabilities = { tools: {} },
  instructions = "",
  ttlMs = DEFAULT_CACHE_TTL_MS,
  cacheScope = DEFAULT_CACHE_SCOPE
} = {}) {
  const result = {
    supportedVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
    capabilities,
    ttlMs,
    cacheScope
  };
  if (instructions) result.instructions = instructions;
  return completeResult(result, { serverInfo });
}

function toJsonRpcError(id, error) {
  const protocolError = error instanceof McpProtocolError
    ? error
    : new McpProtocolError(error?.message || String(error), {
      code: -32603,
      httpStatus: 500
    });
  const response = {
    jsonrpc: "2.0",
    id: id === undefined ? null : id,
    error: {
      code: protocolError.code,
      message: protocolError.message
    }
  };
  if (protocolError.data !== undefined) response.error.data = protocolError.data;
  return {
    httpStatus: protocolError.httpStatus,
    response
  };
}

  function decodeMirroredHeader(name, value) {
    const headerValue = String(value || "");
    const sentinel = /^=\?base64\?([A-Za-z0-9+/]*(?:={0,2}))\?=$/;
    const usesSentinel = headerValue.startsWith("=?base64?") && headerValue.endsWith("?=");
    if (!usesSentinel) {
      if (
        !headerValue ||
        headerValue.trim() !== headerValue ||
        !/^[\x09\x20-\x7E]+$/.test(headerValue)
      ) {
        throw headerMismatch(`${name} is missing or malformed.`);
      }
      return headerValue;
    }
    const match = headerValue.match(sentinel);
    if (!match || match[1].length % 4 !== 0) {
      throw headerMismatch(`${name} contains malformed Base64 sentinel encoding.`);
    }
    const bytes = Buffer.from(match[1], "base64");
    if (
      bytes.toString("base64") !== match[1] ||
      !Buffer.from(bytes.toString("utf8"), "utf8").equals(bytes)
    ) {
      throw headerMismatch(`${name} contains invalid Base64 sentinel encoding.`);
    }
    return bytes.toString("utf8");
  }

  function validateModernProtocolHeader(request, message) {
    const protocolHeader = String(request.headers["mcp-protocol-version"] || "");
    const bodyProtocolVersion =
      message.params?._meta?.["io.modelcontextprotocol/protocolVersion"];
    if (!protocolHeader) {
      throw headerMismatch("MCP-Protocol-Version is required.");
    }
    if (
      typeof bodyProtocolVersion === "string" &&
      bodyProtocolVersion &&
      protocolHeader !== bodyProtocolVersion
    ) {
      throw headerMismatch("MCP-Protocol-Version does not match request metadata.");
    }
  }

  function validateModernMethodHeaders(request, message) {
    const methodHeader = String(request.headers["mcp-method"] || "");
    if (!methodHeader || methodHeader !== message.method) {
      throw headerMismatch("Mcp-Method does not match the request body.");
    }
    if (message.method === "tools/call") {
      const bodyName = message.params?.name;
      if (typeof bodyName !== "string" || !bodyName) {
        throw headerMismatch("Mcp-Name requires a non-empty params.name value.");
      }
      const mirroredName = decodeMirroredHeader("Mcp-Name", request.headers["mcp-name"]);
      if (mirroredName !== bodyName) {
        throw headerMismatch("Mcp-Name does not match params.name.");
      }
    }
  }


module.exports = {
  validateModernProtocolHeader,
  validateModernMethodHeaders,
  DEFAULT_CACHE_SCOPE,
  DEFAULT_CACHE_TTL_MS,
  LEGACY_PROTOCOL_VERSION,
  MODERN_PROTOCOL_VERSION,
  McpProtocolError,
  PROTOCOL_ERAS,
  PROTOCOL_ERROR_CODES,
  SUPPORTED_PROTOCOL_VERSIONS,
  completeResult,
  createDiscoverResult,
  createToolsListResult,
  detectProtocolEra,
  headerMismatch,
  invalidParams,
  methodNotFound,
  toJsonRpcError,
  unsupportedProtocolVersion,
  validateModernRequest
};
