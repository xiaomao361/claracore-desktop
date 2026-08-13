function publicApiKeyRef(value) {
  const ref = String(value || "").trim();
  if (!ref) return "";
  return ref.startsWith("env:") ? ref : "inline";
}

// The runtime configuration also feeds the trusted local Settings renderer,
// which needs the stored reference to preserve an unchanged secret. MCP has a
// different boundary: an Agent needs to know whether a key is configured and
// where it is sourced, never the inline credential itself.
function shapeAgentConfiguration(configuration = {}) {
  const memoria = configuration.memoria || {};
  const innerlife = configuration.innerlife || {};
  const gateway = configuration.gateway || {};
  return {
    ...configuration,
    memoria: {
      ...memoria,
      apiKeyRef: publicApiKeyRef(memoria.apiKeyRef)
    },
    innerlife: {
      ...innerlife,
      apiKeyRef: publicApiKeyRef(innerlife.apiKeyRef)
    },
    gateway: {
      enabled: Boolean(gateway.enabled),
      configuredTransport: gateway.transport || "stdio",
      localOnly: Boolean(gateway.localOnly),
      defaultAgentId: gateway.agentId || ""
    }
  };
}

function shapeCallerConnection(caller = {}, toolProfile = "core") {
  return {
    agentId: caller.agentId || "",
    clientId: caller.clientId || "",
    conversationId: caller.conversationId || "",
    transport: caller.transport || "",
    toolProfile
  };
}

module.exports = {
  publicApiKeyRef,
  shapeAgentConfiguration,
  shapeCallerConnection
};
