const {
  moduleGrid,
  brandVersion,
  runtimeMode,
  rootPath,
  topbarHealthIcon,
  topbarHealthLabel,
  topbarDataLabel,
  openDevelopmentPlan,
  openDesignPlan,
  dataLocation,
  dataHint,
  dataRootPath,
  exportBackup,
  exportProductJson,
  importProductJson,
  openBackupsFolder,
  backupNotice,
  productJsonNotice,
  backupList,
  restoreConfirmPanel,
  restorePreview,
  restoreConfirmInput,
  confirmRestoreBackup,
  cancelRestoreBackup,
  memoryStore,
  memoryStoreShort,
  gatewayHandshakeList,
  gatewayTraceList,
  logTerminal,
  refreshLogs,
  toggleLogFollow,
  eventList,
  healthSummary,
  healthList,
  homeCognitiveSystems,
  homeAgentViewList,
  homeTraceList,
  homePresenceEmptyAction,
  viewTitle,
  viewSubtitle,
  resourceMonitor,
  monitorRam,
  monitorProcess,
  monitorDisk,
  agentSetupNotice,
  agentSetupStatus,
  copyAgentSetup,
  memoriaProvider,
  memoriaEndpoint,
  memoriaModel,
  memoriaModelOptions,
  memoriaModelNotice,
  refreshMemoriaModels,
  testMemoriaConnection,
  memoriaConnectionNotice,
  memoriaModelStatus,
  innerLifeBackend,
  innerLifeEndpoint,
  innerLifeModel,
  innerLifeModelNotice,
  refreshInnerLifeModels,
  testInnerLifeConnection,
  innerLifeConnectionNotice,
  innerLifePollSeconds,
  innerLifeApiKey,
  copyInnerLifeApiKey,
  innerLifeModelStatus,
  saveMemorySettings,
  saveReflectionSettings,
  saveKnowledgeRoot,
  memorySettingsNotice,
  reflectionSettingsNotice,
  saveAppearanceSettings,
  appearanceSettingsNotice,
  saveDataRootSettings,
  storageSettingsNotice,
  settingsAgentGatewayToken,
  agentGatewaySettingsNotice,
  generateAgentGatewayToken,
  copyAgentGatewayToken,
  saveAgentGatewayConfig,
  settingsMemoryControllerMode,
  saveMemoryControllerMode,
  memoryControllerSettingsNotice,
  memorySearchInput,
  searchMemory,
  memoryList,
  memoryAgentFilter,
  memoryGraphSummary,
  memoryGraph,
  deletedMemoryList,
  restrictedMemoryList,
  archivedMemoryList,
  memoryAllLabelList,
  memoryAllHint,
  memoryRestrictedHint,
  memoryActiveCount,
  memoryDeletedCount,
  memoryEmbeddedCount,
  memoryPendingEmbeddingCount,
  memoryRestrictedCount,
  memoryArchivedCount,
  memoryLabelList,
  processMemoryEmbeddings,
  memoryEmbeddingNotice,
  memoryEmbeddingProgressBar,
  memoryTabs,
  memoryTabPanels,
  sharedLineSummary,
  sharedLinePast,
  sharedLineNext,
  sharedLineUpdated,
  sharedLineList,
  sharedLineActiveCount,
  sharedLineAgentFilter,
  sharedLineDetailTitle,
  sharedLineParticipants,
  sharedLineSelectionNotice,
  sharedLineContinuityPath,
  sharedLineUnderstandingSection,
  sharedLineUnderstanding,
  sharedLineUnresolvedSection,
  sharedLineUnresolved,
  sharedLineNotice,
  sharedLineAgentStatePanel,
  sharedLineMetadataPanel,
  sharedLineHistoryList,
  sharedLineSnapshotList,
  sharedLineArchiveList,
  sharedLineAdvancedDetails,
  sharedLineArchiveDetails,
  loadDemoData,
  clearDemoData,
  demoDataNotice
} = window.ClaraCoreDom;

const translations = window.ClaraCoreTranslations || { en: {} };
const views = window.ClaraCoreViews || {};
const {
  escapeHtml,
  safeJsonObject,
  formatBytes,
  formatLocalDateTime,
  splitListInput,
  formatSharedLineMetaValue,
  renderReadableText,
  renderMarkdownPreview,
  itemAgentId: sharedItemAgentId,
  filterByAgent: sharedFilterByAgent,
  renderAgentFilter: sharedRenderAgentFilter
} = window.ClaraCoreUtils;

function initialLanguage() {
  return String(navigator.language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

let currentLanguage = initialLanguage();
let loginItemPreference = {
  launchAtLogin: false,
  launchAtLoginAvailable: false
};

function t(key, values = {}) {
  const template = translations[currentLanguage]?.[key] || translations.en[key] || key;
  return Object.entries(values).reduce((result, [name, value]) => result.replace(`{${name}}`, value), template);
}

let snapshot = null;
let activeView = "home";
let editingMemoryId = null;
let knowledgeRootRequest = 0;
let knowledgeRootBusy = false;
const settingsOperations = new Set();
const rendererState = {
  activeSharedLineAgentFilter: "",
  activeMemoryAgentFilter: "",
  activeInnerLifeAgentFilter: "",
  innerLifeSessionsLoading: false,
  innerLifeSessionTotals: {},
  innerLifeDigestRunsLoading: false,
  innerLifeDigestTotals: {},
  innerLifeInboxLoading: false,
  innerLifeInboxTotals: {},
  selectedSharedLineId: "",
  selectedSharedLinePacket: null,
  dataRootPreference: null
};
let runtimeRefreshTimer = null;
const pendingRuntimeScopes = new Set();
const hydratedViews = new Set();
const hydratingViews = new Map();
const viewDetailReadCounts = new Map();
const localOnlyHydrationViews = new Set(["memory", "agent-setup", "knowledge"]);
const viewOwnedSnapshotFields = {
  memory: ["memories", "memoryGraph", "restrictedMemoryGraph", "memoryController"],
  home: ["agentActivitySummary", "homeMilestones", "homeMilestonesError"],
  "shared-line": ["sharedLine"],
  innerlife: ["innerLife"],
  logs: ["decayAudit", "runtimeEvents", "trace"],
  settings: ["backups", "operationalStatus"]
};
const runtimeScopeInvalidations = {
  memory: ["memory", "home", "logs"],
  "shared-line": ["shared-line", "home", "logs"],
  innerlife: ["innerlife", "home", "logs"],
  logs: ["logs"],
  data: ["settings"],
  "agent-setup": [],
  home: ["home"],
  settings: ["settings"]
};
let snapshotGeneration = 0;
let runtimeRefreshRevision = 0;
let runtimeRefreshCompletedRevision = 0;
const appearance = window.createClaraCoreAppearance({
  desktop: window.ClaraCoreDesktop,
  onSystemPreferenceChange: () => renderSettings()
});
const modelOptions = window.createClaraCoreModelOptions({
  dom: window.ClaraCoreDom,
  t,
  getSecretInputValue
});
const knowledgeView = window.createClaraCoreKnowledgeView({
  dom: window.ClaraCoreDom, api: window.ClaraCoreDesktop, t,
  markdown: window.ClaraCoreKnowledgeMarkdown, formatLocalDateTime
});

const logsView = window.createClaraCoreLogsView({
  dom: window.ClaraCoreDom,
  t,
  escapeHtml,
  formatLocalDateTime,
  getSnapshot: () => snapshot,
  refreshSnapshot: refreshLogsSnapshot
});
const agentSetupView = window.createClaraCoreAgentSetupView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  copyValue,
  formatLocalDateTime,
  refreshSnapshot: () => refreshRuntimeSnapshotOnly(["agent-setup"])
});
const dataView = window.createClaraCoreDataView({
  dom: window.ClaraCoreDom,
  t,
  escapeHtml,
  formatBytes,
  formatLocalDateTime,
  getSnapshot: () => snapshot,
  refresh,
  showCopyNotice,
  onPolicySaved: () => settingsDialogs.saved("recovery")
});
const memoriaView = window.createClaraCoreMemoriaView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  getSnapshotGeneration: () => snapshotGeneration,
  escapeHtml,
  renderMarkdownPreview,
  formatLocalDateTime,
  refreshRuntimeSnapshotOnly: () => refreshForRuntimeScopes(["snapshot", "memory"]),
  appendLiveLogLine,
  setEmbeddingProgress
});
const memoriaActions = window.createClaraCoreMemoriaActions({
  desktop: window.ClaraCoreDesktop,
  dom: window.ClaraCoreDom,
  memoriaView,
  state: rendererState,
  t,
  refresh,
  showCopyNotice,
  renderMemoryResults,
  renderMemoryTabs,
  loadMemoryTabData
});
const homeView = window.createClaraCoreHomeView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  escapeHtml,
  safeJsonObject,
  itemAgentId: sharedItemAgentId,
  filterByAgent: sharedFilterByAgent,
  formatMode
});
const homeUnderstanding = window.createClaraCoreHomeUnderstanding({
  root: document.querySelector("#homeUnderstanding"),
  api: window.ClaraCoreDesktop,
  t,
  getSnapshot: () => snapshot,
  onOpenLine: async (button, { isCurrent }) => {
    await sharedLineActions.selectLine(button);
    if (!isCurrent()) return;
    const lineId = button.dataset.sharedLineId;
    if (rendererState.selectedSharedLineId !== lineId || rendererState.selectedSharedLinePacket?.lineId !== lineId) {
      throw new Error("The selected shared line could not be opened");
    }
    setView("shared-line");
  }
});
const settingsView = window.createClaraCoreSettingsView({
  dom: window.ClaraCoreDom,
  desktop: window.ClaraCoreDesktop,
  t,
  getSnapshot: () => snapshot,
  getAppearancePreferences,
  state: rendererState,
  onModelsRendered: () => modelOptions.syncInputs()
});
const settingsDialogs = window.createClaraCoreSettingsDialogs({
  root: document.getElementById("settingsView"), t,
  summary: settingsSummary,
  isDirty: scope => scope === "models" ? settingsView.isDirty("memory") || settingsView.isDirty("reflection") : scope === "recovery" ? dataView.isDirty() : settingsView.isDirty(scope),
  isBusy: scope => (scope === "models" && (settingsOperations.has("memory") || settingsOperations.has("reflection"))) || settingsOperations.has(scope) || (scope === "knowledge" ? knowledgeRootBusy : scope === "recovery" ? dataView.isBusy() : false),
  discard: scope => {
    if (scope === "recovery") dataView.discardDraft();
    else if (scope === "models") { settingsView.discardScope("memory"); settingsView.discardScope("reflection"); }
    else settingsView.discardScope(scope);
    renderSettings();
    if (scope === "knowledge") renderKnowledgeRootPreference(rendererState.knowledgeRootPreference || {});
  },
  onOpen: scope => {
    renderSettings();
    if (scope === "recovery") dataView.renderBackups();
    if (scope === "knowledge") loadKnowledgeRootPreference();
  }
});

function settingsSummary(scope) {
  const config = snapshot?.configuration || {};
  const preferences = getAppearancePreferences();
  const memoria = config.memoria || {};
  const innerlife = config.innerlife || {};
  switch (scope) {
    case "models": return `${t("settings.retrievalModel")}: ${settingsSummary("memory")} · ${t("settings.generationModel")}: ${innerlife.backend === "disabled" ? t("settings.status.disabled") : innerlife.model || t("settings.provider.needsSetup")}`;
    case "appearance": return `${preferences.language === "zh" ? "中文" : "English"} · ${t(preferences.theme === "light" ? "settings.themeLight" : preferences.theme === "dark" ? "settings.themeDark" : "settings.themeSystem")}`;
    case "memory": return memoria.providerSupported === false ? t("settings.provider.needsSetup") : memoria.provider === "disabled" ? t("settings.status.disabled") : memoria.model || t("settings.provider.needsSetup");
    case "reflection": return (innerlife.autonomyEnabled === true || innerlife.autonomyEnabled === "true") && innerlife.backend !== "disabled" ? innerlife.model || t("settings.provider.needsSetup") : t("settings.status.disabled");
    case "controller": return t(config.memoryController?.configurationValid === false ? "settings.controllerInvalid" : config.memoryController?.mode === "canary" ? "settings.memoryControllerCanary" : config.memoryController?.mode === "observe" ? "settings.memoryControllerObserve" : "settings.memoryControllerOff");
    case "gateway": { const gateway = snapshot?.connections?.httpGateway; return gateway?.error ? t("common.error") : gateway?.ok ? t("settings.status.ready") : t("common.checking"); }
    case "knowledge": return rendererState.knowledgeRootError ? t("common.error") : rendererState.knowledgeRootPreference ? rendererState.knowledgeRootPreference.root || t("knowledge.directory.notSelected") : t("common.checking");
    case "storage": return rendererState.dataRootPreference?.restartRequired ? t("settings.dataRootRestartRequired") : snapshot?.data?.root || "-";
    case "recovery": return t(config.backup?.enabled !== false && config.backup?.schedule === "daily" ? "data.backupDaily" : "data.backupManual");
    default: return "-";
  }
}
const sharedInnerLifeView = window.createClaraCoreSharedInnerLifeView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  escapeHtml,
  formatSharedLineMetaValue,
  formatLocalDateTime,
  renderReadableText,
  itemAgentId: sharedItemAgentId,
  filterByAgent: sharedFilterByAgent,
  renderAgentFilter: sharedRenderAgentFilter,
  state: rendererState,
  renderMemoryResults,
  memoryAgentId
});
const activitySummary = window.createClaraCoreActivitySummary({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  escapeHtml,
  formatLocalDateTime
});
const sharedLineActions = window.createClaraCoreSharedLineActions({
  desktop: window.ClaraCoreDesktop,
  dom: window.ClaraCoreDom,
  state: rendererState,
  t,
  copyValue,
  renderSharedLine
});
const innerLifeActions = window.createClaraCoreInnerLifeActions({
  desktop: window.ClaraCoreDesktop,
  dom: window.ClaraCoreDom,
  state: rendererState,
  t,
  getSnapshot: () => snapshot,
  renderInnerLife,
  refresh,
  refreshRuntimeSnapshotOnly,
  showCopyNotice,
  splitListInput,
  itemAgentId: sharedItemAgentId
});

function formatMode(mode) {
  if (mode === "custom-product-data") return t("runtime.customProductData");
  if (mode === "isolated-product-dev") return t("runtime.isolatedProductDev");
  return mode === "custom-root" ? t("runtime.customRoot") : t("runtime.developmentRoot");
}

function renderModules(modules) {
  homeView.renderModules(modules);
}

function renderEvents() {
  homeView.renderEvents();
}

function renderHomeDashboard() {
  homeView.renderHomeDashboard();
  homeUnderstanding.render();
}

function renderHealth() {
  homeView.renderHealth();
}

function renderConnections() {
  homeView.renderConnections();
}

function renderLogs() {
  logsView.render();
}

function appendLiveLogLine(source, message) {
  logsView.appendLiveLine(source, message);
}

function setEmbeddingProgress(stats, progress) {
  if (memoryEmbeddedCount) memoryEmbeddedCount.textContent = stats.embeddedCount ?? 0;
  if (memoryPendingEmbeddingCount) memoryPendingEmbeddingCount.textContent = stats.pendingEmbeddingCount ?? 0;
  const pending = Number(stats.pendingEmbeddingCount || 0);
  const text = t("memory.embedding.progress", {
    processed: progress.processed,
    total: progress.total,
    ready: progress.ready,
    failed: progress.failed,
    pending
  });
  if (memoryEmbeddingNotice) memoryEmbeddingNotice.textContent = text;
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;
  if (memoryEmbeddingProgressBar) memoryEmbeddingProgressBar.style.width = `${percent}%`;
  appendLiveLogLine("memoria", text);
}

function renderAgentSetup() {
  agentSetupView.render();
}

function getSecretInputValue(input) {
  return settingsView.getSecretInputValue(input);
}

async function loadModelOptions(kind) {
  return modelOptions.loadModelOptions(kind);
}

async function testModelConnection(kind) {
  return modelOptions.testModelConnection(kind);
}

function renderSettings() {
  settingsView.renderSettings();
  settingsView.renderAppearanceSettings();
  settingsDialogs.render();
}

function collectSettingsForm(scope) {
  return settingsView.collectSettingsForm(scope);
}

function collectAppearanceSettingsForm() {
  return settingsView.collectAppearanceSettingsForm();
}

function getAppearancePreferences() {
  return {
    language: currentLanguage,
    ...appearance.getPreferences(),
    ...loginItemPreference
  };
}

function setTheme(theme) {
  appearance.setTheme(theme);
}

function setWindowCloseBehavior(closeBehavior) {
  appearance.setWindowCloseBehavior(closeBehavior);
}

function memoryAgentId(memory) {
  return memoriaView.memoryAgentId(memory);
}

function renderMemoryList() {
  memoriaView.renderMemoryList();
}

function renderMemoryResults(memories, target = memoryList, options = {}) {
  memoriaView.renderMemoryResults(memories, target, options);
}

function renderMemoryTabs() {
  memoriaView.renderMemoryTabs();
}

async function loadMemoryTabData(tabName, options = {}) {
  return memoriaView.loadMemoryTabData(tabName, options);
}

function renderMemoryOverview() {
  memoriaView.renderMemoryOverview();
}

function renderSharedLine() {
  sharedInnerLifeView.renderSharedLine();
}

function renderInnerLife() {
  sharedInnerLifeView.renderInnerLife();
}

function renderBackups() {
  dataView.renderBackups();
}

function renderTopbarStatus() {
  const healthStatus = snapshot?.health?.status || "warn";
  topbarHealthIcon.className = `dot ${healthStatus === "ok" ? "ok-dot" : healthStatus === "error" ? "error-dot" : "warn-dot"}`;
  topbarHealthLabel.textContent =
    healthStatus === "ok"
      ? t("status.healthReady")
      : healthStatus === "error"
        ? t("status.healthError")
        : t("status.healthAttention");
  topbarDataLabel.textContent = snapshot?.data?.databasePresent ? t("status.databaseReady") : t("status.databaseMissing");
}

function ensurePageFocus(viewName) {
  const panel = views[viewName]?.panel;
  if (!panel) return null;
  let focus = panel.querySelector(":scope > .page-focus");
  if (!focus) {
    focus = document.createElement("section");
    focus.className = "page-focus";
    focus.setAttribute("aria-label", t("focus.label"));
    panel.prepend(focus);
  }
  return focus;
}

function focusMetric(label, value) {
  return { label, value: value == null || value === "" ? "-" : String(value) };
}

function renderFocusBlock(viewName, config) {
  const focus = ensurePageFocus(viewName);
  if (!focus) return;
  const tone = config.tone || "ok";
  const actionTarget = String(config.actionTarget || "").trim();
  const shouldShowAction = actionTarget && actionTarget !== viewName;
  focus.className = `page-focus ${tone}`;
  focus.innerHTML = `
    <div class="page-focus-copy">
      <span class="page-focus-kicker">${escapeHtml(t("focus.kicker"))}</span>
      <h2>${escapeHtml(config.title)}</h2>
      <p>${escapeHtml(config.body)}</p>
    </div>
    <div class="page-focus-side">
      <div class="page-focus-metrics">
        ${(config.metrics || [])
          .map((metric) => `<span>${escapeHtml(metric.label)} <strong>${escapeHtml(metric.value)}</strong></span>`)
          .join("")}
      </div>
      ${
        shouldShowAction
          ? `<button class="secondary page-focus-action" data-view-target="${escapeHtml(actionTarget)}">${escapeHtml(config.actionLabel)}</button>`
          : ""
      }
    </div>
  `;
}

function renderPageFocus() {
  if (!snapshot) return;
  const healthStatus = snapshot.health?.status || "warn";
  const stats = snapshot.memoryStats || {};
  const gatewayTraces = snapshot.gatewayTraces || [];
  const gatewayErrors = homeView.actionableGatewayErrorCount();
  const sharedLine = snapshot.sharedLine || {};
  const currentLine = sharedLine.currentPosition || {};
  const innerLife = snapshot.innerLife || {};
  const innerCounts = innerLife.counts || {};
  const daemon = innerLife.daemon || {};
  // Pending shares are agent-owned waiting state, not human work; they are
  // shown as ambient counts but never counted as attention.
  const attentionCount = homeView.actionableAttentionCount();
  const attentionHasError = homeView.hasActionableError();

  renderFocusBlock("home", {
    tone: attentionHasError ? "error" : attentionCount ? "warn" : "ok",
    title: attentionCount ? t("focus.home.attention", { count: String(attentionCount) }) : t("focus.home.ok"),
    body: currentLine.summary
      ? t("focus.home.line", { summary: currentLine.summary })
      : t("focus.home.noLine"),
    metrics: [
      focusMetric(t("focus.metric.attention"), attentionCount),
      focusMetric(t("focus.metric.gatewayErrors"), gatewayErrors),
      focusMetric(t("focus.metric.pendingShares"), innerCounts.pending_shares_count || 0)
    ],
    actionLabel: attentionCount ? t("focus.action.reviewAttention") : t("focus.action.openSharedLine"),
    actionTarget: attentionCount
      ? Number(stats.pendingEmbeddingCount || 0) || Number(stats.failedEmbeddingCount || 0)
        ? "memory"
        : "agent-setup"
      : "shared-line"
  });

  // Home owns its own calm presence hierarchy; the generic metric focus block
  // would turn it back into a dashboard.
  views.home?.panel?.querySelector(":scope > .page-focus")?.remove();

  views.memory?.panel?.querySelector(":scope > .page-focus")?.remove();

  views["shared-line"]?.panel?.querySelector(":scope > .page-focus")?.remove();

  views.innerlife?.panel?.querySelector(":scope > .page-focus")?.remove();


  views["agent-setup"]?.panel?.querySelector(":scope > .page-focus")?.remove();

  views.logs?.panel?.querySelector(":scope > .page-focus")?.remove();

  views.settings?.panel?.querySelector(":scope > .page-focus")?.remove();
}

function renderSnapshot() {
  if (brandVersion) brandVersion.textContent = `Desktop v${snapshot.productVersion || "-"}`;
  if (runtimeMode) runtimeMode.textContent = formatMode(snapshot.mode);
  if (rootPath) rootPath.textContent = snapshot.root;
  if (dataLocation) dataLocation.textContent = snapshot.data.root;
  if (dataHint) dataHint.textContent = snapshot.data.databasePresent ? t("runtime.databaseReady") : t("runtime.databaseNotCreated");
  dataRootPath.textContent = snapshot.data.root;
  if (memoryStore) memoryStore.textContent = snapshot.data.databasePath;
  if (memoryStoreShort) memoryStoreShort.textContent = snapshot.data.databasePresent ? t("common.found") : t("common.notCreated");
  renderTopbarStatus();
  renderPageFocus();
  renderModules(snapshot.modules);
  renderHomeDashboard();
  renderHealth();
  renderEvents();
  renderConnections();
  renderLogs();
  renderAgentSetup();
  renderSettings();
  renderMemoryOverview();
  renderMemoryList();
  renderSharedLine();
  renderInnerLife();
  activitySummary.render();
  renderBackups();
}

function renderResourceSnapshot(resources) {
  const memoryPercent = Number(resources.memory?.percent);
  const diskPercent = Number(resources.disk?.percent);
  const warning = resources.warning === true;
  if (resourceMonitor) resourceMonitor.hidden = !warning;
  if (!warning) return;
  if (monitorRam) {
    monitorRam.textContent =
      resources.memory?.text && Number.isFinite(memoryPercent)
        ? `${resources.memory.text} (${memoryPercent}%)`
        : "--";
  }
  if (monitorProcess) {
    const processMemory = resources.processMemory || {};
    monitorProcess.textContent = processMemory.totalRssText || "--";
    monitorProcess.title = [
      `main rss: ${processMemory.main?.rssText || "-"}`,
      `renderer rss: ${processMemory.renderer?.rssText || "-"}`,
      `gateway rss: ${processMemory.gateway?.rssText || "-"}`
    ].join("\n");
  }
  if (monitorDisk) {
    monitorDisk.textContent =
      resources.disk?.text && Number.isFinite(diskPercent)
        ? `${resources.disk.text} (${diskPercent}%)`
        : "--";
  }
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
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
}

function setView(viewName) {
  const nextView = views[viewName] ? viewName : "home";
  const enteringLogs = nextView === "logs" && activeView !== "logs";
  if (nextView !== "settings") settingsDialogs.clearOverviewNotice();
  activeView = nextView;
  Object.entries(views).forEach(([name, view]) => {
    view.panel.classList.toggle("active-view", name === nextView);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
    if (button.dataset.view === nextView) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  viewTitle.textContent = t(views[nextView].titleKey);
  viewSubtitle.textContent = t(views[nextView].subtitleKey);
  if (nextView === "settings") { loadKnowledgeRootPreference().catch(console.error); }
  homeView.setActive(nextView === "home");
  homeUnderstanding.setActive(nextView === "home");
  knowledgeView.setActive(nextView === "knowledge");
  if (enteringLogs) logsView.closeAdvancedDiagnostics();
  syncLogRefreshTimer();
  if (snapshot) {
    hydrateView(nextView).catch(console.error);
    dataRefreshLoop.refreshNow();
  }
}

function renderKnowledgeRootPreference(preference) {
  const { knowledgeRootPath, knowledgeRootStatus, clearKnowledgeRoot, knowledgeRootClearHint } = window.ClaraCoreDom;
  if (!knowledgeRootPath || !knowledgeRootStatus) return;
  rendererState.knowledgeRootError = false;
  rendererState.knowledgeRootPreference = preference;
  settingsDialogs.render();
  if (settingsView.isDirty("knowledge")) return;
  knowledgeRootPath.value = preference.root || "";
  if (clearKnowledgeRoot) clearKnowledgeRoot.hidden = !preference.root;
  if (knowledgeRootClearHint) knowledgeRootClearHint.hidden = !preference.root;
  const keys = {
    not_selected: "knowledge.directory.notSelected",
    ok: "knowledge.directory.ready",
    empty_corpus: "knowledge.directory.empty",
    root_missing: "knowledge.directory.rootMissing",
    permission_denied: "knowledge.directory.permissionDenied"
  };
  knowledgeRootStatus.textContent = t(keys[preference.status] || "knowledge.directory.invalid", {
    count: preference.documentCount || 0
  });
}

async function loadKnowledgeRootPreference() {
  const request = ++knowledgeRootRequest;
  try {
    const preference = await window.ClaraCoreDesktop.getKnowledgeRootPreference();
    if (request === knowledgeRootRequest && !knowledgeRootBusy) renderKnowledgeRootPreference(preference);
  } catch (error) {
    if (request === knowledgeRootRequest) {
      rendererState.knowledgeRootError = true;
      window.ClaraCoreDom.knowledgeRootStatus.textContent = t("knowledge.directory.invalid");
      settingsDialogs.render();
    }
    console.error(error);
  }
}

function setKnowledgeRootBusy(busy) {
  knowledgeRootBusy = busy;
  if (saveKnowledgeRoot) saveKnowledgeRoot.disabled = busy;
  window.ClaraCoreDom.chooseKnowledgeRoot.disabled = busy;
  window.ClaraCoreDom.clearKnowledgeRoot.disabled = busy;
}

function allViewNames() {
  return Object.keys(views);
}

function invalidatedViewsForRuntimeScopes(scopes = []) {
  const normalizedScopes = [...new Set(
    (Array.isArray(scopes) ? scopes : [])
      .map((scope) => String(scope || "").trim())
      .filter(Boolean)
  )];
  const specificScopes = normalizedScopes.filter((scope) => scope !== "snapshot");
  if (specificScopes.length === 0 || specificScopes.includes("all")) {
    return new Set(allViewNames());
  }
  const invalidated = new Set();
  for (const scope of specificScopes) {
    const affectedViews = runtimeScopeInvalidations[scope];
    if (!affectedViews) return new Set(allViewNames());
    affectedViews.forEach((viewName) => invalidated.add(viewName));
  }
  return invalidated;
}

function mergeHydratedViewState(nextSnapshot, sourceSnapshot, invalidatedViews) {
  const merged = { ...nextSnapshot };
  if (!sourceSnapshot || typeof sourceSnapshot !== "object") return merged;
  for (const [viewName, fields] of Object.entries(viewOwnedSnapshotFields)) {
    if (!hydratedViews.has(viewName) || invalidatedViews.has(viewName)) continue;
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(sourceSnapshot, field)) {
        merged[field] = sourceSnapshot[field];
      }
    }
  }
  return merged;
}

async function hydrateView(viewName, { force = false } = {}) {
  if (!snapshot) return;
  if (!force && hydratedViews.has(viewName)) return;
  const generation = snapshotGeneration;
  const existing = hydratingViews.get(viewName);
  if (existing?.generation === generation) return existing.request;
  if (localOnlyHydrationViews.has(viewName)) {
    const request = (async () => {
      if (viewName === "memory") {
        const result = await loadMemoryTabData(memoriaView.getActiveTab());
        if (result?.stale) return;
      }
      if (generation === snapshotGeneration) hydratedViews.add(viewName);
    })().finally(() => {
      if (hydratingViews.get(viewName)?.request === request) hydratingViews.delete(viewName);
    });
    hydratingViews.set(viewName, { generation, request });
    return request;
  }
  const sharedLineCatalog = snapshot.sharedLine;
  const request = (async () => {
    if (viewName === "memory") {
      const result = await loadMemoryTabData(memoriaView.getActiveTab());
      if (result?.stale || generation !== snapshotGeneration) return;
      if (typeof window.ClaraCoreDesktop.getViewSnapshot === "function") {
        viewDetailReadCounts.set(viewName, (viewDetailReadCounts.get(viewName) || 0) + 1);
        const detail = await window.ClaraCoreDesktop.getViewSnapshot(viewName);
        if (generation !== snapshotGeneration) return;
        if (detail && typeof detail === "object") snapshot = { ...snapshot, ...detail };
      }
      hydratedViews.add(viewName);
      memoriaView.renderMemoryOverview();
      return;
    }
    if (viewName === "innerlife") {
      if (await innerLifeActions.loadSnapshot() && generation === snapshotGeneration) hydratedViews.add(viewName);
      return;
    }
    if (viewName === "shared-line") {
      let catalog = sharedLineCatalog;
      if (typeof window.ClaraCoreDesktop.getViewSnapshot === "function") {
        viewDetailReadCounts.set(viewName, (viewDetailReadCounts.get(viewName) || 0) + 1);
        const detail = await window.ClaraCoreDesktop.getViewSnapshot(viewName);
        if (generation !== snapshotGeneration) return;
        if (detail?.sharedLine && typeof detail.sharedLine === "object") {
          snapshot = { ...snapshot, sharedLine: detail.sharedLine };
          catalog = detail.sharedLine;
          sharedLineActions.syncSelectedLineCatalog(catalog);
        }
      }
      catalog = await sharedLineActions.loadCatalog();
      if (!catalog || generation !== snapshotGeneration) return;
      const packet = await sharedLineActions.hydrateSelectedLine(catalog);
      if (generation !== snapshotGeneration) return;
      if (packet) hydratedViews.add(viewName);
      renderSharedLine();
      return;
    }
    if (typeof window.ClaraCoreDesktop.getViewSnapshot !== "function") return;
    viewDetailReadCounts.set(viewName, (viewDetailReadCounts.get(viewName) || 0) + 1);
    const detail = await window.ClaraCoreDesktop.getViewSnapshot(viewName);
    if (generation !== snapshotGeneration || !detail || typeof detail !== "object") return;
    snapshot = { ...snapshot, ...detail };
    if (viewName === "home") delete snapshot.homeMilestonesError;
    hydratedViews.add(viewName);
    if (viewName === "innerlife") {
      renderInnerLife();
    } else if (viewName === "logs") {
      renderLogs();
      activitySummary.render();
    } else if (viewName === "settings") {
      renderBackups();
    } else if (viewName === "home") {
      renderHomeDashboard();
      activitySummary.render();
    }
  })().catch(error => {
    if (viewName === "home" && generation === snapshotGeneration) {
      snapshot = { ...snapshot, homeMilestonesError: true };
      activitySummary.render();
    }
    throw error;
  }).finally(() => {
    if (hydratingViews.get(viewName)?.request === request) hydratingViews.delete(viewName);
  });
  hydratingViews.set(viewName, { generation, request });
  return request;
}

function setLanguage(language) {
  if (!translations[language]) return;
  currentLanguage = language;
  applyStaticTranslations();
  setView(activeView);
  if (snapshot) renderSnapshot();
  window.ClaraCoreDesktop.saveUiPreferences?.({ language }).catch(console.error);
  window.ClaraCoreDesktop.setLanguage(language).catch(console.error);
}

function applyUiPreferences(preferences = {}) {
  const nextLanguage = translations[preferences.language] ? preferences.language : currentLanguage;
  const languageChanged = nextLanguage !== currentLanguage;
  currentLanguage = nextLanguage;
  appearance.applyPreferences(preferences);
  if (languageChanged) {
    applyStaticTranslations();
    setView(activeView);
    if (snapshot) renderSnapshot();
  }
  window.ClaraCoreDesktop.setLanguage(currentLanguage).catch(console.error);
}

async function hydrateUiPreferences() {
  const preferences = await window.ClaraCoreDesktop.getUiPreferences?.();
  if (preferences) {
    loginItemPreference = {
      launchAtLogin: Boolean(preferences.launchAtLogin),
      launchAtLoginAvailable: Boolean(preferences.launchAtLoginAvailable)
    };
    applyUiPreferences(preferences);
  }
}

async function refresh() {
  const refreshRevision = ++runtimeRefreshRevision;
  snapshotGeneration += 1;
  hydratedViews.clear();
  const [nextSnapshot, dataRootPreference] = await Promise.all([
    window.ClaraCoreDesktop.getRuntimeSnapshot(),
    window.ClaraCoreDesktop.getDataRootPreference()
  ]);
  if (refreshRevision !== runtimeRefreshRevision) return;
  snapshot = nextSnapshot;
  rendererState.dataRootPreference = dataRootPreference;
  sharedLineActions.syncSelectedLineCatalog(snapshot.sharedLine);
  hydratedViews.clear();
  memoriaView.resetLoadedTabs();
  renderSnapshot();
  if (activeView === "home") hydrateView(activeView).catch(console.error);
  else await hydrateView(activeView);
  runtimeRefreshCompletedRevision = refreshRevision;
}

async function refreshRuntimeSnapshotOnly(
  scopes = [],
  invalidatedViews = invalidatedViewsForRuntimeScopes(scopes),
  { visibleOnly = false } = {}
) {
  const refreshRevision = ++runtimeRefreshRevision;
  snapshotGeneration += 1;
  invalidatedViews.forEach((viewName) => hydratedViews.delete(viewName));
  const [nextSnapshot, dataRootPreference] = await Promise.all([
    window.ClaraCoreDesktop.getRuntimeSnapshot(),
    window.ClaraCoreDesktop.getDataRootPreference()
  ]);
  if (refreshRevision !== runtimeRefreshRevision) return;
  if (visibleOnly && !canRefreshVisibleData()) return;
  invalidatedViews.forEach((viewName) => hydratedViews.delete(viewName));
  snapshot = mergeHydratedViewState(nextSnapshot, snapshot, invalidatedViews);
  rendererState.dataRootPreference = dataRootPreference;
  sharedLineActions.syncSelectedLineCatalog(snapshot.sharedLine);
  if (visibleOnly) {
    renderTopbarStatus();
    if (activeView === "memory") renderMemoryOverview();
    if (activeView === "home") renderHomeDashboard();
  } else renderSnapshot();
  if (activeView === "home") hydrateView(activeView).catch(console.error);
  else await hydrateView(activeView);
  runtimeRefreshCompletedRevision = refreshRevision;
}

async function refreshLogsSnapshot() {
  const logsSnapshot = typeof window.ClaraCoreDesktop.getLogsSnapshot === "function"
    ? await window.ClaraCoreDesktop.getLogsSnapshot()
    : await window.ClaraCoreDesktop.getRuntimeSnapshot();
  if (!Array.isArray(logsSnapshot?.gatewayTraces) || !Array.isArray(logsSnapshot?.runtimeEvents)) {
    throw new Error(t("logs.incompleteSnapshot"));
  }
  snapshot = {
    ...(snapshot || {}),
    gatewayTraces: logsSnapshot.gatewayTraces,
    runtimeEvents: logsSnapshot.runtimeEvents,
    logsUpdatedAt: logsSnapshot.generatedAt || new Date().toISOString()
  };
  renderLogs();
  return logsSnapshot;
}

async function refreshForRuntimeScopes(scopes = [], options = {}) {
  const invalidatedViews = invalidatedViewsForRuntimeScopes(scopes);
  if (invalidatedViews.has("memory")) memoriaView.resetLoadedTabs();
  await refreshRuntimeSnapshotOnly(scopes, invalidatedViews, options);
  if (invalidatedViews.has("logs") && activeView === "logs") {
    await refreshLogsSnapshot();
  }
}

function syncLogRefreshTimer() {
  logsView.syncRefreshTimer(activeView);
}

const resourceRefreshLoop = window.createClaraCoreResourceRefreshLoop({
  documentRef: document,
  fetchSnapshot: () => window.ClaraCoreDesktop.getResourceSnapshot(),
  renderSnapshot: renderResourceSnapshot,
  handleError: (error) => {
    console.error(error);
    if (resourceMonitor) resourceMonitor.hidden = true;
  }
});

// IPC notifications cannot cover writes from standalone maintenance processes.
// Bound visible-page staleness without polling hidden windows or resetting edits.
function canRefreshVisibleData() {
  return Boolean(snapshot) && !document.hidden && ["home", "memory", "shared-line", "innerlife", "settings"].includes(activeView)
    && !document.querySelector("dialog[open]")
    && !document.activeElement?.matches("input, textarea, select, [contenteditable=true]")
    && !(activeView === "memory" && String(memorySearchInput?.value || "").trim());
}

const dataRefreshLoop = window.createClaraCoreResourceRefreshLoop({
  documentRef: document,
  windowRef: window,
  refreshOnResume: true,
  intervalMs: 30_000,
  requestTimeoutMs: 15_000,
  canRefresh: canRefreshVisibleData,
  fetchSnapshot: () => refreshForRuntimeScopes(["memory", "shared-line", "innerlife", "data"], { visibleOnly: true }),
  renderSnapshot: () => {},
  handleError: (error) => {
    runtimeRefreshRevision += 1;
    snapshotGeneration += 1;
    console.error("Visible data refresh failed:", error);
  }
});

function scheduleRuntimeRefresh(scopes = ["snapshot"]) {
  scopes.forEach((scope) => pendingRuntimeScopes.add(scope));
  if (runtimeRefreshTimer) return;
  runtimeRefreshTimer = window.setTimeout(() => {
    runtimeRefreshTimer = null;
    const nextScopes = [...pendingRuntimeScopes];
    pendingRuntimeScopes.clear();
    refreshForRuntimeScopes(nextScopes).catch(console.error);
  }, 250);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view-target]");
  if (!target) return;
  if (settingsDialogs.isOpen() && !settingsDialogs.requestClose()) return;
  setView(target.dataset.viewTarget);
  if (target.dataset.settingsTarget) {
    const aliases = { capabilities: "memory", "app-data": "appearance", advanced: "controller" };
    settingsDialogs.open(aliases[target.dataset.settingsTarget] || target.dataset.settingsTarget);
  }
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-attention-action]");
  if (!target) return;
  if (target.dataset.attentionAction === "memory-vectors") {
    const previousText = target.textContent;
    target.disabled = true;
    target.textContent = t("memory.embedding.processing");
    memoriaView
      .processEmbeddings()
      .finally(() => {
        target.disabled = false;
        target.textContent = previousText;
      });
  }
});

homePresenceEmptyAction?.addEventListener("click", () => {
  if (homePresenceEmptyAction.dataset.homeAction !== "retry") return;
  homeView.renderLoading();
  refresh().catch(handleHomeRefreshError);
});

document.querySelector("#homeUnderstanding")?.addEventListener("click", (event) => {
  if (!event.target.closest('[data-home-action="retry"]')) return;
  homeUnderstanding.renderLoading();
  refresh().catch(handleHomeRefreshError);
});

async function runDemoDataAction(button, action, busyKey) {
  if (!button) return;
  button.disabled = true;
  if (demoDataNotice) demoDataNotice.textContent = t(busyKey);
  try {
    await action();
    await refreshForRuntimeScopes(["snapshot"]);
  } catch (error) {
    console.error(error);
    if (demoDataNotice) demoDataNotice.textContent = t("home.onboarding.demo.failed");
  } finally {
    button.disabled = false;
  }
}

loadDemoData?.addEventListener("click", () => {
  runDemoDataAction(loadDemoData, () => window.ClaraCoreDesktop.seedDemoData(), "home.onboarding.demo.loading");
});

clearDemoData?.addEventListener("click", () => {
  runDemoDataAction(clearDemoData, () => window.ClaraCoreDesktop.clearDemoData(), "home.onboarding.demo.clearing");
});

window.ClaraCoreDom.refreshAgentSetup?.addEventListener("click", () => agentSetupView.refresh());
copyAgentSetup?.addEventListener("click", () => {
  agentSetupView.copy().catch(console.error);
});

generateAgentGatewayToken?.addEventListener("click", () => {
  if (settingsAgentGatewayToken) settingsAgentGatewayToken.value = randomAgentGatewayToken();
  settingsView.markDirty("gateway");
  if (agentGatewaySettingsNotice) agentGatewaySettingsNotice.textContent = t("settings.generatedToken");
});

copyAgentGatewayToken?.addEventListener("click", () => {
  copyValue(settingsAgentGatewayToken?.value || "", t("settings.apiKey.copied"), agentGatewaySettingsNotice).catch(console.error);
});

saveAgentGatewayConfig?.addEventListener("click", async () => {
  if (!window.confirm(t("settings.agentGatewaySaveConfirm"))) return;
  const revision = settingsView.draftRevision("gateway");
  settingsOperations.add("gateway");
  saveAgentGatewayConfig.disabled = true;
  if (agentGatewaySettingsNotice) agentGatewaySettingsNotice.textContent = t("common.checking");
  let saved = false;
  try {
    const result = await window.ClaraCoreDesktop.updateAgentGatewayConfig(settingsView.collectAgentGatewayConfigForm());
    if (!result) throw new Error("Connection settings acknowledgement unavailable");
    saved = true;
    settingsView.acceptSaved("gateway", revision);
    await refreshForRuntimeScopes(["snapshot", "agent-setup", "logs"]);
    if (agentGatewaySettingsNotice) agentGatewaySettingsNotice.textContent = t(settingsView.draftRevision("gateway") === revision ? "settings.agentGatewaySaved" : "settings.savedWithDraft");
    settingsDialogs.saved("gateway");
  } catch (error) {
    if (agentGatewaySettingsNotice) agentGatewaySettingsNotice.textContent = t(saved ? "settings.savedRefreshFailed" : "settings.saveUnconfirmed");
  } finally {
    settingsOperations.delete("gateway");
    saveAgentGatewayConfig.disabled = false;
  }
});

saveMemoryControllerMode?.addEventListener("click", async () => {
  const revision = settingsView.draftRevision("controller");
  settingsOperations.add("controller");
  saveMemoryControllerMode.disabled = true;
  if (memoryControllerSettingsNotice) memoryControllerSettingsNotice.textContent = t("common.checking");
  let saved = false;
  try {
    const result = await window.ClaraCoreDesktop.saveSettings(settingsView.collectMemoryControllerSettingsForm());
    if (!result?.configuration) throw new Error("Recall settings acknowledgement unavailable");
    saved = true;
    settingsView.acceptSaved("controller", revision);
    await refreshForRuntimeScopes(["snapshot", "memory", "logs"]);
    if (memoryControllerSettingsNotice) memoryControllerSettingsNotice.textContent = t(settingsView.draftRevision("controller") === revision ? "settings.memoryControllerSaved" : "settings.savedWithDraft");
    settingsDialogs.saved("controller");
  } catch (error) {
    console.error(error);
    if (memoryControllerSettingsNotice) memoryControllerSettingsNotice.textContent = t(saved ? "settings.savedRefreshFailed" : "settings.saveUnconfirmed");
  } finally {
    settingsOperations.delete("controller");
    saveMemoryControllerMode.disabled = false;
  }
});

async function saveModelSettings(button, notice, form, { scope, confirmEmbedding = false, successKey = "settings.saved", failureKey = "settings.saveUnconfirmed" } = {}) {
  if (button.disabled) return;
  const validationError = settingsView.settingsValidationError(form);
  if (validationError) { notice.textContent = t(validationError); settingsView.showValidationError?.(); return; }
  if (confirmEmbedding && settingsView.embeddingConfigChanged(form) && !window.confirm(t("settings.embedding.rebuildConfirm"))) return;
  const revision = settingsView.draftRevision(scope);
  settingsOperations.add(scope);
  button.disabled = true;
  notice.textContent = t("settings.saving");
  let saved = false;
  try {
    const result = await window.ClaraCoreDesktop.saveSettings(form);
    if (!result?.configuration) throw new Error("Settings acknowledgement unavailable");
    saved = true;
    const accepted = settingsView.acceptSaved(scope, revision);
    await refresh();
    notice.textContent = t(accepted && settingsView.draftRevision(scope) === revision ? successKey : "settings.savedWithDraft");
    settingsDialogs.saved(scope);
  } catch (error) {
    console.error(error);
    notice.textContent = t(saved ? "settings.savedRefreshFailed" : failureKey);
  } finally { settingsOperations.delete(scope); button.disabled = false; }
}

saveMemorySettings.addEventListener("click", () => {
  saveModelSettings(saveMemorySettings, memorySettingsNotice, collectSettingsForm("memory"), { scope: "memory", confirmEmbedding: true });
});
saveReflectionSettings.addEventListener("click", () => {
  saveModelSettings(saveReflectionSettings, reflectionSettingsNotice, collectSettingsForm("reflection"), { scope: "reflection" });
});

copyInnerLifeApiKey.addEventListener("click", () => {
  const value = getSecretInputValue(innerLifeApiKey);
  if (!value) {
    showCopyNotice(t("settings.apiKey.notConfigured"), reflectionSettingsNotice);
    return;
  }
  copyValue(value, t("settings.apiKey.copied"), reflectionSettingsNotice).catch(console.error);
});

refreshMemoriaModels?.addEventListener("click", () => {
  loadModelOptions("memoria").catch(console.error);
});

refreshInnerLifeModels?.addEventListener("click", () => {
  loadModelOptions("innerlife").catch(console.error);
});

testMemoriaConnection?.addEventListener("click", () => {
  testModelConnection("memoria").catch(console.error);
});

testInnerLifeConnection?.addEventListener("click", () => {
  testModelConnection("innerlife").catch(console.error);
});

for (const provider of [memoriaProvider, innerLifeBackend]) {
  provider?.addEventListener("change", () => settingsView.updateModelFieldVisibility());
}

saveAppearanceSettings?.addEventListener("click", async () => {
  const revision = settingsView.draftRevision("appearance");
  settingsOperations.add("appearance");
  saveAppearanceSettings.disabled = true;
  appearanceSettingsNotice.textContent = t("common.checking");
  let saved = false;
  try {
    const preferences = collectAppearanceSettingsForm();
    const savedPreferences = await window.ClaraCoreDesktop.saveUiPreferences(preferences);
    if (!savedPreferences || typeof savedPreferences.closeBehavior !== "string") throw new Error("Application preferences acknowledgement unavailable");
    loginItemPreference = {
      launchAtLogin: Boolean(savedPreferences.launchAtLogin),
      launchAtLoginAvailable: Boolean(savedPreferences.launchAtLoginAvailable)
    };
    saved = true;
    settingsView.acceptSaved("appearance", revision);
    applyUiPreferences(savedPreferences);
    renderSettings();
    appearanceSettingsNotice.textContent = t(settingsView.draftRevision("appearance") === revision ? "settings.appPreferencesSaved" : "settings.savedWithDraft");
    settingsDialogs.saved("appearance");
  } catch (error) {
    console.error(error);
    appearanceSettingsNotice.textContent = t(saved ? "settings.savedRefreshFailed" : "settings.appPreferencesSaveFailed");
  } finally {
    settingsOperations.delete("appearance");
    saveAppearanceSettings.disabled = false;
  }
});

saveDataRootSettings?.addEventListener("click", async () => {
  const revision = settingsView.draftRevision("storage");
  settingsOperations.add("storage");
  saveDataRootSettings.disabled = true;
  storageSettingsNotice.textContent = t("common.checking");
  let saved = false;
  try {
    const result = await window.ClaraCoreDesktop.saveDataRootPreference(window.ClaraCoreDom.settingsDataRootOverride.value);
    if (!result || typeof result.restartRequired !== "boolean") throw new Error("Storage settings acknowledgement unavailable");
    saved = true;
    settingsView.acceptSaved("storage", revision);
    rendererState.dataRootPreference = result;
    settingsView.renderAppearanceSettings();
    if (result.envOverride) {
      storageSettingsNotice.textContent = t("settings.dataRootEnvOverride");
    } else if (result.restartRequired) {
      storageSettingsNotice.textContent = result.canRelaunch
        ? t("settings.dataRootRestartRequired")
        : t("settings.dataRootManualRestartRequired");
      if (result.canRelaunch && window.ClaraCoreDom.relaunchForDataRoot) {
        window.ClaraCoreDom.relaunchForDataRoot.hidden = false;
      }
    } else {
      showCopyNotice(t("settings.storageSaved"), storageSettingsNotice);
    }
    settingsDialogs.saved("storage", storageSettingsNotice.textContent, { persistent: Boolean(result.restartRequired || result.envOverride) });
  } catch (error) {
    console.error(error);
    storageSettingsNotice.textContent = t(saved ? "settings.savedRefreshFailed" : "settings.storageSaveFailed");
  } finally {
    settingsOperations.delete("storage");
    saveDataRootSettings.disabled = false;
  }
});

window.ClaraCoreDom.chooseKnowledgeRoot?.addEventListener("click", async () => {
  if (knowledgeRootBusy) return;
  setKnowledgeRootBusy(true);
  ++knowledgeRootRequest;
  try {
    const result = await window.ClaraCoreDesktop.chooseKnowledgeRoot();
    if (result?.canceled) return;
    if (typeof result?.path !== "string" || !result.path) throw new Error("No directory selected");
    window.ClaraCoreDom.knowledgeRootPath.value = result.path;
    window.ClaraCoreDom.clearKnowledgeRoot.hidden = false;
    settingsView.markDirty("knowledge");
    window.ClaraCoreDom.knowledgeRootStatus.textContent = t("settings.capabilitiesUnsaved");
  } catch (error) {
    window.ClaraCoreDom.knowledgeRootStatus.textContent = t("knowledge.directory.chooseFailed");
  } finally { setKnowledgeRootBusy(false); }
});
window.ClaraCoreDom.clearKnowledgeRoot?.addEventListener("click", () => {
  if (knowledgeRootBusy) return;
  ++knowledgeRootRequest;
  window.ClaraCoreDom.knowledgeRootPath.value = "";
  settingsView.markDirty("knowledge");
  window.ClaraCoreDom.knowledgeRootStatus.textContent = t("settings.capabilitiesUnsaved");
});
saveKnowledgeRoot?.addEventListener("click", async () => {
  if (knowledgeRootBusy) return;
  const revision = settingsView.draftRevision("knowledge");
  setKnowledgeRootBusy(true);
  ++knowledgeRootRequest;
  let saved = false;
  try {
    const preference = await window.ClaraCoreDesktop.saveKnowledgeRootPreference(window.ClaraCoreDom.knowledgeRootPath.value);
    if (!preference || typeof preference.root !== "string") throw new Error("Directory acknowledgement unavailable");
    saved = true;
    settingsView.acceptSaved("knowledge", revision);
    renderKnowledgeRootPreference(preference);
    settingsDialogs.saved("knowledge");
  } catch (error) {
    window.ClaraCoreDom.knowledgeRootStatus.textContent = t(saved ? "settings.savedRefreshFailed" : "settings.saveUnconfirmed");
  } finally { setKnowledgeRootBusy(false); }
});

window.ClaraCoreDom.chooseSettingsDataRoot?.addEventListener("click", async () => {
  if (settingsOperations.has("storage")) return;
  settingsOperations.add("storage");
  try {
    const result = await window.ClaraCoreDesktop.chooseDataRoot();
    if (!result?.canceled && typeof result?.path === "string" && window.ClaraCoreDom.settingsDataRootOverride) {
      window.ClaraCoreDom.settingsDataRootOverride.value = result.path;
      settingsView.markDirty("storage");
    }
  } catch (error) { storageSettingsNotice.textContent = t("settings.storageSaveFailed"); }
  finally { settingsOperations.delete("storage"); }
});

window.ClaraCoreDom.resetSettingsDataRoot?.addEventListener("click", () => {
  if (window.ClaraCoreDom.settingsDataRootOverride) {
    window.ClaraCoreDom.settingsDataRootOverride.value = "";
    settingsView.markDirty("storage");
  }
});

window.ClaraCoreDom.relaunchForDataRoot?.addEventListener("click", () => {
  window.ClaraCoreDesktop.relaunch().then((result) => {
    if (result?.relaunched === false) {
      storageSettingsNotice.textContent = t("settings.dataRootManualRestartRequired");
    }
  });
});

window.ClaraCoreDom.openSettingsDataRoot?.addEventListener("click", () => {
  if (snapshot?.data?.root) {
    storageSettingsNotice.textContent = "";
    window.ClaraCoreDesktop.openPath(snapshot.data.root).then(ok => {
      if (!ok) throw new Error("open_failed");
    }).catch(() => showCopyNotice(t("review.openFailed"), storageSettingsNotice, { persistent: true }));
  }
});

innerLifeActions.bindEvents();
memoriaActions.bindEvents();
sharedLineActions.bindEvents();
settingsView.bindEvents();

dataView.bindEvents();

refreshLogs.addEventListener("click", () => {
  logsView.refreshNow();
});

toggleLogFollow.addEventListener("click", () => {
  logsView.toggleFollow(activeView);
});

window.ClaraCoreDom.logFilter?.addEventListener("change", (event) => {
  logsView.setFilter(event.target.value);
});

const noticeTimers = new WeakMap();
function showCopyNotice(label, target = null, { persistent = false } = {}) {
  if (!target) return;
  const previous = noticeTimers.get(target);
  if (previous) window.clearTimeout(previous);
  target.textContent = label;
  if (persistent) { noticeTimers.delete(target); return; }
  const timer = window.setTimeout(() => {
    if (noticeTimers.get(target) !== timer) return;
    if (target.textContent === label) target.textContent = "";
    noticeTimers.delete(target);
  }, 1800);
  noticeTimers.set(target, timer);
}

function randomAgentGatewayToken() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function copyValue(value, label, target = null) {
  if (!value) return false;
  const ok = await window.ClaraCoreDesktop.copyText(value);
  if (ok && label) showCopyNotice(label, target);
  return ok;
}

openDevelopmentPlan?.addEventListener("click", () => {
  if (snapshot?.plans?.productReset) {
    storageSettingsNotice.textContent = "";
    window.ClaraCoreDesktop.openPath(snapshot.plans.productReset).then(ok => {
      if (!ok) throw new Error("open_failed");
    }).catch(() => showCopyNotice(t("review.openFailed"), storageSettingsNotice, { persistent: true }));
  }
});

openDesignPlan?.addEventListener("click", () => {
  if (snapshot?.plans?.v02Legacy) {
    storageSettingsNotice.textContent = "";
    window.ClaraCoreDesktop.openPath(snapshot.plans.v02Legacy).then(ok => {
      if (!ok) throw new Error("open_failed");
    }).catch(() => showCopyNotice(t("review.openFailed"), storageSettingsNotice, { persistent: true }));
  }
});

window.ClaraCoreTestHooks = {
  refresh: () => refresh(),
  setHomeState: (state) => {
    if (state === "loading") { homeView.renderLoading(); homeUnderstanding.renderLoading(); }
    if (state === "error") { homeView.renderLoadError(); homeUnderstanding.renderLoadError(); }
  },
  handleRuntimeChanged: (payload = {}) => scheduleRuntimeRefresh(Array.isArray(payload.scopes) ? payload.scopes : ["snapshot"]),
  homeConnection: () => homeView.getConnectionDebugState(),
  runtimeRefreshState: () => ({
    activeView,
    detailReads: Object.fromEntries(viewDetailReadCounts),
    hydratedViews: [...hydratedViews].sort(),
    runtimeRefreshCompletedRevision,
    runtimeRefreshRevision,
    snapshotGeneration,
    snapshotShape: {
      hasMemories: Object.prototype.hasOwnProperty.call(snapshot || {}, "memories"),
      hasRecentMemories: Object.prototype.hasOwnProperty.call(snapshot || {}, "recentMemories"),
      hasInnerLifeInbox: Object.prototype.hasOwnProperty.call(snapshot?.innerLife || {}, "inbox"),
      hasInnerLifePendingInbox: Object.prototype.hasOwnProperty.call(snapshot?.innerLife || {}, "pendingInbox")
    }
  })
};

function handleHomeRefreshError(error) {
  console.error(error);
  homeView.renderLoadError();
  homeUnderstanding.renderLoadError();
  if (runtimeMode) runtimeMode.textContent = t("runtime.unavailable");
  if (rootPath) rootPath.textContent = t("runtime.unableSnapshot");
}

homeView.renderLoading();
homeUnderstanding.renderLoading();
refresh().catch(handleHomeRefreshError);

resourceRefreshLoop.start();
dataRefreshLoop.start();
window.addEventListener("beforeunload", () => { resourceRefreshLoop.stop(); dataRefreshLoop.stop(); }, { once: true });

applyStaticTranslations();
appearance.initialize();
window.ClaraCoreDesktop.setLanguage(currentLanguage).catch(console.error);
hydrateUiPreferences().catch(console.error);
if (typeof window.ClaraCoreDesktop.onRuntimeChanged === "function") {
  window.ClaraCoreDesktop.onRuntimeChanged((payload) => {
    scheduleRuntimeRefresh(Array.isArray(payload?.scopes) ? payload.scopes : ["snapshot"]);
  });
}
setView("home");

if (typeof window.ClaraCoreDesktop.onTrayNavigate === "function") {
  window.ClaraCoreDesktop.onTrayNavigate(view => {
    if (Object.prototype.hasOwnProperty.call(views, view)) setView(view);
  });
}
