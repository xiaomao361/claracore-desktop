const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { ProductDatabase } = require('../db/database');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function renderer(language) {
  const { window, document } = parseHTML(read('index.html'));
  const context = vm.createContext({ window, document, URL, Date });
  for (const file of ['app/dom.js', `app/i18n/${language.toLowerCase()}.js`, 'app/views/settings.js', 'app/model-options.js']) vm.runInContext(read(file), context);
  const dom = window.ClaraCoreDom;
  for (const select of document.querySelectorAll('select')) Object.defineProperty(select, 'value', { writable: true, configurable: true, value: '' });
  const words = window[`ClaraCoreTranslations${language}`];
  const t = (key, values = {}) => { assert.equal(typeof words[key], 'string', key); return words[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`); };
  for (const node of document.querySelectorAll('#settingsView [data-i18n]')) assert.equal(typeof words[node.getAttribute('data-i18n')], 'string', node.getAttribute('data-i18n'));
  let snapshot = { configuration: {
    memoria: { provider: 'ollama', providerSupported: true, model: 'retrieval', endpoint: 'http://127.0.0.1:11434' },
    innerlife: { backend: 'openai-compatible', baseUrl: 'https://models.example.test/v1', model: 'custom-model', pollSeconds: '90', autonomyEnabled: 'false', apiKeyRef: 'env:FIXTURE_KEY' },
    memoryController: { mode: 'observe', canaryAgentIds: ['chosen-agent'] }
  }, data: { root: '/data/current', databasePresent: true, databasePath: '/data/current/db', backupsDir: '/data/current-other/backups' },
  connections: { httpGateway: { ok: true, port: 50668, endpoint: 'http://127.0.0.1:50668/mcp', token: 'fixture' } }, build: { flavor: 'lite' } };
  const state = { dataRootPreference: { configuredDataRoot: '/data/next', effectiveDataRoot: '/data/next', canRelaunch: true } };
  let listCall = async () => ({ models: ['suggested'], supported: true });
  let testCall = async () => ({ ok: true, checkedAt: '2026-10-29T01:00:00Z' });
  let networkCalls = 0;
  window.ClaraCoreDesktop = { listModels: value => { networkCalls++; return listCall(value); }, testModelConnection: value => { networkCalls++; return testCall(value); } };
  let view;
  const options = window.createClaraCoreModelOptions({ dom, t, getSecretInputValue: input => view.getSecretInputValue(input) });
  view = window.createClaraCoreSettingsView({ dom, t, desktop: { copyText: async () => false }, getSnapshot: () => snapshot,
    getAppearancePreferences: () => ({ language: 'zh', theme: 'system', closeBehavior: 'hide', resolvedTheme: 'light' }),
    formatMode: value => value, state, onModelsRendered: () => options.syncInputs() });
  view.bindEvents();
  view.renderSettings();
  view.renderAppearanceSettings();
  assert.equal(networkCalls, 0, 'Rendering and editing must not make model requests');
  assert.equal(dom.innerLifePollSeconds.value, '1.5', 'Existing seconds must not be rounded to a different interval');
  assert.equal(view.collectSettingsForm()['innerlife.loop_seconds'], '90');
  assert.equal(dom.innerLifeEnabled.checked, false, 'Selecting a model must not opt into background generation');
  assert.equal(dom.relaunchForDataRoot.hidden, false, 'A plain refreshed preference still requires restart when active and configured paths differ');
  assert(dom.settingsPathDetails.textContent.includes('/data/current-other/backups'));
  const edit = (element, value) => { element.value = value; element.dispatchEvent(new window.Event('input')); };
  const memoryOnly = view.collectSettingsForm('memory');
  const reflectionOnly = view.collectSettingsForm('reflection');
  assert(Object.keys(memoryOnly).every(key => key.startsWith('memory.')));
  assert(Object.keys(reflectionOnly).every(key => key.startsWith('innerlife.')));
  assert.equal(view.settingsValidationError({ 'innerlife.provider': 'disabled' }), '');
  assert.equal(view.settingsValidationError({ 'memory.embedding.provider': 'disabled' }), '');
  edit(dom.memoriaModel, '');
  assert.equal(view.settingsValidationError(view.collectSettingsForm('reflection')), '', 'An incomplete memory form must not block reflection saving');
  view.discardScope('memory'); view.renderSettings();

  edit(dom.innerLifeModel, 'unsaved-model');
  const revision = view.draftRevision('reflection');
  snapshot.configuration.innerlife.model = 'background-refresh';
  view.renderSettings();
  assert.equal(dom.innerLifeModel.value, 'unsaved-model');
  edit(dom.innerLifeModel, 'later-edit');
  assert.equal(view.acceptSaved('reflection', revision), false, 'Save acknowledgements must not clear newer edits');
  view.renderSettings();
  assert.equal(dom.innerLifeModel.value, 'later-edit');
  assert(view.acceptSaved('reflection'));
  view.renderSettings();
  assert.equal(dom.innerLifeModel.value, 'background-refresh');
  assert.equal(view.embeddingConfigChanged({ 'memory.embedding.provider': 'ollama', 'memory.embedding.base_url': 'http://127.0.0.1:11435', 'memory.embedding.model': 'retrieval' }), true);
  assert.equal(view.embeddingConfigChanged({ 'memory.embedding.provider': 'disabled' }), false);
  edit(dom.innerLifePollSeconds, '1.7bad');
  assert.equal(view.settingsValidationError(view.collectSettingsForm()), 'settings.intervalInvalid');
  edit(dom.innerLifeBackend, 'disabled');
  assert.equal(view.settingsValidationError(view.collectSettingsForm()), '', 'Hidden disabled-model fields must not block saving');
  assert.equal('innerlife.loop_seconds' in view.collectSettingsForm(), false);
  edit(dom.innerLifeBackend, 'openai-compatible');
  edit(dom.innerLifePollSeconds, '1.5');
  edit(dom.innerLifeModel, 'typed-model');
  await options.loadModelOptions('innerlife');
  assert.equal(dom.innerLifeModel.value, 'typed-model', 'Loading a list must not choose a different model');
  assert.equal(dom.innerLifeModelOptions.children.length, 1);
  listCall = async () => { throw new Error('offline'); };
  await options.loadModelOptions('innerlife');
  assert.equal(dom.innerLifeModel.value, 'typed-model');
  assert.equal(dom.innerLifeModelOptions.children.length, 1, 'A failed read must preserve previous suggestions');
  const pendingList = deferred();
  listCall = () => pendingList.promise;
  const oldList = options.loadModelOptions('innerlife');
  edit(dom.innerLifeEndpoint, 'https://different.example.test/v1');
  pendingList.resolve({ models: ['wrong-service'], supported: true });
  await oldList;
  assert.equal(dom.innerLifeModelOptions.children.length, 0, 'A stale service response must not populate the current model list');
  const pendingTest = deferred();
  testCall = () => pendingTest.promise;
  const oldTest = options.testModelConnection('innerlife');
  edit(dom.innerLifeModel, 'changed-during-check');
  pendingTest.resolve({ ok: true });
  await oldTest;
  assert.notEqual(dom.innerLifeModelStatus.dataset.connectionState, 'connected');
  testCall = async () => ({ ok: true });
  await options.testModelConnection('innerlife');
  assert.equal(dom.innerLifeModelStatus.dataset.connectionState, 'connected');
  assert.equal(dom.innerLifeConnectionNotice.classList.contains('is-success'), true);
  assert.equal(dom.innerLifeConnectionNotice.classList.contains('ok'), false, 'Inline results must not inherit the global success background');
  testCall = async () => ({ ok: false, error: 'fixture denied' });
  await options.testModelConnection('innerlife');
  assert.equal(dom.innerLifeModelStatus.dataset.connectionState, 'failed');
  assert.equal(dom.innerLifeConnectionNotice.classList.contains('is-failed'), true);
  assert(dom.innerLifeConnectionNotice.textContent.includes('fixture denied'), 'Shortening feedback must retain the actual failure reason');

  edit(dom.innerLifeApiKey, 'env:DIFFERENT_FIXTURE');
  assert.equal(dom.innerLifeModelStatus.dataset.connectionState, undefined);
  edit(dom.settingsLanguage, 'en');
  view.renderAppearanceSettings();
  assert.equal(dom.settingsLanguage.value, 'en');
  edit(dom.settingsDataRootOverride, '/typed/draft');
  view.renderAppearanceSettings();
  assert.equal(dom.settingsDataRootOverride.value, '/typed/draft');
  edit(dom.settingsAgentGatewayPort, '51000');
  view.renderAppearanceSettings();
  assert.equal(dom.settingsAgentGatewayPort.value, '51000');
  dom.settingsMemoryControllerMode.value = 'canary';
  assert.deepEqual(Object.keys(view.collectMemoryControllerSettingsForm()), ['memory.controller.mode'], 'Changing mode must not expand the identity allowlist');
  assert.equal(snapshot.configuration.memoryController.canaryAgentIds[0], 'chosen-agent');
}

async function databaseDefaults() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'claracore-settings-workflow-'));
  let database = new ProductDatabase(path.join(temp, 'test.db'));
  try {
    await database.initialize();
    let settings = await database.getSettings(), secrets = await database.getSecretRefs();
    assert.equal(settings['innerlife.enabled'], false);
    assert.equal(settings['innerlife.provider'], 'disabled');
    assert.equal(secrets['innerlife.llm.api_key'].ref, null);
    assert.equal(secrets['innerlife.llm.api_key'].status, 'not-configured');
    assert(!read('core/config/index.js').includes('DEFAULT_INNERLIFE_API_KEY'));
    const legacy = { 'innerlife.enabled': true, 'innerlife.provider': 'openai-compatible', 'innerlife.base_url': 'https://configured.example.test/v1', 'innerlife.model': 'existing-model', 'innerlife.loop_seconds': 90, 'innerlife.llm.api_key_ref': 'env:EXISTING_FIXTURE' };
    await database.updateSettings(legacy);
    database.close();
    database = new ProductDatabase(path.join(temp, 'test.db'));
    await database.initialize();
    settings = await database.getSettings(); secrets = await database.getSecretRefs();
    for (const [key, value] of Object.entries(legacy)) if (key !== 'innerlife.llm.api_key_ref') assert.equal(settings[key], value);
    assert.equal(secrets['innerlife.llm.api_key'].ref, 'env:EXISTING_FIXTURE', 'Existing settings and credentials must survive initialization');
    await assert.rejects(database.updateSettings({ 'innerlife.loop_seconds': '90garbage' }), /positive/);
    await assert.rejects(database.updateSettings({ 'innerlife.provider': 'typo' }), /Unsupported/);
    await database.exec("CREATE TRIGGER settings_secret_failure BEFORE UPDATE ON secret_refs BEGIN SELECT RAISE(ABORT, 'test secret failure'); END;");
    await assert.rejects(database.updateSettings({ 'innerlife.model': 'must-rollback', 'innerlife.llm.api_key_ref': 'env:NEW_FIXTURE' }), /test secret failure/);
    assert.equal((await database.getSettings())['innerlife.model'], 'existing-model', 'A secret failure must roll back the setting changes');
    assert.equal((await database.getSecretRefs())['innerlife.llm.api_key'].ref, 'env:EXISTING_FIXTURE');
  } finally { database.close(); fs.rmSync(temp, { recursive: true, force: true }); }
}

async function saveOutcomes() {
  const source = read('app.js');
  const code = source.slice(source.indexOf('async function saveModelSettings'), source.indexOf('\nsaveMemorySettings.addEventListener', source.indexOf('async function saveModelSettings')));
  let failRefresh = false, failSave = false, revision = 0;
  let refreshWait;
  const context = vm.createContext({ window: { confirm: () => true, ClaraCoreDesktop: { saveSettings: async () => { if (failSave) throw new Error('uncertain'); return { configuration: {} }; } } },
    console: { error() {} }, t: key => key, settingsDialogs: { saved() {} }, settingsOperations: new Set(),
    settingsView: { settingsValidationError: () => '', embeddingConfigChanged: () => false, draftRevision: () => revision, acceptSaved: () => true },
    refresh: async () => { if (refreshWait) await refreshWait.promise; if (failRefresh) throw new Error('stale'); }
  });
  vm.runInContext(code, context);
  const button = { disabled: false }, notice = {};
  failRefresh = true;
  await context.saveModelSettings(button, notice, {});
  assert.equal(notice.textContent, 'settings.savedRefreshFailed');
  failRefresh = false; failSave = true;
  await context.saveModelSettings(button, notice, {});
  assert.equal(notice.textContent, 'settings.saveUnconfirmed');
  failSave = false; refreshWait = deferred();
  const pending = context.saveModelSettings(button, notice, {});
  await new Promise(resolve => setImmediate(resolve));
  revision++;
  refreshWait.resolve(); await pending;
  assert.equal(notice.textContent, 'settings.savedWithDraft');
  assert.equal(button.disabled, false);
}

async function modelListContracts() {
  const source = read('electron/main.js');
  const begin = source.indexOf('function openAiModelsUrl');
  const end = source.indexOf('async function testConfiguredModel', begin);
  let payload;
  const context = vm.createContext({ require: file => require(require("node:path").resolve(root, "electron", file)), URL, normalizeModelEndpoint: value => value,
    resolveListedModelName: require('../model-provider-utils').resolveListedModelName,
    resolveApiKeyRef: () => '', fetchJsonWithTimeout: async () => payload });
  vm.runInContext(source.slice(begin, end), context);
  const input = { provider: 'ollama', endpoint: 'http://127.0.0.1:11434' };
  payload = {};
  await assert.rejects(context.listConfiguredModels(input), /invalid model list/);
  payload = { models: [{ unrelated: 'not a model' }] };
  await assert.rejects(context.listConfiguredModels(input), /invalid model list/);
  payload = { models: [] };
  assert.equal((await context.listConfiguredModels(input)).models.length, 0, 'A valid empty list remains distinct from an invalid response');
  payload = { data: [{ id: 'configured-model' }] };
  assert.equal((await context.listConfiguredModels({ provider: 'openai-compatible', endpoint: 'https://example.test/v1' })).models[0], 'configured-model');
}

async function main() {
  for (const language of ['Zh', 'En']) await renderer(language);
  await databaseDefaults();
  await saveOutcomes();
  await modelListContracts();
  console.log('Settings workflow passed: no default shared credential/generation, existing settings preserved, atomic save rollback, draft preservation, explicit model requests, stale response guards, accurate intervals and restart state.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
