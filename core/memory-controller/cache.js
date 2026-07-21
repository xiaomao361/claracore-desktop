const crypto = require("crypto");

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function createCacheKey(input = {}) {
  const queryHash = String(input.queryHash || input.query_hash || "").trim();
  if (!queryHash) throw new Error("Memory Controller cache queryHash is required.");
  const policyVersion = String(input.policyVersion || input.policy_version || "").trim();
  if (!policyVersion) throw new Error("Memory Controller cache policyVersion is required.");
  const watermark = Number.parseInt(String(input.watermark ?? input.mutationWatermark ?? ""), 10);
  if (!Number.isFinite(watermark) || watermark < 0) throw new Error("Memory Controller cache watermark must be a non-negative integer.");
  const material = stableValue({
    queryHash,
    agentScope: String(input.agentScope || input.agentId || input.agent_id || "global").trim() || "global",
    sensitivityScope: String(input.sensitivityScope || "normal").trim() || "normal",
    timeView: String(input.timeView || input.time_view || "current").trim() || "current",
    policyVersion,
    retrievalParams: input.retrievalParams || input.searchParams || {},
    watermark
  });
  return `sha256:${crypto.createHash("sha256").update(JSON.stringify(material)).digest("hex")}`;
}

function cloneJson(serialized) {
  return JSON.parse(serialized);
}

class MemoryRetrievalCache {
  constructor(options = {}) {
    this.ttlMs = Math.max(1, Number.parseInt(String(options.ttlMs || 60000), 10) || 60000);
    this.maxEntries = Math.max(1, Number.parseInt(String(options.maxEntries || 64), 10) || 64);
    this.maxBytes = Math.max(256, Number.parseInt(String(options.maxBytes || 1024 * 1024), 10) || 1024 * 1024);
    this.clock = typeof options.clock === "function" ? options.clock : Date.now;
    this.entries = new Map();
    this.bytes = 0;
    this.telemetry = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      evictions: 0,
      rejected: 0,
      reasons: {}
    };
  }

  noteReason(reason) {
    this.telemetry.reasons[reason] = (this.telemetry.reasons[reason] || 0) + 1;
  }

  remove(key, reason, kind = "invalidation") {
    const entry = this.entries.get(key);
    if (!entry) return false;
    this.entries.delete(key);
    this.bytes = Math.max(0, this.bytes - entry.bytes);
    if (kind === "eviction") this.telemetry.evictions += 1;
    else this.telemetry.invalidations += 1;
    this.noteReason(reason);
    return true;
  }

  set(key, value, metadata = {}) {
    const cacheKey = String(key || "").trim();
    if (!cacheKey) throw new Error("Memory Controller cache key is required.");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Memory Controller cache value must be an object.");
    if (Object.prototype.hasOwnProperty.call(value, "decisionId") || Object.prototype.hasOwnProperty.call(value, "decision_id")) {
      throw new Error("Memory Controller cache must not store a decision id.");
    }
    if (Array.isArray(value.candidates) && value.candidates.length > 3) {
      throw new Error("Memory Controller cache candidates exceed the hard cap of three.");
    }
    const watermark = Number.parseInt(String(metadata.watermark ?? ""), 10);
    if (!Number.isFinite(watermark) || watermark < 0) throw new Error("Memory Controller cache watermark must be a non-negative integer.");
    const candidateIds = [...new Set((Array.isArray(value.candidates) ? value.candidates : [])
      .map((candidate) => String(candidate?.id || candidate?.memoryId || "").trim())
      .filter(Boolean))].slice(0, 3);
    const serialized = JSON.stringify(value);
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > this.maxBytes) {
      this.telemetry.rejected += 1;
      this.noteReason("entry_too_large");
      return { stored: false, reason: "entry_too_large", bytes };
    }
    if (this.entries.has(cacheKey)) this.remove(cacheKey, "replaced");
    const now = this.clock();
    this.entries.set(cacheKey, {
      serialized,
      bytes,
      candidateIds,
      watermark,
      createdAt: now,
      expiresAt: now + this.ttlMs
    });
    this.bytes += bytes;
    while (this.entries.size > this.maxEntries || this.bytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value;
      this.remove(oldestKey, this.entries.size > this.maxEntries ? "entry_cap" : "byte_cap", "eviction");
    }
    return { stored: true, key: cacheKey, bytes, candidateIds, watermark };
  }

  async get(key, options = {}) {
    const cacheKey = String(key || "").trim();
    const entry = this.entries.get(cacheKey);
    if (!entry) {
      this.telemetry.misses += 1;
      this.noteReason("not_found");
      return { status: "miss", reason: "not_found", value: null };
    }
    const now = this.clock();
    if (now >= entry.expiresAt) {
      this.remove(cacheKey, "expired");
      this.telemetry.misses += 1;
      return { status: "miss", reason: "expired", value: null };
    }
    const watermark = Number.parseInt(String(options.watermark ?? entry.watermark), 10);
    if (!Number.isFinite(watermark) || watermark !== entry.watermark) {
      this.remove(cacheKey, "watermark_changed");
      this.telemetry.misses += 1;
      return { status: "miss", reason: "watermark_changed", value: null };
    }
    if (entry.candidateIds.length > 0) {
      if (typeof options.revalidate !== "function") {
        this.remove(cacheKey, "eligibility_unchecked");
        this.telemetry.misses += 1;
        return { status: "miss", reason: "eligibility_unchecked", value: null };
      }
      const result = await options.revalidate([...entry.candidateIds]);
      const eligible = result === true
        ? new Set(entry.candidateIds)
        : new Set(Array.isArray(result) ? result : result instanceof Set ? [...result] : []);
      if (!entry.candidateIds.every((id) => eligible.has(id))) {
        this.remove(cacheKey, "candidate_ineligible");
        this.telemetry.misses += 1;
        return { status: "miss", reason: "candidate_ineligible", value: null };
      }
    }
    this.entries.delete(cacheKey);
    this.entries.set(cacheKey, entry);
    this.telemetry.hits += 1;
    return {
      status: "hit",
      reason: "cache_hit",
      value: cloneJson(entry.serialized),
      metadata: { candidateIds: [...entry.candidateIds], watermark: entry.watermark, bytes: entry.bytes }
    };
  }

  invalidate(input = {}) {
    const reason = String(input.reason || "explicit").trim() || "explicit";
    const memoryIds = new Set((Array.isArray(input.memoryIds) ? input.memoryIds : []).map(String));
    let count = 0;
    for (const [key, entry] of [...this.entries.entries()]) {
      if (memoryIds.size === 0 || entry.candidateIds.some((id) => memoryIds.has(id))) {
        if (this.remove(key, reason)) count += 1;
      }
    }
    return count;
  }

  invalidateWatermark(currentWatermark) {
    const watermark = Number.parseInt(String(currentWatermark), 10);
    if (!Number.isFinite(watermark) || watermark < 0) throw new Error("Memory Controller cache watermark must be a non-negative integer.");
    let count = 0;
    for (const [key, entry] of [...this.entries.entries()]) {
      if (entry.watermark !== watermark && this.remove(key, "watermark_changed")) count += 1;
    }
    return count;
  }

  stats() {
    return {
      entries: this.entries.size,
      bytes: this.bytes,
      ttlMs: this.ttlMs,
      maxEntries: this.maxEntries,
      maxBytes: this.maxBytes,
      ...this.telemetry,
      reasons: { ...this.telemetry.reasons }
    };
  }
}

module.exports = {
  MemoryRetrievalCache,
  createCacheKey,
  stableValue
};
