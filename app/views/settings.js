function createClaraCoreSettingsView(context) {
  const {
    dom,
    t,
    getSnapshot
  } = context;
  const {
    memoriaProvider, memoriaEndpoint, memoriaModel, memoriaDimension, memoriaApiKey, memoriaSource, memoriaModelStatus,
    innerLifeBackend, innerLifeEndpoint, innerLifeLightModel, innerLifeDeepModel, innerLifePollSeconds, innerLifeApiKey,
    innerLifeApiKeySummary, innerLifeSource, innerLifeModelStatus
  } = dom;

function modelStatus(provider, hasModel = true) {
  if (provider === "claracore-built-in") {
    return { label: t("settings.status.future"), className: "badge warn", note: t("settings.futureProviderNote") };
  }
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

function renderSettings() {
  const snapshot = getSnapshot();
  if (!snapshot?.configuration) return;
  const memoria = snapshot.configuration.memoria;
  const innerlife = snapshot.configuration.innerlife;
  memoriaProvider.value = memoria.provider;
  memoriaEndpoint.value = memoria.endpoint;
  memoriaModel.value = memoria.model;
  memoriaDimension.value = memoria.dimension;
  setSecretInput(memoriaApiKey, memoria.apiKeyRef || "");
  memoriaSource.value = memoria.source;
  innerLifeBackend.value = innerlife.backend;
  innerLifeEndpoint.value = innerlife.baseUrl;
  innerLifeLightModel.value = innerlife.lightModel;
  innerLifeDeepModel.value = innerlife.deepModel;
  innerLifePollSeconds.value = secondsToDisplayMinutes(innerlife.pollSeconds);
  setSecretInput(innerLifeApiKey, innerlife.apiKeyRef || "");
  innerLifeApiKeySummary.textContent = maskMiddle(innerlife.apiKeyRef);
  innerLifeSource.value = innerlife.source;
  const memoriaStatus = modelStatus(memoria.provider, Boolean(memoria.model));
  memoriaModelStatus.textContent = memoriaStatus.label;
  memoriaModelStatus.className = memoriaStatus.className;
  memoriaModelStatus.title = memoriaStatus.note;
  const innerLifeStatus = modelStatus(innerlife.backend, Boolean(innerlife.lightModel || innerlife.deepModel));
  innerLifeModelStatus.textContent = innerLifeStatus.label;
  innerLifeModelStatus.className = innerLifeStatus.className;
  innerLifeModelStatus.title = innerLifeStatus.note;
}

function collectSettingsForm() {
  return {
    "memory.embedding.provider": memoriaProvider.value,
    "memory.embedding.base_url": memoriaEndpoint.value,
    "memory.embedding.model": memoriaModel.value,
    "memory.embedding.dimension": memoriaDimension.value,
    "memory.embedding.api_key_ref": getSecretInputValue(memoriaApiKey),
    "innerlife.provider": innerLifeBackend.value,
    "innerlife.base_url": innerLifeEndpoint.value,
    "innerlife.light_model": innerLifeLightModel.value,
    "innerlife.deep_model": innerLifeDeepModel.value,
    "innerlife.loop_seconds": displayMinutesToSeconds(innerLifePollSeconds.value),
    "innerlife.llm.api_key_ref": getSecretInputValue(innerLifeApiKey)
  };
}

  return {
    collectSettingsForm,
    getSecretInputValue,
    renderSettings
  };
}

window.createClaraCoreSettingsView = createClaraCoreSettingsView;
