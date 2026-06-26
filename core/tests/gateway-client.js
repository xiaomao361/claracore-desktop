const { spawn } = require("child_process");
const path = require("path");

function parseTextResult(response) {
  const text = response?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Missing text result: ${JSON.stringify(response)}`);
  return JSON.parse(text);
}

function createGatewayClient(dataRoot, options = {}) {
  const command = options.command || process.execPath;
  const args = options.args || [path.join(__dirname, "..", "gateway", "mcp-server.js")];
  const child = spawn(command, args, {
    cwd: path.resolve(__dirname, "..", ".."),
    env: {
      ...process.env,
      ...(options.env || {}),
      CLARACORE_DESKTOP_DATA_DIR: dataRoot
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nextId = 1;
  let buffer = "";
  const pending = new Map();
  let stderr = "";

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message);
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.on("exit", (code) => {
    for (const request of pending.values()) {
      request.reject(new Error(`Gateway exited with ${code}: ${stderr}`));
    }
    pending.clear();
  });

  function request(method, params = {}) {
    const id = nextId;
    nextId += 1;
    const payload = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify(payload)}\n`);
    });
  }

  return {
    request,
    callTool(name, args = {}) {
      return request("tools/call", {
        name,
        arguments: args
      });
    },
    async close() {
      child.stdin.end();
      child.kill();
    }
  };
}

module.exports = {
  createGatewayClient,
  parseTextResult
};
