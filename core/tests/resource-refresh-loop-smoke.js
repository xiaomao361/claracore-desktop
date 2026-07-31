const assert = require("assert");
const { createClaraCoreResourceRefreshLoop } = require("../../app/resource-refresh");
const {
  deferredGatewayProcessSample,
  isResourceWarning,
  systemMemorySnapshot,
  shouldCollectGatewayProcessSample
} = require("../../electron/resource-sampling");

class FakeDocument {
  constructor() {
    this.hidden = false;
    this.listeners = new Map();
  }

  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(listener);
  }

  removeEventListener(name, listener) {
    this.listeners.get(name)?.delete(listener);
  }

  emit(name) {
    for (const listener of this.listeners.get(name) || []) listener();
  }
}

function createFakeClock() {
  let currentTime = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    clearTimer(id) {
      timers.delete(id);
    },
    now() {
      return currentTime;
    },
    pending() {
      return [...timers.values()].sort((left, right) => left.at - right.at);
    },
    setTimer(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, {
        id,
        at: currentTime + Math.max(0, delay),
        callback
      });
      return id;
    },
    advanceWithoutRunning(milliseconds) {
      currentTime += milliseconds;
    },
    async runNext() {
      const next = this.pending()[0];
      if (!next) throw new Error("No scheduled timer.");
      timers.delete(next.id);
      currentTime = Math.max(currentTime, next.at);
      next.callback();
      for (let index = 0; index < 20; index += 1) await Promise.resolve();
    }
  };
}

async function main() {
  const documentRef = new FakeDocument();
  const clock = createFakeClock();
  const rendered = [];
  const errors = [];
  let fetchCalls = 0;
  let blockNext = false;
  let resolveBlocked = null;
  const loop = createClaraCoreResourceRefreshLoop({
    documentRef,
    intervalMs: 30_000,
    now: () => clock.now(),
    setTimer: (callback, delay) => clock.setTimer(callback, delay),
    clearTimer: (id) => clock.clearTimer(id),
    async fetchSnapshot() {
      fetchCalls += 1;
      if (blockNext) {
        blockNext = false;
        return new Promise((resolve) => {
          resolveBlocked = resolve;
        });
      }
      return { sample: fetchCalls };
    },
    renderSnapshot: (snapshot) => rendered.push(snapshot),
    handleError: (error) => errors.push(error)
  });

  const first = loop.start();
  const duplicate = loop.refreshNow();
  await Promise.all([first, duplicate]);
  assert.strictEqual(fetchCalls, 1, "Concurrent refresh requests must share one sample.");
  assert.deepStrictEqual(rendered, [{ sample: 1 }]);
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(loop.state().cadenceMs, 30_000);
  assert.strictEqual(clock.pending().length, 1, "Visible loop should schedule one timer.");

  await clock.runNext();
  assert.strictEqual(fetchCalls, 2);
  assert.deepStrictEqual(rendered.at(-1), { sample: 2 });
  assert.strictEqual(clock.pending().length, 1, "Completed cadence should schedule exactly one successor.");

  documentRef.hidden = true;
  documentRef.emit("visibilitychange");
  assert.strictEqual(clock.pending().length, 0, "Hidden documents must not keep a polling timer.");
  clock.advanceWithoutRunning(35_000);
  documentRef.hidden = false;
  documentRef.emit("visibilitychange");
  assert.strictEqual(clock.pending()[0]?.at, clock.now(), "A stale visible document should refresh immediately.");
  await clock.runNext();
  assert.strictEqual(fetchCalls, 3);

  blockNext = true;
  const pending = loop.refreshNow();
  for (let index = 0; index < 5 && !resolveBlocked; index += 1) await Promise.resolve();
  assert(resolveBlocked, "Expected a controlled in-flight sample.");
  loop.stop();
  resolveBlocked({ sample: 4 });
  await pending;
  assert.strictEqual(rendered.length, 3, "A stopped loop must ignore a late sample.");
  assert.strictEqual(clock.pending().length, 0);
  assert.strictEqual(documentRef.listeners.get("visibilitychange")?.size || 0, 0);
  assert.strictEqual(loop.state().active, false);

  assert.strictEqual(shouldCollectGatewayProcessSample({
    diskPercent: 89,
    isGatewayMode: false,
    memoryPercent: 84
  }), false);
  assert.strictEqual(shouldCollectGatewayProcessSample({
    diskPercent: 89,
    isGatewayMode: false,
    memoryPercent: 85
  }), true);
  assert.strictEqual(isResourceWarning({ diskPercent: 89, memoryPercent: 84 }), false);
  assert.strictEqual(isResourceWarning({ diskPercent: 90, memoryPercent: 84 }), true);
  assert.strictEqual(shouldCollectGatewayProcessSample({
    diskPercent: 90,
    isGatewayMode: false,
    memoryPercent: 84
  }), true);
  assert.strictEqual(shouldCollectGatewayProcessSample({
    diskPercent: 0,
    isGatewayMode: true,
    memoryPercent: 0
  }), true);
  assert.deepStrictEqual(deferredGatewayProcessSample(), {
    rssBytes: 0,
    rssText: "-",
    processCount: 0,
    source: "deferred-until-warning"
  });
  assert.deepStrictEqual(
    systemMemorySnapshot({
      total: 16,
      free: 1,
      fileBacked: 4,
      purgeable: 1,
      platform: "darwin",
      source: "electron-system-memory",
      unit: "kilobytes"
    }),
    {
      total: 16 * 1024,
      free: 6 * 1024,
      rawFree: 1024,
      reclaimable: 5 * 1024,
      used: 10 * 1024,
      percent: 63,
      source: "electron-system-memory"
    },
    "macOS warning pressure must include Electron-reported reclaimable memory."
  );
  assert.deepStrictEqual(
    systemMemorySnapshot({
      total: 16,
      free: 1,
      fileBacked: 4,
      purgeable: 1,
      platform: "linux",
      unit: "kilobytes"
    }),
    {
      total: 16 * 1024,
      free: 1024,
      rawFree: 1024,
      reclaimable: 0,
      used: 15 * 1024,
      percent: 94,
      source: "os"
    },
    "Non-macOS memory snapshots must not treat macOS-only fields as reclaimable."
  );

  process.stdout.write("Resource refresh loop smoke passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
