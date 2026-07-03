#!/usr/bin/env node

const os = require("os");
const path = require("path");
const runtime = require("../core/runtime");
const { defaultUserDataPath } = require("../core/platform-paths");

const DEFAULT_NEXT_DATA_ROOT = path.join(os.homedir(), "Library", "Application Support", "claracore-desktop-next", "data");

function sqlString(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return sqlString(JSON.stringify(value ?? {}));
}

function ts(minutesAgo = 0) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function createCliApp() {
  const userData = process.env.CLARACORE_DESKTOP_USER_DATA_DIR || defaultUserDataPath();
  return {
    isPackaged: false,
    getPath(name) {
      if (name === "userData") return userData;
      if (name === "home") return os.homedir();
      return path.join(userData, name);
    }
  };
}

function memorySql({ id, title, body, labels, sensitivity = "normal", minutesAgo = 60, embedding = "pending" }) {
  const createdAt = ts(minutesAgo);
  const labelSql = labels
    .map(
      (label) => `
        INSERT INTO memory_labels (memory_id, label, created_at)
        VALUES (${sqlString(id)}, ${sqlString(label)}, ${sqlString(createdAt)})
        ON CONFLICT(memory_id, label) DO NOTHING;
      `
    )
    .join("\n");
  return `
    INSERT INTO memories (id, title, body, status, sensitivity, created_at, updated_at)
    VALUES (${sqlString(id)}, ${sqlString(title)}, ${sqlString(body)}, 'active', ${sqlString(sensitivity)}, ${sqlString(createdAt)}, ${sqlString(createdAt)})
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      body = excluded.body,
      status = excluded.status,
      sensitivity = excluded.sensitivity,
      updated_at = excluded.updated_at;

    ${labelSql}

    INSERT INTO memory_embeddings (memory_id, provider, model, dimension, status, error, embedded_at)
    VALUES (
      ${sqlString(id)},
      'ux-seed',
      'fixture-vector',
      8,
      ${sqlString(embedding)},
      ${embedding === "failed" ? sqlString("Fixture failed vector rebuild so Home has a warning path.") : "''"},
      ${sqlString(createdAt)}
    )
    ON CONFLICT(memory_id) DO UPDATE SET
      provider = excluded.provider,
      model = excluded.model,
      dimension = excluded.dimension,
      status = excluded.status,
      error = excluded.error,
      embedded_at = excluded.embedded_at;
  `;
}

function traceSql({ id, agentId, toolName, status = "ok", durationMs = 120, request = {}, responseSummary = "", error = "", minutesAgo = 3 }) {
  return `
    INSERT INTO gateway_traces (id, agent_id, tool_name, status, duration_ms, request_json, response_summary, error, created_at)
    VALUES (
      ${sqlString(id)},
      ${sqlString(agentId)},
      ${sqlString(toolName)},
      ${sqlString(status)},
      ${Number(durationMs) || 0},
      ${jsonSql(request)},
      ${sqlString(responseSummary)},
      ${sqlString(error)},
      ${sqlString(ts(minutesAgo))}
    )
    ON CONFLICT(id) DO UPDATE SET
      agent_id = excluded.agent_id,
      tool_name = excluded.tool_name,
      status = excluded.status,
      duration_ms = excluded.duration_ms,
      request_json = excluded.request_json,
      response_summary = excluded.response_summary,
      error = excluded.error,
      created_at = excluded.created_at;
  `;
}

async function clearUxFixture(database) {
  await database.ensureDefaultContinuityLine();
  await database.exec(`
    DELETE FROM memory_labels WHERE memory_id LIKE 'ux_mem_%';
    DELETE FROM memory_embeddings WHERE memory_id LIKE 'ux_mem_%';
    DELETE FROM memories WHERE id LIKE 'ux_mem_%';

    DELETE FROM continuity_position_history WHERE id LIKE 'ux_hist_%';
    DELETE FROM continuity_snapshots WHERE id LIKE 'ux_snap_%';
    DELETE FROM current_positions WHERE line_id LIKE 'ux_line_%';
    DELETE FROM continuity_lines WHERE id LIKE 'ux_line_%';

    INSERT INTO app_settings (key, value_json, updated_at)
    VALUES ('continuity.active_line_id', ${jsonSql("line_default")}, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at;

    DELETE FROM innerlife_share_actions WHERE share_id LIKE 'ux_share_%';
    DELETE FROM innerlife_share_checks WHERE share_id LIKE 'ux_share_%' OR session_id LIKE 'ux_session_%';
    DELETE FROM innerlife_shares WHERE id LIKE 'ux_share_%';
    DELETE FROM innerlife_thoughts WHERE id LIKE 'ux_thought_%';
    DELETE FROM innerlife_digest_runs WHERE id LIKE 'ux_digest_%';
    DELETE FROM innerlife_sessions WHERE id LIKE 'ux_session_%';
    DELETE FROM innerlife_inbox WHERE id LIKE 'ux_inbox_%';
    DELETE FROM innerlife_events WHERE id LIKE 'ux_event_%';
    DELETE FROM innerlife_profiles WHERE agent_id IN ('clara', 'lara');

    DELETE FROM gateway_traces WHERE id LIKE 'ux_trace_%';
    DELETE FROM runtime_events WHERE id LIKE 'ux_event_%';
  `);
}

async function main() {
  if (!process.env.CLARACORE_DESKTOP_DATA_DIR) {
    process.env.CLARACORE_DESKTOP_DATA_DIR = DEFAULT_NEXT_DATA_ROOT;
  }
  process.env.CLARACORE_DESKTOP_TEST_INSTANCE = process.env.CLARACORE_DESKTOP_TEST_INSTANCE || "1";

  const app = createCliApp();
  const beforeBackup = await runtime.createProductBackup(app);
  const { paths, database } = await runtime.ensureProductCore(app);

  if (process.argv.includes("--clear")) {
    await clearUxFixture(database);
    const snapshot = await runtime.buildProductSnapshot(app);
    process.stdout.write(`${JSON.stringify(
      {
        ok: true,
        cleared: true,
        dataRoot: paths.root,
        databasePath: paths.databasePath,
        backupBeforeClear: {
          id: beforeBackup.id,
          path: beforeBackup.path,
          status: beforeBackup.status
        },
        counts: {
          memories: snapshot.memoryStats?.activeCount ?? 0,
          sharedLines: snapshot.sharedLine?.lines?.length ?? 0,
          pendingShares: snapshot.innerLife?.counts?.pending_shares_count ?? 0,
          gatewayTraces: snapshot.gatewayTraces?.length ?? 0
        }
      },
      null,
      2
    )}\n`);
    return;
  }

  const now = ts(0);
  await database.exec(`
    INSERT INTO agents (id, label, role, status)
    VALUES
      ('codex', 'Codex', 'agent', 'active'),
      ('clara', 'Clara', 'agent', 'active'),
      ('lara', 'Lara', 'agent', 'active')
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      role = excluded.role,
      status = excluded.status;

    DELETE FROM memory_labels WHERE memory_id LIKE 'ux_mem_%';
    DELETE FROM memory_embeddings WHERE memory_id LIKE 'ux_mem_%';

    ${memorySql({
      id: "ux_mem_clara_release",
      title: "Desktop UX reduction principle",
      body: "Home should answer whether a human needs to act before exposing runtime diagnostics.",
      labels: ["agent:clara", "product:desktop", "ux", "v0.2.1"],
      embedding: "embedded",
      minutesAgo: 240
    })}

    ${memorySql({
      id: "ux_mem_lara_gateway",
      title: "Gateway diagnostics belong below action",
      body: "Normal Gateway traces are evidence for Agent Access; only unresolved errors should expand on Home.",
      labels: ["agent:lara", "gateway", "ux", "home"],
      embedding: "pending",
      minutesAgo: 180
    })}

    ${memorySql({
      id: "ux_mem_codex_validation",
      title: "Validation checklist",
      body: "Use isolated data roots, run syntax checks, and inspect Home with both quiet and noisy agent states.",
      labels: ["agent:codex", "validation", "desktop"],
      embedding: "failed",
      minutesAgo: 90
    })}

    INSERT INTO continuity_lines (id, agent_id, title, status, created_at, updated_at)
    VALUES
      ('ux_line_clara_home', 'clara', 'v0.2.1 Home reduction', 'active', ${sqlString(ts(210))}, ${sqlString(ts(18))}),
      ('ux_line_lara_agent_access', 'lara', 'Agent Access follow-up', 'active', ${sqlString(ts(160))}, ${sqlString(ts(35))}),
      ('ux_line_archived', 'codex', 'Archived dense dashboard pass', 'archived', ${sqlString(ts(500))}, ${sqlString(ts(300))})
    ON CONFLICT(id) DO UPDATE SET
      agent_id = excluded.agent_id,
      title = excluded.title,
      status = excluded.status,
      updated_at = excluded.updated_at;

    INSERT INTO current_positions (id, line_id, summary, interpretation_status, facts_used_json, metadata_json, updated_at)
    VALUES
      (
        'position_ux_line_clara_home',
        'ux_line_clara_home',
        'Home now leads with action state, then agent continuity, while runtime and module diagnostics sit below the main operating path.',
        'confirmed',
        ${jsonSql(["ux_mem_clara_release", "ux_mem_codex_validation"])},
        ${jsonSql({
          agentId: "clara",
          nextStep: "Check real-data Home density before extending the pattern to Agent Access.",
          currentInterpretation: "Reduction is working when normal diagnostics stop competing with the current handoff.",
          affectiveTrace: [
            { time: ts(40), tone: "focused", valence: "positive", intensity: "medium", stability: "session", source: "seed", note: "Clearer first read." },
            { time: ts(18), tone: "cautious", valence: "mixed", intensity: "low", stability: "session", source: "seed", note: "Verify dense real data before committing." }
          ],
          tags: ["ux-reduction", "home"]
        })},
        ${sqlString(ts(18))}
      ),
      (
        'position_ux_line_lara_agent_access',
        'ux_line_lara_agent_access',
        'Agent Access is the likely next reduction target: keep quick copy and current identity first, move long install details behind disclosure.',
        'active',
        ${jsonSql(["ux_mem_lara_gateway"])},
        ${jsonSql({
          agentId: "lara",
          nextStep: "Review whether the install brief should be collapsed by default.",
          currentInterpretation: "Agent-facing setup is useful but still reads like documentation when the page is already connected.",
          tags: ["agent-access", "follow-up"]
        })},
        ${sqlString(ts(35))}
      )
    ON CONFLICT(line_id) DO UPDATE SET
      summary = excluded.summary,
      interpretation_status = excluded.interpretation_status,
      facts_used_json = excluded.facts_used_json,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at;

    INSERT INTO app_settings (key, value_json, updated_at)
    VALUES ('continuity.active_line_id', ${jsonSql("ux_line_clara_home")}, ${sqlString(now)})
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at;

    INSERT INTO continuity_position_history (id, line_id, position_id, summary, interpretation_status, facts_used_json, source, created_at)
    VALUES
      ('ux_hist_home_1', 'ux_line_clara_home', 'position_ux_line_clara_home', 'First pass kept all status cards but made them clearer.', 'draft', ${jsonSql(["ux_mem_clara_release"])}, 'seed', ${sqlString(ts(80))}),
      ('ux_hist_home_2', 'ux_line_clara_home', 'position_ux_line_clara_home', 'Second pass promoted Agent View and Attention above diagnostics.', 'confirmed', ${jsonSql(["ux_mem_clara_release", "ux_mem_codex_validation"])}, 'seed', ${sqlString(ts(18))})
    ON CONFLICT(id) DO UPDATE SET
      summary = excluded.summary,
      interpretation_status = excluded.interpretation_status,
      facts_used_json = excluded.facts_used_json,
      source = excluded.source,
      created_at = excluded.created_at;

    INSERT INTO continuity_snapshots (id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at)
    VALUES
      ('ux_snap_home_current', 'ux_line_clara_home', 'position_ux_line_clara_home', 'Home reduction current checkpoint.', 'confirmed', ${jsonSql(["ux_mem_clara_release"])}, 'seed', ${sqlString(ts(18))})
    ON CONFLICT(id) DO UPDATE SET
      summary = excluded.summary,
      interpretation_status = excluded.interpretation_status,
      facts_used_json = excluded.facts_used_json,
      reason = excluded.reason,
      created_at = excluded.created_at;

    INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at)
    VALUES
      ('clara', 'Clara', 1, ${jsonSql({ watch: ["handoff clarity", "operator fatigue"], avoid: ["over-explaining normal state"] })}, ${jsonSql({ recent_focus: "Home reduction review", mood: "focused" })}, ${sqlString(ts(200))}, ${sqlString(ts(14))}),
      ('lara', 'Lara', 1, ${jsonSql({ watch: ["Gateway errors", "setup copy clarity"], avoid: ["hidden ports"] })}, ${jsonSql({ recent_focus: "Agent Access next pass", mood: "alert" })}, ${sqlString(ts(190))}, ${sqlString(ts(22))})
    ON CONFLICT(agent_id) DO UPDATE SET
      display_name = excluded.display_name,
      enabled = excluded.enabled,
      profile_json = excluded.profile_json,
      state_json = excluded.state_json,
      updated_at = excluded.updated_at;

    INSERT INTO innerlife_sessions (id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json)
    VALUES
      ('ux_session_clara_active', 'clara', 'zhouwei', 'desktop-seed', 'ux-home-review', 'active', ${sqlString(ts(42))}, NULL, ${jsonSql({ fixture: true })}, '', ${jsonSql({ purpose: "Home density test" })}),
      ('ux_session_lara_ended', 'lara', 'zhouwei', 'desktop-seed', 'ux-agent-access-review', 'ended', ${sqlString(ts(160))}, ${sqlString(ts(125))}, ${jsonSql({ fixture: true })}, 'Agent Access needs a compact connected-state read.', ${jsonSql({ purpose: "Secondary page review" })})
    ON CONFLICT(agent_id, external_session_id) DO UPDATE SET
      status = excluded.status,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      briefing_json = excluded.briefing_json,
      summary = excluded.summary,
      metadata_json = excluded.metadata_json;

    INSERT INTO innerlife_inbox (id, agent_id, source, body, status, created_at, processed_at, metadata_json)
    VALUES
      ('ux_inbox_clara_1', 'clara', 'desktop', 'Operator wants real-density Home testing before committing the reduction pass.', 'pending', ${sqlString(ts(28))}, NULL, ${jsonSql({ fixture: true })}),
      ('ux_inbox_lara_1', 'lara', 'gateway', 'Gateway trace display should stay compact unless there is an unresolved error.', 'processed', ${sqlString(ts(110))}, ${sqlString(ts(104))}, ${jsonSql({ fixture: true })})
    ON CONFLICT(id) DO UPDATE SET
      body = excluded.body,
      status = excluded.status,
      created_at = excluded.created_at,
      processed_at = excluded.processed_at,
      metadata_json = excluded.metadata_json;

    INSERT INTO innerlife_events (id, agent_id, kind, body, status, created_at, metadata_json)
    VALUES
      ('ux_event_clara_share', 'clara', 'manual_process_once', 'Review Home after UX reduction.', 'processed', ${sqlString(ts(20))}, ${jsonSql({ fixture: true })}),
      ('ux_event_lara_share', 'lara', 'digest', 'Summarize Agent Access follow-up.', 'processed', ${sqlString(ts(55))}, ${jsonSql({ fixture: true })})
    ON CONFLICT(id) DO UPDATE SET
      body = excluded.body,
      status = excluded.status,
      created_at = excluded.created_at,
      metadata_json = excluded.metadata_json;

    INSERT INTO innerlife_thoughts (id, event_id, body, review_status, created_at)
    VALUES
      ('ux_thought_clara_pending', 'ux_event_clara_share', 'This Home page now has enough information to continue, but the next review should use real agent activity rather than empty fixture state.', 'unreviewed', ${sqlString(ts(19))}),
      ('ux_thought_lara_pending', 'ux_event_lara_share', 'Agent Access should remain the exact place for connection details; Home only needs enough trace evidence to point there.', 'unreviewed', ${sqlString(ts(54))}),
      ('ux_thought_clara_approved', 'ux_event_clara_share', 'The operator should be shown only what changed and what still needs attention.', 'reviewed', ${sqlString(ts(80))})
    ON CONFLICT(id) DO UPDATE SET
      body = excluded.body,
      review_status = excluded.review_status,
      created_at = excluded.created_at;

    INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at)
    VALUES
      ('ux_share_clara_pending', 'clara', 'ux_thought_clara_pending', 'pending', 'This Home page now has enough information to continue, but the next review should use real agent activity rather than empty fixture state.', '', ${sqlString(ts(19))}, ${sqlString(ts(19))}),
      ('ux_share_lara_pending', 'lara', 'ux_thought_lara_pending', 'pending', 'Agent Access should remain the exact place for connection details; Home only needs enough trace evidence to point there.', '', ${sqlString(ts(54))}, ${sqlString(ts(54))}),
      ('ux_share_clara_approved', 'clara', 'ux_thought_clara_approved', 'approved', 'The operator should be shown only what changed and what still needs attention.', 'Fixture approval for used/approved contrast.', ${sqlString(ts(80))}, ${sqlString(ts(70))})
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      body = excluded.body,
      decision_reason = excluded.decision_reason,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at;

    INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json)
    VALUES
      ('ux_digest_clara_home', 'clara', 'manual', 'completed', ${jsonSql({ fixture: true })}, 'Home density pass: keep action state and agent continuity above diagnostics.', ${sqlString(ts(24))}, ${sqlString(ts(23))}, ${jsonSql({ fixture: true })}),
      ('ux_digest_lara_access', 'lara', 'manual', 'completed', ${jsonSql({ fixture: true })}, 'Agent Access follow-up: collapse long install text after connection state is visible.', ${sqlString(ts(58))}, ${sqlString(ts(57))}, ${jsonSql({ fixture: true })})
    ON CONFLICT(id) DO UPDATE SET
      summary = excluded.summary,
      created_at = excluded.created_at,
      completed_at = excluded.completed_at,
      metadata_json = excluded.metadata_json;

    ${traceSql({
      id: "ux_trace_lara_error",
      agentId: "lara",
      toolName: "innerlife_share_check",
      status: "error",
      durationMs: 846,
      request: { shareId: "ux_share_lara_pending", context: "Home density validation" },
      error: "Fixture unresolved share timing conflict for Home error-state review.",
      minutesAgo: 2
    })}

    ${traceSql({
      id: "ux_trace_clara_context",
      agentId: "clara",
      toolName: "gateway_context",
      durationMs: 118,
      request: { include: "resume_packet" },
      responseSummary: JSON.stringify({ ok: true, transport: "stdio", modules: { memoria: "ready", continuity: "ready", innerlife: "pending" }, database: { initialized: true } }),
      minutesAgo: 4
    })}

    ${traceSql({
      id: "ux_trace_codex_memory",
      agentId: "codex",
      toolName: "memoria_store",
      durationMs: 205,
      request: { labels: ["ux", "desktop"] },
      responseSummary: JSON.stringify({ ok: true, memoryId: "ux_mem_codex_validation" }),
      minutesAgo: 8
    })}

    ${traceSql({
      id: "ux_trace_clara_line",
      agentId: "clara",
      toolName: "shared_line_update",
      durationMs: 164,
      request: { lineId: "ux_line_clara_home" },
      responseSummary: JSON.stringify({ ok: true, lineId: "ux_line_clara_home" }),
      minutesAgo: 12
    })}

    INSERT INTO runtime_events (id, level, source, message, created_at, metadata_json)
    VALUES
      ('ux_event_seed_complete', 'info', 'desktop', 'UX test data seeded', ${sqlString(now)}, ${jsonSql({ fixture: true, dataRoot: paths.root })}),
      ('ux_event_gateway_warn', 'warn', 'gateway', 'Fixture Gateway warning for Home diagnostics', ${sqlString(ts(3))}, ${jsonSql({ traceId: "ux_trace_lara_error" })}),
      ('ux_event_memory_batch', 'info', 'memoria', 'Processed pending memory embedding batch', ${sqlString(ts(15))}, ${jsonSql({ fixture: true, count: 2 })})
    ON CONFLICT(id) DO UPDATE SET
      level = excluded.level,
      source = excluded.source,
      message = excluded.message,
      created_at = excluded.created_at,
      metadata_json = excluded.metadata_json;
  `);

  const snapshot = await runtime.buildProductSnapshot(app);
  const result = {
    ok: true,
    dataRoot: paths.root,
    databasePath: paths.databasePath,
    backupBeforeSeed: {
      id: beforeBackup.id,
      path: beforeBackup.path,
      status: beforeBackup.status
    },
    counts: {
      memories: snapshot.memoryStats?.activeCount ?? 0,
      pendingVectors: snapshot.memoryStats?.pendingEmbeddingCount ?? 0,
      failedVectors: snapshot.memoryStats?.failedEmbeddingCount ?? 0,
      sharedLines: snapshot.sharedLine?.lines?.length ?? 0,
      pendingShares: snapshot.innerLife?.counts?.pending_shares_count ?? 0,
      gatewayTraces: snapshot.gatewayTraces?.length ?? 0
    }
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || String(error)}\n`);
  process.exit(1);
});
