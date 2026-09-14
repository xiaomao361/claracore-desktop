const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');
const runtimeRoot = process.env.CLARACORE_TEST_ASAR || path.resolve(__dirname, '../..');
const { initializeProductDatabase } = require(path.join(runtimeRoot, 'core/db/database'));
const { createHttpAgentGateway } = require(path.join(runtimeRoot, 'electron/http-agent-gateway'));

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'claracore-modern-mcp-'));
  const database = await initializeProductDatabase(path.join(root, 'claracore.db'));
  const paths = { dataRoot: root, databasePath: database.dbPath, appRoot: path.resolve(__dirname, '../..'), runtimeDir: path.join(root,'runtime'), exportsDir: path.join(root,'exports'), backupsDir: path.join(root,'backups'), logsDir: path.join(root,'logs') };
  const app = { isPackaged: false, getPath: () => root };
  const gateway = createHttpAgentGateway({ app, ensureProductCore: async () => ({ database, paths }), getRuntimeSnapshot: async () => ({}), port: 0 });
  let client;
  try {
    await gateway.start();
    const endpoint = gateway.buildEndpoints().find(x => x.id === 'streamable-http-mcp');
    const headers = { Authorization: endpoint.authHeader.replace(/^Authorization:\s*/, ""), 'X-ClaraCore-Agent-ID': 'codex' };
    const observed = [];
    client = new Client({ name: 'official-sdk-trial', version: '1' }, { versionNegotiation: { mode: 'auto' } });
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url), {
      requestInit: { headers },
      fetch: async (url, init) => { if (init?.body) observed.push(JSON.parse(init.body)); return fetch(url, init); }
    }));
    assert.equal(gateway.status().lastProtocolRequest, null);
    const discovery = await client.discover();
    assert(discovery.supportedVersions.includes('2026-07-28'));
    const list = await client.listTools();
    assert(list.tools.length > 0);
    assert.deepEqual(list.tools.map(x=>x.name), list.tools.map(x=>x.name).sort());
    assert.equal(list.cacheScope, 'private');
    assert.equal(list.ttlMs, 0);
    assert(!observed.some(x=>x.method==='initialize'), 'SDK must actually use modern, not silent legacy fallback');
    const created = await client.callTool({name:'memoria_create',arguments:{title:'SDK fixture',body:'Only an isolated test memory'}});
    assert(!created.isError);
    const listed = await client.callTool({name:'memoria_search',arguments:{query:'isolated',limit:10}});
    assert(listed.content[0].text.includes('Only an isolated test memory'));
    assert.equal((await database.query("SELECT count(*) n FROM memories;"))[0].n,1);
    const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };
    async function raw(method, params = {}, overrides = {}) {
      const body = { jsonrpc:'2.0', id:900, method, params:{ _meta:meta,...params } };
      const response = await fetch(endpoint.url, { method:'POST', headers:{ ...headers, 'Content-Type':'application/json', Accept:'application/json, text/event-stream', 'MCP-Protocol-Version':'2026-07-28', 'Mcp-Method':method, ...(method==='tools/call'?{'Mcp-Name':params.name}:{}), ...overrides }, body:JSON.stringify(body) });
      return { status:response.status, body:await response.json() };
    }
    for (const overrides of [{ 'Mcp-Method':'wrong' }, { 'MCP-Protocol-Version':'2025-06-18' }]) {
      const r=await raw('tools/list',{},overrides); assert.equal(r.status,400); assert.equal(r.body.error.code,-32020);
    }
    const future=await raw('tools/list',{_meta:{...meta,'io.modelcontextprotocol/protocolVersion':'2099-01-01'}},{'MCP-Protocol-Version':'2099-01-01'});
    assert.equal(future.body.error.code,-32022);
    const malformed=await raw('tools/list',{_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}});
    assert.equal(malformed.body.error.code,-32602);
    const unknown=await raw('missing/method');assert.equal(unknown.status,404);assert.equal(unknown.body.error.code,-32601);
    assert.equal((await raw('tools/list',{}, {Authorization:'Bearer wrong'})).status,401);
    assert.equal((await raw('tools/list',{}, {Origin:'https://evil.example'})).status,403);
    const denied = await raw('tools/call',{name:'memoria_create',arguments:{body:'must not write'}},{'Mcp-Name':'memoria_list'});
    assert.equal(denied.body.error.code,-32020);
    assert.equal((await database.query("SELECT count(*) n FROM memories;"))[0].n,1);
    const encoded = await raw('tools/call',{name:'memoria_search',arguments:{query:'isolated'}},{'Mcp-Name':'=?base64?bWVtb3JpYV9zZWFyY2g=?='});
    assert.equal(encoded.body.result.resultType,'complete');
    const missingTool = await raw('tools/call',{name:'not_a_tool',arguments:{}});
    assert.equal(missingTool.body.error.code,-32602);
    const failedCall = await client.callTool({name:'memoria_create',arguments:{body:''}});
    assert.equal(failedCall.isError,true);
    const spoofed = await raw('tools/call',{name:'memoria_search',arguments:{query:'isolated',agentId:'other'},_meta:{...meta,'io.modelcontextprotocol/clientInfo':{name:'other',version:'1'}}});
    assert.equal(spoofed.body.result.isError,undefined);
    const traces = await database.query("SELECT agent_id FROM gateway_traces;");
    assert(traces.length >= 4);
    assert(traces.every(x=>x.agent_id==='codex'), 'Metadata and tool arguments cannot replace HTTP Agent identity');
    const full=await raw('tools/list',{}, {'X-ClaraCore-Tool-Profile':'full'});
    assert(full.body.result.tools.length>list.tools.length);
    const core=await raw('tools/list');assert.equal(core.body.result.tools.length,list.tools.length);
    console.log(JSON.stringify({suite:'modern-mcp-http',sdk:'2.0.0',modernRequests:observed.length,coreTools:list.tools.length,fullTools:full.body.result.tools.length,passed:true}));
    assert.equal(gateway.status().lastProtocolRequest.version, '2026-07-28');
    assert.equal(gateway.status().lastProtocolRequest.agentId, 'codex');
    const lastModern = gateway.status().lastProtocolRequest;
    await raw('tools/call',{name:'memoria_search',arguments:{query:'isolated'}},{Authorization:'Bearer wrong'});
    assert.deepEqual(gateway.status().lastProtocolRequest, lastModern, 'Rejected requests must not change observed protocol');
    await client.close();
    client = new Client({name:'legacy-observation',version:'1'}, {versionNegotiation:{mode:'legacy'}});
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint.url), {requestInit:{headers}}));
    assert.equal(gateway.status().lastProtocolRequest.version, '2026-07-28', 'Handshake alone is not a tool request');
    await client.callTool({name:'memoria_search',arguments:{query:'isolated'}});
    assert.equal(gateway.status().lastProtocolRequest.version, '2025-06-18');

  } finally { await client?.close(); await gateway.stop(); database.close(); await fs.rm(root,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
