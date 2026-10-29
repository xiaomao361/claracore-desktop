const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const read = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function checkSetup(language) {
  const window = {};
  const context = vm.createContext({ window });
  vm.runInContext(read(`app/i18n/${language.toLowerCase()}.js`), context);
  vm.runInContext(read('app/views/agent-setup.js'), context);
  vm.runInContext(read('app/views/home-trace.js'), context);
  const words = window[`ClaraCoreTranslations${language}`];
  const t = (key, values = {}) => {
    assert.equal(typeof words[key], 'string', `Missing ${language} copy: ${key}`);
    return words[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  };
  const dom = Object.fromEntries(['copyAgentSetup', 'agentSetupStatus', 'agentSetupNotice', 'agentGatewayStatus', 'agentHttpStatus', 'agentGuideStatus', 'agentGuideVersion', 'agentConnectionEvidence', 'refreshAgentSetup'].map(key => [key, {}]));
  let snapshot = {};
  let copyResult = true;
  let captured = '';
  let copyHook = () => {};
  let failRefresh = false;
  let refreshCount = 0;
  let refreshWait;
  const view = window.createClaraCoreAgentSetupView({ dom, t, getSnapshot: () => snapshot,
    formatLocalDateTime: value => value,
    copyValue: async value => { captured = value; copyHook(); return copyResult; },
    refreshSnapshot: async () => { refreshCount++; if (refreshWait) await refreshWait.promise; if (failRefresh) throw new Error('offline'); }
  });
  view.render();
  assert.equal(dom.copyAgentSetup.disabled, true);
  assert.equal(dom.agentConnectionEvidence.textContent, t('agentSetup.observationUnavailable'));
  snapshot = { connections: { httpGateway: { ok: true }, httpEndpoints: [], agentGuide: { version: 'fixture' } }, gatewayTraces: [] };
  view.render();
  assert.equal(dom.agentSetupStatus.textContent, t('agentSetup.materialMissing'));
  assert.equal(dom.copyAgentSetup.disabled, true);
  snapshot.connections.httpEndpoints.push({ id: 'streamable-http-mcp', url: 'http://127.0.0.1:50668/mcp', authHeader: 'Authorization: Bearer FAKE-FIXTURE' });
  view.render();
  assert.equal(dom.copyAgentSetup.disabled, false);
  assert.equal(dom.agentConnectionEvidence.textContent, t('agentSetup.noRequests'));
  assert(await view.copy());
  assert(captured.includes('SHARED_LINE_ID_REQUIRED'));
  assert(captured.includes('user intent uniquely identifies'));
  assert(captured.includes('Examples are examples') || captured.includes('These are examples only'));
  assert(captured.includes('Never reuse another agent'));
  assert.equal(dom.agentSetupNotice.textContent, t('agentSetup.copied'));
  snapshot.gatewayTraces = [{ agentId: 'A', clientId: 'client-a', createdAt: '2026-10-28 01:00:00', toolName: 'claracore_connection_test', status: 'ok' },
    { agentId: 'B', clientId: 'client-b', createdAt: '2026-10-29T01:00:00Z', toolName: 'memoria_get', status: 'ok' }];
  view.render();
  assert(dom.agentConnectionEvidence.textContent.includes(t('agentSetup.lastRequest', { identity: 'B / client-b', time: '2026-10-29T01:00:00Z' })));
  assert(dom.agentConnectionEvidence.textContent.includes(t('agentSetup.testCompleted', { identity: 'A / client-a', time: '2026-10-28 01:00:00' })));
  assert(dom.agentConnectionEvidence.textContent.includes(t('agentSetup.observationScope')));
  snapshot.gatewayTraces[0].status = undefined;
  view.render();
  assert(dom.agentConnectionEvidence.textContent.includes(t('agentSetup.testUnknown', { identity: 'A / client-a', time: '2026-10-28 01:00:00' })));
  const trace = window.createClaraCoreHomeTrace({ t, getSnapshot: () => snapshot });
  assert.equal(trace.agentActivityState(snapshot.gatewayTraces[0]).label, t('home.trace.statusUnknown'));
  copyResult = false;
  assert.equal(await view.copy(), false);
  assert.equal(dom.agentSetupNotice.textContent, t('agentSetup.copyFailed'));
  copyResult = true;
  copyHook = () => { snapshot.connections.httpEndpoints[0].authHeader = 'Authorization: Bearer ROTATED-FIXTURE'; };
  assert.equal(await view.copy(), false, 'A stale clipboard result must not confirm newly rotated credentials');
  assert.equal(dom.agentSetupNotice.textContent, t('agentSetup.materialChanged'));
  copyHook = () => {};
  failRefresh = true;
  await view.refresh();
  assert.equal(dom.agentConnectionEvidence.textContent, t('agentSetup.refreshFailed'));
  assert.equal(dom.copyAgentSetup.disabled, true);
  assert.equal(await view.copy(), false);
  failRefresh = false;
  refreshWait = deferred();
  const pending = view.refresh();
  const count = refreshCount;
  await view.refresh();
  assert.equal(refreshCount, count);
  refreshWait.resolve();
  await pending;
  assert.equal(dom.copyAgentSetup.disabled, false);
  snapshot.connections.httpGateway = { ok: false };
  view.render();
  assert.equal(dom.agentSetupStatus.textContent, t('agentSetup.unavailable'));
  assert.equal(await view.copy(), false);
}

function packet(id, agentId = 'A', summary = 'An ongoing topic with no required task') {
  return { lineId: id, agentId, currentPosition: { lineId: id, agentId, summary, metadata: {} } };
}

async function checkContinuation(language) {
  const window = {};
  const context = vm.createContext({ window, console: { error() {} } });
  vm.runInContext(read(`app/i18n/${language.toLowerCase()}.js`), context);
  vm.runInContext(read('app/shared-line-actions.js'), context);
  const words = window[`ClaraCoreTranslations${language}`];
  const t = (key, values = {}) => {
    assert.equal(typeof words[key], 'string', key);
    return words[key].replace(/\{(\w+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  };
  const state = { selectedSharedLineId: 'one', selectedSharedLinePacket: packet('one'), activeSharedLineAgentFilter: '' };
  const dom = { sharedLineNotice: {}, sharedLineSelectionNotice: {}, sharedLineResumeNotice: {}, sharedLineAgentFilter: { value: '' } };
  let reads = [];
  let copies = [];
  let failId = '';
  let mismatched = false;
  let copyResult = true;
  let clipboardWait;
  const actions = window.createClaraCoreSharedLineActions({ dom, state, t, renderSharedLine() {},
    desktop: { async getSharedLine({ lineId }) { reads.push(lineId); if (lineId === failId) throw new Error('read failed'); return packet(mismatched ? 'wrong-id' : lineId); } },
    copyValue: async value => { copies.push(value); if (clipboardWait) await clipboardWait.promise; return copyResult; }
  });
  const catalog = { overview: true, lines: [{ id: 'one', agentId: 'A', active: true }, { id: 'two', agentId: 'A' }, { id: 'foreign', agentId: 'B' }] };
  actions.syncSelectedLineCatalog(catalog);
  assert.equal(await actions.copyContinuation(), false, 'An overview/loading state must not provide a resume prompt');
  await actions.hydrateSelectedLine(catalog);
  assert.equal(state.sharedLineReadStatus, 'ready');
  assert(await actions.copyContinuation());
  assert(copies[0].includes('"one"'));
  assert(!copies[0].includes(state.selectedSharedLinePacket.currentPosition.summary), 'The prompt should carry a pointer, not stale copied content');
  assert.equal(dom.sharedLineResumeNotice.textContent, t('sharedLine.resumeCopied'));
  const card = id => ({ dataset: { sharedLineId: id }, setAttribute() {}, removeAttribute() {} });
  failId = 'two';
  await actions.selectLine(card('two'));
  assert.equal(state.selectedSharedLineId, 'one');
  assert.equal(state.sharedLineReadStatus, 'error');
  assert.equal(await actions.copyContinuation(), false, 'Retaining old content after a failed selection must not enable continuation');
  failId = '';
  await actions.retrySelectedLine();
  assert.equal(reads.at(-1), 'two', 'Retry must read the failed intended ID, not the restored previous line');
  assert.equal(state.selectedSharedLineId, 'two');
  assert.equal(state.sharedLineReadStatus, 'ready');
  copyResult = false;
  assert.equal(await actions.copyContinuation(), false);
  assert.equal(dom.sharedLineResumeNotice.textContent, t('sharedLine.resumeCopyFailed'));
  copyResult = true;
  clipboardWait = deferred();
  const pending = actions.copyContinuation();
  await actions.selectLine(card('one'));
  clipboardWait.resolve();
  await pending;
  assert.equal(dom.sharedLineResumeNotice.textContent, '', 'An old clipboard acknowledgement must not attach to the new selection');
  clipboardWait = null;
  dom.sharedLineAgentFilter.value = 'B';
  await actions.changeAgentFilter();
  assert.equal(state.selectedSharedLineId, '', 'Changing identity filters must not leave another identity selected');
  assert.equal(await actions.copyContinuation(), false);
  mismatched = true;
  await actions.selectLine(card('foreign'));
  assert.equal(state.sharedLineReadStatus, 'error');
  assert.equal(await actions.copyContinuation(), false);
  mismatched = false;
  // A complete but empty line has no content to resume.
  state.selectedSharedLineId = 'empty';
  state.selectedSharedLinePacket = packet('empty', 'B', '');
  state.sharedLineReadStatus = 'ready';
  assert.equal(await actions.copyContinuation(), false);
}

async function checkControls() {
  const { document, window } = parseHTML(read('index.html'));
  const context = vm.createContext({ window, document });
  for (const file of ['app/dom.js', 'app/i18n/en.js', 'app/shared-line-actions.js']) vm.runInContext(read(file), context);
  const dom = window.ClaraCoreDom;
  for (const element of document.querySelectorAll('#agentSetupView [data-i18n], #sharedLineView [data-i18n]')) {
    const key = element.getAttribute('data-i18n');
    assert.equal(typeof window.ClaraCoreTranslationsEn[key], 'string', key);
  }
  let copied = '';
  const state = { selectedSharedLineId: 'bound-control', selectedSharedLinePacket: packet('bound-control'), sharedLineReadStatus: 'ready' };
  const actions = window.createClaraCoreSharedLineActions({ dom, state, desktop: {},
    t: (key, args = {}) => window.ClaraCoreTranslationsEn[key].replace('{id}', args.id || ''),
    renderSharedLine() {}, copyValue: async value => { copied = value; return true; }
  });
  actions.bindEvents();
  dom.sharedLineResume.disabled = false;
  dom.sharedLineResume.click();
  await new Promise(resolve => setImmediate(resolve));
  assert(copied.includes('"bound-control"'), 'The actual DOM continuation control must reach the exact-ID copy action');
  assert.equal(dom.sharedLineResumeNotice.textContent, window.ClaraCoreTranslationsEn['sharedLine.resumeCopied']);
}

async function main() {
  for (const language of ['Zh', 'En']) {
    await checkSetup(language);
    await checkContinuation(language);
  }
  const { document } = parseHTML(read('index.html'));
  const setup = document.querySelector('#agentSetupView');
  const sections = [...setup.querySelector('.agent-access-page').children];
  assert(sections.indexOf(setup.querySelector('.agent-access-connect')) < sections.indexOf(setup.querySelector('.agent-access-activity')), 'Setup actions precede observations in reading order');
  for (const id of ['gatewayHandshakeList', 'gatewayTraceList']) {
    const region = setup.querySelector('#' + id).parentElement;
    assert.equal(region.getAttribute('role'), 'region');
    assert.equal(region.getAttribute('tabindex'), '0', 'Scrollable access lists remain keyboard reachable');
    assert(setup.querySelector('#' + region.getAttribute('aria-labelledby')), 'Each region has an existing heading');
  }
  await checkControls();
  console.log('Agent setup and continuation passed: scoped evidence, stale credentials, refresh recovery, exact-ID retry, copy races, identity filtering and read-only prompts.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
