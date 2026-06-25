const moduleGrid = document.querySelector("#moduleGrid");
const runtimeMode = document.querySelector("#runtimeMode");
const rootPath = document.querySelector("#rootPath");
const refreshButton = document.querySelector("#refreshButton");
const primaryAction = document.querySelector("#primaryAction");
const openDevelopmentPlan = document.querySelector("#openDevelopmentPlan");
const openDesignPlan = document.querySelector("#openDesignPlan");
const coreStatus = document.querySelector("#coreStatus");
const coreHint = document.querySelector("#coreHint");
const dataLocation = document.querySelector("#dataLocation");
const dataHint = document.querySelector("#dataHint");
const dataRootPath = document.querySelector("#dataRootPath");
const memoryStore = document.querySelector("#memoryStore");
const memoryStoreShort = document.querySelector("#memoryStoreShort");
const mcpCommand = document.querySelector("#mcpCommand");
const mcpConfig = document.querySelector("#mcpConfig");
const copyNotice = document.querySelector("#copyNotice");
const httpEndpointList = document.querySelector("#httpEndpointList");
const openGatewayFolder = document.querySelector("#openGatewayFolder");
const eventList = document.querySelector("#eventList");
const viewTitle = document.querySelector("#viewTitle");
const viewSubtitle = document.querySelector("#viewSubtitle");
const monitorVersion = document.querySelector("#monitorVersion");
const monitorUptime = document.querySelector("#monitorUptime");
const monitorCpu = document.querySelector("#monitorCpu");
const monitorRam = document.querySelector("#monitorRam");
const monitorDisk = document.querySelector("#monitorDisk");
const monitorTime = document.querySelector("#monitorTime");

const translations = {
  en: {
    "nav.home": "Home",
    "nav.memory": "Memory",
    "nav.sharedLine": "Shared Line",
    "nav.innerLife": "InnerLife",
    "nav.data": "Data",
    "nav.connections": "Connections",
    "nav.settings": "Settings",
    "footer.label": "Local ownership",
    "footer.value": "Portable core",
    "status.coreReady": "Core ready",
    "status.localMode": "Local mode",
    "status.dataSafe": "Data safe",
    "actions.refresh": "Refresh",
    "actions.openGateway": "Open Gateway",
    "actions.import": "Import",
    "actions.export": "Export",
    "actions.restore": "Restore",
    "actions.open": "Open",
    "actions.copy": "Copy",
    "common.status": "Status",
    "common.path": "Path",
    "common.ready": "Ready",
    "common.paused": "Paused",
    "common.missing": "Missing",
    "common.optionalMissing": "Optional missing",
    "common.notTracked": "Not tracked yet",
    "common.checking": "Checking...",
    "common.found": "Found",
    "common.notCreated": "Not created",
    "common.ok": "OK",
    "common.manual": "Manual",
    "common.local": "Local",
    "common.sqlite": "SQLite",
    "view.home.title": "ClaraCore",
    "view.home.subtitle": "Local Control Center",
    "view.memory.title": "Memory",
    "view.memory.subtitle": "Owned long-term facts, separate from chat flow.",
    "view.sharedLine.title": "Shared Line",
    "view.sharedLine.subtitle": "The current position that connected agents can resume from.",
    "view.innerLife.title": "InnerLife",
    "view.innerLife.subtitle": "Optional background reflection with explicit controls.",
    "view.data.title": "Data",
    "view.data.subtitle": "Import, export, and restore without mixing risky actions.",
    "view.connections.title": "Connections",
    "view.connections.subtitle": "Local entry points for external agents.",
    "view.settings.title": "Settings",
    "view.settings.subtitle": "Model and service settings kept understandable.",
    "home.model.title": "Model & Provider",
    "home.model.settings": "Model settings",
    "home.model.provider": "Provider",
    "home.model.localProvider": "Local provider",
    "home.model.model": "Model",
    "home.model.configuredOutside": "configured outside app",
    "home.model.mode": "Mode",
    "home.model.edit": "Edit settings",
    "home.dataLocation.title": "Data Location",
    "home.dataLocation.root": "Root",
    "home.dataLocation.openControls": "Open data controls",
    "home.importExport.title": "Import / Export",
    "home.importExport.lastImport": "Last import",
    "home.importExport.lastExport": "Last export",
    "home.events.title": "Recent system events",
    "home.events.localOnly": "Local only",
    "home.agentConnection.title": "Agent connection",
    "home.agentConnection.developmentPlan": "Development plan",
    "home.agentConnection.designPlan": "Design plan",
    "home.backup.title": "Backup reminder",
    "home.backup.body": "Export memory and shared-line data before large local changes.",
    "home.backup.review": "Review data",
    "memory.title": "Memory",
    "memory.body": "Memoria keeps long-term factual records separate from chat flow.",
    "memory.store": "Store",
    "memory.policy": "Policy",
    "memory.factsFirst": "Facts first",
    "memory.preview": "Preview",
    "memory.preview1": "Recent facts stay reviewable.",
    "memory.preview2": "Private data remains under the local ClaraCore folder.",
    "memory.preview3": "Search and cleanup controls will land behind confirmation.",
    "sharedLine.title": "Shared Line",
    "sharedLine.body": "Continuity shows the current shared position so agents can resume with less drift.",
    "sharedLine.current": "Current position",
    "sharedLine.currentBody": "Ready to read from Continuity.",
    "sharedLine.resume": "Resume packet",
    "sharedLine.resumeBody": "Prepared for connected agents.",
    "sharedLine.review": "Review point",
    "sharedLine.reviewBody": "Confirm before overwriting context.",
    "sharedLine.controls": "Controls",
    "sharedLine.open": "Open shared line",
    "sharedLine.export": "Export packet",
    "innerLife.body": "Optional background reflection is available, but it should stay calm and explicit.",
    "innerLife.paused": "Paused by default",
    "innerLife.pausedBody": "This is a normal state, not a failure.",
    "innerLife.allowQuiet": "Allow quiet background review",
    "innerLife.shareReviewed": "Share only reviewed output",
    "data.title": "Data import and export",
    "data.body": "Import and restore are separated so destructive actions stay clear.",
    "data.exportBackup": "Export backup",
    "data.importRecords": "Import records",
    "data.restoreBackup": "Restore from backup",
    "data.location": "Location",
    "data.dataRoot": "Data root",
    "connections.title": "Connections",
    "connections.body": "External agents connect through the local gateway instead of owning the data layer.",
    "connections.mcpCommand": "MCP command",
    "connections.mcpConfig": "MCP config",
    "connections.shortcuts": "Shortcuts",
    "connections.copyMcpCommand": "Copy MCP command",
    "connections.copyMcpConfig": "Copy MCP config",
    "connections.openGatewayFolder": "Open gateway folder",
    "connections.httpEndpoints": "HTTP endpoints",
    "connections.copied.mcpCommand": "MCP command copied",
    "connections.copied.mcpConfig": "MCP config copied",
    "connections.copied.endpoint": "Endpoint copied",
    "connections.endpoint.gateway-web": "Gateway console",
    "connections.endpoint.memoria-web": "Memoria",
    "connections.endpoint.continuity-web": "Continuity",
    "connections.endpoint.innerlife-web": "InnerLife",
    "settings.title": "Model settings",
    "settings.body": "Provider and model choices should be understandable without reading configuration files.",
    "settings.openaiCompatible": "OpenAI compatible",
    "settings.defaultModel": "Default model",
    "settings.advanced": "Advanced",
    "settings.showServiceDetails": "Show service details",
    "settings.serviceDetailsBody": "Paths and process controls will stay behind disclosure controls.",
    "module.gateway.description": "Unified MCP and local service entry",
    "module.memoria.description": "Long-term factual memory",
    "module.continuity.description": "Shared line and current position",
    "module.innerlife.description": "Optional background thoughts",
    "module.gateway.address": "Address",
    "module.gateway.localGateway": "Local gateway",
    "module.gateway.protocol": "Protocol",
    "module.gateway.auth": "Auth",
    "module.memoria.location": "Location",
    "module.memoria.localStore": "Local store",
    "module.continuity.role": "Role",
    "module.continuity.sharedLine": "Shared line",
    "module.innerlife.reason": "Reason",
    "module.innerlife.nextRun": "Next run",
    "module.innerlife.whenEnabled": "When enabled",
    "module.action.enableInnerLife": "Enable InnerLife",
    "module.action.open": "Open {label}",
    "event.requiredFound.title": "Required modules found",
    "event.requiredFound.detail": "Gateway, Memoria, and Continuity paths are available.",
    "event.requiredMissing.title": "Required module missing",
    "event.memoryFound.title": "Memory store located",
    "event.memoryMissing.title": "Memory store not created yet",
    "event.innerLifeFound.title": "InnerLife available and paused",
    "event.innerLifeMissing.title": "InnerLife optional path not found",
    "event.innerLife.detail": "Paused is the normal first-run state.",
    "runtime.customRoot": "Custom root",
    "runtime.developmentRoot": "Development root",
    "runtime.memoriaStoreAvailable": "Memoria store available",
    "runtime.noMemoriaStore": "No Memoria store detected",
    "runtime.requiredPresent": "Required local modules are present.",
    "runtime.needsAttention": "One or more required modules need attention.",
    "runtime.unavailable": "Unavailable",
    "runtime.unableSnapshot": "Unable to read runtime snapshot.",
    "monitor.uptime": "Uptime",
    "monitor.cpu": "CPU",
    "monitor.ram": "RAM",
    "monitor.disk": "Disk",
    "monitor.localTime": "Local time"
  },
  zh: {
    "nav.home": "首页",
    "nav.memory": "记忆",
    "nav.sharedLine": "共同线",
    "nav.innerLife": "内在活动",
    "nav.data": "数据",
    "nav.connections": "连接",
    "nav.settings": "设置",
    "footer.label": "本机掌控",
    "footer.value": "可迁移核心",
    "status.coreReady": "核心可用",
    "status.localMode": "本机模式",
    "status.dataSafe": "数据在本机",
    "actions.refresh": "刷新",
    "actions.openGateway": "打开网关",
    "actions.import": "导入",
    "actions.export": "导出",
    "actions.restore": "恢复",
    "actions.open": "打开",
    "actions.copy": "复制",
    "common.status": "状态",
    "common.path": "路径",
    "common.ready": "可用",
    "common.paused": "已暂停",
    "common.missing": "缺失",
    "common.optionalMissing": "可选项缺失",
    "common.notTracked": "尚未记录",
    "common.checking": "检查中...",
    "common.found": "已找到",
    "common.notCreated": "未创建",
    "common.ok": "正常",
    "common.manual": "手动",
    "common.local": "本机",
    "common.sqlite": "SQLite",
    "view.home.title": "ClaraCore",
    "view.home.subtitle": "本机控制中心",
    "view.memory.title": "记忆",
    "view.memory.subtitle": "长期事实记录，和聊天流程分开。",
    "view.sharedLine.title": "共同线",
    "view.sharedLine.subtitle": "外部智能体可以从这里接上当前进展。",
    "view.innerLife.title": "内在活动",
    "view.innerLife.subtitle": "可选的后台思考，需要明确控制。",
    "view.data.title": "数据",
    "view.data.subtitle": "导入、导出、恢复分开处理，避免误操作。",
    "view.connections.title": "连接",
    "view.connections.subtitle": "给外部智能体使用的本机入口。",
    "view.settings.title": "设置",
    "view.settings.subtitle": "模型和服务设置保持清楚可读。",
    "home.model.title": "模型与提供方",
    "home.model.settings": "模型设置",
    "home.model.provider": "提供方",
    "home.model.localProvider": "本机提供方",
    "home.model.model": "模型",
    "home.model.configuredOutside": "在应用外配置",
    "home.model.mode": "模式",
    "home.model.edit": "编辑设置",
    "home.dataLocation.title": "数据位置",
    "home.dataLocation.root": "根目录",
    "home.dataLocation.openControls": "打开数据控制",
    "home.importExport.title": "导入 / 导出",
    "home.importExport.lastImport": "上次导入",
    "home.importExport.lastExport": "上次导出",
    "home.events.title": "近期系统事件",
    "home.events.localOnly": "仅本机",
    "home.agentConnection.title": "智能体连接",
    "home.agentConnection.developmentPlan": "开发计划",
    "home.agentConnection.designPlan": "设计计划",
    "home.backup.title": "备份提醒",
    "home.backup.body": "做较大本机改动前，先导出记忆和共同线数据。",
    "home.backup.review": "查看数据",
    "memory.title": "记忆",
    "memory.body": "Memoria 保存长期事实记录，不混进聊天流程。",
    "memory.store": "存储位置",
    "memory.policy": "策略",
    "memory.factsFirst": "事实优先",
    "memory.preview": "预览",
    "memory.preview1": "近期事实保持可查看。",
    "memory.preview2": "私有数据留在本机 ClaraCore 文件夹里。",
    "memory.preview3": "搜索和清理控制会放在确认之后。",
    "sharedLine.title": "共同线",
    "sharedLine.body": "Continuity 显示当前共同位置，让智能体接续时更少偏移。",
    "sharedLine.current": "当前位置",
    "sharedLine.currentBody": "可以从 Continuity 读取。",
    "sharedLine.resume": "接续包",
    "sharedLine.resumeBody": "可提供给已连接的智能体。",
    "sharedLine.review": "确认点",
    "sharedLine.reviewBody": "覆盖上下文前先确认。",
    "sharedLine.controls": "控制",
    "sharedLine.open": "打开共同线",
    "sharedLine.export": "导出接续包",
    "innerLife.body": "可选的后台反思已经可用，但应该保持安静且可控。",
    "innerLife.paused": "默认暂停",
    "innerLife.pausedBody": "这是正常状态，不是故障。",
    "innerLife.allowQuiet": "允许安静后台检查",
    "innerLife.shareReviewed": "只分享已确认输出",
    "data.title": "数据导入与导出",
    "data.body": "导入和恢复分开，危险操作要清楚。",
    "data.exportBackup": "导出备份",
    "data.importRecords": "导入记录",
    "data.restoreBackup": "从备份恢复",
    "data.location": "位置",
    "data.dataRoot": "数据根目录",
    "connections.title": "连接",
    "connections.body": "外部智能体通过本机网关连接，不直接接管数据层。",
    "connections.mcpCommand": "MCP 命令",
    "connections.mcpConfig": "MCP 配置",
    "connections.shortcuts": "快捷操作",
    "connections.copyMcpCommand": "复制 MCP 命令",
    "connections.copyMcpConfig": "复制 MCP 配置",
    "connections.openGatewayFolder": "打开网关文件夹",
    "connections.httpEndpoints": "HTTP 入口",
    "connections.copied.mcpCommand": "MCP 命令已复制",
    "connections.copied.mcpConfig": "MCP 配置已复制",
    "connections.copied.endpoint": "入口地址已复制",
    "connections.endpoint.gateway-web": "Gateway 控制台",
    "connections.endpoint.memoria-web": "Memoria",
    "connections.endpoint.continuity-web": "Continuity",
    "connections.endpoint.innerlife-web": "InnerLife",
    "settings.title": "模型设置",
    "settings.body": "提供方和模型选择要做到不用读配置文件也能看懂。",
    "settings.openaiCompatible": "OpenAI 兼容",
    "settings.defaultModel": "默认模型",
    "settings.advanced": "高级",
    "settings.showServiceDetails": "显示服务详情",
    "settings.serviceDetailsBody": "路径和进程控制会放在展开区后面。",
    "module.gateway.description": "统一 MCP 与本机服务入口",
    "module.memoria.description": "长期事实记忆",
    "module.continuity.description": "共同线与当前位置",
    "module.innerlife.description": "可选后台思考",
    "module.gateway.address": "地址",
    "module.gateway.localGateway": "本机网关",
    "module.gateway.protocol": "协议",
    "module.gateway.auth": "授权",
    "module.memoria.location": "位置",
    "module.memoria.localStore": "本机存储",
    "module.continuity.role": "作用",
    "module.continuity.sharedLine": "共同线",
    "module.innerlife.reason": "原因",
    "module.innerlife.nextRun": "下次运行",
    "module.innerlife.whenEnabled": "启用后运行",
    "module.action.enableInnerLife": "启用 InnerLife",
    "module.action.open": "打开 {label}",
    "event.requiredFound.title": "必需模块已找到",
    "event.requiredFound.detail": "Gateway、Memoria、Continuity 路径都可用。",
    "event.requiredMissing.title": "必需模块缺失",
    "event.memoryFound.title": "记忆存储已找到",
    "event.memoryMissing.title": "记忆存储尚未创建",
    "event.innerLifeFound.title": "InnerLife 可用且已暂停",
    "event.innerLifeMissing.title": "未找到 InnerLife 可选路径",
    "event.innerLife.detail": "默认暂停是正常的首次状态。",
    "runtime.customRoot": "自定义根目录",
    "runtime.developmentRoot": "开发根目录",
    "runtime.memoriaStoreAvailable": "Memoria 存储可用",
    "runtime.noMemoriaStore": "未检测到 Memoria 存储",
    "runtime.requiredPresent": "必需的本机模块都已找到。",
    "runtime.needsAttention": "有必需模块需要处理。",
    "runtime.unavailable": "不可用",
    "runtime.unableSnapshot": "无法读取运行状态。",
    "monitor.uptime": "运行时长",
    "monitor.cpu": "CPU",
    "monitor.ram": "内存",
    "monitor.disk": "磁盘",
    "monitor.localTime": "本地时间"
  }
};

let currentLanguage = localStorage.getItem("claracore.language") || "en";

function t(key, values = {}) {
  const template = translations[currentLanguage]?.[key] || translations.en[key] || key;
  return Object.entries(values).reduce((result, [name, value]) => result.replace(`{${name}}`, value), template);
}

const views = {
  home: {
    titleKey: "view.home.title",
    subtitleKey: "view.home.subtitle",
    panel: document.querySelector("#homeView")
  },
  memory: {
    titleKey: "view.memory.title",
    subtitleKey: "view.memory.subtitle",
    panel: document.querySelector("#memoryView")
  },
  "shared-line": {
    titleKey: "view.sharedLine.title",
    subtitleKey: "view.sharedLine.subtitle",
    panel: document.querySelector("#sharedLineView")
  },
  innerlife: {
    titleKey: "view.innerLife.title",
    subtitleKey: "view.innerLife.subtitle",
    panel: document.querySelector("#innerlifeView")
  },
  data: {
    titleKey: "view.data.title",
    subtitleKey: "view.data.subtitle",
    panel: document.querySelector("#dataView")
  },
  connections: {
    titleKey: "view.connections.title",
    subtitleKey: "view.connections.subtitle",
    panel: document.querySelector("#connectionsView")
  },
  settings: {
    titleKey: "view.settings.title",
    subtitleKey: "view.settings.subtitle",
    panel: document.querySelector("#settingsView")
  }
};

let snapshot = null;
let activeView = "home";

function formatMode(mode) {
  return mode === "custom-root" ? t("runtime.customRoot") : t("runtime.developmentRoot");
}

function serviceBadge(module) {
  if (module.present && module.state === "paused") {
    return `<span class="badge paused">${t("common.paused")}</span>`;
  }
  if (module.present) {
    return `<span class="badge ok">${t("common.ready")}</span>`;
  }
  if (!module.required) {
    return `<span class="badge optional">${t("common.optionalMissing")}</span>`;
  }
  return `<span class="badge missing">${t("common.missing")}</span>`;
}

function moduleTone(module) {
  if (!module.present && module.required) return "needs-attention";
  if (module.state === "paused") return "is-paused";
  return "is-ready";
}

function moduleIcon(module) {
  const icons = {
    gateway: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M4 12h16M12 4c2.2 2.3 3.2 5 3.2 8S14.2 17.7 12 20M12 4c-2.2 2.3-3.2 5-3.2 8s1 5.7 3.2 8"></path>
      </svg>
    `,
    memoria: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3"></ellipse>
        <path d="M5 6v8c0 1.7 3.1 3 7 3s7-1.3 7-3V6"></path>
        <path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3"></path>
      </svg>
    `,
    continuity: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M12 7v5l4 2"></path>
      </svg>
    `,
    innerlife: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 19s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 9c0 5.5-7 10-7 10Z"></path>
      </svg>
    `
  };
  return icons[module.id] || icons.gateway;
}

function moduleDetails(module) {
  if (module.id === "gateway") {
    return [
      [t("module.gateway.address"), t("module.gateway.localGateway")],
      [t("module.gateway.protocol"), "MCP"],
      [t("module.gateway.auth"), t("common.local")],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "memoria") {
    return [
      [t("home.model.provider"), t("common.sqlite")],
      [t("module.memoria.location"), t("module.memoria.localStore")],
      [t("common.status"), module.present ? t("common.ok") : t("common.missing")],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "continuity") {
    return [
      [t("home.model.provider"), t("common.sqlite")],
      [t("module.continuity.role"), t("module.continuity.sharedLine")],
      [t("common.status"), module.present ? t("common.ok") : t("common.missing")],
      [t("common.path"), module.servicePath]
    ];
  }
  return [
    [t("common.status"), t("common.paused")],
    [t("module.innerlife.reason"), t("common.manual")],
    [t("module.innerlife.nextRun"), t("module.innerlife.whenEnabled")],
    [t("common.path"), module.servicePath]
  ];
}

function renderModules(modules) {
  moduleGrid.innerHTML = modules
    .map((module) => {
      const details = moduleDetails(module)
        .map(
          ([label, value]) => `
            <div class="module-detail">
              <span>${label}</span>
              <strong>${value}</strong>
            </div>
          `
        )
        .join("");
      return `
        <article class="module-card ${module.id} ${moduleTone(module)}">
          <header>
            <div class="module-icon">${moduleIcon(module)}</div>
            <div>
              <strong>${module.label}</strong>
              <p>${t(`module.${module.id}.description`)}</p>
            </div>
            ${serviceBadge(module)}
          </header>
          <div class="module-details">${details}</div>
          <button class="module-action secondary">${
            module.state === "paused"
              ? t("module.action.enableInnerLife")
              : t("module.action.open", { label: module.label })
          }</button>
        </article>
      `;
    })
    .join("");
}

function renderEvents() {
  if (!snapshot) return;
  const requiredMissing = snapshot.modules.filter((module) => module.required && !module.present);
  const innerLife = snapshot.modules.find((module) => module.id === "innerlife");
  const events = [
    {
      title: requiredMissing.length === 0 ? t("event.requiredFound.title") : t("event.requiredMissing.title"),
      detail:
        requiredMissing.length === 0
          ? t("event.requiredFound.detail")
          : requiredMissing.map((module) => module.label).join(", ")
    },
    {
      title: snapshot.data.memoriaStorePresent ? t("event.memoryFound.title") : t("event.memoryMissing.title"),
      detail: snapshot.data.memoriaStore
    },
    {
      title: innerLife?.present ? t("event.innerLifeFound.title") : t("event.innerLifeMissing.title"),
      detail: t("event.innerLife.detail")
    }
  ];

  eventList.innerHTML = events
    .map(
      (event) => `
        <li>
          <strong>${event.title}</strong>
          <span>${event.detail}</span>
        </li>
      `
    )
    .join("");
}

function renderConnections() {
  if (!snapshot?.connections) return;
  mcpCommand.textContent = snapshot.connections.mcpCommand;
  mcpConfig.textContent = snapshot.connections.mcpConfig;
  httpEndpointList.innerHTML = snapshot.connections.httpEndpoints
    .map(
      (endpoint) => `
        <div class="endpoint-card">
          <div>
            <strong>${t(`connections.endpoint.${endpoint.id}`)}</strong>
            <code>${endpoint.url}</code>
            <span>${endpoint.healthUrl}</span>
          </div>
          <div class="endpoint-actions">
            <button class="secondary" data-open-url="${endpoint.url}">${t("actions.open")}</button>
            <button class="secondary" data-copy-url="${endpoint.url}">${t("actions.copy")}</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderSnapshot() {
  if (coreStatus) coreStatus.textContent = snapshot.coreStatus === "Ready" ? t("common.ready") : t("runtime.needsAttention");
  if (coreHint) {
    coreHint.textContent =
      snapshot.coreStatus === "Ready"
        ? t("runtime.requiredPresent")
        : t("runtime.needsAttention");
  }
  runtimeMode.textContent = formatMode(snapshot.mode);
  rootPath.textContent = snapshot.root;
  dataLocation.textContent = snapshot.data.root;
  dataHint.textContent = snapshot.data.memoriaStorePresent ? t("runtime.memoriaStoreAvailable") : t("runtime.noMemoriaStore");
  dataRootPath.textContent = snapshot.data.root;
  memoryStore.textContent = snapshot.data.memoriaStore;
  memoryStoreShort.textContent = snapshot.data.memoriaStorePresent ? t("common.found") : t("common.notCreated");
  renderModules(snapshot.modules);
  renderEvents();
  renderConnections();
}

function renderResourceSnapshot(resources) {
  monitorVersion.textContent = `v${resources.appVersion || "0.1.0"}`;
  monitorUptime.textContent = resources.uptime || "--:--:--";
  monitorCpu.textContent = Number.isFinite(resources.cpuPercent) ? `${resources.cpuPercent}%` : "--";
  monitorRam.textContent =
    resources.memory?.text && Number.isFinite(resources.memory?.percent)
      ? `${resources.memory.text} (${resources.memory.percent}%)`
      : "--";
  monitorDisk.textContent =
    resources.disk?.text && Number.isFinite(resources.disk?.percent)
      ? `${resources.disk.text} (${resources.disk.percent}%)`
      : "--";
  monitorTime.textContent = resources.localTime || "--";
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-value]").forEach((element) => {
    element.value = t(element.dataset.i18nValue);
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.classList.toggle("active", button.dataset.language === currentLanguage);
  });
}

function setView(viewName) {
  const nextView = views[viewName] ? viewName : "home";
  activeView = nextView;
  Object.entries(views).forEach(([name, view]) => {
    view.panel.classList.toggle("active-view", name === nextView);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });
  viewTitle.textContent = t(views[nextView].titleKey);
  viewSubtitle.textContent = t(views[nextView].subtitleKey);
}

function setLanguage(language) {
  if (!translations[language]) return;
  currentLanguage = language;
  localStorage.setItem("claracore.language", language);
  applyStaticTranslations();
  setView(activeView);
  if (snapshot) renderSnapshot();
  window.ClaraCoreDesktop.setLanguage(language).catch(console.error);
}

async function refresh() {
  snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
  renderSnapshot();
}

async function refreshResources() {
  const resources = await window.ClaraCoreDesktop.getResourceSnapshot();
  renderResourceSnapshot(resources);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});

refreshButton.addEventListener("click", () => {
  refresh().catch((error) => {
    console.error(error);
  });
});

primaryAction.addEventListener("click", () => {
  if (snapshot?.root) {
    window.ClaraCoreDesktop.openPath(`${snapshot.root}/gateway`);
  }
});

openGatewayFolder.addEventListener("click", () => {
  if (snapshot?.root) {
    window.ClaraCoreDesktop.openPath(`${snapshot.root}/gateway`);
  }
});

function showCopyNotice(label) {
  copyNotice.textContent = label;
  window.setTimeout(() => {
    copyNotice.textContent = "";
  }, 1800);
}

async function copyValue(value, label) {
  if (!value) return;
  const ok = await window.ClaraCoreDesktop.copyText(value);
  if (ok) showCopyNotice(label);
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!snapshot?.connections) return;
    if (button.dataset.copy === "mcp-command") {
      copyValue(snapshot.connections.mcpCommand, t("connections.copied.mcpCommand")).catch(console.error);
    }
    if (button.dataset.copy === "mcp-config") {
      copyValue(snapshot.connections.mcpConfig, t("connections.copied.mcpConfig")).catch(console.error);
    }
  });
});

httpEndpointList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.openUrl) {
    window.ClaraCoreDesktop.openExternal(button.dataset.openUrl).catch(console.error);
  }
  if (button.dataset.copyUrl) {
    copyValue(button.dataset.copyUrl, t("connections.copied.endpoint")).catch(console.error);
  }
});

openDevelopmentPlan.addEventListener("click", () => {
  if (snapshot?.plans?.development) {
    window.ClaraCoreDesktop.openPath(snapshot.plans.development);
  }
});

openDesignPlan.addEventListener("click", () => {
  if (snapshot?.plans?.design) {
    window.ClaraCoreDesktop.openPath(snapshot.plans.design);
  }
});

refresh().catch((error) => {
  if (coreStatus) coreStatus.textContent = "Error";
  if (coreHint) coreHint.textContent = error.message;
  runtimeMode.textContent = t("runtime.unavailable");
  rootPath.textContent = t("runtime.unableSnapshot");
});

refreshResources().catch((error) => {
  console.error(error);
  monitorCpu.textContent = "--";
  monitorRam.textContent = "--";
  monitorDisk.textContent = "--";
});
window.setInterval(() => {
  refreshResources().catch(console.error);
}, 5000);

applyStaticTranslations();
window.ClaraCoreDesktop.setLanguage(currentLanguage).catch(console.error);
setView("home");
