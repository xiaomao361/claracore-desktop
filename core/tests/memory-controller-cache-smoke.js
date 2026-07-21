const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { MemoryRetrievalCache, createCacheKey } = require("../memory-controller/cache");

async function expectRejection(operation, fragment) {
  try {
    await operation;
  } catch (error) {
    assert.ok(error.message.includes(fragment), `Expected '${fragment}', got '${error.message}'.`);
    return;
  }
  throw new Error(`Expected operation to reject with '${fragment}'.`);
}

function cacheKey(overrides = {}) {
  return createCacheKey({
    queryHash: "sha256:cache-smoke",
    agentScope: "codex",
    sensitivityScope: "normal",
    timeView: "current",
    policyVersion: "stage-a-v1",
    retrievalParams: { limit: 3, timeView: "current" },
    watermark: 0,
    ...overrides
  });
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-memory-controller-cache-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  const { database } = await runtime.ensureProductCore(app);
  const migrations = new Set((await database.query("SELECT id FROM schema_migrations;")).map((row) => row.id));
  assert.ok(migrations.has("005_memory_controller_watermark"), "Watermark migration was not recorded.");
  const triggers = await database.query(`
    SELECT name FROM sqlite_master
    WHERE type = 'trigger' AND name LIKE 'trg_memory_control_%';
  `);
  assert.equal(triggers.length, 15, `Expected 15 mutation triggers, got ${triggers.length}.`);

  const initialWatermark = await database.getMemoryControlWatermark();
  assert.equal(initialWatermark.revision, 0);
  const first = await runtime.createProductMemory(app, {
    title: "Cache smoke primary",
    body: "A cache candidate must be revalidated after every hit.",
    labels: ["cache-smoke"],
    agentId: "codex",
    agentTool: "codex"
  });
  const afterCreate = await database.getMemoryControlWatermark();
  assert.ok(afterCreate.revision > initialWatermark.revision, "Memory create did not advance the watermark.");
  assert.deepEqual(
    await database.getMemoryControlEligibleIds({ ids: [first.id], agentId: "codex", timeView: "current" }),
    [first.id]
  );

  const stableA = cacheKey({ watermark: afterCreate.revision, retrievalParams: { timeView: "current", limit: 3 } });
  const stableB = cacheKey({ watermark: afterCreate.revision, retrievalParams: { limit: 3, timeView: "current" } });
  assert.equal(stableA, stableB, "Cache key is not stable across object key order.");
  assert.notEqual(stableA, cacheKey({ watermark: afterCreate.revision, agentScope: "clara" }), "Agent scope is missing from cache key.");
  assert.notEqual(stableA, cacheKey({ watermark: afterCreate.revision, timeView: "historical" }), "timeView is missing from cache key.");
  assert.notEqual(stableA, cacheKey({ watermark: afterCreate.revision + 1 }), "Watermark is missing from cache key.");

  const cache = new MemoryRetrievalCache({ ttlMs: 1000, maxEntries: 3, maxBytes: 4096 });
  cache.set(stableA, {
    candidates: [{ id: first.id, title: first.title, score: 0.88 }],
    searchMeta: { mode: "keyword" }
  }, { watermark: afterCreate.revision });
  const hit = await cache.get(stableA, {
    watermark: afterCreate.revision,
    revalidate: (ids) => database.getMemoryControlEligibleIds({ ids, agentId: "codex", timeView: "current" })
  });
  assert.equal(hit.status, "hit");
  assert.equal(hit.value.candidates[0].id, first.id);

  const uncheckedKey = cacheKey({ watermark: afterCreate.revision, queryHash: "sha256:unchecked" });
  cache.set(uncheckedKey, { candidates: [{ id: first.id }] }, { watermark: afterCreate.revision });
  assert.equal((await cache.get(uncheckedKey, { watermark: afterCreate.revision })).reason, "eligibility_unchecked");

  const staleKey = cacheKey({ watermark: afterCreate.revision, queryHash: "sha256:stale" });
  cache.set(staleKey, { candidates: [{ id: first.id }] }, { watermark: afterCreate.revision });
  await runtime.updateProductMemory(app, first.id, {
    title: first.title,
    body: `${first.body} Updated.`,
    labels: first.labels,
    sensitivity: "normal"
  });
  const afterUpdate = await database.getMemoryControlWatermark();
  assert.ok(afterUpdate.revision > afterCreate.revision, "Memory update did not advance the watermark.");
  assert.equal(cache.invalidateWatermark(afterUpdate.revision), 2, "Old-watermark entries were not invalidated.");

  const restricted = await runtime.createProductMemory(app, {
    title: "Cache smoke restricted",
    body: "Restricted candidates must fail eligibility recheck.",
    labels: ["cache-smoke"],
    agentId: "codex",
    agentTool: "codex"
  });
  await runtime.restrictProductMemory(app, restricted.id);
  const restrictedWatermark = await database.getMemoryControlWatermark();
  const restrictedKey = cacheKey({ watermark: restrictedWatermark.revision, queryHash: "sha256:restricted" });
  cache.set(restrictedKey, { candidates: [{ id: restricted.id }] }, { watermark: restrictedWatermark.revision });
  const ineligible = await cache.get(restrictedKey, {
    watermark: restrictedWatermark.revision,
    revalidate: (ids) => database.getMemoryControlEligibleIds({ ids, agentId: "codex", timeView: "current" })
  });
  assert.equal(ineligible.reason, "candidate_ineligible");

  const second = await runtime.createProductMemory(app, {
    title: "Cache smoke neighbor",
    body: "Link changes must advance the mutation watermark.",
    labels: ["cache-smoke"],
    agentId: "codex",
    agentTool: "codex"
  });
  const beforeLink = await database.getMemoryControlWatermark();
  await database.createMemoryLink({ fromMemoryId: first.id, toMemoryId: second.id, kind: "related" });
  const afterLink = await database.getMemoryControlWatermark();
  assert.ok(afterLink.revision > beforeLink.revision, "Memory link change did not advance the watermark.");
  await database.createMemoryLabelAlias({ alias: "cache-alias", canonicalLabel: "cache-smoke" });
  const afterAlias = await database.getMemoryControlWatermark();
  assert.ok(afterAlias.revision > afterLink.revision, "Label alias change did not advance the watermark.");
  await database.markMemoryEmbeddingPending(second.id);
  const afterEmbedding = await database.getMemoryControlWatermark();
  assert.ok(afterEmbedding.revision > afterAlias.revision, "Embedding refresh did not advance the watermark.");

  let now = 1000;
  const ttlCache = new MemoryRetrievalCache({ ttlMs: 50, maxEntries: 2, maxBytes: 1024, clock: () => now });
  const ttlKey = cacheKey({ watermark: 1, queryHash: "sha256:ttl" });
  ttlCache.set(ttlKey, { candidates: [] }, { watermark: 1 });
  now += 51;
  assert.equal((await ttlCache.get(ttlKey, { watermark: 1 })).reason, "expired");

  const lruCache = new MemoryRetrievalCache({ ttlMs: 1000, maxEntries: 2, maxBytes: 1024 });
  for (const suffix of ["one", "two", "three"]) {
    lruCache.set(cacheKey({ watermark: 1, queryHash: `sha256:${suffix}` }), { candidates: [], suffix }, { watermark: 1 });
  }
  assert.equal(lruCache.stats().entries, 2);
  assert.equal(lruCache.stats().evictions, 1);

  const smallCache = new MemoryRetrievalCache({ ttlMs: 1000, maxEntries: 2, maxBytes: 256 });
  const tooLarge = smallCache.set(cacheKey({ watermark: 1, queryHash: "sha256:large" }), {
    candidates: [],
    body: "x".repeat(1000)
  }, { watermark: 1 });
  assert.equal(tooLarge.reason, "entry_too_large");
  await expectRejection(
    Promise.resolve().then(() => smallCache.set(cacheKey({ watermark: 1 }), { decisionId: "decision-old", candidates: [] }, { watermark: 1 })),
    "must not store a decision id"
  );
  await expectRejection(
    Promise.resolve().then(() => smallCache.set(cacheKey({ watermark: 1 }), { candidates: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }] }, { watermark: 1 })),
    "hard cap of three"
  );

  console.log(JSON.stringify({
    suite: "memory-controller-cache-smoke",
    migration: "005_memory_controller_watermark",
    triggerCount: triggers.length,
    watermark: {
      initial: initialWatermark.revision,
      afterCreate: afterCreate.revision,
      afterUpdate: afterUpdate.revision,
      afterLink: afterLink.revision,
      afterAlias: afterAlias.revision,
      afterEmbedding: afterEmbedding.revision
    },
    cache: cache.stats(),
    ttl: ttlCache.stats(),
    lru: lruCache.stats(),
    bounded: smallCache.stats()
  }, null, 2));
  database.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
