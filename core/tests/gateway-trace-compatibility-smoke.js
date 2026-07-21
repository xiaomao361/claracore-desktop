const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-gateway-trace-compatibility-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  try {
    let compatibilityQueries = 0;
    let compatibilityExecs = 0;
    const query = database.query.bind(database);
    const exec = database.exec.bind(database);
    database.query = async (sql) => {
      if (/PRAGMA table_info\(gateway_traces\)/.test(sql)) compatibilityQueries += 1;
      return query(sql);
    };
    database.exec = async (sql) => {
      if (/idx_gateway_traces_agent_created/.test(sql)) compatibilityExecs += 1;
      return exec(sql);
    };

    await Promise.all(Array.from({ length: 8 }, () => database.ensureGatewayTraceCompatibility()));
    await database.ensureGatewayTraceCompatibility();
    assert.strictEqual(compatibilityQueries, 1, "Concurrent compatibility checks should share one schema read.");
    assert.strictEqual(compatibilityExecs, 1, "Compatibility indexes should be checked once per connection.");

    process.stdout.write(`${JSON.stringify({
      suite: "gateway-trace-compatibility-smoke",
      compatibilityQueries,
      compatibilityExecs
    }, null, 2)}\n`);
  } finally {
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
