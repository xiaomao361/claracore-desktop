function createClaraCoreModelOptions({ dom, t, getSecretInputValue }) {
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
    const providerInput = isMemoria ? dom.memoriaProvider : dom.innerLifeBackend;
    const endpointInput = isMemoria ? dom.memoriaEndpoint : dom.innerLifeEndpoint;
    const apiKeyInput = isMemoria ? dom.memoriaApiKey : dom.innerLifeApiKey;
    const button = isMemoria ? dom.refreshMemoriaModels : dom.refreshInnerLifeModels;
    const notice = isMemoria ? dom.memoriaModelNotice : dom.innerLifeModelNotice;
    const options = isMemoria ? dom.memoriaModelOptions : dom.innerLifeModelOptions;
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

  return {
    loadModelOptions
  };
}

window.createClaraCoreModelOptions = createClaraCoreModelOptions;
