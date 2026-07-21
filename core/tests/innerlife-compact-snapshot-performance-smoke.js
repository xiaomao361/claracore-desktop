const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { initializeProductDatabase } = require("../db/database");

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-innerlife-compact-"));
  const database = await initializeProductDatabase(path.join(root, "claracore.db"));
  try {
    await database.updateInnerLifeProfile({ agentId: "compact-agent", displayName: "Compact Agent" });
    const largeText = "payload-".repeat(6000);
    const largeJson = JSON.stringify({ largeText });
    const statements = [];
    for (let index = 0; index < 20; index += 1) {
      statements.push(`
        INSERT INTO innerlife_sessions
          (id, agent_id, external_session_id, status, briefing_json, summary, metadata_json, started_at, ended_at)
        VALUES
          ('compact-session-${index}', 'compact-agent', 'external-${index}', 'ended', ${sqlString(largeJson)}, ${sqlString(largeText)}, ${sqlString(largeJson)}, datetime('now', '-${index} minutes'), CURRENT_TIMESTAMP);

        INSERT INTO innerlife_inbox
          (id, agent_id, source, body, status, metadata_json, created_at, processed_at)
        VALUES
          ('compact-inbox-${index}', 'compact-agent', 'smoke', ${sqlString(largeText)}, 'processed', ${sqlString(largeJson)}, datetime('now', '-${index} minutes'), CURRENT_TIMESTAMP);

        INSERT INTO innerlife_digest_runs
          (id, agent_id, mode, status, input_json, summary, metadata_json, created_at, completed_at)
        VALUES
          ('compact-digest-${index}', 'compact-agent', 'smoke', 'completed', ${sqlString(largeJson)}, ${sqlString(largeText)}, ${sqlString(largeJson)}, datetime('now', '-${index} minutes'), CURRENT_TIMESTAMP);

        INSERT INTO innerlife_share_checks
          (id, agent_id, context, decision, reason, metadata_json, created_at)
        VALUES
          ('compact-check-${index}', 'compact-agent', ${sqlString(largeText)}, 'defer', ${sqlString(largeText)}, ${sqlString(largeJson)}, datetime('now', '-${index} minutes'));
      `);
    }
    await database.exec(statements.join("\n"));

    const snapshot = await database.getInnerLifeSnapshot("compact-agent");
    const payloadBytes = Buffer.byteLength(JSON.stringify(snapshot));
    assert.ok(payloadBytes <= 160 * 1024, `InnerLife detail payload is ${payloadBytes} bytes.`);
    assert.strictEqual(snapshot.sessions[0].briefing, undefined);
    assert.strictEqual(snapshot.sessions[0].metadata, undefined);
    assert.strictEqual(snapshot.inbox[0].metadata, undefined);
    assert.strictEqual(snapshot.digestRuns[0].input, undefined);
    assert.strictEqual(snapshot.digestRuns[0].metadata, undefined);
    assert.strictEqual(snapshot.shareChecks[0].context, undefined);
    assert.strictEqual(snapshot.shareChecks[0].metadata, undefined);

    const [session, inbox, digest, check] = await Promise.all([
      database.getInnerLifeSession("compact-session-0"),
      database.getInnerLifeInboxItem("compact-inbox-0"),
      database.getInnerLifeDigestRun("compact-digest-0"),
      database.getInnerLifeShareCheck("compact-check-0")
    ]);
    assert.strictEqual(session.briefing.largeText, largeText);
    assert.strictEqual(inbox.metadata.largeText, largeText);
    assert.strictEqual(digest.input.largeText, largeText);
    assert.strictEqual(check.context, largeText);

    process.stdout.write(`${JSON.stringify({
      suite: "innerlife-compact-snapshot-performance-smoke",
      payloadBytes,
      thresholdBytes: 160 * 1024,
      fullDetailPreserved: true
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
