const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-gateway-trace-retention-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  try {
    await database.recordGatewayTrace({ agentId: "warmup", toolName: "warmup" });
    await database.exec("DELETE FROM gateway_traces;");
    let traceQueryCalls = 0;
    const query = database.query.bind(database);
    database.query = async (sql) => {
      traceQueryCalls += 1;
      return query(sql);
    };
    const recorded = await database.recordGatewayTrace({
      agentId: "trace-smoke",
      toolName: "large_request",
      request: { body: "x".repeat(40 * 1024) }
    });
    assert.strictEqual(traceQueryCalls, 0, "Trace insert performed an unnecessary readback query.");
    assert.strictEqual(recorded.request.previewOnly, true, "Oversized trace request was not replaced with a preview.");
    assert.strictEqual("truncated" in recorded.request, false, "Whole-request replacement must not masquerade as text truncation.");
    assert(Buffer.byteLength(recorded.request.preview, "utf8") <= 8 * 1024, "Trace request preview exceeded its UTF-8 byte bound.");
    assert(Buffer.byteLength(JSON.stringify(recorded.request), "utf8") <= 16 * 1024, "Bounded trace request exceeded its storage contract.");
    const cjkRecorded = await database.recordGatewayTrace({
      agentId: "trace-smoke",
      toolName: "large_cjk_request",
      request: { body: "你".repeat(20 * 1024) }
    });
    assert.strictEqual(cjkRecorded.request.previewOnly, true);
    assert(Buffer.byteLength(cjkRecorded.request.preview, "utf8") <= 8 * 1024, "CJK trace preview used character rather than byte bounds.");
    const circularRequest = {};
    circularRequest.self = circularRequest;
    const unserializable = await database.recordGatewayTrace({
      agentId: "trace-smoke",
      toolName: "circular_request",
      request: circularRequest
    });
    assert.strictEqual(unserializable.request.serializationFailed, true);
    assert.strictEqual("truncated" in unserializable.request, false, "Serialization failure must not be reported as truncation.");
    database.query = query;
    await database.exec("DELETE FROM gateway_traces;");
    await database.exec(`
      INSERT INTO gateway_traces (id, agent_id, tool_name, status, created_at) VALUES
        ('ok_old_1', 'a', 'read', 'ok', datetime('now', '-50 days')),
        ('ok_old_2', 'a', 'read', 'ok', datetime('now', '-40 days')),
        ('ok_recent_1', 'a', 'read', 'ok', datetime('now', '-5 days')),
        ('ok_recent_2', 'a', 'read', 'ok', datetime('now', '-4 days')),
        ('ok_recent_3', 'a', 'read', 'ok', datetime('now', '-3 days')),
        ('ok_recent_4', 'a', 'read', 'ok', datetime('now', '-2 days')),
        ('ok_recent_5', 'a', 'read', 'ok', datetime('now', '-1 days')),
        ('error_old_1', 'a', 'write', 'error', datetime('now', '-240 days')),
        ('error_old_2', 'a', 'write', 'error', datetime('now', '-230 days')),
        ('error_old_3', 'a', 'write', 'error', datetime('now', '-220 days')),
        ('error_old_4', 'a', 'write', 'error', datetime('now', '-210 days')),
        ('error_recent', 'a', 'write', 'error', datetime('now', '-1 hours'));
    `);
    const statements = [];
    const exec = database.exec.bind(database);
    database.exec = async (sql) => {
      statements.push(sql);
      return exec(sql);
    };
    const result = await database.cleanupGatewayTraces({
      successMaxAgeDays: 30,
      errorMaxAgeDays: 180,
      successMaxRows: 3,
      protectedErrorRows: 2,
      totalMaxRows: 4
    });
    assert.strictEqual(result.deleted, 8);
    assert.deepStrictEqual(result.after, { total: 4, success: 2, error: 2 });
    const remaining = await query("SELECT id FROM gateway_traces ORDER BY id;");
    const remainingIds = remaining.map((row) => row.id);
    assert(remainingIds.includes("error_recent"));
    assert(remainingIds.includes("error_old_4"), "Newest protected historical error was deleted.");
    assert(!statements.some((sql) => /\bVACUUM\b/i.test(sql)), "Routine trace cleanup must not VACUUM.");
    process.stdout.write(`${JSON.stringify({
      suite: "gateway-trace-retention-smoke",
      traceInsertReadQueries: traceQueryCalls,
      requestBounded: recorded.request.previewOnly,
      retention: result,
      remainingIds
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
