const { sqlString, jsonSql } = require("../../helpers");

// Executed inside BEGIN IMMEDIATE with the domain write. A timestamp is not a
// revision: SQLite writes within the same second can still contain new content.
function positionGuardSql(lineId, expected) {
  if (!expected) return "";
  return `
    CREATE TEMP TABLE understanding_position_guard (
      valid INTEGER CONSTRAINT understanding_position_changed CHECK(valid = 1)
    );
    INSERT INTO understanding_position_guard(valid)
    SELECT EXISTS (
      SELECT 1 FROM continuity_lines l LEFT JOIN current_positions p ON p.line_id = l.id
      WHERE l.id = ${sqlString(lineId)} AND l.status = 'active'
        AND COALESCE(p.summary, '') = ${sqlString(expected.summary || "")}
        AND COALESCE(p.interpretation_status, 'draft') = ${sqlString(expected.interpretationStatus || "draft")}
        AND COALESCE(p.facts_used_json, '[]') = ${jsonSql(expected.factsUsed || [])}
        AND COALESCE(p.metadata_json, '{}') = ${jsonSql(expected.metadata || {})}
    );
    DROP TABLE understanding_position_guard;
  `;
}
async function guardedWrite(database, sql, expected) {
  if (!expected) return database.exec(sql);
  try { return await database.execAtomic(sql); }
  catch (error) {
    if (/understanding_(?:position|line_catalog)_changed/u.test(String(error.message))) throw Object.assign(new Error("Shared Line changed after planning."), { code: "conflict" });
    throw error;
  }
}
module.exports = { positionGuardSql, guardedWrite };
