const { spawn } = require("child_process");
const fs = require("fs/promises");
const http = require("http");
const https = require("https");
const path = require("path");
const { DEFAULT_AGENT_ID, DEFAULT_SETTINGS, WRITABLE_SETTINGS, normalizeSettingValue } = require("../config");
const { installInnerLifeRepository } = require("./repositories/innerlife");
const { installMemoriaRepository } = require("./repositories/memoria");
const { installContinuityRepository } = require("./repositories/continuity");

const SCHEMA_ID = "001_product_core_schema";

const databaseLocks = new Map();

function innerLifeRetrySeconds(pollSeconds, failureCount) {
    const safePoll = Math.max(1, Number.parseInt(String(pollSeconds), 10) || 900);
  const safeFailures = Math.max(1, Math.min(Number.parseInt(String(failureCount), 10) || 1, 8));
  return Math.min(3600, safePoll * 2 ** (safeFailures - 1));
}

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

function slugAgentPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAgentId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .split(":")
    .map(slugAgentPart)
    .filter(Boolean)
    .join(":");
}

function resolveAgentIdentity(input = {}, fallback = DEFAULT_AGENT_ID) {
  if (typeof input === "string") {
    const id = normalizeAgentId(input);
    return { id: id || fallback, tool: "", name: id || fallback, labels: buildAgentIdentityLabels(id || fallback) };
  }
  const explicit = normalizeAgentId(input.agentId || input.agent_id || input.agent || "");
  const tool = slugAgentPart(input.agentTool || input.agent_tool || input.tool || process.env.CLARACORE_AGENT_TOOL || "");
  const name = slugAgentPart(input.agentName || input.agent_name || input.name || process.env.CLARACORE_AGENT_NAME || "");
  const envId = normalizeAgentId(process.env.CLARACORE_AGENT_ID || "");
  const id = explicit || (tool && name ? `${tool}:${name}` : "") || name || envId || normalizeAgentId(fallback) || DEFAULT_AGENT_ID;
  return {
    id,
    tool: tool || (id.includes(":") ? id.split(":")[0] : ""),
    name: name || (id.includes(":") ? id.split(":").slice(1).join(":") : id),
    labels: buildAgentIdentityLabels(id, tool, name)
  };
}

function buildAgentIdentityLabels(id, tool = "", name = "") {
  const safeId = normalizeAgentId(id) || DEFAULT_AGENT_ID;
  const [idTool, ...idNameParts] = safeId.split(":");
  const safeTool = slugAgentPart(tool) || (safeId.includes(":") ? idTool : "");
  const safeName = slugAgentPart(name) || (safeId.includes(":") ? idNameParts.join(":") : safeId);
  return [
    safeTool ? `tool:${safeTool}` : "",
    safeName ? `agent:${safeName}` : "",
    `agent-id:${safeId}`
  ].filter(Boolean);
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
    mood: (item) => {
      if (typeof item !== "string" || !item.trim()) throw new Error("mood must be a non-empty string.");
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

function postJson(url, payload, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const body = JSON.stringify(payload);
    const timeoutMs = typeof options === "number" ? options : options.timeoutMs || 15000;
    const extraHeaders = typeof options === "object" && !Array.isArray(options) ? options.headers || {} : {};
    const errorPrefix =
      typeof options === "object" && !Array.isArray(options) ? options.errorPrefix || "JSON endpoint" : "JSON endpoint";
    const transport = target.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...extraHeaders
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
            reject(new Error(`${errorPrefix} returned ${response.statusCode}: ${data.slice(0, 200)}`));
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
      request.destroy(new Error(`${errorPrefix} request timed out.`));
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

  openConnection() {
    const db = new this.sqlite.DatabaseSync(this.dbPath);
    // WAL lets concurrent readers coexist with a single writer, and
    // busy_timeout makes a contended writer wait instead of failing
    // immediately with SQLITE_BUSY. Both are required for a long-running
    // Gateway serving multiple agents against one product database.
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    return db;
  }

  async exec(sql) {
    return withDatabaseLock(this.dbPath, async () => {
      if (this.sqlite?.DatabaseSync) {
        const db = this.openConnection();
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
        const db = this.openConnection();
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
      VALUES
        ('codex', 'Codex', 'agent', 'active'),
        ('my-agent', 'My Agent', 'agent', 'active')
      ON CONFLICT(id) DO NOTHING;

      ${settingsSql}

      INSERT INTO secret_refs (key, provider, status)
      VALUES
        ('memory.embedding.api_key', 'none', 'not-configured'),
        ('innerlife.llm.api_key', 'none', 'not-configured')
      ON CONFLICT(key) DO NOTHING;
    `);
  }

  async migrateAdditiveSchema() {
    const memoryRecordColumns = new Set((await this.query("PRAGMA table_info(memory_records);")).map((row) => row.name));
    const memoryRecordAdditions = [
      ["user_id", "ALTER TABLE memory_records ADD COLUMN user_id TEXT NOT NULL DEFAULT 'local-user';"],
      ["local_date", "ALTER TABLE memory_records ADD COLUMN local_date TEXT NOT NULL DEFAULT '';"],
      ["timezone", "ALTER TABLE memory_records ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai';"],
      ["schema_version", "ALTER TABLE memory_records ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;"],
      ["note", "ALTER TABLE memory_records ADD COLUMN note TEXT;"],
      ["source_agent", "ALTER TABLE memory_records ADD COLUMN source_agent TEXT;"],
      ["source_run_id", "ALTER TABLE memory_records ADD COLUMN source_run_id TEXT;"],
      ["dedupe_key", "ALTER TABLE memory_records ADD COLUMN dedupe_key TEXT;"]
    ];
    for (const [column, sql] of memoryRecordAdditions) {
      if (!memoryRecordColumns.has(column)) await this.exec(sql);
    }
    const currentPositionColumns = new Set((await this.query("PRAGMA table_info(current_positions);")).map((row) => row.name));
    const currentPositionAdditions = [
      ["metadata_json", "ALTER TABLE current_positions ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';"]
    ];
    for (const [column, sql] of currentPositionAdditions) {
      if (!currentPositionColumns.has(column)) await this.exec(sql);
    }
    const continuityLineColumns = new Set((await this.query("PRAGMA table_info(continuity_lines);")).map((row) => row.name));
    const continuityLineAdditions = [
      ["agent_id", "ALTER TABLE continuity_lines ADD COLUMN agent_id TEXT NOT NULL DEFAULT 'codex';"]
    ];
    for (const [column, sql] of continuityLineAdditions) {
      if (!continuityLineColumns.has(column)) await this.exec(sql);
    }
    await this.exec(`
      UPDATE memory_records
      SET local_date = substr(occurred_at, 1, 10)
      WHERE local_date = '';

      UPDATE continuity_lines
      SET agent_id = 'codex'
      WHERE agent_id IS NULL OR agent_id = '';

      CREATE INDEX IF NOT EXISTS idx_memory_records_user_type_time
      ON memory_records(user_id, record_type, occurred_at DESC);

      CREATE INDEX IF NOT EXISTS idx_memory_records_user_local_date
      ON memory_records(user_id, local_date);

      CREATE INDEX IF NOT EXISTS idx_continuity_lines_agent_status_updated
      ON continuity_lines(agent_id, status, updated_at DESC);

      CREATE TABLE IF NOT EXISTS continuity_agent_state (
        agent_id TEXT PRIMARY KEY,
        communication_style TEXT NOT NULL DEFAULT '',
        relationship_position TEXT NOT NULL DEFAULT '',
        long_term_preferences_json TEXT NOT NULL DEFAULT '[]',
        boundaries_json TEXT NOT NULL DEFAULT '[]',
        stable_patterns_json TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS continuity_model_adjustments (
        model TEXT PRIMARY KEY,
        forbidden_phrases_json TEXT NOT NULL DEFAULT '[]',
        forbidden_patterns_json TEXT NOT NULL DEFAULT '[]',
        inject_prompt TEXT NOT NULL DEFAULT '',
        updated_by TEXT NOT NULL DEFAULT 'desktop',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_records_dedupe
      ON memory_records(user_id, record_type, dedupe_key)
      WHERE dedupe_key IS NOT NULL;
    `);
  }

  async updateSettings(updates) {
    const entries = Object.entries(updates || {}).filter(([key]) => WRITABLE_SETTINGS.has(key));
    const memoryApiKeyRef =
      Object.prototype.hasOwnProperty.call(updates || {}, "memory.embedding.api_key_ref")
        ? String(updates["memory.embedding.api_key_ref"] || "").trim()
        : null;
    const innerLifeApiKeyRef =
      Object.prototype.hasOwnProperty.call(updates || {}, "innerlife.llm.api_key_ref")
        ? String(updates["innerlife.llm.api_key_ref"] || "").trim()
        : null;
    if (entries.length === 0 && memoryApiKeyRef === null && innerLifeApiKeyRef === null) {
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
    const secretUpdates = [
      ["memory.embedding.api_key", memoryApiKeyRef],
      ["innerlife.llm.api_key", innerLifeApiKeyRef]
    ]
      .filter(([, ref]) => ref !== null)
      .map(
        ([key, ref]) => `
          INSERT INTO secret_refs (key, provider, status, ref, updated_at)
          VALUES (
            ${sqlString(key)},
            'manual-ref',
            ${ref ? "'configured'" : "'not-configured'"},
            ${ref ? sqlString(ref) : "NULL"},
            CURRENT_TIMESTAMP
          )
          ON CONFLICT(key) DO UPDATE SET
            provider = excluded.provider,
            status = excluded.status,
            ref = excluded.ref,
            updated_at = CURRENT_TIMESTAMP;
        `
      )
      .join("\n");
    await this.exec(`${sql}\n${secretUpdates}`);
    return this.getSettings();
  }

  async recordRuntimeEvent(input = {}) {
    const id = newId("event");
    const level = ["debug", "info", "warn", "error"].includes(input.level) ? input.level : "info";
    const source = String(input.source || "runtime").trim() || "runtime";
    const message = String(input.message || "").trim() || "Runtime event";
    await this.exec(`
      INSERT INTO runtime_events (id, level, source, message, metadata_json)
      VALUES (${sqlString(id)}, ${sqlString(level)}, ${sqlString(source)}, ${sqlString(message)}, ${jsonSql(input.metadata || {})});
    `);
    return (await this.listRuntimeEvents({ limit: 1 })).find((event) => event.id === id);
  }

  async listRuntimeEvents(input = {}) {
    const safeLimit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 50), 10) || 50, 200));
    const level = String(input.level || "").trim();
    const source = String(input.source || "").trim();
    const filters = [];
    if (level) filters.push(`level = ${sqlString(level)}`);
    if (source) filters.push(`source = ${sqlString(source)}`);
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const rows = await this.query(`
      SELECT id, level, source, message, metadata_json, created_at
      FROM runtime_events
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit};
    `);
    return rows.map((row) => ({
      id: row.id,
      level: row.level,
      source: row.source,
      message: row.message,
      metadata: parseJson(row.metadata_json, {}),
      createdAt: row.created_at
    }));
  }

  async recordGatewayTrace(input = {}) {
    const id = newId("gateway_trace");
    const agentId = resolveAgentIdentity(input || {}).id;
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

  async clearLogs() {
    const rows = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM runtime_events) AS runtime_events_count,
        (SELECT COUNT(*) FROM gateway_traces) AS gateway_traces_count;
    `);
    await this.exec(`
      DELETE FROM runtime_events;
      DELETE FROM gateway_traces;
    `);
    const counts = rows[0] || {};
    return {
      runtimeEventsDeleted: Number(counts.runtime_events_count || 0),
      gatewayTracesDeleted: Number(counts.gateway_traces_count || 0)
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

  async deleteBackupRecord(id) {
    const existing = await this.getBackup(id);
    if (!existing) throw new Error("Backup not found.");
    await this.exec(`
      DELETE FROM backups
      WHERE id = ${sqlString(id)};
    `);
    return {
      ...existing,
      deleted: true
    };
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
        apiKeyStatus: secrets["memory.embedding.api_key"]?.status || "not-configured",
        apiKeyRef: secrets["memory.embedding.api_key"]?.ref || "",
        source: "claracore.db"
      },
      innerlife: {
        root: paths.dataRoot,
        source: "claracore.db",
        backend: settings["innerlife.provider"] || "disabled",
        baseUrl: settings["innerlife.base_url"] || "http://127.0.0.1:11434",
        lightModel: settings["innerlife.light_model"] || "",
        deepModel: settings["innerlife.deep_model"] || "",
        pollSeconds: String(settings["innerlife.loop_seconds"] || 900),
        lightIdleSeconds: "",
        deepIdleSeconds: "",
        autonomyEnabled: String(Boolean(settings["innerlife.enabled"])),
        apiKeyStatus: secrets["innerlife.llm.api_key"]?.status || "not-configured",
        apiKeyRef: secrets["innerlife.llm.api_key"]?.ref || ""
      },
      gateway: {
        enabled: Boolean(settings["gateway.enabled"]),
        transport: settings["gateway.transport"] || "stdio",
        localOnly: Boolean(settings["gateway.local_only"]),
        agentId: settings["agent.default_id"] || DEFAULT_AGENT_ID
      },
      backup: {
        enabled: Boolean(settings["backup.enabled"]),
        schedule: settings["backup.schedule"] || "manual"
      }
    };
  }

  async chatCompletion(input = {}) {
    const provider = String(input.provider || "").trim().toLowerCase();
    const baseUrl = String(input.baseUrl || "").trim().replace(/\/+$/, "");
    const model = String(input.model || "").trim();
    const apiKey = String(input.apiKey || "").trim();
    const system = String(input.system || "").trim();
    const prompt = String(input.prompt || "").trim();
    const timeoutMs = Number.parseInt(String(input.timeoutMs || 60000), 10) || 60000;
    if (!baseUrl) throw new Error("InnerLife chat base URL is required.");
    if (!model) throw new Error("InnerLife chat model is required.");
    if (!prompt) throw new Error("InnerLife chat prompt is required.");
    const messages = [];
    if (system) messages.push({ role: "system", content: system });
    messages.push({ role: "user", content: prompt });
    if (provider === "ollama") {
      const response = await postJson(
        `${baseUrl}/api/chat`,
        { model, messages, stream: false },
        { errorPrefix: "Ollama chat", timeoutMs }
      );
      const text = String(response?.message?.content || "").trim();
      if (!text) throw new Error("Ollama chat returned no content.");
      return text;
    }
    if (provider === "openai-compatible") {
      const endpoint = baseUrl.endsWith("/v1")
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v1/chat/completions`;
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
      const response = await postJson(
        endpoint,
        { model, messages },
        { headers, errorPrefix: "OpenAI-compatible chat endpoint", timeoutMs }
      );
      const text = String(response?.choices?.[0]?.message?.content || "").trim();
      if (!text) throw new Error("OpenAI-compatible chat endpoint returned no content.");
      return text;
    }
    throw new Error(`InnerLife chat provider '${provider || "disabled"}' is not implemented.`);
  }

  async innerLifeGenerate(input = {}) {
    const settings = await this.getSettings();
    const provider = String(settings["innerlife.provider"] || "disabled").trim().toLowerCase();
    if (!provider || provider === "disabled") return null;
    const baseUrl = settings["innerlife.base_url"] || "http://127.0.0.1:11434";
    const tier = String(input.tier || "light").trim().toLowerCase();
    const lightModel = String(settings["innerlife.light_model"] || "").trim();
    const deepModel = String(settings["innerlife.deep_model"] || "").trim();
    const model = tier === "deep" ? deepModel || lightModel : lightModel || deepModel;
    if (!model) return null;
    const secrets = await this.getSecretRefs();
    const apiKeyRef = secrets["innerlife.llm.api_key"]?.ref || "";
    const apiKey = apiKeyRef.startsWith("env:") ? process.env[apiKeyRef.slice(4)] || "" : apiKeyRef;
    return this.chatCompletion({
      provider,
      baseUrl,
      model,
      apiKey,
      system: input.system,
      prompt: input.prompt,
      timeoutMs: input.timeoutMs
    });
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
