(function(scope) {
  function createJevSettings({ dom, api, t }) {
    let dirty = false, busy = false, version = 0, modelRequest = 0;
    const status = text => { dom.jevStatus.textContent = text; };
    const controls = () => { for (const node of dom.jevSettings.querySelectorAll('input, button, select')) node.disabled = busy; if (!busy) providerView(selectedProvider()); };
    const selectedProvider = () => dom.jevProvider.value || dom.jevProvider.querySelector('option[selected]')?.getAttribute('value') || 'openai-compatible';
    const selectedModel = () => dom.jevModel.value || '';
    function showModels(models, selected) {
      dom.jevModelOptions.replaceChildren();
      for (const name of new Set(models.map(model => model.name))) {
        const option = dom.jevModel.ownerDocument.createElement('option');
        option.value = name; dom.jevModelOptions.append(option);
      }
      dom.jevModel.value = selected || '';
    }
    function providerView(provider) {
      dom.jevBaseUrl.disabled = provider === 'typesafe';
      dom.jevProviderSummary.textContent = provider === 'typesafe' ? 'TypeSafe · Jev' : t('jev.provider.openai');
    }
    function render(data) {
      const mode = data.mode || (data.enabled ? 'shadow' : 'off');
      const provider = data.provider || 'typesafe';
      dom.jevProvider.value = provider;
      for (const option of dom.jevProvider.querySelectorAll('option')) option.toggleAttribute('selected', option.getAttribute('value') === provider);
      dom.jevBaseUrl.value = data.baseUrl || 'https://api.typesafe.ai/v1'; providerView(provider);
      dom.jevMode.value = mode;
      for (const option of dom.jevMode.querySelectorAll('option')) option.toggleAttribute('selected', option.getAttribute('value') === mode); showModels([], data.model); dom.jevTimeout.value = data.timeoutMs;
      dom.jevKey.value = ''; dom.jevClearKey.checked = false;
      status(t(data.keyConfigured ? 'jev.keySaved' : 'jev.noKey'));
      dom.jevModelNotice.textContent = t(data.keyConfigured ? 'jev.models.ready' : 'jev.models.notConfigured');
    }
    async function load() {
      if (dirty || busy) return;
      const request = ++version;
      try { const data = await api.getJevSettings(); if (request === version && !dirty && !busy) render(data); }
      catch { if (request === version) status(t('jev.failed')); }
    }
    dom.jevSettings.addEventListener('input', event => { if (event.target === dom.jevBaseUrl) { dom.jevKey.value = ''; status(t('jev.provider.changed')); } dirty = true; version += 1; status(t(event.target === dom.jevBaseUrl ? 'jev.provider.changed' : 'jev.unsaved')); });
    dom.jevSettings.addEventListener('change', event => { if (event.target === dom.jevProvider || event.target === dom.jevBaseUrl || event.target === dom.jevModel || event.target === dom.jevMode || event.target === dom.jevClearKey) { dirty = true; version += 1; status(t('jev.unsaved')); } });
    dom.jevProvider.addEventListener('change', () => {
      const provider = selectedProvider();
      providerView(provider);
      dom.jevBaseUrl.value = provider === 'typesafe' ? 'https://api.typesafe.ai/v1' : 'https://api.openai.com/v1';
      showModels([], provider === 'typesafe' ? 'jev-latest' : '');
      dom.jevKey.value = ''; dom.jevClearKey.checked = false;
      dirty = true; version += 1; status(t('jev.provider.changed'));
    });
    dom.jevRefreshModels.addEventListener('click', async () => {
      if (busy) return;
      if (dirty) { dom.jevModelNotice.textContent = t('jev.models.saveFirst'); return; }
      const request = ++modelRequest;
      busy = true; controls(); dom.jevModelNotice.textContent = t('jev.models.loading');
      try {
        const result = await api.listJevModels();
        if (request !== modelRequest) return;
        if (result.status === 'ok') showModels(result.models, selectedModel());
        dom.jevModelNotice.textContent = t(`jev.models.${result.status}`) || t('jev.models.unavailable');
      } catch { dom.jevModelNotice.textContent = t('jev.models.unavailable'); }
      finally { busy = false; controls(); }
    });
    dom.jevSave.addEventListener('click', async () => {
      if (busy) return;
      busy = true; version += 1; controls();
      const input = { provider: selectedProvider(), baseUrl: dom.jevBaseUrl.value.trim(), mode: dom.jevMode.value || dom.jevMode.querySelector('option[selected]')?.getAttribute('value'), model: selectedModel().trim(), timeoutMs: Number(dom.jevTimeout.value), apiKey: dom.jevKey.value, clearKey: dom.jevClearKey.checked };
      dom.jevKey.value = '';
      try { const data = await api.saveJevSettings(input); dirty = false; render(data); status(t('jev.saved')); }
      catch { status(t('jev.saveFailed')); }
      finally { busy = false; controls(); }
    });
    dom.jevTest.addEventListener('click', async () => {
      if (busy) return;
      if (dirty) { status(t('jev.saveFirst')); return; }
      busy = true; controls(); status(t('jev.testing'));
      try { const result = await api.testJevConnection(); status(t('jev.testResult', { status: result.httpStatus ? `${result.status} (HTTP ${result.httpStatus})` : result.status, latency: result.latencyMs })); }
      catch { status(t('jev.failed')); }
      finally { busy = false; controls(); }
    });
    return { load };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createJevSettings };
  scope.createJevSettings = createJevSettings;
})(typeof window === 'undefined' ? globalThis : window);
