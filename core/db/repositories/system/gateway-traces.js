const crypto = require("crypto");

function createGatewayTraceRepository(helpers) {
  const {
    jsonSql,
    newId,
    parseJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  function mapGatewayTraceRow(row) {
    const conversationId = row.conversation_id || row.session_id || "";
    return {
      id: row.id,
      agentId: row.agent_id,
      clientId: row.client_id || "",
      conversationId,
      // Backward-compatible UI/API alias. This is a caller conversation id,
      // never a domain tool argument such as an InnerLife session id.
      sessionId: conversationId,
      transport: row.transport || "stdio",
      toolName: row.tool_name,
      status: row.status,
      durationMs: row.duration_ms,
      request: parseJson(row.request_json, {}),
      responseSummary: row.response_summary || "",
      error: row.error || "",
      createdAt: row.created_at
    };
  }

  // Fields that carry raw user text. A trace is bounded evidence, not a
  // transcript: storing the prompt verbatim would put every message the user
  // ever typed into the local database on the automatic path. The Memory
  // Controller already established the right shape for this — a hash plus a
  // bounded preview — and this mirrors it.
  const REDACTED_REQUEST_FIELDS = Object.freeze(["prompt", "transcript", "context"]);
  // 80 bytes, deliberately shorter than the Memory Controller's 160-byte
  // query_preview: a trace preview only needs to identify which turn produced a
  // decision. Be honest about what this does and does not guarantee — a prompt
  // shorter than the bound is still recorded in full, so `truncated` says
  // plainly whether anything was actually withheld.
  const REDACTED_PREVIEW_BYTES = 80;

  function boundedUtf8Preview(text, maxBytes) {
    if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
    const characters = Array.from(text);
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (Buffer.byteLength(characters.slice(0, middle).join(""), "utf8") <= maxBytes) low = middle;
      else high = middle - 1;
    }
    return characters.slice(0, low).join("");
  }

  function redactedField(value) {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    const collapsed = text.replace(/\s+/g, " ").trim();
    // slice() counts UTF-16 code units, so the previous version let 80 Chinese
    // characters through as 240 bytes while the constant claimed 80. Cut on the
    // real byte boundary without splitting a character.
    const preview = boundedUtf8Preview(collapsed, REDACTED_PREVIEW_BYTES);
    return {
      redacted: true,
      bytes: Buffer.byteLength(text, "utf8"),
      hash: crypto.createHash("sha256").update(text).digest("hex").slice(0, 32),
      preview,
      truncated: preview.length < collapsed.length
    };
  }

  function redactGatewayTraceRequest(request = {}) {
    if (!request || typeof request !== "object" || Array.isArray(request)) return request;
    let changed = false;
    const out = {};
    for (const [key, value] of Object.entries(request)) {
      if (REDACTED_REQUEST_FIELDS.includes(key) && value !== undefined && value !== null && value !== "") {
        out[key] = redactedField(value);
        changed = true;
      } else {
        out[key] = value;
      }
    }
    return changed ? out : request;
  }

  function boundedGatewayTraceRequest(inputRequest = {}, maxBytes = 16 * 1024) {
    const request = redactGatewayTraceRequest(inputRequest);
    let serialized;
    try {
      serialized = JSON.stringify(request || {});
    } catch (_error) {
      return { truncated: true, error: "request_not_serializable" };
    }
    const bytes = Buffer.byteLength(serialized);
    if (bytes <= maxBytes) return request || {};
    return {
      truncated: true,
      originalBytes: bytes,
      preview: serialized.slice(0, Math.min(8000, serialized.length))
    };
  }

  return {
    async ensureGatewayTraceCompatibility() {
      if (!this.gatewayTraceCompatibilityPromise) {
        this.gatewayTraceCompatibilityPromise = (async () => {
          const columns = new Set((await this.query("PRAGMA table_info(gateway_traces);")).map((row) => row.name));
          if (!columns.has("id")) return;
          const additions = [];
          if (!columns.has("session_id")) additions.push("ALTER TABLE gateway_traces ADD COLUMN session_id TEXT NOT NULL DEFAULT '';");
          if (!columns.has("client_id")) additions.push("ALTER TABLE gateway_traces ADD COLUMN client_id TEXT NOT NULL DEFAULT '';");
          if (!columns.has("conversation_id")) additions.push("ALTER TABLE gateway_traces ADD COLUMN conversation_id TEXT NOT NULL DEFAULT '';");
          if (!columns.has("transport")) additions.push("ALTER TABLE gateway_traces ADD COLUMN transport TEXT NOT NULL DEFAULT 'stdio';");
          if (additions.length) {
            await this.exec(additions.join("\n"));
          }
          await this.exec(`
            CREATE INDEX IF NOT EXISTS idx_gateway_traces_agent_created
            ON gateway_traces(agent_id, created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_gateway_traces_transport_created
            ON gateway_traces(transport, created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_gateway_traces_client_created
            ON gateway_traces(client_id, created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_gateway_traces_conversation_created
            ON gateway_traces(conversation_id, created_at DESC);

            CREATE INDEX IF NOT EXISTS idx_gateway_traces_status_created
            ON gateway_traces(status, created_at DESC);
          `);
        })().catch((error) => {
          this.gatewayTraceCompatibilityPromise = null;
          throw error;
        });
      }
      await this.gatewayTraceCompatibilityPromise;
    },

    async recordGatewayTrace(input = {}) {
      await this.ensureGatewayTraceCompatibility();
      const id = newId("gateway_trace");
      const agentId = resolveAgentIdentity(input || {}).id;
      const clientId = String(input.clientId || input.client_id || "").trim().slice(0, 120);
      const conversationId = String(
        input.conversationId || input.conversation_id || input.sessionId || input.session_id || ""
      ).trim().slice(0, 120);
      const transport = ["stdio", "streamable-http", "http"].includes(input.transport) ? input.transport : "stdio";
      const toolName = String(input.toolName || "unknown").trim() || "unknown";
      const status = input.status === "error" ? "error" : "ok";
      const durationMs = Math.max(0, Number.parseInt(String(input.durationMs || 0), 10) || 0);
      const responseSummary = String(input.responseSummary || "").slice(0, 500);
      const error = String(input.error || "").slice(0, 500);
      const request = boundedGatewayTraceRequest(input.request || {});
      const createdAt = new Date().toISOString();
      await this.exec(`
        INSERT INTO gateway_traces (id, agent_id, client_id, conversation_id, session_id, transport, tool_name, status, duration_ms, request_json, response_summary, error, created_at)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${sqlString(clientId)},
          ${sqlString(conversationId)},
          ${sqlString(conversationId)},
          ${sqlString(transport)},
          ${sqlString(toolName)},
          ${sqlString(status)},
          ${durationMs},
          ${jsonSql(request)},
          ${sqlString(responseSummary)},
          ${sqlString(error)},
          ${sqlString(createdAt)}
        );
      `);
      return {
        id,
        agentId,
        clientId,
        conversationId,
        sessionId: conversationId,
        transport,
        toolName,
        status,
        durationMs,
        request,
        responseSummary,
        error,
        createdAt
      };
    },

    async cleanupGatewayTraces(input = {}) {
      await this.ensureGatewayTraceCompatibility();
      const policy = {
        successMaxAgeDays: Math.max(1, Number.parseInt(String(input.successMaxAgeDays || 30), 10) || 30),
        errorMaxAgeDays: Math.max(1, Number.parseInt(String(input.errorMaxAgeDays || 180), 10) || 180),
        successMaxRows: Math.max(1, Number.parseInt(String(input.successMaxRows || 10000), 10) || 10000),
        protectedErrorRows: Math.max(0, Number.parseInt(String(input.protectedErrorRows ?? 2000), 10) || 0),
        totalMaxRows: Math.max(1, Number.parseInt(String(input.totalMaxRows || 20000), 10) || 20000)
      };
      const countRows = async () => (await this.query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS success_count,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count
        FROM gateway_traces;
      `))[0] || {};
      const before = await countRows();
      const changes = [];
      async function runDelete(database, reason, sql) {
        await database.exec(sql);
        const rows = await database.query("SELECT changes() AS changes;");
        changes.push({ reason, deleted: Number(rows[0]?.changes || 0) });
      }
      await runDelete(this, "success_age", `
        DELETE FROM gateway_traces
        WHERE status = 'ok'
          AND datetime(created_at) < datetime('now', ${sqlString(`-${policy.successMaxAgeDays} days`)});
      `);
      await runDelete(this, "error_age", `
        DELETE FROM gateway_traces
        WHERE status = 'error'
          AND datetime(created_at) < datetime('now', ${sqlString(`-${policy.errorMaxAgeDays} days`)})
          AND id NOT IN (
            SELECT id FROM gateway_traces
            WHERE status = 'error'
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ${sqlString(policy.protectedErrorRows)}
          );
      `);
      await runDelete(this, "success_capacity", `
        DELETE FROM gateway_traces
        WHERE status = 'ok'
          AND id NOT IN (
            SELECT id FROM gateway_traces
            WHERE status = 'ok'
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ${sqlString(policy.successMaxRows)}
          );
      `);
      await runDelete(this, "total_capacity", `
        DELETE FROM gateway_traces
        WHERE id IN (
          SELECT id FROM gateway_traces
          WHERE id NOT IN (
            SELECT id FROM gateway_traces
            WHERE status = 'error'
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT ${sqlString(policy.protectedErrorRows)}
          )
          ORDER BY datetime(created_at) ASC, id ASC
          LIMIT MAX(0, (SELECT COUNT(*) FROM gateway_traces) - ${sqlString(policy.totalMaxRows)})
        );
      `);
      const after = await countRows();
      return {
        policy,
        deleted: changes.reduce((sum, item) => sum + item.deleted, 0),
        reasons: Object.fromEntries(changes.map((item) => [item.reason, item.deleted])),
        before: {
          total: Number(before.total || 0),
          success: Number(before.success_count || 0),
          error: Number(before.error_count || 0)
        },
        after: {
          total: Number(after.total || 0),
          success: Number(after.success_count || 0),
          error: Number(after.error_count || 0)
        }
      };
    },

    async getGatewayTrace(id) {
      await this.ensureGatewayTraceCompatibility();
      const traceId = String(id || "").trim();
      if (!traceId) throw new Error("Gateway trace id is required.");
      const rows = await this.query(`
        SELECT id, agent_id, client_id, conversation_id, session_id, transport, tool_name, status, duration_ms, request_json, response_summary, error, created_at
        FROM gateway_traces
        WHERE id = ${sqlString(traceId)}
        LIMIT 1;
      `);
      return rows[0] ? mapGatewayTraceRow(rows[0]) : null;
    },

    async listGatewayTraces(input = {}) {
      await this.ensureGatewayTraceCompatibility();
      const safeLimit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 20), 10) || 20, 100));
      const toolName = String(input.toolName || "").trim();
      const status = String(input.status || "").trim();
      const filters = [];
      if (toolName) filters.push(`tool_name = ${sqlString(toolName)}`);
      if (status) filters.push(`status = ${sqlString(status)}`);
      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
      const rows = await this.query(`
        SELECT id, agent_id, client_id, conversation_id, session_id, transport, tool_name, status, duration_ms, request_json, response_summary, error, created_at
        FROM gateway_traces
        ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT ${safeLimit};
      `);
      return rows.map(mapGatewayTraceRow);
    }
  };
}

module.exports = {
  createGatewayTraceRepository
};
