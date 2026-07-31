function createClaraCoreMemoryHydrationCoordinator({
  getGeneration,
  getSnapshot
}) {
  if (typeof getGeneration !== "function" || typeof getSnapshot !== "function") {
    throw new Error("Memory hydration requires generation and snapshot readers.");
  }

  let localGeneration = 0;
  let requestSequence = 0;
  const inFlight = new Map();
  const latestRequest = new Map();

  function isCurrent(token) {
    return (
      token.localGeneration === localGeneration &&
      token.snapshotGeneration === getGeneration() &&
      token.snapshot === getSnapshot() &&
      latestRequest.get(token.key) === token.sequence
    );
  }

  function run(key, { force = false, load, apply }) {
    const resourceKey = String(key || "").trim();
    if (!resourceKey) throw new Error("Memory hydration resource key is required.");
    if (typeof load !== "function" || typeof apply !== "function") {
      throw new Error("Memory hydration requires load and apply callbacks.");
    }

    const snapshotGeneration = getGeneration();
    const targetSnapshot = getSnapshot();
    const existing = inFlight.get(resourceKey);
    if (
      !force &&
      existing?.localGeneration === localGeneration &&
      existing?.snapshotGeneration === snapshotGeneration &&
      existing?.snapshot === targetSnapshot
    ) {
      return existing.request;
    }

    const token = {
      key: resourceKey,
      localGeneration,
      sequence: ++requestSequence,
      snapshot: targetSnapshot,
      snapshotGeneration
    };
    latestRequest.set(resourceKey, token.sequence);

    const request = Promise.resolve()
      .then(() => load())
      .then((value) => {
        if (!isCurrent(token)) {
          return {
            applied: false,
            stale: true,
            value
          };
        }
        apply(value, targetSnapshot);
        return {
          applied: true,
          stale: false,
          value
        };
      })
      .finally(() => {
        if (inFlight.get(resourceKey)?.request === request) {
          inFlight.delete(resourceKey);
        }
      });

    inFlight.set(resourceKey, {
      ...token,
      request
    });
    return request;
  }

  function invalidate() {
    localGeneration += 1;
    inFlight.clear();
    latestRequest.clear();
  }

  function state() {
    return {
      inFlight: [...inFlight.keys()].sort(),
      localGeneration,
      requestSequence
    };
  }

  return {
    invalidate,
    run,
    state
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    createClaraCoreMemoryHydrationCoordinator
  };
}

if (typeof window !== "undefined") {
  window.createClaraCoreMemoryHydrationCoordinator = createClaraCoreMemoryHydrationCoordinator;
}
