const MEMORY_CONTROLLER_MODES = Object.freeze(["off", "observe", "canary"]);
const ALL_CANARY_AGENTS = "*";
const DEFAULT_CANARY_AGENT_IDS = Object.freeze([ALL_CANARY_AGENTS]);
const MAX_CANARY_AGENT_IDS = 8;

function normalizeAgentId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5:_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCanaryAgentIds(value) {
  if (!Array.isArray(value)) {
    throw new Error("memory.controller.canary_agent_ids must be an array.");
  }
  const normalized = [...new Set(value.map((agentId) => {
    const text = String(agentId || "").trim();
    return text === ALL_CANARY_AGENTS ? ALL_CANARY_AGENTS : normalizeAgentId(text);
  }).filter(Boolean))];
  if (normalized.length === 0 || normalized.length > MAX_CANARY_AGENT_IDS) {
    throw new Error(`memory.controller.canary_agent_ids must contain 1-${MAX_CANARY_AGENT_IDS} Agent ids.`);
  }
  if (normalized.includes(ALL_CANARY_AGENTS)) {
    return [ALL_CANARY_AGENTS];
  }
  return normalized;
}

function canaryAllowsAgent(agentIds, agentId) {
  const normalizedAgentId = normalizeAgentId(agentId);
  return Boolean(normalizedAgentId)
    && (agentIds.includes(ALL_CANARY_AGENTS) || agentIds.includes(normalizedAgentId));
}

function parseCanaryAgentIds(value) {
  try {
    return {
      valid: true,
      agentIds: normalizeCanaryAgentIds(value)
    };
  } catch (error) {
    return {
      valid: false,
      agentIds: [],
      error: error.message
    };
  }
}

function normalizeMemoryControllerMode(value) {
  const mode = String(value || "off").trim().toLowerCase();
  if (!MEMORY_CONTROLLER_MODES.includes(mode)) {
    throw new Error("memory.controller.mode must be off, observe, or canary.");
  }
  return mode;
}

module.exports = {
  ALL_CANARY_AGENTS,
  DEFAULT_CANARY_AGENT_IDS,
  MAX_CANARY_AGENT_IDS,
  MEMORY_CONTROLLER_MODES,
  canaryAllowsAgent,
  normalizeCanaryAgentIds,
  normalizeMemoryControllerMode,
  parseCanaryAgentIds
};
