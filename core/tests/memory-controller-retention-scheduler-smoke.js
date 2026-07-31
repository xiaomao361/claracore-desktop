const assert = require("assert");
const {
  createSchedulers,
  memoryMaintenanceRetryDelayMs,
  nextMemoryMaintenanceDelayMs
} = require("../../electron/schedulers");

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function fixture({ memoriaMaintenanceEnabled = true } = {}) {
  const calls = [];
  const notifications = [];
  const retention = {
    dryRun: false,
    policy: { maxAgeDays: 30, feedbackMaxAgeDays: 180, maxEvents: 10000, maxBytes: 8 * 1024 * 1024 },
    deleted: 3,
    feedbackRowsDeleted: 1,
    reasons: { ordinaryAge: 2, feedbackAge: 1, capacity: 0 },
    before: { eventCount: 13, feedbackCount: 2, eventsWithFeedback: 2, estimatedBytes: 9000 },
    after: { eventCount: 10, feedbackCount: 1, eventsWithFeedback: 1, estimatedBytes: 6000 }
  };
  const database = {
    async getSettings() {
      calls.push("settings");
      return { "memory.maintenance.enabled": memoriaMaintenanceEnabled };
    },
    async cleanupMemoryControlLedger() {
      calls.push("controller-retention");
      return retention;
    },
    async cleanupGatewayTraces() {
      calls.push("gateway-retention");
      return { deleted: 2, before: { total: 12 }, after: { total: 10 } };
    },
    async cleanupInnerLifeHistory() {
      calls.push("innerlife-retention");
      return { deleted: 1, before: { total: 8 }, after: { total: 7 } };
    },
    async recordRuntimeEvent(event) {
      calls.push("runtime-event");
      if (event.source === "memory-controller") assert.equal(event.metadata.deleted, retention.deleted);
      else assert.ok(["gateway", "innerlife"].includes(event.source));
    }
  };
  const schedulers = createSchedulers({
    app: {},
    ensureProductCore: async () => ({ database }),
    isQuitting: () => false,
    notifyRuntimeChanged: (scope, detail) => notifications.push({ scope, detail }),
    runProductMemoryMaintenance: async () => {
      calls.push("memoria-maintenance");
      return { actions: [{ code: "fixture" }], graphCache: { ok: true }, embeddings: { processed: 0 } };
    },
    saveProductSettings: async (_app, updates) => {
      calls.push("settings-save");
      assert.match(updates["memory.maintenance.last_run_date"], /^\d{4}-\d{2}-\d{2}$/);
    },
    tickProductInnerLifeDaemon: async () => ({})
  });
  return { calls, notifications, retention, schedulers };
}

async function main() {
  const midnight = new Date(2026, 6, 31, 0, 30, 0, 0);
  assert.equal(
    nextMemoryMaintenanceDelayMs({ "memory.maintenance.hour": 0 }, midnight),
    0,
    "Midnight must remain a valid configured maintenance hour."
  );
  assert.equal(
    nextMemoryMaintenanceDelayMs({
      "memory.maintenance.hour": 0,
      "memory.maintenance.last_run_date": "2026-07-31"
    }, midnight),
    23.5 * HOUR_MS,
    "A successful midnight run must advance to the next day."
  );
  assert.equal(
    nextMemoryMaintenanceDelayMs({ "memory.maintenance.hour": "invalid" }, midnight),
    2.5 * HOUR_MS,
    "Invalid hours must retain the 03:00 default."
  );
  assert.equal(memoryMaintenanceRetryDelayMs(1), 5 * MINUTE_MS);
  assert.equal(memoryMaintenanceRetryDelayMs(2), 10 * MINUTE_MS);
  assert.equal(memoryMaintenanceRetryDelayMs(10), 6 * HOUR_MS);

  const enabled = fixture();
  const enabledResult = await enabled.schedulers.runMemoryMaintenanceScheduledTick();
  assert.deepEqual(enabled.calls, [
    "settings",
    "memoria-maintenance",
    "controller-retention",
    "gateway-retention",
    "innerlife-retention",
    "runtime-event",
    "runtime-event",
    "runtime-event",
    "settings-save"
  ]);
  assert.equal(enabledResult.ok, true);
  assert.equal(enabledResult.memoriaMaintenanceEnabled, true);
  assert.deepEqual(enabledResult.controllerRetention, enabled.retention);
  assert.equal(enabled.notifications.length, 1);
  assert.equal(enabled.notifications[0].scope, "memory-maintenance-nightly");
  assert.deepEqual(enabled.notifications[0].detail.controllerRetention, enabled.retention);

  const disabled = fixture({ memoriaMaintenanceEnabled: false });
  const disabledResult = await disabled.schedulers.runMemoryMaintenanceScheduledTick();
  assert.ok(!disabled.calls.includes("memoria-maintenance"), "Disabled Memoria maintenance should not run.");
  assert.ok(disabled.calls.includes("controller-retention"), "Controller retention must remain scheduled.");
  assert.ok(disabled.calls.includes("gateway-retention"), "Gateway trace retention must remain scheduled.");
  assert.ok(disabled.calls.includes("settings-save"), "The daily scheduler watermark must advance when only retention runs.");
  assert.equal(disabledResult.ok, true);
  assert.equal(disabledResult.memoriaMaintenanceEnabled, false);

  let currentTime = new Date(2026, 6, 31, 4, 0, 0, 0);
  let failMaintenance = true;
  let lastRunDate = "";
  const scheduledTimers = [];
  const retryNotifications = [];
  const retryErrors = [];
  const timerDatabase = {
    async getSettings() {
      return {
        "memory.maintenance.enabled": true,
        "memory.maintenance.hour": 3,
        "memory.maintenance.last_run_date": lastRunDate
      };
    },
    async cleanupMemoryControlLedger() {
      if (failMaintenance) throw new Error("fixture cleanup failure");
      return {};
    },
    async cleanupGatewayTraces() {
      return {};
    },
    async cleanupInnerLifeHistory() {
      return {};
    },
    async recordRuntimeEvent() {}
  };
  const retrySchedulers = createSchedulers({
    app: {},
    ensureProductCore: async () => ({ database: timerDatabase }),
    isQuitting: () => false,
    notifyRuntimeChanged: (scope, detail) => retryNotifications.push({ scope, detail }),
    runProductMemoryMaintenance: async () => ({ actions: [] }),
    saveProductSettings: async (_app, updates) => {
      lastRunDate = updates["memory.maintenance.last_run_date"];
    },
    tickProductInnerLifeDaemon: async () => ({}),
    now: () => new Date(currentTime),
    setMaintenanceTimeout: (callback, delayMs) => {
      const timer = {
        callback,
        delayMs,
        cleared: false,
        unref() {}
      };
      scheduledTimers.push(timer);
      return timer;
    },
    clearMaintenanceTimeout: (timer) => {
      timer.cleared = true;
    }
  });

  const originalConsoleError = console.error;
  console.error = (...args) => retryErrors.push(args);
  try {
    await retrySchedulers.startMemoryMaintenance();
    assert.equal(scheduledTimers.length, 1);
    assert.equal(scheduledTimers[0].delayMs, 0, "A missed daily run should catch up once immediately.");

    await scheduledTimers[0].callback();
    assert.equal(scheduledTimers.length, 2);
    assert.equal(
      scheduledTimers[1].delayMs,
      5 * MINUTE_MS,
      "A failed catch-up must use bounded retry delay instead of scheduling another zero-delay tick."
    );
    assert.equal(lastRunDate, "", "A failed run must not advance the daily success watermark.");
    assert.equal(retryNotifications.at(-1).scope, "memory-maintenance-error");

    failMaintenance = false;
    currentTime = new Date(currentTime.getTime() + scheduledTimers[1].delayMs);
    await scheduledTimers[1].callback();
    assert.equal(lastRunDate, "2026-07-31");
    assert.equal(scheduledTimers.length, 3);
    assert.ok(
      scheduledTimers[2].delayMs >= 22 * HOUR_MS,
      "A successful retry must return to the next daily schedule."
    );
    assert.equal(retryErrors.length, 1);
  } finally {
    console.error = originalConsoleError;
    retrySchedulers.stopMemoryMaintenance();
  }

  const settingsGate = deferred();
  let ensureCalls = 0;
  let maintenanceGate = null;
  let maintenanceStarted = false;
  const lifecycleTimers = [];
  const lifecycleDatabase = {
    async getSettings() {
      return {
        "memory.maintenance.enabled": true,
        "memory.maintenance.hour": 3,
        "memory.maintenance.last_run_date": ""
      };
    },
    async cleanupMemoryControlLedger() {
      return {};
    },
    async cleanupGatewayTraces() {
      return {};
    },
    async cleanupInnerLifeHistory() {
      return {};
    },
    async recordRuntimeEvent() {}
  };
  const lifecycleSchedulers = createSchedulers({
    app: {},
    ensureProductCore: async () => {
      ensureCalls += 1;
      await settingsGate.promise;
      return { database: lifecycleDatabase };
    },
    isQuitting: () => false,
    notifyRuntimeChanged: () => {},
    runProductMemoryMaintenance: async () => {
      maintenanceStarted = true;
      if (maintenanceGate) await maintenanceGate.promise;
      return { actions: [] };
    },
    saveProductSettings: async () => {},
    tickProductInnerLifeDaemon: async () => ({}),
    now: () => new Date(2026, 6, 31, 4, 0, 0, 0),
    setMaintenanceTimeout: (callback, delayMs) => {
      const timer = {
        callback,
        delayMs,
        cleared: false,
        unref() {}
      };
      lifecycleTimers.push(timer);
      return timer;
    },
    clearMaintenanceTimeout: (timer) => {
      timer.cleared = true;
    }
  });
  const staleStart = lifecycleSchedulers.startMemoryMaintenance();
  const activeRestart = lifecycleSchedulers.rescheduleMemoryMaintenance();
  assert.equal(ensureCalls, 2, "Reschedule should create one new generation while the stale read remains in flight.");
  settingsGate.resolve();
  await Promise.all([staleStart, activeRestart]);
  assert.equal(lifecycleTimers.length, 1, "Only the current scheduler generation may arm a timer.");
  assert.equal(lifecycleTimers[0].delayMs, 0);

  maintenanceGate = deferred();
  const runningCallback = lifecycleTimers[0].callback();
  while (!maintenanceStarted) await Promise.resolve();
  lifecycleSchedulers.stopMemoryMaintenance();
  maintenanceGate.resolve();
  await runningCallback;
  assert.equal(
    lifecycleTimers.length,
    1,
    "Stopping an in-flight maintenance run must prevent its callback from resurrecting the timer."
  );

  console.log(JSON.stringify({
    suite: "memory-controller-retention-scheduler-smoke",
    enabledCalls: enabled.calls,
    disabledCalls: disabled.calls,
    retention: enabled.retention,
    failedRetryDelayMs: scheduledTimers[1].delayMs,
    recoveredNextDelayMs: scheduledTimers[2].delayMs,
    lifecycleTimerCount: lifecycleTimers.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
