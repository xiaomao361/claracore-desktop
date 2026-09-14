const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createGatewayClient, parseTextResult } = require('./gateway-client');
const { initializeProductDatabase } = require('../db/database');
async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claracore-http-handoff-'));
  const a = createGatewayClient(root, { env: { CLARACORE_AGENT_ID: 'owner-a' } });
  const b = createGatewayClient(root, { env: { CLARACORE_AGENT_ID: 'owner-b' } });
  let db;
  const call = async (client, name, args) => parseTextResult(await client.callTool(name, args));
  try {
    const lineA = await call(a, 'shared_line_update', { summary: 'A position' });
    const lineB = await call(b, 'shared_line_update', { summary: 'B position' });
    await call(b, 'shared_line_activate', { lineId: lineB.lineId });
    const handoff = await call(a, 'shared_line_handoff_create', { objective: 'A handoff' });
    assert.equal(handoff.handoff.lineId, lineA.lineId);
    assert.equal(handoff.sharedLine.lineId, lineA.lineId);
    const own = await call(a, 'shared_line_get', { detail: 'full' });
    assert(own.handoffs.some(x => x.id === handoff.handoff.id));
    const other = await call(b, 'shared_line_get', { detail: 'full' });
    assert(!other.handoffs.some(x => x.id === handoff.handoff.id));
    await call(a, 'shared_line_create', { title: 'A second line' });
    db = await initializeProductDatabase(path.join(root, 'claracore.db'));
    const before = (await db.query('SELECT COUNT(*) AS n FROM continuity_handoffs;'))[0].n;
    await assert.rejects(a.callTool('shared_line_handoff_create', { objective: 'Must not be written' }), /SHARED_LINE_ID_REQUIRED/);
    assert.equal((await db.query('SELECT COUNT(*) AS n FROM continuity_handoffs;'))[0].n, before);
    const explicit = await call(a, 'shared_line_handoff_create', { lineId: lineB.lineId, objective: 'Explicit cross-line handoff' });
    assert.equal(explicit.handoff.lineId, lineB.lineId);
    console.log(JSON.stringify({ suite: 'http-handoff-routing', callerLine: true, ambiguityNoWrite: true, explicitLine: true, passed: true }));
  } finally {
    await Promise.all([a.close(), b.close()]);
    db?.close(); await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
