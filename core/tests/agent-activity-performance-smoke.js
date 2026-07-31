const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { performance } = require("perf_hooks");
const { initializeProductDatabase } = require("../db/database");

const FIXED_NOW = new Date("2026-07-31T04:00:00.000Z");
const TABLE_FINGERPRINTS = [
  ["memories", "id"],
  ["memory_labels", "memory_id, label"],
  ["memory_links", "id"],
  ["innerlife_shares", "id"],
  ["innerlife_share_actions", "id"],
  ["continuity_lines", "id"],
  ["continuity_position_history", "id"],
  ["gateway_traces", "id"]
];

function metric(agentId, values = {}) {
  return {
    agentId,
    newMemories: 0,
    formedConnections: 0,
    confirmedShares: 0,
    sharedLineUpdates: 0,
    gatewayCalls: 0,
    ...values
  };
}

function expectedSummary() {
  const startOfToday = new Date(FIXED_NOW);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfSevenDays = new Date(FIXED_NOW);
  startOfSevenDays.setDate(startOfSevenDays.getDate() - 7);
  const startOfThirtyDays = new Date(FIXED_NOW);
  startOfThirtyDays.setDate(startOfThirtyDays.getDate() - 30);

  assert.strictEqual(startOfToday.toISOString(), "2026-07-30T16:00:00.000Z");
  assert.strictEqual(startOfSevenDays.toISOString(), "2026-07-24T04:00:00.000Z");
  assert.strictEqual(startOfThirtyDays.toISOString(), "2026-07-01T04:00:00.000Z");

  return {
    generatedAt: FIXED_NOW.toISOString(),
    periods: {
      yesterday: {
        start: startOfYesterday.toISOString(),
        end: startOfToday.toISOString(),
        agents: [
          metric("beta", { confirmedShares: 2, gatewayCalls: 2 }),
          metric("alpha", { newMemories: 1, formedConnections: 1, sharedLineUpdates: 1 })
        ]
      },
      today: {
        start: startOfToday.toISOString(),
        end: startOfTomorrow.toISOString(),
        agents: [
          metric("alpha", { formedConnections: 1, confirmedShares: 1, sharedLineUpdates: 1, gatewayCalls: 1 }),
          metric("beta", { newMemories: 1, formedConnections: 1 }),
          metric("codex", { sharedLineUpdates: 1, gatewayCalls: 1 })
        ]
      },
      "7d": {
        start: startOfSevenDays.toISOString(),
        end: FIXED_NOW.toISOString(),
        agents: [
          metric("alpha", {
            newMemories: 2,
            formedConnections: 2,
            confirmedShares: 1,
            sharedLineUpdates: 4,
            gatewayCalls: 1
          }),
          metric("beta", {
            newMemories: 1,
            formedConnections: 2,
            confirmedShares: 2,
            gatewayCalls: 2
          }),
          metric("gamma", {
            newMemories: 1,
            formedConnections: 1,
            confirmedShares: 1,
            gatewayCalls: 1
          }),
          metric("codex", { sharedLineUpdates: 1, gatewayCalls: 1 })
        ]
      },
      "30d": {
        start: startOfThirtyDays.toISOString(),
        end: FIXED_NOW.toISOString(),
        agents: [
          metric("alpha", {
            newMemories: 3,
            formedConnections: 2,
            confirmedShares: 1,
            sharedLineUpdates: 6,
            gatewayCalls: 2
          }),
          metric("beta", {
            newMemories: 2,
            formedConnections: 2,
            confirmedShares: 2,
            gatewayCalls: 2
          }),
          metric("gamma", {
            newMemories: 1,
            formedConnections: 2,
            confirmedShares: 1,
            gatewayCalls: 1
          }),
          metric("codex", { sharedLineUpdates: 1, gatewayCalls: 1 })
        ]
      }
    }
  };
}

async function seedActivityFixture(database) {
  await database.exec(`
    INSERT INTO agents (id, label, role, status)
    VALUES
      ('alpha', 'Alpha', 'agent', 'active'),
      ('beta', 'Beta', 'agent', 'active'),
      ('gamma', 'Gamma', 'agent', 'active');

    INSERT INTO memories (id, title, body, status, created_at, updated_at)
    VALUES
      ('m-alpha-yesterday', 'A yesterday', 'A yesterday', 'active', '2026-07-29T16:00:00.000Z', '2026-07-29T16:00:00.000Z'),
      ('m-alpha-future', 'A future', 'A future', 'active', '2026-07-31T16:00:00.000Z', '2026-07-31T16:00:00.000Z'),
      ('m-alpha-before-seven', 'A before seven', 'A before seven', 'active', '2026-07-24T03:59:59.000Z', '2026-07-24T03:59:59.000Z'),
      ('m-alpha-before-thirty', 'A before thirty', 'A before thirty', 'active', '2026-07-01T03:59:59.000Z', '2026-07-01T03:59:59.000Z'),
      ('m-alpha-inactive', 'A inactive', 'A inactive', 'archived', '2026-07-30T16:00:00.000Z', '2026-07-30T16:00:00.000Z'),
      ('m-beta-today', 'B today', 'B today', 'active', '2026-07-30T16:00:00.000Z', '2026-07-30T16:00:00.000Z'),
      ('m-beta-thirty', 'B thirty', 'B thirty', 'active', '2026-07-01T04:00:00.000Z', '2026-07-01T04:00:00.000Z'),
      ('m-beta-deleted', 'B deleted', 'B deleted', 'deleted', '2026-07-30T16:00:00.000Z', '2026-07-30T16:00:00.000Z'),
      ('m-gamma-seven', 'G seven', 'G seven', 'active', '2026-07-24T04:00:00.000Z', '2026-07-24T04:00:00.000Z'),
      ('m-unlabeled', 'Unlabeled', 'Unlabeled', 'active', '2026-07-30T16:00:00.000Z', '2026-07-30T16:00:00.000Z');

    INSERT INTO memory_labels (memory_id, label)
    VALUES
      ('m-alpha-yesterday', 'agent-id:alpha'),
      ('m-alpha-yesterday', 'agent:alpha'),
      ('m-alpha-future', 'agent-id:alpha'),
      ('m-alpha-before-seven', 'agent-id:alpha'),
      ('m-alpha-before-thirty', 'agent-id:alpha'),
      ('m-alpha-inactive', 'agent-id:alpha'),
      ('m-beta-today', 'agent-id:beta'),
      ('m-beta-thirty', 'agent-id:beta'),
      ('m-beta-deleted', 'agent-id:beta'),
      ('m-gamma-seven', 'agent-id:gamma');

    INSERT INTO memory_links (id, from_memory_id, to_memory_id, kind, created_at, updated_at)
    VALUES
      ('link-today', 'm-alpha-yesterday', 'm-beta-deleted', 'related', '2026-07-30T16:00:00.000Z', '2026-07-30T16:00:00.000Z'),
      ('link-yesterday', 'm-alpha-yesterday', 'm-alpha-future', 'related', '2026-07-29T16:00:00.000Z', '2026-07-29T16:00:00.000Z'),
      ('link-future', 'm-beta-today', 'm-gamma-seven', 'related', '2026-07-31T16:00:00.000Z', '2026-07-31T16:00:00.000Z'),
      ('link-thirty', 'm-gamma-seven', 'm-unlabeled', 'related', '2026-07-01T04:00:00.000Z', '2026-07-01T04:00:00.000Z'),
      ('link-before-thirty', 'm-alpha-yesterday', 'm-beta-today', 'related', '2026-07-01T03:59:59.000Z', '2026-07-01T03:59:59.000Z');

    INSERT INTO innerlife_shares (id, agent_id, status, body, created_at, updated_at)
    VALUES
      ('share-alpha', 'alpha', 'used', 'Alpha share', '2026-07-30T16:00:00.000Z', '2026-07-30T16:00:00.000Z'),
      ('share-beta-one', 'beta', 'used', 'Beta one', '2026-07-29T16:00:00.000Z', '2026-07-29T16:00:00.000Z'),
      ('share-beta-two', 'beta', 'used', 'Beta two', '2026-07-29T16:00:00.000Z', '2026-07-29T16:00:00.000Z'),
      ('share-gamma', 'gamma', 'used', 'Gamma share', '2026-07-31T16:00:00.000Z', '2026-07-31T16:00:00.000Z'),
      ('share-ignored', 'alpha', 'pending', 'Ignored share', '2026-07-30T16:00:00.000Z', '2026-07-30T16:00:00.000Z');

    INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, metadata_json, created_at)
    VALUES
      ('action-alpha-one', 'share-alpha', 'alpha', 'used', '{"deliveryEvidence":{"conversationId":"alpha-1","responseExcerpt":"ok","sharedAt":"2026-07-30T16:00:00.000Z"}}', '2026-07-30T16:00:00.000Z'),
      ('action-alpha-two', 'share-alpha', 'alpha', 'used', '{"deliveryEvidence":{"conversationId":"alpha-2","responseExcerpt":"ok","sharedAt":"2026-07-30T16:01:00.000Z"}}', '2026-07-30T16:01:00.000Z'),
      ('action-beta-one', 'share-beta-one', 'beta', 'used', '{"deliveryEvidence":{"conversationId":"beta-1","responseExcerpt":"ok","sharedAt":"2026-07-29T16:00:00.000Z"}}', '2026-07-29T16:00:00.000Z'),
      ('action-beta-two-valid', 'share-beta-two', 'beta', 'used', '{"deliveryEvidence":{"conversationId":"beta-2","responseExcerpt":"ok","sharedAt":"2026-07-29T16:00:00.000Z"}}', '2026-07-29T16:00:00.000Z'),
      ('action-beta-two-incomplete', 'share-beta-two', 'beta', 'used', '{"deliveryEvidence":{"conversationId":"beta-2","sharedAt":"2026-07-30T16:00:00.000Z"}}', '2026-07-30T16:00:00.000Z'),
      ('action-gamma', 'share-gamma', 'gamma', 'used', '{"deliveryEvidence":{"conversationId":"gamma","responseExcerpt":"ok","sharedAt":"2026-07-31T16:00:00.000Z"}}', '2026-07-31T16:00:00.000Z'),
      ('action-ignored', 'share-ignored', 'alpha', 'deferred', '{"deliveryEvidence":{"conversationId":"ignored","responseExcerpt":"ok","sharedAt":"2026-07-30T16:00:00.000Z"}}', '2026-07-30T16:00:00.000Z');

    INSERT INTO continuity_lines (id, agent_id, title, status)
    VALUES
      ('line-alpha', 'alpha', 'Alpha line', 'active'),
      ('line-empty-agent', '', 'Fallback line', 'active');

    INSERT INTO continuity_position_history (id, line_id, position_id, summary, created_at)
    VALUES
      ('history-alpha-yesterday', 'line-alpha', 'position-alpha', 'Yesterday', '2026-07-29T16:00:00.000Z'),
      ('history-alpha-today', 'line-alpha', 'position-alpha', 'Today', '2026-07-30T16:00:00.000Z'),
      ('history-alpha-future', 'line-alpha', 'position-alpha', 'Future', '2026-07-31T16:00:00.000Z'),
      ('history-alpha-seven', 'line-alpha', 'position-alpha', 'Seven', '2026-07-24T04:00:00.000Z'),
      ('history-alpha-before-seven', 'line-alpha', 'position-alpha', 'Before seven', '2026-07-24T03:59:59.000Z'),
      ('history-alpha-thirty', 'line-alpha', 'position-alpha', 'Thirty', '2026-07-01T04:00:00.000Z'),
      ('history-alpha-before-thirty', 'line-alpha', 'position-alpha', 'Before thirty', '2026-07-01T03:59:59.000Z'),
      ('history-empty-today', 'line-empty-agent', 'position-empty', 'Today fallback', '2026-07-30T16:00:00.000Z');

    INSERT INTO gateway_traces (id, agent_id, tool_name, status, created_at)
    VALUES
      ('trace-alpha-today', 'alpha', 'gateway_context', 'ok', '2026-07-30T16:00:00.000Z'),
      ('trace-alpha-before-seven', 'alpha', 'gateway_context', 'ok', '2026-07-24T03:59:59.000Z'),
      ('trace-beta-yesterday-one', 'beta', 'gateway_context', 'ok', '2026-07-29T16:00:00.000Z'),
      ('trace-beta-yesterday-two', 'beta', 'memoria_search', 'ok', '2026-07-29T17:00:00.000Z'),
      ('trace-gamma-future', 'gamma', 'gateway_context', 'ok', '2026-07-31T16:00:00.000Z'),
      ('trace-empty-today', '', 'gateway_context', 'ok', '2026-07-30T16:00:00.000Z');
  `);
}

async function dataFingerprint(query) {
  const fingerprint = {};
  for (const [table, orderBy] of TABLE_FINGERPRINTS) {
    fingerprint[table] = await query(`SELECT * FROM ${table} ORDER BY ${orderBy};`);
  }
  return fingerprint;
}

function percentile95(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] || 0;
}

async function main() {
  assert.strictEqual(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    "Asia/Shanghai",
    "Run this smoke with TZ=Asia/Shanghai so calendar-day boundaries stay deterministic."
  );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-agent-activity-performance-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  try {
    await seedActivityFixture(database);
    const expected = expectedSummary();
    const rawQuery = database.query.bind(database);
    let queryCalls = 0;
    let statements = [];
    database.query = async (sql) => {
      queryCalls += 1;
      statements.push(sql);
      return rawQuery(sql);
    };

    const fingerprintBeforeCold = await dataFingerprint(rawQuery);
    const coldResult = await database.getAgentActivitySummary({ now: FIXED_NOW });
    const coldQueryCalls = queryCalls;
    const fingerprintAfterCold = await dataFingerprint(rawQuery);
    assert.deepStrictEqual(coldResult, expected);
    assert.deepStrictEqual(fingerprintAfterCold, fingerprintBeforeCold, "Cold activity summary changed source data.");
    assert(coldQueryCalls >= 5 && coldQueryCalls <= 6, `Cold summary used ${coldQueryCalls} SQL queries instead of at most 6.`);
    const activityStatements = statements.filter((sql) => !sql.trimStart().startsWith("PRAGMA"));
    assert.strictEqual(activityStatements.length, 5, "Cold summary must issue exactly five source queries.");
    for (const sourcePattern of [
      /\bFROM memories m\b/,
      /\bFROM memory_links k\b/,
      /\bFROM innerlife_share_actions a\b/,
      /\bFROM continuity_position_history h\b/,
      /\bFROM gateway_traces\b/
    ]) {
      assert.strictEqual(
        activityStatements.filter((sql) => sourcePattern.test(sql)).length,
        1,
        `Cold summary did not scan ${sourcePattern} exactly once.`
      );
    }

    const durationsMs = [];
    const samples = 20;
    queryCalls = 0;
    statements = [];
    for (let index = 0; index < samples; index += 1) {
      const startedAt = performance.now();
      const result = await database.getAgentActivitySummary({ now: FIXED_NOW });
      durationsMs.push(performance.now() - startedAt);
      assert.deepStrictEqual(result, expected);
    }
    const warmQueryCalls = queryCalls;
    const p95Ms = percentile95(durationsMs);
    const fingerprintAfter = await dataFingerprint(rawQuery);

    assert.strictEqual(warmQueryCalls, samples * 5, "Every warm Home activity summary must use exactly 5 SQL queries.");
    assert(p95Ms <= 100, `Home activity summary p95 exceeded 100 ms: ${p95Ms.toFixed(2)} ms.`);
    assert.deepStrictEqual(fingerprintAfter, fingerprintBeforeCold, "Warm activity summary changed source data.");

    console.log(JSON.stringify({
      suite: "agent-activity-performance-smoke",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      coldQueryCalls,
      warmQueriesPerSummary: warmQueryCalls / samples,
      samples,
      p95Ms: Number(p95Ms.toFixed(2)),
      sourceFingerprint: "unchanged",
      boundaryCoverage: {
        halfOpenCalendarDays: "passed",
        rollingFutureRows: "preserved",
        sevenAndThirtyDayEdges: "passed",
        labelAndShareDeduplication: "passed",
        emptyAgentFallback: "passed",
        totalThenAgentSort: "passed"
      }
    }, null, 2));
  } finally {
    database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
