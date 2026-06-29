const {
  moduleGrid,
  brandVersion,
  runtimeMode,
  rootPath,
  topbarHealthIcon,
  topbarHealthLabel,
  topbarDataLabel,
  refreshButton,
  primaryAction,
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
  mcpCommand,
  mcpConfig,
  copyNotice,
  agentIdentityList,
  gatewayHandshakeList,
  httpEndpointList,
  gatewayTraceList,
  logTerminal,
  refreshLogs,
  toggleLogFollow,
  clearLogs,
  logRuntimeCount,
  logGatewayCount,
  logLineCount,
  logLastRefresh,
  openGatewayFolder,
  eventList,
  healthSummary,
  healthList,
  homeCognitiveUpdated,
  homeCognitiveSystems,
  homeAgentViewList,
  homeTraceList,
  viewTitle,
  viewSubtitle,
  monitorVersion,
  monitorUptime,
  monitorCpu,
  monitorRam,
  monitorDisk,
  monitorTime,
  agentSetupMarkdown,
  agentSetupNotice,
  copyAgentSetup,
  memoriaProvider,
  memoriaEndpoint,
  memoriaModel,
  memoriaModelOptions,
  memoriaModelNotice,
  refreshMemoriaModels,
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
  innerLifePollSeconds,
  innerLifeApiKey,
  innerLifeApiKeySummary,
  copyInnerLifeApiKey,
  innerLifeModelStatus,
  innerLifeAgentFilter,
  innerLifeSessionList,
  loadMoreInnerLifeSessions,
  innerLifeDigestList,
  innerLifeInboxList,
  innerLifeShareCheckList,
  innerLifeShareList,
  innerLifeDaemonStatus,
  innerLifeDaemonToggle,
  innerLifeDaemonToggleLabel,
  innerLifeDaemonNotice,
  innerLifeNextRun,
  innerLifeLastResult,
  innerLifeRecovery,
  innerLifeDoctorStatus,
  innerLifeDoctorList,
  innerLifePendingCount,
  innerLifeEventCount,
  innerLifeThoughtCount,
  saveSettings,
  settingsNotice,
  saveAppearanceSettings,
  appearanceSettingsNotice,
  memorySearchInput,
  searchMemory,
  memoryList,
  memoryAgentFilter,
  allMemoryList,
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
  sharedLineUpdated,
  sharedLineList,
  sharedLineAgentFilter,
  sharedLineLineCount,
  sharedLineHistoryCount,
  sharedLineSnapshotCount,
  sharedLineHandoffCount,
  sharedLineDetailStatus,
  sharedLineNotice,
  sharedLineMetadataPanel,
  sharedLineResume,
  sharedLineHistoryList,
  sharedLineSnapshotList,
  sharedLineHandoffList,
  copySharedLineResume,
  sharedLineTabs,
  sharedLineTabPanels
} = window.ClaraCoreDom;

const translations = window.ClaraCoreTranslations || { en: {} };
const views = window.ClaraCoreViews || {};
const {
  escapeHtml,
  safeJsonObject,
  formatBytes,
  splitListInput,
  formatSharedLineMetaValue,
  renderReadableText,
  itemAgentId: sharedItemAgentId,
  filterByAgent: sharedFilterByAgent,
  renderAgentFilter: sharedRenderAgentFilter
} = window.ClaraCoreUtils;

let currentLanguage = localStorage.getItem("claracore.language") || "en";
let currentTheme = localStorage.getItem("claracore.theme") || "system";
let currentMotion = localStorage.getItem("claracore.motion") || "system";
let currentCloseBehavior = localStorage.getItem("claracore.window.closeBehavior") || "hide";

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
  selectedSharedLineId: ""
};
let runtimeRefreshTimer = null;
const logsView = window.createClaraCoreLogsView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  refreshSnapshot: refreshRuntimeSnapshotOnly
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
  getSnapshot: () => snapshot,
  refresh,
  showCopyNotice
});
const memoriaView = window.createClaraCoreMemoriaView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  escapeHtml,
  refreshRuntimeSnapshotOnly,
  appendLiveLogLine,
  setEmbeddingProgress
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
  t,
  getSnapshot: () => snapshot,
  getAppearancePreferences,
  formatMode
});
const sharedInnerLifeView = window.createClaraCoreSharedInnerLifeView({
  dom: window.ClaraCoreDom,
  t,
  getSnapshot: () => snapshot,
  escapeHtml,
  formatSharedLineMetaValue,
  renderReadableText,
  itemAgentId: sharedItemAgentId,
  filterByAgent: sharedFilterByAgent,
  renderAgentFilter: sharedRenderAgentFilter,
  state: rendererState,
  renderMemoryResults,
  memoryAgentId
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
  memoryEmbeddedCount.textContent = stats.embeddedCount ?? 0;
  memoryPendingEmbeddingCount.textContent = stats.pendingEmbeddingCount ?? 0;
  const pending = Number(stats.pendingEmbeddingCount || 0);
  const text = t("memory.embedding.progress", {
    processed: progress.processed,
    total: progress.total,
    ready: progress.ready,
    failed: progress.failed,
    pending
  });
  memoryEmbeddingNotice.textContent = text;
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;
  memoryEmbeddingProgressBar.style.width = `${percent}%`;
  appendLiveLogLine("memoria", text);
}

function renderAgentSetup() {
  agentSetupView.render();
}

function getSecretInputValue(input) {
  return settingsView.getSecretInputValue(input);
}

function setModelOptions(target, models) {
  if (!target) return;
  target.replaceChildren(
    ...models.map((model) => {
      const option = document.createElement("option");
      option.value = model;
      return option;
    })
  );
}

async function loadModelOptions(kind, { silent = false } = {}) {
  const isMemoria = kind === "memoria";
  const providerInput = isMemoria ? memoriaProvider : innerLifeBackend;
  const endpointInput = isMemoria ? memoriaEndpoint : innerLifeEndpoint;
  const apiKeyInput = isMemoria ? memoriaApiKey : innerLifeApiKey;
  const button = isMemoria ? refreshMemoriaModels : refreshInnerLifeModels;
  const notice = isMemoria ? memoriaModelNotice : innerLifeModelNotice;
  const options = isMemoria ? memoriaModelOptions : innerLifeModelOptions;
  if (!providerInput || !endpointInput || !window.ClaraCoreDesktop?.listModels) return;
  const provider = providerInput.value;
  const endpoint = endpointInput.value;
  if (!endpoint || ["disabled", "claracore-built-in", "custom-command"].includes(provider)) {
    setModelOptions(options, []);
    if (!silent && notice) notice.textContent = t("settings.modelFetchUnsupported");
    return;
  }
  if (button) button.disabled = true;
  if (notice && !silent) notice.textContent = t("common.checking");
  try {
    const result = await window.ClaraCoreDesktop.listModels({
      provider,
      endpoint,
      apiKeyRef: getSecretInputValue(apiKeyInput)
    });
    const models = Array.isArray(result?.models) ? result.models : [];
    setModelOptions(options, models);
    if (notice) {
      notice.textContent = models.length
        ? t("settings.modelsLoaded", { count: String(models.length) })
        : t(result?.supported === false ? "settings.modelFetchUnsupported" : "settings.modelsEmpty");
    }
  } catch (error) {
    console.error(error);
    setModelOptions(options, []);
    if (notice && !silent) notice.textContent = t("settings.modelsFailed");
  } finally {
    if (button) button.disabled = false;
  }
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

function resolvedTheme() {
  if (currentTheme === "light" || currentTheme === "dark") return currentTheme;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function resolvedMotion() {
  if (currentMotion === "on" || currentMotion === "off") return currentMotion;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "off" : "on";
}

function getAppearancePreferences() {
  return {
    language: currentLanguage,
    theme: currentTheme,
    resolvedTheme: resolvedTheme(),
    motion: currentMotion,
    resolvedMotion: resolvedMotion(),
    closeBehavior: currentCloseBehavior
  };
}

function applyTheme() {
  document.body.dataset.theme = resolvedTheme();
  document.body.dataset.themePreference = currentTheme;
  document.body.dataset.motion = resolvedMotion();
  document.body.dataset.motionPreference = currentMotion;
}

function setTheme(theme) {
  currentTheme = ["system", "light", "dark"].includes(theme) ? theme : "system";
  localStorage.setItem("claracore.theme", currentTheme);
  applyTheme();
}

function setMotion(motion) {
  currentMotion = ["system", "on", "off"].includes(motion) ? motion : "system";
  localStorage.setItem("claracore.motion", currentMotion);
  applyTheme();
}

function setWindowCloseBehavior(closeBehavior) {
  currentCloseBehavior = closeBehavior === "quit" ? "quit" : "hide";
  localStorage.setItem("claracore.window.closeBehavior", currentCloseBehavior);
  const result = window.ClaraCoreDesktop.setWindowPreferences?.({ closeBehavior: currentCloseBehavior });
  if (result?.catch) result.catch(console.error);
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

function renderSnapshot() {
  if (brandVersion) brandVersion.textContent = `Desktop v${snapshot.productVersion || "-"}`;
  if (runtimeMode) runtimeMode.textContent = formatMode(snapshot.mode);
  if (rootPath) rootPath.textContent = snapshot.root;
  if (dataLocation) dataLocation.textContent = snapshot.data.root;
  if (dataHint) dataHint.textContent = snapshot.data.databasePresent ? t("runtime.databaseReady") : t("runtime.databaseNotCreated");
  dataRootPath.textContent = snapshot.data.root;
  memoryStore.textContent = snapshot.data.databasePath;
  if (memoryStoreShort) memoryStoreShort.textContent = snapshot.data.databasePresent ? t("common.found") : t("common.notCreated");
  renderTopbarStatus();
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
  renderBackups();
}

function renderResourceSnapshot(resources) {
  monitorVersion.textContent = resources.appVersion ? `v${resources.appVersion}` : "-";
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
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
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
  syncLogRefreshTimer();
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
  memoriaView.resetLoadedTabs();
  renderSnapshot();
  if (memoriaView.getActiveTab() !== "search" && memoriaView.getActiveTab() !== "labels" && memoriaView.getActiveTab() !== "graph") {
    loadMemoryTabData(memoriaView.getActiveTab()).catch(console.error);
  }
}

async function refreshRuntimeSnapshotOnly() {
  snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
  renderSnapshot();
}

function syncLogRefreshTimer() {
  logsView.syncRefreshTimer(activeView);
}

async function refreshResources() {
  const resources = await window.ClaraCoreDesktop.getResourceSnapshot();
  renderResourceSnapshot(resources);
}

function scheduleRuntimeRefresh() {
  if (runtimeRefreshTimer) return;
  runtimeRefreshTimer = window.setTimeout(() => {
    runtimeRefreshTimer = null;
    refresh().catch(console.error);
  }, 250);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

copyAgentSetup.addEventListener("click", () => {
  agentSetupView.copy().catch(console.error);
});

saveSettings.addEventListener("click", async () => {
  saveSettings.disabled = true;
  settingsNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.saveSettings(collectSettingsForm());
    await refresh();
    showCopyNotice(t("settings.saved"), settingsNotice);
  } catch (error) {
    console.error(error);
    settingsNotice.textContent = t("settings.saveFailed");
  } finally {
    saveSettings.disabled = false;
  }
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

memoriaEndpoint?.addEventListener("blur", () => {
  loadModelOptions("memoria", { silent: true }).catch(console.error);
});

memoriaProvider?.addEventListener("change", () => {
  loadModelOptions("memoria", { silent: true }).catch(console.error);
});

innerLifeEndpoint?.addEventListener("blur", () => {
  loadModelOptions("innerlife", { silent: true }).catch(console.error);
});

innerLifeBackend?.addEventListener("change", () => {
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

window.ClaraCoreDom.openSettingsDataRoot?.addEventListener("click", () => {
  if (snapshot?.data?.root) {
    window.ClaraCoreDesktop.openPath(snapshot.data.root);
  }
});

searchMemory.addEventListener("click", async () => {
  const response = await window.ClaraCoreDesktop.searchMemories(memorySearchInput.value);
  const results = Array.isArray(response) ? response : response?.results || [];
  renderMemoryResults(sharedFilterByAgent(results, rendererState.activeMemoryAgentFilter, memoryAgentId));
  if (response?.error) showCopyNotice(t("memory.search.fallback"));
});

memoryAgentFilter?.addEventListener("change", async () => {
  rendererState.activeMemoryAgentFilter = memoryAgentFilter.value || "";
  memoriaView.setActiveAgentFilter(rendererState.activeMemoryAgentFilter);
  renderMemoryList();
  if (memoriaView.getActiveTab() !== "search") {
    await loadMemoryTabData(memoriaView.getActiveTab(), { force: true });
  }
});

innerLifeAgentFilter?.addEventListener("change", () => {
  rendererState.activeInnerLifeAgentFilter = innerLifeAgentFilter.value || "";
  renderInnerLife();
});

loadMoreInnerLifeSessions?.addEventListener("click", async () => {
  if (!snapshot?.innerLife || rendererState.innerLifeSessionsLoading) return;
  rendererState.innerLifeSessionsLoading = true;
  renderInnerLife();
  const agentId = rendererState.activeInnerLifeAgentFilter || "all";
  const currentSessions = snapshot.innerLife.sessions || [];
  const offset =
    agentId === "all"
      ? currentSessions.length
      : currentSessions.filter((session) => sharedItemAgentId(session) === agentId).length;
  try {
    const page = await window.ClaraCoreDesktop.getInnerLifeSessions({
      agentId,
      limit: 10,
      offset
    });
    const existingIds = new Set(currentSessions.map((session) => session.id));
    snapshot.innerLife.sessions = [
      ...currentSessions,
      ...(page.items || []).filter((session) => !existingIds.has(session.id))
    ];
    rendererState.innerLifeSessionTotals[agentId] = page.total ?? snapshot.innerLife.sessions.length;
    if (agentId === "all") {
      snapshot.innerLife.sessionsPage = {
        ...(snapshot.innerLife.sessionsPage || {}),
        total: page.total ?? snapshot.innerLife.sessions.length,
        hasMore: Boolean(page.hasMore)
      };
    }
  } catch (error) {
    console.error(error);
  } finally {
    rendererState.innerLifeSessionsLoading = false;
    renderInnerLife();
  }
});

processMemoryEmbeddings.addEventListener("click", () => {
  memoriaView.processEmbeddings().catch(console.error);
});

memorySearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchMemory.click();
  }
});

function searchMemoryLabel(label) {
  memoriaView.searchMemoryLabel(label);
}

memoryTabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    const nextTab = tab.dataset.memoryTab || "search";
    if (nextTab === "restricted" && memoriaView.getActiveTab() !== "restricted" && !window.confirm(t("memory.restricted.confirm"))) {
      renderMemoryTabs();
      return;
    }
    memoriaView.setActiveTab(nextTab);
    renderMemoryTabs();
    try {
      await loadMemoryTabData(nextTab);
    } catch (error) {
      console.error(error);
      showCopyNotice(t("runtime.unavailable"));
    }
  });
});

function setSharedLineTab(tabName) {
  sharedLineTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.sharedLineTab === tabName));
  sharedLineTabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.sharedLinePanel === tabName));
}

sharedLineTabs.forEach((tab) => {
  tab.addEventListener("click", () => setSharedLineTab(tab.dataset.sharedLineTab || "lines"));
});

sharedLineAgentFilter.addEventListener("change", () => {
  rendererState.activeSharedLineAgentFilter = sharedLineAgentFilter.value || "";
  renderSharedLine();
});

memoryLabelList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-label]");
  if (!button) return;
  searchMemoryLabel(button.dataset.memoryLabel || "");
});

memoryAllLabelList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-label]");
  if (!button) return;
  searchMemoryLabel(button.dataset.memoryLabel || "");
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-load-more]");
  if (!button) return;
  button.disabled = true;
  loadMemoryTabData(button.dataset.loadMore, { append: true })
    .catch((error) => {
      console.error(error);
      showCopyNotice(t("runtime.unavailable"));
    })
    .finally(() => {
      button.disabled = false;
    });
});

memoryGraph.addEventListener("click", (event) => {
  const zoomButton = event.target.closest("[data-graph-zoom]");
  if (zoomButton) {
    memoriaView.setMemoryGraphZoom(zoomButton.dataset.graphZoom || "fit");
    return;
  }
  const layerButton = event.target.closest("[data-graph-layer]");
  if (layerButton) {
    memoriaView.setMemoryGraphLayer(layerButton.dataset.graphLayer || "primary").catch((error) => {
      console.error(error);
      showCopyNotice(t("runtime.unavailable"));
    });
  }
});

memoryGraph.addEventListener("wheel", (event) => {
  if (!event.target.closest(".graph-canvas")) return;
  event.preventDefault();
  memoriaView.setMemoryGraphZoom(event.deltaY < 0 ? "in" : "out");
});

memoryGraph.addEventListener("mousedown", (event) => {
  memoriaView.beginGraphDrag(event);
});

window.addEventListener("mousemove", (event) => {
  memoriaView.moveGraphDrag(event);
});

window.addEventListener("mouseup", () => {
  memoriaView.endGraphDrag();
});

async function handleMemoryListAction(event) {
  const button = event.target.closest("[data-memory-action]");
  if (!button) return;
  const memoryId = button.dataset.memoryId;
  if (button.dataset.memoryAction === "delete") {
    if (!window.confirm(t("memory.delete.confirm"))) return;
    button.disabled = true;
    await window.ClaraCoreDesktop.deleteMemory(memoryId);
    await refresh();
    showCopyNotice(t("memory.form.deleted"));
  }
}

memoryList.addEventListener("click", handleMemoryListAction);
allMemoryList.addEventListener("click", handleMemoryListAction);

restrictedMemoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-memory-action]");
  if (!button) return;
  const memoryId = button.dataset.memoryId;
  if (button.dataset.memoryAction === "delete-restricted") {
    if (!window.confirm(t("memory.delete.confirm"))) return;
    button.disabled = true;
    await window.ClaraCoreDesktop.deleteMemory(memoryId);
    await refresh();
    showCopyNotice(t("memory.form.deleted"));
  }
});

archivedMemoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-memory-action='restore-archived']");
  if (!button) return;
  button.disabled = true;
  try {
    await window.ClaraCoreDesktop.restoreArchivedMemory(button.dataset.memoryId);
    await refresh();
    showCopyNotice(t("memory.archive.restoreDone"));
  } catch (error) {
    console.error(error);
    showCopyNotice(t("memory.form.saveFailed"));
  }
});

deletedMemoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-memory-action='restore']");
  if (!button) return;
  button.disabled = true;
  try {
    await window.ClaraCoreDesktop.restoreMemory(button.dataset.memoryId);
    await refresh();
    showCopyNotice(t("memory.form.restored"));
  } catch (error) {
    console.error(error);
    showCopyNotice(t("memory.form.saveFailed"));
  }
});

sharedLineList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-shared-line-action]");
  if (!button) return;
  const action = button.dataset.sharedLineAction;
  const lineId = button.dataset.sharedLineId;
  button.setAttribute("aria-busy", "true");
  if (action !== "select") sharedLineNotice.textContent = t("common.checking");
  try {
    let result;
    if (action === "select") {
      rendererState.selectedSharedLineId = lineId;
      result = { sharedLine: await window.ClaraCoreDesktop.getSharedLine({ lineId }) };
      sharedLineNotice.textContent = "";
    } else if (action === "archive") {
      if (!window.confirm(t("sharedLine.archiveConfirm"))) {
        sharedLineNotice.textContent = "";
        return;
      }
      result = await window.ClaraCoreDesktop.archiveSharedLine(lineId);
      showCopyNotice(t("sharedLine.lineArchived"), sharedLineNotice);
    }
    if (!result?.sharedLine) return;
    snapshot.sharedLine = result.sharedLine;
    renderSharedLine();
  } catch (error) {
    console.error(error);
    sharedLineNotice.textContent = t("sharedLine.lineFailed");
  } finally {
    button.removeAttribute("aria-busy");
  }
});

sharedLineList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-shared-line-action]");
  if (!card) return;
  event.preventDefault();
  card.click();
});

copySharedLineResume.addEventListener("click", () => {
  copyValue(sharedLineResume.textContent, t("sharedLine.resumeCopied"), sharedLineNotice).catch(console.error);
});

dataView.bindEvents();

refreshButton.addEventListener("click", () => {
  refresh().catch((error) => {
    console.error(error);
  });
});

refreshLogs.addEventListener("click", () => {
  logsView.refreshNow();
});

toggleLogFollow.addEventListener("click", () => {
  logsView.toggleFollow(activeView);
});

clearLogs.addEventListener("click", () => {
  logsView.clear();
});

innerLifeDaemonToggle?.addEventListener("click", async () => {
  const daemon = snapshot?.innerLife?.daemon || {};
  const enabled = Boolean(daemon.enabled) && daemon.status !== "paused";
  innerLifeDaemonToggle.disabled = true;
  innerLifeDaemonNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.setInnerLifeDaemon({ action: enabled ? "pause" : "enable" });
    await refresh();
    showCopyNotice(enabled ? t("innerLife.daemonPaused") : t("innerLife.daemonEnabled"), innerLifeDaemonNotice);
  } catch (error) {
    console.error(error);
    innerLifeDaemonNotice.textContent = t("innerLife.daemonFailed");
  } finally {
    innerLifeDaemonToggle.disabled = false;
  }
});

primaryAction.addEventListener("click", () => {
  if (snapshot?.data?.root) {
    window.ClaraCoreDesktop.openPath(snapshot.data.root);
  }
});

openGatewayFolder.addEventListener("click", () => {
  if (snapshot?.data?.runtimeDir) {
    window.ClaraCoreDesktop.openPath(snapshot.data.runtimeDir);
  }
});

function showCopyNotice(label, target = copyNotice) {
  if (!target) return;
  target.textContent = label;
  window.setTimeout(() => {
    target.textContent = "";
  }, 1800);
}

async function copyValue(value, label, target = copyNotice) {
  if (!value) return;
  const ok = await window.ClaraCoreDesktop.copyText(value);
  if (ok) showCopyNotice(label, target);
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

refresh().catch((error) => {
  if (runtimeMode) runtimeMode.textContent = t("runtime.unavailable");
  if (rootPath) rootPath.textContent = t("runtime.unableSnapshot");
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
applyTheme();
window.ClaraCoreDesktop.setLanguage(currentLanguage).catch(console.error);
setWindowCloseBehavior(currentCloseBehavior);
window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener("change", () => {
  if (currentTheme === "system") {
    applyTheme();
    renderSettings();
  }
});
window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener("change", () => {
  if (currentMotion === "system") {
    applyTheme();
    renderSettings();
  }
});
if (typeof window.ClaraCoreDesktop.onRuntimeChanged === "function") {
  window.ClaraCoreDesktop.onRuntimeChanged(() => scheduleRuntimeRefresh());
}
setView("home");
