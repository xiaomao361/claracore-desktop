const assert = require("assert");
const { createSchedulers } = require("../../electron/schedulers");

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
    async recordRuntimeEvent(event) {
      calls.push("runtime-event");
      assert.equal(event.source, "memory-controller");
      assert.equal(event.metadata.deleted, retention.deleted);
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
  const enabled = fixture();
  const enabledResult = await enabled.schedulers.runMemoryMaintenanceScheduledTick();
  assert.deepEqual(enabled.calls, [
    "settings",
    "memoria-maintenance",
    "controller-retention",
    "runtime-event",
    "settings-save"
  ]);
  assert.equal(enabledResult.memoriaMaintenanceEnabled, true);
  assert.deepEqual(enabledResult.controllerRetention, enabled.retention);
  assert.equal(enabled.notifications.length, 1);
  assert.equal(enabled.notifications[0].scope, "memory-maintenance-nightly");
  assert.deepEqual(enabled.notifications[0].detail.controllerRetention, enabled.retention);

  const disabled = fixture({ memoriaMaintenanceEnabled: false });
  const disabledResult = await disabled.schedulers.runMemoryMaintenanceScheduledTick();
  assert.ok(!disabled.calls.includes("memoria-maintenance"), "Disabled Memoria maintenance should not run.");
  assert.ok(disabled.calls.includes("controller-retention"), "Controller retention must remain scheduled.");
  assert.ok(disabled.calls.includes("settings-save"), "The daily scheduler watermark must advance when only retention runs.");
  assert.equal(disabledResult.memoriaMaintenanceEnabled, false);

  console.log(JSON.stringify({
    suite: "memory-controller-retention-scheduler-smoke",
    enabledCalls: enabled.calls,
    disabledCalls: disabled.calls,
    retention: enabled.retention
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
