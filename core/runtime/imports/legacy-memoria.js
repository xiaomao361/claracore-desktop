const path = require("path");
const fs = require("fs/promises");
const { previewImportSources, quoteIdentifier, runSqliteReadOnly } = require("../../import-preview");
const {
  safeArchiveString,
  normalizeArchiveLabels,
  normalizeArchiveStatus,
  normalizeArchiveSensitivity,
  stableImportId,
  pickFirst,
  normalizeImportLabels,
  normalizeImportLabel,
  normalizeContinuityStatus,
  normalizeInterpretationStatus,
  normalizeLegacyContinuityInterpretationStatus,
  buildLegacyContinuityMetadata,
  safeJsonArray,
  safeJsonObject,
  normalizeInnerLifeShareStatus,
  normalizeInnerLifeReviewStatus,
  normalizeInnerLifeEventStatus,
  legacyAgentLabels,
  parseImportJson,
  compactImportText,
  normalizeInnerLifeInboxStatus,
  normalizeInnerLifeSessionStatus,
  normalizeInnerLifeDigestStatus,
  reviewStatusFromShareStatus,
  PRODUCT_EXPORT_TABLES,
  sqlValue,
  insertRowsSql,
  summarizeProductTables
} = require("./helpers");

function createLegacyMemoriaRuntime({ createProductBackup, ensureProductCore, productVersion, resetCachedDatabase, sqlString, timestampForFilename }) {
  async function readOldMemoriaRows(dbPath) {
    const tableRows = await runSqliteReadOnly(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
    const tables = new Set(tableRows.map((row) => row.name));
    const readTable = async (tableName) => {
      if (!tables.has(tableName)) return [];
      return runSqliteReadOnly(dbPath, `SELECT * FROM ${quoteIdentifier(tableName)};`);
    };
    return {
      tables: [...tables],
      memories: await readTable("memories"),
      records: await readTable("records"),
      labels: [...(await readTable("labels")), ...(await readTable("memory_labels"))],
      sources: await readTable("memory_sources")
    };
  }
  
  async function importOldMemoriaIntoProduct(app, input = {}) {
    const preview = await previewImportSources();
    const source = preview.sources.memoria;
    const dbPath = path.resolve(String(input.databasePath || source.database?.dbPath || ""));
    if (!dbPath || !source.database?.present) throw new Error("Old Memoria database not found.");
    if (source.database?.quickCheck !== "ok") throw new Error(`Old Memoria quick_check failed: ${source.database?.quickCheck}`);
    const statBefore = await fs.stat(dbPath);
    const backup = await createProductBackup(app);
    const { database } = await ensureProductCore(app);
    const importedAt = new Date().toISOString();
    const sourceId = `old_memoria_${Date.now().toString(36)}`;
    const old = await readOldMemoriaRows(dbPath);
    const labelsByMemory = new Map();
    for (const row of old.labels) {
      const memoryId = String(pickFirst(row, ["memory_id", "memoryId"], "") || "").trim();
      const label = normalizeImportLabel(pickFirst(row, ["label", "name", "tag"], ""));
      if (!memoryId || !label) continue;
      if (!labelsByMemory.has(memoryId)) labelsByMemory.set(memoryId, []);
      labelsByMemory.get(memoryId).push(label);
    }
    await database.exec(`
      INSERT INTO memory_sources (id, kind, label, source_path, imported_at, metadata_json)
      VALUES (${sqlString(sourceId)}, 'import', 'Old Memoria import', ${sqlString(dbPath)}, ${sqlString(importedAt)}, ${sqlString(JSON.stringify({
        tables: old.tables,
        mode: "copy_based_import"
      }))})
      ON CONFLICT(id) DO NOTHING;
    `);
    const summary = {
      importedAt,
      sourcePath: dbPath,
      backup,
      memories: { imported: 0, skipped: 0 },
      records: { imported: 0, skipped: 0 },
      labels: { imported: 0, skipped: 0 },
      sourceMtimeUnchanged: false,
      sourceSizeUnchanged: false
    };
  
    const importMemoryRow = async (row, kind) => {
      const oldId = String(pickFirst(row, ["id", "memory_id", "record_id"], "") || "").trim();
      const body = String(pickFirst(row, ["body", "content", "text", "value", "summary"], "") || "").trim();
      if (!oldId || !body) {
        summary[kind].skipped += 1;
        return;
      }
      const id = stableImportId(`old_memoria_${kind === "records" ? "record" : "memory"}`, oldId);
      const existing = await database.query(`SELECT id FROM memories WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary[kind].skipped += 1;
        return;
      }
      const title = String(pickFirst(row, ["title", "name"], "") || "").trim();
      const oldPrivate = String(pickFirst(row, ["private"], "") || "").trim();
      const sensitivity =
        oldPrivate === "1" || oldPrivate.toLowerCase() === "true"
          ? "restricted"
          : normalizeArchiveSensitivity(String(pickFirst(row, ["sensitivity"], "normal") || "normal"));
      const status = normalizeArchiveStatus(String(pickFirst(row, ["status"], "active") || "active"));
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp", "occurred_at"], importedAt) || importedAt);
      const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], createdAt) || createdAt);
      const inlineLabels = normalizeImportLabels(pickFirst(row, ["labels", "tags"], ""));
      const sourceAgent = String(pickFirst(row, ["source_agent", "sourceAgent"], "") || "").trim();
      const rowSource = String(pickFirst(row, ["source"], "") || "").trim();
      const rowLabels = [...new Set([...(labelsByMemory.get(oldId) || []), ...inlineLabels, ...legacyAgentLabels(sourceAgent, rowSource), "imported", "old-memoria"])];
      await database.exec(`
        INSERT INTO memories (id, title, body, status, sensitivity, source_id, created_at, updated_at)
        VALUES (
          ${sqlString(id)},
          ${title ? sqlString(title) : "NULL"},
          ${sqlString(body)},
          ${sqlString(status)},
          ${sqlString(sensitivity)},
          ${sqlString(sourceId)},
          ${sqlString(createdAt)},
          ${sqlString(updatedAt)}
        );
        ${rowLabels
          .map(
            (label) => `
              INSERT INTO memory_labels (memory_id, label)
              VALUES (${sqlString(id)}, ${sqlString(label)})
              ON CONFLICT(memory_id, label) DO NOTHING;
            `
          )
          .join("\n")}
      `);
      if (status === "active" && sensitivity !== "restricted") await database.markMemoryEmbeddingPending(id);
      summary[kind].imported += 1;
      summary.labels.imported += rowLabels.length;
    };
  
    const importRecordRow = async (row) => {
      const oldId = String(pickFirst(row, ["id", "record_id"], "") || "").trim();
      const userId = String(pickFirst(row, ["user_id", "userId"], "local-user") || "local-user").trim();
      const recordType = String(pickFirst(row, ["record_type", "recordType", "type"], "") || "").trim().toLowerCase();
      const occurredAt = String(pickFirst(row, ["occurred_at", "occurredAt", "timestamp"], importedAt) || importedAt).trim();
      const value = safeJsonObject(pickFirst(row, ["data_json", "value_json", "value", "data"], "{}"), {});
      const body = String(pickFirst(row, ["body", "content", "text", "summary"], "") || "").trim();
      if ((!recordType || !Object.keys(value).length) && body) {
        await importMemoryRow(row, "records");
        return;
      }
      if (!oldId || !userId || !recordType || !Object.keys(value).length) {
        summary.records.skipped += 1;
        return;
      }
      const id = stableImportId("old_memoria_record", oldId);
      const existing = await database.query(`SELECT id FROM memory_records WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.records.skipped += 1;
        return;
      }
      const dedupeKey = String(pickFirst(row, ["dedupe_key", "dedupeKey"], "") || "").trim();
      if (dedupeKey) {
        const duplicate = await database.query(`
          SELECT id
          FROM memory_records
          WHERE user_id = ${sqlString(userId)}
            AND record_type = ${sqlString(recordType)}
            AND dedupe_key = ${sqlString(dedupeKey)}
          LIMIT 1;
        `);
        if (duplicate.length) {
          summary.records.skipped += 1;
          return;
        }
      }
      const localDate = String(pickFirst(row, ["local_date", "localDate"], occurredAt.slice(0, 10)) || occurredAt.slice(0, 10)).trim();
      const timezone = String(pickFirst(row, ["timezone", "timezone_name", "timezoneName"], "Asia/Shanghai") || "Asia/Shanghai").trim();
      const schemaVersion = Number.parseInt(String(pickFirst(row, ["schema_version", "schemaVersion"], 1) || 1), 10) || 1;
      const note = String(pickFirst(row, ["note", "title"], "") || "").trim();
      const source = String(pickFirst(row, ["source"], sourceId) || sourceId).trim();
      const sourceAgent = String(pickFirst(row, ["source_agent", "sourceAgent"], "") || "").trim();
      const sourceRunId = String(pickFirst(row, ["source_run_id", "sourceRunId"], "") || "").trim();
      const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt).trim();
      await database.exec(`
        INSERT INTO memory_records (
          id, user_id, record_type, title, value_json, occurred_at, local_date,
          timezone, schema_version, note, source, source_agent, source_run_id,
          dedupe_key, status, created_at, updated_at, metadata_json
        )
        VALUES (
          ${sqlString(id)},
          ${sqlString(userId)},
          ${sqlString(recordType)},
          ${sqlString(note || recordType)},
          ${sqlString(JSON.stringify(value))},
          ${sqlString(occurredAt)},
          ${sqlString(localDate)},
          ${sqlString(timezone)},
          ${schemaVersion},
          ${note ? sqlString(note) : "NULL"},
          ${sqlString(source)},
          ${sourceAgent ? sqlString(sourceAgent) : "NULL"},
          ${sourceRunId ? sqlString(sourceRunId) : "NULL"},
          ${dedupeKey ? sqlString(dedupeKey) : "NULL"},
          'active',
          ${sqlString(createdAt)},
          ${sqlString(createdAt)},
          ${sqlString(JSON.stringify({ oldId, importedFrom: "old_memoria" }))}
        );
      `);
      summary.records.imported += 1;
    };
  
    for (const row of old.memories) await importMemoryRow(row, "memories");
    for (const row of old.records) await importRecordRow(row);
  
    const statAfter = await fs.stat(dbPath);
    summary.sourceMtimeUnchanged = statAfter.mtimeMs === statBefore.mtimeMs;
    summary.sourceSizeUnchanged = statAfter.size === statBefore.size;
    if (!summary.sourceMtimeUnchanged || !summary.sourceSizeUnchanged) {
      throw new Error("Old Memoria source changed during import.");
    }
    return {
      ...summary,
      maintenance: await database.runMemoryMaintenance({ dryRun: false }),
      stats: await database.getMemoryStats()
    };
  }

  return {
    importOldMemoriaIntoProduct
  };
}

module.exports = {
  createLegacyMemoriaRuntime
};
