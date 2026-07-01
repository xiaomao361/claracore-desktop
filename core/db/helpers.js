const http = require("http");
const https = require("https");
const { DEFAULT_AGENT_ID } = require("../config");

function innerLifeRetrySeconds(pollSeconds, failureCount) {
  const safePoll = Math.max(1, Number.parseInt(String(pollSeconds), 10) || 900);
  const safeFailures = Math.max(1, Math.min(Number.parseInt(String(failureCount), 10) || 1, 8));
  return Math.min(3600, safePoll * 2 ** (safeFailures - 1));
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return sqlString(JSON.stringify(value));
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function meaningfulTokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 80);
}

function slugAgentPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAgentId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(":")
    .map(slugAgentPart)
    .filter(Boolean)
    .join(":");
}

function buildAgentIdentityLabels(id, tool = "", name = "") {
  const safeId = normalizeAgentId(id) || DEFAULT_AGENT_ID;
  const [idTool, ...idNameParts] = safeId.split(":");
  const safeTool = slugAgentPart(tool) || (safeId.includes(":") ? idTool : "");
  const safeName = slugAgentPart(name) || (safeId.includes(":") ? idNameParts.join(":") : safeId);
  return [
    safeTool ? `tool:${safeTool}` : "",
    safeName ? `agent:${safeName}` : "",
    `agent-id:${safeId}`
  ].filter(Boolean);
}

function resolveAgentIdentity(input = {}, fallback = DEFAULT_AGENT_ID) {
  if (typeof input === "string") {
    const id = normalizeAgentId(input);
    return { id: id || fallback, tool: "", name: id || fallback, labels: buildAgentIdentityLabels(id || fallback) };
  }
  const explicit = normalizeAgentId(input.agentId || input.agent_id || input.agent || "");
  const tool = slugAgentPart(input.agentTool || input.agent_tool || input.tool || process.env.CLARACORE_AGENT_TOOL || "");
  const name = slugAgentPart(input.agentName || input.agent_name || input.name || process.env.CLARACORE_AGENT_NAME || "");
  const envId = normalizeAgentId(process.env.CLARACORE_AGENT_ID || "");
  const id = explicit || (tool && name ? `${tool}:${name}` : "") || name || envId || normalizeAgentId(fallback) || DEFAULT_AGENT_ID;
  return {
    id,
    tool: tool || (id.includes(":") ? id.split(":")[0] : ""),
    name: name || (id.includes(":") ? id.split(":").slice(1).join(":") : id),
    labels: buildAgentIdentityLabels(id, tool, name)
  };
}

function mergeTitleKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function overlapRatio(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

function newId(prefix) {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${now}_${random}`;
}

function normalizeLabels(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeSensitivity(value) {
  return String(value || "").trim().toLowerCase() === "restricted" ? "restricted" : "normal";
}

function requiredText(value, field) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function parseAwareDate(value, field) {
  const raw = requiredText(value, field);
  if (!/(Z|[+-]\d{2}:\d{2})$/u.test(raw)) {
    throw new Error(`${field} must include a timezone offset.`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid ISO 8601 datetime.`);
  return date;
}

function localDateForTimezone(date, timezone) {
  const zone = requiredText(timezone || "Asia/Shanghai", "timezone");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMemoryRecordValue(recordType, schemaVersion, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Record value must be a JSON object.");
  if (recordType !== "fitness") return { ...value };
  if (schemaVersion !== 1) throw new Error("Fitness records only support schema version 1.");
  const validators = {
    activity: (item) => {
      if (typeof item !== "string" || !item.trim()) throw new Error("activity must be a non-empty string.");
      return item.trim();
    },
    mood: (item) => {
      if (typeof item !== "string" || !item.trim()) throw new Error("mood must be a non-empty string.");
      return item.trim();
    },
    steps: (item) => {
      if (!Number.isInteger(item) || item < 0) throw new Error("steps must be a non-negative integer.");
      return item;
    },
    duration_minutes: (item) => {
      if (typeof item !== "number" || Number.isNaN(item) || item < 0) throw new Error("duration_minutes must be a non-negative number.");
      return item;
    },
    distance_km: (item) => {
      if (typeof item !== "number" || Number.isNaN(item) || item < 0) throw new Error("distance_km must be a non-negative number.");
      return item;
    },
    repetitions: (item) => {
      if (!Number.isInteger(item) || item < 0) throw new Error("repetitions must be a non-negative integer.");
      return item;
    },
    sets: (item) => {
      if (!Number.isInteger(item) || item < 0) throw new Error("sets must be a non-negative integer.");
      return item;
    },
    completed: (item) => {
      if (typeof item !== "boolean") throw new Error("completed must be a boolean.");
      return item;
    }
  };
  const unknown = Object.keys(value).filter((key) => !validators[key]);
  if (unknown.length) throw new Error(`Unknown fitness fields: ${unknown.join(", ")}.`);
  if (Object.keys(value).length === 0) throw new Error("Fitness record value must contain at least one field.");
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, validators[key](item)]));
}

function likePattern(value) {
  return `%${String(value || "").trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function postJson(url, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const timeoutMs = typeof options === "number" ? options : options.timeoutMs || 15000;
    const extraHeaders = typeof options === "object" && !Array.isArray(options) ? options.headers || {} : {};
    const errorPrefix =
      typeof options === "object" && !Array.isArray(options) ? options.errorPrefix || "JSON endpoint" : "JSON endpoint";
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...extraHeaders
        }
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`${errorPrefix} returned ${response.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error(`${errorPrefix} request timed out.`));
    });
    request.on("error", reject);
    request.end(body);
  });
}

function parseVector(value) {
  const vector = Array.isArray(value) ? value : parseJson(value, []);
  if (!Array.isArray(vector)) return [];
  return vector.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function cosineSimilarity(left, right) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function normalizeSearchRows(rows) {
  return rows.map((row) => ({
    ...row,
    labels: row.labels ? row.labels.split(",").filter(Boolean) : []
  }));
}

module.exports = {
  cosineSimilarity,
  innerLifeRetrySeconds,
  jsonSql,
  likePattern,
  localDateForTimezone,
  meaningfulTokens,
  mergeTitleKey,
  newId,
  normalizeAgentId,
  normalizeLabels,
  normalizeMemoryRecordValue,
  normalizeSearchRows,
  normalizeSensitivity,
  overlapRatio,
  parseAwareDate,
  parseJson,
  parseVector,
  postJson,
  requiredText,
  resolveAgentIdentity,
  sqlString
};
