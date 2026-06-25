const { app, BrowserWindow, Menu, Tray, clipboard, ipcMain, nativeImage, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");

const APP_ROOT = path.resolve(__dirname, "..");
let mainWindow = null;
let tray = null;
let isQuitting = false;
let trayLanguage = "en";
let lastCpuSample = null;
const appStartedAt = Date.now();

const trayLabels = {
  en: {
    show: "Show ClaraCore",
    hide: "Hide ClaraCore",
    quit: "Quit",
    tooltip: "ClaraCore Desktop"
  },
  zh: {
    show: "显示 ClaraCore",
    hide: "隐藏 ClaraCore",
    quit: "退出",
    tooltip: "ClaraCore 桌面"
  }
};

function resolveClaraCoreRoot() {
  if (process.env.CLARACORE_ROOT) {
    return path.resolve(process.env.CLARACORE_ROOT);
  }
  return path.resolve(APP_ROOT, "..", "..");
}

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
  const dataRoot = path.join(app.getPath("home"), ".claracore");
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const disk = await getDiskSnapshot(dataRoot);
  return {
    appVersion: app.getVersion(),
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
  const root = resolveClaraCoreRoot();
  const gatewayCommand = path.join(root, "gateway", "run_mcp.sh");
  const httpEndpoints = [
    {
      id: "gateway-web",
      label: "Gateway console",
      url: "http://127.0.0.1:8010/",
      healthUrl: "http://127.0.0.1:8010/"
    },
    {
      id: "memoria-web",
      label: "Memoria",
      url: "http://127.0.0.1:8011/",
      healthUrl: "http://127.0.0.1:8011/api/stats"
    },
    {
      id: "continuity-web",
      label: "Continuity",
      url: "http://127.0.0.1:8012/?agent_id=clara",
      healthUrl: "http://127.0.0.1:8012/api/dashboard?agent_id=clara"
    },
    {
      id: "innerlife-web",
      label: "InnerLife",
      url: "http://127.0.0.1:8013/",
      healthUrl: "http://127.0.0.1:8013/api/status"
    }
  ];
  const mcpConfig = {
    mcpServers: {
      claracore: {
        type: "stdio",
        command: gatewayCommand,
        args: [],
        env: {
          CLARACORE_AGENT_ID: "my-agent",
          CLARACORE_PYTHON: "/path/to/python3"
        }
      }
    }
  };
  const modules = [
    {
      id: "gateway",
      label: "Gateway",
      description: "Unified MCP and local service entry",
      required: true,
      state: "ready",
      path: gatewayCommand
    },
    {
      id: "memoria",
      label: "Memoria",
      description: "Long-term factual memory",
      required: true,
      state: "ready",
      path: path.join(root, "services", "memoria", "server", "app.py")
    },
    {
      id: "continuity",
      label: "Continuity",
      description: "Shared line and current position",
      required: true,
      state: "ready",
      path: path.join(root, "services", "continuity", "server", "app.py")
    },
    {
      id: "innerlife",
      label: "InnerLife",
      description: "Optional background thoughts",
      required: false,
      state: "paused",
      path: path.join(root, "services", "innerlife", "innerlife", "service.py")
    }
  ];

  const checkedModules = [];
  for (const module of modules) {
    checkedModules.push({
      ...module,
      present: await exists(module.path),
      servicePath: path.relative(root, module.path)
    });
  }

  const dataRoot = path.join(app.getPath("home"), ".claracore");
  const memoriaStore = path.join(dataRoot, "memoria");
  const dataRootPresent = await exists(dataRoot);
  const memoriaStorePresent = await exists(memoriaStore);
  const gatewayPresent = checkedModules.find((module) => module.id === "gateway")?.present;
  const requiredReady = checkedModules
    .filter((module) => module.required)
    .every((module) => module.present);

  return {
    mode: process.env.CLARACORE_ROOT ? "custom-root" : "development-root",
    root,
    appRoot: APP_ROOT,
    coreStatus: gatewayPresent && requiredReady ? "Ready" : "Needs attention",
    data: {
      root: dataRoot,
      memoriaStore,
      rootPresent: dataRootPresent,
      memoriaStorePresent
    },
    connections: {
      mcpCommand: gatewayCommand,
      mcpConfig: JSON.stringify(mcpConfig, null, 2),
      httpEndpoints
    },
    modules: checkedModules,
    plans: {
      development: path.join(root, "seeds", "claracore_desktop_development_plan.md"),
      design: path.join(root, "seeds", "claracore_desktop_design_plan.md")
    }
  };
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#202421"/>
      <text x="16" y="22" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="17" font-weight="700">C</text>
    </svg>
  `;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
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
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: labels.show, click: showMainWindow },
      {
        label: labels.hide,
        click() {
          if (mainWindow) mainWindow.hide();
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
  updateTrayMenu();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 640,
    title: "ClaraCore Desktop",
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
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.loadFile(path.join(APP_ROOT, "index.html"));
}

ipcMain.handle("claracore:getRuntimeSnapshot", () => getRuntimeSnapshot());
ipcMain.handle("claracore:getResourceSnapshot", () => getResourceSnapshot());
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

app.whenReady().then(() => {
  createWindow();
  createTray();

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
});
