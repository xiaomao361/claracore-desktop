function createClaraCoreSettingsDialogs({ root, t, summary, isDirty, isBusy, discard, onOpen }) {
  const dialog = root.querySelector('#settingsDetailDialog');
  const title = root.querySelector('#settingsDialogTitle');
  const description = root.querySelector('#settingsDialogDescription');
  const close = root.querySelector('#settingsDialogClose');
  const cancel = root.querySelector('#settingsDialogCancel');
  const prompt = root.querySelector('#settingsDiscardPrompt');
  const notice = root.querySelector('#settingsDialogNotice');
  const keep = root.querySelector('#settingsKeepEditing');
  const discardButton = root.querySelector('#settingsDiscardChanges');
  const editors = Array.from(root.querySelectorAll('[data-settings-editor]'));
  const saves = Array.from(root.querySelectorAll('[data-settings-save-for]'));
  const titles = { appearance: 'settings.appPreferencesTitle', models: 'settings.modelsTitle', controller: 'settings.memoryControllerTitle', gateway: 'settings.agentGatewayTitle', knowledge: 'knowledge.directory.title', storage: 'settings.storageTitle', recovery: 'settings.dataRecoveryTitle' };
  const bodies = { appearance: 'settings.appPreferencesBody', models: 'settings.modelsBody', controller: 'settings.memoryControllerBody', gateway: 'settings.agentGatewayAdvancedHint', knowledge: 'knowledge.directory.body', storage: 'settings.storageBody', recovery: 'settings.dataRecoveryBody' };
  let active = '';
  let trigger = null;
  const overviewNotice = root.querySelector('#settingsOverviewNotice');
  let overviewTimer = null;
  let overviewRevision = 0;

  function clearOverviewNotice() {
    overviewRevision++;
    if (overviewTimer !== null) window.clearTimeout(overviewTimer);
    overviewTimer = null;
    if (overviewNotice) overviewNotice.textContent = '';
  }

  const scopesFor = scope => scope === 'models' ? ['memory', 'reflection'] : [scope];
  function busy() {
    return isBusy?.(active) || saves.some(button => scopesFor(active).includes(button.dataset.settingsSaveFor) && button.disabled);
  }

  function render() {
    for (const node of root.querySelectorAll('[data-settings-summary]')) node.textContent = summary(node.dataset.settingsSummary);
    for (const button of root.querySelectorAll('[data-settings-open]')) button.setAttribute('aria-label', t('settings.editItem', { name: t(titles[button.dataset.settingsOpen]) }));
    if (!active) return;
    title.textContent = t(titles[active]);
    description.textContent = t(bodies[active]);
    cancel.textContent = t(saves.some(button => button.dataset.settingsSaveFor === active) ? 'actions.cancel' : 'actions.close');
  }

  function finishClose() {
    dialog.close();
  }

  function requestClose() {
    if (!dialog.open) return true;
    if (busy()) { notice.textContent = t('settings.waitForSave'); return false; }
    if (isDirty(active)) {
      prompt.hidden = false;
      keep.focus();
      return false;
    }
    finishClose();
    return true;
  }

  function open(scope, source = null) {
    if (scope === 'memory' || scope === 'reflection') scope = 'models';
    if (!Object.hasOwn(titles, scope)) return false;
    if (dialog.open && active !== scope) return false;
    clearOverviewNotice();
    active = scope;
    trigger = source?.closest?.('#settingsView') ? source : root.querySelector(`[data-settings-open="${scope}"]`);
    prompt.hidden = true;
    notice.textContent = '';
    for (const editor of editors) editor.hidden = editor.dataset.settingsEditor !== scope;
    for (const button of saves) button.hidden = !scopesFor(scope).includes(button.dataset.settingsSaveFor);
    onOpen?.(scope);
    render();
    if (!dialog.open) dialog.showModal();
    title.focus();
    return true;
  }

  function saved(scope, message = '', { persistent = false } = {}) {
    render();
    const target = active === 'models' && scopesFor(active).includes(scope) ? active : scope;
    if (active !== target || isDirty(target)) return;
    clearOverviewNotice();
    if (overviewNotice) {
      overviewNotice.textContent = message || t('settings.itemSaved', { name: t(titles[target]) });
      if (!persistent) {
        const revision = overviewRevision;
        overviewTimer = window.setTimeout(() => {
          if (revision !== overviewRevision) return;
          overviewTimer = null;
          overviewNotice.textContent = '';
        }, 3000);
      }
    }
    prompt.hidden = true;
    finishClose();
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-settings-open]');
    if (button) open(button.dataset.settingsOpen, button);
  });
  close.addEventListener('click', requestClose);
  cancel.addEventListener('click', requestClose);
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) requestClose(); });
  keep.addEventListener('click', () => { prompt.hidden = true; title.focus(); });
  discardButton.addEventListener('click', () => {
    if (busy()) { notice.textContent = t('settings.waitForSave'); return; }
    discard(active);
    finishClose();
  });
  dialog.addEventListener('close', () => {
    active = '';
    prompt.hidden = true;
    const target = trigger;
    trigger = null;
    target?.focus();
  });
  return { open, requestClose, saved, render, clearOverviewNotice, activePanel: () => active, isOpen: () => Boolean(dialog.open) };
}
window.createClaraCoreSettingsDialogs = createClaraCoreSettingsDialogs;
