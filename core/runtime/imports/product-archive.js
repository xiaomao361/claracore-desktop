const path = require("path");
const fs = require("fs/promises");
const { quoteIdentifier } = require("../../import-preview");
const { removeSqliteSidecars } = require("../backup");
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

function createProductArchiveRuntime({ createProductBackup, ensureProductCore, productVersion, resetCachedDatabase, sqlString, timestampForFilename }) {
  async function exportProductDataJson(app, input = {}) {
    const { paths, database } = await ensureProductCore(app);
    const createdAt = new Date().toISOString();
    const filename = `claracore-product-export-${timestampForFilename(new Date(createdAt))}.json`;
    const targetPath = path.resolve(input?.targetPath || path.join(paths.exportsDir, filename));
    const exportsRoot = path.resolve(paths.exportsDir);
    if (!targetPath.startsWith(`${exportsRoot}${path.sep}`) && !input?.allowExternalPath) {
      throw new Error("Product JSON export path must be inside the product exports directory.");
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const existingTables = new Set(
      (await database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")).map((row) => row.name)
    );
    const tables = {};
    for (const tableName of PRODUCT_EXPORT_TABLES) {
      if (!existingTables.has(tableName)) continue;
      tables[tableName] = await database.query(`SELECT * FROM ${quoteIdentifier(tableName)};`);
    }
    const exported = {
      format: "claracore.product.export",
      version: 1,
      exportedAt: createdAt,
      productVersion,
      source: {
        dataRoot: paths.dataRoot,
        databasePath: paths.databasePath
      },
      counts: summarizeProductTables(tables),
      tables
    };
    await fs.writeFile(targetPath, `${JSON.stringify(exported, null, 2)}\n`, "utf8");
    return {
      path: targetPath,
      createdAt,
      counts: exported.counts
    };
  }

  async function importProductDataJson(app, input = {}) {
    const requestedFilePath = String(input?.filePath || "").trim();
    if (!requestedFilePath) throw new Error("Product JSON import file path is required.");
    const filePath = path.resolve(requestedFilePath);
    const importedAt = new Date().toISOString();
    const raw = await fs.readFile(filePath, "utf8");
    const exported = JSON.parse(raw);
    if (exported?.format !== "claracore.product.export" || exported?.version !== 1 || !exported.tables || typeof exported.tables !== "object") {
      throw new Error("Unsupported product JSON export format.");
    }
    const safetyBackup = await createProductBackup(app);
    const { paths, database } = await ensureProductCore(app);
    const tempPath = path.join(paths.runtimeDir, `product-json-import-${timestampForFilename(new Date(importedAt))}.db`);
    await fs.rm(tempPath, { force: true });
    const tempDatabase = new database.constructor(tempPath);
    await tempDatabase.initialize();
    try {
      const deleteSql = [...PRODUCT_EXPORT_TABLES]
        .reverse()
        .map((tableName) => `DELETE FROM ${quoteIdentifier(tableName)};`)
        .join("\n");
      const insertSql = PRODUCT_EXPORT_TABLES.map((tableName) => insertRowsSql(tableName, exported.tables[tableName] || [], sqlString)).join("\n");
      await tempDatabase.exec(`
        PRAGMA foreign_keys = OFF;
        ${deleteSql}
        ${insertSql}
        PRAGMA foreign_keys = ON;
      `);
      const quickRows = await tempDatabase.query("PRAGMA quick_check;");
      const quickCheck = quickRows[0]?.quick_check || quickRows[0]?.["quick_check"] || Object.values(quickRows[0] || {})[0];
      if (quickCheck !== "ok") throw new Error(`Imported product JSON quick_check failed: ${quickCheck}`);
      // Close the temp database first so its WAL is checkpointed into the main
      // temp file; copyFile only copies the main `.db`, so uncheckpointed rows
      // would otherwise be lost. Then close the live cached connection and drop
      // the destination WAL/SHM sidecars so the swapped file is read cleanly
      // instead of through a stale connection's -wal.
      tempDatabase.close();
      if (typeof resetCachedDatabase === "function") resetCachedDatabase();
      await removeSqliteSidecars(paths.databasePath);
      await fs.copyFile(tempPath, paths.databasePath);
      await removeSqliteSidecars(paths.databasePath);
      const restoredDatabase = new database.constructor(paths.databasePath);
      await restoredDatabase.initialize();
      const restoredSafetyBackup = await restoredDatabase.registerBackupRecord({
        id: safetyBackup.id,
        path: safetyBackup.path,
        status: safetyBackup.status,
        metadata: {
          ...(safetyBackup.metadata || {}),
          restoredDatabaseRegistered: true,
          restoredAfterProductJsonPath: filePath
        }
      });
      await restoredDatabase.recordRuntimeEvent({
        level: "info",
        source: "data",
        message: "Product database imported from JSON",
        metadata: {
          filePath,
          exportedAt: exported.exportedAt || "",
          safetyBackupId: restoredSafetyBackup.id,
          safetyBackupPath: restoredSafetyBackup.path,
          counts: exported.counts || summarizeProductTables(exported.tables)
        }
      });
      return {
        imported: true,
        filePath,
        quickCheck,
        safetyBackup: restoredSafetyBackup,
        counts: exported.counts || summarizeProductTables(exported.tables),
        summary: await restoredDatabase.getSummary()
      };
    } finally {
      await fs.rm(tempPath, { force: true }).catch(() => {});
    }
  }

  async function exportProductMemoryArchive(app, input = {}) {
    const { paths, database } = await ensureProductCore(app);
    const createdAt = new Date().toISOString();
    const filename = `claracore-memory-export-${timestampForFilename(new Date(createdAt))}.json`;
    const targetPath = path.resolve(input?.targetPath || path.join(paths.exportsDir, filename));
    const exportsRoot = path.resolve(paths.exportsDir);
    if (!targetPath.startsWith(`${exportsRoot}${path.sep}`) && !input?.allowExternalPath) {
      throw new Error("Memory export path must be inside the product exports directory.");
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const memoryRows = await database.query(`
      SELECT
        m.id,
        m.title,
        m.body,
        m.status,
        m.sensitivity,
        m.source_id,
        m.created_at,
        m.updated_at,
        COALESCE(group_concat(l.label, ','), '') AS labels
      FROM memories m
      LEFT JOIN memory_labels l ON l.memory_id = m.id
      GROUP BY m.id
      ORDER BY m.created_at ASC;
    `);
    const recordRows = await database.query(`
      SELECT id, user_id, record_type, title, value_json, occurred_at, local_date, timezone,
             schema_version, note, source, source_agent, source_run_id, dedupe_key,
             status, memory_id, created_at, updated_at, metadata_json
      FROM memory_records
      ORDER BY occurred_at ASC, created_at ASC;
    `);
    const aliases = await database.listMemoryLabelAliases();
    const archive = {
      format: "claracore.memory.archive",
      version: 1,
      exportedAt: createdAt,
      productVersion,
      source: {
        dataRoot: paths.dataRoot,
        databasePath: paths.databasePath
      },
      counts: {
        memories: memoryRows.length,
        aliases: aliases.length,
        records: recordRows.length
      },
      memories: memoryRows.map((row) => ({
        id: row.id,
        title: row.title || "",
        body: row.body || "",
        status: normalizeArchiveStatus(row.status),
        sensitivity: normalizeArchiveSensitivity(row.sensitivity),
        sourceId: row.source_id || "",
        labels: normalizeArchiveLabels(row.labels),
        createdAt: row.created_at || createdAt,
        updatedAt: row.updated_at || row.created_at || createdAt
      })),
      labelAliases: aliases,
      records: recordRows.map((row) => ({
        id: row.id,
        userId: row.user_id || "local-user",
        recordType: row.record_type,
        title: row.title || "",
        value: JSON.parse(row.value_json || "{}"),
        occurredAt: row.occurred_at,
        localDate: row.local_date || "",
        timezone: row.timezone || "Asia/Shanghai",
        schemaVersion: row.schema_version || 1,
        note: row.note || "",
        source: row.source || "",
        sourceAgent: row.source_agent || "",
        sourceRunId: row.source_run_id || "",
        dedupeKey: row.dedupe_key || "",
        status: normalizeArchiveStatus(row.status),
        memoryId: row.memory_id || null,
        createdAt: row.created_at || createdAt,
        updatedAt: row.updated_at || row.created_at || createdAt,
        metadata: JSON.parse(row.metadata_json || "{}")
      }))
    };
    await fs.writeFile(targetPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
    return {
      path: targetPath,
      createdAt,
      counts: archive.counts
    };
  }
  
  async function importProductMemoryArchive(app, input = {}) {
    const requestedFilePath = String(input?.filePath || "").trim();
    if (!requestedFilePath) throw new Error("Memory import file path is required.");
    const filePath = path.resolve(requestedFilePath);
    const raw = await fs.readFile(filePath, "utf8");
    const archive = JSON.parse(raw);
    if (archive?.format !== "claracore.memory.archive" || archive?.version !== 1) {
      throw new Error("Unsupported Memory archive format.");
    }
    const { database } = await ensureProductCore(app);
    const importedAt = new Date().toISOString();
    const sourceId = `memory_json_${Date.now().toString(36)}`;
    const memories = Array.isArray(archive.memories) ? archive.memories : [];
    const aliases = Array.isArray(archive.labelAliases) ? archive.labelAliases : [];
    const records = Array.isArray(archive.records) ? archive.records : [];
    const summary = {
      importedAt,
      filePath,
      memories: { imported: 0, skipped: 0 },
      aliases: { imported: 0, skipped: 0 },
      records: { imported: 0, skipped: 0 }
    };
  
    await database.exec(`
      INSERT INTO memory_sources (id, kind, label, source_path, imported_at, metadata_json)
      VALUES (${sqlString(sourceId)}, 'import', 'Memory JSON import', ${sqlString(filePath)}, ${sqlString(importedAt)}, ${sqlString(JSON.stringify({
        format: archive.format,
        version: archive.version,
        exportedAt: archive.exportedAt || null
      }))})
      ON CONFLICT(id) DO NOTHING;
    `);
  
    for (const aliasEntry of aliases) {
      const alias = normalizeArchiveLabels(aliasEntry?.alias || "")[0] || "";
      const canonicalLabel = normalizeArchiveLabels(aliasEntry?.canonicalLabel || aliasEntry?.canonical_label || "")[0] || "";
      if (!alias || !canonicalLabel || alias === canonicalLabel) {
        summary.aliases.skipped += 1;
        continue;
      }
      const existing = await database.query(`
        SELECT alias
        FROM memory_label_aliases
        WHERE alias = ${sqlString(alias)}
        LIMIT 1;
      `);
      if (existing.length) {
        summary.aliases.skipped += 1;
        continue;
      }
      await database.exec(`
        INSERT INTO memory_label_aliases (alias, canonical_label, created_at)
        VALUES (${sqlString(alias)}, ${sqlString(canonicalLabel)}, ${sqlString(aliasEntry.createdAt || importedAt)});
      `);
      summary.aliases.imported += 1;
    }
  
    for (const memory of memories) {
      const id = safeArchiveString(memory?.id);
      const body = safeArchiveString(memory?.body);
      if (!id || !body) {
        summary.memories.skipped += 1;
        continue;
      }
      const existing = await database.query(`
        SELECT id
        FROM memories
        WHERE id = ${sqlString(id)}
        LIMIT 1;
      `);
      if (existing.length) {
        summary.memories.skipped += 1;
        continue;
      }
      const labels = await database.canonicalizeMemoryLabels(memory?.labels || []);
      await database.exec(`
        INSERT INTO memories (id, title, body, status, sensitivity, source_id, created_at, updated_at)
        VALUES (
          ${sqlString(id)},
          ${memory?.title ? sqlString(memory.title) : "NULL"},
          ${sqlString(body)},
          ${sqlString(normalizeArchiveStatus(memory?.status))},
          ${sqlString(normalizeArchiveSensitivity(memory?.sensitivity))},
          ${sqlString(sourceId)},
          ${sqlString(memory?.createdAt || importedAt)},
          ${sqlString(memory?.updatedAt || memory?.createdAt || importedAt)}
        );
        ${labels
          .map(
            (label) => `
              INSERT INTO memory_labels (memory_id, label)
              VALUES (${sqlString(id)}, ${sqlString(label)})
              ON CONFLICT(memory_id, label) DO NOTHING;
            `
          )
          .join("\n")}
      `);
      if (normalizeArchiveStatus(memory?.status) === "active" && normalizeArchiveSensitivity(memory?.sensitivity) !== "restricted") {
        await database.markMemoryEmbeddingPending(id);
      }
      summary.memories.imported += 1;
    }
  
    for (const record of records) {
      const id = safeArchiveString(record?.id);
      const recordType = safeArchiveString(record?.recordType || record?.record_type).toLowerCase();
      if (!id || !recordType) {
        summary.records.skipped += 1;
        continue;
      }
      const existing = await database.query(`
        SELECT id
        FROM memory_records
        WHERE id = ${sqlString(id)}
        LIMIT 1;
      `);
      if (existing.length) {
        summary.records.skipped += 1;
        continue;
      }
      const metadata = record?.metadata && typeof record.metadata === "object" ? record.metadata : {};
      const userId = safeArchiveString(record?.userId || record?.user_id || metadata.userId, "local-user");
      const occurredAt = safeArchiveString(record?.occurredAt || record?.occurred_at, importedAt);
      const timezone = safeArchiveString(record?.timezone || metadata.timezone, "Asia/Shanghai");
      const localDate = safeArchiveString(record?.localDate || record?.local_date, occurredAt.slice(0, 10));
      const schemaVersion = Number.parseInt(String(record?.schemaVersion || record?.schema_version || 1), 10) || 1;
      await database.exec(`
        INSERT INTO memory_records (
          id, user_id, record_type, title, value_json, occurred_at, local_date,
          timezone, schema_version, note, source, source_agent, source_run_id,
          dedupe_key, status, memory_id, created_at, updated_at, metadata_json
        )
        VALUES (
          ${sqlString(id)},
          ${sqlString(userId)},
          ${sqlString(recordType)},
          ${sqlString(safeArchiveString(record?.title, recordType) || recordType)},
          ${sqlString(JSON.stringify(record?.value && typeof record.value === "object" ? record.value : {}))},
          ${sqlString(occurredAt)},
          ${sqlString(localDate)},
          ${sqlString(timezone)},
          ${schemaVersion},
          ${record?.note ? sqlString(record.note) : "NULL"},
          ${sqlString(record?.source || sourceId)},
          ${record?.sourceAgent || record?.source_agent ? sqlString(record.sourceAgent || record.source_agent) : "NULL"},
          ${record?.sourceRunId || record?.source_run_id ? sqlString(record.sourceRunId || record.source_run_id) : "NULL"},
          ${record?.dedupeKey || record?.dedupe_key ? sqlString(record.dedupeKey || record.dedupe_key) : "NULL"},
          ${sqlString(normalizeArchiveStatus(record?.status))},
          ${record?.memoryId ? sqlString(record.memoryId) : "NULL"},
          ${sqlString(record?.createdAt || importedAt)},
          ${sqlString(record?.updatedAt || record?.createdAt || importedAt)},
          ${sqlString(JSON.stringify(metadata))}
        );
      `);
      summary.records.imported += 1;
    }
  
    return {
      ...summary,
      maintenance: await database.runMemoryMaintenance({ dryRun: false }),
      stats: await database.getMemoryStats()
    };
  }

  return {
    exportProductDataJson,
    importProductDataJson,
    exportProductMemoryArchive,
    importProductMemoryArchive
  };
}

module.exports = {
  createProductArchiveRuntime
};
