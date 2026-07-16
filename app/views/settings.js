function createClaraCoreSettingsView(context) {
  const BUILT_IN_EMBEDDING_MODEL = "Xenova/bge-small-zh-v1.5";
  const BUILT_IN_EMBEDDING_ENDPOINT = "http://127.0.0.1:11434";
  const {
    dom,
    desktop,
    t,
    getSnapshot,
    getSystemTimeZone,
    state = {}
  } = context;
  const {
    memoriaProvider, memoriaEndpointField, memoriaEndpoint, memoriaModelField, memoriaModel, memoriaApiKeyField, memoriaApiKey,
    memoriaConnectionRow, memoriaModelStatus, memoriaProviderNotice,
    innerLifeBackend, innerLifeEndpointField, innerLifeEndpoint, innerLifeLightModelField, innerLifeLightModel,
    innerLifeDeepModelField, innerLifeDeepModel, innerLifePollField, innerLifePollSeconds, innerLifeApiKeyField, innerLifeApiKey,
    innerLifeConnectionRow,
    innerLifeApiKeySummary, innerLifeModelStatus,
    settingsLanguage, settingsTheme, settingsMotion, settingsTimeZone, settingsCloseBehavior, settingsCloseBehaviorSummary, settingsTrayStatus,
    settingsThemeSummary, settingsMotionSummary, settingsDataStatus, settingsDataRoot, settingsPathSummary, settingsPathDetails,
    settingsDataRootOverride, relaunchForDataRoot,
    settingsAgentGatewayStatus, settingsAgentGatewayPort, settingsAgentGatewayToken, settingsAgentGatewayEndpoint, settingsAgentGatewayTokenFile,
    settingsAppVersion, settingsBuildFlavor, checkForUpdates, downloadUpdate, copyUpdateUrl, updateCheckStatus,
    settingsRuntimeMode, settingsDatabaseState, settingsElectronVersion, settingsNodeVersion,
    settingsAppRoot, settingsChromeVersion
  } = dom;
  const {
    getAppearancePreferences,
    formatMode
  } = context;

function modelStatus(provider, hasModel = true) {
  if (provider === "disabled") {
    return { label: t("settings.status.disabled"), className: "badge warn", note: "" };
  }
  return {
    label: hasModel ? t("settings.status.ready") : t("common.needsAttention"),
    className: hasModel ? "badge ok" : "badge warn",
    note: ""
  };
}

function maskMiddle(value) {
  const text = String(value || "").trim();
  if (!text) return t("settings.apiKey.notConfigured");
  if (text.length <= 8) return `${text.slice(0, 2)}••••${text.slice(-2)}`;
  return `${text.slice(0, 6)}••••••${text.slice(-4)}`;
}

function setSecretInput(input, value) {
  const secret = String(value || "").trim();
  input.dataset.secretValue = secret;
  input.dataset.maskedValue = secret ? maskMiddle(secret) : "";
  input.value = input.dataset.maskedValue;
}

function getSecretInputValue(input) {
  const visible = String(input.value || "").trim();
  if (visible === String(input.dataset.maskedValue || "")) {
    return String(input.dataset.secretValue || "").trim();
  }
  return visible;
}

function secondsToDisplayMinutes(value) {
  const seconds = Number.parseInt(String(value || 60), 10) || 60;
  return String(Math.max(1, Math.round(seconds / 60)));
}

function displayMinutesToSeconds(value) {
  const minutes = Number.parseInt(String(value || 1), 10) || 1;
  return String(Math.max(1, minutes) * 60);
}

function setInputValue(input, value) {
  if (input) input.value = value == null ? "" : String(value);
}

function setHidden(element, hidden) {
  if (element) element.hidden = Boolean(hidden);
}

function updateModelFieldVisibility() {
  const memoryProvider = memoriaProvider?.value || "";
  const memoryExternal = memoryProvider === "ollama";
  setHidden(memoriaEndpointField, !memoryExternal);
  setHidden(memoriaModelField, !memoryExternal);
  setHidden(memoriaApiKeyField, true);
  setHidden(memoriaConnectionRow, !memoryExternal);

  const innerLifeProvider = innerLifeBackend?.value || "disabled";
  const innerLifeEnabled = innerLifeProvider !== "disabled";
  const innerLifeUsesApiKey = innerLifeProvider === "openai-compatible";
  setHidden(innerLifeEndpointField, !innerLifeEnabled);
  setHidden(innerLifeLightModelField, !innerLifeEnabled);
  setHidden(innerLifeDeepModelField, !innerLifeEnabled);
  setHidden(innerLifePollField, !innerLifeEnabled);
  setHidden(innerLifeApiKeyField, !innerLifeUsesApiKey);
  setHidden(innerLifeConnectionRow, !innerLifeEnabled);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function childPathLabel(pathValue, rootValue) {
  const pathText = String(pathValue || "");
  const rootText = String(rootValue || "");
  if (!pathText || !rootText || !pathText.startsWith(rootText)) return pathText || "-";
  return pathText.slice(rootText.length).replace(/^\/+/, "") || ".";
}

function renderDataPaths() {
  const snapshot = getSnapshot();
  const data = snapshot?.data || {};
  const preference = state.dataRootPreference || {};
  const root = data.root || "";
  if (settingsDataRoot) settingsDataRoot.textContent = root || "-";
  if (settingsDataRootOverride) {
    settingsDataRootOverride.value = preference.configuredDataRoot || "";
    settingsDataRootOverride.disabled = Boolean(preference.envOverride);
    settingsDataRootOverride.placeholder = preference.envOverride
      ? t("settings.dataRootEnvOverride")
      : t("settings.dataRootDefaultPlaceholder");
  }
  if (relaunchForDataRoot) relaunchForDataRoot.hidden = true;
  if (settingsDataStatus) {
    settingsDataStatus.textContent = data.databasePresent ? t("settings.status.ready") : t("common.notCreated");
    settingsDataStatus.className = data.databasePresent ? "badge ok" : "badge warn";
  }
  const paths = [
    ["settings.databaseFile", data.databasePath, data.databasePresent ? t("common.ready") : t("common.notCreated")],
    ["settings.backupsDir", data.backupsDir, childPathLabel(data.backupsDir, root)],
    ["settings.exportsDir", data.exportsDir, childPathLabel(data.exportsDir, root)],
    ["settings.logsDir", data.logsDir, childPathLabel(data.logsDir, root)],
    ["settings.runtimeDir", data.runtimeDir, childPathLabel(data.runtimeDir, root)],
    ["settings.defaultDataRoot", preference.defaultDataRoot, preference.defaultDataRoot],
    ["settings.pathConfigFile", preference.configPath, preference.configPath]
  ];
  if (settingsPathSummary) {
    settingsPathSummary.innerHTML = paths
      .slice(0, 4)
      .map(([labelKey, _pathValue, value]) => `<span><strong>${escapeHtml(t(labelKey))}</strong>${escapeHtml(value)}</span>`)
      .join("");
  }
  if (settingsPathDetails) {
    settingsPathDetails.innerHTML = paths
      .map(
        ([labelKey, pathValue]) => `
          <div>
            <span>${escapeHtml(t(labelKey))}</span>
            <code>${escapeHtml(pathValue || "-")}</code>
          </div>
        `
      )
      .join("");
  }
}

function renderAbout() {
  const snapshot = getSnapshot();
  if (settingsAppVersion) settingsAppVersion.textContent = snapshot?.productVersion || "-";
  if (settingsBuildFlavor) settingsBuildFlavor.textContent = snapshot?.build?.flavor === "lite" ? "Lite" : "Full";
  if (state.updateCheckResult) renderUpdateResult(state.updateCheckResult);
  if (settingsRuntimeMode) settingsRuntimeMode.textContent = snapshot?.mode ? formatMode(snapshot.mode) : "-";
  if (settingsDatabaseState) {
    settingsDatabaseState.textContent = snapshot?.data?.databasePresent ? t("status.databaseReady") : t("status.databaseMissing");
  }
  if (settingsElectronVersion) settingsElectronVersion.textContent = snapshot?.runtime?.electron || "-";
  if (settingsNodeVersion) settingsNodeVersion.textContent = snapshot?.runtime?.node || "-";
  if (settingsAppRoot) settingsAppRoot.textContent = snapshot?.appRoot || snapshot?.root || "-";
  if (settingsChromeVersion) settingsChromeVersion.textContent = snapshot?.runtime?.chrome || "-";
}

function updateStatusKey(status) {
  const keys = {
    "up-to-date": "settings.update.upToDate",
    "update-available": "settings.update.available",
    "asset-unavailable": "settings.update.assetUnavailable",
    "unsupported-platform": "settings.update.unsupportedPlatform",
    "no-release": "settings.update.noRelease",
    "rate-limited": "settings.update.rateLimited",
    timeout: "settings.update.timeout",
    "network-error": "settings.update.networkError",
    "invalid-response": "settings.update.invalidResponse",
    "invalid-current-version": "settings.update.invalidCurrentVersion"
  };
  return keys[status] || "settings.update.invalidResponse";
}

function renderUpdateResult(result) {
  state.updateCheckResult = result || null;
  const canDownload = result?.status !== "up-to-date" && Boolean(result?.releaseUrl);
  if (downloadUpdate) downloadUpdate.hidden = !canDownload;
  if (copyUpdateUrl) copyUpdateUrl.hidden = !canDownload;
  if (updateCheckStatus) {
    updateCheckStatus.textContent = t(updateStatusKey(result?.status), {
      version: result?.latestVersion || "",
      platform: `${result?.platform || "unknown"}-${result?.arch || "unknown"}`
    });
  }
}

async function runUpdateCheck() {
  if (!checkForUpdates || !desktop?.checkForUpdates) return;
  checkForUpdates.disabled = true;
  if (downloadUpdate) downloadUpdate.hidden = true;
  if (copyUpdateUrl) copyUpdateUrl.hidden = true;
  if (updateCheckStatus) updateCheckStatus.textContent = t("settings.update.checking");
  try {
    renderUpdateResult(await desktop.checkForUpdates());
  } catch (_error) {
    renderUpdateResult({ status: "network-error" });
  } finally {
    checkForUpdates.disabled = false;
  }
}

function bindEvents() {
  checkForUpdates?.addEventListener("click", () => runUpdateCheck());
  downloadUpdate?.addEventListener("click", () => {
    const url = state.updateCheckResult?.releaseUrl;
    if (url) desktop.openUpdateUrl(url).catch(console.error);
  });
  copyUpdateUrl?.addEventListener("click", async () => {
    const url = state.updateCheckResult?.releaseUrl;
    if (!url) return;
    const copied = await desktop.copyText(url).catch(() => false);
    if (copied && updateCheckStatus) updateCheckStatus.textContent = t("settings.update.urlCopied");
  });
}

function renderAgentGatewaySettings() {
  const gateway = getSnapshot()?.connections?.httpGateway || {};
  const port = gateway.configuredPort || gateway.port || "";
  setInputValue(settingsAgentGatewayPort, port);
  setInputValue(settingsAgentGatewayToken, gateway.token || "");
  if (settingsAgentGatewayEndpoint) settingsAgentGatewayEndpoint.textContent = gateway.endpoint || "-";
  if (settingsAgentGatewayTokenFile) settingsAgentGatewayTokenFile.textContent = gateway.tokenFile || "-";
  if (settingsAgentGatewayStatus) {
    settingsAgentGatewayStatus.textContent = gateway.error ? t("common.error") : gateway.ok ? t("settings.status.ready") : t("common.checking");
    settingsAgentGatewayStatus.className = gateway.error ? "badge warn" : gateway.ok ? "badge ok" : "badge warn";
    settingsAgentGatewayStatus.title = gateway.error?.message || "";
  }
}

function renderSettings() {
  const snapshot = getSnapshot();
  if (!snapshot?.configuration) return;
  const memoria = snapshot.configuration.memoria;
  const innerlife = snapshot.configuration.innerlife;
  const lite = snapshot?.build?.flavor === "lite";
  const builtInOption = memoriaProvider.querySelector("option[value='claracore-built-in']");
  if (lite && builtInOption) builtInOption.remove();
  let unsupportedOption = memoriaProvider.querySelector("option[data-unsupported-provider]");
  if (memoria.providerSupported === false) {
    if (!unsupportedOption) {
      unsupportedOption = document.createElement("option");
      unsupportedOption.value = "";
      unsupportedOption.disabled = true;
      unsupportedOption.dataset.unsupportedProvider = "true";
      memoriaProvider.prepend(unsupportedOption);
    }
    unsupportedOption.textContent = t("settings.liteUnsupportedProviderOption");
    memoriaProvider.value = "";
  } else {
    unsupportedOption?.remove();
    memoriaProvider.value = memoria.provider;
  }
  memoriaEndpoint.value = memoria.endpoint;
  memoriaModel.value = memoria.providerSupported === false ? "" : memoria.model;
  setSecretInput(memoriaApiKey, memoria.apiKeyRef || "");
  innerLifeBackend.value = innerlife.backend;
  innerLifeEndpoint.value = innerlife.baseUrl;
  innerLifeLightModel.value = innerlife.lightModel;
  innerLifeDeepModel.value = innerlife.deepModel;
  innerLifePollSeconds.value = secondsToDisplayMinutes(innerlife.pollSeconds);
  setSecretInput(innerLifeApiKey, innerlife.apiKeyRef || "");
  innerLifeApiKeySummary.textContent = maskMiddle(innerlife.apiKeyRef);
  const memoriaStatus = memoria.providerSupported === false
    ? { label: t("common.needsAttention"), className: "badge warn", note: t("settings.liteUnsupportedProvider") }
    : modelStatus(memoria.provider, Boolean(memoria.model));
  memoriaModelStatus.textContent = memoriaStatus.label;
  memoriaModelStatus.className = memoriaStatus.className;
  memoriaModelStatus.title = memoriaStatus.note;
  if (memoriaProviderNotice) {
    memoriaProviderNotice.hidden = memoria.providerSupported !== false;
    memoriaProviderNotice.textContent = memoria.providerSupported === false ? t("settings.liteUnsupportedProvider") : "";
  }
  const innerLifeStatus = modelStatus(innerlife.backend, Boolean(innerlife.lightModel || innerlife.deepModel));
  innerLifeModelStatus.textContent = innerLifeStatus.label;
  innerLifeModelStatus.className = innerLifeStatus.className;
  innerLifeModelStatus.title = innerLifeStatus.note;
  updateModelFieldVisibility();
}

function renderAppearanceSettings() {
  const snapshot = getSnapshot();
  const preferences = getAppearancePreferences();
  setInputValue(settingsLanguage, preferences.language);
  setInputValue(settingsTheme, preferences.theme);
  setInputValue(settingsMotion, preferences.motion);
  setInputValue(settingsTimeZone, t("settings.timeZoneSystemValue", { zone: getSystemTimeZone() }));
  setInputValue(settingsCloseBehavior, preferences.closeBehavior);
  if (settingsCloseBehaviorSummary) {
    settingsCloseBehaviorSummary.textContent =
      preferences.closeBehavior === "quit" ? t("settings.closeQuit") : t("settings.closeHide");
  }
  if (settingsTrayStatus) {
    settingsTrayStatus.textContent = snapshot?.shell?.hasTray ? t("common.ready") : t("common.missing");
  }
  if (settingsThemeSummary) {
    settingsThemeSummary.textContent = t(`settings.theme.${preferences.resolvedTheme}`);
  }
  if (settingsMotionSummary) {
    settingsMotionSummary.textContent = t(`settings.motion.${preferences.resolvedMotion}`);
  }
  renderDataPaths();
  renderAgentGatewaySettings();
  renderAbout();
}

function embeddingConfigChanged(form) {
  const memoria = getSnapshot()?.configuration?.memoria;
  if (!memoria) return false;
  const providerChanged = String(form["memory.embedding.provider"] || "") !== String(memoria.provider || "");
  const modelChanged = String(form["memory.embedding.model"] || "") !== String(memoria.model || "");
  return providerChanged || modelChanged;
}

function collectSettingsForm() {
  const memoryProvider = memoriaProvider.value;
  const innerLifeProvider = innerLifeBackend.value;
  const form = {
    "memory.embedding.provider": memoryProvider,
    "memory.embedding.base_url": memoryProvider === "claracore-built-in" ? BUILT_IN_EMBEDDING_ENDPOINT : memoriaEndpoint.value,
    "memory.embedding.model": memoryProvider === "claracore-built-in" ? BUILT_IN_EMBEDDING_MODEL : memoriaModel.value,
    "innerlife.provider": innerLifeProvider,
    "innerlife.base_url": innerLifeEndpoint.value,
    "innerlife.light_model": innerLifeLightModel.value,
    "innerlife.deep_model": innerLifeDeepModel.value,
    "innerlife.loop_seconds": displayMinutesToSeconds(innerLifePollSeconds.value)
  };
  if (innerLifeProvider === "openai-compatible") {
    form["innerlife.llm.api_key_ref"] = getSecretInputValue(innerLifeApiKey);
  }
  return form;
}

function settingsValidationError(form) {
  const provider = String(form?.["memory.embedding.provider"] || "").trim();
  const model = String(form?.["memory.embedding.model"] || "").trim();
  if (!provider) return "settings.embedding.providerRequired";
  if (provider === "ollama" && !model) return "settings.embedding.modelRequired";
  return "";
}

function collectAppearanceSettingsForm() {
  return {
    language: settingsLanguage.value,
    theme: settingsTheme.value,
    motion: settingsMotion.value,
    closeBehavior: settingsCloseBehavior.value
  };
}

function collectAgentGatewayConfigForm() {
  return {
    port: settingsAgentGatewayPort?.value || "",
    token: settingsAgentGatewayToken?.value || ""
  };
}

function agentGatewayCopyBlock() {
  const gateway = getSnapshot()?.connections?.httpGateway || {};
  const port = settingsAgentGatewayPort?.value || gateway.configuredPort || gateway.port || "";
  const endpoint = port ? `http://127.0.0.1:${port}/mcp` : gateway.endpoint || "";
  const token = settingsAgentGatewayToken?.value || gateway.token || "";
  const shellToken = String(token).replace(/'/g, "'\\''");
  return [
    "ClaraCore Desktop Streamable HTTP MCP",
    `Endpoint: ${endpoint}`,
    `Authorization: Bearer ${token}`,
    "X-ClaraCore-Agent-ID: <agent-stable-id>",
    "X-ClaraCore-Client-ID: <client-host-id>",
    "X-ClaraCore-Conversation-ID: <host-conversation-id>",
    `Token file: ${gateway.tokenFile || ""}`,
    "",
    "Codex CLI example:",
    `launchctl setenv CLARACORE_DESKTOP_MCP_TOKEN '${shellToken}'`,
    `codex mcp add claracore-desktop --url ${endpoint} --bearer-token-env-var CLARACORE_DESKTOP_MCP_TOKEN`
  ].join("\n");
}

  return {
    agentGatewayCopyBlock,
    bindEvents,
    collectAppearanceSettingsForm,
    collectAgentGatewayConfigForm,
    collectSettingsForm,
    settingsValidationError,
    embeddingConfigChanged,
    getSecretInputValue,
    renderAppearanceSettings,
    renderSettings,
    renderUpdateResult,
    runUpdateCheck,
    updateModelFieldVisibility
  };
}

window.createClaraCoreSettingsView = createClaraCoreSettingsView;
