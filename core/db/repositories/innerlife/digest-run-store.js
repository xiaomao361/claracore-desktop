const DIGEST_RUN_RETENTION_PER_AGENT = 200;

function createInnerLifeDigestRunStore(helpers) {
  const {
    jsonSql,
    sqlString
  } = helpers;

  async function persist(database, input) {
    await database.exec(`
      INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, input_json, summary, completed_at, metadata_json)
      VALUES (
        ${sqlString(input.digestId)},
        ${sqlString(input.agentId)},
        ${sqlString(input.mode)},
        'completed',
        ${jsonSql(input.request)},
        ${sqlString(input.summary)},
        CURRENT_TIMESTAMP,
        ${jsonSql({
          lineId: input.resumePacket.lineId,
          positionId: input.resumePacket.currentPosition.positionId,
          sharedLineStatus: input.sharedLineContext.status,
          candidateLineIds: input.sharedLineContext.candidateLineIds,
          memoryIds: input.memories.map((memory) => memory.id),
          inboxIds: input.inboxItems.map((item) => item.id),
          generationSource: input.generated.source,
          generationTier: input.generated.tier
        })}
      );

      INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
      VALUES (
        ${sqlString(input.eventId)},
        ${sqlString(input.agentId)},
        'digest',
        ${sqlString(input.prompt || "Manual digest")},
        'processed',
        ${jsonSql({
          digestId: input.digestId,
          inboxIds: input.inboxItems.map((item) => item.id)
        })}
      );

      INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
      VALUES (
        ${sqlString(input.thoughtId)},
        ${sqlString(input.eventId)},
        ${sqlString(input.summary)},
        'unreviewed'
      );
    `);
    if (input.inboxItems.length > 0) {
      await database.exec(`
        UPDATE innerlife_inbox
        SET status = 'processed',
            processed_at = CURRENT_TIMESTAMP
        WHERE id IN (${input.inboxItems.map((item) => sqlString(item.id)).join(", ")});
      `);
    }
  }

  async function prune(database, agentId, keep = DIGEST_RUN_RETENTION_PER_AGENT) {
    const id = String(agentId || "").trim();
    if (!id) return;
    const safeLimit = Math.max(
      1,
      Number.parseInt(String(keep), 10) || DIGEST_RUN_RETENTION_PER_AGENT
    );
    await database.exec(`
      DELETE FROM innerlife_digest_runs
      WHERE agent_id = ${sqlString(id)}
        AND id NOT IN (
          SELECT id FROM innerlife_digest_runs
          WHERE agent_id = ${sqlString(id)}
          ORDER BY created_at DESC, id DESC
          LIMIT ${safeLimit}
        );
    `);
  }

  return Object.freeze({
    persist,
    prune
  });
}

module.exports = {
  createInnerLifeDigestRunStore
};
