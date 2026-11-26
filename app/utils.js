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

function formatLocalDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(raw)
    ? `${raw.replace(" ", "T")}Z`
    : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, { hour12: false });
}

function getSystemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
  if (normalized.length > 1) return normalized;
  return text
    .split(/(?<=，|,)\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function renderReadableText(value, icon = "•") {
  const parts = splitReadableText(value);
  if (parts.length === 0) return "";
  return parts.map((part) => `<span class="readable-line"><i>${escapeHtml(icon)}</i>${escapeHtml(part)}</span>`).join("");
}

function renderMarkdownInline(value, depth = 0) {
  const text = String(value ?? "");
  const nested = (inner) => (depth < 3 ? renderMarkdownInline(inner, depth + 1) : escapeHtml(inner));
  const pattern = /(`+)([^\n]*?)\1|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|(?<![\p{L}\p{N}_])_([^_\n]+)_(?![\p{L}\p{N}_])/gu;
  let html = "";
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    html += escapeHtml(text.slice(end, match.index));
    if (match[1]) html += `<code>${escapeHtml(match[2])}</code>`;
    else if (match[3]) html += `<a href="${escapeHtml(match[4])}" target="_blank" rel="noreferrer">${nested(match[3])}</a>`;
    else if (match[5] || match[6]) html += `<strong>${nested(match[5] || match[6])}</strong>`;
    else if (match[7]) html += `<del>${nested(match[7])}</del>`;
    else html += `<em>${nested(match[8] || match[9])}</em>`;
    end = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(end));
}

function renderMarkdownPreview(value) {
  const text = String(value || "").replace(/\r/g, "").trim();
  if (!text) return "";
  const lines = text.split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let quote = [];
  let code = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${paragraph.map((line) => renderMarkdownInline(line)).join("<br />")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map((item) => `<li>${renderMarkdownInline(item)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    blocks.push(`<blockquote>${quote.map((line) => renderMarkdownInline(line)).join("<br />")}</blockquote>`);
    quote = [];
  };
  const flushCode = () => {
    if (!code) return;
    blocks.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
    code = null;
  };
  const flushLoose = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^```/u.test(line)) {
      if (code) {
        flushCode();
      } else {
        flushLoose();
        code = { lines: [] };
      }
      continue;
    }
    if (code) {
      code.lines.push(rawLine);
      continue;
    }
    if (!line.trim()) {
      flushLoose();
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/u.exec(line);
    if (heading) {
      flushLoose();
      const level = Math.min(4, heading[1].length + 2);
      blocks.push(`<h${level}>${renderMarkdownInline(heading[2])}</h${level}>`);
      continue;
    }
    const quoteMatch = /^>\s?(.+)$/u.exec(line);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      quote.push(quoteMatch[1]);
      continue;
    }
    const unordered = /^[-*]\s+(.+)$/u.exec(line);
    const ordered = /^\d+[.)]\s+(.+)$/u.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      flushQuote();
      const type = unordered ? "ul" : "ol";
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((unordered || ordered)[1]);
      continue;
    }
    flushList();
    flushQuote();
    paragraph.push(line.trim());
  }
  flushCode();
  flushLoose();
  return `<div class="markdown-preview">${blocks.join("")}</div>`;
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
  formatLocalDateTime,
  getSystemTimeZone,
  splitListInput,
  formatSharedLineMetaValue,
  splitReadableText,
  renderReadableText,
  renderMarkdownPreview,
  itemAgentId,
  filterByAgent,
  renderAgentFilter
};
})();
