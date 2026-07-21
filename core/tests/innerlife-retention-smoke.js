const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-innerlife-retention-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  try {
    await database.exec(`
      INSERT INTO agents (id, label) VALUES ('retention-a', 'Retention A');

      INSERT INTO innerlife_inbox (id, agent_id, source, body, status, created_at, processed_at) VALUES
        ('inbox-old', 'retention-a', 'test', 'old processed', 'processed', datetime('now', '-40 days'), datetime('now', '-40 days')),
        ('inbox-1', 'retention-a', 'test', 'recent 1', 'processed', datetime('now', '-3 days'), datetime('now', '-3 days')),
        ('inbox-2', 'retention-a', 'test', 'recent 2', 'processed', datetime('now', '-2 days'), datetime('now', '-2 days')),
        ('inbox-3', 'retention-a', 'test', 'recent 3', 'processed', datetime('now', '-1 day'), datetime('now', '-1 day')),
        ('inbox-pending', 'retention-a', 'test', 'protected pending', 'pending', datetime('now', '-400 days'), NULL),
        ('inbox-processing', 'retention-a', 'test', 'protected processing', 'processing', datetime('now', '-400 days'), datetime('now'));

      INSERT INTO innerlife_sessions (id, agent_id, status, started_at, ended_at) VALUES
        ('session-old', 'retention-a', 'ended', datetime('now', '-400 days'), datetime('now', '-300 days')),
        ('session-1', 'retention-a', 'ended', datetime('now', '-4 days'), datetime('now', '-3 days')),
        ('session-2', 'retention-a', 'ended', datetime('now', '-3 days'), datetime('now', '-2 days')),
        ('session-3', 'retention-a', 'ended', datetime('now', '-2 days'), datetime('now', '-1 day')),
        ('session-active', 'retention-a', 'active', datetime('now', '-400 days'), NULL);

      INSERT INTO innerlife_share_checks (id, agent_id, context, decision, created_at) VALUES
        ('check-old', 'retention-a', '', 'none', datetime('now', '-40 days')),
        ('check-1', 'retention-a', '', 'none', datetime('now', '-3 days')),
        ('check-2', 'retention-a', '', 'none', datetime('now', '-2 days')),
        ('check-3', 'retention-a', '', 'none', datetime('now', '-1 day'));

      INSERT INTO innerlife_digest_runs (id, agent_id, created_at) VALUES
        ('digest-1', 'retention-a', datetime('now', '-4 days')),
        ('digest-2', 'retention-a', datetime('now', '-3 days')),
        ('digest-3', 'retention-a', datetime('now', '-2 days')),
        ('digest-4', 'retention-a', datetime('now', '-1 day'));
    `);

    const first = await database.cleanupInnerLifeHistory({
      processedInboxMaxAgeDays: 30,
      processedInboxMaxRowsPerAgent: 2,
      endedSessionMaxAgeDays: 180,
      endedSessionMaxRowsPerAgent: 2,
      shareCheckMaxAgeDays: 30,
      shareCheckMaxRowsPerAgent: 2,
      digestRunMaxRowsPerAgent: 2
    });
    assert.strictEqual(first.deleted, 8);
    assert.deepStrictEqual(first.reasons.age, {
      processedInbox: 1,
      endedSessions: 1,
      shareChecks: 1
    });
    assert.deepStrictEqual(first.reasons.capacity, {
      processedInbox: 1,
      endedSessions: 1,
      shareChecks: 1,
      digestRuns: 2
    });
    assert.strictEqual(first.after.processed_inbox, 2);
    assert.strictEqual(first.after.protected_inbox, 2);
    assert.strictEqual(first.after.ended_sessions, 2);
    assert.strictEqual(first.after.active_sessions, 1);
    assert.strictEqual(first.after.share_checks, 2);
    assert.strictEqual(first.after.digest_runs, 2);

    const protectedRows = await database.query(`
      SELECT id FROM innerlife_inbox WHERE id IN ('inbox-pending', 'inbox-processing')
      UNION ALL
      SELECT id FROM innerlife_sessions WHERE id = 'session-active'
      ORDER BY id;
    `);
    assert.deepStrictEqual(protectedRows.map((row) => row.id), ["inbox-pending", "inbox-processing", "session-active"]);

    const second = await database.cleanupInnerLifeHistory({
      processedInboxMaxAgeDays: 30,
      processedInboxMaxRowsPerAgent: 2,
      endedSessionMaxAgeDays: 180,
      endedSessionMaxRowsPerAgent: 2,
      shareCheckMaxAgeDays: 30,
      shareCheckMaxRowsPerAgent: 2,
      digestRunMaxRowsPerAgent: 2
    });
    assert.strictEqual(second.deleted, 0, "InnerLife retention is not idempotent.");
    process.stdout.write(`${JSON.stringify({
      suite: "innerlife-retention-smoke",
      first,
      secondDeleted: second.deleted,
      protectedIds: protectedRows.map((row) => row.id)
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
