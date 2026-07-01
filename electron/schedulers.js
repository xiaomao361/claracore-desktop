const INNERLIFE_SCHEDULER_INTERVAL_MS = 60 * 1000;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextMemoryMaintenanceDelayMs(settings, now = new Date()) {
  const hour = Math.max(0, Math.min(23, Number.parseInt(String(settings["memory.maintenance.hour"] ?? 3), 10) || 3));
  const today = localDateKey(now);
  const nextRun = new Date(now);
  nextRun.setMinutes(0, 0, 0);
  nextRun.setHours(hour);
  if (String(settings["memory.maintenance.last_run_date"] || "") === today) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  return Math.max(0, nextRun.getTime() - now.getTime());
}

function createSchedulers({
  app,
  ensureProductCore,
  isQuitting,
  notifyRuntimeChanged,
  runProductMemoryMaintenance,
  saveProductSettings,
  tickProductInnerLifeDaemon
}) {
  let innerLifeScheduler = null;
  let innerLifeSchedulerBusy = false;
  let memoryMaintenanceScheduler = null;
  let memoryMaintenanceSchedulerBusy = false;

  async function runInnerLifeScheduledTick() {
    if (innerLifeSchedulerBusy || isQuitting()) return;
    innerLifeSchedulerBusy = true;
    try {
      const result = await tickProductInnerLifeDaemon(app, { force: false, includeSnapshot: false });
      if (result?.reason && result.reason !== "paused" && result.reason !== "not_due") {
        notifyRuntimeChanged("innerlife-daemon", {
          daemonReason: result.reason,
          ran: Boolean(result.ran)
        });
      }
    } catch (error) {
      console.error("InnerLife scheduler failed:", error);
      notifyRuntimeChanged("innerlife-daemon-error", {
        error: error.message || String(error)
      });
    } finally {
      innerLifeSchedulerBusy = false;
    }
  }

  function startInnerLife() {
    if (innerLifeScheduler) return;
    innerLifeScheduler = setInterval(() => {
      runInnerLifeScheduledTick().catch(console.error);
    }, INNERLIFE_SCHEDULER_INTERVAL_MS);
    if (typeof innerLifeScheduler.unref === "function") innerLifeScheduler.unref();
  }

  function stopInnerLife() {
    if (!innerLifeScheduler) return;
    clearInterval(innerLifeScheduler);
    innerLifeScheduler = null;
  }

  async function runMemoryMaintenanceScheduledTick() {
    if (memoryMaintenanceSchedulerBusy || isQuitting()) return;
    memoryMaintenanceSchedulerBusy = true;
    try {
      const { database } = await ensureProductCore(app);
      const settings = await database.getSettings();
      if (settings["memory.maintenance.enabled"] === false) return;
      const today = localDateKey();
      const result = await runProductMemoryMaintenance(app, { scheduled: true });
      await saveProductSettings(app, { "memory.maintenance.last_run_date": today });
      notifyRuntimeChanged("memory-maintenance-nightly", {
        actions: result?.actions || [],
        graphCache: result?.graphCache || null,
        embeddings: result?.embeddings || null
      });
    } catch (error) {
      console.error("Memoria maintenance scheduler failed:", error);
      notifyRuntimeChanged("memory-maintenance-error", {
        error: error.message || String(error)
      });
    } finally {
      memoryMaintenanceSchedulerBusy = false;
    }
  }

  async function scheduleNextMemoryMaintenance() {
    if (memoryMaintenanceScheduler || isQuitting()) return;
    let delayMs = 24 * 60 * 60 * 1000;
    try {
      const { database } = await ensureProductCore(app);
      const settings = await database.getSettings();
      delayMs = nextMemoryMaintenanceDelayMs(settings);
    } catch (error) {
      console.error("Failed to schedule Memoria maintenance:", error);
    }
    memoryMaintenanceScheduler = setTimeout(async () => {
      memoryMaintenanceScheduler = null;
      await runMemoryMaintenanceScheduledTick();
      scheduleNextMemoryMaintenance().catch(console.error);
    }, delayMs);
    if (typeof memoryMaintenanceScheduler.unref === "function") memoryMaintenanceScheduler.unref();
  }

  function startMemoryMaintenance() {
    scheduleNextMemoryMaintenance().catch(console.error);
  }

  function stopMemoryMaintenance() {
    if (!memoryMaintenanceScheduler) return;
    clearTimeout(memoryMaintenanceScheduler);
    memoryMaintenanceScheduler = null;
  }

  function rescheduleMemoryMaintenance() {
    stopMemoryMaintenance();
    startMemoryMaintenance();
  }

  function start() {
    startInnerLife();
    startMemoryMaintenance();
  }

  function stop() {
    stopInnerLife();
    stopMemoryMaintenance();
  }

  return {
    rescheduleMemoryMaintenance,
    start,
    stop,
    startInnerLife,
    startMemoryMaintenance,
    stopInnerLife,
    stopMemoryMaintenance
  };
}

module.exports = {
  createSchedulers,
  nextMemoryMaintenanceDelayMs
};
