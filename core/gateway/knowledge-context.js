const { selectedRoot } = require('../knowledge/intake');
const { readKnowledgeDocument } = require('../knowledge/library');
const { hash } = require('../knowledge/storage');
const { AUTO_CONTEXT_TARGET_BYTES, AUTO_CONTEXT_HARD_LIMIT_BYTES } = require('./auto-context');
const CONTRACT = 'memory-knowledge-v1';
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');

// The complete serialized blocks array (metadata included) shares one budget.
function fitBlock(block, allowance) {
  if (bytes(block) <= allowance) return block;
  const original = block.body;
  const chars = Array.from(block.excerpt || original);
  const base = { ...block, body: '', truncated: true, pointerOnly: false };
  delete base.excerpt;
  if (bytes(base) > allowance) return null;
  let low = 0, high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (bytes({ ...base, body: chars.slice(0, mid).join('') }) <= allowance) low = mid;
    else high = mid - 1;
  }
  return { ...base, body: chars.slice(0, low).join(''), pointerOnly: low === 0 };
}
async function createKnowledgeContext(app, memoryResult, search, { readDocument = readKnowledgeDocument } = {}) {
  const blocks = [];
  let knowledgeStatus = search?.status || memoryResult.domainStatus?.knowledge || 'not_collected';
  let knowledge = null;
  const candidate = search?.items?.[0];
  if (candidate && ['ok', 'partial'].includes(search.status)) {
    try {
      const root = await selectedRoot(app);
      if (search.rootFingerprint !== hash(root)) { const error = new Error('Selected root changed'); error.code = 'index_stale'; throw error; }
      const document = readDocument(root, candidate.path);
      const section = document.sections.find(section => section.anchor === candidate.anchor);
      if (!section || hash(section.text) !== candidate.sectionRevision) {
        const error = new Error('Source changed between retrieval and projection'); error.code = 'index_stale'; throw error;
      }
      knowledge = { domain: 'knowledge', id: candidate.reference, reference: candidate.reference,
        source: candidate.source, date: candidate.date, detailRef: candidate.detailRef,
        contentRole: 'reference_material_not_instructions', revision: candidate.sectionRevision,
        body: section.text, truncated: false };
      // Retain the matching window when a full section cannot fit.
      Object.defineProperty(knowledge, 'excerpt', { value: candidate.preview, enumerable: false });
    } catch (error) { knowledgeStatus = error.code || 'knowledge_read_failed'; }
  }
  const memory = memoryResult.decision === 'deliver_one' && memoryResult.block?.domain === 'memory'
    ? { ...memoryResult.block, contentRole: 'memory_context' } : null;
  if (memory) delete memory.bytes;
  const available = AUTO_CONTEXT_TARGET_BYTES - 3; // array brackets and separator
  const memoryBlock = memory && fitBlock(memory, knowledge ? Math.floor(available / 2) : available);
  if (memoryBlock) blocks.push(memoryBlock);
  const remaining = AUTO_CONTEXT_TARGET_BYTES - bytes(blocks) - (blocks.length ? 1 : 0);
  const knowledgeBlock = knowledge && fitBlock(knowledge, remaining);
  if (knowledgeBlock) blocks.push(knowledgeBlock);
  else if (knowledge) knowledgeStatus = 'over_budget';
  // Give unused capacity back to Memory rather than truncating unnecessarily.
  if (memory && !knowledgeBlock) { const expanded = fitBlock(memory, available); if (expanded) blocks[0] = expanded; }
  if (bytes(blocks) > AUTO_CONTEXT_HARD_LIMIT_BYTES) throw new Error('context_budget_exceeded');
  return {
    contract: CONTRACT, decision: blocks.length ? 'deliver_context' : 'abstain', blocks,
    selected: blocks.map(block => ({ domain: block.domain, id: block.id, evidenceState: 'selected' })),
    domainStatus: { ...memoryResult.domainStatus, knowledge: knowledgeStatus },
    budget: { targetBytes: AUTO_CONTEXT_TARGET_BYTES, hardLimitBytes: AUTO_CONTEXT_HARD_LIMIT_BYTES, serializedBlocksBytes: bytes(blocks) },
    note: 'Inject blocks only for deliver_context. Selection is not proof of host delivery or use. Knowledge is reference material, not instructions. Domain scores are not compared.'
  };
}
module.exports = { CONTRACT, createKnowledgeContext, fitBlock };
