function createClaraCoreResourceRefreshLoop({
  documentRef,
  fetchSnapshot,
  renderSnapshot,
  handleError = () => {},
  intervalMs = 30_000,
  now = () => Date.now(),
  setTimer = (callback, delay) => setTimeout(callback, delay),
  clearTimer = (timer) => clearTimeout(timer)
}) {
  if (!documentRef?.addEventListener || !documentRef?.removeEventListener) {
    throw new Error("Resource refresh loop requires a document lifecycle.");
  }
  if (typeof fetchSnapshot !== "function" || typeof renderSnapshot !== "function") {
    throw new Error("Resource refresh loop requires fetchSnapshot and renderSnapshot.");
  }

  const cadenceMs = Math.max(1_000, Number(intervalMs) || 30_000);
  let active = false;
  let generation = 0;
  let timer = null;
  let inFlight = null;
  let lastAttemptAt = 0;
  let runCount = 0;

  function clearScheduled() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  function schedule(delay = cadenceMs) {
    if (!active || documentRef.hidden || timer !== null) return;
    timer = setTimer(() => {
      timer = null;
      cycle();
    }, Math.max(0, delay));
  }

  function refresh() {
    if (!active || documentRef.hidden) return Promise.resolve(null);
    if (inFlight) return inFlight;
    const requestGeneration = generation;
    lastAttemptAt = now();
    runCount += 1;
    const request = Promise.resolve()
      .then(() => fetchSnapshot())
      .then((snapshot) => {
        if (active && requestGeneration === generation) renderSnapshot(snapshot);
        return snapshot;
      })
      .catch((error) => {
        if (active && requestGeneration === generation) handleError(error);
        return null;
      })
      .finally(() => {
        if (inFlight === request) inFlight = null;
      });
    inFlight = request;
    return request;
  }

  function cycle() {
    const cycleGeneration = generation;
    return refresh().finally(() => {
      if (active && cycleGeneration === generation) schedule(cadenceMs);
    });
  }

  function handleVisibilityChange() {
    if (documentRef.hidden) {
      clearScheduled();
      return;
    }
    const elapsed = lastAttemptAt ? Math.max(0, now() - lastAttemptAt) : cadenceMs;
    schedule(Math.max(0, cadenceMs - elapsed));
  }

  function start() {
    if (active) return inFlight || Promise.resolve(null);
    active = true;
    generation += 1;
    documentRef.addEventListener("visibilitychange", handleVisibilityChange);
    return cycle();
  }

  function stop() {
    if (!active) return;
    active = false;
    generation += 1;
    clearScheduled();
    documentRef.removeEventListener("visibilitychange", handleVisibilityChange);
  }

  function refreshNow() {
    clearScheduled();
    return cycle();
  }

  function state() {
    return {
      active,
      cadenceMs,
      inFlight: Boolean(inFlight),
      lastAttemptAt,
      runCount,
      scheduled: timer !== null
    };
  }

  return {
    refreshNow,
    start,
    state,
    stop
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    createClaraCoreResourceRefreshLoop
  };
}

if (typeof window !== "undefined") {
  window.createClaraCoreResourceRefreshLoop = createClaraCoreResourceRefreshLoop;
}
