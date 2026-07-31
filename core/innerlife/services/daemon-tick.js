const DAEMON_TICK_PORTS = [
  "completeFailure",
  "completeIdle",
  "completeSuccess",
  "ensureDaemonState",
  "getLockKey",
  "getSettings",
  "getSnapshot",
  "ingestSources",
  "innerLifeRetrySeconds",
  "isDaemonDue",
  "listPendingInbox",
  "listPendingInboxPage",
  "markRunning",
  "processOnce",
  "resolveAgentIdentity"
];

function createInnerLifeDaemonTickService(inputPorts = {}) {
  const missingPorts = DAEMON_TICK_PORTS.filter((name) => typeof inputPorts[name] !== "function");
  if (missingPorts.length) {
    throw new Error(`InnerLife daemon tick service requires ports: ${missingPorts.join(", ")}.`);
  }

  const ports = Object.freeze({ ...inputPorts });
  const activeTicks = new Map();

  return async function tickInnerLifeDaemon(database, input = {}) {
    const requestedAgentId = ports.resolveAgentIdentity(input || {}).id;
    const includeSnapshot = input.includeSnapshot !== false;
    const snapshotIfRequested = async () => (
      includeSnapshot ? ports.getSnapshot(database, requestedAgentId) : undefined
    );
    const force = Boolean(input.force);

    if (!includeSnapshot && !force) {
      const settings = await ports.getSettings(database);
      if (!settings["innerlife.enabled"]) {
        return {
          ran: false,
          reason: "paused",
          daemon: {
            agentId: requestedAgentId,
            status: "paused",
            enabled: false
          }
        };
      }
    }

    const hasExplicitAgent = Boolean(
      input?.agentId ||
      input?.agent_id ||
      input?.agent ||
      input?.agentTool ||
      input?.agent_tool ||
      input?.agentName ||
      input?.agent_name
    );
    const firstPendingInbox = await ports.listPendingInbox(database, "pending", 1);
    const agentId = !hasExplicitAgent && firstPendingInbox[0]?.agentId
      ? firstPendingInbox[0].agentId
      : requestedAgentId;
    let pendingInboxPage = await ports.listPendingInboxPage(database, {
      agentId,
      status: "pending",
      limit: 5,
      offset: 0
    });
    let pendingInbox = pendingInboxPage.items;
    const lockKey = ports.getLockKey(database, agentId);

    if (activeTicks.get(lockKey)) {
      return {
        ran: false,
        reason: "running",
        daemon: await ports.ensureDaemonState(database, agentId),
        snapshot: await snapshotIfRequested()
      };
    }

    activeTicks.set(lockKey, true);
    try {
      const state = await ports.ensureDaemonState(database, agentId);
      if (!state.enabled || state.status === "paused") {
        return {
          ran: false,
          reason: "paused",
          daemon: state,
          snapshot: await snapshotIfRequested()
        };
      }

      const due = await ports.isDaemonDue(database, agentId);
      if (!force && !due) {
        return {
          ran: false,
          reason: "not_due",
          daemon: state,
          snapshot: await snapshotIfRequested()
        };
      }

      const settings = await ports.getSettings(database);
      const pollSeconds = Math.max(
        1,
        Number.parseInt(String(settings["innerlife.loop_seconds"] || 900), 10) || 900
      );
      const sourceIngest = await ports.ingestSources(database, { agentId, maxItems: 5 });
      if (sourceIngest.insertedCount > 0) {
        pendingInboxPage = await ports.listPendingInboxPage(database, {
          agentId,
          status: "pending",
          limit: 5,
          offset: 0
        });
        pendingInbox = pendingInboxPage.items;
      }

      if (pendingInbox.length === 0) {
        await ports.completeIdle(database, { agentId, pollSeconds, sourceIngest });
        return {
          ran: false,
          reason: "idle",
          daemon: await ports.ensureDaemonState(database, agentId),
          snapshot: await snapshotIfRequested()
        };
      }

      await ports.markRunning(database, agentId);
      try {
        const result = await ports.processOnce(database, {
          agentId,
          lineId: input.lineId || input.line_id || "",
          prompt: "Daemon tick: digest pending inbox and create only one shareable thought for the next fitting moment."
        });
        await ports.completeSuccess(database, {
          agentId,
          pendingInboxCount: pendingInbox.length,
          pollSeconds,
          result,
          sourceIngest
        });
        return {
          ran: true,
          reason: "processed",
          result,
          daemon: await ports.ensureDaemonState(database, agentId),
          snapshot: await ports.getSnapshot(database, agentId)
        };
      } catch (error) {
        const failureCount =
          Math.max(0, Number.parseInt(String(state.metadata?.failureCount || 0), 10) || 0) + 1;
        const retrySeconds = ports.innerLifeRetrySeconds(pollSeconds, failureCount);
        await ports.completeFailure(database, {
          agentId,
          error: error.message || String(error),
          failureCount,
          pendingInboxCount: pendingInbox.length,
          pollSeconds,
          retrySeconds
        });
        throw error;
      }
    } finally {
      activeTicks.delete(lockKey);
    }
  };
}

module.exports = {
  DAEMON_TICK_PORTS,
  createInnerLifeDaemonTickService
};
