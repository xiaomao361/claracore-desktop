const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
async function main() {
  const { window, document } = parseHTML(read('index.html'));
  const savedFolders = [], savedModels = [], errors = [];
  let failFolder = false;
  const desktop = {
    chooseKnowledgeRoot: async () => ({ path: '/draft/corpus' }),
    getKnowledgeRootPreference: async () => ({ root: '/saved/corpus', status: 'ok', documentCount: 2 }),
    saveKnowledgeRootPreference: async folder => { if (failFolder) throw Error('fixture'); savedFolders.push(folder); return { root: folder, status: 'ok' }; },
    saveSettings: async updates => { savedModels.push(updates); return { configuration: {} }; }
  };
  window.ClaraCoreDesktop = new Proxy(desktop, { get: (target, key) => target[key] || (() => new Promise(() => {})) });
  window.setTimeout = () => 0; window.clearTimeout = () => {};
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  window.confirm = () => true;
  const context = vm.createContext({ window, document, console: { error: error => errors.push(error.message) }, URL, Intl, Date, Map, Set, Number, String, Uint8Array, AbortController,
    setTimeout: () => 0, clearTimeout() {}, navigator: { language: 'zh-CN' }, localStorage: { getItem: () => null } });
  for (const script of document.querySelectorAll('script[src]')) {
    const file = script.getAttribute('src').replace(/^\.\//, '');
    let source = read(file);
    // Register the real renderer and handlers without starting runtime reads or timers.
    if (file === 'app.js') source = source.slice(0, source.lastIndexOf('\nhomeView.renderLoading();'));
    vm.runInContext(source, context, { filename: file });
  }
  for (const select of document.querySelectorAll('select')) Object.defineProperty(select, 'value', { writable: true, configurable: true, value: '' });
  for (const node of document.querySelectorAll('*')) node.focus = () => {};
  const dialog = document.querySelector('#settingsDetailDialog');
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new window.Event('close')); };
  vm.runInContext(`snapshot = { configuration: { memoria: { provider: 'ollama', endpoint: 'http://127.0.0.1:11434', model: '', providerSupported: true }, innerlife: { backend: 'disabled', pollSeconds: '90', model: '', apiKeyRef: '' }, memoryController: { mode: 'observe' } }, data: {}, build: { flavor: 'lite' } }; refresh = async () => renderSettings(); renderSettings();`, context);
  vm.runInContext('loginItemPreference = { launchAtLoginAvailable: true, launchAtLogin: true }; settingsView.renderAppearanceSettings();', context);
  assert.equal(document.querySelector('#settingsLaunchAtLoginHint').hidden, true);
  assert.equal(document.querySelector('#settingsLaunchAtLoginHint').textContent, '', 'Available login startup needs no duplicate explanatory sentence');
  vm.runInContext('loginItemPreference = { launchAtLoginAvailable: false, launchAtLogin: false }; settingsView.renderAppearanceSettings();', context);
  assert.equal(document.querySelector('#settingsLaunchAtLoginHint').hidden, false, 'Only an unavailable control needs an explanation');
  const click = async selector => { document.querySelector(selector).click(); for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
  await click('[data-settings-open="knowledge"]');
  assert.equal(document.querySelector('#knowledgeRootPath').value, '/saved/corpus');
  await click('#chooseKnowledgeRoot');
  assert.equal(savedFolders.length, 0, 'Choosing a folder must only stage it');
  assert.equal(document.querySelector('#knowledgeRootPath').value, '/draft/corpus');
  await click('#settingsDialogClose');
  assert.equal(dialog.open, true);
  await click('#settingsDiscardChanges');
  assert.equal(savedFolders.length, 0, 'Discard must never persist the staged folder');
  await click('[data-settings-open="knowledge"]');
  assert.equal(document.querySelector('#knowledgeRootPath').value, '/saved/corpus');
  await click('#clearKnowledgeRoot');
  assert.equal(savedFolders.length, 0, 'Clearing a folder must also be staged');
  failFolder = true; await click('#saveKnowledgeRoot');
  assert.equal(dialog.open, true);
  assert(document.querySelector('#knowledgeRootStatus').textContent.length > 0);
  failFolder = false; await click('#saveKnowledgeRoot');
  assert.deepEqual(savedFolders, ['']); assert.equal(dialog.open, false);
  await click('[data-settings-open="models"]');
  await click('#saveReflectionSettings');
  assert.equal(dialog.open, false, 'An incomplete memory model must not block reflection saving');
  assert.equal(savedModels.length, 1);
  assert(Object.keys(savedModels[0]).every(key => key.startsWith('innerlife.')));
  await click('[data-settings-open="models"]');
  await click('#saveMemorySettings');
  assert.equal(savedModels.length, 1, 'An invalid memory form must not write');
  assert.equal(dialog.open, true);
  const edit = (id, value) => { const element = document.getElementById(id); element.value = value; element.dispatchEvent(new window.Event('input')); };
  edit('memoriaProvider', 'openai-compatible'); edit('memoriaEndpoint', 'https://fixture.example.test/compatible-mode/v1');
  edit('memoriaModel', 'embedding-draft'); edit('memoriaApiKey', 'env:FIXTURE_KEY');
  edit('innerLifeBackend', 'openai-compatible'); edit('innerLifeEndpoint', 'https://fixture.example.test/v1');
  edit('innerLifeModel', 'generation-draft'); edit('innerLifePollSeconds', '1.5');
  await click('#saveMemorySettings');
  assert.equal(dialog.open, true, 'Saving one model must retain the other model draft in the shared dialog');
  assert.equal(document.querySelector('#innerLifeModel').value, 'generation-draft');
  assert.equal(savedModels.at(-1)['memory.embedding.api_key_ref'], 'env:FIXTURE_KEY');
  assert(Object.keys(savedModels.at(-1)).every(key => key.startsWith('memory.')));
  await click('#settingsDialogClose'); assert.equal(dialog.open, true);
  await click('#settingsDiscardChanges'); assert.equal(dialog.open, false);
  assert.deepEqual(errors, [], 'The real renderer must register and handle Settings without missing controls or stale references');
  console.log('Settings renderer integration passed: real markup/module registration, staged folder discard/retry, independent payloads and invalid-form preservation (no UI automation).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
