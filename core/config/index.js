const DEFAULT_AGENT_ID = "codex";

const DEFAULT_SETTINGS = {
  "memory.embedding.provider": "ollama",
  "memory.embedding.base_url": "http://127.0.0.1:11434",
  "memory.embedding.model": "bge-m3",
  "memory.embedding.dimension": 1024,
  "memory.embedding.max_chars": 2000,
  "memory.maintenance.enabled": true,
  "memory.maintenance.hour": 3,
  "memory.maintenance.last_run_date": "",
  "innerlife.enabled": false,
  "innerlife.provider": "disabled",
  "innerlife.base_url": "http://127.0.0.1:11434",
  "innerlife.light_model": "",
  "innerlife.deep_model": "",
  "innerlife.loop_seconds": 900,
  "gateway.enabled": true,
  "gateway.transport": "stdio",
  "gateway.local_only": true,
  "continuity.active_line_id": "line_default",
  "backup.enabled": true,
  "backup.schedule": "manual",
  "agent.default_id": DEFAULT_AGENT_ID
};

const WRITABLE_SETTINGS = new Set([
  "memory.embedding.provider",
  "memory.embedding.base_url",
  "memory.embedding.model",
  "memory.embedding.dimension",
  "memory.embedding.max_chars",
  "memory.maintenance.enabled",
  "memory.maintenance.hour",
  "memory.maintenance.last_run_date",
  "innerlife.enabled",
  "innerlife.provider",
  "innerlife.base_url",
  "innerlife.light_model",
  "innerlife.deep_model",
  "innerlife.loop_seconds"
]);

function normalizeSettingValue(key, value) {
  if (key === "memory.embedding.provider") {
    const provider = String(value || "").trim().toLowerCase();
    return provider || "ollama";
  }
  if (key === "memory.embedding.base_url") {
    const endpoint = String(value || "").trim();
    try {
      const url = new URL(endpoint);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Embedding endpoint must use http or https.");
      }
    } catch (_error) {
      throw new Error("Embedding endpoint must be a valid http or https URL.");
    }
    return endpoint.replace(/\/$/, "");
  }
  if (key === "memory.embedding.model") {
    const model = String(value || "").trim();
    if (!model) throw new Error("Embedding model is required.");
    return model;
  }
  if (key === "memory.embedding.dimension" || key === "memory.embedding.max_chars" || key === "innerlife.loop_seconds") {
    const number = Number.parseInt(String(value), 10);
    if (!Number.isFinite(number) || number <= 0) {
      throw new Error(`${key} must be a positive number.`);
    }
    return number;
  }
  if (key === "memory.maintenance.hour") {
    const number = Number.parseInt(String(value), 10);
    if (!Number.isFinite(number) || number < 0 || number > 23) {
      throw new Error("memory.maintenance.hour must be between 0 and 23.");
    }
    return number;
  }
  if (key === "memory.maintenance.enabled") {
    return value === true || value === "true";
  }
  if (key === "innerlife.enabled") {
    return value === true || value === "true";
  }
  if (key === "innerlife.provider") {
    const provider = String(value || "").trim().toLowerCase();
    return provider || "disabled";
  }
  return String(value || "").trim();
}

module.exports = {
  DEFAULT_AGENT_ID,
  DEFAULT_SETTINGS,
  WRITABLE_SETTINGS,
  normalizeSettingValue
};
