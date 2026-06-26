const { spawn } = require("child_process");
const fs = require("fs/promises");
const http = require("http");
const path = require("path");

const SCHEMA_ID = "001_product_core_schema";

const DEFAULT_SETTINGS = {
  "memory.embedding.provider": "ollama",
  "memory.embedding.base_url": "http://127.0.0.1:11434",
  "memory.embedding.model": "bge-m3",
  "memory.embedding.dimension": 1024,
  "memory.embedding.max_chars": 2000,
  "memory.maintenance.enabled": true,
  "memory.maintenance.hour": 3,
  "memory.maintenance.last_run_date": "",
  "innerlife.enabled": false,
  "innerlife.provider": "disabled",
  "innerlife.light_model": "",
  "innerlife.deep_model": "",
  "innerlife.loop_seconds": 15,
  "gateway.enabled": true,
  "gateway.transport": "stdio",
  "gateway.local_only": true,
  "continuity.active_line_id": "line_default",
  "backup.enabled": true,
  "backup.schedule": "manual",
  "agent.default_id": "my-agent"
};

const databaseLocks = new Map();

function innerLifeRetrySeconds(pollSeconds, failureCount) {
  const safePoll = Math.max(1, Number.parseInt(String(pollSeconds), 10) || 15);
  const safeFailures = Math.max(1, Math.min(Number.parseInt(String(failureCount), 10) || 1, 8));
  return Math.min(3600, safePoll * 2 ** (safeFailures - 1));
}

const WRITABLE_SETTINGS = new Set([
  "memory.embedding.provider",
  "memory.embedding.base_url",
  "memory.embedding.model",
  "memory.embedding.dimension",
  "memory.embedding.max_chars",
  "memory.maintenance.enabled",
  "memory.maintenance.hour",
  "memory.maintenance.last_run_date",
  "innerlife.enabled",
  "innerlife.provider",
  "innerlife.light_model",
  "innerlife.deep_model",
  "innerlife.loop_seconds"
]);

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

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return sqlString(JSON.stringify(value));
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function meaningfulTokens(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 80);
}

function mergeTitleKey(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function overlapRatio(leftTokens, rightTokens) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.max(left.size, right.size);
}

function normalizeSettingValue(key, value) {
  if (key === "memory.embedding.provider") {
    const provider = String(value || "").trim().toLowerCase();
    return provider || "ollama";
  }
  if (key === "memory.embedding.base_url") {
    const endpoint = String(value || "").trim();
    if (!endpoint.startsWith("http://127.0.0.1:") && !endpoint.startsWith("http://localhost:")) {
      throw new Error("Embedding endpoint must be a local Ollama URL.");
    }
    return endpoint.replace(/\/$/, "");
  }
  if (key === "memory.embedding.model") {
    const model = String(value || "").trim();
    if (!model) throw new Error("Embedding model is required.");
    return model;
  }
  if (key === "memory.embedding.dimension" || key === "memory.embedding.max_chars" || key === "innerlife.loop_seconds") {
    const number = Number.parseInt(String(value), 10);
    if (!Number.isFinite(number) || number <= 0) {
      throw new Error(`${key} must be a positive number.`);
    }
    return number;
  }
  if (key === "memory.maintenance.hour") {
    const number = Number.parseInt(String(value), 10);
    if (!Number.isFinite(number) || number < 0 || number > 23) {
      throw new Error("memory.maintenance.hour must be between 0 and 23.");
    }
    return number;
  }
  if (key === "memory.maintenance.enabled") {
    return value === true || value === "true";
  }
  if (key === "innerlife.enabled") {
    return value === true || value === "true";
  }
  if (key === "innerlife.provider") {
    const provider = String(value || "").trim().toLowerCase();
    return provider || "disabled";
  }
  return String(value || "").trim();
}

function newId(prefix) {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${now}_${random}`;
}

function normalizeLabels(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeSensitivity(value) {
  return String(value || "").trim().toLowerCase() === "restricted" ? "restricted" : "normal";
}

function requiredText(value, field) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function parseAwareDate(value, field) {
  const raw = requiredText(value, field);
  if (!/(Z|[+-]\d{2}:\d{2})$/u.test(raw)) {
    throw new Error(`${field} must include a timezone offset.`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid ISO 8601 datetime.`);
  return date;
}

function localDateForTimezone(date, timezone) {
  const zone = requiredText(timezone || "Asia/Shanghai", "timezone");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMemoryRecordValue(recordType, schemaVersion, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Record value must be a JSON object.");
  if (recordType !== "fitness") return { ...value };
  if (schemaVersion !== 1) throw new Error("Fitness records only support schema version 1.");
  const validators = {
    activity: (item) => {
      if (typeof item !== "string" || !item.trim()) throw new Error("activity must be a non-empty string.");
      return item.trim();
    },
    steps: (item) => {
      if (!Number.isInteger(item) || item < 0) throw new Error("steps must be a non-negative integer.");
      return item;
    },
    duration_minutes: (item) => {
      if (typeof item !== "number" || Number.isNaN(item) || item < 0) throw new Error("duration_minutes must be a non-negative number.");
      return item;
    },
    distance_km: (item) => {
      if (typeof item !== "number" || Number.isNaN(item) || item < 0) throw new Error("distance_km must be a non-negative number.");
      return item;
    },
    repetitions: (item) => {
      if (!Number.isInteger(item) || item < 0) throw new Error("repetitions must be a non-negative integer.");
      return item;
    },
    sets: (item) => {
      if (!Number.isInteger(item) || item < 0) throw new Error("sets must be a non-negative integer.");
      return item;
    },
    completed: (item) => {
      if (typeof item !== "boolean") throw new Error("completed must be a boolean.");
      return item;
    }
  };
  const unknown = Object.keys(value).filter((key) => !validators[key]);
  if (unknown.length) throw new Error(`Unknown fitness fields: ${unknown.join(", ")}.`);
  if (Object.keys(value).length === 0) throw new Error("Fitness record value must contain at least one field.");
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, validators[key](item)]));
}

function likePattern(value) {
  return `%${String(value || "").trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function postJson(url, payload, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const request = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body)
        }
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Ollama returned ${response.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => {
      request.destroy(new Error("Ollama embedding request timed out."));
    });
    request.on("error", reject);
    request.end(body);
  });
}

function parseVector(value) {
  const vector = Array.isArray(value) ? value : parseJson(value, []);
  if (!Array.isArray(vector)) return [];
  return vector.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function cosineSimilarity(left, right) {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function normalizeSearchRows(rows) {
  return rows.map((row) => ({
    ...row,
    labels: row.labels ? row.labels.split(",").filter(Boolean) : []
  }));
}

async function runSqliteCli(dbPath, sql, json = false) {
  const args = json ? ["-json", dbPath] : [dbPath];
  const output = await new Promise((resolve, reject) => {
    const child = spawn("sqlite3", args, { stdio: ["pipe", "pipe", "pipe"] });
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
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
    const schema = await fs.readFile(this.schemaPath, "utf8");
    await this.exec(schema);
    await this.migrateAdditiveSchema();
    await this.seedDefaults();
    return this.getSummary();
  }

  async exec(sql) {
    return withDatabaseLock(this.dbPath, async () => {
      if (this.sqlite?.DatabaseSync) {
        const db = new this.sqlite.DatabaseSync(this.dbPath);
        try {
          db.exec(sql);
        } finally {
          db.close();
        }
        return [];
      }
      return runSqliteCli(this.dbPath, sql, false);
    });
  }

  async query(sql) {
    return withDatabaseLock(this.dbPath, async () => {
      if (this.sqlite?.DatabaseSync) {
        const db = new this.sqlite.DatabaseSync(this.dbPath);
        try {
          return db.prepare(sql).all();
        } finally {
          db.close();
        }
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
      INSERT INTO schema_migrations (id)
      VALUES (${sqlString(SCHEMA_ID)})
      ON CONFLICT(id) DO NOTHING;

      INSERT INTO agents (id, label, role, status)
      VALUES ('my-agent', 'My Agent', 'agent', 'active')
      ON CONFLICT(id) DO NOTHING;

      ${settingsSql}

      INSERT INTO secret_refs (key, provider, status)
      VALUES ('innerlife.llm.api_key', 'none', 'not-configured')
      ON CONFLICT(key) DO NOTHING;
    `);
  }

  async migrateAdditiveSchema() {
    const columns = new Set((await this.query("PRAGMA table_info(memory_records);")).map((row) => row.name));
    const additions = [
      ["user_id", "ALTER TABLE memory_records ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local-user';"],
      ["local_date", "ALTER TABLE memory_records ADD COLUMN local_date TEXT NOT NULL DEFAULT '';"],
      ["timezone", "ALTER TABLE memory_records ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai';"],
      ["schema_version", "ALTER TABLE memory_records ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;"],
      ["note", "ALTER TABLE memory_records ADD COLUMN note TEXT;"],
      ["source_agent", "ALTER TABLE memory_records ADD COLUMN source_agent TEXT;"],
      ["source_run_id", "ALTER TABLE memory_records ADD COLUMN source_run_id TEXT;"],
      ["dedupe_key", "ALTER TABLE memory_records ADD COLUMN dedupe_key TEXT;"]
    ];
    for (const [column, sql] of additions) {
      if (!columns.has(column)) await this.exec(sql);
    }
    await this.exec(`
      UPDATE memory_records
      SET local_date = substr(occurred_at, 1, 10)
      WHERE local_date = '';

      CREATE INDEX IF NOT EXISTS idx_memory_records_user_type_time
      ON memory_records(user_id, record_type, occurred_at DESC);

      CREATE INDEX IF NOT EXISTS idx_memory_records_user_local_date
      ON memory_records(user_id, local_date);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_records_dedupe
      ON memory_records(user_id, record_type, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
    `);
  }

  async updateSettings(updates) {
    const entries = Object.entries(updates || {}).filter(([key]) => WRITABLE_SETTINGS.has(key));
    if (entries.length === 0) {
      return this.getSettings();
    }
    const sql = entries
      .map(([key, value]) => {
        const normalized = normalizeSettingValue(key, value);
        return `
          INSERT INTO app_settings (key, value_json, updated_at)
          VALUES (${sqlString(key)}, ${jsonSql(normalized)}, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = CURRENT_TIMESTAMP;
        `;
      })
      .join("\n");
    await this.exec(sql);
    return this.getSettings();
  }

  async canonicalizeMemoryLabels(labels) {
    const normalized = [...new Set(normalizeLabels(labels))];
    if (normalized.length === 0) return [];
    const rows = await this.query(`
      SELECT alias, canonical_label
      FROM memory_label_aliases
      WHERE alias IN (${normalized.map(sqlString).join(", ")});
    `);
    const aliases = new Map(rows.map((row) => [row.alias, row.canonical_label]));
    return [...new Set(normalized.map((label) => aliases.get(label) || label))];
  }

  async listMemoryLabelAliases() {
    const rows = await this.query(`
      SELECT alias, canonical_label, created_at
      FROM memory_label_aliases
      ORDER BY canonical_label ASC, alias ASC;
    `);
    return rows.map((row) => ({
      alias: row.alias,
      canonicalLabel: row.canonical_label,
      createdAt: row.created_at
    }));
  }

  async createMemoryLabelAlias(input = {}) {
    const alias = normalizeLabels(input.alias || "")[0] || "";
    const canonicalLabel = normalizeLabels(input.canonicalLabel || input.label || "")[0] || "";
    if (!alias || !canonicalLabel) throw new Error("Alias and canonical label are required.");
    if (alias === canonicalLabel) throw new Error("Alias must be different from canonical label.");
    await this.exec(`
      INSERT INTO memory_label_aliases (alias, canonical_label)
      VALUES (${sqlString(alias)}, ${sqlString(canonicalLabel)})
      ON CONFLICT(alias) DO UPDATE SET canonical_label = excluded.canonical_label;

      INSERT INTO memory_labels (memory_id, label)
      SELECT memory_id, ${sqlString(canonicalLabel)}
      FROM memory_labels
      WHERE label = ${sqlString(alias)}
      ON CONFLICT(memory_id, label) DO NOTHING;

      DELETE FROM memory_labels
      WHERE label = ${sqlString(alias)};
    `);
    return {
      alias,
      canonicalLabel,
      aliases: await this.listMemoryLabelAliases(),
      stats: await this.getMemoryStats()
    };
  }

  async deleteMemoryLabelAlias(aliasValue) {
    const alias = normalizeLabels(aliasValue || "")[0] || "";
    if (!alias) throw new Error("Alias is required.");
    await this.exec(`
      DELETE FROM memory_label_aliases
      WHERE alias = ${sqlString(alias)};
    `);
    return {
      alias,
      deleted: true,
      aliases: await this.listMemoryLabelAliases()
    };
  }

  async createMemory(input) {
    const body = String(input?.body || "").trim();
    if (!body) throw new Error("Memory body is required.");
    const id = newId("mem");
    const title = String(input?.title || "").trim();
    const labels = await this.canonicalizeMemoryLabels(input?.labels);
    const sensitivity = normalizeSensitivity(input?.sensitivity);
    const sourceId = "manual_desktop";
    const labelSql = labels
      .map((label) => {
        return `
          INSERT INTO memory_labels (memory_id, label)
          VALUES (${sqlString(id)}, ${sqlString(label)})
          ON CONFLICT(memory_id, label) DO NOTHING;
        `;
      })
      .join("\n");
    await this.exec(`
      INSERT INTO memory_sources (id, kind, label, metadata_json)
      VALUES (${sqlString(sourceId)}, 'manual', 'Desktop manual entry', '{}')
      ON CONFLICT(id) DO NOTHING;

      INSERT INTO memories (id, title, body, status, sensitivity, source_id)
      VALUES (${sqlString(id)}, ${title ? sqlString(title) : "NULL"}, ${sqlString(body)}, 'active', ${sqlString(sensitivity)}, ${sqlString(sourceId)});

      ${labelSql}
    `);
    await this.markMemoryEmbeddingPending(id);
    return this.getMemory(id);
  }

  async updateMemory(id, input) {
    const memoryId = String(id || "").trim();
    if (!memoryId) throw new Error("Memory id is required.");
    const body = String(input?.body || "").trim();
    if (!body) throw new Error("Memory body is required.");
    const title = String(input?.title || "").trim();
    const labels = await this.canonicalizeMemoryLabels(input?.labels);
    const sensitivity = normalizeSensitivity(input?.sensitivity);
    const labelSql = labels
      .map((label) => {
        return `
          INSERT INTO memory_labels (memory_id, label)
          VALUES (${sqlString(memoryId)}, ${sqlString(label)})
          ON CONFLICT(memory_id, label) DO NOTHING;
        `;
      })
      .join("\n");
    await this.exec(`
      UPDATE memories
      SET
        title = ${title ? sqlString(title) : "NULL"},
        body = ${sqlString(body)},
        sensitivity = ${sqlString(sensitivity)},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(memoryId)} AND status = 'active';

      DELETE FROM memory_labels WHERE memory_id = ${sqlString(memoryId)};
      ${labelSql}
    `);
    await this.markMemoryEmbeddingPending(memoryId);
    return this.getMemory(memoryId);
  }

  async deleteMemory(id) {
    const memoryId = String(id || "").trim();
    if (!memoryId) throw new Error("Memory id is required.");
    await this.exec(`
      UPDATE memories
      SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(memoryId)} AND status = 'active';
    `);
    return { id: memoryId, deleted: true };
  }

  async archiveMemory(id) {
    const memoryId = String(id || "").trim();
    if (!memoryId) throw new Error("Memory id is required.");
    await this.exec(`
      UPDATE memories
      SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(memoryId)} AND status = 'active';
    `);
    const memory = await this.getMemory(memoryId);
    if (!memory) throw new Error("Memory not found.");
    if (memory.status !== "archived") throw new Error("Memory is not active or could not be archived.");
    return memory;
  }

  async restoreMemory(id) {
    const memoryId = String(id || "").trim();
    if (!memoryId) throw new Error("Memory id is required.");
    await this.exec(`
      UPDATE memories
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(memoryId)} AND status = 'deleted';
    `);
    const memory = await this.getMemory(memoryId);
    if (!memory) throw new Error("Memory not found.");
    if (memory.status !== "active") throw new Error("Memory is not deleted or could not be restored.");
    return memory;
  }

  async restoreArchivedMemory(id) {
    const memoryId = String(id || "").trim();
    if (!memoryId) throw new Error("Memory id is required.");
    await this.exec(`
      UPDATE memories
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(memoryId)} AND status = 'archived';
    `);
    const memory = await this.getMemory(memoryId);
    if (!memory) throw new Error("Memory not found.");
    if (memory.status !== "active") throw new Error("Memory is not archived or could not be restored.");
    await this.markMemoryEmbeddingPending(memoryId);
    return memory;
  }

  async getMemoryArchiveSuggestions(input = {}) {
    const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(input.limit || 10), 10) || 10));
    const olderThanDays = Math.max(1, Math.min(3650, Number.parseInt(String(input.olderThanDays || 30), 10) || 30));
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      WHERE m.status = 'active'
        AND m.sensitivity != 'restricted'
        AND datetime(m.updated_at) <= datetime('now', '-${olderThanDays} days')
      GROUP BY m.id
      ORDER BY m.updated_at ASC, m.created_at ASC
      LIMIT ${safeLimit};
    `);
    return {
      generatedAt: new Date().toISOString(),
      olderThanDays,
      count: rows.length,
      suggestions: rows.map((row) => ({
        id: row.id,
        title: row.title || "",
        bodyPreview: (row.body || "").slice(0, 160),
        labels: row.labels ? row.labels.split(",").filter(Boolean) : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        reason: "dormant"
      }))
    };
  }

  async archiveDormantMemories(input = {}) {
    const suggestions = await this.getMemoryArchiveSuggestions(input || {});
    const ids = suggestions.suggestions.map((item) => item.id);
    if (input.dryRun === true || ids.length === 0) {
      return {
        dryRun: input.dryRun === true,
        archived: 0,
        suggestions
      };
    }
    await this.exec(`
      UPDATE memories
      SET status = 'archived',
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${ids.map(sqlString).join(", ")})
        AND status = 'active'
        AND sensitivity != 'restricted';
    `);
    return {
      dryRun: false,
      archived: ids.length,
      suggestions: await this.getMemoryArchiveSuggestions(input || {})
    };
  }

  async setMemorySensitivity(id, sensitivityValue) {
    const memoryId = String(id || "").trim();
    if (!memoryId) throw new Error("Memory id is required.");
    const sensitivity = normalizeSensitivity(sensitivityValue);
    await this.exec(`
      UPDATE memories
      SET sensitivity = ${sqlString(sensitivity)}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(memoryId)} AND status = 'active';
    `);
    const memory = await this.getMemory(memoryId);
    if (!memory) throw new Error("Memory not found.");
    return memory;
  }

  async getMemory(id) {
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.status,
        m.sensitivity,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels,
        COALESCE(e.status, 'pending') AS embedding_status,
        e.provider AS embedding_provider,
        e.model AS embedding_model,
        e.dimension AS embedding_dimension,
        e.error AS embedding_error,
        e.embedded_at AS embedded_at
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.id = ${sqlString(id)}
      GROUP BY m.id;
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      labels: row.labels ? row.labels.split(",").filter(Boolean) : []
    };
  }

  async listMemories(limit = 20, search = "", options = {}) {
    const safeLimit = Math.max(1, Math.min(1000, Number.parseInt(String(limit), 10) || 20));
    const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
    const query = String(search || "").trim();
    const includeRestricted = Boolean(options.includeRestricted);
    const searchClause = query
      ? `AND (
          m.title LIKE ${sqlString(likePattern(query))} ESCAPE '\\'
          OR m.body LIKE ${sqlString(likePattern(query))} ESCAPE '\\'
          OR EXISTS (
            SELECT 1 FROM memory_labels ml
            WHERE ml.memory_id = m.id
              AND ml.label LIKE ${sqlString(likePattern(query.toLowerCase()))} ESCAPE '\\'
          )
        )`
      : "";
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.status,
        m.sensitivity,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels,
        COALESCE(e.status, 'pending') AS embedding_status,
        e.provider AS embedding_provider,
        e.model AS embedding_model,
        e.dimension AS embedding_dimension,
        e.error AS embedding_error,
        e.embedded_at AS embedded_at
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.status = 'active'
      ${includeRestricted ? "" : "AND m.sensitivity != 'restricted'"}
      ${searchClause}
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset};
    `);
    return normalizeSearchRows(rows);
  }

  async listRestrictedMemories(limit = 20, options = {}) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
    const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.status,
        m.sensitivity,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels,
        COALESCE(e.status, 'pending') AS embedding_status,
        e.provider AS embedding_provider,
        e.model AS embedding_model,
        e.dimension AS embedding_dimension,
        e.error AS embedding_error,
        e.embedded_at AS embedded_at
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.status = 'active'
        AND m.sensitivity = 'restricted'
      GROUP BY m.id
      ORDER BY m.updated_at DESC, m.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset};
    `);
    return normalizeSearchRows(rows);
  }

  async listDeletedMemories(limit = 20, options = {}) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
    const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.status,
        m.sensitivity,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels,
        COALESCE(e.status, 'pending') AS embedding_status,
        e.provider AS embedding_provider,
        e.model AS embedding_model,
        e.dimension AS embedding_dimension,
        e.error AS embedding_error,
        e.embedded_at AS embedded_at
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.status = 'deleted'
      GROUP BY m.id
      ORDER BY m.updated_at DESC, m.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset};
    `);
    return normalizeSearchRows(rows);
  }

  async listArchivedMemories(limit = 20, options = {}) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
    const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.status,
        m.sensitivity,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels,
        COALESCE(e.status, 'pending') AS embedding_status,
        e.provider AS embedding_provider,
        e.model AS embedding_model,
        e.dimension AS embedding_dimension,
        e.error AS embedding_error,
        e.embedded_at AS embedded_at
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.status = 'archived'
      GROUP BY m.id
      ORDER BY m.updated_at DESC, m.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset};
    `);
    return normalizeSearchRows(rows);
  }

  async getMemoryStats() {
    const counts = (
      await this.query(`
        SELECT
          (SELECT COUNT(*) FROM memories WHERE status = 'active') AS active_count,
          (SELECT COUNT(*) FROM memories WHERE status = 'active' AND sensitivity != 'restricted') AS normal_active_count,
          (SELECT COUNT(*) FROM memories WHERE status = 'active' AND sensitivity = 'restricted') AS restricted_count,
          (SELECT COUNT(*) FROM memories WHERE status = 'deleted') AS deleted_count,
          (SELECT COUNT(*) FROM memories WHERE status = 'archived') AS archived_count,
          (SELECT COUNT(*) FROM memories) AS total_count,
          (SELECT COUNT(*) FROM memory_embeddings WHERE status = 'ready') AS embedded_count,
          (SELECT COUNT(*) FROM memory_embeddings WHERE status = 'pending') AS pending_embedding_count,
          (SELECT COUNT(*) FROM memory_embeddings WHERE status = 'failed') AS failed_embedding_count,
          (SELECT COUNT(*) FROM memory_records WHERE status = 'active') AS structured_record_count;
      `)
    )[0] || {};
    const labels = await this.query(`
      SELECT l.label, COUNT(*) AS count
      FROM memory_labels l
      JOIN memories m ON m.id = l.memory_id
      WHERE m.status = 'active'
        AND m.sensitivity != 'restricted'
      GROUP BY l.label
      ORDER BY count DESC, l.label ASC
      LIMIT 50;
    `);
    return {
      activeCount: counts.normal_active_count || 0,
      allActiveCount: counts.active_count || 0,
      restrictedCount: counts.restricted_count || 0,
      deletedCount: counts.deleted_count || 0,
      archivedCount: counts.archived_count || 0,
      totalCount: counts.total_count || 0,
      embeddedCount: counts.embedded_count || 0,
      pendingEmbeddingCount: counts.pending_embedding_count || 0,
      failedEmbeddingCount: counts.failed_embedding_count || 0,
      structuredRecordCount: counts.structured_record_count || 0,
      labelAliasCount: (await this.listMemoryLabelAliases()).length,
      labels: labels.map((row) => ({
        label: row.label,
        count: row.count || 0
      }))
    };
  }

  async getMemoryGraph(input = {}) {
    const safeLimit = Math.max(1, Math.min(1000, Number.parseInt(String(input.limit || 30), 10) || 30));
    const includeRestricted = Boolean(input.includeRestricted);
    const memories = await this.listMemories(safeLimit, "", { includeRestricted });
    const memoryIds = memories.map((memory) => memory.id);
    const nodes = [];
    const edges = [];
    const seenNodes = new Set();
    const seenEdges = new Set();
    const addNode = (node) => {
      if (!node.id || seenNodes.has(node.id)) return;
      seenNodes.add(node.id);
      nodes.push(node);
    };
    const addEdge = (edge) => {
      if (!edge.from || !edge.to) return;
      const key = `${edge.from}->${edge.to}:${edge.kind}`;
      if (seenEdges.has(key)) return;
      seenEdges.add(key);
      edges.push(edge);
    };

    for (const memory of memories) {
      const memoryNodeId = `memory:${memory.id}`;
      addNode({
        id: memoryNodeId,
        kind: "memory",
        sensitivity: memory.sensitivity || "normal",
        label: memory.title || memory.body.slice(0, 48) || memory.id,
        refId: memory.id
      });
      for (const label of memory.labels || []) {
        const labelNodeId = `label:${label}`;
        addNode({
          id: labelNodeId,
          kind: "label",
          label,
          refId: label
        });
        addEdge({
          from: memoryNodeId,
          to: labelNodeId,
          kind: "labeled"
        });
      }
    }

    const lineRows = await this.query(`
      SELECT
        l.id,
        l.title,
        l.status,
        p.summary,
        p.facts_used_json,
        p.updated_at
      FROM continuity_lines l
      LEFT JOIN current_positions p ON p.line_id = l.id
      WHERE l.status = 'active'
      ORDER BY l.updated_at DESC
      LIMIT 50;
    `);
    const memoryIdSet = new Set(memoryIds);
    for (const row of lineRows) {
      const factsUsed = parseJson(row.facts_used_json, []);
      const safeFactsUsed = Array.isArray(factsUsed) ? factsUsed : [];
      const referenced = safeFactsUsed.filter((id) => memoryIdSet.has(id));
      if (referenced.length === 0) continue;
      const lineNodeId = `line:${row.id}`;
      addNode({
        id: lineNodeId,
        kind: "shared_line",
        label: row.title || row.id,
        refId: row.id,
        summary: row.summary || ""
      });
      for (const memoryId of referenced) {
        addEdge({
          from: lineNodeId,
          to: `memory:${memoryId}`,
          kind: "uses"
        });
      }
    }

    const labelCount = nodes.filter((node) => node.kind === "label").length;
    const lineCount = nodes.filter((node) => node.kind === "shared_line").length;
    return {
      nodes,
      edges,
      summary: {
        memoryCount: memories.length,
        labelCount,
        sharedLineCount: lineCount,
        edgeCount: edges.length,
        limitedTo: safeLimit
      }
    };
  }

  async getMemoryMaintenanceReport() {
    const rows = (
      await this.query(`
        SELECT
          (SELECT COUNT(*)
           FROM memories m
           LEFT JOIN memory_embeddings e ON e.memory_id = m.id
           WHERE m.status = 'active'
             AND m.sensitivity != 'restricted'
             AND e.memory_id IS NULL) AS missing_embedding_count,
          (SELECT COUNT(*)
           FROM memories m
           JOIN memory_embeddings e ON e.memory_id = m.id
           WHERE m.status = 'active'
             AND m.sensitivity != 'restricted'
             AND e.status = 'failed') AS failed_embedding_count,
          (SELECT COUNT(*)
           FROM memories m
           JOIN memory_embeddings e ON e.memory_id = m.id
           WHERE m.status = 'active'
             AND m.sensitivity != 'restricted'
             AND e.embedded_at < m.updated_at) AS stale_embedding_count,
          (SELECT COUNT(*)
           FROM memory_labels l
           LEFT JOIN memories m ON m.id = l.memory_id
           WHERE m.id IS NULL) AS orphan_label_count,
          (SELECT COUNT(*)
           FROM memory_labels l
           JOIN memory_label_aliases a ON a.alias = l.label) AS alias_label_count;
      `)
    )[0] || {};
    const issues = [];
    const addIssue = (code, count, message) => {
      if ((count || 0) > 0) issues.push({ code, count, message });
    };
    addIssue("missing_embeddings", rows.missing_embedding_count || 0, "Active memories without embedding state.");
    addIssue("failed_embeddings", rows.failed_embedding_count || 0, "Active memories with failed embeddings.");
    addIssue("stale_embeddings", rows.stale_embedding_count || 0, "Active memories with embeddings older than the memory update.");
    addIssue("orphan_labels", rows.orphan_label_count || 0, "Labels not attached to an existing memory.");
    addIssue("alias_labels", rows.alias_label_count || 0, "Labels still using an alias instead of the canonical label.");
    return {
      status: issues.length ? "needs_repair" : "ok",
      checkedAt: new Date().toISOString(),
      counts: {
        missingEmbeddings: rows.missing_embedding_count || 0,
        failedEmbeddings: rows.failed_embedding_count || 0,
        staleEmbeddings: rows.stale_embedding_count || 0,
        orphanLabels: rows.orphan_label_count || 0,
        aliasLabels: rows.alias_label_count || 0
      },
      issues
    };
  }

  async runMemoryMaintenance(input = {}) {
    const before = await this.getMemoryMaintenanceReport();
    const dryRun = input.dryRun === true;
    const actions = [];
    if (dryRun) {
      return {
        dryRun: true,
        before,
        after: before,
        actions
      };
    }
    const settings = await this.getSettings();
    const provider = settings["memory.embedding.provider"] || "ollama";
    const model = settings["memory.embedding.model"] || "bge-m3";
    const dimension = Number.parseInt(String(settings["memory.embedding.dimension"] || 1024), 10);
    const embeddingRows = await this.query(`
      SELECT m.id
      FROM memories m
      LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.status = 'active'
        AND m.sensitivity != 'restricted'
        AND (
          e.memory_id IS NULL
          OR e.status = 'failed'
          OR e.embedded_at < m.updated_at
        )
      ORDER BY m.updated_at ASC, m.created_at ASC
      LIMIT 500;
    `);
    if (embeddingRows.length) {
      await this.exec(
        embeddingRows
          .map(
            (row) => `
              INSERT INTO memory_embeddings (memory_id, provider, model, dimension, status, vector_json, vector_ref, error, embedded_at)
              VALUES (${sqlString(row.id)}, ${sqlString(provider)}, ${sqlString(model)}, ${Number.isFinite(dimension) ? dimension : 1024}, 'pending', NULL, NULL, NULL, CURRENT_TIMESTAMP)
              ON CONFLICT(memory_id) DO UPDATE SET
                provider = excluded.provider,
                model = excluded.model,
                dimension = excluded.dimension,
                status = 'pending',
                vector_json = NULL,
                vector_ref = NULL,
                error = NULL,
                embedded_at = CURRENT_TIMESTAMP;
            `
          )
          .join("\n")
      );
      actions.push({
        code: "queued_embeddings",
        count: embeddingRows.length
      });
    }
    const orphanRows = await this.query(`
      SELECT l.memory_id, l.label
      FROM memory_labels l
      LEFT JOIN memories m ON m.id = l.memory_id
      WHERE m.id IS NULL
      LIMIT 500;
    `);
    if (orphanRows.length) {
      await this.exec(`
        DELETE FROM memory_labels
        WHERE memory_id NOT IN (SELECT id FROM memories);
      `);
      actions.push({
        code: "removed_orphan_labels",
        count: orphanRows.length
      });
    }
    const aliasRows = await this.query(`
      SELECT DISTINCT l.memory_id, l.label AS alias, a.canonical_label
      FROM memory_labels l
      JOIN memory_label_aliases a ON a.alias = l.label
      LIMIT 500;
    `);
    if (aliasRows.length) {
      await this.exec(
        aliasRows
          .map(
            (row) => `
              INSERT INTO memory_labels (memory_id, label)
              VALUES (${sqlString(row.memory_id)}, ${sqlString(row.canonical_label)})
              ON CONFLICT(memory_id, label) DO NOTHING;
              DELETE FROM memory_labels
              WHERE memory_id = ${sqlString(row.memory_id)}
                AND label = ${sqlString(row.alias)};
            `
          )
          .join("\n")
      );
      actions.push({
        code: "canonicalized_alias_labels",
        count: aliasRows.length
      });
    }
    return {
      dryRun: false,
      before,
      after: await this.getMemoryMaintenanceReport(),
      actions
    };
  }

  async getMemoryMergeSuggestions(input = {}) {
    const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(input.limit || 10), 10) || 10));
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      WHERE m.status = 'active'
        AND m.sensitivity != 'restricted'
      GROUP BY m.id
      ORDER BY m.updated_at DESC, m.created_at DESC
      LIMIT 500;
    `);
    const memories = rows.map((row) => ({
      id: row.id,
      title: row.title || "",
      body: row.body || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      labels: row.labels ? row.labels.split(",").filter(Boolean) : [],
      titleKey: mergeTitleKey(row.title || ""),
      bodyTokens: meaningfulTokens(`${row.title || ""} ${row.body || ""}`)
    }));
    const suggestions = [];
    for (let leftIndex = 0; leftIndex < memories.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < memories.length; rightIndex += 1) {
        const left = memories[leftIndex];
        const right = memories[rightIndex];
        const labelOverlap = overlapRatio(left.labels, right.labels);
        const tokenOverlap = overlapRatio(left.bodyTokens, right.bodyTokens);
        const sameTitle = left.titleKey && left.titleKey === right.titleKey;
        const bodyContained = left.body.length > 40 && right.body.length > 40 && (left.body.includes(right.body) || right.body.includes(left.body));
        let score = 0;
        const reasons = [];
        if (sameTitle) {
          score += 0.55;
          reasons.push("same_title");
        }
        if (bodyContained) {
          score += 0.35;
          reasons.push("body_contained");
        }
        if (labelOverlap >= 0.5) {
          score += Math.min(0.25, labelOverlap * 0.25);
          reasons.push("shared_labels");
        }
        if (tokenOverlap >= 0.35) {
          score += Math.min(0.35, tokenOverlap * 0.45);
          reasons.push("similar_text");
        }
        if (score < 0.55) continue;
        const target = new Date(left.updatedAt || left.createdAt || 0) >= new Date(right.updatedAt || right.createdAt || 0) ? left : right;
        const source = target.id === left.id ? right : left;
        suggestions.push({
          id: `${target.id}:${source.id}`,
          score: Math.min(1, Number(score.toFixed(2))),
          reasons,
          target: {
            id: target.id,
            title: target.title,
            bodyPreview: target.body.slice(0, 160),
            labels: target.labels,
            updatedAt: target.updatedAt
          },
          source: {
            id: source.id,
            title: source.title,
            bodyPreview: source.body.slice(0, 160),
            labels: source.labels,
            updatedAt: source.updatedAt
          }
        });
      }
    }
    suggestions.sort((left, right) => right.score - left.score || String(right.target.updatedAt || "").localeCompare(String(left.target.updatedAt || "")));
    return {
      generatedAt: new Date().toISOString(),
      count: suggestions.length,
      suggestions: suggestions.slice(0, safeLimit)
    };
  }

  async mergeMemories(input = {}) {
    const targetId = String(input.targetId || "").trim();
    const sourceId = String(input.sourceId || "").trim();
    if (!targetId || !sourceId) throw new Error("Target and source Memory ids are required.");
    if (targetId === sourceId) throw new Error("Target and source Memory ids must be different.");
    const target = await this.getMemory(targetId);
    const source = await this.getMemory(sourceId);
    if (!target || !source) throw new Error("Memory not found.");
    if (target.status !== "active" || source.status !== "active") throw new Error("Only active Memory records can be merged.");
    if (target.sensitivity === "restricted" || source.sensitivity === "restricted") {
      throw new Error("Restricted Memory records cannot be merged through suggestions.");
    }
    const mergedTitle = target.title || source.title || "";
    const sourceHeader = `Merged from ${source.id}${source.title ? `: ${source.title}` : ""}`;
    const mergedBody = target.body.includes(source.body)
      ? target.body
      : `${target.body.trim()}\n\n--- ${sourceHeader} ---\n${source.body.trim()}`.trim();
    const mergedLabels = await this.canonicalizeMemoryLabels([...(target.labels || []), ...(source.labels || [])]);
    await this.exec(`
      UPDATE memories
      SET title = ${mergedTitle ? sqlString(mergedTitle) : "NULL"},
          body = ${sqlString(mergedBody)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(targetId)}
        AND status = 'active';

      DELETE FROM memory_labels
      WHERE memory_id = ${sqlString(targetId)};

      ${mergedLabels
        .map(
          (label) => `
            INSERT INTO memory_labels (memory_id, label)
            VALUES (${sqlString(targetId)}, ${sqlString(label)})
            ON CONFLICT(memory_id, label) DO NOTHING;
          `
        )
        .join("\n")}

      UPDATE memories
      SET status = 'deleted',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(sourceId)}
        AND status = 'active';
    `);
    await this.markMemoryEmbeddingPending(targetId);
    return {
      merged: true,
      target: await this.getMemory(targetId),
      source: await this.getMemory(sourceId),
      suggestions: await this.getMemoryMergeSuggestions({ limit: 10 })
    };
  }

  async createMemoryRecord(input = {}) {
    const recordType = requiredText(input.recordType || input.type, "recordType").toLowerCase();
    const userId = requiredText(input.userId || input.user_id || input.metadata?.userId || "local-user", "userId");
    const title = String(input.title || recordType).trim() || recordType;
    const schemaVersion = Number.parseInt(String(input.schemaVersion || input.schema_version || 1), 10) || 1;
    const value = normalizeMemoryRecordValue(recordType, schemaVersion, input.value || input.data || {});
    const occurredDate = parseAwareDate(input.occurredAt || input.occurred_at || new Date().toISOString(), "occurredAt");
    const occurredAt = occurredDate.toISOString();
    const timezone = requiredText(input.timezone || input.timezoneName || input.metadata?.timezone || "Asia/Shanghai", "timezone");
    const localDate = localDateForTimezone(occurredDate, timezone);
    const source = String(input.source || "manual_desktop").trim() || "manual_desktop";
    const note = String(input.note || "").trim() || null;
    const sourceAgent = String(input.sourceAgent || input.source_agent || input.metadata?.sourceAgent || "").trim() || null;
    const sourceRunId = String(input.sourceRunId || input.source_run_id || input.metadata?.sourceRunId || "").trim() || null;
    const dedupeKey = String(input.dedupeKey || input.dedupe_key || input.metadata?.dedupeKey || "").trim() || null;
    if (dedupeKey) {
      const existingRows = await this.query(`
        SELECT id
        FROM memory_records
        WHERE user_id = ${sqlString(userId)}
          AND record_type = ${sqlString(recordType)}
          AND dedupe_key = ${sqlString(dedupeKey)}
        LIMIT 1;
      `);
      if (existingRows[0]?.id) {
        return {
          ...(await this.getMemoryRecord(existingRows[0].id)),
          writeStatus: "exists"
        };
      }
    }
    const id = newId("mem_record");
    await this.exec(`
      INSERT INTO memory_records (
        id, user_id, record_type, title, value_json, occurred_at, local_date,
        timezone, schema_version, note, source, source_agent, source_run_id,
        dedupe_key, status, metadata_json
      )
      VALUES (
        ${sqlString(id)},
        ${sqlString(userId)},
        ${sqlString(recordType)},
        ${sqlString(title)},
        ${jsonSql(value)},
        ${sqlString(occurredAt)},
        ${sqlString(localDate)},
        ${sqlString(timezone)},
        ${schemaVersion},
        ${note === null ? "NULL" : sqlString(note)},
        ${sqlString(source)},
        ${sourceAgent === null ? "NULL" : sqlString(sourceAgent)},
        ${sourceRunId === null ? "NULL" : sqlString(sourceRunId)},
        ${dedupeKey === null ? "NULL" : sqlString(dedupeKey)},
        'active',
        ${jsonSql(input.metadata || {})}
      );
    `);
    return {
      ...(await this.getMemoryRecord(id)),
      writeStatus: "created"
    };
  }

  async getMemoryRecord(id) {
    const rows = await this.query(`
      SELECT id, user_id, record_type, title, value_json, occurred_at, local_date, timezone,
             schema_version, note, source, source_agent, source_run_id, dedupe_key,
             status, memory_id, created_at, updated_at, metadata_json
      FROM memory_records
      WHERE id = ${sqlString(id)}
      LIMIT 1;
    `);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id || "local-user",
      recordType: row.record_type,
      title: row.title || "",
      value: parseJson(row.value_json, {}),
      occurredAt: row.occurred_at,
      localDate: row.local_date || "",
      timezone: row.timezone || "Asia/Shanghai",
      schemaVersion: row.schema_version || 1,
      note: row.note || "",
      source: row.source || "",
      sourceAgent: row.source_agent || "",
      sourceRunId: row.source_run_id || "",
      dedupeKey: row.dedupe_key || "",
      status: row.status,
      memoryId: row.memory_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: parseJson(row.metadata_json, {})
    }))[0] || null;
  }

  async listMemoryRecords(input = {}) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(input.limit || 20), 10) || 20));
    const safeOffset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
    const userId = String(input.userId || input.user_id || "").trim();
    const recordType = String(input.recordType || input.type || "").trim().toLowerCase();
    const filters = ["status = 'active'"];
    if (userId) filters.push(`user_id = ${sqlString(userId)}`);
    if (recordType) filters.push(`record_type = ${sqlString(recordType)}`);
    if (input.localDate || input.local_date) filters.push(`local_date = ${sqlString(input.localDate || input.local_date)}`);
    if (input.start) filters.push(`occurred_at >= ${sqlString(parseAwareDate(input.start, "start").toISOString())}`);
    if (input.end) filters.push(`occurred_at < ${sqlString(parseAwareDate(input.end, "end").toISOString())}`);
    const rows = await this.query(`
      SELECT id, user_id, record_type, title, value_json, occurred_at, local_date, timezone,
             schema_version, note, source, source_agent, source_run_id, dedupe_key,
             status, memory_id, created_at, updated_at, metadata_json
      FROM memory_records
      WHERE ${filters.join(" AND ")}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset};
    `);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id || "local-user",
      recordType: row.record_type,
      title: row.title || "",
      value: parseJson(row.value_json, {}),
      occurredAt: row.occurred_at,
      localDate: row.local_date || "",
      timezone: row.timezone || "Asia/Shanghai",
      schemaVersion: row.schema_version || 1,
      note: row.note || "",
      source: row.source || "",
      sourceAgent: row.source_agent || "",
      sourceRunId: row.source_run_id || "",
      dedupeKey: row.dedupe_key || "",
      status: row.status,
      memoryId: row.memory_id || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: parseJson(row.metadata_json, {})
    }));
  }

  async getMemoryRecordStats() {
    const rows = await this.query(`
      SELECT record_type, COUNT(*) AS count, MAX(occurred_at) AS latest_at
      FROM memory_records
      WHERE status = 'active'
      GROUP BY record_type
      ORDER BY count DESC, record_type ASC
      LIMIT 50;
    `);
    return {
      totalCount: rows.reduce((sum, row) => sum + (row.count || 0), 0),
      types: rows.map((row) => ({
        recordType: row.record_type,
        count: row.count || 0,
        latestAt: row.latest_at || null
      }))
    };
  }

  async summarizeMemoryRecords(input = {}) {
    const recordType = String(input.recordType || input.type || "fitness").trim().toLowerCase();
    if (recordType !== "fitness") throw new Error("Memory record summary currently supports fitness only.");
    const records = await this.listMemoryRecords({ ...input, recordType, limit: 100 });
    const totals = {
      steps: 0,
      duration_minutes: 0,
      distance_km: 0,
      repetitions: 0,
      sets: 0
    };
    for (const record of records) {
      for (const field of Object.keys(totals)) {
        totals[field] += record.value[field] || 0;
      }
    }
    return {
      userId: input.userId || input.user_id || "",
      recordType,
      start: input.start || null,
      end: input.end || null,
      localDate: input.localDate || input.local_date || null,
      recordCount: records.length,
      activeDays: new Set(records.map((record) => record.localDate).filter(Boolean)).size,
      totalSteps: totals.steps,
      totalDurationMinutes: totals.duration_minutes,
      totalDistanceKm: totals.distance_km,
      totalRepetitions: totals.repetitions,
      totalSets: totals.sets
    };
  }

  async createEmbedding(text) {
    const settings = await this.getSettings();
    const provider = settings["memory.embedding.provider"] || "ollama";
    const baseUrl = settings["memory.embedding.base_url"] || "http://127.0.0.1:11434";
    const model = settings["memory.embedding.model"] || "bge-m3";
    const maxChars = Number.parseInt(String(settings["memory.embedding.max_chars"] || 2000), 10);
    const prompt = String(text || "").trim().slice(0, maxChars);
    if (!prompt) throw new Error("Embedding text is required.");
    if (provider !== "ollama") {
      throw new Error(`Embedding provider '${provider}' is not implemented yet.`);
    }
    const response = await postJson(`${baseUrl}/api/embeddings`, { model, prompt });
    const vector = parseVector(response.embedding);
    if (vector.length === 0) {
      throw new Error("Ollama returned no embedding.");
    }
    return { provider, model, vector };
  }

  async vectorMemoryCandidates(limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Number.parseInt(String(limit), 10) || 200));
    const rows = await this.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.status,
        m.sensitivity,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels,
        e.status AS embedding_status,
        e.provider AS embedding_provider,
        e.model AS embedding_model,
        e.dimension AS embedding_dimension,
        e.error AS embedding_error,
        e.embedded_at AS embedded_at,
        e.vector_json AS vector_json
      FROM memories m
      JOIN memory_embeddings e ON e.memory_id = m.id
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      WHERE m.status = 'active'
        AND m.sensitivity != 'restricted'
        AND e.status = 'ready'
        AND e.vector_json IS NOT NULL
      GROUP BY m.id
      ORDER BY e.embedded_at DESC
      LIMIT ${safeLimit};
    `);
    return normalizeSearchRows(rows).map((row) => ({
      ...row,
      vector: parseVector(row.vector_json)
    }));
  }

  async searchMemories(query, limit = 50, options = {}) {
    const text = String(query || "").trim();
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 50));
    const includeRestricted = Boolean(options.includeRestricted);
    if (!text) {
      return {
        mode: "list",
        query: "",
        results: await this.listMemories(Math.min(20, safeLimit), "", { includeRestricted }),
        error: null
      };
    }

    const keywordResults = await this.listMemories(safeLimit, text, { includeRestricted });
    const merged = new Map(
      keywordResults.map((memory) => [
        memory.id,
        {
          ...memory,
          search_source: "keyword",
          search_score: 0
        }
      ])
    );

    try {
      const { vector: queryVector } = await this.createEmbedding(text);
      const candidates = await this.vectorMemoryCandidates(200);
      const vectorResults = candidates
        .map(({ vector, vector_json: _vectorJson, ...memory }) => ({
          ...memory,
          search_source: "vector",
          search_score: cosineSimilarity(queryVector, vector)
        }))
        .filter((memory) => memory.search_score > 0)
        .sort((left, right) => right.search_score - left.search_score)
        .slice(0, safeLimit);

      for (const memory of vectorResults) {
        const existing = merged.get(memory.id);
        if (existing) {
          merged.set(memory.id, {
            ...existing,
            search_source: "keyword+vector",
            search_score: Math.max(existing.search_score || 0, memory.search_score || 0)
          });
        } else {
          merged.set(memory.id, memory);
        }
      }

      const results = [...merged.values()]
        .sort((left, right) => {
          const leftBoost = left.search_source === "keyword+vector" ? 2 : left.search_source === "vector" ? 1 : 0;
          const rightBoost = right.search_source === "keyword+vector" ? 2 : right.search_source === "vector" ? 1 : 0;
          if (rightBoost !== leftBoost) return rightBoost - leftBoost;
          if ((right.search_score || 0) !== (left.search_score || 0)) {
            return (right.search_score || 0) - (left.search_score || 0);
          }
          return String(right.created_at || "").localeCompare(String(left.created_at || ""));
        })
        .slice(0, safeLimit);

      return {
        mode: vectorResults.length > 0 ? "hybrid" : "keyword",
        query: text,
        results,
        error: null
      };
    } catch (error) {
      return {
        mode: "keyword",
        query: text,
        results: keywordResults.map((memory) => ({
          ...memory,
          search_source: "keyword",
          search_score: 0
        })),
        error: error.message
      };
    }
  }

  async markMemoryEmbeddingPending(memoryId) {
    const settings = await this.getSettings();
    await this.exec(`
      INSERT INTO memory_embeddings (memory_id, provider, model, dimension, status, vector_json, vector_ref, error, embedded_at)
      VALUES (
        ${sqlString(memoryId)},
        ${sqlString(settings["memory.embedding.provider"] || "ollama")},
        ${sqlString(settings["memory.embedding.model"] || "bge-m3")},
        ${Number.parseInt(String(settings["memory.embedding.dimension"] || 1024), 10)},
        'pending',
        NULL,
        NULL,
        NULL,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(memory_id) DO UPDATE SET
        provider = excluded.provider,
        model = excluded.model,
        dimension = excluded.dimension,
        status = 'pending',
        vector_json = NULL,
        vector_ref = NULL,
        error = NULL,
        embedded_at = CURRENT_TIMESTAMP;
    `);
  }

  async embedMemory(memoryId) {
    const memory = await this.getMemory(memoryId);
    if (!memory || memory.status !== "active") {
      throw new Error("Active memory not found.");
    }
    const settings = await this.getSettings();
    const provider = settings["memory.embedding.provider"] || "ollama";
    const model = settings["memory.embedding.model"] || "bge-m3";
    try {
      const text = `${memory.title || ""}\n${memory.body || ""}`.trim();
      const embedding = await this.createEmbedding(text);
      await this.exec(`
        INSERT INTO memory_embeddings (memory_id, provider, model, dimension, status, vector_json, vector_ref, error, embedded_at)
        VALUES (
          ${sqlString(memoryId)},
          ${sqlString(embedding.provider)},
          ${sqlString(embedding.model)},
          ${embedding.vector.length},
          'ready',
          ${jsonSql(embedding.vector)},
          NULL,
          NULL,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(memory_id) DO UPDATE SET
          provider = excluded.provider,
          model = excluded.model,
          dimension = excluded.dimension,
          status = 'ready',
          vector_json = excluded.vector_json,
          vector_ref = NULL,
          error = NULL,
          embedded_at = CURRENT_TIMESTAMP;
      `);
    } catch (error) {
      await this.exec(`
        INSERT INTO memory_embeddings (memory_id, provider, model, dimension, status, vector_json, vector_ref, error, embedded_at)
        VALUES (
          ${sqlString(memoryId)},
          ${sqlString(provider)},
          ${sqlString(model)},
          NULL,
          'failed',
          NULL,
          NULL,
          ${sqlString(error.message)},
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(memory_id) DO UPDATE SET
          provider = excluded.provider,
          model = excluded.model,
          status = 'failed',
          vector_json = NULL,
          vector_ref = NULL,
          error = excluded.error,
          embedded_at = CURRENT_TIMESTAMP;
      `);
      throw error;
    }
    return this.getMemory(memoryId);
  }

  async pendingEmbeddingMemoryIds(limit = 5) {
    const safeLimit = Math.max(1, Math.min(20, Number.parseInt(String(limit), 10) || 5));
    const rows = await this.query(`
      SELECT m.id
      FROM memories m
      LEFT JOIN memory_embeddings e ON e.memory_id = m.id
      WHERE m.status = 'active'
        AND COALESCE(e.status, 'pending') = 'pending'
      ORDER BY COALESCE(e.embedded_at, m.created_at) ASC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => row.id);
  }

  async processPendingEmbeddings(limit = 5) {
    const ids = await this.pendingEmbeddingMemoryIds(limit);
    const results = [];
    for (const id of ids) {
      try {
        const memory = await this.embedMemory(id);
        results.push({ id, ok: true, status: memory?.embedding_status || "ready" });
      } catch (error) {
        results.push({ id, ok: false, status: "failed", error: error.message });
      }
    }
    return {
      processed: results.length,
      results
    };
  }

  async ensureDefaultContinuityLine() {
    const lineId = "line_default";
    await this.exec(`
      INSERT INTO continuity_lines (id, title, status)
      VALUES (${sqlString(lineId)}, 'Default Shared Line', 'active')
      ON CONFLICT(id) DO UPDATE SET
        status = 'active',
        updated_at = CURRENT_TIMESTAMP;
    `);
    return lineId;
  }

  async getActiveContinuityLineId() {
    const defaultLineId = await this.ensureDefaultContinuityLine();
    const settings = await this.getSettings();
    const configured = String(settings["continuity.active_line_id"] || defaultLineId).trim() || defaultLineId;
    const rows = await this.query(`
      SELECT id
      FROM continuity_lines
      WHERE id = ${sqlString(configured)} AND status = 'active'
      LIMIT 1;
    `);
    const lineId = rows[0]?.id || defaultLineId;
    if (lineId !== configured) {
      await this.setActiveContinuityLine(lineId);
    }
    return lineId;
  }

  async resolveContinuityLineId(lineId = null) {
    const requested = String(lineId || "").trim();
    if (!requested) return this.getActiveContinuityLineId();
    await this.ensureDefaultContinuityLine();
    const rows = await this.query(`
      SELECT id
      FROM continuity_lines
      WHERE id = ${sqlString(requested)} AND status = 'active'
      LIMIT 1;
    `);
    if (!rows[0]?.id) throw new Error("Shared Line not found.");
    return rows[0].id;
  }

  async listContinuityLines(limit = 20) {
    await this.ensureDefaultContinuityLine();
    const activeLineId = await this.getActiveContinuityLineId();
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
    const rows = await this.query(`
      SELECT
        l.id,
        l.title,
        l.status,
        l.created_at,
        l.updated_at,
        p.summary,
        p.interpretation_status,
        p.updated_at AS position_updated_at
      FROM continuity_lines l
      LEFT JOIN current_positions p ON p.line_id = l.id
      WHERE l.status != 'deleted'
      ORDER BY
        CASE WHEN l.id = ${sqlString(activeLineId)} THEN 0 ELSE 1 END,
        l.updated_at DESC,
        l.created_at DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      title: row.title || "Shared Line",
      status: row.status || "active",
      active: row.id === activeLineId,
      summary: row.summary || "",
      interpretationStatus: row.interpretation_status || "draft",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      positionUpdatedAt: row.position_updated_at
    }));
  }

  async createContinuityLine(input = {}) {
    const title = String(input.title || "").trim();
    if (!title) throw new Error("Shared Line title is required.");
    const id = String(input.id || newId("line")).trim();
    await this.exec(`
      INSERT INTO continuity_lines (id, title, status)
      VALUES (${sqlString(id)}, ${sqlString(title)}, 'active');
    `);
    if (input.makeActive !== false) {
      await this.setActiveContinuityLine(id);
    }
    return (await this.listContinuityLines(100)).find((line) => line.id === id);
  }

  async renameContinuityLine(lineId, title) {
    const id = await this.resolveContinuityLineId(lineId);
    const nextTitle = String(title || "").trim();
    if (!nextTitle) throw new Error("Shared Line title is required.");
    await this.exec(`
      UPDATE continuity_lines
      SET title = ${sqlString(nextTitle)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(id)} AND status = 'active';
    `);
    return (await this.listContinuityLines(100)).find((line) => line.id === id);
  }

  async archiveContinuityLine(lineId) {
    const id = String(lineId || "").trim();
    if (!id) throw new Error("Shared Line id is required.");
    if (id === "line_default") throw new Error("Default Shared Line cannot be archived.");
    await this.ensureDefaultContinuityLine();
    const rows = await this.query(`
      SELECT id
      FROM continuity_lines
      WHERE id = ${sqlString(id)} AND status = 'active'
      LIMIT 1;
    `);
    if (!rows[0]?.id) throw new Error("Active Shared Line not found.");
    await this.exec(`
      UPDATE continuity_lines
      SET status = 'archived',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(id)};
    `);
    const activeLineId = await this.getActiveContinuityLineId();
    if (activeLineId === id) {
      await this.setActiveContinuityLine("line_default");
    }
    return (await this.listContinuityLines(100)).find((line) => line.id === id);
  }

  async restoreContinuityLine(lineId, makeActive = false) {
    const id = String(lineId || "").trim();
    if (!id) throw new Error("Shared Line id is required.");
    await this.ensureDefaultContinuityLine();
    const rows = await this.query(`
      SELECT id
      FROM continuity_lines
      WHERE id = ${sqlString(id)} AND status = 'archived'
      LIMIT 1;
    `);
    if (!rows[0]?.id) throw new Error("Archived Shared Line not found.");
    await this.exec(`
      UPDATE continuity_lines
      SET status = 'active',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(id)};
    `);
    if (makeActive) {
      await this.setActiveContinuityLine(id);
    }
    return (await this.listContinuityLines(100)).find((line) => line.id === id);
  }

  async setActiveContinuityLine(lineId) {
    const id = await this.resolveContinuityLineId(lineId);
    await this.exec(`
      INSERT INTO app_settings (key, value_json, updated_at)
      VALUES ('continuity.active_line_id', ${jsonSql(id)}, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = CURRENT_TIMESTAMP;
    `);
    return (await this.listContinuityLines(100)).find((line) => line.id === id);
  }

  async getCurrentPosition(lineIdInput = null) {
    const lineId = await this.resolveContinuityLineId(lineIdInput);
    const rows = await this.query(`
      SELECT
        l.id AS line_id,
        l.title AS line_title,
        l.status AS line_status,
        p.id AS position_id,
        p.summary,
        p.interpretation_status,
        p.facts_used_json,
        p.updated_at
      FROM continuity_lines l
      LEFT JOIN current_positions p ON p.line_id = l.id
      WHERE l.id = ${sqlString(lineId)}
      ORDER BY p.updated_at DESC
      LIMIT 1;
    `);
    const row = rows[0] || {};
    return {
      lineId,
      lineTitle: row.line_title || "Default Shared Line",
      lineStatus: row.line_status || "active",
      positionId: row.position_id || "position_default",
      summary: row.summary || "",
      interpretationStatus: row.interpretation_status || "draft",
      factsUsed: parseJson(row.facts_used_json, []),
      updatedAt: row.updated_at || null
    };
  }

  async saveCurrentPosition(input) {
    const lineId = await this.resolveContinuityLineId(input?.lineId || null);
    const positionId = `position_${lineId}`;
    const summary = String(input?.summary || "").trim();
    if (!summary) throw new Error("Current position summary is required.");
    const status = ["draft", "confirmed"].includes(String(input?.interpretationStatus || "").trim())
      ? String(input.interpretationStatus).trim()
      : "draft";
    const factsUsed = Array.isArray(input?.factsUsed) ? input.factsUsed.map((item) => String(item).trim()).filter(Boolean) : [];
    const source = String(input?.source || "desktop").trim() || "desktop";
    const current = await this.getCurrentPosition(lineId);
    const currentFacts = JSON.stringify(current.factsUsed || []);
    const nextFacts = JSON.stringify(factsUsed);
    const changesConfirmedPosition =
      current.summary &&
      current.interpretationStatus === "confirmed" &&
      (current.summary !== summary || current.interpretationStatus !== status || currentFacts !== nextFacts);
    if (changesConfirmedPosition && input?.confirmOverwrite !== true) {
      const error = new Error("Confirmed Shared Line overwrite requires explicit confirmation.");
      error.code = "SHARED_LINE_CONFIRM_OVERWRITE_REQUIRED";
      error.currentPosition = current;
      throw error;
    }
    const historyId = newId("position_history");
    const snapshotId = newId("position_snapshot");
    const snapshotReason = changesConfirmedPosition ? "confirmed_overwrite" : "save";
    await this.exec(`
      INSERT INTO current_positions (id, line_id, summary, interpretation_status, facts_used_json, updated_at)
      VALUES (${sqlString(positionId)}, ${sqlString(lineId)}, ${sqlString(summary)}, ${sqlString(status)}, ${jsonSql(factsUsed)}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        summary = excluded.summary,
        interpretation_status = excluded.interpretation_status,
        facts_used_json = excluded.facts_used_json,
        updated_at = CURRENT_TIMESTAMP;

      INSERT INTO continuity_position_history (id, line_id, position_id, summary, interpretation_status, facts_used_json, source)
      VALUES (${sqlString(historyId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summary)}, ${sqlString(status)}, ${jsonSql(factsUsed)}, ${sqlString(source)});

      INSERT INTO continuity_snapshots (id, line_id, position_id, summary, interpretation_status, facts_used_json, reason)
      VALUES (${sqlString(snapshotId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summary)}, ${sqlString(status)}, ${jsonSql(factsUsed)}, ${sqlString(snapshotReason)});

      UPDATE continuity_lines
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(lineId)};
    `);
    return this.getCurrentPosition(lineId);
  }

  async listContinuitySnapshots(limit = 8, lineIdInput = null) {
    const lineId = await this.resolveContinuityLineId(lineIdInput);
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 8, 30));
    const rows = await this.query(`
      SELECT id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at
      FROM continuity_snapshots
      WHERE line_id = ${sqlString(lineId)}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      lineId: row.line_id,
      positionId: row.position_id,
      summary: row.summary || "",
      interpretationStatus: row.interpretation_status || "draft",
      factsUsed: parseJson(row.facts_used_json, []),
      reason: row.reason || "save",
      createdAt: row.created_at
    }));
  }

  async listContinuityPositionHistory(limit = 8, lineIdInput = null) {
    const lineId = await this.resolveContinuityLineId(lineIdInput);
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 8, 30));
    const rows = await this.query(`
      SELECT id, line_id, position_id, summary, interpretation_status, facts_used_json, source, created_at
      FROM continuity_position_history
      WHERE line_id = ${sqlString(lineId)}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      lineId: row.line_id,
      positionId: row.position_id,
      summary: row.summary || "",
      interpretationStatus: row.interpretation_status || "draft",
      factsUsed: parseJson(row.facts_used_json, []),
      source: row.source || "desktop",
      createdAt: row.created_at
    }));
  }

  async listContinuityHandoffs(limit = 5, lineIdInput = null) {
    const lineId = await this.resolveContinuityLineId(lineIdInput);
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 5, 20));
    const rows = await this.query(`
      SELECT id, line_id, objective, completed_json, open_items_json, next_step, created_at
      FROM continuity_handoffs
      WHERE line_id = ${sqlString(lineId)}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      lineId: row.line_id,
      objective: row.objective || "",
      completed: parseJson(row.completed_json, []),
      openItems: parseJson(row.open_items_json, []),
      nextStep: row.next_step || "",
      createdAt: row.created_at
    }));
  }

  async createContinuityHandoff(input = {}) {
    const currentPosition = await this.getCurrentPosition(input.lineId || null);
    const id = newId("handoff");
    const objective = String(input.objective || currentPosition.summary || "Continue from the current Shared Line.").trim();
    const completed = Array.isArray(input.completed)
      ? input.completed.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const openItems = Array.isArray(input.openItems)
      ? input.openItems.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const nextStep = String(
      input.nextStep ||
        (currentPosition.summary ? "Resume from the current Shared Line and keep history updated." : "Read the Shared Line before starting.")
    ).trim();
    if (!objective) throw new Error("Handoff objective is required.");
    await this.exec(`
      INSERT INTO continuity_handoffs (id, line_id, objective, completed_json, open_items_json, next_step)
      VALUES (
        ${sqlString(id)},
        ${sqlString(currentPosition.lineId)},
        ${sqlString(objective)},
        ${jsonSql(completed)},
        ${jsonSql(openItems)},
        ${sqlString(nextStep)}
      );
    `);
    return this.getContinuityHandoff(id);
  }

  async getContinuityHandoff(id) {
    const rows = await this.query(`
      SELECT id, line_id, objective, completed_json, open_items_json, next_step, created_at
      FROM continuity_handoffs
      WHERE id = ${sqlString(id)}
      LIMIT 1;
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      lineId: row.line_id,
      objective: row.objective || "",
      completed: parseJson(row.completed_json, []),
      openItems: parseJson(row.open_items_json, []),
      nextStep: row.next_step || "",
      createdAt: row.created_at
    };
  }

  async getResumePacket(input = {}) {
    const currentPosition = await this.getCurrentPosition(input.lineId || null);
    const lines = await this.listContinuityLines(20);
    const history = await this.listContinuityPositionHistory(5, currentPosition.lineId);
    const snapshots = await this.listContinuitySnapshots(5, currentPosition.lineId);
    const handoffs = await this.listContinuityHandoffs(3, currentPosition.lineId);
    const nextStep = currentPosition.summary
      ? "Resume from the current shared position and ask before overwriting it."
      : "No shared position has been saved yet.";
    const historyText = history.length
      ? history.map((item, index) => `${index + 1}. ${item.summary} (${item.interpretationStatus}, ${item.createdAt})`).join("\n")
      : "(none)";
    const handoffText = handoffs.length
      ? handoffs.map((item, index) => `${index + 1}. ${item.objective} -> ${item.nextStep} (${item.createdAt})`).join("\n")
      : "(none)";
    return {
      lineId: currentPosition.lineId,
      lineTitle: currentPosition.lineTitle,
      lines,
      currentPosition,
      history,
      snapshots,
      handoffs,
      nextStep,
      text: [
        `Shared Line: ${currentPosition.lineTitle}`,
        `Current position: ${currentPosition.summary || "(empty)"}`,
        `Interpretation status: ${currentPosition.interpretationStatus}`,
        `Updated at: ${currentPosition.updatedAt || "(not saved)"}`,
        `Recent history:\n${historyText}`,
        `Recent handoffs:\n${handoffText}`,
        `Next step: ${nextStep}`
      ].join("\n")
    };
  }

  async getGatewayContext(input = {}) {
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const query = String(input.query || "").trim();
    const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 5), 10) || 5, 20));
    const sharedLine = await this.getResumePacket(input.lineId ? { lineId: input.lineId } : {});
    const memories = query
      ? (await this.searchMemories(query, limit)).results.slice(0, limit)
      : await this.listMemories(limit);
    const innerLife = await this.getInnerLifeSnapshot();
    const doctor = await this.getInnerLifeDoctor(agentId);
    const pendingShares = (innerLife.pendingShares || []).slice(0, limit);
    const pendingInbox = (innerLife.inbox || []).filter((item) => item.status === "pending").slice(0, limit);
    const memoryText = memories.length
      ? memories.map((memory, index) => `${index + 1}. ${memory.title || memory.body.slice(0, 80)} [${memory.id}]`).join("\n")
      : "(none)";
    const shareText = pendingShares.length
      ? pendingShares.map((share, index) => `${index + 1}. ${String(share.body || "").split("\n")[0]} [${share.id}]`).join("\n")
      : "(none)";
    const inboxText = pendingInbox.length
      ? pendingInbox.map((item, index) => `${index + 1}. ${item.source}: ${item.body}`).join("\n")
      : "(none)";
    const doctorText = doctor.issues.length
      ? doctor.issues.map((issue, index) => `${index + 1}. ${issue.level}/${issue.code}: ${issue.message} Action: ${issue.action}`).join("\n")
      : "No recovery action is needed.";
    const text = [
      "# ClaraCore Gateway Context",
      "",
      `Agent: ${agentId}`,
      `Generated at: ${new Date().toISOString()}`,
      `Doctor: ${doctor.status} - ${doctor.summary}`,
      "",
      "## Shared Line",
      sharedLine.text,
      "",
      "## Recent Memory",
      memoryText,
      "",
      "## InnerLife",
      `Daemon: ${innerLife.daemon?.status || "paused"}`,
      `Pending shares: ${innerLife.counts?.pending_shares_count || 0}`,
      `Pending inbox: ${innerLife.counts?.pending_inbox_count || 0}`,
      "Pending shares:",
      shareText,
      "Pending inbox:",
      inboxText,
      "",
      "## Recovery",
      doctorText,
      "",
      "## Agent Guidance",
      "Use Shared Line as the current position, Memory as durable facts, and InnerLife output only after review."
    ].join("\n");
    return {
      agentId,
      generatedAt: new Date().toISOString(),
      query,
      sharedLine,
      memories,
      innerLife: {
        counts: innerLife.counts,
        daemon: innerLife.daemon,
        doctor,
        pendingShares,
        pendingInbox,
        recentShares: (innerLife.recentShares || []).slice(0, limit),
        recentThoughts: (innerLife.recentThoughts || []).slice(0, limit)
      },
      guidance: {
        useSharedLine: "Treat Shared Line as the current resumable position.",
        useMemory: "Treat Memory as durable reviewed facts.",
        useInnerLife: "Use InnerLife shares only after explicit review or approved status.",
        oldServices: "Do not read or mutate old ClaraCore service databases from this Gateway context."
      },
      text
    };
  }

  async recordGatewayTrace(input = {}) {
    const id = newId("gateway_trace");
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const toolName = String(input.toolName || "unknown").trim() || "unknown";
    const status = input.status === "error" ? "error" : "ok";
    const durationMs = Math.max(0, Number.parseInt(String(input.durationMs || 0), 10) || 0);
    const responseSummary = String(input.responseSummary || "").slice(0, 500);
    const error = String(input.error || "").slice(0, 500);
    await this.exec(`
      INSERT INTO gateway_traces (id, agent_id, tool_name, status, duration_ms, request_json, response_summary, error)
      VALUES (
        ${sqlString(id)},
        ${sqlString(agentId)},
        ${sqlString(toolName)},
        ${sqlString(status)},
        ${durationMs},
        ${jsonSql(input.request || {})},
        ${sqlString(responseSummary)},
        ${sqlString(error)}
      );
    `);
    return (await this.listGatewayTraces({ limit: 1 })).find((trace) => trace.id === id);
  }

  async listGatewayTraces(input = {}) {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 20), 10) || 20, 100));
    const toolName = String(input.toolName || "").trim();
    const status = String(input.status || "").trim();
    const filters = [];
    if (toolName) filters.push(`tool_name = ${sqlString(toolName)}`);
    if (status) filters.push(`status = ${sqlString(status)}`);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = await this.query(`
      SELECT id, agent_id, tool_name, status, duration_ms, request_json, response_summary, error, created_at
      FROM gateway_traces
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      toolName: row.tool_name,
      status: row.status,
      durationMs: row.duration_ms,
      request: parseJson(row.request_json, {}),
      responseSummary: row.response_summary || "",
      error: row.error || "",
      createdAt: row.created_at
    }));
  }

  async ensureInnerLifeProfile(agentId = "my-agent") {
    const id = String(agentId || "my-agent").trim() || "my-agent";
    await this.exec(`
      INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json)
      VALUES (${sqlString(id)}, 'My Agent', 0, '{}', '{}')
      ON CONFLICT(agent_id) DO NOTHING;
    `);
    const rows = await this.query(`
      SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
      FROM innerlife_profiles
      WHERE agent_id = ${sqlString(id)};
    `);
    const row = rows[0];
    return {
      ...row,
      enabled: Boolean(row?.enabled),
      profile: parseJson(row?.profile_json, {}),
      state: parseJson(row?.state_json, {})
    };
  }

  async listInnerLifeShares(status = "pending", limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
    const statusFilter = String(status || "pending").trim();
    const whereClause = statusFilter === "all" ? "" : `WHERE s.status = ${sqlString(statusFilter)}`;
    const rows = await this.query(`
      SELECT
        s.id,
        s.agent_id,
        s.thought_id,
        s.status,
        s.body,
        s.decision_reason,
        s.created_at,
        s.updated_at,
        t.event_id,
        t.review_status
      FROM innerlife_shares s
      LEFT JOIN innerlife_thoughts t ON t.id = s.thought_id
      ${whereClause}
      ORDER BY s.updated_at DESC, s.created_at DESC
      LIMIT ${safeLimit};
    `);
    return rows;
  }

  async listInnerLifeInbox(status = "pending", limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
    const statusFilter = String(status || "pending").trim();
    const whereClause = statusFilter === "all" ? "" : `WHERE status = ${sqlString(statusFilter)}`;
    const rows = await this.query(`
      SELECT id, agent_id, source, body, status, created_at, processed_at, metadata_json
      FROM innerlife_inbox
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      source: row.source,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
      processedAt: row.processed_at,
      metadata: parseJson(row.metadata_json, {})
    }));
  }

  async submitInnerLifeInbox(input = {}) {
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const profile = await this.ensureInnerLifeProfile(agentId);
    const body = String(input.body || "").trim();
    if (!body) throw new Error("InnerLife inbox body is required.");
    const source = String(input.source || "desktop").trim() || "desktop";
    const id = newId("inner_inbox");
    await this.exec(`
      INSERT INTO innerlife_inbox (id, agent_id, source, body, status, metadata_json)
      VALUES (${sqlString(id)}, ${sqlString(profile.agent_id)}, ${sqlString(source)}, ${sqlString(body)}, 'pending', ${jsonSql(input.metadata || {})});
    `);
    return (await this.listInnerLifeInbox("all", 100)).find((item) => item.id === id);
  }

  async ensureInnerLifeDaemonState(agentId = "my-agent") {
    const profile = await this.ensureInnerLifeProfile(agentId);
    const settings = await this.getSettings();
    const enabled = Boolean(settings["innerlife.enabled"]);
    await this.exec(`
      INSERT INTO innerlife_daemon_state (agent_id, status, enabled, last_result, metadata_json)
      VALUES (
        ${sqlString(profile.agent_id)},
        ${enabled ? "'enabled'" : "'paused'"},
        ${enabled ? 1 : 0},
        'initialized',
        '{}'
      )
      ON CONFLICT(agent_id) DO NOTHING;
    `);
    const rows = await this.query(`
      SELECT agent_id, status, enabled, last_tick_at, next_run_at, last_result, last_error, tick_count, updated_at, metadata_json
      FROM innerlife_daemon_state
      WHERE agent_id = ${sqlString(profile.agent_id)}
      LIMIT 1;
    `);
    const row = rows[0] || {};
    return {
      agentId: row.agent_id || profile.agent_id,
      status: row.status || (enabled ? "enabled" : "paused"),
      enabled: Boolean(row.enabled),
      lastTickAt: row.last_tick_at || null,
      nextRunAt: row.next_run_at || null,
      lastResult: row.last_result || "",
      lastError: row.last_error || "",
      tickCount: row.tick_count || 0,
      updatedAt: row.updated_at || null,
      metadata: parseJson(row.metadata_json, {})
    };
  }

  async setInnerLifeDaemonState(input = {}) {
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const profile = await this.ensureInnerLifeProfile(agentId);
    const action = String(input.action || "").trim().toLowerCase();
    const enable = action === "enable" || action === "start" || input.enabled === true;
    const pause = action === "pause" || action === "disable" || action === "stop" || input.enabled === false;
    if (!enable && !pause) throw new Error("InnerLife daemon action must be enable or pause.");
    const settings = await this.getSettings();
    const pollSeconds = Math.max(1, Number.parseInt(String(settings["innerlife.loop_seconds"] || 15), 10) || 15);
    await this.updateSettings({ "innerlife.enabled": enable });
    await this.exec(`
      INSERT INTO innerlife_daemon_state (agent_id, status, enabled, next_run_at, last_result, last_error, updated_at, metadata_json)
      VALUES (
        ${sqlString(profile.agent_id)},
        ${enable ? "'enabled'" : "'paused'"},
        ${enable ? 1 : 0},
        ${enable ? `datetime('now', '+${pollSeconds} seconds')` : "NULL"},
        ${enable ? "'enabled'" : "'paused'"},
        '',
        CURRENT_TIMESTAMP,
        ${jsonSql({ pollSeconds, failureCount: 0, retrySeconds: 0 })}
      )
      ON CONFLICT(agent_id) DO UPDATE SET
        status = excluded.status,
        enabled = excluded.enabled,
        next_run_at = excluded.next_run_at,
        last_result = excluded.last_result,
        last_error = '',
        updated_at = CURRENT_TIMESTAMP,
        metadata_json = excluded.metadata_json;

      UPDATE innerlife_profiles
      SET enabled = ${enable ? 1 : 0},
          updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = ${sqlString(profile.agent_id)};
    `);
    return this.ensureInnerLifeDaemonState(profile.agent_id);
  }

  async tickInnerLifeDaemon(input = {}) {
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const force = Boolean(input.force);
    const state = await this.ensureInnerLifeDaemonState(agentId);
    if (!state.enabled || state.status === "paused") {
      return {
        ran: false,
        reason: "paused",
        daemon: state,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    const dueRows = await this.query(`
      SELECT CASE
        WHEN next_run_at IS NULL THEN 1
        WHEN next_run_at <= CURRENT_TIMESTAMP THEN 1
        ELSE 0
      END AS due
      FROM innerlife_daemon_state
      WHERE agent_id = ${sqlString(agentId)}
      LIMIT 1;
    `);
    const due = Boolean(dueRows[0]?.due);
    if (!force && !due) {
      return {
        ran: false,
        reason: "not_due",
        daemon: state,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    const settings = await this.getSettings();
    const pollSeconds = Math.max(1, Number.parseInt(String(settings["innerlife.loop_seconds"] || 15), 10) || 15);
    const pendingInbox = await this.listInnerLifeInbox("pending", 5);
    if (pendingInbox.length === 0) {
      await this.exec(`
        UPDATE innerlife_daemon_state
        SET status = 'enabled',
            last_tick_at = CURRENT_TIMESTAMP,
            next_run_at = datetime('now', '+${pollSeconds} seconds'),
            last_result = 'idle',
            last_error = '',
            tick_count = tick_count + 1,
            updated_at = CURRENT_TIMESTAMP,
            metadata_json = ${jsonSql({ pollSeconds, pendingInbox: 0, failureCount: 0, retrySeconds: 0 })}
        WHERE agent_id = ${sqlString(agentId)};
      `);
      return {
        ran: false,
        reason: "idle",
        daemon: await this.ensureInnerLifeDaemonState(agentId),
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    await this.exec(`
      UPDATE innerlife_daemon_state
      SET status = 'running',
          updated_at = CURRENT_TIMESTAMP
      WHERE agent_id = ${sqlString(agentId)};
    `);
    try {
      const result = await this.processInnerLifeOnce({
        prompt: "Daemon tick: digest pending inbox and create only a reviewable share candidate."
      });
      await this.exec(`
        UPDATE innerlife_daemon_state
        SET status = 'enabled',
            last_tick_at = CURRENT_TIMESTAMP,
            next_run_at = datetime('now', '+${pollSeconds} seconds'),
            last_result = ${sqlString(`processed ${pendingInbox.length} inbox item(s)`)},
            last_error = '',
            tick_count = tick_count + 1,
            updated_at = CURRENT_TIMESTAMP,
            metadata_json = ${jsonSql({ pollSeconds, pendingInbox: pendingInbox.length, shareId: result.share?.id || "", failureCount: 0, retrySeconds: 0 })}
        WHERE agent_id = ${sqlString(agentId)};
      `);
      return {
        ran: true,
        reason: "processed",
        result,
        daemon: await this.ensureInnerLifeDaemonState(agentId),
        snapshot: await this.getInnerLifeSnapshot()
      };
    } catch (error) {
      const failureCount = Math.max(0, Number.parseInt(String(state.metadata?.failureCount || 0), 10) || 0) + 1;
      const retrySeconds = innerLifeRetrySeconds(pollSeconds, failureCount);
      await this.exec(`
        UPDATE innerlife_daemon_state
        SET status = 'error',
            last_tick_at = CURRENT_TIMESTAMP,
            next_run_at = datetime('now', '+${retrySeconds} seconds'),
            last_result = ${sqlString(`retry in ${retrySeconds}s`)},
            last_error = ${sqlString(error.message || String(error))},
            tick_count = tick_count + 1,
            updated_at = CURRENT_TIMESTAMP,
            metadata_json = ${jsonSql({
              pollSeconds,
              pendingInbox: pendingInbox.length,
              failureCount,
              retrySeconds,
              error: error.message || String(error)
            })}
        WHERE agent_id = ${sqlString(agentId)};
      `);
      throw error;
    }
  }

  async listInnerLifeDigestRuns(agentId = "my-agent", limit = 10) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
    const rows = await this.query(`
      SELECT id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json
      FROM innerlife_digest_runs
      WHERE agent_id = ${sqlString(agentId)}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      mode: row.mode,
      status: row.status,
      input: parseJson(row.input_json, {}),
      summary: row.summary || "",
      createdAt: row.created_at,
      completedAt: row.completed_at,
      metadata: parseJson(row.metadata_json, {})
    }));
  }

  async listInnerLifeShareChecks(agentId = "my-agent", limit = 10) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
    const rows = await this.query(`
      SELECT c.id, c.share_id, c.agent_id, c.session_id, c.context, c.decision, c.reason, c.created_at, c.metadata_json, s.body AS share_body, s.status AS share_status
      FROM innerlife_share_checks c
      LEFT JOIN innerlife_shares s ON s.id = c.share_id
      WHERE c.agent_id = ${sqlString(agentId)}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      shareId: row.share_id,
      agentId: row.agent_id,
      sessionId: row.session_id,
      context: row.context || "",
      decision: row.decision,
      reason: row.reason || "",
      createdAt: row.created_at,
      shareBody: row.share_body || "",
      shareStatus: row.share_status || "",
      metadata: parseJson(row.metadata_json, {})
    }));
  }

  async getInnerLifeSnapshot() {
    const profile = await this.ensureInnerLifeProfile("my-agent");
    const pendingShares = await this.listInnerLifeShares("pending", 20);
    const recentShares = await this.listInnerLifeShares("all", 20);
    const sessions = await this.listInnerLifeSessions(profile.agent_id, 10);
    const inbox = await this.listInnerLifeInbox("all", 20);
    const digestRuns = await this.listInnerLifeDigestRuns(profile.agent_id, 10);
    const shareChecks = await this.listInnerLifeShareChecks(profile.agent_id, 10);
    const daemon = await this.ensureInnerLifeDaemonState(profile.agent_id);
    const rows = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'pending') AS pending_inbox_count,
        (SELECT COUNT(*) FROM innerlife_inbox WHERE status = 'processed') AS processed_inbox_count,
        (SELECT COUNT(*) FROM innerlife_events) AS events_count,
        (SELECT COUNT(*) FROM innerlife_thoughts) AS thoughts_count,
        (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'pending') AS pending_shares_count,
        (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'approved') AS approved_shares_count,
        (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'rejected') AS rejected_shares_count,
        (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'used') AS used_shares_count,
        (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'deferred') AS deferred_shares_count,
        (SELECT COUNT(*) FROM innerlife_shares WHERE status = 'discarded') AS discarded_shares_count,
        (SELECT COUNT(*) FROM innerlife_digest_runs) AS digest_runs_count,
        (SELECT COUNT(*) FROM innerlife_share_checks) AS share_checks_count,
        (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'active') AS active_sessions_count,
        (SELECT COUNT(*) FROM innerlife_sessions WHERE status = 'ended') AS ended_sessions_count;
    `);
    return {
      profile,
      counts: rows[0] || {},
      pendingShares,
      recentShares,
      sessions,
      inbox,
      digestRuns,
      shareChecks,
      daemon,
      doctor: await this.getInnerLifeDoctor(profile.agent_id)
    };
  }

  async getInnerLifeDoctor(agentId = "my-agent") {
    const profile = await this.ensureInnerLifeProfile(agentId);
    const daemon = await this.ensureInnerLifeDaemonState(profile.agent_id);
    const settings = await this.getSettings();
    const rows = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM innerlife_inbox WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending') AS pending_inbox_count,
        (SELECT COUNT(*) FROM innerlife_shares WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'pending') AS pending_shares_count,
        (SELECT COUNT(*) FROM innerlife_sessions WHERE agent_id = ${sqlString(profile.agent_id)} AND status = 'active') AS active_sessions_count;
    `);
    const counts = rows[0] || {};
    const issues = [];
    const failureCount = Number.parseInt(String(daemon.metadata?.failureCount || 0), 10) || 0;
    const retrySeconds = Number.parseInt(String(daemon.metadata?.retrySeconds || 0), 10) || 0;
    if (daemon.status === "error") {
      issues.push({
        level: failureCount >= 3 ? "error" : "warn",
        code: "daemon_retrying",
        message: daemon.lastError || "InnerLife daemon failed and is waiting before retry.",
        action: `Review the last error, keep pending inbox intact, and retry after ${retrySeconds}s or pause the daemon.`
      });
    }
    if (daemon.enabled && String(settings["innerlife.provider"] || "disabled") === "disabled") {
      issues.push({
        level: "warn",
        code: "model_disabled",
        message: "InnerLife daemon is enabled while the model provider is disabled.",
        action: "Configure an InnerLife model provider before relying on model-backed output."
      });
    }
    if (counts.pending_inbox_count > 0 && !daemon.enabled) {
      issues.push({
        level: "info",
        code: "pending_inbox_paused",
        message: `${counts.pending_inbox_count} inbox item(s) are waiting while the daemon is paused.`,
        action: "Run process once, run a digest, or enable the daemon when ready."
      });
    }
    const hasError = issues.some((issue) => issue.level === "error");
    const hasWarning = issues.some((issue) => issue.level === "warn");
    const status = hasError ? "error" : hasWarning ? "warn" : "ok";
    const nextActions = issues.map((issue) => issue.action);
    if (nextActions.length === 0) {
      nextActions.push("No recovery action is needed.");
    }
    return {
      status,
      summary:
        status === "ok"
          ? "InnerLife is healthy."
          : status === "warn"
            ? "InnerLife needs attention but can recover."
            : "InnerLife needs recovery before it is reliable.",
      issues,
      nextActions,
      counts: {
        pendingInbox: counts.pending_inbox_count || 0,
        pendingShares: counts.pending_shares_count || 0,
        activeSessions: counts.active_sessions_count || 0
      },
      daemon: {
        status: daemon.status,
        enabled: daemon.enabled,
        lastError: daemon.lastError,
        nextRunAt: daemon.nextRunAt,
        failureCount,
        retrySeconds
      }
    };
  }

  async getInnerLifeBriefing(agentId = "my-agent") {
    const profile = await this.ensureInnerLifeProfile(agentId);
    const resumePacket = await this.getResumePacket();
    const memories = await this.listMemories(5);
    const pendingShares = await this.listInnerLifeShares("pending", 5);
    const pendingInbox = await this.listInnerLifeInbox("pending", 5);
    const rows = await this.query(`
      SELECT body, created_at
      FROM innerlife_thoughts
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    return {
      agentId: profile.agent_id,
      generatedAt: new Date().toISOString(),
      sharedLine: resumePacket.currentPosition,
      recentHandoffs: resumePacket.handoffs || [],
      recentMemories: memories.map((memory) => ({
        id: memory.id,
        title: memory.title || "",
        body: memory.body || "",
        labels: memory.labels || []
      })),
      pendingShares,
      pendingInbox,
      recentThoughts: rows.map((row) => ({
        body: row.body || "",
        createdAt: row.created_at
      })),
      text: [
        `Agent: ${profile.agent_id}`,
        `Current position: ${resumePacket.currentPosition.summary || "(empty)"}`,
        `Pending shares: ${pendingShares.length}`,
        `Pending inbox: ${pendingInbox.length}`,
        `Recent memories: ${memories.length}`,
        `Recent thoughts: ${rows.length}`
      ].join("\n")
    };
  }

  async runInnerLifeDigest(input = {}) {
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const profile = await this.ensureInnerLifeProfile(agentId);
    const mode = String(input.mode || "manual").trim() || "manual";
    const prompt = String(input.prompt || "").trim();
    const resumePacket = await this.getResumePacket();
    const memories = await this.listMemories(5);
    const inboxItems = await this.listInnerLifeInbox("pending", 10);
    const digestId = newId("inner_digest");
    const eventId = newId("inner_event");
    const thoughtId = newId("inner_thought");
    const memoryLines = memories.map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
    const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body}`).join("\n") || "- No pending inbox items.";
    const currentPosition = resumePacket.currentPosition.summary || "No Shared Line position saved yet.";
    const summary = [
      "InnerLife digest",
      "",
      `Mode: ${mode}`,
      `Current position: ${currentPosition}`,
      "",
      "Inbox digested:",
      inboxLines,
      "",
      "Recent Memory context:",
      memoryLines,
      "",
      `Operator prompt: ${prompt || "Digest current state without sharing automatically."}`
    ].join("\n");
    await this.exec(`
      INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, input_json, summary, completed_at, metadata_json)
      VALUES (
        ${sqlString(digestId)},
        ${sqlString(profile.agent_id)},
        ${sqlString(mode)},
        'completed',
        ${jsonSql(input)},
        ${sqlString(summary)},
        CURRENT_TIMESTAMP,
        ${jsonSql({
          lineId: resumePacket.lineId,
          positionId: resumePacket.currentPosition.positionId,
          memoryIds: memories.map((memory) => memory.id),
          inboxIds: inboxItems.map((item) => item.id)
        })}
      );

      INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
      VALUES (
        ${sqlString(eventId)},
        ${sqlString(profile.agent_id)},
        'digest',
        ${sqlString(prompt || "Manual digest")},
        'processed',
        ${jsonSql({ digestId, inboxIds: inboxItems.map((item) => item.id) })}
      );

      INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
      VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(summary)}, 'unreviewed');
    `);
    if (inboxItems.length > 0) {
      await this.exec(`
        UPDATE innerlife_inbox
        SET status = 'processed',
            processed_at = CURRENT_TIMESTAMP
        WHERE id IN (${inboxItems.map((item) => sqlString(item.id)).join(", ")});
      `);
    }
    return {
      digest: (await this.listInnerLifeDigestRuns(profile.agent_id, 100)).find((run) => run.id === digestId),
      eventId,
      thoughtId,
      processedInboxIds: inboxItems.map((item) => item.id),
      snapshot: await this.getInnerLifeSnapshot()
    };
  }

  async checkInnerLifeShareTiming(input = {}) {
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const profile = await this.ensureInnerLifeProfile(agentId);
    const context = String(input.context || "").trim();
    const sessionId = String(input.sessionId || "").trim() || null;
    const requestedShareId = String(input.shareId || "").trim();
    let share = requestedShareId ? await this.getInnerLifeShare(requestedShareId) : null;
    if (!share) {
      const available = await this.query(`
        SELECT id
        FROM innerlife_shares
        WHERE agent_id = ${sqlString(profile.agent_id)}
          AND status IN ('approved', 'pending', 'deferred')
        ORDER BY
          CASE status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
          updated_at DESC,
          created_at DESC
        LIMIT 1;
      `);
      if (available[0]?.id) {
        share = await this.getInnerLifeShare(available[0].id);
      }
    }
    if (!share) {
      const checkId = newId("inner_share_check");
      await this.exec(`
        INSERT INTO innerlife_share_checks (id, share_id, agent_id, session_id, context, decision, reason, metadata_json)
        VALUES (
          ${sqlString(checkId)},
          NULL,
          ${sqlString(profile.agent_id)},
          ${sessionId ? sqlString(sessionId) : "NULL"},
          ${sqlString(context)},
          'none',
          'No reviewable InnerLife share is available.',
          '{}'
        );
      `);
      return {
        check: (await this.listInnerLifeShareChecks(profile.agent_id, 100)).find((item) => item.id === checkId),
        share: null,
        snapshot: await this.getInnerLifeSnapshot()
      };
    }
    const contextTokens = meaningfulTokens(context);
    const shareTokens = new Set(meaningfulTokens(share.body));
    const overlap = contextTokens.filter((token) => shareTokens.has(token));
    const hasAsk = /\b(ask|asked|question|share|need|use|recall|remember)\b/i.test(context) || /分享|需要|使用|记得|回忆|问题/u.test(context);
    let decision = "defer";
    let reason = "Context is not specific enough yet.";
    if (!context) {
      decision = "defer";
      reason = "No current context was provided.";
    } else if (share.status === "approved" && (hasAsk || overlap.length > 0 || context.length >= 20)) {
      decision = "use";
      reason = overlap.length > 0 ? `Context matches: ${overlap.slice(0, 5).join(", ")}.` : "Approved share fits the current context.";
    } else if (share.status === "pending") {
      decision = "review_first";
      reason = "The share still needs review before use.";
    } else if (share.status === "deferred") {
      decision = overlap.length > 0 || hasAsk ? "use" : "defer";
      reason = decision === "use" ? "Deferred share now matches the current context." : "Deferred share still does not match the current context.";
    }
    const checkId = newId("inner_share_check");
    await this.exec(`
      INSERT INTO innerlife_share_checks (id, share_id, agent_id, session_id, context, decision, reason, metadata_json)
      VALUES (
        ${sqlString(checkId)},
        ${sqlString(share.id)},
        ${sqlString(profile.agent_id)},
        ${sessionId ? sqlString(sessionId) : "NULL"},
        ${sqlString(context)},
        ${sqlString(decision)},
        ${sqlString(reason)},
        ${jsonSql({ overlap })}
      );
    `);
    return {
      check: (await this.listInnerLifeShareChecks(profile.agent_id, 100)).find((item) => item.id === checkId),
      share,
      snapshot: await this.getInnerLifeSnapshot()
    };
  }

  async listInnerLifeSessions(agentId = "my-agent", limit = 20) {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(limit), 10) || 20, 100));
    const rows = await this.query(`
      SELECT id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json
      FROM innerlife_sessions
      WHERE agent_id = ${sqlString(agentId)}
      ORDER BY started_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      userId: row.user_id,
      host: row.host,
      externalSessionId: row.external_session_id,
      status: row.status,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      briefing: parseJson(row.briefing_json, {}),
      summary: row.summary || "",
      metadata: parseJson(row.metadata_json, {})
    }));
  }

  async startInnerLifeSession(input = {}) {
    const agentId = String(input.agentId || "my-agent").trim() || "my-agent";
    const profile = await this.ensureInnerLifeProfile(agentId);
    const userId = String(input.userId || "local-user").trim() || "local-user";
    const host = String(input.host || "desktop").trim() || "desktop";
    const externalSessionId = String(input.externalSessionId || "").trim() || newId("external_session");
    const existing = await this.query(`
      SELECT id
      FROM innerlife_sessions
      WHERE agent_id = ${sqlString(profile.agent_id)}
        AND external_session_id = ${sqlString(externalSessionId)}
      LIMIT 1;
    `);
    if (existing[0]?.id) {
      return {
        session: (await this.listInnerLifeSessions(profile.agent_id, 100)).find((session) => session.id === existing[0].id),
        briefing: parseJson((await this.query(`SELECT briefing_json FROM innerlife_sessions WHERE id = ${sqlString(existing[0].id)};`))[0]?.briefing_json, {})
      };
    }
    const briefing = await this.getInnerLifeBriefing(profile.agent_id);
    const id = newId("inner_session");
    await this.exec(`
      INSERT INTO innerlife_sessions (id, agent_id, user_id, host, external_session_id, status, briefing_json, metadata_json)
      VALUES (
        ${sqlString(id)},
        ${sqlString(profile.agent_id)},
        ${sqlString(userId)},
        ${sqlString(host)},
        ${sqlString(externalSessionId)},
        'active',
        ${jsonSql(briefing)},
        ${jsonSql({ startedBy: "desktop" })}
      );
    `);
    return {
      session: (await this.listInnerLifeSessions(profile.agent_id, 100)).find((session) => session.id === id),
      briefing
    };
  }

  async endInnerLifeSession(sessionId, input = {}) {
    const id = String(sessionId || "").trim();
    if (!id) throw new Error("InnerLife session id is required.");
    const rows = await this.query(`
      SELECT id, agent_id, status
      FROM innerlife_sessions
      WHERE id = ${sqlString(id)}
      LIMIT 1;
    `);
    const session = rows[0];
    if (!session) throw new Error("InnerLife session not found.");
    const summary = String(input.summary || input.transcript || "").trim();
    const eventId = newId("inner_event");
    const thoughtId = newId("inner_thought");
    const shareId = newId("inner_share");
    const inboxId = newId("inner_inbox");
    const body = [
      "Session afterthought",
      "",
      `Session: ${id}`,
      `Summary: ${summary || "No summary provided."}`,
      "",
      "Review before sharing or applying this anywhere."
    ].join("\n");
    await this.exec(`
      UPDATE innerlife_sessions
      SET status = 'ended',
          ended_at = CURRENT_TIMESTAMP,
          summary = ${sqlString(summary)}
      WHERE id = ${sqlString(id)};

      INSERT INTO innerlife_inbox (id, agent_id, source, body, status, metadata_json)
      VALUES (
        ${sqlString(inboxId)},
        ${sqlString(session.agent_id)},
        'session_end',
        ${sqlString(summary || "Session ended")},
        'processed',
        ${jsonSql({ sessionId: id })}
      );

      INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
      VALUES (
        ${sqlString(eventId)},
        ${sqlString(session.agent_id)},
        'session_end',
        ${sqlString(summary || "Session ended")},
        'processed',
        ${jsonSql({ sessionId: id })}
      );

      INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
      VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
      VALUES (${sqlString(shareId)}, ${sqlString(session.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)});
    `);
    return {
      session: (await this.listInnerLifeSessions(session.agent_id, 100)).find((item) => item.id === id),
      inboxId,
      eventId,
      thoughtId,
      share: (await this.listInnerLifeShares("pending", 20)).find((share) => share.id === shareId),
      snapshot: await this.getInnerLifeSnapshot()
    };
  }

  async processInnerLifeOnce(input = {}) {
    const profile = await this.ensureInnerLifeProfile("my-agent");
    const resumePacket = await this.getResumePacket();
    const memories = await this.listMemories(5);
    const inboxItems = await this.listInnerLifeInbox("pending", 5);
    const prompt = String(input?.prompt || "").trim();
    const eventId = newId("inner_event");
    const thoughtId = newId("inner_thought");
    const shareId = newId("inner_share");
    const memoryLines = memories.map((memory) => `- ${memory.title || memory.body.slice(0, 80)}`).join("\n") || "- No recent Memory records.";
    const inboxLines = inboxItems.map((item) => `- ${item.source}: ${item.body}`).join("\n") || "- No pending inbox items.";
    const position = resumePacket.currentPosition.summary || "No Shared Line position saved yet.";
    const body = [
      "Manual InnerLife review",
      "",
      `Current position: ${position}`,
      "",
      "Recent Memory context:",
      memoryLines,
      "",
      "Pending inbox:",
      inboxLines,
      "",
      `Operator prompt: ${prompt || "Review current state calmly and propose only a reviewed share candidate."}`
    ].join("\n");
    await this.exec(`
      INSERT INTO innerlife_events (id, agent_id, kind, body, status, metadata_json)
      VALUES (
        ${sqlString(eventId)},
        ${sqlString(profile.agent_id)},
        'manual_process_once',
        ${sqlString(prompt || "Manual process once")},
        'processed',
        ${jsonSql({
          lineId: resumePacket.lineId,
          positionId: resumePacket.currentPosition.positionId,
          memoryIds: memories.map((memory) => memory.id),
          inboxIds: inboxItems.map((item) => item.id)
        })}
      );

      INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
      VALUES (${sqlString(thoughtId)}, ${sqlString(eventId)}, ${sqlString(body)}, 'unreviewed');

      INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
      VALUES (${sqlString(shareId)}, ${sqlString(profile.agent_id)}, ${sqlString(thoughtId)}, 'pending', ${sqlString(body)});
    `);
    if (inboxItems.length > 0) {
      await this.exec(`
        UPDATE innerlife_inbox
        SET status = 'processed',
            processed_at = CURRENT_TIMESTAMP
        WHERE id IN (${inboxItems.map((item) => sqlString(item.id)).join(", ")});
      `);
    }
    return {
      eventId,
      thoughtId,
      share: (await this.listInnerLifeShares("pending", 20)).find((share) => share.id === shareId),
      snapshot: await this.getInnerLifeSnapshot()
    };
  }

  async reviewInnerLifeShare(id, decision, reason = "") {
    const shareId = String(id || "").trim();
    if (!shareId) throw new Error("InnerLife share id is required.");
    const status = decision === "approve" || decision === "approved" ? "approved" : decision === "reject" || decision === "rejected" ? "rejected" : "";
    if (!status) throw new Error("InnerLife share decision must be approve or reject.");
    const reviewStatus = status === "approved" ? "reviewed" : "dismissed";
    await this.exec(`
      UPDATE innerlife_shares
      SET status = ${sqlString(status)},
          decision_reason = ${sqlString(String(reason || "").trim())},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(shareId)} AND status = 'pending';

      UPDATE innerlife_thoughts
      SET review_status = ${sqlString(reviewStatus)}
      WHERE id = (
        SELECT thought_id
        FROM innerlife_shares
        WHERE id = ${sqlString(shareId)}
      );
    `);
    const rows = await this.query(`
      SELECT id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at
      FROM innerlife_shares
      WHERE id = ${sqlString(shareId)};
    `);
    if (!rows[0]) throw new Error("InnerLife share not found.");
    return rows[0];
  }

  async markInnerLifeShare(id, action, reason = "") {
    const shareId = String(id || "").trim();
    if (!shareId) throw new Error("InnerLife share id is required.");
    const normalized = String(action || "").trim().toLowerCase();
    const statusByAction = {
      used: "used",
      deferred: "deferred",
      discarded: "discarded"
    };
    const nextStatus = statusByAction[normalized];
    if (!nextStatus) throw new Error("InnerLife share action must be used, deferred, or discarded.");
    const share = await this.getInnerLifeShare(shareId);
    if (!["pending", "approved", "deferred"].includes(share.status)) {
      throw new Error(`InnerLife share cannot be marked ${normalized} from ${share.status}.`);
    }
    const actionId = newId("inner_share_action");
    await this.exec(`
      UPDATE innerlife_shares
      SET status = ${sqlString(nextStatus)},
          decision_reason = ${sqlString(String(reason || "").trim())},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(shareId)};

      INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, metadata_json)
      VALUES (
        ${sqlString(actionId)},
        ${sqlString(shareId)},
        ${sqlString(share.agent_id)},
        ${sqlString(normalized)},
        ${sqlString(String(reason || "").trim())},
        '{}'
      );
    `);
    return {
      actionId,
      share: await this.getInnerLifeShare(shareId)
    };
  }

  async listInnerLifeShareActions(shareId = null, limit = 20) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
    const whereClause = shareId ? `WHERE share_id = ${sqlString(shareId)}` : "";
    return this.query(`
      SELECT id, share_id, agent_id, action, reason, created_at, metadata_json
      FROM innerlife_share_actions
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
  }

  async getInnerLifeShare(id) {
    const shareId = String(id || "").trim();
    if (!shareId) throw new Error("InnerLife share id is required.");
    const rows = await this.query(`
      SELECT id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at
      FROM innerlife_shares
      WHERE id = ${sqlString(shareId)};
    `);
    if (!rows[0]) throw new Error("InnerLife share not found.");
    return rows[0];
  }

  async applyInnerLifeShareToMemory(id) {
    const share = await this.getInnerLifeShare(id);
    if (share.status !== "approved") {
      throw new Error("Only approved InnerLife shares can be applied to Memory.");
    }
    const memory = await this.createMemory({
      title: "InnerLife approved output",
      body: share.body,
      labels: ["innerlife", "approved"]
    });
    await this.exec(`
      UPDATE innerlife_shares
      SET decision_reason = ${sqlString(`${share.decision_reason || ""}\nApplied to Memory: ${memory.id}`.trim())},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(share.id)};
    `);
    return {
      share: await this.getInnerLifeShare(share.id),
      memory
    };
  }

  async applyInnerLifeShareToSharedLine(id) {
    const share = await this.getInnerLifeShare(id);
    if (share.status !== "approved") {
      throw new Error("Only approved InnerLife shares can be applied to Shared Line.");
    }
    await this.saveCurrentPosition({
      summary: share.body,
      interpretationStatus: "draft",
      factsUsed: [share.id],
      source: "innerlife",
      confirmOverwrite: true
    });
    const sharedLine = await this.getResumePacket();
    await this.exec(`
      UPDATE innerlife_shares
      SET decision_reason = ${sqlString(`${share.decision_reason || ""}\nApplied to Shared Line: ${sharedLine.positionId}`.trim())},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${sqlString(share.id)};
    `);
    return {
      share: await this.getInnerLifeShare(share.id),
      sharedLine
    };
  }

  async createDatabaseBackup(targetPath, metadata = {}) {
    if (!targetPath) throw new Error("Backup path is required.");
    await this.exec(`VACUUM INTO ${sqlString(targetPath)};`);
    const id = newId("backup");
    await this.exec(`
      INSERT INTO backups (id, path, status, metadata_json)
      VALUES (${sqlString(id)}, ${sqlString(targetPath)}, 'created', ${jsonSql(metadata)});
    `);
    return this.getBackup(id);
  }

  async registerBackupRecord(input = {}) {
    const id = String(input.id || newId("backup")).trim();
    const backupPath = String(input.path || "").trim();
    if (!id) throw new Error("Backup id is required.");
    if (!backupPath) throw new Error("Backup path is required.");
    const status = String(input.status || "created").trim();
    const metadata = input.metadata || {};
    await this.exec(`
      INSERT INTO backups (id, path, status, metadata_json)
      VALUES (${sqlString(id)}, ${sqlString(backupPath)}, ${sqlString(status)}, ${jsonSql(metadata)})
      ON CONFLICT(id) DO UPDATE SET
        path = excluded.path,
        status = excluded.status,
        metadata_json = excluded.metadata_json;
    `);
    return this.getBackup(id);
  }

  async getBackup(id) {
    const rows = await this.query(`
      SELECT id, path, status, created_at, metadata_json
      FROM backups
      WHERE id = ${sqlString(id)}
      LIMIT 1;
    `);
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      metadata: parseJson(row.metadata_json, {})
    };
  }

  async updateBackup(id, status, metadata = {}) {
    const existing = await this.getBackup(id);
    if (!existing) throw new Error("Backup not found.");
    await this.exec(`
      UPDATE backups
      SET
        status = ${sqlString(status)},
        metadata_json = ${jsonSql({
          ...(existing.metadata || {}),
          ...metadata
        })}
      WHERE id = ${sqlString(id)};
    `);
    return this.getBackup(id);
  }

  async listBackups(limit = 10) {
    const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 10));
    const rows = await this.query(`
      SELECT id, path, status, created_at, metadata_json
      FROM backups
      ORDER BY created_at DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      ...row,
      metadata: parseJson(row.metadata_json, {})
    }));
  }

  async getSettings() {
    const rows = await this.query("SELECT key, value_json FROM app_settings ORDER BY key;");
    return Object.fromEntries(rows.map((row) => [row.key, parseJson(row.value_json)]));
  }

  async getSecretRefs() {
    const rows = await this.query("SELECT key, provider, status, ref FROM secret_refs ORDER BY key;");
    return Object.fromEntries(rows.map((row) => [row.key, row]));
  }

  async getConfiguration(paths) {
    const settings = await this.getSettings();
    const secrets = await this.getSecretRefs();
    return {
      memoria: {
        provider: settings["memory.embedding.provider"] || "ollama",
        endpoint: settings["memory.embedding.base_url"] || "http://127.0.0.1:11434",
        model: settings["memory.embedding.model"] || "bge-m3",
        dimension: String(settings["memory.embedding.dimension"] || 1024),
        maxChars: String(settings["memory.embedding.max_chars"] || 2000),
        maintenanceEnabled: settings["memory.maintenance.enabled"] !== false,
        maintenanceHour: Number.parseInt(String(settings["memory.maintenance.hour"] ?? 3), 10) || 3,
        maintenanceLastRunDate: settings["memory.maintenance.last_run_date"] || "",
        source: "claracore.db"
      },
      innerlife: {
        root: paths.dataRoot,
        source: "claracore.db",
        backend: settings["innerlife.provider"] || "disabled",
        baseUrl: "",
        lightModel: settings["innerlife.light_model"] || "",
        deepModel: settings["innerlife.deep_model"] || "",
        pollSeconds: String(settings["innerlife.loop_seconds"] || 15),
        lightIdleSeconds: "",
        deepIdleSeconds: "",
        autonomyEnabled: String(Boolean(settings["innerlife.enabled"])),
        apiKeyStatus: secrets["innerlife.llm.api_key"]?.status || "not-configured"
      },
      gateway: {
        enabled: Boolean(settings["gateway.enabled"]),
        transport: settings["gateway.transport"] || "stdio",
        localOnly: Boolean(settings["gateway.local_only"]),
        agentId: settings["agent.default_id"] || "my-agent"
      },
      backup: {
        enabled: Boolean(settings["backup.enabled"]),
        schedule: settings["backup.schedule"] || "manual"
      }
    };
  }

  async getSummary() {
    const rows = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM app_settings) AS settings_count,
        (SELECT COUNT(*) FROM agents) AS agents_count,
        (SELECT COUNT(*) FROM memories) AS memories_count,
        (SELECT COUNT(*) FROM continuity_lines) AS continuity_lines_count,
        (SELECT COUNT(*) FROM runtime_events) AS runtime_events_count,
        (SELECT COUNT(*) FROM backups) AS backups_count;
    `);
    return {
      dbPath: this.dbPath,
      initialized: true,
      ...(rows[0] || {})
    };
  }
}

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
