const { resolveMaintenanceHour } = require("../core/config");

const INNERLIFE_SCHEDULER_INTERVAL_MS = 60 * 1000;
const EMBEDDING_SCHEDULER_INTERVAL_MS = 15 * 1000;
const MEMORY_MAINTENANCE_RETRY_BASE_MS = 5 * 60 * 1000;
const MEMORY_MAINTENANCE_RETRY_MAX_MS = 6 * 60 * 60 * 1000;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextMemoryMaintenanceDelayMs(settings, now = new Date()) {
  const hour = resolveMaintenanceHour(settings?.["memory.maintenance.hour"]);
  const today = localDateKey(now);
  const nextRun = new Date(now);
  nextRun.setMinutes(0, 0, 0);
  nextRun.setHours(hour);
  if (String(settings?.["memory.maintenance.last_run_date"] || "") === today) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  return Math.max(0, nextRun.getTime() - now.getTime());
}

function memoryMaintenanceRetryDelayMs(failureCount) {
  const safeFailureCount = Math.max(1, Number.parseInt(String(failureCount || 1), 10) || 1);
  return Math.min(
    MEMORY_MAINTENANCE_RETRY_MAX_MS,
    MEMORY_MAINTENANCE_RETRY_BASE_MS * (2 ** Math.min(10, safeFailureCount - 1))
  );
}

function createSchedulers({
  app,
  ensureProductCore,
  isQuitting,
  notifyRuntimeChanged,
  runProductMemoryMaintenance,
  saveProductSettings,
  tickProductInnerLifeDaemon,
  now = () => new Date(),
  setMaintenanceTimeout = setTimeout,
  clearMaintenanceTimeout = clearTimeout
}) {
  let innerLifeScheduler = null;
  let innerLifeSchedulerBusy = false;
  let embeddingScheduler = null;
  let embeddingSchedulerBusy = false;
  let memoryMaintenanceScheduler = null;
  let memoryMaintenanceSchedulerBusy = false;
  let memoryMaintenanceFailureCount = 0;
  let memoryMaintenanceActive = false;
  let memoryMaintenanceGeneration = 0;
  let memoryMaintenanceSchedulePromise = null;

  async function runInnerLifeScheduledTick() {
    if (innerLifeSchedulerBusy || isQuitting()) return;
    innerLifeSchedulerBusy = true;
    try {
      const { database } = await ensureProductCore(app);
      let afterthoughts = {
        processed: 0,
        retrying: 0,
        terminalFailures: 0,
        staleClaims: 0,
        results: []
      };
      try {
        afterthoughts = await database.processPendingSessionAfterthoughts(5);
      } catch (error) {
        console.error("InnerLife afterthought processing failed:", error);
        notifyRuntimeChanged("innerlife-session-afterthought-error", {
          error: error.message || String(error)
        });
      }
      const afterthoughtActivity =
        Number(afterthoughts.processed || 0) +
        Number(afterthoughts.retrying || 0) +
        Number(afterthoughts.terminalFailures || 0) +
        Number(afterthoughts.staleClaims || 0);
      if (afterthoughtActivity > 0) {
        const hasTerminalFailure = Number(afterthoughts.terminalFailures || 0) > 0;
        const hasWarning =
          Number(afterthoughts.retrying || 0) > 0 ||
          afterthoughts.results.some((item) => !item.ok || item.warning);
        await database.recordRuntimeEvent({
          level: hasTerminalFailure ? "error" : hasWarning ? "warn" : "info",
          source: "innerlife",
          message: hasTerminalFailure
            ? "Session afterthought reached its retry limit"
            : hasWarning
              ? "Session afterthought requires follow-up"
              : "Processed pending session afterthoughts",
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
    if (isQuitting()) return { ok: false, skipped: "quitting" };
    if (memoryMaintenanceSchedulerBusy) return { ok: false, skipped: "busy" };
    memoryMaintenanceSchedulerBusy = true;
    try {
      const { database } = await ensureProductCore(app);
      const settings = await database.getSettings();
      const today = localDateKey(now());
      const memoriaMaintenanceEnabled = settings["memory.maintenance.enabled"] !== false;
      const result = memoriaMaintenanceEnabled
        ? await runProductMemoryMaintenance(app, { scheduled: true })
        : null;
      const controllerRetention = await database.cleanupMemoryControlLedger();
      const gatewayTraceRetention = await database.cleanupGatewayTraces();
      const innerLifeRetention = await database.cleanupInnerLifeHistory();
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
      await database.recordRuntimeEvent({
        level: "info",
        source: "gateway",
        message: "Gateway trace retention completed",
        metadata: {
          scheduled: true,
          ...gatewayTraceRetention
        }
      });
      await database.recordRuntimeEvent({
        level: "info",
        source: "innerlife",
        message: "InnerLife history retention completed",
        metadata: {
          scheduled: true,
          ...innerLifeRetention
        }
      });
      await saveProductSettings(app, { "memory.maintenance.last_run_date": today });
      notifyRuntimeChanged("memory-maintenance-nightly", {
        memoriaMaintenanceEnabled,
        actions: result?.actions || [],
        graphCache: result?.graphCache || null,
        embeddings: result?.embeddings || null,
        controllerRetention,
        gatewayTraceRetention,
        innerLifeRetention
      });
      return {
        ok: true,
        memoriaMaintenanceEnabled,
        memoria: result,
        controllerRetention,
        gatewayTraceRetention,
        innerLifeRetention
      };
    } catch (error) {
      console.error("Memory maintenance scheduler failed:", error);
      notifyRuntimeChanged("memory-maintenance-error", {
        error: error.message || String(error)
      });
      return {
        ok: false,
        error: error.message || String(error)
      };
    } finally {
      memoryMaintenanceSchedulerBusy = false;
    }
  }

  function scheduleNextMemoryMaintenance(options = {}) {
    if (
      !memoryMaintenanceActive ||
      memoryMaintenanceScheduler ||
      memoryMaintenanceSchedulePromise ||
      isQuitting()
    ) {
      return memoryMaintenanceSchedulePromise || Promise.resolve();
    }
    const generation = memoryMaintenanceGeneration;
    const pending = (async () => {
      const requestedDelayMs = Number(options.delayMs);
      let delayMs;
      let scheduleError = null;
      if (Number.isFinite(requestedDelayMs) && requestedDelayMs >= 0) {
        delayMs = requestedDelayMs;
      } else {
        try {
          const { database } = await ensureProductCore(app);
          const settings = await database.getSettings();
          delayMs = nextMemoryMaintenanceDelayMs(settings, now());
        } catch (error) {
          scheduleError = error;
        }
      }
      if (
        !memoryMaintenanceActive ||
        generation !== memoryMaintenanceGeneration ||
        memoryMaintenanceScheduler ||
        isQuitting()
      ) {
        return;
      }
      if (scheduleError) {
        console.error("Failed to schedule Memoria maintenance:", scheduleError);
        memoryMaintenanceFailureCount += 1;
        delayMs = memoryMaintenanceRetryDelayMs(memoryMaintenanceFailureCount);
      }
      memoryMaintenanceScheduler = setMaintenanceTimeout(async () => {
        if (!memoryMaintenanceActive || generation !== memoryMaintenanceGeneration || isQuitting()) return;
        memoryMaintenanceScheduler = null;
        const outcome = await runMemoryMaintenanceScheduledTick();
        if (
          !memoryMaintenanceActive ||
          generation !== memoryMaintenanceGeneration ||
          isQuitting() ||
          outcome?.skipped === "quitting"
        ) {
          return;
        }
        if (outcome?.ok) {
          memoryMaintenanceFailureCount = 0;
          await scheduleNextMemoryMaintenance();
          return;
        }
        if (outcome?.skipped !== "busy") {
          memoryMaintenanceFailureCount += 1;
        }
        await scheduleNextMemoryMaintenance({
          delayMs: memoryMaintenanceRetryDelayMs(Math.max(1, memoryMaintenanceFailureCount))
        });
      }, delayMs);
      if (typeof memoryMaintenanceScheduler.unref === "function") memoryMaintenanceScheduler.unref();
    })();
    memoryMaintenanceSchedulePromise = pending;
    return pending.finally(() => {
      if (memoryMaintenanceSchedulePromise === pending) {
        memoryMaintenanceSchedulePromise = null;
      }
    });
  }

  function startMemoryMaintenance() {
    if (memoryMaintenanceActive) {
      return memoryMaintenanceSchedulePromise || Promise.resolve();
    }
    memoryMaintenanceActive = true;
    memoryMaintenanceGeneration += 1;
    return scheduleNextMemoryMaintenance().catch(console.error);
  }

  function stopMemoryMaintenance() {
    memoryMaintenanceActive = false;
    memoryMaintenanceGeneration += 1;
    memoryMaintenanceSchedulePromise = null;
    if (memoryMaintenanceScheduler) {
      clearMaintenanceTimeout(memoryMaintenanceScheduler);
      memoryMaintenanceScheduler = null;
    }
  }

  function rescheduleMemoryMaintenance() {
    stopMemoryMaintenance();
    memoryMaintenanceFailureCount = 0;
    return startMemoryMaintenance();
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
    runMemoryMaintenanceScheduledTick,
    scheduleNextMemoryMaintenance
  };
}

module.exports = {
  createSchedulers,
  memoryMaintenanceRetryDelayMs,
  nextMemoryMaintenanceDelayMs
};
