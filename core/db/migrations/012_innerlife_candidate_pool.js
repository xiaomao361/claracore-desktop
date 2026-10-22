const { CANDIDATE_SCHEMA_SQL, candidateRetirementSql } = require("../../innerlife/candidate-pool");

module.exports = {
  id: "012_innerlife_candidate_pool",
  phase: "after-schema",
  async up(database) {
    await database.execAtomic(`
      ${CANDIDATE_SCHEMA_SQL}
      ${candidateRetirementSql()}
      -- The daemon held the actual running choice in previous versions. Keep
      -- that choice on upgrade, including enabled daemons with a stale profile.
      UPDATE innerlife_profiles
      SET enabled = (SELECT enabled FROM innerlife_daemon_state d WHERE d.agent_id = innerlife_profiles.agent_id)
      WHERE EXISTS (SELECT 1 FROM innerlife_daemon_state d WHERE d.agent_id = innerlife_profiles.agent_id);
      `);
  }
};
