const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { jsonSql, sqlString } = require("../db/helpers");
const identityReferenceRegistry = require("../db/agent-identity-references");

const EXPECTED_DIRECT_REFERENCES = [
  "continuity_agent_state.agent_id",
  "continuity_lines.agent_id",
  "gateway_sessions.agent_id",
  "gateway_traces.agent_id",
  "innerlife_daemon_state.agent_id",
  "innerlife_digest_runs.agent_id",
  "innerlife_events.agent_id",
  "innerlife_inbox.agent_id",
  "innerlife_profiles.agent_id",
  "innerlife_sessions.agent_id",
  "innerlife_share_actions.agent_id",
  "innerlife_share_checks.agent_id",
  "innerlife_shares.agent_id",
  "memory_control_events.agent_id",
  "memory_records.source_agent"
].sort();

function sqlIdentifier(value) {
  const identifier = String(value || "");
  if (!/^[a-z][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier in identity merge smoke: ${identifier}`);
  }
  return `"${identifier}"`;
}

function directRegistryEntries(registry) {
  const candidates = [
    registry.DIRECT_AGENT_REFERENCES,
    registry.AGENT_COLUMN_REFERENCES,
    registry.directAgentReferences,
    registry.directReferences,
    registry.AGENT_REFERENCE_REGISTRY?.direct,
    registry.AGENT_IDENTITY_REFERENCES?.direct,
    registry.AGENT_IDENTITY_REFERENCES?.columns
  ];
  const entries = candidates.find(Array.isArray);
  assert.ok(
    entries,
    "agent-identity-references must export DIRECT_AGENT_REFERENCES (or an equivalent supported direct-reference array)."
  );
  return entries.map((entry) => {
    if (typeof entry === "string") return entry;
    assert.ok(entry && entry.table && entry.column, "Every direct Agent reference needs table and column.");
    return `${entry.table}.${entry.column}`;
  }).sort();
}

async function liveDirectReferences(database) {
  const tables = await database.query(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
  `);
  const references = [];
  for (const table of tables) {
    const columns = await database.query(`PRAGMA table_info(${sqlIdentifier(table.name)});`);
    for (const column of columns) {
      if (
        column.name === "agent_id" ||
        column.name === "source_agent" ||
        column.name.endsWith("_agent_id")
      ) {
        references.push(`${table.name}.${column.name}`);
      }
    }
  }
  return references.sort();
}

async function referenceCount(database, reference, agentId) {
  const [table, column] = reference.split(".");
  const rows = await database.query(`
    SELECT COUNT(*) AS count
    FROM ${sqlIdentifier(table)}
    WHERE ${sqlIdentifier(column)} = ${sqlString(agentId)};
  `);
  return Number(rows[0]?.count || 0);
}

async function directReferenceSnapshot(database, sourceAgentId, targetAgentId) {
  const snapshot = {};
  for (const reference of EXPECTED_DIRECT_REFERENCES) {
    snapshot[reference] = {
      source: await referenceCount(database, reference, sourceAgentId),
      target: await referenceCount(database, reference, targetAgentId)
    };
  }
  return snapshot;
}

async function labelsForMemory(database, memoryId) {
  const rows = await database.query(`
    SELECT label
    FROM memory_labels
    WHERE memory_id = ${sqlString(memoryId)}
    ORDER BY label;
  `);
  return rows.map((row) => row.label);
}

async function settingValue(database, key) {
  const rows = await database.query(`
    SELECT value_json
    FROM app_settings
    WHERE key = ${sqlString(key)}
    LIMIT 1;
  `);
  return rows[0] ? JSON.parse(rows[0].value_json) : undefined;
}

async function semanticSnapshot(database, sourceAgentId, targetAgentId) {
  return {
    directReferences: await directReferenceSnapshot(database, sourceAgentId, targetAgentId),
    agents: await database.query("SELECT id, label, role, status, metadata_json FROM agents ORDER BY id;"),
    labels: await database.query("SELECT memory_id, label FROM memory_labels ORDER BY memory_id, label;"),
    labelAliases: await database.query(
      "SELECT alias, canonical_label FROM memory_label_aliases ORDER BY alias, canonical_label;"
    ),
    positions: await database.query(
      "SELECT id, line_id, metadata_json FROM current_positions ORDER BY id;"
    ),
    profiles: await database.query(
      "SELECT agent_id, display_name, enabled, profile_json, state_json FROM innerlife_profiles ORDER BY agent_id;"
    ),
    sessions: await database.query(
      "SELECT id, agent_id, external_session_id, briefing_json, metadata_json FROM innerlife_sessions ORDER BY id;"
    ),
    digests: await database.query(
      "SELECT id, agent_id, input_json, metadata_json FROM innerlife_digest_runs ORDER BY id;"
    ),
    traces: await database.query(
      "SELECT id, agent_id, request_json FROM gateway_traces ORDER BY id;"
    ),
    controllerEvents: await database.query(
      "SELECT id, agent_id FROM memory_control_events ORDER BY id;"
    ),
    memorySources: await database.query(
      "SELECT id, label, metadata_json FROM memory_sources ORDER BY id;"
    ),
    canaryAgentIds: await settingValue(database, "memory.controller.canary_agent_ids"),
    defaultAgentId: await settingValue(database, "agent.default_id")
  };
}

async function seedSameTailFixture(database) {
  const sourceAgentId = "hermes:lara";
  const targetAgentId = "lara";
  const sourceProfile = {
    agentId: sourceAgentId,
    agentTool: "hermes",
    agentName: "lara",
    preserved: "profile-value"
  };
  const sourcePositionMetadata = {
    agentId: sourceAgentId,
    writerAgentId: sourceAgentId,
    preserved: "source-position"
  };
  const targetPositionMetadata = {
    agentId: targetAgentId,
    writerAgentId: sourceAgentId,
    preserved: "target-position"
  };
  const sourceBriefing = {
    agentId: sourceAgentId,
    text: `Agent: ${sourceAgentId}`,
    preserved: "historical-briefing"
  };
  const sourceDigestInput = {
    agentId: sourceAgentId,
    prompt: "historical digest request",
    preserved: "historical-digest"
  };
  const sourceMemoryMetadata = {
    agentId: sourceAgentId,
    agentTool: "hermes",
    preserved: "historical-source"
  };

  await database.exec(`
    INSERT INTO agents (id, label, role, status)
    VALUES
      (${sqlString(sourceAgentId)}, 'Lara via Hermes', 'agent', 'active'),
      (${sqlString(targetAgentId)}, 'Lara', 'agent', 'active')
    ON CONFLICT(id) DO UPDATE SET status = 'active';

    INSERT INTO continuity_agent_state (agent_id, notes)
    VALUES (${sqlString(sourceAgentId)}, 'source state');

    INSERT INTO continuity_lines (id, agent_id, title, status)
    VALUES
      ('line-merge-source', ${sqlString(sourceAgentId)}, 'Source line', 'active'),
      ('line-merge-target', ${sqlString(targetAgentId)}, 'Target line', 'active');

    INSERT INTO current_positions (
      id, line_id, summary, interpretation_status, metadata_json
    ) VALUES
      (
        'position-merge-source',
        'line-merge-source',
        'Source position',
        'confirmed',
        ${jsonSql(sourcePositionMetadata)}
      ),
      (
        'position-merge-target',
        'line-merge-target',
        'Target position',
        'confirmed',
        ${jsonSql(targetPositionMetadata)}
      );

    INSERT INTO innerlife_profiles (
      agent_id, display_name, enabled, profile_json, state_json
    ) VALUES (
      ${sqlString(sourceAgentId)},
      'Lara via Hermes',
      1,
      ${jsonSql(sourceProfile)},
      '{"preserved":"profile-state"}'
    );

    INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
    VALUES (
      'event-merge-source',
      ${sqlString(sourceAgentId)},
      'smoke',
      'Source event',
      'processed',
      '{"preserved":"event-metadata"}'
    );

    INSERT INTO innerlife_inbox (id, agent_id, source, body, status, metadata_json)
    VALUES (
      'inbox-merge-source',
      ${sqlString(sourceAgentId)},
      'smoke',
      'Source inbox',
      'pending',
      '{"preserved":"inbox-metadata"}'
    );

    INSERT INTO innerlife_shares (id, agent_id, status, body)
    VALUES ('share-merge-source', ${sqlString(sourceAgentId)}, 'pending', 'Source share');

    INSERT INTO innerlife_share_actions (
      id, share_id, agent_id, action, reason, metadata_json
    ) VALUES (
      'share-action-merge-source',
      'share-merge-source',
      ${sqlString(sourceAgentId)},
      'deferred',
      'smoke',
      '{"preserved":"share-action-metadata"}'
    );

    INSERT INTO innerlife_digest_runs (
      id, agent_id, mode, status, input_json, summary, metadata_json
    ) VALUES (
      'digest-merge-source',
      ${sqlString(sourceAgentId)},
      'manual',
      'completed',
      ${jsonSql(sourceDigestInput)},
      'Source digest',
      '{"preserved":"digest-metadata"}'
    );

    INSERT INTO innerlife_sessions (
      id, agent_id, external_session_id, status, briefing_json, metadata_json
    ) VALUES
      (
        'session-merge-source',
        ${sqlString(sourceAgentId)},
        'shared-external-session',
        'ended',
        ${jsonSql(sourceBriefing)},
        '{"preserved":"source-session-metadata"}'
      ),
      (
        'session-merge-target',
        ${sqlString(targetAgentId)},
        'shared-external-session',
        'ended',
        '{"agentId":"lara","preserved":"target-briefing"}',
        '{"preserved":"target-session-metadata"}'
      );

    INSERT INTO innerlife_share_checks (
      id, share_id, agent_id, session_id, context, decision, reason, metadata_json
    ) VALUES (
      'share-check-merge-source',
      'share-merge-source',
      ${sqlString(sourceAgentId)},
      'session-merge-source',
      'smoke',
      'defer',
      'smoke',
      '{"preserved":"share-check-metadata"}'
    );

    INSERT INTO innerlife_daemon_state (
      agent_id, status, enabled, last_result, metadata_json
    ) VALUES (
      ${sqlString(sourceAgentId)},
      'enabled',
      1,
      'source daemon',
      '{"preserved":"source-daemon"}'
    );

    INSERT INTO gateway_sessions (id, agent_id, label, status, metadata_json)
    VALUES (
      'gateway-session-merge-source',
      ${sqlString(sourceAgentId)},
      'Source Gateway session',
      'inactive',
      '{"preserved":"gateway-session"}'
    );

    INSERT INTO gateway_traces (
      id, agent_id, client_id, conversation_id, session_id, transport,
      tool_name, status, request_json
    ) VALUES
      (
        'gateway-trace-merge-source',
        ${sqlString(sourceAgentId)},
        'hermes',
        'conversation-source',
        'conversation-source',
        'stdio',
        'identity_merge_smoke',
        'ok',
        ${jsonSql({
          agentId: sourceAgentId,
          agent_id: sourceAgentId,
          preserved: "source-trace"
        })}
      ),
      (
        'gateway-trace-json-only',
        ${sqlString(targetAgentId)},
        'hermes',
        'conversation-json-only',
        'conversation-json-only',
        'stdio',
        'identity_merge_smoke',
        'ok',
        ${jsonSql({
          agentId: sourceAgentId,
          agent_id: sourceAgentId,
          preserved: "json-only-trace"
        })}
      );

    INSERT INTO memory_records (
      id, record_type, title, value_json, source, source_agent, status, metadata_json
    ) VALUES (
      'memory-record-merge-source',
      'smoke',
      'Source structured memory',
      '{"preserved":"record-value"}',
      'smoke',
      ${sqlString(sourceAgentId)},
      'active',
      '{"preserved":"record-metadata"}'
    );

    INSERT INTO memory_sources (id, kind, label, metadata_json)
    VALUES (
      'memory-source-merge-history',
      'manual',
      'Historical source identity',
      ${jsonSql(sourceMemoryMetadata)}
    );

    INSERT INTO memories (id, title, body, source_id)
    VALUES
      (
        'memory-merge-source',
        'Source-owned Memory',
        'Source-owned Memory',
        'memory-source-merge-history'
      ),
      ('memory-merge-target', 'Target-owned Memory', 'Target-owned Memory', NULL),
      ('memory-merge-alias-only', 'Alias-only Memory', 'Alias-only Memory', NULL);

    INSERT INTO memory_labels (memory_id, label)
    VALUES
      ('memory-merge-source', ${sqlString(`agent-id:${sourceAgentId}`)}),
      ('memory-merge-source', 'agent:lara'),
      ('memory-merge-source', 'tool:hermes'),
      ('memory-merge-target', ${sqlString(`agent-id:${targetAgentId}`)}),
      ('memory-merge-target', 'agent:lara'),
      ('memory-merge-alias-only', 'agent:lara');

    UPDATE app_settings
    SET value_json = ${jsonSql([sourceAgentId, targetAgentId, "other-agent", sourceAgentId])}
    WHERE key = 'memory.controller.canary_agent_ids';

    UPDATE app_settings
    SET value_json = ${jsonSql(sourceAgentId)}
    WHERE key = 'agent.default_id';
  `);

  await database.recordMemoryControlEvent({
    id: "memory-controller-merge-source",
    policyVersion: "identity-merge-smoke-v1",
    policyMode: "observe",
    agentId: sourceAgentId,
    stageAAction: "NOOP",
    stageAReason: "identity_merge_smoke",
    resultStatus: "completed"
  });

  return {
    sourceAgentId,
    targetAgentId,
    sourceBriefing,
    sourceDigestInput,
    sourceMemoryMetadata
  };
}

async function assertSameTailMerge(database, fixture) {
  const { sourceAgentId, targetAgentId } = fixture;

  for (const reference of EXPECTED_DIRECT_REFERENCES) {
    assert.strictEqual(
      await referenceCount(database, reference, sourceAgentId),
      0,
      `${reference} retained the source Agent id.`
    );
    assert.ok(
      (await referenceCount(database, reference, targetAgentId)) > 0,
      `${reference} did not migrate to the target Agent id.`
    );
  }

  assert.deepStrictEqual(
    await labelsForMemory(database, "memory-merge-source"),
    ["agent-id:lara", "agent:lara", "tool:hermes"],
    "Same-tail merge damaged source Memory aliases or client provenance."
  );
  assert.deepStrictEqual(
    await labelsForMemory(database, "memory-merge-target"),
    ["agent-id:lara", "agent:lara"],
    "Same-tail merge damaged existing target Memory labels."
  );
  assert.deepStrictEqual(
    await labelsForMemory(database, "memory-merge-alias-only"),
    ["agent:lara"],
    "Same-tail merge deleted an unrelated alias-only label."
  );

  const positions = await database.query(`
    SELECT id, metadata_json
    FROM current_positions
    WHERE id IN ('position-merge-source', 'position-merge-target')
    ORDER BY id;
  `);
  assert.strictEqual(positions.length, 2);
  for (const row of positions) {
    const metadata = JSON.parse(row.metadata_json);
    assert.strictEqual(metadata.agentId, targetAgentId, `${row.id} retained metadata.agentId.`);
    assert.strictEqual(metadata.writerAgentId, targetAgentId, `${row.id} retained metadata.writerAgentId.`);
  }
  assert.strictEqual(JSON.parse(positions[0].metadata_json).preserved, "source-position");
  assert.strictEqual(JSON.parse(positions[1].metadata_json).preserved, "target-position");

  const profiles = await database.query(`
    SELECT agent_id, profile_json
    FROM innerlife_profiles
    WHERE agent_id IN (${sqlString(sourceAgentId)}, ${sqlString(targetAgentId)})
    ORDER BY agent_id;
  `);
  assert.strictEqual(profiles.length, 1, "Source InnerLife profile was not consolidated.");
  assert.strictEqual(profiles[0].agent_id, targetAgentId);
  const profile = JSON.parse(profiles[0].profile_json);
  assert.strictEqual(profile.agentId, targetAgentId, "InnerLife profile JSON retained the source Agent id.");
  assert.strictEqual(profile.preserved, "profile-value");

  const continuityStates = await database.query(`
    SELECT agent_id, notes
    FROM continuity_agent_state
    WHERE agent_id IN (${sqlString(sourceAgentId)}, ${sqlString(targetAgentId)});
  `);
  assert.deepStrictEqual(
    continuityStates.map((row) => ({ ...row })),
    [{ agent_id: targetAgentId, notes: "source state" }],
    "Source-only Continuity Agent state was not moved intact."
  );

  const daemonStates = await database.query(`
    SELECT agent_id, status, enabled, last_result, metadata_json
    FROM innerlife_daemon_state
    WHERE agent_id IN (${sqlString(sourceAgentId)}, ${sqlString(targetAgentId)});
  `);
  assert.deepStrictEqual(
    daemonStates.map((row) => ({ ...row })),
    [{
      agent_id: targetAgentId,
      status: "enabled",
      enabled: 1,
      last_result: "source daemon",
      metadata_json: '{"preserved":"source-daemon"}'
    }],
    "Source-only InnerLife daemon state was not moved intact."
  );

  const traces = await database.query(`
    SELECT id, agent_id, request_json
    FROM gateway_traces
    WHERE id IN ('gateway-trace-merge-source', 'gateway-trace-json-only')
    ORDER BY id;
  `);
  assert.strictEqual(traces.length, 2);
  for (const row of traces) {
    assert.strictEqual(row.agent_id, targetAgentId);
    const request = JSON.parse(row.request_json);
    assert.strictEqual(request.agentId, targetAgentId, `${row.id} retained request.agentId.`);
    assert.ok(!Object.prototype.hasOwnProperty.call(request, "agent_id"), `${row.id} retained request.agent_id.`);
    assert.ok(request.preserved, `${row.id} lost unrelated request JSON.`);
  }

  const canaryAgentIds = await settingValue(database, "memory.controller.canary_agent_ids");
  assert.deepStrictEqual(
    [...canaryAgentIds].sort(),
    ["lara", "other-agent"],
    "Canary Agent ids were not migrated and deduplicated."
  );
  assert.strictEqual(
    await settingValue(database, "agent.default_id"),
    targetAgentId,
    "Default Agent id was not migrated."
  );

  const sessions = await database.query(`
    SELECT id, agent_id, external_session_id, briefing_json
    FROM innerlife_sessions
    WHERE id IN ('session-merge-source', 'session-merge-target')
    ORDER BY id;
  `);
  assert.strictEqual(sessions.length, 2);
  const sourceSession = sessions.find((row) => row.id === "session-merge-source");
  const targetSession = sessions.find((row) => row.id === "session-merge-target");
  assert.strictEqual(sourceSession.agent_id, targetAgentId);
  assert.strictEqual(targetSession.agent_id, targetAgentId);
  assert.strictEqual(sourceSession.external_session_id, "shared-external-session:session-merge-source");
  assert.strictEqual(targetSession.external_session_id, "shared-external-session");
  assert.deepStrictEqual(
    JSON.parse(sourceSession.briefing_json),
    fixture.sourceBriefing,
    "Historical session briefing was rewritten during identity merge."
  );

  const digestRows = await database.query(`
    SELECT input_json
    FROM innerlife_digest_runs
    WHERE id = 'digest-merge-source';
  `);
  assert.deepStrictEqual(
    JSON.parse(digestRows[0].input_json),
    fixture.sourceDigestInput,
    "Historical digest request was rewritten during identity merge."
  );

  const sourceRows = await database.query(`
    SELECT metadata_json
    FROM memory_sources
    WHERE id = 'memory-source-merge-history';
  `);
  assert.deepStrictEqual(
    JSON.parse(sourceRows[0].metadata_json),
    fixture.sourceMemoryMetadata,
    "Historical Memory source provenance was rewritten during identity merge."
  );
}

async function seedDifferentTailFixture(database) {
  const sourceAgentId = "legacy-agent";
  const targetAgentId = "modern-agent";
  await database.exec(`
    INSERT INTO agents (id, label, role, status)
    VALUES (${sqlString(sourceAgentId)}, 'Legacy Agent', 'agent', 'active')
    ON CONFLICT(id) DO UPDATE SET status = 'active';

    INSERT INTO memories (id, title, body)
    VALUES
      ('memory-different-tail-source', 'Different-tail source', 'Different-tail source'),
      ('memory-different-tail-target', 'Different-tail target', 'Different-tail target'),
      ('memory-different-tail-unrelated', 'Different-tail unrelated', 'Different-tail unrelated');

    INSERT INTO memory_labels (memory_id, label)
    VALUES
      ('memory-different-tail-source', ${sqlString(`agent-id:${sourceAgentId}`)}),
      ('memory-different-tail-source', ${sqlString(`agent:${sourceAgentId}`)}),
      ('memory-different-tail-source', 'tool:legacy-client'),
      ('memory-different-tail-target', ${sqlString(`agent-id:${targetAgentId}`)}),
      ('memory-different-tail-target', ${sqlString(`agent:${targetAgentId}`)}),
      ('memory-different-tail-unrelated', ${sqlString(`agent:${sourceAgentId}`)});
  `);
  return { sourceAgentId, targetAgentId };
}

async function assertDifferentTailMerge(database, fixture) {
  assert.deepStrictEqual(
    await labelsForMemory(database, "memory-different-tail-source"),
    ["agent-id:modern-agent", "agent:modern-agent", "tool:legacy-client"],
    "Different-tail merge did not migrate canonical and scoped alias labels."
  );
  assert.deepStrictEqual(
    await labelsForMemory(database, "memory-different-tail-target"),
    ["agent-id:modern-agent", "agent:modern-agent"],
    "Different-tail merge damaged existing target labels."
  );
  assert.deepStrictEqual(
    await labelsForMemory(database, "memory-different-tail-unrelated"),
    ["agent:legacy-agent"],
    "Different-tail merge rewrote an alias without canonical ownership evidence."
  );
  const oldCanonicalCount = await database.query(`
    SELECT COUNT(*) AS count
    FROM memory_labels
    WHERE label = ${sqlString(`agent-id:${fixture.sourceAgentId}`)};
  `);
  assert.strictEqual(Number(oldCanonicalCount[0]?.count || 0), 0);
}

async function singletonStateSnapshot(database, sourceAgentId, targetAgentId) {
  const idsSql = `${sqlString(sourceAgentId)}, ${sqlString(targetAgentId)}`;
  return {
    agents: await database.query(`
      SELECT id, label, role, status, metadata_json
      FROM agents
      WHERE id IN (${idsSql})
      ORDER BY id;
    `),
    continuityStates: await database.query(`
      SELECT agent_id, communication_style, relationship_position,
             long_term_preferences_json, boundaries_json, stable_patterns_json,
             notes, updated_at
      FROM continuity_agent_state
      WHERE agent_id IN (${idsSql})
      ORDER BY agent_id;
    `),
    profiles: await database.query(`
      SELECT agent_id, display_name, enabled, profile_json, state_json,
             created_at, updated_at
      FROM innerlife_profiles
      WHERE agent_id IN (${idsSql})
      ORDER BY agent_id;
    `),
    daemonStates: await database.query(`
      SELECT agent_id, status, enabled, last_tick_at, next_run_at, last_result,
             last_error, tick_count, updated_at, metadata_json
      FROM innerlife_daemon_state
      WHERE agent_id IN (${idsSql})
      ORDER BY agent_id;
    `),
    lines: await database.query(`
      SELECT id, agent_id, title, status
      FROM continuity_lines
      WHERE agent_id IN (${idsSql})
      ORDER BY id;
    `)
  };
}

async function assertConflictingSingletonsBlockWithoutMutation(database) {
  const sourceAgentId = "singleton-conflict-source";
  const targetAgentId = "singleton-conflict-target";
  await database.exec(`
    INSERT INTO agents (id, label, role, status)
    VALUES
      (${sqlString(sourceAgentId)}, 'Singleton Conflict Source', 'agent', 'active'),
      (${sqlString(targetAgentId)}, 'Singleton Conflict Target', 'agent', 'active');

    INSERT INTO continuity_agent_state (
      agent_id, communication_style, relationship_position,
      long_term_preferences_json, boundaries_json, stable_patterns_json, notes
    ) VALUES
      (
        ${sqlString(sourceAgentId)},
        'source-style',
        'source-position',
        '["source-preference"]',
        '["source-boundary"]',
        '["source-pattern"]',
        'source notes'
      ),
      (
        ${sqlString(targetAgentId)},
        'target-style',
        'target-position',
        '["target-preference"]',
        '["target-boundary"]',
        '["target-pattern"]',
        'target notes'
      );

    INSERT INTO innerlife_profiles (
      agent_id, display_name, enabled, profile_json, state_json
    ) VALUES
      (
        ${sqlString(sourceAgentId)},
        'Source Profile',
        1,
        '{"agentId":"singleton-conflict-source","sourceOnly":true}',
        '{"focus":"source"}'
      ),
      (
        ${sqlString(targetAgentId)},
        'Target Profile',
        0,
        '{"agentId":"singleton-conflict-target","targetOnly":true}',
        '{"focus":"target"}'
      );

    INSERT INTO innerlife_daemon_state (
      agent_id, status, enabled, last_tick_at, next_run_at, last_result,
      last_error, tick_count, metadata_json
    ) VALUES
      (
        ${sqlString(sourceAgentId)},
        'enabled',
        1,
        '2026-07-30T01:00:00.000Z',
        '2026-07-30T01:15:00.000Z',
        'source result',
        '',
        7,
        '{"owner":"source"}'
      ),
      (
        ${sqlString(targetAgentId)},
        'paused',
        0,
        '2026-07-30T02:00:00.000Z',
        NULL,
        'target result',
        'target error',
        11,
        '{"owner":"target"}'
      );

    INSERT INTO continuity_lines (id, agent_id, title, status)
    VALUES (
      'line-singleton-conflict-source',
      ${sqlString(sourceAgentId)},
      'Must stay on source after conflict',
      'active'
    );
  `);

  const before = await singletonStateSnapshot(database, sourceAgentId, targetAgentId);
  let conflictError = null;
  try {
    await database.mergeAgentIdentity({
      fromAgentId: sourceAgentId,
      toAgentId: targetAgentId,
      confirm: true
    });
  } catch (error) {
    conflictError = error;
  }

  assert.ok(conflictError, "A dual-sided singleton conflict did not block the identity merge.");
  assert.strictEqual(conflictError.name, "AgentIdentityMergeConflictError");
  assert.strictEqual(conflictError.code, "AGENT_IDENTITY_SINGLETON_CONFLICT");
  assert.strictEqual(conflictError.details?.changed, false);
  assert.strictEqual(conflictError.details?.sourceAgentId, sourceAgentId);
  assert.strictEqual(conflictError.details?.targetAgentId, targetAgentId);
  assert.match(conflictError.message, /No records were changed and the source Agent was preserved/);

  const conflicts = conflictError.details?.conflicts || [];
  assert.deepStrictEqual(
    conflicts.map((conflict) => conflict.table).sort(),
    ["continuity_agent_state", "innerlife_daemon_state", "innerlife_profiles"],
    "Conflict details did not identify every dual-sided singleton table."
  );
  for (const conflict of conflicts) {
    assert.ok(conflict.differingFields.length > 0, `${conflict.table} did not report differing fields.`);
    assert.ok(conflict.resolution, `${conflict.table} did not report an actionable resolution.`);
    for (const field of conflict.differingFields) {
      assert.ok(Object.prototype.hasOwnProperty.call(field, "sourceValue"));
      assert.ok(Object.prototype.hasOwnProperty.call(field, "targetValue"));
    }
  }

  const after = await singletonStateSnapshot(database, sourceAgentId, targetAgentId);
  assert.deepStrictEqual(
    after,
    before,
    "A blocked singleton conflict changed data or deleted the source Agent."
  );
}

async function assertEquivalentSingletonsDeduplicate(database) {
  const sourceAgentId = "singleton-equivalent-source";
  const targetAgentId = "singleton-equivalent-target";
  await database.exec(`
    INSERT INTO agents (id, label, role, status)
    VALUES
      (${sqlString(sourceAgentId)}, 'Equivalent Source', 'agent', 'active'),
      (${sqlString(targetAgentId)}, 'Equivalent Target', 'agent', 'active');

    INSERT INTO continuity_agent_state (
      agent_id, communication_style, relationship_position,
      long_term_preferences_json, boundaries_json, stable_patterns_json,
      notes, updated_at
    ) VALUES
      (
        ${sqlString(sourceAgentId)},
        'same-style',
        'same-position',
        '["same-preference"]',
        '["same-boundary"]',
        '["same-pattern"]',
        'same notes',
        '2026-07-30T01:00:00.000Z'
      ),
      (
        ${sqlString(targetAgentId)},
        'same-style',
        'same-position',
        '["same-preference"]',
        '["same-boundary"]',
        '["same-pattern"]',
        'same notes',
        '2026-07-30T02:00:00.000Z'
      );

    INSERT INTO innerlife_profiles (
      agent_id, display_name, enabled, profile_json, state_json,
      created_at, updated_at
    ) VALUES
      (
        ${sqlString(sourceAgentId)},
        'Equivalent Profile',
        1,
        '{"agentId":"singleton-equivalent-source","mode":"same"}',
        '{"focus":"same","nested":{"a":1,"b":2}}',
        '2026-07-30T01:00:00.000Z',
        '2026-07-30T01:00:00.000Z'
      ),
      (
        ${sqlString(targetAgentId)},
        'Equivalent Profile',
        1,
        '{"mode":"same","agentId":"singleton-equivalent-target"}',
        '{"nested":{"b":2,"a":1},"focus":"same"}',
        '2026-07-30T02:00:00.000Z',
        '2026-07-30T02:00:00.000Z'
      );

    INSERT INTO innerlife_daemon_state (
      agent_id, status, enabled, last_tick_at, next_run_at, last_result,
      last_error, tick_count, updated_at, metadata_json
    ) VALUES
      (
        ${sqlString(sourceAgentId)},
        'enabled',
        1,
        '2026-07-30T01:00:00.000Z',
        '2026-07-30T01:15:00.000Z',
        'same result',
        '',
        9,
        '2026-07-30T01:00:00.000Z',
        '{"failureCount":0,"retrySeconds":0}'
      ),
      (
        ${sqlString(targetAgentId)},
        'enabled',
        1,
        '2026-07-30T01:00:00.000Z',
        '2026-07-30T01:15:00.000Z',
        'same result',
        '',
        9,
        '2026-07-30T02:00:00.000Z',
        '{"retrySeconds":0,"failureCount":0}'
      );

    INSERT INTO continuity_lines (id, agent_id, title, status)
    VALUES (
      'line-singleton-equivalent-source',
      ${sqlString(sourceAgentId)},
      'Equivalent singleton source line',
      'active'
    );
  `);

  const result = await database.mergeAgentIdentity({
    fromAgentId: sourceAgentId,
    toAgentId: targetAgentId,
    confirm: true
  });
  assert.deepStrictEqual(
    result.singletonResolutions,
    [
      { table: "continuity_agent_state", action: "deduplicated-equivalent" },
      { table: "innerlife_daemon_state", action: "deduplicated-equivalent" },
      { table: "innerlife_profiles", action: "deduplicated-equivalent" }
    ],
    "Merge result did not explain equivalent singleton deduplication."
  );

  const snapshot = await singletonStateSnapshot(database, sourceAgentId, targetAgentId);
  assert.strictEqual(snapshot.agents.length, 1);
  assert.strictEqual(snapshot.agents[0].id, targetAgentId);
  assert.strictEqual(snapshot.continuityStates.length, 1);
  assert.strictEqual(snapshot.continuityStates[0].agent_id, targetAgentId);
  assert.strictEqual(snapshot.continuityStates[0].updated_at, "2026-07-30T02:00:00.000Z");
  assert.strictEqual(snapshot.profiles.length, 1);
  assert.strictEqual(snapshot.profiles[0].agent_id, targetAgentId);
  assert.strictEqual(JSON.parse(snapshot.profiles[0].profile_json).agentId, targetAgentId);
  assert.strictEqual(snapshot.profiles[0].created_at, "2026-07-30T01:00:00.000Z");
  assert.strictEqual(snapshot.profiles[0].updated_at, "2026-07-30T02:00:00.000Z");
  assert.strictEqual(snapshot.daemonStates.length, 1);
  assert.strictEqual(snapshot.daemonStates[0].agent_id, targetAgentId);
  assert.strictEqual(snapshot.daemonStates[0].updated_at, "2026-07-30T02:00:00.000Z");
  assert.strictEqual(snapshot.lines.length, 1);
  assert.strictEqual(snapshot.lines[0].agent_id, targetAgentId);
}

async function rollbackSemanticSnapshot(database, sourceAgentId, targetAgentId) {
  return {
    directReferences: await directReferenceSnapshot(database, sourceAgentId, targetAgentId),
    agents: await database.query(`
      SELECT id, label, role, status, metadata_json
      FROM agents
      WHERE id IN (${sqlString(sourceAgentId)}, ${sqlString(targetAgentId)})
      ORDER BY id;
    `),
    lines: await database.query(`
      SELECT id, agent_id, title, status
      FROM continuity_lines
      WHERE id = 'line-merge-rollback-source';
    `),
    controllerEvents: await database.query(`
      SELECT id, policy_version, policy_mode, agent_id, result_status
      FROM memory_control_events
      WHERE id = 'memory-controller-merge-rollback';
    `)
  };
}

async function assertFailedMergeRollsBack(database) {
  const sourceAgentId = "rollback-source";
  const targetAgentId = "rollback-target";
  await database.exec(`
    INSERT INTO agents (id, label, role, status)
    VALUES
      (${sqlString(sourceAgentId)}, 'Rollback Source', 'agent', 'active'),
      (${sqlString(targetAgentId)}, 'Rollback Target', 'agent', 'inactive');

    INSERT INTO continuity_lines (id, agent_id, title, status)
    VALUES (
      'line-merge-rollback-source',
      ${sqlString(sourceAgentId)},
      'Rollback source line',
      'active'
    );
  `);
  await database.recordMemoryControlEvent({
    id: "memory-controller-merge-rollback",
    policyVersion: "identity-merge-rollback-v1",
    policyMode: "observe",
    agentId: sourceAgentId,
    stageAAction: "NOOP",
    stageAReason: "identity_merge_rollback",
    resultStatus: "completed"
  });
  await database.exec(`
    CREATE TRIGGER fixture_agent_identity_merge_rollback
    BEFORE UPDATE OF agent_id ON memory_control_events
    WHEN OLD.id = 'memory-controller-merge-rollback'
      AND NEW.agent_id = ${sqlString(targetAgentId)}
    BEGIN
      SELECT RAISE(ABORT, 'fixture rollback');
    END;
  `);

  const before = await rollbackSemanticSnapshot(database, sourceAgentId, targetAgentId);
  await assert.rejects(
    () => database.mergeAgentIdentity({
      fromAgentId: sourceAgentId,
      toAgentId: targetAgentId,
      confirm: true
    }),
    /fixture rollback/,
    "Identity merge did not surface the forced transaction failure."
  );
  const after = await rollbackSemanticSnapshot(database, sourceAgentId, targetAgentId);
  assert.deepStrictEqual(after, before, "Failed identity merge left partially migrated semantic data.");

  await database.exec(`
    INSERT INTO runtime_events (id, level, source, message, metadata_json)
    VALUES (
      'event-after-identity-rollback',
      'info',
      'identity-merge-smoke',
      'Transaction released after rollback',
      '{}'
    );
  `);
  const writeRows = await database.query(`
    SELECT COUNT(*) AS count
    FROM runtime_events
    WHERE id = 'event-after-identity-rollback';
  `);
  assert.strictEqual(Number(writeRows[0]?.count || 0), 1, "Database remained locked after merge rollback.");

  await assertDatabaseIntegrity(database);
  await database.exec("DROP TRIGGER fixture_agent_identity_merge_rollback;");
}

async function assertDatabaseIntegrity(database) {
  const quickCheck = await database.query("PRAGMA quick_check;");
  assert.strictEqual(quickCheck[0]?.quick_check, "ok", "Temporary identity merge database failed quick_check.");
  const foreignKeyViolations = await database.query("PRAGMA foreign_key_check;");
  assert.deepStrictEqual(foreignKeyViolations, [], "Identity merge left foreign-key violations.");
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-agent-identity-merge-"));
  let database;
  try {
    database = await initializeProductDatabase(path.join(root, "claracore.db"));

    const liveReferences = await liveDirectReferences(database);
    assert.strictEqual(liveReferences.length, 15, "Fresh schema no longer has the expected 15 direct Agent references.");
    assert.deepStrictEqual(liveReferences, EXPECTED_DIRECT_REFERENCES, "Live schema Agent references changed.");
    assert.deepStrictEqual(
      directRegistryEntries(identityReferenceRegistry),
      EXPECTED_DIRECT_REFERENCES,
      "Agent identity registry does not cover the live direct-reference schema."
    );

    const sameTailFixture = await seedSameTailFixture(database);
    await database.mergeAgentIdentity({
      fromAgentId: sameTailFixture.sourceAgentId,
      toAgentId: sameTailFixture.targetAgentId,
      confirm: true
    });
    await assertSameTailMerge(database, sameTailFixture);

    const beforeSecondMerge = await semanticSnapshot(
      database,
      sameTailFixture.sourceAgentId,
      sameTailFixture.targetAgentId
    );
    await database.mergeAgentIdentity({
      fromAgentId: sameTailFixture.sourceAgentId,
      toAgentId: sameTailFixture.targetAgentId,
      confirm: true
    });
    const afterSecondMerge = await semanticSnapshot(
      database,
      sameTailFixture.sourceAgentId,
      sameTailFixture.targetAgentId
    );
    assert.deepStrictEqual(afterSecondMerge, beforeSecondMerge, "A repeated identity merge changed semantic data.");

    const differentTailFixture = await seedDifferentTailFixture(database);
    await database.mergeAgentIdentity({
      fromAgentId: differentTailFixture.sourceAgentId,
      toAgentId: differentTailFixture.targetAgentId,
      confirm: true
    });
    await assertDifferentTailMerge(database, differentTailFixture);
    await assertConflictingSingletonsBlockWithoutMutation(database);
    await assertEquivalentSingletonsDeduplicate(database);
    await assertFailedMergeRollsBack(database);
    await assertDatabaseIntegrity(database);

    console.log("Agent identity merge smoke: ok");
  } finally {
    if (database) database.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
