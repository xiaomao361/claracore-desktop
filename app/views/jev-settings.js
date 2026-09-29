(function(scope) {
  function createJevSettings({ dom, api, t }) {
    let dirty = false, busy = false, version = 0, modelRequest = 0;
    const status = text => { dom.jevStatus.textContent = text; };
    const controls = () => { for (const node of dom.jevSettings.querySelectorAll('input, button, select')) node.disabled = busy; };
    const selectedModel = () => dom.jevModel.value || dom.jevModel.querySelector('option[selected]')?.getAttribute('value') || '';
    function showModels(models, selected) {
      dom.jevModel.replaceChildren();
      const names = new Set();
      for (const model of models) {
        if (names.has(model.name)) continue;
        names.add(model.name);
        const option = dom.jevModel.ownerDocument.createElement('option');
        option.value = model.name; option.textContent = model.name;
        dom.jevModel.append(option);
      }
      if (selected && !names.has(selected)) {
        const option = dom.jevModel.ownerDocument.createElement('option');
        option.value = selected; option.textContent = selected;
        dom.jevModel.prepend(option);
      }
      dom.jevModel.value = selected || models[0]?.name || '';
      for (const option of dom.jevModel.querySelectorAll('option')) option.toggleAttribute('selected', option.getAttribute('value') === dom.jevModel.value || (!dom.jevModel.value && option.getAttribute('value') === selected));
    }
    function render(data) {
      dom.jevEnabled.checked = data.enabled; showModels([...dom.jevModel.querySelectorAll('option')].map(option => ({ name: option.getAttribute('value') })), data.model); dom.jevTimeout.value = data.timeoutMs;
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
    dom.jevSettings.addEventListener('input', () => { dirty = true; version += 1; status(t('jev.unsaved')); });
    dom.jevSettings.addEventListener('change', event => { if (event.target === dom.jevModel || event.target === dom.jevEnabled || event.target === dom.jevClearKey) { dirty = true; version += 1; status(t('jev.unsaved')); } });
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
      const input = { enabled: dom.jevEnabled.checked, model: selectedModel().trim(), timeoutMs: Number(dom.jevTimeout.value), apiKey: dom.jevKey.value, clearKey: dom.jevClearKey.checked };
      dom.jevKey.value = '';
      try { const data = await api.saveJevSettings(input); dirty = false; render(data); status(t('jev.saved')); }
      catch { status(t('jev.saveFailed')); }
      finally { busy = false; controls(); }
    });
    dom.jevTest.addEventListener('click', async () => {
      if (busy) return;
      if (dirty) { status(t('jev.saveFirst')); return; }
      busy = true; controls(); status(t('jev.testing'));
      try { const result = await api.testJevConnection(); status(t('jev.testResult', { status: result.status, latency: result.latencyMs })); }
      catch { status(t('jev.failed')); }
      finally { busy = false; controls(); }
    });
    return { load };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createJevSettings };
  scope.createJevSettings = createJevSettings;
})(typeof window === 'undefined' ? globalThis : window);
