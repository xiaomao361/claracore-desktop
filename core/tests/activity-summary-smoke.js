const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML } = require('linkedom');
const { initializeProductDatabase } = require('../db/database');
const { createSnapshotRuntime } = require('../runtime/snapshot');
const { sqlString } = require('../db/helpers');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claracore-activity-summary-'));
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = '1';
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  const database = await initializeProductDatabase(path.join(root, 'test.db'));
  try {
    for (let i = 0; i < 7; i++) {
      const memory = await database.createMemory({ title: `Milestone ${i}`, body: 'Confirmed release', labels: [i % 2 ? '发布' : 'release:v1', 'milestone'], agentId: 'codex' });
      await database.exec(`UPDATE memories SET updated_at = ${sqlString(`2026-10-${String(10 + i).padStart(2, '0')} 10:00:00`)} WHERE id = ${sqlString(memory.id)};`);
    }
    for (const status of ['archived', 'deleted', 'restricted']) {
      const memory = await database.createMemory({ title: `Excluded ${status}`, body: 'Excluded', labels: ['milestone'], agentId: 'codex' });
      await database.exec(`UPDATE memories SET status = ${sqlString(status)} WHERE id = ${sqlString(memory.id)};`);
    }
    await database.createMemory({ title: 'Ordinary recent memory', body: 'No milestone evidence', labels: ['note'], agentId: 'codex' });
    const rows = await database.listRecentMilestones();
    assert.equal(rows.length, 5);
    assert.deepEqual(rows.map(item => item.title), ['Milestone 6', 'Milestone 5', 'Milestone 4', 'Milestone 3', 'Milestone 2']);
    assert.deepEqual((await database.getTraceSnapshot()).milestones, rows);
    const runtime = createSnapshotRuntime({ ensureProductCore: async () => ({ database, paths: { dataRoot: root } }) });
    const traceRead = database.getTraceSnapshot.bind(database);
    database.getTraceSnapshot = () => { throw new Error('Home must not read full trace aggregation'); };
    const home = await runtime.buildProductViewSnapshot({}, 'home');
    assert.deepEqual(home.homeMilestones, rows);
    assert(!('trace' in home));
    database.getTraceSnapshot = traceRead;
    const logs = await runtime.buildProductViewSnapshot({}, 'logs');
    assert(logs.trace.memory);
    const failedRuntime = createSnapshotRuntime({ ensureProductCore: async () => ({ database: {
      getAgentActivitySummary: async () => ({}),
      listRecentMilestones: async () => { throw new Error('milestone_read_failed'); }
    } }) });
    await assert.rejects(failedRuntime.buildProductViewSnapshot({}, 'home'), /milestone_read_failed/);

    const html = await fs.readFile(path.resolve(__dirname, '../../index.html'), 'utf8');
    const { document, window } = parseHTML(html);
    const context = vm.createContext({ window, document });
    for (const file of ['app/dom.js', 'app/i18n/zh.js', 'app/i18n/en.js', 'app/view-registry.js', 'app/views/activity-summary.js']) {
      vm.runInContext(await fs.readFile(path.resolve(__dirname, '../..', file), 'utf8'), context);
    }
    for (const script of document.querySelectorAll('script[src]')) {
      await fs.access(path.resolve(__dirname, '../..', script.getAttribute('src')));
    }
    assert.equal(document.querySelector('#traceView'), null);
    assert.equal(document.querySelector('[data-view="trace"]'), null);
    assert.equal(document.querySelector('.reading-mechanism'), null);
    assert.equal(window.ClaraCoreViews.trace, undefined);
    for (const target of document.querySelectorAll('[data-view-target]')) {
      assert(window.ClaraCoreViews[target.dataset.viewTarget], `Retired target: ${target.dataset.viewTarget}`);
    }
    assert(document.querySelector('#logsView #traceDetailDialog'));
    for (const element of document.querySelectorAll('#homeView [data-i18n], #logsView [data-i18n]')) {
      const key = element.getAttribute('data-i18n');
      assert.equal(typeof window.ClaraCoreTranslationsZh[key], 'string', key);
      assert.equal(typeof window.ClaraCoreTranslationsEn[key], 'string', key);
    }
    let snapshot = {};
    const escapeHtml = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const dom = window.ClaraCoreDom;
    const view = window.createClaraCoreActivitySummary({ dom, t: key => window.ClaraCoreTranslationsEn[key], getSnapshot: () => snapshot, escapeHtml, formatLocalDateTime: value => value || '' });
    view.render();
    assert.match(dom.homeMilestoneNotice.textContent, /Reading/);
    assert.equal(dom.traceOpenDetail.disabled, true);
    snapshot = { homeMilestones: [] };
    view.render();
    assert.equal(dom.homeMilestones.hidden, true);
    snapshot = { homeMilestonesError: true };
    view.render();
    assert.equal(dom.homeMilestones.hidden, false);
    assert.match(dom.homeMilestoneNotice.textContent, /could not be read/);
    snapshot = { ...home, trace: logs.trace };
    snapshot.homeMilestones = [{ title: '<img src=x onerror=bad>', updatedAt: '2026-10-29' }, ...rows];
    view.render();
    assert.equal(dom.homeMilestoneList.children.length, 5);
    assert.equal(dom.homeMilestoneList.querySelector('img'), null);
    assert.equal(dom.traceOpenDetail.disabled, false);
    assert.equal(dom.traceMemoryMetrics.children.length, 4);
    assert.equal(dom.traceAdvancedMetrics.children.length, 12);
    console.log('Activity summary passed: five evidence-qualified milestones, preserved ordering, lightweight Home hydration, Logs diagnostics, failure fidelity, retired navigation and escaped DOM.');
  } finally {
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
