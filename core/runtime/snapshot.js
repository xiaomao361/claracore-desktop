const path = require("path");
const fs = require("fs/promises");
const { previewImportSources } = require("../import-preview");
const { PRODUCT_VERSION } = require("../version");
const { buildFlavorInfo } = require("../build-flavor");
const { buildDecayAudit } = require("./decay");
const { readDesktopSettings } = require("./paths");

function productModules(input = {}) {
  const innerLife = input.innerLife || {};
  const daemon = innerLife.daemon || {};
  const innerLifePresent = Boolean(innerLife.counts || daemon.agentId);
  return [
    {
      id: "gateway",
      label: "Gateway",
      descriptionKey: "module.gateway.description",
      required: true,
      present: true,
      state: "ready"
    },
    {
      id: "memoria",
      label: "Memoria",
      descriptionKey: "module.memoria.description",
      required: true,
      present: true,
      state: "ready"
    },
    {
      id: "continuity",
      label: "Continuity",
      descriptionKey: "module.continuity.description",
      required: true,
      present: true,
      state: "ready"
    },
    {
      id: "innerlife",
      label: "InnerLife",
      descriptionKey: "module.innerlife.description",
      required: true,
      present: innerLifePresent,
      state: daemon.enabled ? "ready" : "paused"
    }
  ];
}

function gatewayLaunchConfig(app, paths) {
  const gatewayScript = path.join(paths.appRoot, "core", "gateway", "mcp-server.js");
  if (app?.isPackaged) {
    // ELECTRON_RUN_AS_NODE keeps the Gateway a single Node process instead of
    // a full Electron instance with GPU and network helper processes.
    return {
      command: process.execPath,
      args: [gatewayScript],
      env: { ELECTRON_RUN_AS_NODE: "1" },
      displayCommand: `ELECTRON_RUN_AS_NODE=1 "${process.execPath}" "${gatewayScript}"`,
      source: "packaged app"
    };
  }
  return {
    command: "node",
    args: [gatewayScript],
    env: {},
    displayCommand: `node ${gatewayScript}`,
    source: "development checkout"
  };
}

function productAgentSetup(app, paths) {
  const launch = gatewayLaunchConfig(app, paths);
  const agentIdentityExamples = ["lara", "clara", "codex"];
  return {
    gatewayStatus: "available",
    mcpServerName: "claracore-desktop",
    mcpCommand: launch.displayCommand,
    agentIdentity: {
      envKey: "CLARACORE_AGENT_ID",
      required: true,
      owner: "calling agent",
      examples: agentIdentityExamples,
      note: "Each connected agent must set its own stable id. Do not reuse another agent id."
    },
    mcpConfig: JSON.stringify(
      {
        mcpServers: {
          "claracore-desktop": {
            type: "stdio",
            command: launch.command,
            args: launch.args,
            env: {
              ...launch.env,
              CLARACORE_AGENT_ID: "<agent-stable-id>",
              CLARACORE_CLIENT_ID: "<codex-app|claude-code|hermes>",
              CLARACORE_CONVERSATION_ID: "<optional-host-conversation-id>",
              CLARACORE_DESKTOP_DATA_DIR: paths.dataRoot
            }
          }
        }
      },
      null,
      2
    ),
    httpEndpoints: [],
    python: "not required for Desktop Gateway",
    pythonSource: "Node/Electron runtime",
    gatewayEnvPath: "not used in product core reset"
  };
}

async function canWriteRuntimeProbe(paths) {
  const probePath = path.join(paths.runtimeDir, ".write-check");
  try {
    await fs.writeFile(probePath, String(Date.now()), "utf8");
    await fs.unlink(probePath);
    return true;
  } catch (_error) {
    return false;
  }
}

function buildHealthChecks(app, paths, configuration, databaseSummary, canWriteRuntime) {
  const embeddingProvider = configuration?.memoria?.provider || "unknown";
  const embeddingReady =
    (embeddingProvider === "claracore-built-in" && configuration?.memoria?.providerSupported !== false) ||
    embeddingProvider === "disabled" ||
    (embeddingProvider === "ollama" && Boolean(configuration?.memoria?.endpoint) && Boolean(configuration?.memoria?.model));
  const checks = [
    {
      id: "data-root",
      level: canWriteRuntime ? "ok" : "error",
      labelKey: "health.dataRoot",
      detail: canWriteRuntime ? paths.dataRoot : `${paths.dataRoot} is not writable`
    },
    {
      id: "database",
      level: databaseSummary?.initialized ? "ok" : "warn",
      labelKey: "health.database",
      detail: paths.databasePath
    },
    {
      id: "gateway",
      level: "ok",
      labelKey: "health.gateway",
      detail: app?.isPackaged ? "packaged stdio gateway" : "development stdio gateway"
    },
    {
      id: "embedding",
      level: embeddingReady ? "ok" : "warn",
      labelKey: "health.embedding",
      detail: `${embeddingProvider} ${configuration?.memoria?.model || ""}`.trim()
    }
  ];
  return {
    status: checks.some((check) => check.level === "error")
      ? "error"
      : checks.some((check) => check.level === "warn")
        ? "warn"
        : "ok",
    checks
  };
}

function createSnapshotRuntime({ ensureProductCore }) {
  async function buildProductSnapshot(app) {
    const { paths, database } = await ensureProductCore(app);
    const desktopSettings = readDesktopSettings(app);
    const [configuration, databaseSummary] = await Promise.all([
      database.getConfiguration(paths),
      database.getSummary()
    ]);
    const [
      recentMemories, memoryStats, memoryMaintenance,
      sharedLine, innerLife, trace, memoryControllerEvidence, decayAudit, gatewayTraces, agentActivitySummary, runtimeEvents, backups,
      importPreview, canWriteProbe
    ] = await Promise.all([
      database.listMemories(20),
      database.getMemoryStats(),
      database.getMemoryMaintenanceReport(),
      database.getResumePacket(),
      database.getInnerLifeSnapshot(),
      database.getTraceSnapshot(),
      database.getMemoryControlObservationSnapshot({ limit: 10 }),
      buildDecayAudit(database),
      database.listGatewayTraces({ limit: 20 }),
      database.getAgentActivitySummary(),
      database.listRuntimeEvents({ limit: 50 }),
      database.listBackups(5),
      previewImportSources(),
      canWriteRuntimeProbe(paths)
    ]);
    const health = buildHealthChecks(app, paths, configuration, databaseSummary, canWriteProbe);
    return {
      mode: process.env.CLARACORE_DESKTOP_DATA_DIR || desktopSettings.dataRoot ? "custom-product-data" : "isolated-product-dev",
      productVersion: PRODUCT_VERSION,
      build: buildFlavorInfo(),
      root: paths.appRoot,
      appRoot: paths.appRoot,
      coreStatus: health.status === "ok" ? "Ready" : "Needs attention",
      data: {
        root: paths.dataRoot,
        databasePath: paths.databasePath,
        databasePresent: Boolean(databaseSummary.initialized),
        backupsDir: paths.backupsDir,
        exportsDir: paths.exportsDir,
        runtimeDir: paths.runtimeDir,
        logsDir: paths.logsDir
      },
      database: databaseSummary,
      health,
      connections: productAgentSetup(app, paths),
      configuration,
      memories: recentMemories,
      recentMemories,
      memoryStats,
      memoryMaintenance,
      sharedLine,
      innerLife,
      trace,
      memoryController: {
        mode: configuration.memoryController?.mode || "off",
        ...memoryControllerEvidence
      },
      decayAudit,
      gatewayTraces,
      agentActivitySummary,
      runtimeEvents,
      importPreview,
      backups,
      modules: productModules({ innerLife }),
      plans: {
        productReset: path.join(paths.appRoot, "docs", "ARCHITECTURE.md"),
        v02Legacy: path.join(paths.appRoot, "docs", "CODE_MAP.md")
      }
    };
  }

  return {
    buildProductSnapshot
  };
}

module.exports = {
  createSnapshotRuntime
};
