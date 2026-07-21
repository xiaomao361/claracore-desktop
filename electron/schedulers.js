const INNERLIFE_SCHEDULER_INTERVAL_MS = 60 * 1000;
const EMBEDDING_SCHEDULER_INTERVAL_MS = 15 * 1000;

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
  let embeddingScheduler = null;
  let embeddingSchedulerBusy = false;
  let memoryMaintenanceScheduler = null;
  let memoryMaintenanceSchedulerBusy = false;

  async function runInnerLifeScheduledTick() {
    if (innerLifeSchedulerBusy || isQuitting()) return;
    innerLifeSchedulerBusy = true;
    try {
      const { database } = await ensureProductCore(app);
      const afterthoughts = await database.processPendingSessionAfterthoughts(5);
      if (afterthoughts.processed > 0) {
        await database.recordRuntimeEvent({
          level: afterthoughts.results.some((item) => !item.ok) ? "warn" : "info",
          source: "innerlife",
          message: "Processed pending session afterthoughts",
          metadata: afterthoughts
        });
        notifyRuntimeChanged("innerlife-session-afterthought", afterthoughts);
      }
      const agentIds = await database.listEnabledInnerLifeDaemonAgentIds();
      for (const agentId of agentIds) {
        try {
          const result = await tickProductInnerLifeDaemon(app, {
            agentId,
            force: false,
            includeSnapshot: false
          });
          if (result?.reason && result.reason !== "paused" && result.reason !== "not_due") {
            notifyRuntimeChanged("innerlife-daemon", {
              agentId,
              daemonReason: result.reason,
              ran: Boolean(result.ran)
            });
          }
        } catch (error) {
          console.error(`InnerLife scheduler failed for ${agentId}:`, error);
          notifyRuntimeChanged("innerlife-daemon-error", {
            agentId,
            error: error.message || String(error)
          });
        }
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

  async function runEmbeddingScheduledTick() {
    if (embeddingSchedulerBusy || isQuitting()) return;
    embeddingSchedulerBusy = true;
    try {
      const { database } = await ensureProductCore(app);
      const result = await database.processPendingEmbeddings(5);
      if (result.processed > 0) {
        await database.recordRuntimeEvent({
          level: result.results?.some((item) => !item.ok) ? "warn" : "info",
          source: "memoria",
          message: "Processed persisted Memory embedding jobs",
          metadata: {
            processed: result.processed,
            ready: (result.results || []).filter((item) => item.ok).length,
            failed: (result.results || []).filter((item) => !item.ok).length
          }
        });
        notifyRuntimeChanged("memory-embeddings", { processed: result.processed });
      }
      return result;
    } catch (error) {
      console.error("Memory embedding scheduler failed:", error);
      return { processed: 0, error: error.message || String(error) };
    } finally {
      embeddingSchedulerBusy = false;
    }
  }

  function startEmbeddings() {
    if (embeddingScheduler) return;
    embeddingScheduler = setInterval(() => {
      runEmbeddingScheduledTick().catch(console.error);
    }, EMBEDDING_SCHEDULER_INTERVAL_MS);
    if (typeof embeddingScheduler.unref === "function") embeddingScheduler.unref();
    runEmbeddingScheduledTick().catch(console.error);
  }

  function stopEmbeddings() {
    if (!embeddingScheduler) return;
    clearInterval(embeddingScheduler);
    embeddingScheduler = null;
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
      const today = localDateKey();
      const memoriaMaintenanceEnabled = settings["memory.maintenance.enabled"] !== false;
      const result = memoriaMaintenanceEnabled
        ? await runProductMemoryMaintenance(app, { scheduled: true })
        : null;
      const controllerRetention = await database.cleanupMemoryControlLedger();
      await database.recordRuntimeEvent({
        level: "info",
        source: "memory-controller",
        message: "Memory Controller retention completed",
        metadata: {
          scheduled: true,
          policy: controllerRetention.policy,
          deleted: controllerRetention.deleted,
          feedbackRowsDeleted: controllerRetention.feedbackRowsDeleted,
          reasons: controllerRetention.reasons,
          before: controllerRetention.before,
          after: controllerRetention.after
        }
      });
      await saveProductSettings(app, { "memory.maintenance.last_run_date": today });
      notifyRuntimeChanged("memory-maintenance-nightly", {
        memoriaMaintenanceEnabled,
        actions: result?.actions || [],
        graphCache: result?.graphCache || null,
        embeddings: result?.embeddings || null,
        controllerRetention
      });
      return { memoriaMaintenanceEnabled, memoria: result, controllerRetention };
    } catch (error) {
      console.error("Memory maintenance scheduler failed:", error);
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
    startEmbeddings();
    startMemoryMaintenance();
  }

  function stop() {
    stopInnerLife();
    stopEmbeddings();
    stopMemoryMaintenance();
  }

  return {
    rescheduleMemoryMaintenance,
    start,
    stop,
    startInnerLife,
    startMemoryMaintenance,
    stopInnerLife,
    stopMemoryMaintenance,
    runInnerLifeScheduledTick,
    runEmbeddingScheduledTick,
    runMemoryMaintenanceScheduledTick
  };
}

module.exports = {
  createSchedulers,
  nextMemoryMaintenanceDelayMs
};
