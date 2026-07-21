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
  memoriaApiKey,
  copyMemoriaApiKey,
  memoriaModelStatus,
  innerLifeBackend,
  innerLifeEndpoint,
  innerLifeLightModel,
  innerLifeDeepModel,
  innerLifeModelOptions,
  innerLifeModelNotice,
  refreshInnerLifeModels,
  testInnerLifeConnection,
  innerLifeConnectionNotice,
  innerLifePollSeconds,
  innerLifeApiKey,
  innerLifeApiKeySummary,
  copyInnerLifeApiKey,
  innerLifeModelStatus,
  saveSettings,
  saveRuntimeSettings,
  runtimeSettingsNotice,
  settingsNotice,
  saveAppearanceSettings,
  appearanceSettingsNotice,
  saveDataRootSettings,
  storageSettingsNotice,
  settingsAgentGatewayToken,
  generateAgentGatewayToken,
  copyAgentGatewayToken,
  copyAgentGatewayConfig,
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
  getSystemTimeZone,
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

function t(key, values = {}) {
  const template = translations[currentLanguage]?.[key] || translations.en[key] || key;
  return Object.entries(values).reduce((result, [name, value]) => result.replace(`{${name}}`, value), template);
}

let snapshot = null;
let activeView = "home";
let editingMemoryId = null;
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
const appearance = window.createClaraCoreAppearance({
  desktop: window.ClaraCoreDesktop,
  onSystemPreferenceChange: () => renderSettings()
});
const modelOptions = window.createClaraCoreModelOptions({
  dom: window.ClaraCoreDom,
  t,
  getSecretInputValue
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
  copyValue
});
const dataView = window.createClaraCoreDataView({
  dom: window.ClaraCoreDom,
  t,
  escapeHtml,
  formatBytes,
  formatLocalDateTime,
  getSnapshot: () => snapshot,
  refresh,
  showCopyNotice
});
const memoriaView = window.createClaraCoreMemoriaView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  escapeHtml,
  renderMarkdownPreview,
  formatLocalDateTime,
  refreshRuntimeSnapshotOnly,
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
const settingsView = window.createClaraCoreSettingsView({
  dom: window.ClaraCoreDom,
  desktop: window.ClaraCoreDesktop,
  t,
  getSnapshot: () => snapshot,
  getAppearancePreferences,
  formatMode,
  getSystemTimeZone,
  state: rendererState
});
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
const traceView = window.createClaraCoreTraceView({
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

async function loadModelOptions(kind, { silent = false } = {}) {
  return modelOptions.loadModelOptions(kind, { silent });
}

async function testModelConnection(kind) {
  return modelOptions.testModelConnection(kind);
}

function renderSettings() {
  settingsView.renderSettings();
  settingsView.renderAppearanceSettings();
}

function collectSettingsForm() {
  return settingsView.collectSettingsForm();
}

function collectAppearanceSettingsForm() {
  return settingsView.collectAppearanceSettingsForm();
}

function getAppearancePreferences() {
  return {
    language: currentLanguage,
    ...appearance.getPreferences()
  };
}

function setTheme(theme) {
  appearance.setTheme(theme);
}

function setMotion(motion) {
  appearance.setMotion(motion);
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

  views.trace?.panel?.querySelector(":scope > .page-focus")?.remove();

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
  traceView.render();
  renderBackups();
}

const RESOURCE_WARN_MEMORY_PERCENT = 85;
const RESOURCE_WARN_DISK_PERCENT = 90;

function renderResourceSnapshot(resources) {
  const memoryPercent = Number(resources.memory?.percent);
  const diskPercent = Number(resources.disk?.percent);
  const warning =
    (Number.isFinite(memoryPercent) && memoryPercent >= RESOURCE_WARN_MEMORY_PERCENT) ||
    (Number.isFinite(diskPercent) && diskPercent >= RESOURCE_WARN_DISK_PERCENT);
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
  activeView = nextView;
  Object.entries(views).forEach(([name, view]) => {
    view.panel.classList.toggle("active-view", name === nextView);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });
  viewTitle.textContent = t(views[nextView].titleKey);
  viewSubtitle.textContent = t(views[nextView].subtitleKey);
  homeView.setActive(nextView === "home");
  if (enteringLogs) logsView.closeAdvancedDiagnostics();
  syncLogRefreshTimer();
  if (snapshot) hydrateView(nextView).catch(console.error);
}

async function hydrateView(viewName, { force = false } = {}) {
  if (!snapshot || typeof window.ClaraCoreDesktop.getViewSnapshot !== "function") return;
  if (!force && hydratedViews.has(viewName)) return;
  if (hydratingViews.has(viewName)) return hydratingViews.get(viewName);
  const request = (async () => {
    const detail = await window.ClaraCoreDesktop.getViewSnapshot(viewName);
    if (!detail || typeof detail !== "object") return;
    snapshot = { ...snapshot, ...detail };
    hydratedViews.add(viewName);
    if (viewName === "shared-line" && detail.sharedLine) {
      await sharedLineActions.syncSelectedLine(detail.sharedLine);
      renderSharedLine();
    } else if (viewName === "innerlife") {
      renderInnerLife();
    } else if (viewName === "trace") {
      traceView.render();
    } else if (viewName === "logs") {
      renderLogs();
    } else if (viewName === "settings") {
      renderBackups();
    } else if (viewName === "home") {
      renderHomeDashboard();
    }
  })().finally(() => hydratingViews.delete(viewName));
  hydratingViews.set(viewName, request);
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
  if (preferences) applyUiPreferences(preferences);
}

async function refresh() {
  [snapshot, rendererState.dataRootPreference] = await Promise.all([
    window.ClaraCoreDesktop.getRuntimeSnapshot(),
    window.ClaraCoreDesktop.getDataRootPreference()
  ]);
  await sharedLineActions.syncSelectedLine(snapshot.sharedLine);
  hydratedViews.clear();
  memoriaView.resetLoadedTabs();
  renderSnapshot();
  if (activeView === "home") hydrateView(activeView).catch(console.error);
  else await hydrateView(activeView);
  loadMemoryTabData(memoriaView.getActiveTab()).catch(console.error);
}

async function refreshRuntimeSnapshotOnly() {
  const previousSnapshot = snapshot;
  const [nextSnapshot, dataRootPreference] = await Promise.all([
    window.ClaraCoreDesktop.getRuntimeSnapshot(),
    window.ClaraCoreDesktop.getDataRootPreference()
  ]);
  if (previousSnapshot?.memoryGraph && !nextSnapshot.memoryGraph) {
    nextSnapshot.memoryGraph = previousSnapshot.memoryGraph;
  }
  if (previousSnapshot?.restrictedMemoryGraph && !nextSnapshot.restrictedMemoryGraph) {
    nextSnapshot.restrictedMemoryGraph = previousSnapshot.restrictedMemoryGraph;
  }
  snapshot = nextSnapshot;
  rendererState.dataRootPreference = dataRootPreference;
  await sharedLineActions.syncSelectedLine(snapshot.sharedLine);
  hydratedViews.clear();
  renderSnapshot();
  if (activeView === "home") hydrateView(activeView).catch(console.error);
  else await hydrateView(activeView);
}

async function refreshLogsSnapshot() {
  const logsSnapshot = typeof window.ClaraCoreDesktop.getLogsSnapshot === "function"
    ? await window.ClaraCoreDesktop.getLogsSnapshot()
    : await window.ClaraCoreDesktop.getRuntimeSnapshot();
  snapshot = {
    ...(snapshot || {}),
    gatewayTraces: logsSnapshot.gatewayTraces || [],
    runtimeEvents: logsSnapshot.runtimeEvents || []
  };
  renderLogs();
  return logsSnapshot;
}

async function refreshForRuntimeScopes(scopes = []) {
  await refreshRuntimeSnapshotOnly();
  if (scopes.includes("memory") && activeView === "memory") {
    memoriaView.resetLoadedTabs();
    await loadMemoryTabData(memoriaView.getActiveTab());
  }
}

function syncLogRefreshTimer() {
  logsView.syncRefreshTimer(activeView);
}

async function refreshResources() {
  const resources = await window.ClaraCoreDesktop.getResourceSnapshot();
  renderResourceSnapshot(resources);
}

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

const settingsTabButtons = window.ClaraCoreDom.settingsTabs || [];
const settingsTabPanelList = window.ClaraCoreDom.settingsTabPanels || [];

function setSettingsTab(tabName) {
  const next = settingsTabPanelList.some((panel) => panel.dataset.settingsPanel === tabName) ? tabName : "common";
  settingsTabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === next);
    button.setAttribute("aria-selected", button.dataset.settingsTab === next ? "true" : "false");
  });
  settingsTabPanelList.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.settingsPanel === next);
  });
}

settingsTabButtons.forEach((button) => {
  button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab));
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view-target]");
  if (!target) return;
  setView(target.dataset.viewTarget);
  if (target.dataset.settingsTarget) setSettingsTab(target.dataset.settingsTarget);
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
      .then(() => refreshRuntimeSnapshotOnly())
      .finally(() => {
        target.disabled = false;
        target.textContent = previousText;
      });
  }
});

async function runDemoDataAction(button, action, busyKey) {
  if (!button) return;
  button.disabled = true;
  if (demoDataNotice) demoDataNotice.textContent = t(busyKey);
  try {
    await action();
    await refreshRuntimeSnapshotOnly();
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

copyAgentSetup?.addEventListener("click", () => {
  agentSetupView.copy().catch(console.error);
});

generateAgentGatewayToken?.addEventListener("click", () => {
  if (settingsAgentGatewayToken) settingsAgentGatewayToken.value = randomAgentGatewayToken();
  if (appearanceSettingsNotice) appearanceSettingsNotice.textContent = t("settings.generatedToken");
});

copyAgentGatewayToken?.addEventListener("click", () => {
  copyValue(settingsAgentGatewayToken?.value || "", t("settings.apiKey.copied"), appearanceSettingsNotice).catch(console.error);
});

copyAgentGatewayConfig?.addEventListener("click", () => {
  copyValue(settingsView.agentGatewayCopyBlock(), t("settings.agentGatewayConfigCopied"), appearanceSettingsNotice).catch(console.error);
});

saveAgentGatewayConfig?.addEventListener("click", async () => {
  saveAgentGatewayConfig.disabled = true;
  appearanceSettingsNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.updateAgentGatewayConfig(settingsView.collectAgentGatewayConfigForm());
    await refreshRuntimeSnapshotOnly();
    appearanceSettingsNotice.textContent = t("settings.agentGatewaySaved");
  } catch (error) {
    appearanceSettingsNotice.textContent = t("settings.agentGatewaySaveFailed", { error: error?.message || String(error) });
  } finally {
    saveAgentGatewayConfig.disabled = false;
  }
});

saveMemoryControllerMode?.addEventListener("click", async () => {
  saveMemoryControllerMode.disabled = true;
  if (memoryControllerSettingsNotice) memoryControllerSettingsNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.saveSettings(settingsView.collectMemoryControllerSettingsForm());
    await refreshRuntimeSnapshotOnly();
    if (memoryControllerSettingsNotice) memoryControllerSettingsNotice.textContent = t("settings.memoryControllerSaved");
  } catch (error) {
    console.error(error);
    if (memoryControllerSettingsNotice) memoryControllerSettingsNotice.textContent = t("settings.memoryControllerSaveFailed");
  } finally {
    saveMemoryControllerMode.disabled = false;
  }
});

async function saveModelSettings(button, notice, form, { confirmEmbedding = false, successKey = "settings.saved", failureKey = "settings.saveFailed" } = {}) {
  const validationError = settingsView.settingsValidationError(form);
  if (validationError) {
    notice.textContent = t(validationError);
    return;
  }
  if (confirmEmbedding && settingsView.embeddingConfigChanged(form) && !window.confirm(t("settings.embedding.rebuildConfirm"))) {
    return;
  }
  button.disabled = true;
  notice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.saveSettings(form);
    await refresh();
    showCopyNotice(t(successKey), notice);
  } catch (error) {
    console.error(error);
    notice.textContent = t(failureKey);
  } finally {
    button.disabled = false;
  }
}

saveSettings.addEventListener("click", () => {
  saveModelSettings(saveSettings, settingsNotice, collectSettingsForm(), { confirmEmbedding: true });
});

saveRuntimeSettings?.addEventListener("click", () => {
  saveModelSettings(saveRuntimeSettings, runtimeSettingsNotice, settingsView.collectRuntimeSettingsForm(), {
    successKey: "settings.runtimeSaved",
    failureKey: "settings.runtimeSaveFailed"
  });
});

copyMemoriaApiKey.addEventListener("click", () => {
  const value = getSecretInputValue(memoriaApiKey);
  if (!value) {
    showCopyNotice(t("settings.apiKey.notConfigured"), settingsNotice);
    return;
  }
  copyValue(value, t("settings.apiKey.copied"), settingsNotice).catch(console.error);
});

copyInnerLifeApiKey.addEventListener("click", () => {
  const value = getSecretInputValue(innerLifeApiKey);
  if (!value) {
    showCopyNotice(t("settings.apiKey.notConfigured"), settingsNotice);
    return;
  }
  copyValue(value, t("settings.apiKey.copied"), settingsNotice).catch(console.error);
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

memoriaEndpoint?.addEventListener("blur", () => {
  loadModelOptions("memoria", { silent: true }).catch(console.error);
});

memoriaProvider?.addEventListener("change", () => {
  if (memoriaModelStatus) delete memoriaModelStatus.dataset.connectionState;
  settingsView.updateModelFieldVisibility();
  loadModelOptions("memoria", { silent: true }).catch(console.error);
});

innerLifeEndpoint?.addEventListener("blur", () => {
  loadModelOptions("innerlife", { silent: true }).catch(console.error);
});

innerLifeBackend?.addEventListener("change", () => {
  if (innerLifeModelStatus) delete innerLifeModelStatus.dataset.connectionState;
  settingsView.updateModelFieldVisibility();
  loadModelOptions("innerlife", { silent: true }).catch(console.error);
});

saveAppearanceSettings?.addEventListener("click", async () => {
  saveAppearanceSettings.disabled = true;
  appearanceSettingsNotice.textContent = t("common.checking");
  try {
    const preferences = collectAppearanceSettingsForm();
    setLanguage(preferences.language);
    setTheme(preferences.theme);
    setMotion(preferences.motion);
    setWindowCloseBehavior(preferences.closeBehavior);
    renderSettings();
    showCopyNotice(t("settings.appearanceSaved"), appearanceSettingsNotice);
  } catch (error) {
    console.error(error);
    appearanceSettingsNotice.textContent = t("settings.appearanceSaveFailed");
  } finally {
    saveAppearanceSettings.disabled = false;
  }
});

saveDataRootSettings?.addEventListener("click", async () => {
  saveDataRootSettings.disabled = true;
  storageSettingsNotice.textContent = t("common.checking");
  try {
    const result = await window.ClaraCoreDesktop.saveDataRootPreference(window.ClaraCoreDom.settingsDataRootOverride.value);
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
  } catch (error) {
    console.error(error);
    storageSettingsNotice.textContent = t("settings.storageSaveFailed");
  } finally {
    saveDataRootSettings.disabled = false;
  }
});

window.ClaraCoreDom.chooseSettingsDataRoot?.addEventListener("click", async () => {
  const result = await window.ClaraCoreDesktop.chooseDataRoot();
  if (!result?.canceled && window.ClaraCoreDom.settingsDataRootOverride) {
    window.ClaraCoreDom.settingsDataRootOverride.value = result.path || "";
  }
});

window.ClaraCoreDom.resetSettingsDataRoot?.addEventListener("click", () => {
  if (window.ClaraCoreDom.settingsDataRootOverride) {
    window.ClaraCoreDom.settingsDataRootOverride.value = "";
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
    window.ClaraCoreDesktop.openPath(snapshot.data.root);
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

function showCopyNotice(label, target = null) {
  if (!target) return;
  target.textContent = label;
  window.setTimeout(() => {
    target.textContent = "";
  }, 1800);
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
  if (ok) showCopyNotice(label, target);
  return ok;
}

openDevelopmentPlan?.addEventListener("click", () => {
  if (snapshot?.plans?.productReset) {
    window.ClaraCoreDesktop.openPath(snapshot.plans.productReset);
  }
});

openDesignPlan?.addEventListener("click", () => {
  if (snapshot?.plans?.v02Legacy) {
    window.ClaraCoreDesktop.openPath(snapshot.plans.v02Legacy);
  }
});

window.ClaraCoreTestHooks = {
  refresh: () => refresh(),
  handleRuntimeChanged: (payload = {}) => scheduleRuntimeRefresh(Array.isArray(payload.scopes) ? payload.scopes : ["snapshot"]),
  homeVision: () => homeView.getVisionDebugState()
};

refresh().catch((error) => {
  if (runtimeMode) runtimeMode.textContent = t("runtime.unavailable");
  if (rootPath) rootPath.textContent = t("runtime.unableSnapshot");
});

refreshResources().catch((error) => {
  console.error(error);
  if (resourceMonitor) resourceMonitor.hidden = true;
});
window.setInterval(() => {
  refreshResources().catch(console.error);
}, 5000);

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
