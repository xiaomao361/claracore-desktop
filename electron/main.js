const { app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");
const http = require("http");
const crypto = require("crypto");
const { PRODUCT_VERSION } = require("../core/version");
const {
  applyProductInnerLifeShareToMemory,
  applyProductInnerLifeShareToSharedLine,
  buildProductSnapshot,
  checkProductInnerLifeShareTiming,
  activateProductSharedLine,
  archiveProductDormantMemories,
  archiveProductMemory,
  archiveProductSharedLine,
  clearProductLogs,
  createProductBackup,
  createProductMemory,
  createProductMemoryLabelAlias,
  createProductMemoryRecord,
  createProductSharedLine,
  createProductSharedLineHandoff,
  deleteProductBackup,
  deleteProductMemory,
  deleteProductMemoryLabelAlias,
  embedProductMemory,
  ensureProductCore,
  ensureProductDirectories,
  exportProductDataJson,
  exportProductMemoryArchive,
  getProductGatewayContext,
  getProductMemories,
  getProductInnerLife,
  getProductInnerLifeDigestRuns,
  getProductImportPreview,
  getProductInnerLifeInbox,
  getProductArchivedMemories,
  getProductMemoryArchiveSuggestions,
  getProductDeletedMemories,
  getProductMemoryLabelAliases,
  getProductMemoryGraph,
  getProductMemoryMaintenance,
  getProductMemoryMergeSuggestions,
  getProductMemoryRecords,
  getProductMemoryStats,
  getProductRestrictedMemories,
  getProductSharedLine,
  getProductInnerLifeSessions,
  importProductDataJson,
  importProductMemoryArchive,
  importOldContinuityIntoProduct,
  importOldInnerLifeIntoProduct,
  importOldMemoriaIntoProduct,
  markProductInnerLifeShare,
  mergeProductMemories,
  previewProductRestore,
  processProductMemoryEmbeddings,
  processProductInnerLifeOnce,
  reviewProductInnerLifeShare,
  renameProductSharedLine,
  restoreProductBackup,
  restoreArchivedProductMemory,
  restoreProductMemory,
  restoreProductSharedLine,
  restrictProductMemory,
  runProductInnerLifeDigest,
  runProductMemoryMaintenance,
  setProductInnerLifeDaemon,
  saveProductSettings,
  saveProductSharedLine,
  searchProductMemories,
  submitProductInnerLifeInbox,
  tickProductInnerLifeDaemon,
  startProductInnerLifeSession,
  endProductInnerLifeSession,
  unrestrictProductMemory,
  updateProductMemory,
  desktopSettingsPath,
  readDesktopSettings
} = require("../core/runtime");

const APP_ROOT = path.resolve(__dirname, "..");
const APP_ICON_PATH = path.join(APP_ROOT, "assets", "generated", "icon-512.png");
const TRAY_TEMPLATE_PATH = path.join(APP_ROOT, "assets", "generated", "tray-template-32.png");
const TRAY_COLOR_PATH = path.join(APP_ROOT, "assets", "generated", "tray-color-32.png");
const isGatewayMode = process.argv.includes("--gateway");
let mainWindow = null;
let tray = null;
let isQuitting = false;
let trayLanguage = "en";
let windowCloseBehavior = "hide";
let lastCpuSample = null;
let innerLifeScheduler = null;
let innerLifeSchedulerBusy = false;
let memoryMaintenanceScheduler = null;
let memoryMaintenanceSchedulerBusy = false;
const appStartedAt = Date.now();
const httpAgentGateway = {
  host: "127.0.0.1",
  server: null,
  port: null,
  token: crypto.randomBytes(32).toString("base64url")
};

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

if (isGatewayMode) {
  require("../core/gateway/mcp-server").start();
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

async function getResourceSnapshot() {
  const dataRoot = (await ensureProductDirectories(app)).dataRoot;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const disk = await getDiskSnapshot(dataRoot);
  return {
    appVersion: PRODUCT_VERSION,
    uptime: formatDuration(Date.now() - appStartedAt),
    cpuPercent: sampleCpu(),
    memory: {
      total: totalMem,
      used: usedMem,
      percent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : null,
      text: `${formatBytes(usedMem)} / ${formatBytes(totalMem)}`
    },
    disk,
    localTime: new Date().toLocaleString()
  };
}

async function getRuntimeSnapshot() {
  const snapshot = await buildProductSnapshot(app);
  const connections = {
    ...snapshot.connections,
    httpEndpoints: buildHttpAgentEndpoints()
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
    return { provider, endpoint: baseUrl, models: uniqueSortedModelNames(models), supported: true };
  }
  if (provider === "openai-compatible") {
    const apiKey = resolveApiKeyRef(input.apiKeyRef);
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const payload = await fetchJsonWithTimeout(openAiModelsUrl(baseUrl), { headers });
    const models = Array.isArray(payload.data) ? payload.data.map((item) => item.id || item.name) : [];
    return { provider, endpoint: baseUrl, models: uniqueSortedModelNames(models), supported: true };
  }
  return { provider, endpoint: baseUrl, models: [], supported: false };
}

function httpAgentBaseUrl() {
  if (!httpAgentGateway.port) return null;
  return `http://${httpAgentGateway.host}:${httpAgentGateway.port}`;
}

function buildHttpAgentEndpoints() {
  const baseUrl = httpAgentBaseUrl();
  if (!baseUrl) return [];
  return [
    {
      id: "agent-setup-json",
      method: "GET",
      url: `${baseUrl}/agent/setup`,
      openUrl: `${baseUrl}/agent/setup?token=${encodeURIComponent(httpAgentGateway.token)}`,
      copyUrl: `${baseUrl}/agent/setup?token=${encodeURIComponent(httpAgentGateway.token)}`,
      healthUrl: `${baseUrl}/health`,
      auth: "bearer-token",
      authHeader: `Authorization: Bearer ${httpAgentGateway.token}`,
      bind: httpAgentGateway.host
    },
    {
      id: "gateway-context-json",
      method: "GET",
      url: `${baseUrl}/gateway/context`,
      openUrl: `${baseUrl}/gateway/context?token=${encodeURIComponent(httpAgentGateway.token)}`,
      copyUrl: `${baseUrl}/gateway/context?token=${encodeURIComponent(httpAgentGateway.token)}`,
      healthUrl: `${baseUrl}/health`,
      auth: "bearer-token",
      authHeader: `Authorization: Bearer ${httpAgentGateway.token}`,
      bind: httpAgentGateway.host
    }
  ];
}

function sendHttpJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "authorization, content-type"
  });
  response.end(body);
}

function isHttpAgentRequestAuthorized(request, requestUrl) {
  const authorization = request.headers.authorization || "";
  const token = requestUrl.searchParams.get("token") || "";
  return authorization === `Bearer ${httpAgentGateway.token}` || token === httpAgentGateway.token;
}

async function handleHttpAgentRequest(request, response) {
  const baseUrl = httpAgentBaseUrl() || `http://${httpAgentGateway.host}:0`;
  const requestUrl = new URL(request.url || "/", baseUrl);
  if (request.method === "OPTIONS") {
    sendHttpJson(response, 204, {});
    return;
  }
  if (request.method !== "GET") {
    sendHttpJson(response, 405, { error: "method_not_allowed" });
    return;
  }
  if (requestUrl.pathname === "/health") {
    sendHttpJson(response, 200, {
      ok: true,
      product: "ClaraCore Desktop",
      bind: httpAgentGateway.host
    });
    return;
  }
  if (!isHttpAgentRequestAuthorized(request, requestUrl)) {
    sendHttpJson(response, 401, {
      error: "unauthorized",
      message: "Use Authorization: Bearer <token> from Agent Access."
    });
    return;
  }
  if (requestUrl.pathname === "/agent/setup") {
    const snapshot = await getRuntimeSnapshot();
    sendHttpJson(response, 200, {
      product: "ClaraCore Desktop",
      principle: "Agent-first: software is built for agents to operate and for humans to inspect.",
      connectionMode: {
        current: "localhost-http-url",
        bind: httpAgentGateway.host,
        port: httpAgentGateway.port,
        portPolicy: "runtime-assigned; do not hard-code across app sessions",
        lan: "disabled-by-default"
      },
      auth: {
        type: "bearer",
        header: `Authorization: Bearer ${httpAgentGateway.token}`
      },
      endpoints: buildHttpAgentEndpoints().map((endpoint) => ({
        id: endpoint.id,
        method: endpoint.method,
        url: endpoint.url,
        healthUrl: endpoint.healthUrl,
        auth: endpoint.auth
      })),
      mcp: {
        serverName: snapshot.connections.mcpServerName,
        command: snapshot.connections.mcpCommand,
        config: JSON.parse(snapshot.connections.mcpConfig)
      },
      firstCall: "GET /gateway/context with the bearer token, or call gateway_context through MCP."
    });
    return;
  }
  if (requestUrl.pathname === "/gateway/context") {
    const agentId = requestUrl.searchParams.get("agentId") || process.env.CLARACORE_AGENT_ID || "http-agent";
    sendHttpJson(response, 200, await getProductGatewayContext(app, { agentId }));
    return;
  }
  sendHttpJson(response, 404, { error: "not_found" });
}

async function startHttpAgentGateway() {
  if (httpAgentGateway.server) return;
  httpAgentGateway.server = http.createServer((request, response) => {
    handleHttpAgentRequest(request, response).catch((error) => {
      sendHttpJson(response, 500, {
        error: "internal_error",
        message: error?.message || String(error)
      });
    });
  });
  await new Promise((resolve, reject) => {
    httpAgentGateway.server.once("error", reject);
    httpAgentGateway.server.listen(0, httpAgentGateway.host, () => {
      httpAgentGateway.port = httpAgentGateway.server.address().port;
      httpAgentGateway.server.off("error", reject);
      resolve();
    });
  });
}

function stopHttpAgentGateway() {
  if (!httpAgentGateway.server) return;
  httpAgentGateway.server.close();
  httpAgentGateway.server = null;
  httpAgentGateway.port = null;
}

function createTrayIcon() {
  const sourcePath = process.platform === "darwin" ? TRAY_TEMPLATE_PATH : TRAY_COLOR_PATH;
  let image = nativeImage.createFromPath(sourcePath);
  if (image.isEmpty()) image = nativeImage.createFromPath(TRAY_COLOR_PATH);
  image = image.resize({ width: 20, height: 20 });
  image.setTemplateImage(process.platform === "darwin");
  return image;
}

function showMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
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
          if (mainWindow) mainWindow.hide();
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

function createWindow() {
  mainWindow = new BrowserWindow({
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
      sandbox: false
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
    mainWindow.hide();
  });

  mainWindow.loadFile(path.join(APP_ROOT, "index.html"));
}

function notifyRuntimeChanged(reason, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("claracore:runtimeChanged", {
    reason,
    ...payload
  });
}

async function runInnerLifeScheduledTick() {
  if (innerLifeSchedulerBusy || isQuitting) return;
  innerLifeSchedulerBusy = true;
  try {
    const result = await tickProductInnerLifeDaemon(app, { force: false });
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

function startInnerLifeScheduler() {
  if (innerLifeScheduler) return;
  innerLifeScheduler = setInterval(() => {
    runInnerLifeScheduledTick().catch(console.error);
  }, 1000);
  if (typeof innerLifeScheduler.unref === "function") innerLifeScheduler.unref();
}

function stopInnerLifeScheduler() {
  if (!innerLifeScheduler) return;
  clearInterval(innerLifeScheduler);
  innerLifeScheduler = null;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function runMemoryMaintenanceScheduledTick() {
  if (memoryMaintenanceSchedulerBusy || isQuitting) return;
  memoryMaintenanceSchedulerBusy = true;
  try {
    const { database } = await ensureProductCore(app);
    const settings = await database.getSettings();
    if (settings["memory.maintenance.enabled"] === false) return;
    const hour = Math.max(0, Math.min(23, Number.parseInt(String(settings["memory.maintenance.hour"] ?? 3), 10) || 3));
    const now = new Date();
    const today = localDateKey(now);
    if (String(settings["memory.maintenance.last_run_date"] || "") === today) return;
    if (now.getHours() < hour) return;
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

function startMemoryMaintenanceScheduler() {
  if (memoryMaintenanceScheduler) return;
  memoryMaintenanceScheduler = setInterval(() => {
    runMemoryMaintenanceScheduledTick().catch(console.error);
  }, 60 * 1000);
  if (typeof memoryMaintenanceScheduler.unref === "function") memoryMaintenanceScheduler.unref();
  runMemoryMaintenanceScheduledTick().catch(console.error);
}

function stopMemoryMaintenanceScheduler() {
  if (!memoryMaintenanceScheduler) return;
  clearInterval(memoryMaintenanceScheduler);
  memoryMaintenanceScheduler = null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (!isGatewayMode) {
  ipcMain.handle("claracore:getRuntimeSnapshot", () => getRuntimeSnapshot());
  ipcMain.handle("claracore:getResourceSnapshot", () => getResourceSnapshot());
  ipcMain.handle("claracore:getImportPreview", () => getProductImportPreview(app));
  ipcMain.handle("claracore:clearLogs", async () => {
    const result = await clearProductLogs(app);
    notifyRuntimeChanged("logs-clear");
    return result;
  });
  ipcMain.handle("claracore:saveSettings", async (_event, updates) => {
    if (!isPlainObject(updates)) return false;
    return saveProductSettings(app, updates);
  });
  ipcMain.handle("claracore:listModels", async (_event, input) => listConfiguredModels(input));
  ipcMain.handle("claracore:createMemory", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemory(app, input);
  });
  ipcMain.handle("claracore:updateMemory", async (_event, id, input) => {
    if (typeof id !== "string" || !isPlainObject(input)) return false;
    return updateProductMemory(app, id, input);
  });
  ipcMain.handle("claracore:deleteMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return deleteProductMemory(app, id);
  });
  ipcMain.handle("claracore:archiveMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    const result = await archiveProductMemory(app, id);
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle("claracore:restoreMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return restoreProductMemory(app, id);
  });
  ipcMain.handle("claracore:restoreArchivedMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    const result = await restoreArchivedProductMemory(app, id);
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle("claracore:restrictMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return restrictProductMemory(app, id);
  });
  ipcMain.handle("claracore:unrestrictMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return unrestrictProductMemory(app, id);
  });
  ipcMain.handle("claracore:getRestrictedMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductRestrictedMemories(app, input);
  });
  ipcMain.handle("claracore:getMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductMemories(app, input);
  });
  ipcMain.handle("claracore:getDeletedMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductDeletedMemories(app, input);
  });
  ipcMain.handle("claracore:getArchivedMemories", async (_event, input) => {
    if (input && typeof input === "object" && Array.isArray(input)) return false;
    return getProductArchivedMemories(app, input);
  });
  ipcMain.handle("claracore:getMemoryStats", async () => {
    return getProductMemoryStats(app);
  });
  ipcMain.handle("claracore:createMemoryLabelAlias", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemoryLabelAlias(app, input);
  });
  ipcMain.handle("claracore:deleteMemoryLabelAlias", async (_event, alias) => {
    if (typeof alias !== "string") return false;
    return deleteProductMemoryLabelAlias(app, alias);
  });
  ipcMain.handle("claracore:getMemoryLabelAliases", async () => {
    return getProductMemoryLabelAliases(app);
  });
  ipcMain.handle("claracore:getMemoryGraph", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryGraph(app, input || {});
  });
  ipcMain.handle("claracore:getMemoryMaintenance", async () => {
    return getProductMemoryMaintenance(app);
  });
  ipcMain.handle("claracore:runMemoryMaintenance", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return runProductMemoryMaintenance(app, input || {});
  });
  ipcMain.handle("claracore:getMemoryMergeSuggestions", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryMergeSuggestions(app, input || {});
  });
  ipcMain.handle("claracore:mergeMemories", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    const result = await mergeProductMemories(app, input);
    notifyRuntimeChanged("memory-merge");
    return result;
  });
  ipcMain.handle("claracore:getMemoryArchiveSuggestions", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryArchiveSuggestions(app, input || {});
  });
  ipcMain.handle("claracore:archiveDormantMemories", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const result = await archiveProductDormantMemories(app, input || {});
    notifyRuntimeChanged("memory-archive");
    return result;
  });
  ipcMain.handle("claracore:createMemoryRecord", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductMemoryRecord(app, input);
  });
  ipcMain.handle("claracore:getMemoryRecords", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductMemoryRecords(app, input || {});
  });
  ipcMain.handle("claracore:searchMemories", async (_event, input) => {
    if (typeof input === "string") return searchProductMemories(app, input);
    if (input && (typeof input !== "object" || Array.isArray(input))) {
      return { mode: "list", query: "", results: [], error: null };
    }
    return searchProductMemories(app, input || {});
  });
  ipcMain.handle("claracore:embedMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return embedProductMemory(app, id);
  });
  ipcMain.handle("claracore:processMemoryEmbeddings", async (_event, limit) => {
    return processProductMemoryEmbeddings(app, limit);
  });
  ipcMain.handle("claracore:getSharedLine", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductSharedLine(app, input || {});
  });
  ipcMain.handle("claracore:saveSharedLine", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return saveProductSharedLine(app, input);
  });
  ipcMain.handle("claracore:createSharedLine", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return createProductSharedLine(app, input);
  });
  ipcMain.handle("claracore:activateSharedLine", async (_event, lineId) => {
    if (typeof lineId !== "string") return false;
    return activateProductSharedLine(app, lineId);
  });
  ipcMain.handle("claracore:renameSharedLine", async (_event, lineId, title) => {
    if (typeof lineId !== "string" || typeof title !== "string") return false;
    return renameProductSharedLine(app, lineId, title);
  });
  ipcMain.handle("claracore:archiveSharedLine", async (_event, lineId) => {
    if (typeof lineId !== "string") return false;
    return archiveProductSharedLine(app, lineId);
  });
  ipcMain.handle("claracore:restoreSharedLine", async (_event, lineId, makeActive) => {
    if (typeof lineId !== "string") return false;
    return restoreProductSharedLine(app, lineId, Boolean(makeActive));
  });
  ipcMain.handle("claracore:createSharedLineHandoff", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return createProductSharedLineHandoff(app, input || {});
  });
  ipcMain.handle("claracore:getInnerLife", async () => {
    return getProductInnerLife(app);
  });
  ipcMain.handle("claracore:getInnerLifeSessions", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeSessions(app, input || {});
  });
  ipcMain.handle("claracore:getInnerLifeDigestRuns", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeDigestRuns(app, input || {});
  });
  ipcMain.handle("claracore:getInnerLifeInbox", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return getProductInnerLifeInbox(app, input || {});
  });
  ipcMain.handle("claracore:processInnerLifeOnce", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return processProductInnerLifeOnce(app, input || {});
  });
  ipcMain.handle("claracore:runInnerLifeDigest", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return runProductInnerLifeDigest(app, input || {});
  });
  ipcMain.handle("claracore:checkInnerLifeShareTiming", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return checkProductInnerLifeShareTiming(app, input || {});
  });
  ipcMain.handle("claracore:setInnerLifeDaemon", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    const result = await setProductInnerLifeDaemon(app, input);
    notifyRuntimeChanged("innerlife-daemon");
    return result;
  });
  ipcMain.handle("claracore:tickInnerLifeDaemon", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const result = await tickProductInnerLifeDaemon(app, input || {});
    notifyRuntimeChanged("innerlife-daemon", {
      daemonReason: result?.reason,
      ran: Boolean(result?.ran)
    });
    return result;
  });
  ipcMain.handle("claracore:startInnerLifeSession", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return startProductInnerLifeSession(app, input || {});
  });
  ipcMain.handle("claracore:submitInnerLifeInbox", async (_event, input) => {
    if (!isPlainObject(input)) return false;
    return submitProductInnerLifeInbox(app, input);
  });
  ipcMain.handle("claracore:endInnerLifeSession", async (_event, sessionId, input) => {
    if (typeof sessionId !== "string" || sessionId.length === 0) return false;
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    return endProductInnerLifeSession(app, sessionId, input || {});
  });
  ipcMain.handle("claracore:reviewInnerLifeShare", async (_event, id, decision, reason) => {
    if (typeof id !== "string" || typeof decision !== "string") return false;
    return reviewProductInnerLifeShare(app, id, decision, typeof reason === "string" ? reason : "");
  });
  ipcMain.handle("claracore:markInnerLifeShare", async (_event, id, action, reason) => {
    if (typeof id !== "string" || typeof action !== "string") return false;
    return markProductInnerLifeShare(app, id, action, typeof reason === "string" ? reason : "");
  });
  ipcMain.handle("claracore:applyInnerLifeShareToMemory", async (_event, id) => {
    if (typeof id !== "string") return false;
    return applyProductInnerLifeShareToMemory(app, id);
  });
  ipcMain.handle("claracore:applyInnerLifeShareToSharedLine", async (_event, id) => {
    if (typeof id !== "string") return false;
    return applyProductInnerLifeShareToSharedLine(app, id);
  });
  ipcMain.handle("claracore:createBackup", async () => {
    return createProductBackup(app);
  });
  ipcMain.handle("claracore:deleteBackup", async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    const result = await deleteProductBackup(app, backupId);
    notifyRuntimeChanged("backup-delete");
    return result;
  });
  ipcMain.handle("claracore:exportProductJson", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.targetPath && !options.silent) {
      const paths = await ensureProductDirectories(app);
      const defaultPath = path.join(paths.exportsDir, `claracore-product-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export ClaraCore Product JSON",
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      options.targetPath = result.filePath;
      options.allowExternalPath = true;
    }
    return exportProductDataJson(app, options);
  });
  ipcMain.handle("claracore:importProductJson", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.filePath && !options.silent) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Import ClaraCore Product JSON",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
      options.filePath = result.filePaths[0];
    }
    const imported = await importProductDataJson(app, options);
    notifyRuntimeChanged("product-json-import");
    return imported;
  });
  ipcMain.handle("claracore:exportMemoryArchive", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.targetPath && !options.silent) {
      const paths = await ensureProductDirectories(app);
      const defaultPath = path.join(paths.exportsDir, `claracore-memory-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Memory JSON",
        defaultPath,
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true };
      options.targetPath = result.filePath;
      options.allowExternalPath = true;
    }
    return exportProductMemoryArchive(app, options);
  });
  ipcMain.handle("claracore:importMemoryArchive", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const options = input || {};
    if (!options.filePath && !options.silent) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: "Import Memory JSON",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }]
      });
      if (result.canceled || !result.filePaths?.[0]) return { canceled: true };
      options.filePath = result.filePaths[0];
    }
    const imported = await importProductMemoryArchive(app, options);
    notifyRuntimeChanged("memory-import");
    return imported;
  });
  ipcMain.handle("claracore:importOldMemoria", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldMemoriaIntoProduct(app, input || {});
    notifyRuntimeChanged("old-memoria-import");
    return imported;
  });
  ipcMain.handle("claracore:importOldContinuity", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldContinuityIntoProduct(app, input || {});
    notifyRuntimeChanged("old-continuity-import");
    return imported;
  });
  ipcMain.handle("claracore:importOldInnerLife", async (_event, input) => {
    if (input && (typeof input !== "object" || Array.isArray(input))) return false;
    const imported = await importOldInnerLifeIntoProduct(app, input || {});
    notifyRuntimeChanged("old-innerlife-import");
    return imported;
  });
  ipcMain.handle("claracore:restoreBackup", async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    return restoreProductBackup(app, backupId);
  });
  ipcMain.handle("claracore:previewRestore", async (_event, backupId) => {
    if (typeof backupId !== "string" || backupId.length === 0) return false;
    return previewProductRestore(app, backupId);
  });
  ipcMain.handle("claracore:getDataRootPreference", async () => currentDataRootPreference());
  ipcMain.handle("claracore:chooseDataRoot", async () => {
    const preference = currentDataRootPreference();
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose ClaraCore data directory",
      defaultPath: preference.effectiveDataRoot,
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { canceled: true, path: preference.configuredDataRoot || preference.effectiveDataRoot };
    }
    return { canceled: false, path: result.filePaths[0] };
  });
  ipcMain.handle("claracore:saveDataRootPreference", async (_event, dataRoot) => saveDataRootPreference(dataRoot));
  ipcMain.handle("claracore:relaunch", () => {
    if (!app.isPackaged) {
      return { relaunched: false, reason: "development-mode" };
    }
    app.relaunch();
    app.quit();
    return { relaunched: true };
  });
  ipcMain.handle("claracore:openPath", async (_event, targetPath) => {
    if (typeof targetPath !== "string" || targetPath.length === 0) return false;
    await shell.openPath(targetPath);
    return true;
  });
  ipcMain.handle("claracore:openExternal", async (_event, targetUrl) => {
    if (typeof targetUrl !== "string" || !targetUrl.startsWith("http://127.0.0.1:")) return false;
    await shell.openExternal(targetUrl);
    return true;
  });
  ipcMain.handle("claracore:copyText", (_event, value) => {
    if (typeof value !== "string" || value.length === 0) return false;
    clipboard.writeText(value);
    return true;
  });
  ipcMain.handle("claracore:setLanguage", (_event, language) => {
    updateTrayMenu(language);
    return trayLanguage;
  });
  ipcMain.handle("claracore:setWindowPreferences", (_event, preferences = {}) => {
    windowCloseBehavior = preferences.closeBehavior === "quit" ? "quit" : "hide";
    return {
      closeBehavior: windowCloseBehavior
    };
  });
  ipcMain.handle("claracore:getShellState", () => ({
    hasTray: Boolean(tray),
    trayBounds: tray ? tray.getBounds() : null,
    trayTitle: tray && typeof tray.getTitle === "function" ? tray.getTitle() : "",
    windowVisible: mainWindow ? mainWindow.isVisible() : false
  }));

  app.whenReady().then(async () => {
    const { database } = await ensureProductCore(app);
    await startHttpAgentGateway();
    await database.recordRuntimeEvent({
      level: "info",
      source: "desktop",
      message: "ClaraCore Desktop started",
      metadata: {
        version: PRODUCT_VERSION,
        packaged: app.isPackaged,
        platform: process.platform
      }
    });
    createWindow();
    createTray();
    startInnerLifeScheduler();
    startMemoryMaintenanceScheduler();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      showMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (!tray && process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    isQuitting = true;
    stopHttpAgentGateway();
    stopInnerLifeScheduler();
    stopMemoryMaintenanceScheduler();
  });
}
