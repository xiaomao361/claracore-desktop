const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTurnContextService } = require('../gateway/turn-context');
const { handleSystemTool } = require('../gateway/tool-handlers/system');
const { parseHTML } = require('linkedom');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-baseline-'));
  const originalFetch = global.fetch;
  try {
    let requests = 0;
    global.fetch = async () => { requests++; throw new Error('Unexpected remote request'); };
    const app = { getPath: () => tmp };
    const legacy = path.join(tmp, 'jev-settings.json');
    const corpus = path.join(tmp, 'corpus');
    fs.mkdirSync(path.join(corpus, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(corpus, 'notes/example.md'), '# Example\nExact retrieval fixture\n');
    await require('../knowledge/preferences').saveKnowledgeRootPreference(app, corpus);
    const context = { core: { database: { getSettings: async () => ({}) } }, currentMcpAgentId: () => 'codex', runtimeAppForGateway: () => app, textResult: value => value };
    for (const config of [JSON.stringify({ enabled: true, mode: 'apply', provider: 'openai-compatible', baseUrl: 'https://example.invalid/v1', model: 'old-model', timeoutMs: 1200, encryptedKey: 'old-key' }), '{invalid legacy configuration']) {
      fs.writeFileSync(legacy, config);
      for (const deliveryContract of [undefined, 'memory-knowledge-v1']) {
        const result = await handleSystemTool('gateway_auto_context', { prompt: 'Exact', domain: 'knowledge', mode: 'exact', detail: 'full', deliveryContract }, context);
        assert.equal(result.domainStatus.memory, 'skipped');
        assert.equal(result.domainStatus.knowledge, 'ok');
        assert.equal(result.recallReceipt.hostDelivery, 'unknown');
        assert(!('jev' in result));
        if (deliveryContract) {
          assert.equal(result.decision, 'deliver_context');
          assert.match(result.blocks[0].body, /Exact retrieval fixture/);
        } else {
          assert.equal(result.knowledgeObservation.requestedMode, 'exact');
          assert.equal(result.knowledgeObservation.items.length, 1);
          assert.equal(result.knowledgeObservation.applied, false);
        }
      }
      assert.equal(fs.readFileSync(legacy, 'utf8'), config);
    }
    assert.equal(requests, 0, 'Legacy settings must never trigger model requests');
    let memoryCalls = 0;
    const modes = [];
    const service = createTurnContextService({ runMemoryController: async () => { memoryCalls++; return { action: 'NOOP', context: '' }; }, searchKnowledge: async (_, input) => { modes.push(input.mode); return { status: 'no_results', items: [] }; } });
    await service.collect({}, { prompt: 'query' });
    await service.collect({}, { prompt: 'query', domain: 'knowledge', mode: 'exact' });
    await service.collect({}, { prompt: 'query', domain: 'knowledge', mode: 'hybrid' });
    await service.collect({}, { prompt: 'query', domain: 'memory' });
    await service.collect({}, { prompt: 'query', domain: 'none' });
    assert.equal(memoryCalls, 2);
    assert.deepEqual(modes, ['semantic', 'exact', 'hybrid']);
    const failed = await createTurnContextService({ runMemoryController: async () => ({ resultStatus: 'timeout', decisionId: 'timeout-proof' }), searchKnowledge: async () => { throw new Error('unavailable'); } }).collect({}, { prompt: 'query' });
    assert.equal(failed.domainStatus.memory, 'timeout');
    assert.equal(failed.memoryDecisionId, 'timeout-proof');
    assert.equal(failed.domainStatus.knowledge, 'error');
    assert.deepEqual(failed.memoryCandidates, []);
    const { document } = parseHTML(fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8'));
    assert.equal(document.querySelector('#jevSettings'), null);
    assert.equal(document.querySelector('script[src*="jev"]'), null);
    console.log('Recall baseline passed: ignored legacy configuration, zero model requests, both host contracts, explicit routing, failure fidelity and removed settings markup.');
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
