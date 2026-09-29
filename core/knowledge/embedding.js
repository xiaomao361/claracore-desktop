const fs = require("node:fs");
const path = require("node:path");
const { HAS_BUILT_IN_EMBEDDING } = require("../build-flavor");
const { createBuiltInEmbedding, resolveBuiltInModelRoot } = require("../db/repositories/memoria/embeddings");
const { KnowledgeLibraryError } = require("./library");
const { hash } = require("./storage");
const MODEL = "Xenova/bge-small-zh-v1.5";
const ALGORITHM = "knowledge-windows-256-overlap32-v1";
const fail = (code, message) => { throw new KnowledgeLibraryError(code, message); };

function localEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { fail("local_model_required", "Choose a loopback Ollama endpoint in model settings."); }
  if (!["http:", "https:"].includes(url.protocol) || !["127.0.0.1", "[::1]"].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) {
    fail("local_model_required", "Knowledge embeddings only use literal loopback addresses (127.0.0.1 or ::1), without URL credentials or redirects.");
  }
  return url.origin;
}
async function localJson(url, input) {
  try {
    const response = await fetch(url, { method: input ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(15000),
      ...(input ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {}) });
    if (!response.ok) fail("model_unavailable", `Local embedding service returned HTTP ${response.status}.`);
    const reader = response.body.getReader();
    const chunks = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.length;
        if (bytes > 4 * 1024 * 1024) fail("invalid_embedding", "Local embedding response is too large.");
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof KnowledgeLibraryError) throw error;
    fail(error.name === "TimeoutError" ? "model_timeout" : "model_unavailable", "Local embedding model did not return a usable response.");
  }
}
function normalizedVector(vector, dimension) {
  if (!Array.isArray(vector) || !vector.length || vector.length > 4096 || vector.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    fail("invalid_embedding", "Embedding must be a finite vector of 1..4096 dimensions.");
  }
  if (dimension && vector.length !== dimension) fail("model_changed", "Embedding dimension changed; rebuild the knowledge index.");
  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || norm <= 0) fail("invalid_embedding", "Embedding has an invalid norm.");
  return vector.map((value) => value / norm);
}
async function createKnowledgeEmbedder(settings = {}) {
  const provider = settings["memory.embedding.provider"] || (HAS_BUILT_IN_EMBEDDING ? "claracore-built-in" : "ollama");
  const model = settings["memory.embedding.model"] ?? (HAS_BUILT_IN_EMBEDDING ? MODEL : "");
  let descriptor;
  let embed;
  if (provider === "claracore-built-in") {
    if (!HAS_BUILT_IN_EMBEDDING) fail("model_unavailable", "This build needs a local Ollama embedding model.");
    if (model !== MODEL) fail("model_unavailable", "The selected built-in model is not supported.");
    const directory = resolveBuiltInModelRoot();
    try {
      const files = ["config.json", "tokenizer.json", "onnx/model_quantized.onnx"].map((name) => {
        const stat = fs.statSync(path.join(directory, MODEL, name));
        return [name, stat.size, stat.mtimeMs];
      });
      descriptor = { provider, model, revision: hash(JSON.stringify([directory, files])), algorithm: ALGORITHM };
    } catch { fail("model_unavailable", "The built-in embedding model files are unavailable."); }
    embed = async (text) => {
      try { return normalizedVector((await createBuiltInEmbedding(text, model, { rejectTruncation: true })).vector, 512); }
      catch (error) { if (error instanceof KnowledgeLibraryError) throw error; fail(error.code || "model_unavailable", "The built-in embedding model could not encode the complete input."); }
    };
  } else if (provider === "ollama") {
    if (typeof model !== "string" || !model.trim()) fail("model_unavailable", "Select an installed local Ollama embedding model in Settings.");
    const endpoint = localEndpoint(settings["memory.embedding.base_url"] || "http://127.0.0.1:11434");
    const tags = await localJson(`${endpoint}/api/tags`);
    const found = (Array.isArray(tags.models) ? tags.models : []).find((item) => [model, `${model}:latest`].includes(item.name || item.model));
    if (!found || typeof found.digest !== "string" || !found.digest) fail("model_unavailable", "Selected local model or its digest is unavailable.");
    descriptor = { provider, model, endpoint, revision: found.digest, algorithm: ALGORITHM };
    embed = async (text) => {
      const response = await localJson(`${endpoint}/api/embed`, { model, input: text, truncate: false });
      return normalizedVector(response.embeddings?.[0]);
    };
  } else fail(provider === "disabled" ? "model_disabled" : "local_model_required", "Knowledge semantic search requires an enabled local embedding model.");
  return { descriptor, key: hash(JSON.stringify(descriptor)), embed };
}
module.exports = { createKnowledgeEmbedder, normalizedVector, localEndpoint };
