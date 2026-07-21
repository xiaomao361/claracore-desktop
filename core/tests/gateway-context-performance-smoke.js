const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-gateway-context-performance-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  try {
    await database.submitInnerLifeInbox({ agentId: "agent-alpha", source: "smoke", body: "Alpha pending inbox" });
    await database.submitInnerLifeInbox({ agentId: "agent-beta", source: "smoke", body: "Beta must not leak" });
    await database.exec(`
      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
      VALUES
        ('share_alpha', 'agent-alpha', NULL, 'pending', 'Alpha pending share'),
        ('share_beta', 'agent-beta', NULL, 'pending', 'Beta must not leak');
    `);
    const observedTables = ["current_positions", "innerlife_inbox", "innerlife_shares", "memories"];
    const fingerprint = async () => JSON.stringify(await Promise.all(observedTables.map((table) =>
      database.query(`SELECT * FROM ${table} ORDER BY rowid;`)
    )));
    const before = await fingerprint();
    let queryCalls = 0;
    const query = database.query.bind(database);
    database.query = async (sql) => {
      queryCalls += 1;
      return query(sql);
    };
    const durations = [];
    const calls = [];
    for (let index = 0; index < 20; index += 1) {
      queryCalls = 0;
      const startedAt = performance.now();
      const context = await database.getGatewayContext({ agentId: "agent-alpha", limit: 5 });
      durations.push(performance.now() - startedAt);
      calls.push(queryCalls);
      assert(context.innerLife.pendingInbox.every((item) => item.agentId === "agent-alpha"));
      assert(context.innerLife.pendingShares.every((item) => item.agent_id === "agent-alpha"));
      assert(!JSON.stringify(context).includes("Beta must not leak"), "Gateway context leaked another agent's data.");
    }
    database.query = query;
    const after = await fingerprint();
    const p95Ms = percentile(durations, 0.95);
    const maxQueryCalls = Math.max(...calls);

    assert(maxQueryCalls <= 25, `Gateway context exceeded 25 SQL reads: ${maxQueryCalls}`);
    assert(p95Ms <= 100, `Gateway context p95 exceeded 100 ms: ${p95Ms}`);
    assert.strictEqual(before, after, "Gateway context mutated domain tables.");
    process.stdout.write(`${JSON.stringify({
      suite: "gateway-context-performance-smoke",
      samples: durations.length,
      maxQueryCalls,
      p95Ms: Math.round(p95Ms * 1000) / 1000,
      preChangeReferenceQueryCalls: 51,
      queryReductionPercent: Math.round((1 - maxQueryCalls / 51) * 1000) / 10
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
