const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const { DEFAULT_AGENT_ID, DEFAULT_INNERLIFE_API_KEY, DEFAULT_SETTINGS, WRITABLE_SETTINGS, normalizeSettingValue } = require("../config");
const { BUILD_FLAVOR, HAS_BUILT_IN_EMBEDDING, MEMORY_EMBEDDING_PROVIDERS } = require("../build-flavor");
const { sqliteCommand } = require("../sqlite-binary");
const { installInnerLifeRepository } = require("./repositories/innerlife");
const { installMemoriaRepository } = require("./repositories/memoria");
const { installContinuityRepository } = require("./repositories/continuity");
const { createSystemRepository } = require("./repositories/system");
const { createMemoryControllerRepository } = require("./repositories/memory-controller");
const { recordMigration, runMigrations } = require("./migrations");
const {
  cosineSimilarity,
  innerLifeRetrySeconds,
  jsonSql,
  likePattern,
  localDateForTimezone,
  meaningfulTokens,
  mergeTitleKey,
  newId,
  normalizeAgentId,
  normalizeLabels,
  normalizeMemoryRecordValue,
  normalizeSearchRows,
  normalizeSensitivity,
  overlapRatio,
  parseAwareDate,
  parseJson,
  parseVector,
  postJson,
  requiredText,
  resolveAgentIdentity,
  sqlString
} = require("./helpers");

const SCHEMA_ID = "001_product_core_schema";
const SQLITE_BUSY_TIMEOUT_MS = 30000;

const databaseLocks = new Map();

function tryBuiltinSqlite() {
  if (process.env.CLARACORE_DESKTOP_DISABLE_NODE_SQLITE === "1") {
    return null;
  }
  try {
    return require("node:sqlite");
  } catch (_error) {
    return null;
  }
}

async function runSqliteCli(dbPath, sql, json = false) {
  const args = ["-cmd", `.timeout ${SQLITE_BUSY_TIMEOUT_MS}`, ...(json ? ["-json"] : []), dbPath];
  const output = await new Promise((resolve, reject) => {
    const child = spawn(sqliteCommand(), args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `sqlite3 exited with code ${code}`));
      }
    });
    child.stdin.end(sql);
  });
  if (!json) return [];
  const text = output.trim();
  return text ? JSON.parse(text) : [];
}

async function withDatabaseLock(dbPath, operation) {
  const key = path.resolve(dbPath);
  const previous = databaseLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const chain = previous.catch(() => {}).then(() => current);
  databaseLocks.set(key, chain);
  await previous.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
    if (databaseLocks.get(key) === chain) {
      databaseLocks.delete(key);
    }
  }
}

class ProductDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.schemaPath = path.join(__dirname, "schema.sql");
    this.sqlite = tryBuiltinSqlite();
    this.connection = null;
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    await runMigrations(this, "before-schema");
    const schema = await fs.readFile(this.schemaPath, "utf8");
    await this.exec(schema);
    await recordMigration(this, SCHEMA_ID);
    await runMigrations(this, "after-schema");
    await this.seedDefaults();
    return this.getSummary();
  }

  openConnection() {
    if (this.connection) return this.connection;
    const db = new this.sqlite.DatabaseSync(this.dbPath);
    // WAL lets concurrent readers coexist with a single writer, and
    // busy_timeout makes a contended writer wait instead of failing
    // immediately with SQLITE_BUSY. Both are required for a long-running
    // Gateway serving multiple agents against one product database.
    // Set the wait policy before journal_mode. Multiple stdio Agents can open
    // the same database at once, and switching/confirming WAL itself may need
    // a write lock during their first connection.
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
    this.connection = db;
    return db;
  }

  close() {
    if (!this.connection) return;
    this.connection.close();
    this.connection = null;
  }

  async exec(sql) {
    return withDatabaseLock(this.dbPath, async () => {
      if (this.sqlite?.DatabaseSync) {
        const db = this.openConnection();
        db.exec(sql);
        return [];
      }
      return runSqliteCli(this.dbPath, sql, false);
    });
  }

  async query(sql) {
    return withDatabaseLock(this.dbPath, async () => {
      if (this.sqlite?.DatabaseSync) {
        const db = this.openConnection();
        return db.prepare(sql).all();
      }
      return runSqliteCli(this.dbPath, sql, true);
    });
  }

  async seedDefaults() {
    const settingsSql = Object.entries(DEFAULT_SETTINGS)
      .map(([key, value]) => {
        return `
          INSERT INTO app_settings (key, value_json)
          VALUES (${sqlString(key)}, ${jsonSql(value)})
          ON CONFLICT(key) DO NOTHING;
        `;
      })
      .join("\n");

    await this.exec(`
      INSERT INTO agents (id, label, role, status)
      VALUES
        ('codex', 'Codex', 'agent', 'active'),
        ('my-agent', 'My Agent', 'agent', 'active')
      ON CONFLICT(id) DO NOTHING;

      ${settingsSql}

      INSERT INTO secret_refs (key, provider, status, ref)
      VALUES
        ('memory.embedding.api_key', 'none', 'not-configured', NULL),
        ('innerlife.llm.api_key', 'deepseek', 'configured', ${sqlString(DEFAULT_INNERLIFE_API_KEY)})
      ON CONFLICT(key) DO NOTHING;
    `);
  }

  async agentReferenceCounts(agentId) {
    const id = normalizeAgentId(agentId);
    if (!id) return {};
    const tail = id.split(":").filter(Boolean).pop() || id;
    const labels = [`agent-id:${id}`, `agent:${tail}`];
    const labelList = labels.map(sqlString).join(", ");
    const rows = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM agents WHERE id = ${sqlString(id)}) AS agents,
        (SELECT COUNT(*) FROM continuity_lines WHERE agent_id = ${sqlString(id)}) AS continuity_lines,
        (SELECT COUNT(*) FROM continuity_agent_state WHERE agent_id = ${sqlString(id)}) AS continuity_agent_state,
        (SELECT COUNT(*) FROM innerlife_profiles WHERE agent_id = ${sqlString(id)}) AS innerlife_profiles,
        (SELECT COUNT(*) FROM innerlife_events WHERE agent_id = ${sqlString(id)}) AS innerlife_events,
        (SELECT COUNT(*) FROM innerlife_inbox WHERE agent_id = ${sqlString(id)}) AS innerlife_inbox,
        (SELECT COUNT(*) FROM innerlife_shares WHERE agent_id = ${sqlString(id)}) AS innerlife_shares,
        (SELECT COUNT(*) FROM innerlife_share_actions WHERE agent_id = ${sqlString(id)}) AS innerlife_share_actions,
        (SELECT COUNT(*) FROM innerlife_digest_runs WHERE agent_id = ${sqlString(id)}) AS innerlife_digest_runs,
        (SELECT COUNT(*) FROM innerlife_share_checks WHERE agent_id = ${sqlString(id)}) AS innerlife_share_checks,
        (SELECT COUNT(*) FROM innerlife_sessions WHERE agent_id = ${sqlString(id)}) AS innerlife_sessions,
        (SELECT COUNT(*) FROM innerlife_daemon_state WHERE agent_id = ${sqlString(id)}) AS innerlife_daemon_state,
        (SELECT COUNT(*) FROM gateway_sessions WHERE agent_id = ${sqlString(id)}) AS gateway_sessions,
        (SELECT COUNT(*) FROM gateway_traces WHERE agent_id = ${sqlString(id)}) AS gateway_traces,
        (SELECT COUNT(*) FROM memory_records WHERE source_agent = ${sqlString(id)}) AS memory_records,
        (SELECT COUNT(*) FROM memory_labels WHERE label IN (${labelList || "''"})) AS memory_labels;
    `);
    return rows[0] || {};
  }

  async mergeAgentIdentity(input = {}) {
    const sourceAgentId = normalizeAgentId(input.fromAgentId || input.from_agent_id || input.sourceAgentId || input.source_agent_id || "");
    const targetAgentId = normalizeAgentId(input.toAgentId || input.to_agent_id || input.targetAgentId || input.target_agent_id || "");
    if (!sourceAgentId) throw new Error("Source agent id is required.");
    if (!targetAgentId) throw new Error("Target agent id is required.");
    if (sourceAgentId === targetAgentId) throw new Error("Source and target agent ids are the same.");
    if (input.confirm !== true) throw new Error("Agent identity merge requires confirm=true.");

    const sourceBefore = await this.agentReferenceCounts(sourceAgentId);
    const targetBefore = await this.agentReferenceCounts(targetAgentId);
    const sourceTail = sourceAgentId.split(":").filter(Boolean).pop() || sourceAgentId;
    const targetTail = targetAgentId.split(":").filter(Boolean).pop() || targetAgentId;
    const positionMatchRows = await this.query(`
      SELECT COUNT(*) AS c
      FROM current_positions
      WHERE CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.agentId') ELSE NULL END = ${sqlString(sourceAgentId)};
    `);
    const currentPositionMetadataUpdated = Number(positionMatchRows[0]?.c || 0);

    await this.exec(`
      BEGIN IMMEDIATE;

      INSERT INTO agents (id, label, role, status)
      VALUES (${sqlString(targetAgentId)}, ${sqlString(targetTail)}, 'agent', 'active')
      ON CONFLICT(id) DO UPDATE SET
        label = CASE WHEN label = '' OR label = id THEN excluded.label ELSE label END,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP;

      UPDATE continuity_lines SET agent_id = ${sqlString(targetAgentId)}, updated_at = CURRENT_TIMESTAMP WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE innerlife_events SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE innerlife_inbox SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE innerlife_shares SET agent_id = ${sqlString(targetAgentId)}, updated_at = CURRENT_TIMESTAMP WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE innerlife_share_actions SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE innerlife_digest_runs SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE innerlife_share_checks SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE gateway_sessions SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE gateway_traces
      SET request_json = json_remove(
        json_set(CASE WHEN json_valid(request_json) THEN request_json ELSE '{}' END, '$.agentId', ${sqlString(targetAgentId)}),
        '$.agent_id'
      )
      WHERE agent_id = ${sqlString(sourceAgentId)}
         OR CASE WHEN json_valid(request_json) THEN json_extract(request_json, '$.agentId') ELSE NULL END = ${sqlString(sourceAgentId)}
         OR CASE WHEN json_valid(request_json) THEN json_extract(request_json, '$.agent_id') ELSE NULL END = ${sqlString(sourceAgentId)};
      UPDATE gateway_traces SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};
      UPDATE memory_records SET source_agent = ${sqlString(targetAgentId)}, updated_at = CURRENT_TIMESTAMP WHERE source_agent = ${sqlString(sourceAgentId)};

      UPDATE current_positions
      SET metadata_json = json_set(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.agentId', ${sqlString(targetAgentId)})
      WHERE CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.agentId') ELSE NULL END = ${sqlString(sourceAgentId)};

      UPDATE innerlife_sessions
      SET external_session_id = external_session_id || ':' || id
      WHERE agent_id = ${sqlString(sourceAgentId)}
        AND external_session_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM innerlife_sessions existing
          WHERE existing.agent_id = ${sqlString(targetAgentId)}
            AND existing.external_session_id = innerlife_sessions.external_session_id
        );
      UPDATE innerlife_sessions SET agent_id = ${sqlString(targetAgentId)} WHERE agent_id = ${sqlString(sourceAgentId)};

      INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at)
      SELECT ${sqlString(targetAgentId)}, display_name, enabled, profile_json, state_json, created_at, CURRENT_TIMESTAMP
      FROM innerlife_profiles
      WHERE agent_id = ${sqlString(sourceAgentId)}
        AND NOT EXISTS (SELECT 1 FROM innerlife_profiles WHERE agent_id = ${sqlString(targetAgentId)});
      DELETE FROM innerlife_profiles WHERE agent_id = ${sqlString(sourceAgentId)};

      INSERT INTO innerlife_daemon_state (agent_id, status, enabled, last_tick_at, next_run_at, last_result, last_error, tick_count, metadata_json, updated_at)
      SELECT ${sqlString(targetAgentId)}, status, enabled, last_tick_at, next_run_at, last_result, last_error, tick_count, metadata_json, CURRENT_TIMESTAMP
      FROM innerlife_daemon_state
      WHERE agent_id = ${sqlString(sourceAgentId)}
        AND NOT EXISTS (SELECT 1 FROM innerlife_daemon_state WHERE agent_id = ${sqlString(targetAgentId)});
      DELETE FROM innerlife_daemon_state WHERE agent_id = ${sqlString(sourceAgentId)};

      INSERT INTO continuity_agent_state (agent_id, communication_style, relationship_position, long_term_preferences_json, boundaries_json, stable_patterns_json, notes, updated_at)
      SELECT ${sqlString(targetAgentId)}, communication_style, relationship_position, long_term_preferences_json, boundaries_json, stable_patterns_json, notes, CURRENT_TIMESTAMP
      FROM continuity_agent_state
      WHERE agent_id = ${sqlString(sourceAgentId)}
        AND NOT EXISTS (SELECT 1 FROM continuity_agent_state WHERE agent_id = ${sqlString(targetAgentId)});
      DELETE FROM continuity_agent_state WHERE agent_id = ${sqlString(sourceAgentId)};

      INSERT OR IGNORE INTO memory_labels (memory_id, label)
      SELECT memory_id, ${sqlString(`agent-id:${targetAgentId}`)}
      FROM memory_labels
      WHERE label = ${sqlString(`agent-id:${sourceAgentId}`)};
      DELETE FROM memory_labels WHERE label = ${sqlString(`agent-id:${sourceAgentId}`)};

      INSERT OR IGNORE INTO memory_labels (memory_id, label)
      SELECT memory_id, ${sqlString(`agent:${targetTail}`)}
      FROM memory_labels
      WHERE label = ${sqlString(`agent:${sourceTail}`)};
      DELETE FROM memory_labels WHERE label = ${sqlString(`agent:${sourceTail}`)};

      DELETE FROM agents
      WHERE id = ${sqlString(sourceAgentId)}
        AND NOT EXISTS (SELECT 1 FROM continuity_lines WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM continuity_agent_state WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM innerlife_profiles WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM innerlife_events WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM innerlife_inbox WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM innerlife_shares WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM innerlife_digest_runs WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM innerlife_sessions WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM innerlife_daemon_state WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM gateway_sessions WHERE agent_id = ${sqlString(sourceAgentId)})
        AND NOT EXISTS (SELECT 1 FROM gateway_traces WHERE agent_id = ${sqlString(sourceAgentId)});

      COMMIT;
    `);

    return {
      sourceAgentId,
      targetAgentId,
      sourceBefore,
      targetBefore,
      sourceAfter: await this.agentReferenceCounts(sourceAgentId),
      targetAfter: await this.agentReferenceCounts(targetAgentId),
      currentPositionMetadataUpdated
    };
  }

}

Object.assign(ProductDatabase.prototype, createSystemRepository({
  BUILD_FLAVOR,
  DEFAULT_AGENT_ID,
  HAS_BUILT_IN_EMBEDDING,
  MEMORY_EMBEDDING_PROVIDERS,
  WRITABLE_SETTINGS,
  jsonSql,
  newId,
  normalizeSettingValue,
  parseJson,
  postJson,
  resolveAgentIdentity,
  sqlString
}));

Object.assign(ProductDatabase.prototype, createMemoryControllerRepository({
  jsonSql,
  newId,
  parseJson,
  resolveAgentIdentity,
  sqlString
}));

installMemoriaRepository(ProductDatabase, {
  cosineSimilarity,
  jsonSql,
  likePattern,
  localDateForTimezone,
  meaningfulTokens,
  mergeTitleKey,
  newId,
  normalizeLabels,
  normalizeMemoryRecordValue,
  normalizeSearchRows,
  normalizeSensitivity,
  overlapRatio,
  parseAwareDate,
  parseJson,
  parseVector,
  postJson,
  requiredText,
  resolveAgentIdentity,
  sqlString
});

installContinuityRepository(ProductDatabase, {
  DEFAULT_AGENT_ID,
  jsonSql,
  newId,
  parseJson,
  resolveAgentIdentity,
  sqlString
});

installInnerLifeRepository(ProductDatabase, {
  DEFAULT_AGENT_ID,
  innerLifeRetrySeconds,
  jsonSql,
  meaningfulTokens,
  newId,
  parseJson,
  resolveAgentIdentity,
  sqlString
});

async function initializeProductDatabase(dbPath) {
  const database = new ProductDatabase(dbPath);
  await database.initialize();
  return database;
}

module.exports = {
  DEFAULT_SETTINGS,
  ProductDatabase,
  WRITABLE_SETTINGS,
  initializeProductDatabase
};
