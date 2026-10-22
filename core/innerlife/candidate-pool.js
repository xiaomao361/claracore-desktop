const CANDIDATE_LIMIT = 10;
const CANDIDATE_MAX_AGE_DAYS = 7;
const CANDIDATE_STATUSES_SQL = "('approved', 'pending', 'deferred')";
const CANDIDATE_ORDER_SQL = "CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, datetime(created_at) DESC, id DESC";

// Shared by the upgrade, write triggers and scheduled maintenance. Never delete
// a thought or share, and never claim that retiring a candidate delivered it.
function candidateRetirementSql(agentSql = "NULL") {
  if (!["NULL", "NEW.agent_id"].includes(agentSql)) throw new Error("Unsupported candidate retention scope.");
  const scope = `(${agentSql} IS NULL OR agent_id = ${agentSql})`;
  const expired = `${scope} AND status IN ${CANDIDATE_STATUSES_SQL}
    AND (datetime(created_at) IS NULL OR datetime(created_at) <= datetime('now', '-${CANDIDATE_MAX_AGE_DAYS} days'))`;
  const ageReason = `CASE WHEN datetime(created_at) IS NULL
    THEN 'Automatic candidate retention: invalid_created_at'
    ELSE 'Automatic candidate retention: expired_after_7_days' END`;
  const overflow = `id IN (SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY ${CANDIDATE_ORDER_SQL}) AS candidate_rank
    FROM innerlife_shares WHERE ${scope} AND status IN ${CANDIDATE_STATUSES_SQL}
  ) WHERE candidate_rank > ${CANDIDATE_LIMIT})`;
  return `
    INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, metadata_json)
    SELECT 'retention_' || lower(hex(randomblob(16))), id, agent_id, 'discarded', ${ageReason},
           json_object('source', 'candidate_retention', 'previousStatus', status,
             'previousReason', decision_reason, 'previousUpdatedAt', updated_at)
    FROM innerlife_shares WHERE ${expired};
    UPDATE innerlife_shares SET status = 'discarded', decision_reason = ${ageReason}, updated_at = CURRENT_TIMESTAMP
    WHERE ${expired};
    INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, metadata_json)
    SELECT 'retention_' || lower(hex(randomblob(16))), id, agent_id, 'discarded',
           'Automatic candidate retention: capacity_10_per_agent',
           json_object('source', 'candidate_retention', 'previousStatus', status,
             'previousReason', decision_reason, 'previousUpdatedAt', updated_at)
    FROM innerlife_shares WHERE ${overflow};
    UPDATE innerlife_shares SET status = 'discarded',
      decision_reason = 'Automatic candidate retention: capacity_10_per_agent', updated_at = CURRENT_TIMESTAMP
    WHERE ${overflow};
  `;
}

const CANDIDATE_SCHEMA_SQL = `
  CREATE INDEX IF NOT EXISTS idx_innerlife_current_candidates
    ON innerlife_shares(agent_id, status, created_at, id)
    WHERE status IN ${CANDIDATE_STATUSES_SQL};
  CREATE VIEW IF NOT EXISTS innerlife_share_candidates AS
  SELECT id, agent_id, status, created_at, updated_at FROM (
    SELECT id, agent_id, status, created_at, updated_at,
      ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY ${CANDIDATE_ORDER_SQL}) AS candidate_rank
    FROM innerlife_shares
    WHERE status IN ${CANDIDATE_STATUSES_SQL}
      AND datetime(created_at) > datetime('now', '-${CANDIDATE_MAX_AGE_DAYS} days')
  ) WHERE candidate_rank <= ${CANDIDATE_LIMIT};
  CREATE TRIGGER IF NOT EXISTS innerlife_candidate_insert AFTER INSERT ON innerlife_shares
  WHEN NEW.status IN ${CANDIDATE_STATUSES_SQL}
  BEGIN ${candidateRetirementSql("NEW.agent_id")} END;
  CREATE TRIGGER IF NOT EXISTS innerlife_candidate_update AFTER UPDATE OF status, created_at, agent_id ON innerlife_shares
  WHEN NEW.status IN ${CANDIDATE_STATUSES_SQL}
  BEGIN ${candidateRetirementSql("NEW.agent_id")} END;
`;

module.exports = { CANDIDATE_LIMIT, CANDIDATE_MAX_AGE_DAYS, CANDIDATE_SCHEMA_SQL, candidateRetirementSql };
