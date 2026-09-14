const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { initializeProductDatabase } = require('../db/database');
const { sqlString } = require('../db/helpers');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'embedding-coverage-'));
  const db = await initializeProductDatabase(path.join(root, 'db.sqlite'));
  try {
    await db.updateSettings({ 'memory.embedding.provider': 'ollama', 'memory.embedding.model': 'bge-m3:latest' });
    const memories = {};
    for (const name of ['old', 'current', 'restricted', 'archived', 'failed', 'pending']) {
      const m = await db.createMemory({ title: name, body: 'Coverage boundary ' + name });
      memories[name] = m.id;
      await db.exec(`UPDATE memory_embeddings SET provider='ollama', model=${sqlString(name === 'current' ? 'bge-m3:latest' : 'bge-m3')}, status=${sqlString(['failed', 'pending'].includes(name) ? name : 'ready')}, dimension=2, vector_json='[1,0]' WHERE memory_id=${sqlString(m.id)};`);
    }
    await db.exec(`UPDATE memories SET sensitivity='restricted' WHERE id=${sqlString(memories.restricted)}; UPDATE memories SET status='archived' WHERE id=${sqlString(memories.archived)};`);
    const { operationalStatus } = require('../runtime/operational-status');
    await db.updateSettings({ 'memory.embedding.dimension': 2 });
    const status = await operationalStatus(db);
    assert.equal(status.vectors.total, 4);
    assert.equal(status.vectors.ready, 1);
    assert.equal(status.vectors.failed, 1);
    assert.equal(status.vectors.lastSearch, null);
    assert.equal(status.backup.event, null);
    await db.recordRuntimeEvent({source:'backup',message:'Automatic backup did not complete',level:'error',metadata:{stage:'mirror'}});
    await db.recordRuntimeEvent({source:'backup',message:'Backup deleted',metadata:{}});
    assert.equal((await operationalStatus(db)).backup.event.stage,'mirror','Manual backup deletion must not hide automatic failure');
    assert.deepEqual(new Set(await db.pendingEmbeddingMemoryIds(20)), new Set([memories.old, memories.pending]));
    db.createEmbedding = async () => ({provider:'ollama', model:'bge-m3:latest', vector:[1,0]});
    const repaired = await db.processPendingEmbeddings(20);
    assert.equal(repaired.processed, 2);
    assert.deepEqual(await db.pendingEmbeddingMemoryIds(20), []);
    db.createEmbedding = async () => { throw new Error('fixture model offline'); };
    const fallback = await db.searchMemories('Coverage', 10);
    assert.equal(fallback.mode, 'keyword');
    assert.equal(fallback.vectorSearch.status, 'failed');
    assert.equal((await operationalStatus(db)).vectors.lastSearch.status, 'failed');
    db.createEmbedding = async () => ({provider:'ollama', model:'bge-m3:latest', vector:[1,0]});
    await db.searchMemories('Coverage', 10);
    assert.equal((await operationalStatus(db)).vectors.lastSearch.status, 'ready');
    await db.updateSettings({ 'memory.embedding.provider': 'disabled' });
    assert.deepEqual(await db.pendingEmbeddingMemoryIds(20), []);
    console.log('embedding coverage: mismatch repair, privacy, archived, failed and disabled boundaries passed');
  } finally { db.close(); await fs.rm(root,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1});
