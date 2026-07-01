const { createMemoriaLabelRepository } = require("./memoria/labels");
const { createMemoriaRecordRepository } = require("./memoria/records");
const { createMemoriaEmbeddingRepository } = require("./memoria/embeddings");
const { createMemoriaMaintenanceRepository } = require("./memoria/maintenance");

function installMemoriaRepository(ProductDatabase, helpers) {
  const {
    jsonSql,
    likePattern,
    newId,
    normalizeLabels,
    normalizeSearchRows,
    normalizeSensitivity,
    parseJson,
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

  Object.assign(ProductDatabase.prototype, {
    ...createMemoriaLabelRepository(helpers),
    async createMemory(input) {
      const body = String(input?.body || "").trim();
      if (!body) throw new Error("Memory body is required.");
      const id = newId("mem");
      const title = String(input?.title || "").trim();
      const identity = resolveAgentIdentity(input || {});
      const labels = await this.canonicalizeMemoryLabels([...(Array.isArray(input?.labels) ? input.labels : normalizeLabels(input?.labels || "")), ...identity.labels]);
      const sensitivity = normalizeSensitivity(input?.sensitivity);
      const hasExplicitAgent = Boolean(input?.agentId || input?.agent_id || input?.agent || input?.agentTool || input?.agent_tool || input?.agentName || input?.agent_name);
      const source = String(input?.source || (hasExplicitAgent ? identity.tool || identity.id : "manual_desktop")).trim() || "manual_desktop";
      const sourceId = source === "manual_desktop" && !hasExplicitAgent
        ? "manual_desktop"
        : `manual_${identity.id.replace(/[^a-z0-9_-]+/g, "_")}`;
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
        VALUES (
          ${sqlString(sourceId)},
          'manual',
          ${sqlString(`Manual entry from ${identity.id}`)},
          ${jsonSql({ agentId: identity.id, agentTool: identity.tool, agentName: identity.name, source })}
        )
        ON CONFLICT(id) DO NOTHING;
    
        INSERT INTO memories (id, title, body, status, sensitivity, source_id)
        VALUES (${sqlString(id)}, ${title ? sqlString(title) : "NULL"}, ${sqlString(body)}, 'active', ${sqlString(sensitivity)}, ${sqlString(sourceId)});
    
        ${labelSql}
      `);
      await this.markMemoryEmbeddingPending(id);
      return this.getMemory(id);
    }
    ,
    
    async updateMemory(id, input) {
      const memoryId = String(id || "").trim();
      if (!memoryId) throw new Error("Memory id is required.");
      const updatedAt = new Date().toISOString();
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
          updated_at = ${sqlString(updatedAt)}
        WHERE id = ${sqlString(memoryId)} AND status = 'active';
    
        DELETE FROM memory_labels WHERE memory_id = ${sqlString(memoryId)};
        ${labelSql}
      `);
      await this.markMemoryEmbeddingPending(memoryId);
      return this.getMemory(memoryId);
    }
    ,
    
    async updateMemoryLabels(id, input = {}) {
      const memoryId = String(id || "").trim();
      if (!memoryId) throw new Error("Memory id is required.");
      const updatedAt = new Date().toISOString();
      const memory = await this.getMemory(memoryId);
      if (!memory) throw new Error("Memory not found.");
      if (memory.status !== "active") throw new Error("Only active Memory records can be tagged.");
      const addLabels = await this.canonicalizeMemoryLabels(input.add || []);
      const removeLabels = await this.canonicalizeMemoryLabels(input.remove || []);
      const existing = new Set(memory.labels || []);
      for (const label of addLabels) existing.add(label);
      for (const label of removeLabels) existing.delete(label);
      const labels = [...existing].sort((left, right) => left.localeCompare(right));
      const labelSql = labels
        .map(
          (label) => `
            INSERT INTO memory_labels (memory_id, label)
            VALUES (${sqlString(memoryId)}, ${sqlString(label)})
            ON CONFLICT(memory_id, label) DO NOTHING;
          `
        )
        .join("\n");
      await this.exec(`
        DELETE FROM memory_labels WHERE memory_id = ${sqlString(memoryId)};
        ${labelSql}
        UPDATE memories
        SET updated_at = ${sqlString(updatedAt)}
        WHERE id = ${sqlString(memoryId)};
      `);
      return {
        memory: await this.getMemory(memoryId),
        added: addLabels,
        removed: removeLabels
      };
    }
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
    async listMemories(limit = 20, search = "", options = {}) {
      const safeLimit = Math.max(1, Math.min(1000, Number.parseInt(String(limit), 10) || 20));
      const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
      const query = String(search || "").trim();
      const includeRestricted = Boolean(options.includeRestricted);
      const agentClause = options.agentId || options.agent_id ? agentLabelClause(options.agentId || options.agent_id) : "";
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
        ${agentClause}
        ${searchClause}
        GROUP BY m.id
        ORDER BY m.updated_at DESC, m.created_at DESC, m.id DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return normalizeSearchRows(rows);
    }
    ,
    
    async listRestrictedMemories(limit = 20, options = {}) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
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
        ${agentClause}
        GROUP BY m.id
        ORDER BY m.updated_at DESC, m.created_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return normalizeSearchRows(rows);
    }
    ,
    
    async listDeletedMemories(limit = 20, options = {}) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
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
        ${agentClause}
        GROUP BY m.id
        ORDER BY m.updated_at DESC, m.created_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return normalizeSearchRows(rows);
    }
    ,
    
    async listArchivedMemories(limit = 20, options = {}) {
      const safeLimit = Math.max(1, Math.min(100, Number.parseInt(String(limit), 10) || 20));
      const safeOffset = Math.max(0, Number.parseInt(String(options.offset || 0), 10) || 0);
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
        ${agentClause}
        GROUP BY m.id
        ORDER BY m.updated_at DESC, m.created_at DESC
        LIMIT ${safeLimit} OFFSET ${safeOffset};
      `);
      return normalizeSearchRows(rows);
    }
    ,
    
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
    ,
    
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
    ,
    
    ...createMemoriaMaintenanceRepository(helpers),
    ...createMemoriaRecordRepository(helpers),
    ...createMemoriaEmbeddingRepository(helpers)
  });
}

module.exports = {
  installMemoriaRepository
};
