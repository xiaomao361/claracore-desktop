const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
async function main() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../app/views/agent-setup.js'), 'utf8'), context);
  let copied = '';
  const snapshot = { connections: { httpGateway: { ok: true }, agentGuide: { version: 'fixture' },
    httpEndpoints: [{ id: 'streamable-http-mcp', url: 'http://127.0.0.1:50668/mcp', authHeader: 'Authorization: Bearer fixture' }] } };
  const dom = Object.fromEntries(['copyAgentSetup', 'agentSetupStatus', 'agentSetupNotice', 'agentGatewayStatus', 'agentHttpStatus', 'agentGuideStatus', 'agentGuideVersion'].map(x => [x, {}]));
  const view = context.window.createClaraCoreAgentSetupView({ dom, t: x => x, getSnapshot: () => snapshot,
    copyValue: async text => { copied = text; return true; } });
  view.render(); assert.equal(dom.copyAgentSetup.disabled, false);
  assert(await view.copy());
  assert(copied.includes('http://127.0.0.1:50668/mcp'));
  assert(copied.includes('X-ClaraCore-Agent-ID'));
  assert(!/stdio|mcp-server|CLARACORE_TOOL_PROFILE|fallback/i.test(copied));
  snapshot.connections.httpGateway = { ok: false, error: 'Port occupied' };
  view.render(); assert.equal(dom.copyAgentSetup.disabled, true);
  assert.equal(await view.copy(), false, 'A stale endpoint must not be advertised as ready');
  assert.equal(dom.agentGatewayStatus.className, 'agent-access-state is-error');
  console.log(JSON.stringify({ suite: 'agent-setup-contract', httpOnly: true, failureVisible: true, passed: true }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
