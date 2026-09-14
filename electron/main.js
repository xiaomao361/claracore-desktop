const { app, powerMonitor, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { PRODUCT_VERSION } = require("../core/version");
const { resolveListedModelName } = require("../core/model-provider-utils");
const { checkForUpdates, isAllowedUpdateUrl } = require("../core/update/github-release-client");
const { createHttpAgentGateway } = require("./http-agent-gateway");
const { createSchedulers } = require("./schedulers");
const { ipcChannel } = require("./ipc-contracts");
const { registerIpcHandlers } = require("./ipc-handlers");
const {
  getLoginItemPreference,
  setLoginItemPreference,
  shouldStartHiddenAtLogin
} = require("./login-item-settings");
const {
  isResourceWarning,
  systemMemorySnapshot
} = require("./resource-sampling");
const {
  buildProductOverviewSnapshot,
  ensureProductCore,
  ensureProductDirectories,
  getProductGatewayContext,
  resetCachedDatabase,
  runProductMemoryMaintenance,
  runProductScheduledBackup,
  saveProductSettings,
  tickProductInnerLifeDaemon,
  desktopSettingsPath,
  readDesktopSettings
} = require("../core/runtime");

const APP_ROOT = path.resolve(__dirname, "..");
const APP_ICON_PATH = path.join(APP_ROOT, "assets", "generated", "icon-512.png");
const TRAY_TEMPLATE_PATH = path.join(APP_ROOT, "assets", "generated", "tray-template-32.png");
const TRAY_COLOR_PATH = path.join(APP_ROOT, "assets", "generated", "tray-color-32.png");
const execFileAsync = promisify(execFile);

function applyCliEnvArgs(argv = process.argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--env") continue;
    const assignment = String(argv[index + 1] || "");
    const equalsIndex = assignment.indexOf("=");
    if (equalsIndex <= 0) continue;
    const key = assignment.slice(0, equalsIndex).trim();
    const value = assignment.slice(equalsIndex + 1);
    if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      process.env[key] = value;
    }
    index += 1;
  }
}

applyCliEnvArgs();

// Reject obsolete launch configs before creating any window or opening data.
if (process.argv.includes("--gateway")) {
  console.error("STDIO_MCP_REMOVED: Use the HTTP MCP connection from Desktop Agent Access.");
  process.exit(1);
}
if (process.env.CLARACORE_DESKTOP_TEST_INSTANCE === "1") {
  const isolatedUserDataDir = String(process.env.CLARACORE_DESKTOP_USER_DATA_DIR || "").trim();
  if (!isolatedUserDataDir) {
    throw new Error(
      "CLARACORE_DESKTOP_TEST_INSTANCE requires CLARACORE_DESKTOP_USER_DATA_DIR so tests cannot overwrite live Desktop configuration."
    );
  }
  app.setPath("userData", path.resolve(isolatedUserDataDir));
}
let mainWindow = null;
let tray = null;
let isQuitting = false;
let trayLanguage = "en";
let windowCloseBehavior = "hide";
let lastCpuSample = null;
let schedulers = null;
const appStartedAt = Date.now();
const RESOURCE_SAMPLE_MAX_AGE_MS = 10 * 60 * 1000;
let httpAgentGateway = null;
let forceQuitTimer = null;
const resourceMemorySamples = [];
let resourceSnapshotInFlight = null;
let uiPreferencesSaveQueue = Promise.resolve();

function reportMainProcessError(label, error) {
  const message = error?.stack || error?.message || String(error);
  console.error(`${label}:`, message);
}

process.on("unhandledRejection", (reason) => {
  reportMainProcessError("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  reportMainProcessError("Uncaught exception", error);
});

function defaultDataRoot() {
  return path.join(app.getPath("userData"), "data");
}

function currentDataRootPreference() {
  const settings = readDesktopSettings(app, { fresh: true });
  const configuredDataRoot = String(settings.dataRoot || "").trim();
  const envDataRoot = String(process.env.CLARACORE_DESKTOP_DATA_DIR || "").trim();
  const effectiveDataRoot = envDataRoot || configuredDataRoot || defaultDataRoot();
  return {
    configPath: desktopSettingsPath(app),
    defaultDataRoot: defaultDataRoot(),
    configuredDataRoot,
    envDataRoot,
    effectiveDataRoot: path.resolve(effectiveDataRoot),
    envOverride: Boolean(envDataRoot),
    canRelaunch: app.isPackaged
  };
}

async function saveDataRootPreference(dataRoot) {
  const nextDataRoot = String(dataRoot || "").trim();
  const activeDataRoot = (await ensureProductDirectories(app)).dataRoot;
  if (process.env.CLARACORE_DESKTOP_DATA_DIR) {
    return {
      ...currentDataRootPreference(),
      saved: false,
      restartRequired: false,
      message: "CLARACORE_DESKTOP_DATA_DIR is set for this process."
    };
  }
  const settings = readDesktopSettings(app, { fresh: true });
  const configPath = desktopSettingsPath(app);
  if (nextDataRoot) {
    settings.dataRoot = path.resolve(nextDataRoot);
    await fs.mkdir(settings.dataRoot, { recursive: true });
  } else {
    delete settings.dataRoot;
  }
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  const preference = currentDataRootPreference();
  return {
    ...preference,
    saved: true,
    restartRequired: path.resolve(activeDataRoot) !== path.resolve(preference.effectiveDataRoot)
  };
}

function defaultUiLanguage() {
  return String(app.getLocale?.() || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

function normalizeUiPreferences(preferences = {}, defaults = {}) {
  const language = preferences.language === "zh" || preferences.language === "en" ? preferences.language : undefined;
  const theme = ["system", "light", "dark"].includes(preferences.theme) ? preferences.theme : undefined;
  const closeBehavior = preferences.closeBehavior === "quit" || preferences.closeBehavior === "hide" ? preferences.closeBehavior : undefined;
  return {
    language: language || defaults.language || defaultUiLanguage(),
    theme: theme || defaults.theme || "system",
    closeBehavior: closeBehavior || defaults.closeBehavior || "hide"
  };
}

function getUiPreferences() {
  const settings = readDesktopSettings(app, { fresh: true });
  return {
    ...normalizeUiPreferences(settings.uiPreferences || {}),
    ...getLoginItemPreference(app, process.env.CLARACORE_DESKTOP_TEST_INSTANCE === "1" ? "test" : process.platform)
  };
}

async function saveUiPreferences(updates = {}) {
  const nextSave = uiPreferencesSaveQueue.catch(() => {}).then(async () => {
    const safeUpdates = updates && typeof updates === "object" && !Array.isArray(updates) ? updates : {};
    const settings = readDesktopSettings(app, { fresh: true });
    const nextPreferences = normalizeUiPreferences({
      ...(settings.uiPreferences || {}),
      ...safeUpdates
    }, getUiPreferences());
    settings.uiPreferences = nextPreferences;
    await fs.mkdir(path.dirname(desktopSettingsPath(app)), { recursive: true });
    await fs.writeFile(desktopSettingsPath(app), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    const loginItemPlatform = process.env.CLARACORE_DESKTOP_TEST_INSTANCE === "1" ? "test" : process.platform;
    const loginItemPreference = Object.prototype.hasOwnProperty.call(safeUpdates, "launchAtLogin")
      ? setLoginItemPreference(app, safeUpdates.launchAtLogin, loginItemPlatform)
      : getLoginItemPreference(app, loginItemPlatform);
    return { ...nextPreferences, ...loginItemPreference };
  });
  uiPreferencesSaveQueue = nextSave.catch(() => {});
  return nextSave;
}

const isTestInstance = process.env.CLARACORE_DESKTOP_TEST_INSTANCE === "1";
const hasSingleInstanceLock = isTestInstance || app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else if (!isTestInstance) {
  app.on("second-instance", () => {
    if (isQuitting) return;
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showMainWindow();
  });
}

const trayLabels = {
  en: {
    status: "Status: running",
    data: "Open data folder",
    show: "Show ClaraCore",
    hide: "Hide ClaraCore",
    quit: "Quit",
    tooltip: "ClaraCore Desktop"
  },
  zh: {
    status: "状态：运行中",
    data: "打开数据目录",
    show: "显示 ClaraCore",
    hide: "隐藏 ClaraCore",
    quit: "退出",
    tooltip: "ClaraCore 桌面"
  }
};

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

function sampleCpu() {
  const cpus = os.cpus();
  const totals = cpus.reduce(
    (acc, cpu) => {
      acc.idle += cpu.times.idle;
      acc.total += Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
      return acc;
    },
    { idle: 0, total: 0 }
  );
  const previous = lastCpuSample;
  lastCpuSample = totals;
  if (!previous) return null;
  const idleDelta = totals.idle - previous.idle;
  const totalDelta = totals.total - previous.total;
  if (totalDelta <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function formatBytesDelta(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  const prefix = bytes > 0 ? "+" : bytes < 0 ? "-" : "";
  return `${prefix}${formatBytes(Math.abs(bytes))}`;
}

function memoryTrend(samples, windowMs) {
  if (samples.length < 2) return { deltaBytes: 0, text: "0 B" };
  const latest = samples[samples.length - 1];
  const cutoff = latest.at - windowMs;
  const baseline = samples.find((sample) => sample.at >= cutoff) || samples[0];
  const deltaBytes = latest.totalRssBytes - baseline.totalRssBytes;
  return {
    deltaBytes,
    text: formatBytesDelta(deltaBytes)
  };
}

async function getRendererMemorySnapshot() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents?.getProcessMemoryInfo) {
    return null;
  }
  try {
    const info = await mainWindow.webContents.getProcessMemoryInfo();
    const rssBytes = Number(info?.workingSetSize || 0) * 1024;
    return {
      rssBytes,
      rssText: rssBytes > 0 ? formatBytes(rssBytes) : "-"
    };
  } catch (_error) {
    return null;
  }
}

function rememberResourceMemorySample(sample) {
  resourceMemorySamples.push(sample);
  const cutoff = sample.at - RESOURCE_SAMPLE_MAX_AGE_MS;
  while (resourceMemorySamples.length > 0 && resourceMemorySamples[0].at < cutoff) {
    resourceMemorySamples.shift();
  }
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

async function getDiskSnapshot(targetPath) {
  const candidates = [targetPath, path.dirname(targetPath), app.getPath("home")];
  for (const candidate of candidates) {
    try {
      const stats = await fs.statfs(candidate);
      const blockSize = stats.bsize || stats.frsize || 0;
      const total = stats.blocks * blockSize;
      const free = stats.bavail * blockSize;
      const used = Math.max(0, total - free);
      return {
        total,
        free,
        used,
        percent: total > 0 ? Math.round((used / total) * 100) : null,
        text: total > 0 ? `${formatBytes(used)} / ${formatBytes(total)}` : null
      };
    } catch (_error) {
      // Try the next parent path when the data directory has not been created yet.
    }
  }
  return {
    total: null,
    free: null,
    used: null,
    percent: null,
    text: null
  };
}

async function buildResourceSnapshot() {
  const dataRoot = (await ensureProductDirectories(app)).dataRoot;
  let electronMemory = null;
  if (typeof process.getSystemMemoryInfo === "function") {
    try {
      electronMemory = process.getSystemMemoryInfo();
    } catch (_error) {
      // Fall back to Node's portable counters when the Electron host cannot
      // provide its richer system-memory snapshot.
    }
  }
  const memory = electronMemory
    ? systemMemorySnapshot({
        ...electronMemory,
        platform: process.platform,
        source: "electron-system-memory",
        unit: "kilobytes"
      })
    : systemMemorySnapshot({
        total: os.totalmem(),
        free: os.freemem(),
        platform: process.platform,
        source: "node-os"
      });
  const memoryPercent = memory.percent;
  const mainMemory = process.memoryUsage();
  const [disk, rendererMemory] = await Promise.all([
    getDiskSnapshot(dataRoot),
    getRendererMemorySnapshot()
  ]);
  const warning = isResourceWarning({
    diskPercent: disk.percent,
    memoryPercent
  });
  // HTTP runs in the main process; do not double-count its RSS.
  const gatewayMemory = { rssBytes: 0, rssText: "-", processCount: 0, source: "shared-main-process" };
  const totalProcessRssBytes =
    mainMemory.rss +
    Number(rendererMemory?.rssBytes || 0) +
    Number(gatewayMemory?.rssBytes || 0);
  rememberResourceMemorySample({
    at: Date.now(),
    totalRssBytes: totalProcessRssBytes
  });
  const processMemory = {
    totalRssBytes: totalProcessRssBytes,
    totalRssText: formatBytes(totalProcessRssBytes),
    main: {
      rssBytes: mainMemory.rss,
      heapUsedBytes: mainMemory.heapUsed,
      externalBytes: mainMemory.external,
      rssText: formatBytes(mainMemory.rss),
      heapUsedText: formatBytes(mainMemory.heapUsed)
    },
    renderer: rendererMemory,
    gateway: gatewayMemory,
    trend: {
      oneMinute: memoryTrend(resourceMemorySamples, 60 * 1000),
      tenMinutes: memoryTrend(resourceMemorySamples, 10 * 60 * 1000),
      sampleCount: resourceMemorySamples.length
    }
  };
  return {
    appVersion: PRODUCT_VERSION,
    uptime: formatDuration(Date.now() - appStartedAt),
    cpuPercent: sampleCpu(),
    memory: {
      ...memory,
      percent: memoryPercent,
      text: `${formatBytes(memory.used)} / ${formatBytes(memory.total)}`
    },
    processMemory,
    disk,
    diagnosticProcessSample: collectGatewayProcessSample,
    warning,
    localTime: new Date().toLocaleString()
  };
}

function getResourceSnapshot() {
  if (resourceSnapshotInFlight) return resourceSnapshotInFlight;
  const request = buildResourceSnapshot().finally(() => {
    if (resourceSnapshotInFlight === request) resourceSnapshotInFlight = null;
  });
  resourceSnapshotInFlight = request;
  return request;
}

async function getRuntimeSnapshot() {
  const snapshot = await buildProductOverviewSnapshot(app);
  const connections = {
    ...snapshot.connections,
    httpEndpoints: httpAgentGateway ? httpAgentGateway.buildEndpoints() : [],
    httpGateway: httpAgentGateway ? httpAgentGateway.status() : null,
    gatewayStatus: httpAgentGateway?.status().ok ? "available" : "unavailable"
  };
  return {
    ...snapshot,
    connections,
    data: {
      ...snapshot.data,
      rootPresent: await exists(snapshot.data.root),
      databasePresent: await exists(snapshot.data.databasePath)
    },
    shell: {
      closeBehavior: windowCloseBehavior,
      hasTray: Boolean(tray),
      windowVisible: mainWindow ? mainWindow.isVisible() : false
    },
    runtime: {
      electron: process.versions.electron || "",
      node: process.versions.node || "",
      chrome: process.versions.chrome || "",
      packaged: app.isPackaged
    },
    modules: snapshot.modules.map((module) => ({
      ...module,
      servicePath: module.servicePath || (module.id === "memoria" ? snapshot.data.databasePath : "product core planned")
    }))
  };
}

function normalizeModelEndpoint(endpoint) {
  const raw = String(endpoint || "").trim();
  if (!raw) throw new Error("Endpoint is required.");
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Endpoint must use http or https.");
  }
  return url.toString().replace(/\/+$/, "");
}

function resolveApiKeyRef(apiKeyRef) {
  const ref = String(apiKeyRef || "").trim();
  if (!ref) return "";
  if (ref.startsWith("env:")) return process.env[ref.slice(4)] || "";
  return ref;
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function openAiModelsUrl(baseUrl) {
  const url = new URL(baseUrl);
  const pathName = url.pathname.replace(/\/+$/, "");
  if (pathName.endsWith("/v1")) return `${baseUrl}/models`;
  return `${baseUrl}/v1/models`;
}

function uniqueSortedModelNames(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

async function listConfiguredModels(input = {}) {
  const provider = String(input.provider || "").trim();
  if (["disabled", "claracore-built-in", "custom-command"].includes(provider)) {
    return { provider, models: [], supported: false };
  }
  const baseUrl = normalizeModelEndpoint(input.endpoint);
  if (provider === "ollama") {
    const payload = await fetchJsonWithTimeout(`${baseUrl}/api/tags`);
    const models = Array.isArray(payload.models) ? payload.models.map((item) => item.name || item.model) : [];
    const listedModels = uniqueSortedModelNames(models);
    return {
      provider,
      endpoint: baseUrl,
      models: listedModels,
      resolvedModel: resolveListedModelName(input.model, listedModels, provider),
      supported: true
    };
  }
  if (provider === "openai-compatible") {
    const apiKey = resolveApiKeyRef(input.apiKeyRef);
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const payload = await fetchJsonWithTimeout(openAiModelsUrl(baseUrl), { headers });
    const models = Array.isArray(payload.data) ? payload.data.map((item) => item.id || item.name) : [];
    const listedModels = uniqueSortedModelNames(models);
    return {
      provider,
      endpoint: baseUrl,
      models: listedModels,
      resolvedModel: resolveListedModelName(input.model, listedModels, provider),
      supported: true
    };
  }
  return { provider, endpoint: baseUrl, models: [], supported: false };
}

async function testConfiguredModel(input = {}) {
  const provider = String(input.provider || "").trim();
  const model = String(input.model || "").trim();
  if (["disabled", "claracore-built-in", "custom-command"].includes(provider)) {
    return {
      provider,
      model,
      ok: false,
      supported: false,
      checkedAt: new Date().toISOString(),
      error: "Connection testing is not available for this provider."
    };
  }
  if (!model) {
    return {
      provider,
      model,
      ok: false,
      supported: true,
      checkedAt: new Date().toISOString(),
      error: "Select a model before testing the connection."
    };
  }
  const result = await listConfiguredModels(input);
  const models = Array.isArray(result.models) ? result.models : [];
  const resolvedModel = result.resolvedModel || "";
  const found = Boolean(resolvedModel);
  return {
    provider,
    endpoint: result.endpoint,
    model,
    resolvedModel,
    ok: found,
    supported: result.supported !== false,
    checkedAt: new Date().toISOString(),
    modelCount: models.length,
    error: found ? "" : `Endpoint reachable, but model "${model}" was not listed.`
  };
}


function forceExitIfQuitStalls() {
  if (forceQuitTimer) return;
  forceQuitTimer = setTimeout(() => {
    app.exit(0);
  }, 1500);
}

function createTrayIcon() {
  const sourcePath = process.platform === "darwin" ? TRAY_TEMPLATE_PATH : TRAY_COLOR_PATH;
  let image = nativeImage.createFromPath(sourcePath);
  if (image.isEmpty()) image = nativeImage.createFromPath(TRAY_COLOR_PATH);
  image = image.resize({ width: 20, height: 20 });
  image.setTemplateImage(process.platform === "darwin");
  return image;
}

async function showMainWindow() {
  if (!mainWindow) return;
  if (process.platform === "darwin") {
    if (typeof app.setActivationPolicy === "function") {
      app.setActivationPolicy("regular");
    }
    if (app.dock && typeof app.dock.show === "function") {
      await app.dock.show();
    }
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindowToTray() {
  if (!mainWindow) return;
  mainWindow.hide();
  if (process.platform === "darwin") {
    if (typeof app.setActivationPolicy === "function") {
      app.setActivationPolicy("accessory");
    }
    if (app.dock && typeof app.dock.hide === "function") {
      app.dock.hide();
    }
  }
}

function toggleMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    hideMainWindowToTray();
  } else {
    showMainWindow();
  }
}

function updateTrayMenu(language = trayLanguage) {
  trayLanguage = trayLabels[language] ? language : "en";
  if (!tray) return;
  const labels = trayLabels[trayLanguage];
  tray.setToolTip(labels.tooltip);
  if (process.platform === "darwin" && typeof tray.setTitle === "function") {
    tray.setTitle("");
  }
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: labels.status, enabled: false },
      { type: "separator" },
      { label: labels.show, click: showMainWindow },
      {
        label: labels.hide,
        click() {
          hideMainWindowToTray();
        }
      },
      {
        label: labels.data,
        async click() {
          const { dataRoot } = await ensureProductDirectories(app);
          await shell.openPath(dataRoot);
        }
      },
      { type: "separator" },
      {
        label: labels.quit,
        click() {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
}

function createTray() {
  if (tray) return;
  tray = new Tray(createTrayIcon());
  tray.on("click", toggleMainWindow);
  tray.on("double-click", showMainWindow);
  updateTrayMenu();
}

function createWindow({ show = true } = {}) {
  mainWindow = new BrowserWindow({
    show,
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 640,
    title: "ClaraCore Desktop",
    icon: APP_ICON_PATH,
    backgroundColor: "#f7f7f4",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    if (windowCloseBehavior === "quit") {
      isQuitting = true;
      app.quit();
      return;
    }
    event.preventDefault();
    hideMainWindowToTray();
  });

  mainWindow.loadFile(path.join(APP_ROOT, "index.html"));
}

function runtimeChangeScopes(reason) {
  if (reason === "product-json-import" || reason === "demo-data") {
    return ["snapshot", "memory", "shared-line", "innerlife", "logs", "data"];
  }
  if (reason.startsWith("memory-maintenance")) {
    return ["snapshot", "memory", "innerlife", "logs"];
  }
  if (reason.startsWith("innerlife-session-afterthought")) {
    return ["snapshot", "innerlife", "logs"];
  }
  if (reason.startsWith("memory-") || reason === "old-memoria-import") return ["snapshot", "memory"];
  if (reason.startsWith("innerlife-") || reason === "old-innerlife-import") return ["snapshot", "innerlife"];
  if (reason === "old-continuity-import") return ["snapshot", "shared-line"];
  if (reason === "logs-clear") return ["snapshot", "logs"];
  if (reason === "runtime-resume") return ["snapshot", "memory", "shared-line", "innerlife", "trace", "data"];
  if (reason.startsWith("backup-")) return ["snapshot", "data"];
  if (reason.startsWith("agent-gateway-")) return ["snapshot", "agent-setup", "logs"];
  return ["snapshot"];
}

function notifyRuntimeChanged(reason, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(ipcChannel("runtimeChanged"), {
    reason,
    scopes: runtimeChangeScopes(reason),
    ...payload
  });
}

if (hasSingleInstanceLock) {
  registerIpcHandlers({
    app,
    clipboard,
    checkForUpdates: () => checkForUpdates({ currentVersion: PRODUCT_VERSION }),
    currentDataRootPreference,
    dialog,
    getMainWindow: () => mainWindow,
    getResourceSnapshot,
    getRuntimeSnapshot,
    getTray: () => tray,
    getTrayLanguage: () => trayLanguage,
    ipcMain,
    listConfiguredModels,
    testConfiguredModel,
    notifyRuntimeChanged,
    rescheduleMemoryMaintenance: () => {
      if (schedulers) schedulers.rescheduleMemoryMaintenance();
    },
    rotateAgentGatewayToken: async () => {
      if (!httpAgentGateway) return false;
      const result = await httpAgentGateway.rotateToken();
      notifyRuntimeChanged("agent-gateway-token-rotated");
      return result;
    },
    updateAgentGatewayConfig: async (input = {}) => {
      if (!httpAgentGateway) return false;
      const result = await httpAgentGateway.updateConfig(input);
      notifyRuntimeChanged("agent-gateway-config-updated");
      return result;
    },
    saveDataRootPreference,
    getUiPreferences,
    saveUiPreferences,
    setWindowCloseBehavior: (preferences = {}) => {
      windowCloseBehavior = preferences.closeBehavior === "quit" ? "quit" : "hide";
      return { closeBehavior: windowCloseBehavior };
    },
    shell,
    isAllowedUpdateUrl,
    updateTrayMenu
  });

  app.whenReady()
    .then(async () => {
      const startHidden = shouldStartHiddenAtLogin(app, process.platform, { isTestInstance });
      const { database } = await ensureProductCore(app);
      httpAgentGateway = createHttpAgentGateway({
        app,
        ensureProductCore,
        getRuntimeSnapshot,
        getProductGatewayContext,
        port: isTestInstance ? 0 : undefined
      });
      await httpAgentGateway.start();
      await database.recordRuntimeEvent({
        level: "info",
        source: "desktop",
        message: "ClaraCore Desktop started",
        metadata: {
          version: PRODUCT_VERSION,
          packaged: app.isPackaged,
          platform: process.platform,
          startedHidden: startHidden
        }
      });
      if (startHidden && process.platform === "darwin" && typeof app.setActivationPolicy === "function") {
        app.setActivationPolicy("accessory");
      }
      createWindow({ show: !startHidden });
      createTray();
      if (startHidden) hideMainWindowToTray();
      // Leave the owner absent so settings changes cannot restart trial jobs.
      if (!(isTestInstance && process.env.CLARACORE_DESKTOP_DISABLE_SCHEDULERS === "1")) {
        schedulers = createSchedulers({
          app, powerMonitor, ensureProductCore, isQuitting: () => isQuitting, notifyRuntimeChanged,
          runProductMemoryMaintenance, runProductScheduledBackup, saveProductSettings, tickProductInnerLifeDaemon
        });
        schedulers.start();
      }

      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        showMainWindow();
      });
    })
    .catch((error) => {
      reportMainProcessError("ClaraCore Desktop startup failed", error);
      dialog.showErrorBox("ClaraCore Desktop startup failed", error?.message || String(error));
      app.quit();
    });

  app.on("window-all-closed", () => {
    if (!tray && process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    isQuitting = true;
    forceExitIfQuitStalls();
    if (httpAgentGateway) httpAgentGateway.stop();
    if (schedulers) schedulers.stop();
    resetCachedDatabase().catch((error) => {
      console.error("Failed to close Product Core:", error);
    });
  });
  app.on("will-quit", () => {
    if (forceQuitTimer) {
      clearTimeout(forceQuitTimer);
      forceQuitTimer = null;
    }
  });
}
