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

    assert(maxQueryCalls <= 20, `Gateway context exceeded 20 SQL reads: ${maxQueryCalls}`);
    assert(p95Ms <= 100, `Gateway context p95 exceeded 100 ms: ${p95Ms}`);
    assert.strictEqual(before, after, "Gateway context mutated domain tables.");

    await database.exec(`
      INSERT INTO continuity_lines (id, agent_id, title, status)
      VALUES
        ('line_ambiguous_a', 'agent-ambiguous', 'Ambiguous A', 'active'),
        ('line_ambiguous_b', 'agent-ambiguous', 'Ambiguous B', 'active');
    `);
    const unrelatedReadMethods = [
      "listMemories",
      "getInnerLifeSnapshotLite",
      "listInnerLifeInboxForAgent",
      "listInnerLifeShares",
      "listInnerLifeRecentThoughts"
    ];
    const originalMethods = new Map();
    const unrelatedReads = [];
    for (const method of unrelatedReadMethods) {
      originalMethods.set(method, database[method]);
      database[method] = async (...args) => {
        unrelatedReads.push(method);
        return originalMethods.get(method).apply(database, args);
      };
    }
    let ambiguousQueryCalls = 0;
    database.query = async (sql) => {
      ambiguousQueryCalls += 1;
      return query(sql);
    };
    let ambiguityError = null;
    try {
      await database.getGatewayContext({ agentId: "agent-ambiguous", limit: 5 });
    } catch (error) {
      ambiguityError = error;
    } finally {
      database.query = query;
      for (const [method, original] of originalMethods) database[method] = original;
    }
    assert(ambiguityError?.message.includes("SHARED_LINE_ID_REQUIRED"), "Ambiguous Gateway context did not fail closed.");
    assert(ambiguityError.message.includes("line_ambiguous_a") && ambiguityError.message.includes("line_ambiguous_b"));
    assert.deepStrictEqual(unrelatedReads, [], `Ambiguous Gateway context started unrelated reads: ${unrelatedReads.join(", ")}`);
    assert.strictEqual(ambiguousQueryCalls, 1, `Ambiguous Gateway context should fail after one SQL read: ${ambiguousQueryCalls}`);

    process.stdout.write(`${JSON.stringify({
      suite: "gateway-context-performance-smoke",
      samples: durations.length,
      maxQueryCalls,
      ambiguousQueryCalls,
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
