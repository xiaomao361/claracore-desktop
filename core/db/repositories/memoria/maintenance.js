function createMemoriaMaintenanceRepository(helpers) {
  const {
    meaningfulTokens,
    mergeTitleKey,
    overlapRatio,
    sqlString
  } = helpers;

  return {
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
    },

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
    },

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
               AND datetime(e.embedded_at) < datetime(m.updated_at)) AS stale_embedding_count,
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
    },

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
      const provider = settings["memory.embedding.provider"] || "claracore-built-in";
      const model = settings["memory.embedding.model"] ?? (provider === "claracore-built-in" ? "Xenova/bge-small-zh-v1.5" : "");
      const dimension = Number.parseInt(String(settings["memory.embedding.dimension"] || 512), 10);
      const embeddingRows = await this.query(`
        SELECT m.id
        FROM memories m
        LEFT JOIN memory_embeddings e ON e.memory_id = m.id
        WHERE m.status = 'active'
          AND m.sensitivity != 'restricted'
          AND (
            e.memory_id IS NULL
            OR e.status = 'failed'
            OR datetime(e.embedded_at) < datetime(m.updated_at)
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
                VALUES (${sqlString(row.id)}, ${sqlString(provider)}, ${sqlString(model)}, ${Number.isFinite(dimension) ? dimension : 512}, 'pending', NULL, NULL, NULL, CURRENT_TIMESTAMP)
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
    },

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
    },

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
    },

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
  };
}

module.exports = {
  createMemoriaMaintenanceRepository
};
