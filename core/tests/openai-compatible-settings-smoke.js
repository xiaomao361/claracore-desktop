const assert = require('node:assert/strict');
const http = require('node:http');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openAiEndpoint } = require('../openai-endpoint');
const { ProductDatabase } = require('../db/database');
async function main() {
  for (const [base, prefix] of [['https://example.test', '/v1'], ['https://example.test/v1/', '/v1'], ['https://example.test/compatible-mode/v1', '/compatible-mode/v1'], ['https://example.test/api/paas/v4', '/api/paas/v4'], ['https://example.test/v1beta/openai/', '/v1beta/openai']]) {
    for (const resource of ['models', 'chat/completions', 'embeddings']) assert.equal(new URL(openAiEndpoint(base, resource)).pathname, `${prefix}/${resource}`);
  }
  assert.throws(() => openAiEndpoint('https://secret@example.test/v1', 'models'));
  const requests = []; let fail = false, malformed = false;
  const server = http.createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    requests.push({ url: request.url, authorization: request.headers.authorization, body });
    response.setHeader('Content-Type', 'application/json');
    if (fail) { response.writeHead(401); response.end('{"error":"fixture rejection"}'); return; }
    if (request.url.endsWith('/embeddings')) response.end(JSON.stringify({ data: [{ embedding: malformed ? [1, 'invalid', 3] : [1, 0.5, -1] }] }));
    else if (request.url.endsWith('/chat/completions')) response.end(JSON.stringify({ choices: [{ message: { content: 'fixture response' } }] }));
    else response.end(JSON.stringify({ data: [{ id: 'fixture-embedding' }, { id: 'fixture-chat' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'claracore-compatible-'));
  const database = new ProductDatabase(path.join(temp, 'fixture.db'));
  const baseUrl = `http://127.0.0.1:${server.address().port}/compatible-mode/v1`;
  process.env.CLARACORE_FIXTURE_EMBED_KEY = 'fixture-key';
  try {
    await database.initialize();
    await database.updateSettings({ 'memory.embedding.provider': 'openai-compatible', 'memory.embedding.base_url': baseUrl, 'memory.embedding.model': 'fixture-embedding', 'memory.embedding.api_key_ref': 'env:CLARACORE_FIXTURE_EMBED_KEY' });
    assert.equal((await database.getSecretRefs())['memory.embedding.api_key'].ref, 'env:CLARACORE_FIXTURE_EMBED_KEY');
    const electronSource = fs.readFileSync(path.resolve(__dirname, '../../electron/main.js'), 'utf8');
    const context = vm.createContext({ URL, require: file => require(path.resolve(__dirname, '../../electron', file)),
      normalizeModelEndpoint: value => value, resolveApiKeyRef: () => 'fixture-key', resolveListedModelName: require('../model-provider-utils').resolveListedModelName,
      fetchJsonWithTimeout: async (url, options) => { const response = await fetch(url, options); if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); } });
    vm.runInContext(electronSource.slice(electronSource.indexOf('function openAiModelsUrl'), electronSource.indexOf('async function testConfiguredModel')), context);
    const listed = await context.listConfiguredModels({ provider: 'openai-compatible', endpoint: baseUrl, model: 'fixture-embedding' });
    assert.equal(listed.resolvedModel, 'fixture-embedding');
    assert.equal(requests.at(-1).url, '/compatible-mode/v1/models');
    assert.equal(requests.at(-1).authorization, 'Bearer fixture-key');
    const embedding = await database.createEmbedding('synthetic fixture memory');
    assert.deepEqual(embedding.vector, [1, 0.5, -1]);
    assert.equal(requests.at(-1).authorization, 'Bearer fixture-key');
    assert.equal(requests.at(-1).url, '/compatible-mode/v1/embeddings');
    assert.equal(requests.at(-1).body.input, 'synthetic fixture memory');
    const text = await database.chatCompletion({ provider: 'openai-compatible', baseUrl, model: 'fixture-chat', apiKey: 'fixture-chat-key', prompt: 'synthetic prompt' });
    assert.equal(text, 'fixture response'); assert.equal(requests.at(-1).url, '/compatible-mode/v1/chat/completions');
    malformed = true; await assert.rejects(database.createEmbedding('invalid vector fixture'), /invalid embedding/);
    malformed = false; fail = true; await assert.rejects(database.createEmbedding('rejection fixture'), /401/);
    await assert.rejects(database.chatCompletion({ provider: 'openai-compatible', baseUrl, model: 'fixture-chat', prompt: 'rejection fixture' }), /401/);
    assert.equal((await database.getSettings())['innerlife.enabled'], false);
  } finally {
    database.close(); await new Promise(resolve => server.close(resolve)); delete process.env.CLARACORE_FIXTURE_EMBED_KEY;
    fs.rmSync(temp, { recursive: true, force: true });
  }
  console.log('OpenAI-compatible settings: custom prefixes, embedding/chat wire format, environment key, rejection and malformed-vector fidelity passed using local fixtures only.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
