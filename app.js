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
  monitorProcess,
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
  loadMoreInnerLifeDigestRuns,
  innerLifeInboxList,
  loadMoreInnerLifeInbox,
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
  innerLifeProfileDisplayName,
  innerLifeProfileRecentFocus,
  innerLifeProfileInterests,
  innerLifeProfileShareAfterHours,
  innerLifeProfileShareCooldownHours,
  innerLifeProfileShareMaxDaily,
  innerLifeProfileJson,
  innerLifeStateJson,
  saveInnerLifeProfile,
  innerLifeProfileNotice,
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
  sharedLineArchivedCount,
  sharedLineDetailStatus,
  sharedLineNotice,
  sharedLineAgentStatePanel,
  sharedLineMetadataPanel,
  sharedLineResume,
  sharedLineHistoryList,
  sharedLineSnapshotList,
  sharedLineArchiveList,
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
  renderMarkdownPreview,
  itemAgentId: sharedItemAgentId,
  filterByAgent: sharedFilterByAgent,
  renderAgentFilter: sharedRenderAgentFilter
} = window.ClaraCoreUtils;

let currentLanguage = localStorage.getItem("claracore.language") || "en";

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
  dataRootPreference: null
};
let runtimeRefreshTimer = null;
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
  renderMarkdownPreview,
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
  t,
  getSnapshot: () => snapshot,
  getAppearancePreferences,
  formatMode,
  state: rendererState
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

async function loadModelOptions(kind, { silent = false } = {}) {
  return modelOptions.loadModelOptions(kind, { silent });
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
  if (monitorVersion) monitorVersion.textContent = resources.appVersion ? `v${resources.appVersion}` : "-";
  monitorUptime.textContent = resources.uptime || "--:--:--";
  monitorCpu.textContent = Number.isFinite(resources.cpuPercent) ? `${resources.cpuPercent}%` : "--";
  monitorRam.textContent =
    resources.memory?.text && Number.isFinite(resources.memory?.percent)
      ? `${resources.memory.text} (${resources.memory.percent}%)`
      : "--";
  if (monitorProcess) {
    const processMemory = resources.processMemory || {};
    const oneMinute = processMemory.trend?.oneMinute?.text || "0 B";
    const tenMinutes = processMemory.trend?.tenMinutes?.text || "0 B";
    monitorProcess.textContent = processMemory.totalRssText
      ? `${processMemory.totalRssText} (1m ${oneMinute}, 10m ${tenMinutes})`
      : "--";
    monitorProcess.title = [
      `main rss: ${processMemory.main?.rssText || "-"}`,
      `main heap: ${processMemory.main?.heapUsedText || "-"}`,
      `renderer rss: ${processMemory.renderer?.rssText || "-"}`,
      `gateway rss: ${processMemory.gateway?.rssText || "-"}`
    ].join("\n");
  }
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
  [snapshot, rendererState.dataRootPreference] = await Promise.all([
    window.ClaraCoreDesktop.getRuntimeSnapshot(),
    window.ClaraCoreDesktop.getDataRootPreference()
  ]);
  memoriaView.resetLoadedTabs();
  renderSnapshot();
  if (memoriaView.getActiveTab() !== "search" && memoriaView.getActiveTab() !== "labels" && memoriaView.getActiveTab() !== "graph") {
    loadMemoryTabData(memoriaView.getActiveTab()).catch(console.error);
  }
}

async function refreshRuntimeSnapshotOnly() {
  [snapshot, rendererState.dataRootPreference] = await Promise.all([
    window.ClaraCoreDesktop.getRuntimeSnapshot(),
    window.ClaraCoreDesktop.getDataRootPreference()
  ]);
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

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-view-target]");
  if (!target) return;
  setView(target.dataset.viewTarget);
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
    if (window.ClaraCoreDom.settingsDataRootOverride) {
      const result = await window.ClaraCoreDesktop.saveDataRootPreference(window.ClaraCoreDom.settingsDataRootOverride.value);
      rendererState.dataRootPreference = result;
      if (result.envOverride) {
        appearanceSettingsNotice.textContent = t("settings.dataRootEnvOverride");
      }
    }
    renderSettings();
    if (
      rendererState.dataRootPreference?.restartRequired &&
      rendererState.dataRootPreference?.canRelaunch &&
      window.ClaraCoreDom.relaunchForDataRoot
    ) {
      window.ClaraCoreDom.relaunchForDataRoot.hidden = false;
    }
    if (!appearanceSettingsNotice.textContent || appearanceSettingsNotice.textContent === t("common.checking")) {
      showCopyNotice(t("settings.appearanceSaved"), appearanceSettingsNotice);
    } else if (rendererState.dataRootPreference?.restartRequired) {
      appearanceSettingsNotice.textContent = rendererState.dataRootPreference?.canRelaunch
        ? t("settings.dataRootRestartRequired")
        : t("settings.dataRootManualRestartRequired");
    }
  } catch (error) {
    console.error(error);
    appearanceSettingsNotice.textContent = t("settings.appearanceSaveFailed");
  } finally {
    saveAppearanceSettings.disabled = false;
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
      appearanceSettingsNotice.textContent = t("settings.dataRootManualRestartRequired");
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
  if (monitorProcess) monitorProcess.textContent = "--";
  monitorDisk.textContent = "--";
});
window.setInterval(() => {
  refreshResources().catch(console.error);
}, 5000);

applyStaticTranslations();
appearance.initialize();
window.ClaraCoreDesktop.setLanguage(currentLanguage).catch(console.error);
if (typeof window.ClaraCoreDesktop.onRuntimeChanged === "function") {
  window.ClaraCoreDesktop.onRuntimeChanged(() => scheduleRuntimeRefresh());
}
setView("home");
