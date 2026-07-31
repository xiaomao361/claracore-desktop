const { createAgentActivityRepository } = require("./system/agent-activity");
const { createAgentIdentityRepository } = require("./system/agent-identity");
const { createGatewayTraceRepository } = require("./system/gateway-traces");
const { composeRepositoryMethods } = require("../repository-installer");

function createSystemRepository(helpers) {
  const {
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
    resolveMaintenanceHour,
    sqlString
  } = helpers;
  const {
    MEMORY_CONTROLLER_MODES,
    parseCanaryAgentIds
  } = require("../../memory-controller/settings");

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

  function inclusiveLocalSpanDays(firstAt) {
    const firstDate = new Date(firstAt);
    if (Number.isNaN(firstDate.getTime())) return 0;
    const today = new Date();
    const firstLocalDay = Date.UTC(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
    const currentLocalDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(1, Math.round((currentLocalDay - firstLocalDay) / 86400000) + 1);
  }

  const systemMethods = {
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
        build: {
          flavor: BUILD_FLAVOR,
          hasBuiltInEmbedding: HAS_BUILT_IN_EMBEDDING
        },
        memoria: {
          provider: settings["memory.embedding.provider"] || MEMORY_EMBEDDING_PROVIDERS[0],
          endpoint: settings["memory.embedding.base_url"] || "http://127.0.0.1:11434",
          model: settings["memory.embedding.model"] ?? (HAS_BUILT_IN_EMBEDDING ? "Xenova/bge-small-zh-v1.5" : ""),
          dimension: String(settings["memory.embedding.dimension"] || 512),
          maxChars: String(settings["memory.embedding.max_chars"] || 2000),
          maintenanceEnabled: settings["memory.maintenance.enabled"] !== false,
          maintenanceHour: resolveMaintenanceHour(settings["memory.maintenance.hour"]),
          maintenanceLastRunDate: settings["memory.maintenance.last_run_date"] || "",
          apiKeyStatus: secrets["memory.embedding.api_key"]?.status || "not-configured",
          apiKeyRef: secrets["memory.embedding.api_key"]?.ref || "",
          availableProviders: [...MEMORY_EMBEDDING_PROVIDERS],
          providerSupported: MEMORY_EMBEDDING_PROVIDERS.includes(settings["memory.embedding.provider"] || MEMORY_EMBEDDING_PROVIDERS[0]),
          source: "claracore.db"
        },
        memoryController: (() => {
          const configuredMode = String(settings["memory.controller.mode"] || "off").trim().toLowerCase();
          const allowlist = parseCanaryAgentIds(settings["memory.controller.canary_agent_ids"]);
          const configurationValid = MEMORY_CONTROLLER_MODES.includes(configuredMode)
            && (configuredMode !== "canary" || allowlist.valid);
          return {
            mode: configurationValid ? configuredMode : "off",
            configuredMode,
            canaryAgentIds: allowlist.agentIds,
            configurationValid,
            source: "claracore.db"
          };
        })(),
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

    async getTraceSnapshot() {
      const [spanRows, semanticRows, milestoneRows, participantRows, memoryStats, innerLifeCounts] = await Promise.all([
        this.query(`
          WITH meaningful_dates AS (
            SELECT created_at AS occurred_at FROM memories WHERE status = 'active'
            UNION ALL
            SELECT created_at AS occurred_at FROM continuity_position_history
            UNION ALL
            SELECT created_at AS occurred_at FROM innerlife_events
            UNION ALL
            SELECT created_at AS occurred_at FROM innerlife_shares
          ), normalized_dates AS (
            SELECT
              occurred_at,
              CASE
                WHEN occurred_at GLOB '*+[0-9][0-9][0-9][0-9]'
                  OR occurred_at GLOB '*-[0-9][0-9][0-9][0-9]'
                THEN substr(occurred_at, 1, length(occurred_at) - 2) || ':' || substr(occurred_at, -2)
                ELSE occurred_at
              END AS normalized_at
            FROM meaningful_dates
          )
          SELECT occurred_at AS first_at
          FROM normalized_dates
          WHERE julianday(normalized_at) IS NOT NULL
          ORDER BY julianday(normalized_at) ASC
          LIMIT 1;
        `),
        this.query(`
          SELECT
            (SELECT COUNT(DISTINCT m.id)
             FROM memories m
             JOIN memory_labels l ON l.memory_id = m.id
             WHERE m.status = 'active'
               AND (
                 lower(l.label) IN ('decision', 'product-decision', 'design-decision')
                 OR lower(l.label) LIKE 'decision:%'
                 OR l.label IN ('决定', '决策', '设计决定', '产品决定')
               )) AS decisions_count,
            (SELECT COUNT(*)
             FROM continuity_lines l
             WHERE l.status = 'active'
               AND EXISTS (
                 SELECT 1
                 FROM current_positions p
                 WHERE p.line_id = l.id
                   AND trim(COALESCE(p.summary, '')) != ''
               )) AS active_lines_count,
            (SELECT COUNT(*)
             FROM (
               SELECT DISTINCT h.id AS history_id, refs.value AS memory_id
               FROM continuity_position_history h, json_each(
                 CASE WHEN json_valid(h.facts_used_json) THEN h.facts_used_json ELSE '[]' END
               ) refs
               JOIN memories m ON m.id = refs.value
             )) AS reused_memories_count,
            (SELECT COUNT(DISTINCT a.share_id)
             FROM innerlife_share_actions a
             WHERE a.action = 'used'
               AND json_valid(a.metadata_json)
               AND COALESCE(json_extract(a.metadata_json, '$.deliveryEvidence.conversationId'), '') != ''
               AND COALESCE(json_extract(a.metadata_json, '$.deliveryEvidence.responseExcerpt'), '') != ''
               AND COALESCE(json_extract(a.metadata_json, '$.deliveryEvidence.sharedAt'), '') != '') AS verified_shares_count,
            (SELECT COUNT(*) FROM continuity_position_history) AS line_updates_count,
            (SELECT COUNT(*) FROM continuity_snapshots) AS line_snapshots_count,
            (SELECT COUNT(*) FROM continuity_lines WHERE status = 'archived') AS archived_lines_count,
            (SELECT COUNT(*) FROM continuity_handoffs) AS handoffs_count;
        `),
        this.query(`
          SELECT
            m.id,
            COALESCE(NULLIF(m.title, ''), substr(m.body, 1, 120)) AS title,
            m.created_at,
            m.updated_at,
            group_concat(DISTINCT l.label) AS labels
          FROM memories m
          JOIN memory_labels marker ON marker.memory_id = m.id
          LEFT JOIN memory_labels l ON l.memory_id = m.id
          WHERE m.status = 'active'
            AND (
              lower(marker.label) IN ('milestone', 'release', 'product-decision', 'design-decision')
              OR lower(marker.label) LIKE 'release:%'
              OR marker.label IN ('里程碑', '发布', '项目进展', '产品决定', '设计决定')
            )
          GROUP BY m.id
          ORDER BY datetime(m.updated_at) DESC, datetime(m.created_at) DESC, m.id DESC
          LIMIT 5;
        `),
        Promise.all([
          this.query(`
            SELECT m.id AS item_id, l.label AS agent_label, 'memory' AS kind
            FROM memories m
            JOIN memory_labels l ON l.memory_id = m.id
            WHERE m.status != 'deleted'
              AND (l.label LIKE 'agent-id:%' OR l.label LIKE 'agent:%');
          `),
          this.query(`
            SELECT id AS item_id, agent_id AS agent_label, 'sharedLine' AS kind
            FROM continuity_lines;
          `),
          this.query(`
            SELECT id AS item_id, agent_id AS agent_label, 'innerLife' AS kind
            FROM innerlife_events
            UNION ALL
            SELECT id AS item_id, agent_id AS agent_label, 'innerLife' AS kind
            FROM innerlife_shares;
          `),
          this.query(`
            SELECT a.id, a.label, p.display_name
            FROM agents a
            LEFT JOIN innerlife_profiles p ON p.agent_id = a.id;
          `)
        ]),
        this.getMemoryStats(),
        this.getInnerLifeCounts("all")
      ]);

      const [memoryParticipantRows, lineParticipantRows, innerLifeParticipantRows, agentRows] = participantRows;
      const agentNames = new Map(
        agentRows.map((row) => [String(row.id || "").trim(), row.display_name || row.label || row.id])
      );
      const participantMap = new Map();
      const normalizeParticipantId = (value = "") => {
        const label = String(value || "").trim();
        if (label.startsWith("agent-id:")) return label.slice("agent-id:".length);
        if (label.startsWith("agent:")) return label.slice("agent:".length);
        return label;
      };
      const addParticipant = (row) => {
        const agentId = normalizeParticipantId(row.agent_label);
        if (!agentId || !row.item_id) return;
        if (!participantMap.has(agentId)) {
          participantMap.set(agentId, {
            agentId,
            displayName: agentNames.get(agentId) || agentId,
            memories: new Set(),
            sharedLines: new Set(),
            innerLife: new Set()
          });
        }
        const participant = participantMap.get(agentId);
        if (row.kind === "memory") participant.memories.add(row.item_id);
        if (row.kind === "sharedLine") participant.sharedLines.add(row.item_id);
        if (row.kind === "innerLife") participant.innerLife.add(row.item_id);
      };
      [...memoryParticipantRows, ...lineParticipantRows, ...innerLifeParticipantRows].forEach(addParticipant);

      const firstAt = spanRows[0]?.first_at || null;
      const semantic = semanticRows[0] || {};
      const counts = innerLifeCounts || {};
      return {
        firstAt,
        spanDays: firstAt ? inclusiveLocalSpanDays(firstAt) : 0,
        semantic: {
          decisions: Number(semantic.decisions_count || 0),
          activeLines: Number(semantic.active_lines_count || 0),
          reusedMemories: Number(semantic.reused_memories_count || 0),
          verifiedShares: Number(semantic.verified_shares_count || 0)
        },
        milestones: milestoneRows.map((row) => ({
          id: row.id,
          title: row.title || row.id,
          labels: String(row.labels || "").split(",").filter(Boolean),
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        participants: Array.from(participantMap.values())
          .map((participant) => ({
            agentId: participant.agentId,
            displayName: participant.displayName,
            memoryCount: participant.memories.size,
            sharedLineCount: participant.sharedLines.size,
            innerLifeCount: participant.innerLife.size
          }))
          .sort((left, right) => left.displayName.localeCompare(right.displayName)),
        memory: memoryStats,
        sharedLine: {
          activeCount: Number(semantic.active_lines_count || 0),
          archivedCount: Number(semantic.archived_lines_count || 0),
          historyCount: Number(semantic.line_updates_count || 0),
          snapshotCount: Number(semantic.line_snapshots_count || 0),
          handoffCount: Number(semantic.handoffs_count || 0)
        },
        innerLife: {
          profilesCount: Number(agentRows.filter((row) => row.display_name).length),
          thoughtsCount: Number(counts.thoughts_count || 0),
          pendingSharesCount: Number(counts.pending_shares_count || 0),
          approvedSharesCount: Number(counts.approved_shares_count || 0),
          usedSharesCount: Number(counts.used_shares_count || 0),
          verifiedSharesCount: Number(semantic.verified_shares_count || 0),
          deferredSharesCount: Number(counts.deferred_shares_count || 0),
          discardedSharesCount: Number(counts.discarded_shares_count || 0),
          sessionsCount: Number(counts.active_sessions_count || 0) + Number(counts.ended_sessions_count || 0),
          digestRunsCount: Number(counts.digest_runs_count || 0),
          inboxCount: Number(counts.pending_inbox_count || 0) + Number(counts.processed_inbox_count || 0)
        }
      };
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
  return composeRepositoryMethods("system", [
    ["gateway-traces", createGatewayTraceRepository(helpers)],
    ["agent-activity", createAgentActivityRepository(helpers)],
    ["agent-identity", createAgentIdentityRepository(helpers)],
    ["system", systemMethods]
  ]);
}

module.exports = {
  createSystemRepository
};
