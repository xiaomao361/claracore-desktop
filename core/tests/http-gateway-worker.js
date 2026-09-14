// Test-only HTTP host. Never launch the Desktop UI or use the daily data root.
const path = require('path');
const runtimeRoot = process.env.CLARACORE_TEST_ASAR || path.resolve(__dirname, '../..');
const runtime = require(path.join(runtimeRoot, 'core/runtime'));
const { createHttpAgentGateway } = require(path.join(runtimeRoot, 'electron/http-agent-gateway'));
const root = process.env.CLARACORE_DESKTOP_DATA_DIR;
if (!root || process.env.CLARACORE_DESKTOP_TEST_INSTANCE !== '1') throw new Error('Isolated test root required');
const app = { isPackaged: Boolean(process.env.CLARACORE_TEST_ASAR), getPath: name => name === 'userData' ? root : path.join(root, name) };
const gateway = createHttpAgentGateway({ app, port: 0,
  ensureProductCore: () => runtime.ensureProductCore(app),
  getRuntimeSnapshot: () => runtime.buildProductSnapshot(app) });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await gateway.stop();
  await runtime.resetCachedDatabase();
  process.exit(0);
}
process.stdin.resume();
process.stdin.on('end', close);
process.on('SIGTERM', close);
process.on('disconnect', close);
gateway.start().then(() => {
  const endpoint = gateway.buildEndpoints().find(x => x.id === 'streamable-http-mcp');
  process.send({ url: endpoint.url, authorization: endpoint.authHeader.replace(/^Authorization:\s*/, '') });
}).catch(error => { console.error(error); process.exit(1); });
