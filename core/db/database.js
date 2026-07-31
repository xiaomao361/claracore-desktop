const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const {
  DEFAULT_AGENT_ID,
  DEFAULT_INNERLIFE_API_KEY,
  DEFAULT_SETTINGS,
  WRITABLE_SETTINGS,
  normalizeSettingValue,
  resolveMaintenanceHour
} = require("../config");
const { BUILD_FLAVOR, HAS_BUILT_IN_EMBEDDING, MEMORY_EMBEDDING_PROVIDERS } = require("../build-flavor");
const { sqliteCommand } = require("../sqlite-binary");
const { installInnerLifeRepository } = require("./repositories/innerlife");
const { installMemoriaRepository } = require("./repositories/memoria");
const { installContinuityRepository } = require("./repositories/continuity");
const { createSystemRepository } = require("./repositories/system");
const { createMemoryControllerRepository } = require("./repositories/memory-controller");
const { installRepositoryMethods } = require("./repository-installer");
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
  const args = ["-bail", "-cmd", `.timeout ${SQLITE_BUSY_TIMEOUT_MS}`, ...(json ? ["-json"] : []), dbPath];
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
    return this;
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

}

installRepositoryMethods(ProductDatabase, "system", createSystemRepository({
  BUILD_FLAVOR,
  DEFAULT_AGENT_ID,
  HAS_BUILT_IN_EMBEDDING,
  MEMORY_EMBEDDING_PROVIDERS,
  WRITABLE_SETTINGS,
  jsonSql,
  newId,
  normalizeAgentId,
  normalizeSettingValue,
  parseJson,
  postJson,
  resolveMaintenanceHour,
  resolveAgentIdentity,
  sqlString
}));

installRepositoryMethods(ProductDatabase, "memory-controller", createMemoryControllerRepository({
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
