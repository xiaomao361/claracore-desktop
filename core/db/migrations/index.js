const { sqlString } = require("../helpers");
const gatewayTraceCompatibility = require("./000_gateway_trace_compatibility");
const productAdditions = require("./002_product_additions");
const multiAgentCallerContext = require("./003_multi_agent_caller_context");

const MIGRATIONS = [gatewayTraceCompatibility, productAdditions, multiAgentCallerContext];

async function ensureMigrationTable(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function recordMigration(database, id) {
  await database.exec(`
    INSERT INTO schema_migrations (id)
    VALUES (${sqlString(id)})
    ON CONFLICT(id) DO NOTHING;
  `);
}

async function appliedMigrationIds(database) {
  const rows = await database.query("SELECT id FROM schema_migrations ORDER BY applied_at, id;");
  return new Set(rows.map((row) => row.id));
}

async function runMigrations(database, phase) {
  await ensureMigrationTable(database);
  const applied = await appliedMigrationIds(database);
  for (const migration of MIGRATIONS.filter((item) => item.phase === phase)) {
    if (applied.has(migration.id)) continue;
    await migration.up(database);
    await recordMigration(database, migration.id);
    applied.add(migration.id);
  }
}

module.exports = { ensureMigrationTable, recordMigration, runMigrations };
