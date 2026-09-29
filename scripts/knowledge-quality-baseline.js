const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { saveKnowledgeRootPreference } = require('../core/knowledge/preferences');
const { searchKnowledge, rebuildKnowledgeSearchIndex, snapshot } = require('../core/knowledge/search');
const { stateDirectory } = require('../core/knowledge/storage');

// Explicit corpus and case paths; never write the selected corpus or live cache.
async function main() {
  const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
  const root = option('--root'), caseFile = option('--cases');
  if (!root || !caseFile) throw new Error('Required: --root CORPUS --cases JSON. Optional: --model OLLAMA_MODEL --seed-index JSON');
  const cases = JSON.parse(fs.readFileSync(caseFile, 'utf8'));
  if (!Array.isArray(cases) || !cases.length || cases.length > 100) throw new Error('Provide 1..100 cases');
  const plan = snapshot(root);
  const references = new Set(plan.sections.map(section => section.reference));
  for (const test of cases) {
    if (!test.id || !test.query || !['exact', 'semantic', 'hybrid'].includes(test.mode)
      || !Array.isArray(test.expected) || test.expected.some(ref => !references.has(ref))) throw new Error(`Invalid case or missing expected section: ${test.id}`);
  }
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'knowledge-quality-'));
  const app = { getPath: () => temporary };
  const settings = { 'memory.embedding.provider': 'ollama', 'memory.embedding.model': option('--model') || '' };
  try {
    await saveKnowledgeRootPreference(app, root);
    let build = null;
    if (cases.some(test => test.mode !== 'exact')) {
      if (!settings['memory.embedding.model']) throw new Error('Semantic evaluation requires explicit --model (installed local Ollama only)');
      if (option('--seed-index')) {
        const directory = stateDirectory(app, root); fs.mkdirSync(directory, { recursive: true });
        fs.copyFileSync(option('--seed-index'), path.join(directory, 'semantic.json'));
      }
      do { build = await rebuildKnowledgeSearchIndex(app, settings, { batchSize: 50 }); } while (build.status === 'building');
    }
    const results = [];
    for (const test of cases) {
      const start = performance.now();
      try {
        const result = await searchKnowledge(app, { query: test.query, mode: test.mode, textMatch: test.textMatch || 'folded', limit: 3 }, settings);
        const matches = result.items.map(item => item.reference);
        const passed = ['ok', 'no_results'].includes(result.status) && (test.expected.length
          ? test.expected.some(ref => matches.includes(ref)) : result.total === 0);
        results.push({ id: test.id, mode: test.mode, status: result.status, passed, durationMs: Math.round(performance.now() - start), matches });
      } catch (error) { results.push({ id: test.id, mode: test.mode, status: 'failed', code: error.code || 'evaluation_failed', passed: false, durationMs: Math.round(performance.now() - start) }); }
    }
    if (snapshot(root).signature !== plan.signature) throw new Error('Corpus changed during evaluation; results are not comparable');
    const report = { version: require('../package.json').version, corpusSignature: plan.signature, documents: plan.documents.length,
      sections: plan.sections.length, model: build?.model || null, cases: results.length, passed: results.filter(row => row.passed).length,
      realCorpusWrites: 0, liveIndexWrites: 0, results };
    console.log(JSON.stringify(report, null, 2));
    if (report.passed !== report.cases) process.exitCode = 1;
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error.code || 'evaluation_failed', error.message); process.exitCode = 1; });
