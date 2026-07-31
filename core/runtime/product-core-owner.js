const path = require("path");

function createResetError() {
  const error = new Error("Product Core initialization was invalidated by reset.");
  error.code = "PRODUCT_CORE_RESET";
  return error;
}

function createProductCoreOwner({
  ensureResolvedProductDirectories,
  initializeProductDatabase,
  resolveProductPaths,
  resolvePath = path.resolve
}) {
  let generation = 0;
  let active = null;
  let lifecycleTail = Promise.resolve();
  let barrierCount = 0;
  let exclusiveRequests = 0;
  let barrierSequence = 0;
  const flights = new Map();

  function enqueueLifecycle(task) {
    const result = lifecycleTail.catch(() => {}).then(task);
    lifecycleTail = result.catch(() => {});
    return result;
  }

  async function closeDatabase(database) {
    if (database && typeof database.close === "function") {
      await database.close();
    }
  }

  async function initializeAndAdopt(paths, key, requestedGeneration) {
    if (requestedGeneration !== generation) throw createResetError();
    if (active?.key === key) {
      return {
        paths: active.paths,
        database: active.database
      };
    }

    await ensureResolvedProductDirectories(paths);
    if (requestedGeneration !== generation) throw createResetError();

    let candidate = null;
    try {
      candidate = await initializeProductDatabase(paths.databasePath);
      if (requestedGeneration !== generation) {
        await closeDatabase(candidate);
        candidate = null;
        throw createResetError();
      }
      if (active?.key === key) {
        const adopted = active;
        await closeDatabase(candidate);
        candidate = null;
        return {
          paths: adopted.paths,
          database: adopted.database
        };
      }

      const previous = active;
      const adopted = {
        key,
        paths,
        database: candidate
      };
      active = null;
      if (previous && previous.database !== adopted.database) {
        await closeDatabase(previous.database);
      }
      if (requestedGeneration !== generation) {
        await closeDatabase(candidate);
        candidate = null;
        throw createResetError();
      }
      active = adopted;
      candidate = null;
      return {
        paths: adopted.paths,
        database: adopted.database
      };
    } catch (error) {
      if (candidate) await closeDatabase(candidate);
      throw error;
    }
  }

  function ensure(app) {
    const paths = resolveProductPaths(app);
    const key = resolvePath(paths.databasePath);
    if (barrierCount === 0 && active?.key === key) {
      return Promise.resolve({
        paths: active.paths,
        database: active.database
      });
    }

    const waitsForBarrier = barrierCount > 0;
    const requestedGeneration = generation;
    const flightKey = waitsForBarrier
      ? `barrier:${barrierSequence}\0${key}`
      : `generation:${requestedGeneration}\0${key}`;
    const existingFlight = flights.get(flightKey);
    if (existingFlight) return existingFlight;

    const flight = enqueueLifecycle(async () => {
      const effectiveGeneration = waitsForBarrier ? generation : requestedGeneration;
      return initializeAndAdopt(paths, key, effectiveGeneration);
    });

    flights.set(flightKey, flight);
    flight
      .finally(() => {
        if (flights.get(flightKey) === flight) {
          flights.delete(flightKey);
        }
      })
      .catch(() => {});
    return flight;
  }

  function reset() {
    const deferInvalidation = exclusiveRequests > 0;
    if (!deferInvalidation) generation += 1;
    barrierCount += 1;
    barrierSequence += 1;

    const result = enqueueLifecycle(async () => {
      if (deferInvalidation) generation += 1;
      const previous = active;
      active = null;
      await closeDatabase(previous?.database);
    });
    result
      .finally(() => {
        barrierCount -= 1;
      })
      .catch(() => {});
    return result;
  }

  function withExclusiveAccess(app, operation) {
    if (typeof operation !== "function") {
      return Promise.reject(new TypeError("Product Core exclusive operation must be a function."));
    }

    const paths = resolveProductPaths(app);
    const key = resolvePath(paths.databasePath);
    barrierCount += 1;
    exclusiveRequests += 1;
    barrierSequence += 1;

    const result = enqueueLifecycle(async () => {
      await ensureResolvedProductDirectories(paths);
      generation += 1;
      const exclusiveGeneration = generation;

      async function invalidate() {
        const previous = active;
        active = null;
        await closeDatabase(previous?.database);
      }

      let operationResult;
      let operationError = null;
      try {
        operationResult = await operation({
          paths,
          ensure: () => initializeAndAdopt(paths, key, exclusiveGeneration),
          invalidate
        });
      } catch (error) {
        operationError = error;
      }

      let recoveryError = null;
      try {
        await initializeAndAdopt(paths, key, exclusiveGeneration);
      } catch (error) {
        recoveryError = error;
      }

      if (operationError) {
        if (recoveryError) operationError.productCoreRecoveryError = recoveryError;
        throw operationError;
      }
      if (recoveryError) throw recoveryError;
      return operationResult;
    });

    result
      .finally(() => {
        barrierCount -= 1;
        exclusiveRequests -= 1;
      })
      .catch(() => {});
    return result;
  }

  return {
    ensure,
    reset,
    withExclusiveAccess
  };
}

module.exports = {
  createProductCoreOwner
};
