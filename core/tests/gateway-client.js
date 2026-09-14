const { spawn } = require('child_process');
const path = require('path');

function parseTextResult(response) {
  const text = response?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Missing text result: ${JSON.stringify(response)}`);
  return JSON.parse(text);
}

function createGatewayClient(dataRoot, options = {}) {
  const env = options.env || {};
  const child = spawn(options.command || process.execPath, [path.join(__dirname, 'http-gateway-worker.js')], {
    cwd: path.resolve(__dirname, '../..'),
    env: { ...process.env, ...env, CLARACORE_DESKTOP_DATA_DIR: dataRoot,
      CLARACORE_DESKTOP_USER_DATA_DIR: dataRoot, CLARACORE_DESKTOP_TEST_INSTANCE: '1' },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });
  let stderr = '', nextId = 1;
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdout.resume();
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('HTTP test host startup timed out')); }, 15000);
    child.once('message', endpoint => { clearTimeout(timer); resolve(endpoint); });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`HTTP test host exited ${code}: ${stderr}`)); });
  });
  ready.catch(() => {});
  async function request(method, params = {}) {
    const endpoint = await ready;
    const response = await fetch(endpoint.url, { method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { Authorization: endpoint.authorization, 'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18',
        'X-ClaraCore-Agent-ID': env.CLARACORE_AGENT_ID || 'http-agent',
        'X-ClaraCore-Client-ID': env.CLARACORE_CLIENT_ID || 'test-client',
        'X-ClaraCore-Conversation-ID': env.CLARACORE_CONVERSATION_ID || '',
        'X-ClaraCore-Tool-Profile': env.CLARACORE_TOOL_PROFILE || 'core' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }) });
    const message = await response.json();
    if (message.error) throw new Error(message.error.message);
    return message;
  }
  return { child, childPid: child.pid, request,
    callTool: (name, args = {}) => request('tools/call', { name, arguments: args }),
    async close() {
      if (child.exitCode !== null) return;
      await new Promise(resolve => {
        const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
        child.stdin.end();
      });
    }
  };
}
module.exports = { createGatewayClient, parseTextResult };
