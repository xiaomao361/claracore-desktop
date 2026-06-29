function installMemoriaRepository(ProductDatabase, helpers) {
  const {
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
  } = helpers;

  Object.assign(ProductDatabase.prototype, {
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
    async updateMemoryLabels(id, input = {}) {
      const memoryId = String(id || "").trim();
      if (!memoryId) throw new Error("Memory id is required.");
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
        SET updated_at = CURRENT_TIMESTAMP
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
    async getMemoryAuditReport(input = {}) {
      const safeLimit = Math.max(1, Math.min(50, Number.parseInt(String(input.limit || 10), 10) || 10));
      const maintenance = await this.getMemoryMaintenanceReport();
      const mergeSuggestions = await this.getMemoryMergeSuggestions({ limit: safeLimit });
      const archiveSuggestions = await this.getMemoryArchiveSuggestions({
        limit: safeLimit,
        olderThanDays: input.olderThanDays || 30
      });
      const aliasRows = await this.query(`
        SELECT alias, canonical_label
        FROM memory_label_aliases
        ORDER BY alias ASC
        LIMIT ${safeLimit};
      `);
      const failedEmbeddingRows = await this.query(`
        SELECT m.id, m.title, substr(m.body, 1, 160) AS body_preview, e.error, e.embedded_at
        FROM memories m
        JOIN memory_embeddings e ON e.memory_id = m.id
        WHERE m.status = 'active'
          AND m.sensitivity != 'restricted'
          AND e.status = 'failed'
        ORDER BY e.embedded_at DESC
        LIMIT ${safeLimit};
      `);
      const missingTitleRows = await this.query(`
        SELECT id, substr(body, 1, 160) AS body_preview, created_at, updated_at
        FROM memories
        WHERE status = 'active'
          AND sensitivity != 'restricted'
          AND COALESCE(title, '') = ''
        ORDER BY updated_at DESC, created_at DESC
        LIMIT ${safeLimit};
      `);
      const duplicateTitleRows = await this.query(`
        SELECT lower(title) AS title_key, COUNT(*) AS count, group_concat(id, ',') AS ids
        FROM memories
        WHERE status = 'active'
          AND sensitivity != 'restricted'
          AND COALESCE(title, '') != ''
        GROUP BY lower(title)
        HAVING COUNT(*) > 1
        ORDER BY count DESC, title_key ASC
        LIMIT ${safeLimit};
      `);
      return {
        generatedAt: new Date().toISOString(),
        status:
          maintenance.status !== "ok" ||
          mergeSuggestions.count > 0 ||
          archiveSuggestions.count > 0 ||
          failedEmbeddingRows.length > 0 ||
          missingTitleRows.length > 0 ||
          duplicateTitleRows.length > 0
            ? "needs_review"
            : "ok",
        maintenance,
        review: {
          mergeSuggestions,
          archiveSuggestions,
          failedEmbeddings: failedEmbeddingRows.map((row) => ({
            id: row.id,
            title: row.title || "",
            bodyPreview: row.body_preview || "",
            error: row.error || "",
            embeddedAt: row.embedded_at || ""
          })),
          missingTitles: missingTitleRows.map((row) => ({
            id: row.id,
            bodyPreview: row.body_preview || "",
            createdAt: row.created_at,
            updatedAt: row.updated_at
          })),
          duplicateTitles: duplicateTitleRows.map((row) => ({
            title: row.title_key,
            count: row.count || 0,
            ids: row.ids ? row.ids.split(",").filter(Boolean) : []
          })),
          labelAliases: aliasRows.map((row) => ({
            alias: row.alias,
            canonicalLabel: row.canonical_label
          }))
        }
      };
    }
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    }
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
    ,
    
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
  });
}

module.exports = {
  installMemoriaRepository
};
