const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const fsSync = require("fs");
const os = require("os");
const { sqliteVecExtensionPath, SQLITE_VEC_VERSION } = require("../sqlite-vec-extension");
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
  ambiguousSharedLineError,
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

async function runSqliteCli(dbPath, sql, json = false, extensionPath = "") {
  const extensionArgs = extensionPath
    ? ["-cmd", `.load "${extensionPath.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`]
    : [];
  const args = ["-bail", "-cmd", `.timeout ${SQLITE_BUSY_TIMEOUT_MS}`, ...extensionArgs, ...(json ? ["-json"] : []), dbPath];
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
    // Opt-in until the product and packaged performance gates are complete.
    this.vectorEngine = process.env.CLARACORE_DESKTOP_VECTOR_ENGINE || "sqlite-vec";
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
    // Set the wait policy before journal_mode. Independent maintenance processes can open
    // the same database at once, and switching/confirming WAL itself may need
    // a write lock during their first connection.
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
    this.connection = db;
    return db;
  }

  close() {
    this.connection?.close();
    this.connection = null;
    this.vectorConnection?.close();
    this.vectorConnection = null;
    if (this.vectorCacheRoot) fsSync.rmSync(this.vectorCacheRoot, { recursive: true, force: true });
    this.vectorCacheRoot = null;
    this.vectorIdOrders?.clear();
  }

  async queryVectorProjection(setupSql, selectSql) {
    return withDatabaseLock(this.dbPath, async () => {
      const extensionPath = sqliteVecExtensionPath();
      if (!this.vectorCacheRoot) this.vectorCacheRoot = fsSync.mkdtempSync(path.join(os.tmpdir(), "claracore-vector-cache-"));
      const cachePath = path.join(this.vectorCacheRoot, "projection.db");
      // Main is only read in this transaction. BEGIN IMMEDIATE prevents a
      // concurrent embedding writer from changing the source between rebuild
      // and query. The cache is disposable; cross-database crash atomicity is
      // not relied on. A new ProductDatabase instance always gets a fresh cache.
      const attachSql = `ATTACH DATABASE ${sqlString(cachePath)} AS vector_cache;`;
      const beforeSql = `BEGIN IMMEDIATE; ${setupSql}`;
      if (!this.sqlite?.DatabaseSync) {
        try {
          return await runSqliteCli(this.dbPath, `${attachSql} ${beforeSql} ${selectSql} COMMIT;`, true, extensionPath);
        } catch (error) {
          fsSync.rmSync(this.vectorCacheRoot, { recursive: true, force: true });
          this.vectorCacheRoot = null;
          throw error;
        }
      }
      if (!this.vectorConnection) {
        const connection = new this.sqlite.DatabaseSync(this.dbPath, { allowExtension: true });
        try {
          connection.loadExtension(extensionPath);
          connection.enableLoadExtension(false);
          const version = connection.prepare("SELECT vec_version() AS version").get().version;
          if (version !== `v${SQLITE_VEC_VERSION}`) throw new Error(`Unexpected sqlite-vec version: ${version}`);
          connection.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}; ${attachSql}`);
          this.vectorConnection = connection;
        } catch (error) { connection.close(); throw error; }
      }
      const connection = this.vectorConnection;
      try {
        connection.exec(beforeSql);
        const rows = connection.prepare(selectSql).all();
        connection.exec("COMMIT;");
        return rows;
      } catch (error) {
        try { connection.exec("ROLLBACK;"); } catch (_rollbackError) { /* The original error owns this failed request. */ }
        // Never reuse a connection/cache after an uncertain failed transaction.
        connection.close();
        this.vectorConnection = null;
        fsSync.rmSync(this.vectorCacheRoot, { recursive: true, force: true });
        this.vectorCacheRoot = null;
        throw error;
      }
    });
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
  ambiguousSharedLineError,
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
