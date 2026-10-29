function createClaraCoreModelOptions({ dom, t, getSecretInputValue }) {
  const requests = { memoria: { list: 0, test: 0 }, innerlife: { list: 0, test: 0 } };
  const observed = {};

  function fields(kind) {
    const memory = kind === "memoria";
    return {
      provider: memory ? dom.memoriaProvider : dom.innerLifeBackend,
      endpoint: memory ? dom.memoriaEndpoint : dom.innerLifeEndpoint,
      model: memory ? dom.memoriaModel : dom.innerLifeModel,
      key: memory ? dom.memoriaApiKey : dom.innerLifeApiKey,
      options: memory ? dom.memoriaModelOptions : dom.innerLifeModelOptions,
      fetch: memory ? dom.refreshMemoriaModels : dom.refreshInnerLifeModels,
      test: memory ? dom.testMemoriaConnection : dom.testInnerLifeConnection,
      notice: memory ? dom.memoriaModelNotice : dom.innerLifeModelNotice,
      connection: memory ? dom.memoriaConnectionNotice : dom.innerLifeConnectionNotice,
      status: memory ? dom.memoriaModelStatus : dom.innerLifeModelStatus
    };
  }

  function input(kind) {
    const f = fields(kind);
    return { provider: f.provider?.value || "", endpoint: (f.endpoint?.value || "").trim(),
      model: (f.model?.value || "").trim(), apiKeyRef: f.key ? getSecretInputValue(f.key) : "" };
  }

  function signature(value, withModel = true) {
    return JSON.stringify([value.provider, value.endpoint, value.apiKeyRef, ...(withModel ? [value.model] : [])]);
  }

  function invalidate(kind) {
    const f = fields(kind);
    requests[kind].test++;
    if (f.status) {
      delete f.status.dataset.connectionState;
      f.status.textContent = t("settings.connectionNotTested");
      f.status.className = "badge warn";
    }
    if (f.connection) { f.connection.textContent = t("settings.connectionNotTested"); f.connection.className = "connection-test-notice"; }
    if (f.test) f.test.disabled = false;
  }

  function syncInputs() {
    for (const kind of ["memoria", "innerlife"]) {
      const current = input(kind);
      if (observed[kind] && signature(observed[kind]) === signature(current)) continue;
      invalidate(kind);
      if (!observed[kind] || signature(observed[kind], false) !== signature(current, false)) {
        requests[kind].list++;
        const f = fields(kind);
        f.options?.replaceChildren();
        if (f.notice) f.notice.textContent = "";
        if (f.fetch) f.fetch.disabled = false;
      }
      observed[kind] = current;
    }
  }

  async function loadModelOptions(kind) {
    const f = fields(kind), captured = input(kind);
    if (!window.ClaraCoreDesktop?.listModels) return;
    if (!captured.endpoint || !["ollama", "openai-compatible"].includes(captured.provider)) {
      if (f.notice) f.notice.textContent = t("settings.modelFetchUnsupported");
      return;
    }
    const revision = ++requests[kind].list;
    const current = () => revision === requests[kind].list && signature(captured, false) === signature(input(kind), false);
    if (f.fetch) f.fetch.disabled = true;
    if (f.notice) f.notice.textContent = t("common.checking");
    try {
      const result = await window.ClaraCoreDesktop.listModels(captured);
      if (!current()) return;
      if (!Array.isArray(result?.models) || result.models.some(model => typeof model !== "string" || !model.trim())) throw new Error("Incomplete model list");
      const models = [...new Set(result.models.filter(model => typeof model === "string" && model.trim()))];
      const nodes = models.map(model => {
        const option = document.createElement("option");
        option.value = model; option.textContent = model; return option;
      });
      f.options?.replaceChildren(...nodes);
      // Reading suggestions never replaces a user's typed or saved model.
      if (f.notice) f.notice.textContent = t(result.supported === false ? "settings.modelFetchUnsupported" : models.length ? "settings.modelsLoaded" : "settings.modelsEmpty", { count: String(models.length) });
    } catch (_) {
      if (current() && f.notice) f.notice.textContent = t("settings.modelsFailed");
    } finally {
      if (revision === requests[kind].list && f.fetch) f.fetch.disabled = false;
    }
  }

  async function testModelConnection(kind) {
    const f = fields(kind), captured = input(kind);
    if (!window.ClaraCoreDesktop?.testModelConnection) return;
    const revision = ++requests[kind].test;
    const current = () => revision === requests[kind].test && signature(captured) === signature(input(kind));
    if (f.test) f.test.disabled = true;
    if (f.connection) { f.connection.textContent = t("settings.connectionChecking"); f.connection.className = "connection-test-notice is-checking"; }
    function renderResult(ok, error = "") {
      if (f.connection) {
        f.connection.className = `connection-test-notice ${ok ? "is-success" : "is-failed"}`;
        f.connection.textContent = t(ok ? "settings.connectionOk" : "settings.connectionFailed", { error });
      }
      if (f.status) {
        f.status.dataset.connectionState = ok ? "connected" : "failed";
        f.status.textContent = t(ok ? "settings.status.connected" : "settings.status.testFailed");
        f.status.className = ok ? "badge ok" : "badge warn";
      }
    }
    try {
      const result = await window.ClaraCoreDesktop.testModelConnection(captured);
      if (!current()) return null;
      renderResult(result?.ok === true, result?.error || t("settings.connectionUnknownError"));
      return result;
    } catch (error) {
      if (current()) renderResult(false, error?.message || t("settings.connectionUnknownError"));
      return null;
    } finally {
      if (revision === requests[kind].test && f.test) f.test.disabled = false;
    }
  }

  return { loadModelOptions, testModelConnection, syncInputs };
}
window.createClaraCoreModelOptions = createClaraCoreModelOptions;
