const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const runtime = require('../runtime');
const { createGatewayTools } = require('../gateway/tools');
const { sqlString } = require('../db/helpers');
const { createTurnContextService } = require('../gateway/turn-context');
const { recallReceipt } = require('../gateway/recall-receipt');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claracore-maintenance-'));
  process.env.CLARACORE_DESKTOP_DATA_DIR = root;
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = '1';
  const app = { getPath: name => path.join(root, name), isPackaged: false };
  let database;
  try {
    await runtime.saveProductSettings(app, { 'innerlife.provider': 'disabled', 'memory.embedding.provider': 'disabled' });
    const core = await runtime.ensureProductCore(app);
    database = core.database;
    let caller = { agentId: 'codex', clientId: 'maintenance-smoke', conversationId: 'test-conversation' };
    const gateway = createGatewayTools({
      currentMcpAgentId: () => caller.agentId, currentCallerContext: () => caller,
      runtimeAppForGateway: () => app, textResult: value => value
    });
    const call = (name, args = {}) => gateway.callToolBody(name, args, core.paths, database);
    const own = await call('shared_line_create', { agentId: 'codex', title: 'Own line' });
    await call('shared_line_update', { lineId: own.line.id, summary: 'OWN_CONTEXT', factsUsed: ['source-proof'] });
    caller = { ...caller, agentId: 'other-agent' };
    const other = await call('shared_line_create', { agentId: 'other-agent', title: 'Other line' });
    await call('shared_line_update', { lineId: other.line.id, summary: 'OTHER_AGENT_PRIVATE_CONTEXT' });
    caller = { ...caller, agentId: 'codex' };
    const renamed = await call('shared_line_rename', { lineId: own.line.id, title: 'Renamed own line' });
    const archived = await call('shared_line_archive', { lineId: own.line.id });
    const readArchived = await call('shared_line_get', { lineId: own.line.id, detail: 'full' });
    await assert.rejects(call('shared_line_update', { lineId: own.line.id, summary: 'must not write archive' }), /not found/);
    const restored = await call('shared_line_restore', { lineId: own.line.id, makeActive: false });
    for (const result of [renamed, archived, restored]) {
      assert.equal(result.sharedLine.lineId, own.line.id);
      assert(!JSON.stringify(result).includes('OTHER_AGENT_PRIVATE_CONTEXT'));
    }
    assert.equal(readArchived.currentPosition.summary, 'OWN_CONTEXT');
    assert.equal((await database.getContinuityLine(other.line.id)).active, true);

    const sessionIds = [];
    for (let i = 0; i < 13; i++) {
      const packet = await call('innerlife_session_start', { externalSessionId: `session-${i}`, lineId: own.line.id });
      sessionIds.push(packet.session.id);
      await database.exec(`UPDATE innerlife_sessions SET briefing_json = ${sqlString(JSON.stringify({ preserved: 'COMPLETE_RECORD_' + 'x'.repeat(20000) }))} WHERE id = ${sqlString(packet.session.id)};`);
      await database.submitInnerLifeInbox({ agentId: 'codex', source: 'note', body: `Inbox ${i} ` + '正文'.repeat(3000) });
    }
    await call('innerlife_session_end', { sessionId: sessionIds[0] });
    for (let i = 0; i < 13; i++) {
      await database.exec(`INSERT INTO innerlife_shares (id, agent_id, status, body) VALUES (${sqlString('share-' + i)}, 'codex', 'pending', ${sqlString('Share ' + i + '正文'.repeat(1000))});`);
    }
    const sharePage = await call('innerlife_pending_shares');
    assert.equal(sharePage.shares.length, 10);
    assert.equal(sharePage.page.total, 10);
    // Retired candidates remain available in the complete history catalog.
    const shareFullTail = await call('innerlife_pending_shares', { status: 'all', detail: 'full', offset: 10 });
    assert.equal(shareFullTail.shares.length, 3);
    assert.equal(shareFullTail.page.hasMore, false);
    const shareHistoryHead = await call('innerlife_pending_shares', { status: 'all' });
    assert.equal(shareHistoryHead.page.total, 13);
    assert(!shareFullTail.shares.some(s => shareHistoryHead.shares.some(p => p.id === s.id)));
    assert(shareFullTail.shares.every(s => s.body.length > 1000));
    const queries = [];
    const queryPort = database.query.bind(database);
    database.query = async sql => { queries.push(sql); return queryPort(sql); };
    await call('innerlife_status');
    database.query = queryPort;
    assert(!queries.some(sql => /^\s*s\.body,/m.test(sql)), 'Status loaded complete share bodies.');
    assert(!queries.some(sql => /SELECT id, agent_id, source, body,/.test(sql)), 'Status loaded complete Inbox bodies.');

    const before = await database.query('SELECT status, count(*) AS count FROM innerlife_sessions GROUP BY status;');
    const summary = await call('innerlife_status');
    assert.equal(summary.work.activeSessionCount, 12);
    assert.equal(summary.work.sessionEndEvidence, 'host_required');
    const full = await call('innerlife_status', { detail: true });
    assert.equal(full.sessions.length, 10);
    assert.equal(full.pages.sessions.total, 13);
    assert.equal(full.pages.sessions.hasMore, true);
    assert(Buffer.byteLength(JSON.stringify(full)) < 32768, 'Status overflowed the diagnostic catalog budget.');
    assert(!JSON.stringify(full).includes('COMPLETE_RECORD_'));
    const second = await call('innerlife_status', full.pages.sessions.nextRead.arguments);
    assert.equal(second.sessions.length, 3);
    assert.equal(new Set([...full.sessions, ...second.sessions].map(s => s.id)).size, 13);
    const active = await call('innerlife_sessions', { status: 'active', limit: 50 });
    assert.equal(active.page.total, 12);
    assert(active.sessions.every(s => s.status === 'active'));
    const ended = await call('innerlife_sessions', { status: 'ended' });
    assert.equal(ended.page.total, 1);
    const selected = await call('innerlife_status', { detail: 'full', section: 'sessions', recordId: sessionIds[1] });
    assert.equal(selected.record.briefing.preserved.length, 20016);
    const inbox = await call('innerlife_status', { detail: 'full', section: 'inbox', limit: 2 });
    const inboxRecord = await call('innerlife_status', inbox.inbox[0].detailRef.arguments);
    assert(inboxRecord.record.body.length > 5000);
    caller = { ...caller, agentId: 'other-agent' };
    await assert.rejects(call('innerlife_status', { detail: 'full', section: 'sessions', recordId: sessionIds[1] }), /not found for this Agent/);
    await assert.rejects(call('innerlife_session_get', { id: sessionIds[1] }), /not found for this Agent/);
    caller = { ...caller, agentId: 'codex' };
    for (const bad of [{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { limit: '2' }, { offset: -1 }, { offset: 0.2 }]) {
      await assert.rejects(call('innerlife_status', { detail: 'full', ...bad }), /Catalog/);
    }
    await assert.rejects(call('innerlife_status', { detail: 'full', section: 'sessions', recordId: sessionIds[1], offset: 0 }), /cannot also/);
    const emptyPage = await call('innerlife_status', { detail: 'full', section: 'inbox', offset: 1000 });
    assert.equal(emptyPage.inbox.length, 0);
    assert.equal(emptyPage.pages.inbox.hasMore, false);
    await assert.rejects(call('innerlife_sessions', { status: 'expired' }), /status must/);
    await assert.rejects(call('innerlife_status', { detail: 'full', section: 'digestRuns', status: 'failed' }), /filtering requires/);
    assert.deepEqual(await database.query('SELECT status, count(*) AS count FROM innerlife_sessions GROUP BY status;'), before);

    const common = { policyVersion: 'maintenance-test', agentId: 'codex', clientId: caller.clientId,
      conversationId: caller.conversationId, stageAAction: 'RETRIEVE', stageAReason: 'test',
      stageBAction: 'INJECT_TOP1', stageBReason: 'test', resultStatus: 'completed',
      candidates: [{ id: 'memory-test' }] };
    const decision = await database.recordMemoryControlEvent({ ...common, policyMode: 'canary', injectedIds: ['memory-test'] });
    const observed = await database.recordMemoryControlEvent({ ...common, policyMode: 'observe' });
    const feedbackArgs = { decisionId: decision.id, feedbackType: 'delivered', memoryIds: ['memory-test'], evidenceExcerpt: 'Host acknowledged receipt response-1', responseId: 'response-1' };
    const concurrent = await Promise.all([call('memory_context_feedback', feedbackArgs), call('memory_context_feedback', feedbackArgs)]);
    const delivery = concurrent[0];
    assert.equal(concurrent[1].feedback.id, delivery.feedback.id);
    assert.equal((await call('memory_context_feedback', feedbackArgs)).feedback.id, delivery.feedback.id);
    assert.equal((await database.listMemoryControlFeedback({ decisionId: decision.id })).length, 1);
    await assert.rejects(call('memory_context_feedback', { ...feedbackArgs, feedbackType: 'used', evidenceExcerpt: '' }), /evidence excerpt/);
    await assert.rejects(call('memory_context_feedback', { ...feedbackArgs, decisionId: observed.id }), /observe-only or abstained/);
    await assert.rejects(call('memory_context_feedback', { ...feedbackArgs, memoryIds: ['unrelated'] }), /candidates from this decision/);
    caller = { ...caller, agentId: 'other-agent' };
    await assert.rejects(call('memory_context_feedback', feedbackArgs), /not found for this caller/);
    caller = { ...caller, agentId: 'codex', clientId: 'other-client' };
    await assert.rejects(call('memory_context_feedback', feedbackArgs), /not found for this caller/);
    caller = { ...caller, clientId: 'maintenance-smoke', conversationId: 'wrong-conversation' };
    await assert.rejects(call('memory_context_feedback', feedbackArgs), /not found for this caller/);
    caller = { ...caller, conversationId: 'test-conversation' };
    const abstained = await database.recordMemoryControlEvent({ ...common, policyMode: 'canary', resultStatus: 'abstained', injectedIds: ['memory-test'] });
    await assert.rejects(call('memory_context_feedback', { ...feedbackArgs, decisionId: abstained.id }), /observe-only or abstained/);
    const used = await call('memory_context_feedback', { ...feedbackArgs, feedbackType: 'used', evidenceExcerpt: 'Response-1 used the recalled source to change its conclusion' });
    assert.notEqual(used.feedback.id, delivery.feedback.id);
    assert.deepEqual(new Set((await database.listMemoryControlFeedback({ decisionId: decision.id })).map(f => f.feedbackType)), new Set(['used', 'delivered']));
    const evidencePage = await call('memory_context_feedback', { action: 'inspect', decisionId: decision.id, limit: 1 });
    assert.equal(evidencePage.page.total, 2);
    assert.equal(evidencePage.page.hasMore, true);
    const evidenceNext = await call('memory_context_feedback', evidencePage.page.nextRead.arguments);
    assert.equal(evidenceNext.page.hasMore, false);
    assert.notEqual(evidenceNext.feedback[0].id, evidencePage.feedback[0].id);
    for (const feedbackType of ['ignored', 'wrong', 'corrected', 'outcome_unknown']) {
      const report = await call('memory_context_feedback', { decisionId: observed.id, feedbackType, memoryIds: ['memory-test'], evidenceExcerpt: 'Explicit observation for ' + feedbackType });
      assert.equal(report.feedback.feedbackType, feedbackType);
    }
    const failedCollector = createTurnContextService({ runMemoryController: async () => ({ decisionId: observed.id, resultStatus: 'timeout', reason: 'controller_timeout' }) });
    const timedOut = await failedCollector.collect({}, { prompt: 'Earlier decision', agentId: 'codex', domain: 'memory' });
    assert.equal(timedOut.domainStatus.memory, 'timeout');
    assert.equal(timedOut.memoryDecisionId, observed.id);
    assert.deepEqual(timedOut.memoryCandidates, []);
    const collector = createTurnContextService({ runMemoryController: async () => ({ decisionId: decision.id, resultStatus: 'completed', candidates: [{ id: 'memory-test', score: 0.9 }], injectedIds: ['memory-test'], context: 'Recalled context', policyMode: 'canary' }) });
    const collected = await collector.collect({}, { prompt: 'Earlier decision', agentId: 'codex', domain: 'memory' });
    const receipt = recallReceipt({ decision: 'deliver_one' }, collected);
    assert.equal(receipt.decisionId, decision.id);
    assert.equal(receipt.hostDelivery, 'unknown');
    assert.equal(receipt.used, 'unknown');

    const { codexSessionKind } = await import(pathToFileURL(path.resolve(__dirname, '../../scripts/codex-session-policy.mjs')));
    const home = '/example/.codex';
    for (const cwd of [home + '/memories', home + '/memories_v2/jobs/one']) assert.equal(codexSessionKind(cwd, home), 'background_memory');
    for (const cwd of [home + '/memories_v2-project', '/repo/memories', '/repo/desktop']) assert.equal(codexSessionKind(cwd, home), 'conversation');
    const { prepareHook } = await import(pathToFileURL(path.resolve(__dirname, '../../scripts/prepare-codex-session-policy.mjs')));
    const hookFixture = `import { dirname } from "node:path";
const CODEX_CONFIG_PATH = ${JSON.stringify(path.join(root, 'codex/config.toml'))};
const eventName = process.argv[2];
function appendEvent(event) { console.log(JSON.stringify(event)); }
if (eventName === "SessionStart") { console.log('REGISTER_CONVERSATION'); }
if (eventName === "Stop") { console.log('STOP_UNCHANGED'); }
`;
    const prepared = prepareHook(hookFixture);
    await assert.rejects(async () => prepareHook(prepared), /already patched/);
    await fs.mkdir(path.join(root, 'codex/memories_v2/jobs'), { recursive: true });
    await fs.copyFile(path.resolve(__dirname, '../../scripts/codex-session-policy.mjs'), path.join(root, 'session-policy.mjs'));
    await fs.writeFile(path.join(root, 'hook.mjs'), prepared);
    const runHook = (event, cwd) => spawnSync(process.execPath, [path.join(root, 'hook.mjs'), event], { cwd, encoding: 'utf8', timeout: 5000 });
    const background = runHook('SessionStart', path.join(root, 'codex/memories_v2/jobs'));
    assert.equal(background.status, 0, background.stderr);
    assert(background.stdout.includes('background_memory_job'));
    assert(!background.stdout.includes('REGISTER_CONVERSATION'));
    assert(runHook('SessionStart', root).stdout.includes('REGISTER_CONVERSATION'));
    assert(runHook('Stop', path.join(root, 'codex/memories_v2/jobs')).stdout.includes('STOP_UNCHANGED'));
    const manifest = require('../gateway/tool-profiles').profileToolDefinitions('core');
    const ceilings = require('./fixtures/context-budget-ceilings').CONTEXT_BUDGET_CEILINGS;
    assert.equal(manifest.length, 25);
    const compatibility = require('../gateway/tool-profiles').profileToolDefinitions('core-compat');
    assert.equal(compatibility.length, 38);
    assert(Buffer.byteLength(JSON.stringify(manifest)) <= ceilings.coreToolsList);
    for (const name of ['understanding_context', 'understanding_submit', 'understanding_resume']) {
      assert(!manifest.some(tool => tool.name === name));
      assert(compatibility.some(tool => tool.name === name));
    }
    assert(!manifest.some(tool => tool.name === 'memory_context_feedback'));
    console.log('Desktop maintenance smoke passed: Agent isolation, archived history, bounded status pagination, lifecycle filters, evidenced feedback and host policy.');
  } finally {
    database?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
