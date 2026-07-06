const crypto = require("crypto");
const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");

const USER_AGENT = "ClaraCore-Desktop-InnerLife/0.3 (+source-ingest; read-only)";
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_MAX_BYTES = 2_000_000;

function trimText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'");
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/gu, " "));
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function tagText(xml, tag) {
  const match = String(xml || "").match(new RegExp(`<[^:>]*:?${tag}\\b[^>]*>([\\s\\S]*?)<\\/[^:>]*:?${tag}>`, "iu"));
  return trimText(stripTags(match?.[1] || ""));
}

function linkText(xml, baseUrl) {
  const href = String(xml || "").match(/<[^:>]*:?link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/iu)?.[1];
  const text = tagText(xml, "link");
  const raw = href || text;
  if (!raw) return "";
  try {
    return new URL(decodeEntities(raw), baseUrl).toString();
  } catch (_error) {
    return "";
  }
}

function parseFeedItems(xml, source, limit) {
  const blocks = [...String(xml || "").matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/giu)]
    .map((match) => match[0])
    .slice(0, limit);
  return blocks
    .map((block) => {
      const title = tagText(block, "title");
      const url = linkText(block, source.url);
      if (!title || !url) return null;
      const summary = tagText(block, "summary") || tagText(block, "description") || tagText(block, "content");
      const publishedAt = tagText(block, "published") || tagText(block, "updated") || tagText(block, "pubDate") || "";
      return {
        sourceName: source.name,
        sourceType: source.source_type || "rss",
        title,
        url,
        publishedAt,
        summary: summary.slice(0, 1600),
        candidateFingerprint: hash(url).slice(0, 24)
      };
    })
    .filter(Boolean);
}

function extractHtmlText(html) {
  return stripTags(
    String(html || "")
      .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/giu, " ")
  );
}

function parseWebpage(html, source) {
  const title = trimText(stripTags(String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || source.name));
  const text = extractHtmlText(html);
  if (!text) return [];
  return [
    {
      sourceName: source.name,
      sourceType: "webpage",
      title: title || source.name,
      url: source.url,
      publishedAt: "",
      summary: text.slice(0, 1600),
      candidateFingerprint: hash(source.url).slice(0, 24)
    }
  ];
}

function shouldBypassProxy(target, proxyUrl) {
  if (!proxyUrl) return true;
  const noProxy = String(process.env.NO_PROXY || process.env.no_proxy || "").trim();
  if (!noProxy) return false;
  const hostname = target.hostname.toLowerCase();
  return noProxy
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .some((rule) => {
      if (rule === "*") return true;
      if (rule.startsWith(".")) return hostname.endsWith(rule);
      return hostname === rule || hostname.endsWith(`.${rule}`);
    });
}

function proxyFor(target) {
  const raw =
    target.protocol === "https:"
      ? process.env.HTTPS_PROXY || process.env.https_proxy || process.env.ALL_PROXY || process.env.all_proxy || ""
      : process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy || "";
  if (!raw) return null;
  try {
    const proxy = new URL(raw);
    return shouldBypassProxy(target, proxy) ? null : proxy;
  } catch (_error) {
    return null;
  }
}

function proxyAuthHeader(proxy) {
  if (!proxy.username && !proxy.password) return {};
  const user = decodeURIComponent(proxy.username || "");
  const password = decodeURIComponent(proxy.password || "");
  return {
    "Proxy-Authorization": `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
  };
}

function collectResponse(response, maxBytes, resolve, reject) {
  const chunks = [];
  let total = 0;
  response.on("data", (chunk) => {
    total += chunk.length;
    if (total > maxBytes) {
      response.destroy(new Error("InnerLife source response exceeded max size."));
      return;
    }
    chunks.push(chunk);
  });
  response.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    if (response.statusCode < 200 || response.statusCode >= 300) {
      reject(new Error(`InnerLife source returned ${response.statusCode}: ${body.slice(0, 160)}`));
      return;
    }
    resolve({
      body,
      contentType: String(response.headers["content-type"] || "")
    });
  });
}

function requestDirect(target, timeoutMs, maxBytes) {
  return new Promise((resolve, reject) => {
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(
      target,
      {
        method: "GET",
        timeout: timeoutMs,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, text/html, application/xml;q=0.9, */*;q=0.1"
        }
      },
      (response) => collectResponse(response, maxBytes, resolve, reject)
    );
    request.on("timeout", () => request.destroy(new Error("InnerLife source request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

function requestHttpViaProxy(target, proxy, timeoutMs, maxBytes) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: proxy.hostname,
        port: proxy.port || 80,
        method: "GET",
        path: target.toString(),
        timeout: timeoutMs,
        headers: {
          Host: target.host,
          "User-Agent": USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, text/html, application/xml;q=0.9, */*;q=0.1",
          ...proxyAuthHeader(proxy)
        }
      },
      (response) => collectResponse(response, maxBytes, resolve, reject)
    );
    request.on("timeout", () => request.destroy(new Error("InnerLife source proxy request timed out.")));
    request.on("error", reject);
    request.end();
  });
}

function requestHttpsViaProxy(target, proxy, timeoutMs, maxBytes) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(proxy.port || 80), proxy.hostname);
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      const auth = proxyAuthHeader(proxy)["Proxy-Authorization"];
      socket.write(
        `CONNECT ${target.hostname}:${target.port || 443} HTTP/1.1\r\n` +
        `Host: ${target.hostname}:${target.port || 443}\r\n` +
        (auth ? `Proxy-Authorization: ${auth}\r\n` : "") +
        "\r\n"
      );
    });
    socket.once("timeout", () => socket.destroy(new Error("InnerLife source proxy tunnel timed out.")));
    socket.once("error", reject);
    socket.once("data", (chunk) => {
      if (!chunk.toString("utf8").startsWith("HTTP/1.1 200") && !chunk.toString("utf8").startsWith("HTTP/1.0 200")) {
        socket.destroy();
        reject(new Error(`InnerLife source proxy CONNECT failed: ${chunk.toString("utf8").split("\r\n")[0]}`));
        return;
      }
      const secureSocket = tls.connect({ socket, servername: target.hostname });
      const request = https.request(
        {
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          method: "GET",
          createConnection: () => secureSocket,
          timeout: timeoutMs,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/rss+xml, application/atom+xml, text/html, application/xml;q=0.9, */*;q=0.1"
          }
        },
        (response) => collectResponse(response, maxBytes, resolve, reject)
      );
      request.on("timeout", () => request.destroy(new Error("InnerLife source proxy request timed out.")));
      request.on("error", reject);
      request.end();
    });
  });
}

async function fetchSource(url, options = {}) {
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error(`InnerLife source must use http or https: ${url}`);
  }
  const timeoutMs = Number.parseInt(String(options.timeoutMs || DEFAULT_TIMEOUT_MS), 10) || DEFAULT_TIMEOUT_MS;
  const maxBytes = Number.parseInt(String(options.maxBytes || DEFAULT_MAX_BYTES), 10) || DEFAULT_MAX_BYTES;
  const proxy = proxyFor(target);
  if (!proxy) return requestDirect(target, timeoutMs, maxBytes);
  if (target.protocol === "https:") return requestHttpsViaProxy(target, proxy, timeoutMs, maxBytes);
  return requestHttpViaProxy(target, proxy, timeoutMs, maxBytes);
}

function normalizeSources(profileJson) {
  return (Array.isArray(profileJson?.autonomous_sources) ? profileJson.autonomous_sources : [])
    .map((source, index) => ({
      name: trimText(source?.name || source?.title || `source-${index + 1}`),
      url: trimText(source?.url),
      source_type: trimText(source?.source_type || source?.type || "rss").toLowerCase()
    }))
    .filter((source) => source.name && source.url && ["rss", "atom", "webpage"].includes(source.source_type))
    .slice(0, 10);
}

async function fetchCandidates(source, options = {}) {
  const { body, contentType } = await fetchSource(source.url, options);
  if (source.source_type === "webpage" || contentType.includes("text/html") || /<html\b/iu.test(body.slice(0, 1000))) {
    return parseWebpage(body, source);
  }
  return parseFeedItems(body, source, Number.parseInt(String(options.limit || 20), 10) || 20);
}

module.exports = {
  fetchCandidates,
  fetchSource,
  hash,
  normalizeSources
};
