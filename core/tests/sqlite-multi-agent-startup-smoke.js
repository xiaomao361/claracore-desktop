const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { createGatewayClient, parseTextResult } = require("./gateway-client");

async function closeClient(client) {
  if (client.child.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      client.child.kill();
      resolve();
    }, 2000);
    client.child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    client.child.stdin.end();
  });
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-sqlite-agent-startup-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  database.close();
  const clients = Array.from({ length: 8 }, (_, index) => createGatewayClient(root, {
    env: {
      CLARACORE_AGENT_ID: `startup-agent-${index + 1}`,
      CLARACORE_CLIENT_ID: "sqlite-startup-smoke"
    }
  }));
  try {
    const results = await Promise.all(clients.map(async (client) =>
      parseTextResult(await client.callTool("claracore_status"))
    ));
    assert.strictEqual(results.length, 8);
    assert(results.every((result) => result.database && result.dataRoot === root));
    process.stdout.write(`${JSON.stringify({
      suite: "sqlite-multi-agent-startup-smoke",
      agents: results.length,
      lockFailures: 0
    }, null, 2)}\n`);
  } finally {
    await Promise.all(clients.map(closeClient));
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
