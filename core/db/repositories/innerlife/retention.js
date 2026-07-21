const DEFAULT_INNERLIFE_RETENTION = Object.freeze({
  processedInboxMaxAgeDays: 30,
  processedInboxMaxRowsPerAgent: 500,
  endedSessionMaxAgeDays: 180,
  endedSessionMaxRowsPerAgent: 200,
  shareCheckMaxAgeDays: 30,
  shareCheckMaxRowsPerAgent: 500,
  digestRunMaxRowsPerAgent: 200
});

function boundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function createInnerLifeRetentionRepository({ sqlString }) {
  return {
    async getInnerLifeRetentionCounts() {
      const rows = await this.query(`
        SELECT
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'processed') AS processed_inbox,
          (SELECT COUNT(*) FROM innerlife_inbox WHERE status IN ('pending', 'processing')) AS protected_inbox,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'ended') AS ended_sessions,
          (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'active') AS active_sessions,
          (SELECT COUNT(*) FROM innerlife_share_checks) AS share_checks,
          (SELECT COUNT(*) FROM innerlife_digest_runs) AS digest_runs;
      `);
      return rows[0] || {};
    },

    async cleanupInnerLifeHistory(input = {}) {
      const policy = {
        processedInboxMaxAgeDays: boundedInteger(
          input.processedInboxMaxAgeDays || input.processed_inbox_max_age_days,
          DEFAULT_INNERLIFE_RETENTION.processedInboxMaxAgeDays,
          3650
        ),
        processedInboxMaxRowsPerAgent: boundedInteger(
          input.processedInboxMaxRowsPerAgent || input.processed_inbox_max_rows_per_agent,
          DEFAULT_INNERLIFE_RETENTION.processedInboxMaxRowsPerAgent,
          100000
        ),
        endedSessionMaxAgeDays: boundedInteger(
          input.endedSessionMaxAgeDays || input.ended_session_max_age_days,
          DEFAULT_INNERLIFE_RETENTION.endedSessionMaxAgeDays,
          3650
        ),
        endedSessionMaxRowsPerAgent: boundedInteger(
          input.endedSessionMaxRowsPerAgent || input.ended_session_max_rows_per_agent,
          DEFAULT_INNERLIFE_RETENTION.endedSessionMaxRowsPerAgent,
          100000
        ),
        shareCheckMaxAgeDays: boundedInteger(
          input.shareCheckMaxAgeDays || input.share_check_max_age_days,
          DEFAULT_INNERLIFE_RETENTION.shareCheckMaxAgeDays,
          3650
        ),
        shareCheckMaxRowsPerAgent: boundedInteger(
          input.shareCheckMaxRowsPerAgent || input.share_check_max_rows_per_agent,
          DEFAULT_INNERLIFE_RETENTION.shareCheckMaxRowsPerAgent,
          100000
        ),
        digestRunMaxRowsPerAgent: boundedInteger(
          input.digestRunMaxRowsPerAgent || input.digest_run_max_rows_per_agent,
          DEFAULT_INNERLIFE_RETENTION.digestRunMaxRowsPerAgent,
          100000
        )
      };
      const before = await this.getInnerLifeRetentionCounts();

      await this.exec(`
        DELETE FROM innerlife_inbox
        WHERE status = 'processed'
          AND datetime(COALESCE(processed_at, created_at)) < datetime('now', ${sqlString(`-${policy.processedInboxMaxAgeDays} days`)});

        DELETE FROM innerlife_sessions
        WHERE status = 'ended'
          AND datetime(COALESCE(ended_at, started_at)) < datetime('now', ${sqlString(`-${policy.endedSessionMaxAgeDays} days`)});

        DELETE FROM innerlife_share_checks
        WHERE datetime(created_at) < datetime('now', ${sqlString(`-${policy.shareCheckMaxAgeDays} days`)});
      `);
      const afterAge = await this.getInnerLifeRetentionCounts();

      await this.exec(`
        DELETE FROM innerlife_inbox
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY agent_id
                     ORDER BY datetime(COALESCE(processed_at, created_at)) DESC, id DESC
                   ) AS row_number
            FROM innerlife_inbox
            WHERE status = 'processed'
          ) ranked
          WHERE row_number > CAST(${sqlString(policy.processedInboxMaxRowsPerAgent)} AS INTEGER)
        );

        DELETE FROM innerlife_share_checks
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY agent_id
                     ORDER BY datetime(created_at) DESC, id DESC
                   ) AS row_number
            FROM innerlife_share_checks
          ) ranked
          WHERE row_number > CAST(${sqlString(policy.shareCheckMaxRowsPerAgent)} AS INTEGER)
        );

        DELETE FROM innerlife_sessions
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY agent_id
                     ORDER BY datetime(COALESCE(ended_at, started_at)) DESC, id DESC
                   ) AS row_number
            FROM innerlife_sessions
            WHERE status = 'ended'
          ) ranked
          WHERE row_number > CAST(${sqlString(policy.endedSessionMaxRowsPerAgent)} AS INTEGER)
        );

        DELETE FROM innerlife_digest_runs
        WHERE id IN (
          SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY agent_id
                     ORDER BY datetime(created_at) DESC, id DESC
                   ) AS row_number
            FROM innerlife_digest_runs
          ) ranked
          WHERE row_number > CAST(${sqlString(policy.digestRunMaxRowsPerAgent)} AS INTEGER)
        );
      `);
      const after = await this.getInnerLifeRetentionCounts();
      const ageDeleted = {
        processedInbox: before.processed_inbox - afterAge.processed_inbox,
        endedSessions: before.ended_sessions - afterAge.ended_sessions,
        shareChecks: before.share_checks - afterAge.share_checks
      };
      const capacityDeleted = {
        processedInbox: afterAge.processed_inbox - after.processed_inbox,
        endedSessions: afterAge.ended_sessions - after.ended_sessions,
        shareChecks: afterAge.share_checks - after.share_checks,
        digestRuns: afterAge.digest_runs - after.digest_runs
      };
      const deleted = Object.values(ageDeleted).reduce((sum, value) => sum + value, 0)
        + Object.values(capacityDeleted).reduce((sum, value) => sum + value, 0);
      return {
        policy,
        deleted,
        reasons: { age: ageDeleted, capacity: capacityDeleted },
        before,
        after
      };
    }
  };
}

module.exports = {
  DEFAULT_INNERLIFE_RETENTION,
  createInnerLifeRetentionRepository
};
