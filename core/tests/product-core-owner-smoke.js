const assert = require("assert");
const path = require("path");
const { createProductCoreOwner } = require("../runtime/product-core-owner");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeDatabase(id, dbPath) {
  return {
    id,
    dbPath,
    closeCalls: 0,
    summaryCalls: 0,
    close() {
      this.closeCalls += 1;
    },
    async getSummary() {
      this.summaryCalls += 1;
      throw new Error("Product core owner must not read an unused summary.");
    }
  };
}

function appFor(databasePath) {
  return { databasePath };
}

function resolveProductPaths(app) {
  const databasePath = String(app.databasePath);
  const dataRoot = path.dirname(databasePath);
  return {
    appRoot: "/virtual/claracore-desktop",
    dataRoot,
    databasePath,
    backupsDir: path.join(dataRoot, "backups"),
    exportsDir: path.join(dataRoot, "exports"),
    runtimeDir: path.join(dataRoot, "runtime"),
    logsDir: path.join(dataRoot, "logs")
  };
}

async function flushUntil(predicate, label) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function testSamePathSingleFlightAndWarmPath() {
  const initialization = deferred();
  const databasePath = "/virtual/product/claracore.db";
  const database = fakeDatabase("single-flight", databasePath);
  let directoryEnsures = 0;
  let initializations = 0;

  const owner = createProductCoreOwner({
    resolveProductPaths,
    resolvePath: path.resolve,
    async ensureResolvedProductDirectories(paths) {
      directoryEnsures += 1;
      return paths;
    },
    async initializeProductDatabase(actualPath) {
      initializations += 1;
      assert.equal(path.resolve(actualPath), path.resolve(databasePath));
      return initialization.promise;
    }
  });

  const concurrent = Array.from({ length: 12 }, () => owner.ensure(appFor(databasePath)));
  await flushUntil(() => initializations === 1, "the shared cold initialization");
  assert.equal(directoryEnsures, 1, "Concurrent cold callers must share one directory ensure.");
  assert.equal(initializations, 1, "Concurrent cold callers must share one database initialization.");

  initialization.resolve(database);
  const cores = await Promise.all(concurrent);
  for (const core of cores) {
    assert.strictEqual(core.database, database, "Every cold caller must receive the adopted database.");
    assert.equal(path.resolve(core.paths.databasePath), path.resolve(databasePath));
  }

  const warm = await owner.ensure(appFor(databasePath));
  assert.strictEqual(warm.database, database);
  assert.equal(directoryEnsures, 1, "Warm ensure must not touch product directories.");
  assert.equal(initializations, 1, "Warm ensure must not initialize SQLite.");
  assert.equal(database.summaryCalls, 0, "Owner must not read an unused database summary.");

  const equivalent = await owner.ensure(appFor("/virtual/product/../product/claracore.db"));
  assert.strictEqual(equivalent.database, database, "Equivalent resolved paths must share one owner key.");
  assert.equal(directoryEnsures, 1, "Equivalent paths must stay on the zero-I/O warm path.");
  assert.equal(initializations, 1, "Equivalent paths must not initialize a second database.");

  await owner.reset();
  assert.equal(database.closeCalls, 1, "Reset must close the active database exactly once.");
}

async function testFailureRetryAndPathSwitch() {
  const aPath = "/virtual/a/claracore.db";
  const bPath = "/virtual/b/claracore.db";
  const databaseA = fakeDatabase("a", aPath);
  const databaseB = fakeDatabase("b", bPath);
  let bAttempts = 0;
  let initializations = 0;

  const owner = createProductCoreOwner({
    resolveProductPaths,
    resolvePath: path.resolve,
    async ensureResolvedProductDirectories(paths) {
      return paths;
    },
    async initializeProductDatabase(databasePath) {
      initializations += 1;
      if (path.resolve(databasePath) === path.resolve(aPath)) return databaseA;
      bAttempts += 1;
      if (bAttempts === 1) throw new Error("planned B initialization failure");
      return databaseB;
    }
  });

  const activeA = await owner.ensure(appFor(aPath));
  assert.strictEqual(activeA.database, databaseA);

  const failedB = Promise.all([
    owner.ensure(appFor(bPath)),
    owner.ensure(appFor(bPath))
  ]);
  await assert.rejects(failedB, /planned B initialization failure/);
  assert.equal(bAttempts, 1, "Concurrent failing callers must share one failed flight.");
  assert.equal(databaseA.closeCalls, 0, "A failed replacement must preserve the active database.");

  const stillA = await owner.ensure(appFor(aPath));
  assert.strictEqual(stillA.database, databaseA, "A must remain usable after B initialization fails.");
  assert.equal(initializations, 2, "Returning to active A must not initialize again.");

  const retriedB = await owner.ensure(appFor(bPath));
  assert.strictEqual(retriedB.database, databaseB, "A failed flight must be retryable.");
  assert.equal(bAttempts, 2);
  assert.equal(databaseA.closeCalls, 1, "A successful A-to-B switch must close A exactly once.");
  assert.equal(databaseB.closeCalls, 0);

  const warmB = await owner.ensure(appFor(bPath));
  assert.strictEqual(warmB.database, databaseB);
  assert.equal(initializations, 3, "Warm B must not initialize again.");

  await owner.reset();
  assert.equal(databaseA.closeCalls, 1);
  assert.equal(databaseB.closeCalls, 1);
}

async function testResetDuringInitialization() {
  const databasePath = "/virtual/reset/claracore.db";
  const staleInitialization = deferred();
  const replacementInitialization = deferred();
  const staleDatabase = fakeDatabase("stale", databasePath);
  const replacementDatabase = fakeDatabase("replacement", databasePath);
  let initializations = 0;
  let directoryEnsures = 0;

  const owner = createProductCoreOwner({
    resolveProductPaths,
    resolvePath: path.resolve,
    async ensureResolvedProductDirectories(paths) {
      directoryEnsures += 1;
      return paths;
    },
    async initializeProductDatabase() {
      initializations += 1;
      if (initializations === 1) return staleInitialization.promise;
      if (initializations === 2) return replacementInitialization.promise;
      throw new Error(`Unexpected initialization ${initializations}.`);
    }
  });

  const staleEnsure = owner.ensure(appFor(databasePath));
  const staleOutcome = staleEnsure.then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error })
  );
  await flushUntil(() => initializations === 1, "the stale initialization");

  const reset = owner.reset();
  const replacementEnsure = owner.ensure(appFor(databasePath));

  staleInitialization.resolve(staleDatabase);
  const outcome = await staleOutcome;
  assert.equal(outcome.ok, false, "An initialization invalidated by reset must reject.");
  assert.ok(outcome.error instanceof Error);
  await reset;
  assert.equal(staleDatabase.closeCalls, 1, "Reset must dispose a stale candidate when it eventually resolves.");

  await flushUntil(() => initializations === 2, "the post-reset initialization");
  const sharedReplacementEnsure = owner.ensure(appFor(databasePath));
  await Promise.resolve();
  assert.equal(
    initializations,
    2,
    "A stale flight's cleanup must not clear the post-reset flight."
  );

  replacementInitialization.resolve(replacementDatabase);
  const [replacement, sharedReplacement] = await Promise.all([
    replacementEnsure,
    sharedReplacementEnsure
  ]);
  assert.strictEqual(replacement.database, replacementDatabase);
  assert.strictEqual(sharedReplacement.database, replacementDatabase);
  assert.equal(directoryEnsures, 2, "Each generation may ensure directories once.");
  assert.equal(replacementDatabase.closeCalls, 0);

  const warmReplacement = await owner.ensure(appFor(databasePath));
  assert.strictEqual(warmReplacement.database, replacementDatabase);
  assert.equal(initializations, 2);
  assert.equal(directoryEnsures, 2);

  await owner.reset();
  assert.equal(staleDatabase.closeCalls, 1);
  assert.equal(replacementDatabase.closeCalls, 1);
}

async function testExclusiveSwapBlocksConcurrentEnsure() {
  const databasePath = "/virtual/exclusive-swap/claracore.db";
  const oldDatabase = fakeDatabase("exclusive-old", databasePath);
  const restoredDatabase = fakeDatabase("exclusive-restored", databasePath);
  const swapEntered = deferred();
  const releaseSwap = deferred();
  let initializations = 0;

  const owner = createProductCoreOwner({
    resolveProductPaths,
    resolvePath: path.resolve,
    async ensureResolvedProductDirectories(paths) {
      return paths;
    },
    async initializeProductDatabase() {
      initializations += 1;
      if (initializations === 1) return oldDatabase;
      if (initializations === 2) return restoredDatabase;
      throw new Error(`Unexpected initialization ${initializations}.`);
    }
  });

  const original = await owner.ensure(appFor(databasePath));
  assert.strictEqual(original.database, oldDatabase);

  const swap = owner.withExclusiveAccess(appFor(databasePath), async ({ paths, ensure, invalidate }) => {
    assert.equal(path.resolve(paths.databasePath), path.resolve(databasePath));
    const current = await ensure();
    assert.strictEqual(current.database, oldDatabase, "Exclusive work must be able to snapshot the current database before invalidation.");
    assert.equal(oldDatabase.closeCalls, 0, "The active database must stay open until exclusive work explicitly invalidates it.");
    await invalidate();
    assert.equal(oldDatabase.closeCalls, 1, "Exclusive access must close the old database before file replacement.");
    swapEntered.resolve();
    await releaseSwap.promise;
    return ensure();
  });
  const concurrentEnsure = owner.ensure(appFor(databasePath));
  let concurrentSettled = false;
  concurrentEnsure.finally(() => {
    concurrentSettled = true;
  });

  await swapEntered.promise;
  await Promise.resolve();
  assert.equal(concurrentSettled, false, "Concurrent ensure must wait for the exclusive swap to finish.");
  assert.equal(initializations, 1, "Concurrent ensure must not reopen the old database during the swap.");

  releaseSwap.resolve();
  const [swapped, concurrent] = await Promise.all([swap, concurrentEnsure]);
  assert.strictEqual(swapped.database, restoredDatabase);
  assert.strictEqual(concurrent.database, restoredDatabase);
  assert.equal(initializations, 2, "The restored database must initialize exactly once.");
  assert.equal(restoredDatabase.closeCalls, 0);

  await owner.reset();
  assert.equal(restoredDatabase.closeCalls, 1);
}

async function testExclusiveFailureRecoversUsableCore() {
  const databasePath = "/virtual/exclusive-recovery/claracore.db";
  const oldDatabase = fakeDatabase("recovery-old", databasePath);
  const recoveredDatabase = fakeDatabase("recovery-new", databasePath);
  let initializations = 0;

  const owner = createProductCoreOwner({
    resolveProductPaths,
    resolvePath: path.resolve,
    async ensureResolvedProductDirectories(paths) {
      return paths;
    },
    async initializeProductDatabase() {
      initializations += 1;
      if (initializations === 1) return oldDatabase;
      if (initializations === 2) return recoveredDatabase;
      throw new Error(`Unexpected initialization ${initializations}.`);
    }
  });

  await owner.ensure(appFor(databasePath));
  await assert.rejects(
    owner.withExclusiveAccess(appFor(databasePath), async ({ invalidate }) => {
      await invalidate();
      throw new Error("planned exclusive replacement failure");
    }),
    /planned exclusive replacement failure/
  );

  assert.equal(oldDatabase.closeCalls, 1, "A failed exclusive operation must still close the invalidated connection.");
  assert.equal(initializations, 2, "A failed exclusive operation must reopen Product Core before releasing waiters.");
  const recovered = await owner.ensure(appFor(databasePath));
  assert.strictEqual(recovered.database, recoveredDatabase, "Product Core must remain usable after an exclusive failure.");
  assert.equal(initializations, 2, "Recovery must stay on the warm path.");

  await owner.reset();
  assert.equal(recoveredDatabase.closeCalls, 1);
}

async function main() {
  await testSamePathSingleFlightAndWarmPath();
  await testFailureRetryAndPathSwitch();
  await testResetDuringInitialization();
  await testExclusiveSwapBlocksConcurrentEnsure();
  await testExclusiveFailureRecoversUsableCore();
  console.log(
    JSON.stringify(
      {
        ok: true,
        coverage: [
          "same-key-single-flight",
          "warm-zero-io",
          "equivalent-path-key",
          "failure-retry-preserves-active",
          "successful-path-switch-disposes-previous",
          "reset-invalidates-in-flight-candidate",
          "stale-finally-preserves-new-flight",
          "exclusive-snapshot-before-explicit-invalidation",
          "exclusive-swap-blocks-concurrent-ensure",
          "exclusive-failure-recovers-usable-core"
        ]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
