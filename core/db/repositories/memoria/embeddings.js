function createMemoriaEmbeddingRepository(helpers) {
  const {
    cosineSimilarity,
    jsonSql,
    normalizeSearchRows,
    parseVector,
    postJson,
    resolveAgentIdentity,
    sqlString
  } = helpers;

  function agentLabelClause(agentId, alias = "m") {
    const normalized = resolveAgentIdentity(agentId || "").id;
    if (!normalized) return "";
    const agentLabel = normalized.includes(":") ? normalized.split(":").slice(1).join(":") : normalized;
    const labels = [...new Set([`agent-id:${normalized}`, agentLabel ? `agent:${agentLabel}` : ""])].filter(Boolean);
    return `
      AND EXISTS (
        SELECT 1 FROM memory_labels agent_filter
        WHERE agent_filter.memory_id = ${alias}.id
          AND agent_filter.label IN (${labels.map(sqlString).join(", ")})
      )
    `;
  }

  return {
    async createEmbedding(text) {
      const settings = await this.getSettings();
      const provider = settings["memory.embedding.provider"] || "ollama";
      const baseUrl = settings["memory.embedding.base_url"] || "http://127.0.0.1:11434";
      const model = settings["memory.embedding.model"] || "bge-m3";
      const maxChars = Number.parseInt(String(settings["memory.embedding.max_chars"] || 2000), 10);
      const prompt = String(text || "").trim().slice(0, maxChars);
      if (!prompt) throw new Error("Embedding text is required.");
      if (provider === "ollama") {
        const response = await postJson(`${baseUrl}/api/embeddings`, { model, prompt }, { errorPrefix: "Ollama" });
        const vector = parseVector(response.embedding);
        if (vector.length === 0) {
          throw new Error("Ollama returned no embedding.");
        }
        return { provider, model, vector };
      }
      if (provider === "openai-compatible") {
        const secrets = await this.getSecretRefs();
        const apiKeyRef = secrets["memory.embedding.api_key"]?.ref || "";
        const apiKey = apiKeyRef.startsWith("env:") ? process.env[apiKeyRef.slice(4)] || "" : apiKeyRef;
        const endpoint = baseUrl.replace(/\/+$/, "").endsWith("/v1")
          ? `${baseUrl.replace(/\/+$/, "")}/embeddings`
          : `${baseUrl.replace(/\/+$/, "")}/v1/embeddings`;
        const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
        const response = await postJson(
          endpoint,
          { model, input: prompt },
          { headers, errorPrefix: "OpenAI-compatible embedding endpoint" }
        );
        const vector = parseVector(response.data?.[0]?.embedding);
        if (vector.length === 0) {
          throw new Error("OpenAI-compatible embedding endpoint returned no embedding.");
        }
        return { provider, model, vector };
      }
      throw new Error(`Embedding provider '${provider}' is not implemented yet.`);
    },

    async vectorMemoryCandidates(limit = 200, options = {}) {
      const safeLimit = Math.max(1, Math.min(500, Number.parseInt(String(limit), 10) || 200));
      const agentClause = options.agentId || options.agent_id ? agentLabelClause(options.agentId || options.agent_id) : "";
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
          ${agentClause}
        GROUP BY m.id
        ORDER BY e.embedded_at DESC
        LIMIT ${safeLimit};
      `);
      return normalizeSearchRows(rows).map((row) => ({
        ...row,
        vector: parseVector(row.vector_json)
      }));
    },

    async searchMemories(query, limit = 50, options = {}) {
      const text = String(query || "").trim();
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 50));
      const includeRestricted = Boolean(options.includeRestricted);
      if (!text) {
        return {
          mode: "list",
          query: "",
          results: await this.listMemories(Math.min(20, safeLimit), "", {
            includeRestricted,
            agentId: options.agentId || options.agent_id || ""
          }),
          error: null
        };
      }

      const keywordResults = await this.listMemories(safeLimit, text, {
        includeRestricted,
        agentId: options.agentId || options.agent_id || ""
      });
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
        const candidates = await this.vectorMemoryCandidates(200, { agentId: options.agentId || options.agent_id || "" });
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
    },

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
    },

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
    },

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
    },

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
  };
}

module.exports = {
  createMemoriaEmbeddingRepository
};
