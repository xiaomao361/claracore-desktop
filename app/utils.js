(() => {
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function splitListInput(value) {
  return String(value || "")
    .split(/\n|,/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSharedLineMetaValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    return value
      .map((item) => {
        if (item && typeof item === "object") return JSON.stringify(item);
        return String(item || "");
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value || "").trim();
}

function splitReadableText(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  const normalized = text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[。！？!?；;])\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (normalized.length > 1) return normalized.slice(0, 12);
  return text
    .split(/(?<=，|,)\s*/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function renderReadableText(value, icon = "•") {
  const parts = splitReadableText(value);
  if (parts.length === 0) return "";
  return parts.map((part) => `<span class="readable-line"><i>${escapeHtml(icon)}</i>${escapeHtml(part)}</span>`).join("");
}

function itemAgentId(item) {
  return String(
    item?.agentId ||
      item?.agent_id ||
      item?.metadata?.agentId ||
      item?.metadata?.agent_id ||
      item?.agent ||
      ""
  ).trim();
}

function filterByAgent(items, agentId, getter = itemAgentId) {
  if (!agentId) return items || [];
  return (items || []).filter((item) => getter(item) === agentId);
}

function renderAgentFilter(select, agentIds, activeValue) {
  if (!select) return "";
  const options = [...new Set((agentIds || []).map((agentId) => String(agentId || "").trim()).filter(Boolean))].sort();
  const nextValue = activeValue && options.includes(activeValue) ? activeValue : "";
  select.innerHTML = [
    `<option value="">All agents</option>`,
    ...options.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
  ].join("");
  select.value = nextValue;
  return nextValue;
}

window.ClaraCoreUtils = {
  escapeHtml,
  safeJsonObject,
  formatBytes,
  splitListInput,
  formatSharedLineMetaValue,
  splitReadableText,
  renderReadableText,
  itemAgentId,
  filterByAgent,
  renderAgentFilter
};
})();
