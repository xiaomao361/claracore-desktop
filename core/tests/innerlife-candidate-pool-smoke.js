const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");
const { sqlString } = require("../db/helpers");
const { CANDIDATE_SCHEMA_SQL } = require("../innerlife/candidate-pool");

if (process.argv.includes("--cli")) process.env.CLARACORE_DESKTOP_DISABLE_NODE_SQLITE = "1";

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-candidate-pool-"));
  const dbPath = path.join(root, "test.db");
  let db;
  try {
    db = await initializeProductDatabase(dbPath);
    for (const agent of ["pool-a", "pool-b"]) {
      await db.ensureInnerLifeProfile(agent);
      for (let i = 0; i < 14; i++) {
        const id = `${agent}-${String(i).padStart(2, "0")}`;
        await db.exec(`INSERT INTO innerlife_shares (id, agent_id, status, body, created_at)
          VALUES (${sqlString(id)}, ${sqlString(agent)}, ${sqlString(i % 2 ? "pending" : "deferred")},
            ${sqlString(`Original ${id}`)}, datetime('now', '-${14 - i} minutes'));`);
      }
    }
    assert.deepEqual((await db.query("SELECT agent_id, count(*) AS n FROM innerlife_share_candidates GROUP BY agent_id ORDER BY agent_id;")).map(r => [r.agent_id, r.n]), [["pool-a", 10], ["pool-b", 10]]);
    assert.equal((await db.query("SELECT count(*) AS n FROM innerlife_shares;"))[0].n, 28);
    assert.equal((await db.query("SELECT count(*) AS n FROM innerlife_share_actions WHERE reason LIKE '%capacity_10%';"))[0].n, 8);
    await db.exec(`INSERT INTO innerlife_shares (id, agent_id, status, body) VALUES
      ('approved', 'pool-a', 'approved', 'Explicitly approved candidate'),
      ('protected-draft', 'pool-a', 'drafting', 'Unfinished model job'),
      ('protected-used', 'pool-a', 'used', 'Previously delivered');`);
    assert.equal((await db.query("SELECT count(*) AS n FROM innerlife_share_candidates WHERE agent_id='pool-a';"))[0].n, 10);
    assert((await db.listInnerLifeShares("approved", 20, "pool-a")).some(s => s.id === "approved"));

    await db.ensureInnerLifeProfile("age-agent");
    await db.exec(`INSERT INTO innerlife_shares (id, agent_id, status, body, created_at, updated_at) VALUES
      ('expired', 'age-agent', 'deferred', 'Keep this original body', datetime('now', '-8 days'), CURRENT_TIMESTAMP),
      ('boundary', 'age-agent', 'pending', 'Exactly seven days is expired', datetime('now', '-7 days'), CURRENT_TIMESTAMP),
      ('fresh', 'age-agent', 'pending', 'Within seven days', datetime('now', '-7 days', '+1 minute'), CURRENT_TIMESTAMP),
      ('bad-date', 'age-agent', 'pending', 'Preserve invalid date evidence', 'invalid-date', CURRENT_TIMESTAMP);`);
    const expired = await db.getInnerLifeShare("expired");
    assert.equal(expired.status, "discarded");
    assert.equal(expired.body, "Keep this original body");
    assert.match(expired.decision_reason, /expired_after_7_days/);
    assert.equal((await db.getInnerLifeShare("boundary")).status, "discarded");
    assert.match((await db.getInnerLifeShare("bad-date")).decision_reason, /invalid_created_at/);
    assert.deepEqual((await db.listInnerLifeShares("pending", 20, "age-agent")).map(s => s.id), ["fresh"]);
    assert.equal((await db.checkInnerLifeShareTiming({ agentId: "age-agent", shareId: "expired", context: "Please share it." })).share, null);

    // Simulate elapsed time without an update trigger: reads must exclude an
    // aged row immediately, even before the next scheduled maintenance sweep.
    await db.exec("DROP TRIGGER innerlife_candidate_update; UPDATE innerlife_shares SET created_at=datetime('now','-8 days') WHERE id='fresh';");
    await db.exec(CANDIDATE_SCHEMA_SQL);
    const before = await db.getInnerLifeShare("fresh");
    assert.equal((await db.listInnerLifeShareSummariesPage({ agentId: "age-agent" })).total, 0);
    assert.equal((await db.checkInnerLifeShareTiming({ agentId: "age-agent", shareId: "fresh", context: "Share it." })).share, null);
    assert.equal((await db.getInnerLifeSnapshotLite("age-agent")).counts.pending_shares_count, 0);
    assert.equal((await db.getInnerLifeShare("fresh")).status, before.status, "Reads must not retire records.");
    const actionCount = (await db.query("SELECT count(*) AS n FROM innerlife_share_actions;"))[0].n;
    await db.exec(`CREATE TRIGGER fixture_refuse_retirement BEFORE UPDATE OF status ON innerlife_shares
      WHEN OLD.id='fresh' AND NEW.status='discarded' BEGIN SELECT RAISE(ABORT, 'fixture refusal'); END;`);
    await assert.rejects(db.pruneInnerLifeShareCandidates(), /fixture refusal/);
    assert.equal((await db.query("SELECT count(*) AS n FROM innerlife_share_actions;"))[0].n, actionCount, "A failed sweep must roll back its action receipts.");
    await db.exec("DROP TRIGGER fixture_refuse_retirement;");
    await db.pruneInnerLifeShareCandidates();
    const afterSweep = (await db.query("SELECT count(*) AS n FROM innerlife_share_actions;"))[0].n;
    await db.pruneInnerLifeShareCandidates();
    assert.equal((await db.query("SELECT count(*) AS n FROM innerlife_share_actions;"))[0].n, afterSweep);
    assert.equal((await db.getInnerLifeShare("protected-draft")).status, "drafting");
    assert.equal((await db.getInnerLifeShare("protected-used")).status, "used");

    // Upgrade preserves the actual old daemon choices and every share body.
    await db.ensureInnerLifeProfile("legacy-on");
    await db.ensureInnerLifeProfile("legacy-off");
    await db.exec(`DROP TRIGGER innerlife_candidate_insert; DROP TRIGGER innerlife_candidate_update;
      DROP VIEW innerlife_share_candidates;
      DELETE FROM schema_migrations WHERE id='012_innerlife_candidate_pool';
      INSERT INTO innerlife_daemon_state (agent_id, enabled, status) VALUES
        ('legacy-on', 1, 'enabled'), ('legacy-off', 0, 'paused');
      UPDATE innerlife_profiles SET enabled=1 WHERE agent_id='legacy-off';
      INSERT INTO innerlife_shares (id, agent_id, status, body, decision_reason, created_at, updated_at)
        VALUES ('legacy-share', 'legacy-on', 'pending', 'Legacy original text', 'Legacy reason', datetime('now','-40 days'), datetime('now','-2 days'));`);
    const originals = await db.query("SELECT id, body FROM innerlife_shares ORDER BY id;");
    const originalLegacy = await db.getInnerLifeShare("legacy-share");
    db.close();
    db = await initializeProductDatabase(dbPath);
    assert.deepEqual(await db.query("SELECT id, body FROM innerlife_shares ORDER BY id;"), originals);
    assert.equal((await db.getInnerLifeProfileReadOnly("legacy-on")).enabled, true);
    assert.equal((await db.getInnerLifeProfileReadOnly("legacy-off")).enabled, false);
    assert.equal((await db.getInnerLifeShare("legacy-share")).status, "discarded");
    const legacyReceipt = JSON.parse((await db.query("SELECT metadata_json FROM innerlife_share_actions WHERE share_id='legacy-share';"))[0].metadata_json);
    assert.equal(legacyReceipt.previousStatus, originalLegacy.status);
    assert.equal(legacyReceipt.previousReason, originalLegacy.decision_reason);
    assert.equal(legacyReceipt.previousUpdatedAt, originalLegacy.updated_at);
    assert.equal((await db.ensureInnerLifeDaemonState("new-agent")).enabled, false);

    await db.setInnerLifeDaemonState({ agentId: "pool-a", action: "enable" });
    await db.setInnerLifeDaemonState({ agentId: "pool-b", action: "enable" });
    await db.setInnerLifeDaemonState({ agentId: "pool-a", action: "pause" });
    await assert.rejects(db.setInnerLifeDaemonState({ agentId: "pool-a", action: "pause", enabled: true }), /conflicts/);
    assert.equal((await db.getSettings())["innerlife.enabled"], true);
    assert.equal((await db.getInnerLifeProfileReadOnly("pool-a")).enabled, false);
    assert.equal((await db.getInnerLifeDaemonStateReadOnly("pool-b")).enabled, true, "Pausing A must not pause B.");
    await db.completeInnerLifeDaemonTickSuccess({ agentId: "pool-a" });
    await db.completeInnerLifeDaemonTickFailure({ agentId: "pool-a", error: "in-flight failure" });
    assert.equal((await db.ensureInnerLifeDaemonState("pool-a")).status, "paused", "In-flight completion must not revive a paused Agent.");
    await db.updateSettings({ "innerlife.enabled": false });
    assert.equal((await db.ensureInnerLifeDaemonState("pool-b")).enabled, false);
    assert.deepEqual(await db.listEnabledInnerLifeDaemonAgentIds(), []);
    await db.updateSettings({ "innerlife.enabled": true });
    assert.equal((await db.ensureInnerLifeDaemonState("pool-b")).enabled, true, "The global gate must preserve B's configured choice.");

    let modelCalls = 0;
    db.innerLifeGenerate = async () => { modelCalls++; return "NO_SHARE"; };
    const queued = {};
    for (const agent of ["pool-a", "pool-b"]) {
      const started = await db.startInnerLifeSession({ agentId: agent, externalSessionId: `after-${agent}` });
      queued[agent] = await db.endInnerLifeSession(started.session.id, { agentId: agent, summary: "Real fixture summary." });
    }
    await db.updateSettings({ "innerlife.enabled": false });
    assert.equal((await db.processPendingSessionAfterthoughts(5, { automated: true })).processed, 0);
    assert.equal(modelCalls, 0);
    await db.updateSettings({ "innerlife.enabled": true });
    assert.equal((await db.processPendingSessionAfterthoughts(5, { automated: true })).processed, 1);
    assert.equal((await db.getInnerLifeInboxItem(queued["pool-a"].afterthoughtJob.id)).status, "pending");
    assert.equal(modelCalls, 1, "Only the enabled Agent's background afterthought may invoke the model.");
    console.log("InnerLife candidate pool passed: per-Agent cap, TTL boundary, deferred/approved, preserved originals, read-only filtering, rollback, upgrade and background switch isolation.");
  } finally {
    db?.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
