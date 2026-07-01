function createSystemRepository(helpers) {
  const {
    DEFAULT_AGENT_ID,
    WRITABLE_SETTINGS,
    jsonSql,
    newId,
    normalizeSettingValue,
    parseJson,
    postJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  function mapRuntimeEventRow(row) {
    return {
      id: row.id,
      level: row.level,
      source: row.source,
      message: row.message,
      metadata: parseJson(row.metadata_json, {}),
      createdAt: row.created_at
    };
  }

  function mapGatewayTraceRow(row) {
    return {
      id: row.id,
      agentId: row.agent_id,
      toolName: row.tool_name,
      status: row.status,
      durationMs: row.duration_ms,
      request: parseJson(row.request_json, {}),
      responseSummary: row.response_summary || "",
      error: row.error || "",
      createdAt: row.created_at
    };
  }

  return {
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
    },

    async recordRuntimeEvent(input = {}) {
      const id = newId("event");
      const level = ["debug", "info", "warn", "error"].includes(input.level) ? input.level : "info";
      const source = String(input.source || "runtime").trim() || "runtime";
      const message = String(input.message || "").trim() || "Runtime event";
      await this.exec(`
        INSERT INTO runtime_events (id, level, source, message, metadata_json)
        VALUES (${sqlString(id)}, ${sqlString(level)}, ${sqlString(source)}, ${sqlString(message)}, ${jsonSql(input.metadata || {})});
      `);
      return this.getRuntimeEvent(id);
    },

    async getRuntimeEvent(id) {
      const eventId = String(id || "").trim();
      if (!eventId) throw new Error("Runtime event id is required.");
      const rows = await this.query(`
        SELECT id, level, source, message, metadata_json, created_at
        FROM runtime_events
        WHERE id = ${sqlString(eventId)}
        LIMIT 1;
      `);
      return rows[0] ? mapRuntimeEventRow(rows[0]) : null;
    },

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
      return rows.map(mapRuntimeEventRow);
    },

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
      return this.getGatewayTrace(id);
    },

    async getGatewayTrace(id) {
      const traceId = String(id || "").trim();
      if (!traceId) throw new Error("Gateway trace id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, tool_name, status, duration_ms, request_json, response_summary, error, created_at
        FROM gateway_traces
        WHERE id = ${sqlString(traceId)}
        LIMIT 1;
      `);
      return rows[0] ? mapGatewayTraceRow(rows[0]) : null;
    },

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
      return rows.map(mapGatewayTraceRow);
    },

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
    },

    async createDatabaseBackup(targetPath, metadata = {}) {
      if (!targetPath) throw new Error("Backup path is required.");
      await this.exec(`VACUUM INTO ${sqlString(targetPath)};`);
      const id = newId("backup");
      await this.exec(`
        INSERT INTO backups (id, path, status, metadata_json)
        VALUES (${sqlString(id)}, ${sqlString(targetPath)}, 'created', ${jsonSql(metadata)});
      `);
      return this.getBackup(id);
    },

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
    },

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
    },

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
    },

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
    },

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
    },

    async getSettings() {
      const rows = await this.query("SELECT key, value_json FROM app_settings ORDER BY key;");
      return Object.fromEntries(rows.map((row) => [row.key, parseJson(row.value_json)]));
    },

    async getSecretRefs() {
      const rows = await this.query("SELECT key, provider, status, ref FROM secret_refs ORDER BY key;");
      return Object.fromEntries(rows.map((row) => [row.key, row]));
    },

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
    },

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
    },

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
    },

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
  };
}

module.exports = {
  createSystemRepository
};
