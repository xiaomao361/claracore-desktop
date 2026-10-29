function createClaraCoreSettingsView(context) {
  const BUILT_IN_EMBEDDING_MODEL = "Xenova/bge-small-zh-v1.5";
  const BUILT_IN_EMBEDDING_ENDPOINT = "http://127.0.0.1:11434";
  const {
    dom,
    desktop,
    t,
    getSnapshot,
    state = {}
  } = context;
  const {
    memoriaProvider, memoriaEndpointField, memoriaEndpoint, memoriaModelField, memoriaModel,
    memoriaConnectionRow, memoriaModelStatus, memoriaProviderNotice,
    innerLifeBackend, innerLifeEndpointField, innerLifeEndpoint, innerLifeModelField, innerLifeModel,
    innerLifePollField, innerLifePollSeconds, innerLifeApiKeyField, innerLifeApiKey,
    innerLifeConnectionRow,
    innerLifeModelStatus, memoriaCapabilityProvider, innerLifeCapabilityProvider,
    settingsLanguage, settingsTheme, settingsCloseBehavior, settingsLaunchAtLogin, settingsLaunchAtLoginHint,
    settingsPathDetails,
    settingsDataRootOverride, relaunchForDataRoot,
    settingsAgentGatewayStatus, settingsAgentGatewayPort, settingsAgentGatewayToken, settingsAgentGatewayEndpoint, settingsAgentGatewayTokenFile,
    settingsMemoryControllerMode, settingsMemoryControllerStatus,
    settingsAppVersion, settingsBuildFlavor, checkForUpdates, downloadUpdate, copyUpdateUrl, updateCheckStatus
  } = dom;
  const {
    getAppearancePreferences
  } = context;

  const dirty = new Set();
  const revisions = {};
  let validationTarget = null;
  const scopeFields = {
    memory: ["memoriaProvider", "memoriaEndpoint", "memoriaModel", "memoriaApiKey"],
    reflection: ["innerLifeBackend", "innerLifeEndpoint", "innerLifeModel", "innerLifeApiKey", "innerLifePollSeconds", "innerLifeEnabled"],
    knowledge: ["knowledgeRootPath"],
    appearance: ["settingsLanguage", "settingsTheme", "settingsCloseBehavior", "settingsLaunchAtLogin"],
    storage: ["settingsDataRootOverride"],
    gateway: ["settingsAgentGatewayPort", "settingsAgentGatewayToken"],
    controller: ["settingsMemoryControllerMode"]
  };
  function markDirty(scope) {
    dirty.add(scope);
    revisions[scope] = (revisions[scope] || 0) + 1;
    const notices = { memory: "memorySettingsNotice", reflection: "reflectionSettingsNotice", appearance: "appearanceSettingsNotice", storage: "storageSettingsNotice", gateway: "agentGatewaySettingsNotice", controller: "memoryControllerSettingsNotice" };
    if (dom[notices[scope]]) dom[notices[scope]].textContent = t("settings.capabilitiesUnsaved");
    if (["memory", "reflection"].includes(scope)) {
      updateModelFieldVisibility();
      context.onModelsRendered?.();
    }
  }
  function isDirty(scope) { return dirty.has(scope); }
  function discardScope(scope) { dirty.delete(scope); revisions[scope] = (revisions[scope] || 0) + 1; }
  function draftRevision(scope) { return revisions[scope] || 0; }
  function acceptSaved(scope, revision = draftRevision(scope)) {
    if (revision !== draftRevision(scope)) return false;
    dirty.delete(scope);
    return true;
  }

function modelStatus(provider, hasModel = true, builtIn = false) {
  if (!["disabled", "claracore-built-in", "ollama", "openai-compatible"].includes(provider)) return { label: t("common.needsAttention"), className: "badge warn", note: "" };
  if (provider === "disabled") {
    return { label: t("settings.status.disabled"), className: "badge warn", note: "" };
  }
  return {
    label: hasModel ? t(builtIn ? "settings.status.ready" : "settings.status.configured") : t("common.needsAttention"),
    className: builtIn && hasModel ? "badge ok" : "badge warn",
    note: ""
  };
}

function providerSummary(provider, model = "") {
  if (provider === "claracore-built-in") return t("settings.provider.builtIn");
  if (provider === "ollama") return t("settings.provider.external", { provider: "Ollama", model: model || "-" });
  if (provider === "openai-compatible") return t("settings.provider.external", { provider: t("settings.openaiCompatible"), model: model || "-" });
  if (provider === "disabled") return t("settings.provider.disabled");
  return t("common.needsAttention");
}

function applyModelStatus(element, fallback) {
  const tested = element?.dataset?.connectionState;
  const status = tested === "connected"
    ? { label: t("settings.status.connected"), className: "badge ok", note: "" }
    : tested === "failed"
      ? { label: t("settings.status.testFailed"), className: "badge warn", note: "" }
      : fallback;
  element.textContent = status.label;
  element.className = status.className;
  element.title = status.note;
}

function maskMiddle(value) {
  const text = String(value || "").trim();
  if (!text) return t("settings.apiKey.notConfigured");
  if (text.length <= 8) return `${text.slice(0, 2)}••••${text.slice(-2)}`;
  return `${text.slice(0, 6)}••••••${text.slice(-4)}`;
}

function setSecretInput(input, value) {
  const secret = String(value || "").trim();
  if (!input) return;
  input.dataset.secretValue = secret;
  input.dataset.maskedValue = secret ? maskMiddle(secret) : "";
  input.value = input.dataset.maskedValue;
}

function getSecretInputValue(input) {
  if (!input) return "";
  const visible = String(input.value || "").trim();
  if (visible === String(input.dataset.maskedValue || "")) {
    return String(input.dataset.secretValue || "").trim();
  }
  return visible;
}

function secondsToDisplayMinutes(value) {
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds > 0 ? String(seconds / 60) : "";
}

function displayMinutesToSeconds(value) {
  if (!String(value).trim()) return null;
  const seconds = Number(value) * 60;
  const rounded = Math.round(seconds);
  return Number.isSafeInteger(rounded) && rounded > 0 && Math.abs(seconds - rounded) < 1e-8 ? String(rounded) : null;
}

function setInputValue(input, value) {
  if (input) input.value = value == null ? "" : String(value);
}

function setHidden(element, hidden) {
  if (element) element.hidden = Boolean(hidden);
}

function updateModelFieldVisibility() {
  const memoryProvider = memoriaProvider?.value || "";
  const memoryExternal = ["ollama", "openai-compatible"].includes(memoryProvider);
  setHidden(dom.memoriaApiKeyField, memoryProvider !== "openai-compatible");
  setHidden(dom.memoryApiScopeHint, memoryProvider !== "openai-compatible");
  setHidden(memoriaEndpointField, !memoryExternal);
  setHidden(memoriaModelField, !memoryExternal);
  setHidden(memoriaConnectionRow, !memoryExternal);

  const innerLifeProvider = innerLifeBackend?.value || "disabled";
  const innerLifeEnabled = innerLifeProvider !== "disabled";
  if (dom.innerLifeEnabled) {
    dom.innerLifeEnabled.disabled = !innerLifeEnabled;
    if (!innerLifeEnabled) dom.innerLifeEnabled.checked = false;
  }
  const innerLifeUsesApiKey = innerLifeProvider === "openai-compatible";
  setHidden(innerLifeEndpointField, !innerLifeEnabled);
  setHidden(innerLifeModelField, !innerLifeEnabled);
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

function renderDataPaths() {
  const snapshot = getSnapshot();
  const data = snapshot?.data || {};
  const preference = state.dataRootPreference || {};
  const root = data.root || "";
  if (settingsDataRootOverride && !dirty.has("storage")) {
    settingsDataRootOverride.value = preference.configuredDataRoot || "";
    settingsDataRootOverride.disabled = Boolean(preference.envOverride);
    settingsDataRootOverride.placeholder = preference.envOverride
      ? t("settings.dataRootEnvOverride")
      : t("settings.dataRootDefaultPlaceholder");
  }
  const normalizePath = value => String(value || "").replace(/[\\/]+$/, "");
  const needsRestart = preference.restartRequired === true || Boolean(!preference.envOverride && root && preference.effectiveDataRoot && normalizePath(root) !== normalizePath(preference.effectiveDataRoot));
  if (relaunchForDataRoot) relaunchForDataRoot.hidden = !(needsRestart && preference.canRelaunch);
  for (const name of ["chooseSettingsDataRoot", "resetSettingsDataRoot", "saveDataRootSettings"]) if (dom[name]) dom[name].disabled = Boolean(preference.envOverride);
  if (dom.storageSettingsNotice && !dirty.has("storage")) {
    if (preference.envOverride) dom.storageSettingsNotice.textContent = t("settings.dataRootEnvOverride");
    else if (needsRestart) dom.storageSettingsNotice.textContent = t(preference.canRelaunch ? "settings.dataRootRestartRequired" : "settings.dataRootManualRestartRequired");
  }
  const paths = [
    ["settings.databaseFile", data.databasePath],
    ["settings.backupsDir", data.backupsDir],
    ["settings.exportsDir", data.exportsDir],
    ["settings.logsDir", data.logsDir],
    ["settings.runtimeDir", data.runtimeDir],
    ["settings.defaultDataRoot", preference.defaultDataRoot],
    ["settings.pathConfigFile", preference.configPath]
  ];
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
  for (const [scope, fields] of Object.entries(scopeFields)) {
    for (const name of fields) for (const event of ["input", "change"]) dom[name]?.addEventListener(event, () => markDirty(scope));
  }
  checkForUpdates?.addEventListener("click", () => runUpdateCheck());
  downloadUpdate?.addEventListener("click", () => {
    const url = state.updateCheckResult?.releaseUrl;
    if (url) desktop.openUpdateUrl(url).catch(console.error);
  });
  copyUpdateUrl?.addEventListener("click", async () => {
    const url = state.updateCheckResult?.releaseUrl;
    if (!url) return;
    const copied = await desktop.copyText(url).catch(() => false);
    if (updateCheckStatus) updateCheckStatus.textContent = t(copied ? "settings.update.urlCopied" : "settings.update.copyFailed");
  });
}

function renderAgentGatewaySettings() {
  const gateway = getSnapshot()?.connections?.httpGateway || {};
  const port = gateway.configuredPort || gateway.port || "";
  if (!dirty.has("gateway")) {
    setInputValue(settingsAgentGatewayPort, port);
    setInputValue(settingsAgentGatewayToken, gateway.token || "");
  }
  if (settingsAgentGatewayEndpoint) settingsAgentGatewayEndpoint.textContent = gateway.endpoint || "-";
  if (settingsAgentGatewayTokenFile) settingsAgentGatewayTokenFile.textContent = gateway.tokenFile || "-";
  if (settingsAgentGatewayStatus) {
    settingsAgentGatewayStatus.textContent = gateway.error ? t("common.error") : gateway.ok ? t("settings.status.ready") : t("common.checking");
    settingsAgentGatewayStatus.className = gateway.error ? "badge warn" : gateway.ok ? "badge ok" : "badge warn";
    settingsAgentGatewayStatus.title = gateway.error?.message || "";
  }
}

function renderMemoryController(memoryController) {
  if (!dirty.has("controller")) setInputValue(settingsMemoryControllerMode, memoryController.mode || "off");
  if (settingsMemoryControllerStatus) {
    const modeKey = memoryController.mode === "canary"
      ? "settings.memoryControllerCanary"
      : memoryController.mode === "observe"
        ? "settings.memoryControllerObserve"
        : "settings.memoryControllerOff";
    settingsMemoryControllerStatus.textContent = t(memoryController.configurationValid === false ? "settings.controllerInvalid" : modeKey);
    settingsMemoryControllerStatus.className = memoryController.mode === "off" ? "badge warn" : "badge ok";
  }
}

function renderSettings() {
  const snapshot = getSnapshot();
  if (!snapshot?.configuration) return;
  renderMemoryController(snapshot.configuration.memoryController || { mode: "off" });
  const memoria = snapshot.configuration.memoria;
  const innerlife = snapshot.configuration.innerlife;
  const lite = snapshot?.build?.flavor === "lite";
  if (!dirty.has("memory")) {
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
  setSecretInput(dom.memoriaApiKey, memoria.apiKeyRef || "");
  memoriaModel.value = memoria.providerSupported === false ? "" : memoria.model;
  }
  if (!dirty.has("reflection")) {
  innerLifeBackend.value = innerlife.backend;
  innerLifeEndpoint.value = innerlife.baseUrl;
  setInputValue(innerLifeModel, innerlife.model);
  if (dom.innerLifeEnabled) dom.innerLifeEnabled.checked = innerlife.backend !== "disabled" && (innerlife.autonomyEnabled === "true" || innerlife.autonomyEnabled === true);
  innerLifePollSeconds.value = secondsToDisplayMinutes(innerlife.pollSeconds);
  setSecretInput(innerLifeApiKey, innerlife.apiKeyRef || "");
  }
  context.onModelsRendered?.();
  const memoriaStatus = memoria.providerSupported === false
    ? { label: t("common.needsAttention"), className: "badge warn", note: t("settings.liteUnsupportedProvider") }
    : modelStatus(memoria.provider, Boolean(memoria.model), memoria.provider === "claracore-built-in");
  applyModelStatus(memoriaModelStatus, memoriaStatus);
  if (memoriaProviderNotice) {
    memoriaProviderNotice.hidden = memoria.providerSupported !== false;
    memoriaProviderNotice.textContent = memoria.providerSupported === false ? t("settings.liteUnsupportedProvider") : "";
  }
  if (memoriaCapabilityProvider) {
    memoriaCapabilityProvider.textContent = memoria.providerSupported === false
      ? t("settings.provider.needsSetup")
      : providerSummary(memoria.provider, memoria.model);
  }
  const innerLifeStatus = modelStatus(innerlife.backend, Boolean(innerlife.model));
  applyModelStatus(innerLifeModelStatus, innerLifeStatus);
  if (innerLifeCapabilityProvider) {
    innerLifeCapabilityProvider.textContent = providerSummary(innerlife.backend, innerlife.model);
  }
  updateModelFieldVisibility();
}

function renderAppearanceSettings() {
  const snapshot = getSnapshot();
  const preferences = getAppearancePreferences();
  if (!dirty.has("appearance")) {
  setInputValue(settingsLanguage, preferences.language);
  setInputValue(settingsTheme, preferences.theme);
  setInputValue(settingsCloseBehavior, preferences.closeBehavior);
  if (settingsLaunchAtLogin) {
    settingsLaunchAtLogin.checked = Boolean(preferences.launchAtLogin);
    settingsLaunchAtLogin.disabled = !preferences.launchAtLoginAvailable;
  }
  }
  if (settingsLaunchAtLoginHint) {
    settingsLaunchAtLoginHint.hidden = Boolean(preferences.launchAtLoginAvailable);
    settingsLaunchAtLoginHint.textContent = preferences.launchAtLoginAvailable ? "" : t("settings.launchAtLoginUnavailable");
  }
  renderDataPaths();
  renderAgentGatewaySettings();
  renderAbout();
}

function embeddingConfigChanged(form) {
  const memoria = getSnapshot()?.configuration?.memoria;
  if (!memoria || form["memory.embedding.provider"] === "disabled") return false;
  return [["provider", memoria.provider], ["model", memoria.model], ["base_url", memoria.endpoint]].some(([key, before]) => {
    const value = form[`memory.embedding.${key}`];
    return value !== undefined && String(value).trim().replace(/\/$/, "") !== String(before || "").trim().replace(/\/$/, "");
  });
}

function collectSettingsForm(scope = "all") {
  const provider = memoriaProvider.value;
  const backend = innerLifeBackend.value;
  const form = { "memory.embedding.provider": provider, "innerlife.provider": backend,
    "innerlife.enabled": backend !== "disabled" && Boolean(dom.innerLifeEnabled?.checked) };
  if (provider === "openai-compatible") form["memory.embedding.api_key_ref"] = getSecretInputValue(dom.memoriaApiKey);
  if (provider !== "disabled") {
    form["memory.embedding.base_url"] = provider === "claracore-built-in" ? BUILT_IN_EMBEDDING_ENDPOINT : memoriaEndpoint.value.trim();
    form["memory.embedding.model"] = provider === "claracore-built-in" ? BUILT_IN_EMBEDDING_MODEL : memoriaModel.value.trim();
  }
  if (backend !== "disabled") {
    form["innerlife.base_url"] = innerLifeEndpoint.value.trim();
    form["innerlife.model"] = innerLifeModel.value.trim();
    form["innerlife.loop_seconds"] = displayMinutesToSeconds(innerLifePollSeconds.value);
    if (backend === "openai-compatible") form["innerlife.llm.api_key_ref"] = getSecretInputValue(innerLifeApiKey);
  }
  return scope === "all" ? form : Object.fromEntries(Object.entries(form).filter(([key]) => key.startsWith(scope === "memory" ? "memory." : "innerlife.")));
}

function collectMemoryControllerSettingsForm() {
  const mode = settingsMemoryControllerMode?.value;
  if (!["off", "observe", "canary"].includes(mode)) throw new Error("Invalid recall mode");
  // A mode change must not expand a caller-configured allowlist to all Agents.
  return { "memory.controller.mode": mode };
}

function settingsValidationError(form) {
  validationTarget = null;
  for (const name of [...scopeFields.memory, ...scopeFields.reflection]) dom[name]?.removeAttribute("aria-invalid");
  function invalid(key, input) { validationTarget = input; input?.setAttribute("aria-invalid", "true"); return key; }
  function validUrl(value) {
    try { return ["http:", "https:"].includes(new URL(value).protocol); } catch (_) { return false; }
  }
  const provider = form["memory.embedding.provider"];
  if (Object.hasOwn(form, "memory.embedding.provider")) {
  if (!["claracore-built-in", "ollama", "openai-compatible", "disabled"].includes(provider)) return invalid("settings.embedding.providerRequired", memoriaProvider);
  if (["ollama", "openai-compatible"].includes(provider) && !form["memory.embedding.model"]) return invalid("settings.embedding.modelRequired", memoriaModel);
  if (["ollama", "openai-compatible"].includes(provider) && !validUrl(form["memory.embedding.base_url"])) return invalid("settings.endpointRequired", memoriaEndpoint);
  }
  const backend = form["innerlife.provider"];
  if (Object.hasOwn(form, "innerlife.provider")) {
  if (!["disabled", "ollama", "openai-compatible"].includes(backend)) return invalid("settings.reflectionProviderRequired", innerLifeBackend);
  if (backend !== "disabled") {
    if (!validUrl(form["innerlife.base_url"])) return invalid("settings.endpointRequired", innerLifeEndpoint);
    if (!form["innerlife.model"]) return invalid("settings.reflectionModelRequired", innerLifeModel);
    if (!form["innerlife.loop_seconds"]) return invalid("settings.intervalInvalid", innerLifePollSeconds);
  }
  }
  return "";
}

function showValidationError() {
  const details = validationTarget?.closest("details");
  if (details) details.open = true;
  validationTarget?.focus();
}

function collectAppearanceSettingsForm() {
  return {
    language: settingsLanguage.value,
    theme: settingsTheme.value,
    closeBehavior: settingsCloseBehavior.value,
    launchAtLogin: Boolean(settingsLaunchAtLogin?.checked)
  };
}

function collectAgentGatewayConfigForm() {
  return {
    port: settingsAgentGatewayPort?.value || "",
    token: settingsAgentGatewayToken?.value || ""
  };
}

  return {
    markDirty,
    isDirty,
    discardScope,
    draftRevision,
    acceptSaved,
    bindEvents,
    collectAppearanceSettingsForm,
    collectAgentGatewayConfigForm,
    collectMemoryControllerSettingsForm,
    collectSettingsForm,
    settingsValidationError,
    showValidationError,
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
