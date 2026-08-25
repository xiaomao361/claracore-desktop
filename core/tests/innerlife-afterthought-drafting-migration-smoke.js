const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { ProductDatabase } = require("../db/database");

const MIGRATION_ID = "008_innerlife_afterthought_drafting";

async function queueAfterthought(database, externalSessionId, summary) {
  const started = await database.startInnerLifeSession({
    agentId: "migration-agent",
    externalSessionId
  });
  return database.endInnerLifeSession(started.session.id, {
    agentId: "migration-agent",
    summary
  });
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-afterthought-drafting-migration-"));
  const databasePath = path.join(dataRoot, "claracore.db");
  let database = new ProductDatabase(databasePath);
  try {
    await database.initialize();

    const unfinished = await queueAfterthought(
      database,
      "legacy-unfinished",
      "Legacy placeholder still waiting for generation."
    );
    const terminal = await queueAfterthought(
      database,
      "legacy-terminal",
      "Legacy placeholder whose generation reached terminal failure."
    );
    const completed = await queueAfterthought(
      database,
      "legacy-completed",
      "Legacy afterthought that already completed successfully."
    );

    await database.exec(`
      UPDATE innerlife_shares
      SET status = 'pending'
      WHERE id IN ('${unfinished.share.id}', '${terminal.share.id}', '${completed.share.id}');

      UPDATE innerlife_inbox
      SET status = 'failed',
          metadata_json = json_set(metadata_json, '$.retryState', 'terminal')
      WHERE id = '${terminal.afterthoughtJob.id}';

      UPDATE innerlife_inbox
      SET status = 'processed',
          metadata_json = json_set(metadata_json, '$.retryState', 'succeeded')
      WHERE id = '${completed.afterthoughtJob.id}';

      INSERT INTO innerlife_thoughts (id, body, review_status)
      VALUES ('ordinary-pending-thought', 'Ordinary complete thought.', 'unreviewed');

      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
      VALUES ('ordinary-pending-share', 'migration-agent', 'ordinary-pending-thought', 'pending', 'Ordinary complete thought.');

      DELETE FROM schema_migrations WHERE id = '${MIGRATION_ID}';
    `);
    database.close();

    database = new ProductDatabase(databasePath);
    await database.initialize();

    assert.strictEqual((await database.getInnerLifeShare(unfinished.share.id)).status, "drafting");
    assert.strictEqual((await database.getInnerLifeShare(terminal.share.id)).status, "drafting");
    assert.strictEqual((await database.getInnerLifeShare(completed.share.id)).status, "pending");
    assert.strictEqual((await database.getInnerLifeShare("ordinary-pending-share")).status, "pending");

    console.log(JSON.stringify({
      suite: "innerlife-afterthought-drafting-migration-smoke",
      migration: MIGRATION_ID,
      migrated: [unfinished.share.id, terminal.share.id],
      preserved: [completed.share.id, "ordinary-pending-share"]
    }, null, 2));
  } finally {
    database.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
