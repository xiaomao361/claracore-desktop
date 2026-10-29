const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

async function main() {
  for (const language of ['Zh', 'En']) {
    const { document, window } = parseHTML(read('index.html'));
    let snapshot = { runtimeEvents: [], gatewayTraces: [], generatedAt: '2026-10-29T01:00:00Z' };
    let fail = false;
    let unblock;
    let requestCount = 0;
    const timers = new Map();
    let timerId = 0;
    const context = vm.createContext({ window, document, console,
      setInterval(callback) { timers.set(++timerId, callback); return timerId; },
      clearInterval(id) { timers.delete(id); }
    });
    for (const file of ['app/dom.js', `app/i18n/${language.toLowerCase()}.js`, 'app/views/logs.js']) vm.runInContext(read(file), context);
    const words = window[`ClaraCoreTranslations${language}`];
    const t = (key, params = {}) => {
      assert.equal(typeof words[key], 'string', `Missing ${language} translation: ${key}`);
      return words[key].replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
    };
    const dom = window.ClaraCoreDom;
    // linkedom is an in-memory DOM, with no browser, Electron or user UI.
    // Its select.value is getter-only; the view writes the ordinary DOM property.
    Object.defineProperty(dom.logFilter, 'value', { writable: true, value: 'all' });
    dom.logDetailDialog.showModal = () => { dom.logDetailDialog.open = true; };
    const view = window.createClaraCoreLogsView({ dom, t, getSnapshot: () => snapshot,
      formatLocalDateTime: value => value,
      refreshSnapshot: async () => {
        requestCount++;
        if (unblock) await new Promise(resolve => { unblock.resolve = resolve; });
        if (fail) throw new Error('<unsafe refresh failure>');
        snapshot = { ...snapshot, generatedAt: '2026-10-29T02:00:00Z' };
      }
    });
    const trace = (id, status, extra = {}) => ({ id, status, toolName: 'memoria_search', createdAt: `2026-10-29T01:00:${id.padStart(2, '0')}Z`, ...extra });
    snapshot.gatewayTraces = [trace('01', 'ok', { responseSummary: '{"items":[]}' }),
      trace('02', undefined), trace('03', 'unrecognized'), trace('04', 'error'),
      trace('05', 'ok', { error: '<explicit error>', toolName: '<unknown tool>' }),
      trace('06', 'ok', { toolName: 'gateway_auto_context', responseSummary: '{"decision":"abstain"}' }),
      trace('07', 'ok', { toolName: 'gateway_auto_context', responseSummary: '{"decision":"deliver_one","block":{"body":"prepared"}}' }),
      trace('08', 'ok', { toolName: 'gateway_auto_context', responseSummary: '{"decision":"deliver_one","block":{"body":"truncated...' }),
      trace('09', 'ok', { toolName: 'constructor' }),
      trace('10', 'ok', { toolName: 'gateway_auto_context', responseSummary: '{"decision":"deliver_context","blocks":{}}' }),
      trace('11', 'ok', { responseSummary: '{"results":[]}' }),
      trace('12', 'ok', { responseSummary: '{"results":[],"degraded":true}' }),
      trace('13', 'ok', { responseSummary: '{"results":[{"id":"m1"}]}' })];
    view.render();
    const row = id => document.querySelector(`[data-log-event-id="gateway:${id}"]`);
    assert.equal(row('01').querySelector('strong').textContent, t('logs.action.searchMemory'));
    assert(row('01').textContent.includes(t('logs.result.completed')));
    for (const id of ['02', '03']) assert(row(id).textContent.includes(t('logs.status.unknown')));
    assert(row('05').classList.contains('error'));
    assert.equal(dom.logTerminal.querySelector('unsafe'), null);
    assert(row('06').textContent.includes(t('logs.result.abstain')));
    assert(row('07').textContent.includes(t('logs.result.prepared')));
    assert(row('08').textContent.includes(t('logs.result.completed')));
    assert(row('09').textContent.includes(t('logs.action.request')));
    assert(row('10').textContent.includes(t('logs.result.completed')));
    assert(row('11').textContent.includes(t('logs.result.noMatches')));
    assert(row('12').textContent.includes(t('logs.status.partial')));
    assert(row('12').textContent.includes(t('logs.result.degraded')));
    assert(!row('12').textContent.includes(t('logs.result.noMatches')));
    assert(row('13').textContent.includes(t('logs.result.matches', { count: '1' })));
    assert(dom.logStatusSummary.textContent.includes(t('logs.statusIncomplete', { errors: '2', count: '2', partial: '1' })));
    assert.equal(dom.logDecayIssueCount.textContent, t('logs.decayUnavailable'));
    const originalTime = dom.logLastRefresh.textContent;
    view.setFilter('errors');
    assert.equal(dom.logTerminal.children.length, 2);
    assert.equal(dom.logLastRefresh.textContent, originalTime, 'Filtering must not advance the data timestamp');
    view.setFilter('all');
    row('05').click();
    assert(dom.logEventDetail.textContent.includes('<explicit error>'));
    assert(dom.logEventDetail.textContent.includes('<unknown tool>'));
    assert.equal(dom.logEventDetail.querySelector('unknown'), null);

    snapshot.decayAudit = { issues: [{ code: 'innerlife_old_shares', level: 'warn', count: 1,
      message: 'Legacy English message', action: 'mark used', items: [] }] };
    view.render();
    assert(dom.logDecayList.querySelector('p').textContent.includes(t('logs.decayBody.innerlife_old_shares')));
    assert(dom.logDecayList.querySelector('details').textContent.includes('mark used'), 'Original diagnostics remain inspectable');
    snapshot.decayAudit = { issues: [] };
    view.render();
    assert(dom.logDecayList.textContent.includes(t('logs.decayClear')));

    fail = true;
    await view.refreshNow();
    assert.equal(dom.logStatusSummary.textContent, t('logs.refreshStale'));
    assert.equal(dom.refreshLogs.disabled, false);
    assert.equal(dom.logLastRefresh.textContent, originalTime);
    view.setFilter('errors');
    assert.equal(dom.logTerminal.children.length, 3, 'Refresh errors must be included in the error filter');
    assert.equal(dom.logTerminal.querySelector('unsafe'), null);
    view.syncRefreshTimer('logs');
    assert.equal(timers.size, 1);
    await [...timers.values()][0]();
    assert.equal(dom.logTerminal.children.length, 3, 'Following must not flood repeated identical failure episodes');
    fail = false;
    await [...timers.values()][0]();
    assert.notEqual(dom.logStatusSummary.textContent, t('logs.refreshStale'));
    assert.notEqual(dom.logLastRefresh.textContent, originalTime);
    fail = true;
    await [...timers.values()][0]();
    assert.equal(dom.logTerminal.children.length, 4, 'A new failure after recovery must remain visible');
    view.syncRefreshTimer('home');
    assert.equal(timers.size, 0);
    fail = false;
    unblock = {};
    const before = requestCount;
    const pending = view.refreshNow();
    await view.refreshNow();
    assert.equal(requestCount, before + 1, 'Manual refresh requests must not overlap');
    unblock.resolve();
    await pending;
    snapshot.gatewayTraces.push(trace('14', 'ok', { toolName: 'memoria_get', responseSummary: '{"error":"not found"}' }));
    view.render();
    assert(row('14').classList.contains('error'), 'An application read error must remain distinguishable from transport completion');
    assert.equal(snapshot.gatewayTraces.at(-1).status, 'ok', 'Projection must not rewrite original evidence');
  }

  // Validate the actual application boundary: incomplete payloads cannot erase
  // previously loaded evidence and masquerade as an empty successful refresh.
  const app = read('app.js');
  const start = app.indexOf('async function refreshLogsSnapshot()');
  const end = app.indexOf('\nasync function ', start + 1);
  const old = { gatewayTraces: [{ id: 'keep' }], runtimeEvents: [{ id: 'keep-runtime' }] };
  let returned = { gatewayTraces: [] };
  const context = vm.createContext({ snapshot: old, window: { ClaraCoreDesktop: { getLogsSnapshot: async () => returned } },
    t: key => key, renderLogs() {}, Date });
  vm.runInContext(app.slice(start, end), context);
  await assert.rejects(vm.runInContext('refreshLogsSnapshot()', context), /incompleteSnapshot/);
  assert.equal(context.snapshot, old);
  returned = { gatewayTraces: [], runtimeEvents: [], generatedAt: '2026-10-29T02:00:00Z' };
  await vm.runInContext('refreshLogsSnapshot()', context);
  assert.equal(context.snapshot.gatewayTraces.length, 0);
  assert.equal(context.snapshot.logsUpdatedAt, returned.generatedAt);
  console.log('Log semantics passed: bilingual result projection, unknown/truncated outcomes, refresh failure/recovery, retained evidence and bounded timers.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
