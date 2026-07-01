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

function createLegacyContinuityRuntime({ createProductBackup, ensureProductCore, productVersion, resetCachedDatabase, sqlString, timestampForFilename }) {
  async function readOldContinuityRows(dbPath) {
    const tableRows = await runSqliteReadOnly(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
    const tables = new Set(tableRows.map((row) => row.name));
    const readTable = async (tableName) => {
      if (!tables.has(tableName)) return [];
      return runSqliteReadOnly(dbPath, `SELECT * FROM ${quoteIdentifier(tableName)};`);
    };
    return {
      tables: [...tables],
      lines: await readTable("continuity_lines"),
      positions: await readTable("current_positions"),
      handoffs: await readTable("continuity_handoffs"),
      sessionThreads: await readTable("session_threads"),
      legacyHandoffs: await readTable("handoffs"),
      stateSnapshots: await readTable("state_snapshots"),
      agentState: await readTable("agent_state")
    };
  }
  
  async function importOldContinuityIntoProduct(app, input = {}) {
    const preview = await previewImportSources();
    const source = preview.sources.continuity;
    const dbPath = path.resolve(String(input.databasePath || source.database?.dbPath || ""));
    if (!dbPath || !source.database?.present) throw new Error("Old Continuity database not found.");
    if (source.database?.quickCheck !== "ok") throw new Error(`Old Continuity quick_check failed: ${source.database?.quickCheck}`);
    const statBefore = await fs.stat(dbPath);
    const backup = await createProductBackup(app);
    const { database } = await ensureProductCore(app);
    const importedAt = new Date().toISOString();
    const old = await readOldContinuityRows(dbPath);
    const summary = {
      importedAt,
      sourcePath: dbPath,
      backup,
      lines: { imported: 0, skipped: 0 },
      positions: { imported: 0, skipped: 0 },
      handoffs: { imported: 0, skipped: 0 },
      agentState: { imported: 0, skipped: 0 },
      modelAdjustments: { imported: 0, skipped: 0 },
      sourceMtimeUnchanged: false,
      sourceSizeUnchanged: false
    };
    const lineIdMap = new Map();
    const importedLineIds = [];
  
    const ensureFallbackLine = async () => {
      const fallbackOldId = "default";
      const fallbackLineId = stableImportId("old_continuity_line", fallbackOldId);
      if (!lineIdMap.has(fallbackOldId)) lineIdMap.set(fallbackOldId, fallbackLineId);
      const existing = await database.query(`SELECT id FROM continuity_lines WHERE id = ${sqlString(fallbackLineId)} LIMIT 1;`);
      if (!existing.length) {
        await database.exec(`
          INSERT INTO continuity_lines (id, agent_id, title, status, created_at, updated_at)
          VALUES (${sqlString(fallbackLineId)}, 'codex', 'Imported Shared Line', 'active', ${sqlString(importedAt)}, ${sqlString(importedAt)});
        `);
        importedLineIds.push(fallbackLineId);
      }
      return fallbackLineId;
    };
  
    const oldLineRows = old.lines.length ? old.lines : old.sessionThreads;
    for (const row of oldLineRows) {
      const oldId = String(pickFirst(row, ["id", "line_id", "lineId", "thread_id"], "") || "").trim();
      if (!oldId) {
        summary.lines.skipped += 1;
        continue;
      }
      const id = stableImportId("old_continuity_line", oldId);
      lineIdMap.set(oldId, id);
      const existing = await database.query(`SELECT id FROM continuity_lines WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.lines.skipped += 1;
        continue;
      }
      const title = String(pickFirst(row, ["title", "name", "label", "topic"], "Imported Shared Line") || "Imported Shared Line").trim();
      const status = normalizeContinuityStatus(pickFirst(row, ["status"], "active"));
      const agentId = String(pickFirst(row, ["agent_id", "agentId"], "codex") || "codex").trim() || "codex";
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "created"], importedAt) || importedAt);
      const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt", "modified_at", "last_active_at"], createdAt) || createdAt);
      await database.exec(`
        INSERT INTO continuity_lines (id, agent_id, title, status, created_at, updated_at)
        VALUES (${sqlString(id)}, ${sqlString(agentId)}, ${sqlString(title)}, ${sqlString(status)}, ${sqlString(createdAt)}, ${sqlString(updatedAt)});
      `);
      importedLineIds.push(id);
      summary.lines.imported += 1;
    }
  
    const resolveImportedLineId = async (row) => {
      const oldLineId = String(pickFirst(row, ["line_id", "lineId", "continuity_line_id", "thread_id", "source_thread_id"], "") || "").trim();
      if (oldLineId && lineIdMap.has(oldLineId)) return lineIdMap.get(oldLineId);
      if (lineIdMap.size === 1) return [...lineIdMap.values()][0];
      if (importedLineIds.length === 1) return importedLineIds[0];
      return ensureFallbackLine();
    };
  
    const oldPositionRows = old.positions.length ? old.positions : old.sessionThreads;
    for (const row of oldPositionRows) {
      const oldId = String(pickFirst(row, ["id", "position_id", "positionId", "thread_id"], "") || "").trim();
      const summaryText = String(
        pickFirst(row, ["summary", "body", "content", "text", "last_position", "state_summary", "current_interpretation", "reality_line"], "") || ""
      ).trim();
      if (!oldId || !summaryText) {
        summary.positions.skipped += 1;
        continue;
      }
      const lineId = await resolveImportedLineId(row);
      const positionId = stableImportId("old_continuity_position", oldId);
      const existing = await database.query(`SELECT id FROM current_positions WHERE id = ${sqlString(positionId)} LIMIT 1;`);
      if (existing.length) {
        summary.positions.skipped += 1;
        continue;
      }
      const status = normalizeLegacyContinuityInterpretationStatus(row);
      const factsUsed = safeJsonArray(pickFirst(row, ["facts_used_json", "factsUsed", "facts_used"], "[]"));
      const metadata = old.positions.length ? {} : buildLegacyContinuityMetadata(row);
      const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt", "last_active_at", "created_at", "createdAt"], importedAt) || importedAt);
      const historyId = stableImportId("old_continuity_history", oldId);
      const snapshotId = stableImportId("old_continuity_snapshot", oldId);
      await database.exec(`
        INSERT INTO current_positions (id, line_id, summary, interpretation_status, facts_used_json, metadata_json, updated_at)
        VALUES (${sqlString(positionId)}, ${sqlString(lineId)}, ${sqlString(summaryText)}, ${sqlString(status)}, ${sqlString(JSON.stringify(factsUsed))}, ${sqlString(JSON.stringify(metadata))}, ${sqlString(updatedAt)});
        INSERT INTO continuity_position_history (id, line_id, position_id, summary, interpretation_status, facts_used_json, source, created_at)
        VALUES (${sqlString(historyId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summaryText)}, ${sqlString(status)}, ${sqlString(JSON.stringify(factsUsed))}, 'old-continuity-import', ${sqlString(updatedAt)})
        ON CONFLICT(id) DO NOTHING;
        INSERT INTO continuity_snapshots (id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at)
        VALUES (${sqlString(snapshotId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summaryText)}, ${sqlString(status)}, ${sqlString(JSON.stringify(factsUsed))}, 'old-continuity-import', ${sqlString(updatedAt)})
        ON CONFLICT(id) DO NOTHING;
        UPDATE continuity_lines
        SET updated_at = ${sqlString(updatedAt)}
        WHERE id = ${sqlString(lineId)};
      `);
      summary.positions.imported += 1;
    }
  
    for (const row of [...old.handoffs, ...old.legacyHandoffs]) {
      const oldId = String(pickFirst(row, ["id", "handoff_id", "handoffId"], "") || "").trim();
      const objective = String(pickFirst(row, ["objective", "title", "summary", "body"], "") || "").trim();
      if (!oldId || !objective) {
        summary.handoffs.skipped += 1;
        continue;
      }
      const id = stableImportId("old_continuity_handoff", oldId);
      const existing = await database.query(`SELECT id FROM continuity_handoffs WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.handoffs.skipped += 1;
        continue;
      }
      const lineId = await resolveImportedLineId(row);
      const completed = safeJsonArray(pickFirst(row, ["completed_json", "completed", "done_json"], "[]"));
      const openItems = safeJsonArray(pickFirst(row, ["open_items_json", "openItems", "open_items", "todo_json"], "[]"));
      const nextStep = String(pickFirst(row, ["next_step", "nextStep", "next"], "") || "").trim();
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "updated_at", "updatedAt"], importedAt) || importedAt);
      await database.exec(`
        INSERT INTO continuity_handoffs (id, line_id, objective, completed_json, open_items_json, next_step, created_at)
        VALUES (${sqlString(id)}, ${sqlString(lineId)}, ${sqlString(objective)}, ${sqlString(JSON.stringify(completed))}, ${sqlString(JSON.stringify(openItems))}, ${sqlString(nextStep)}, ${sqlString(createdAt)});
      `);
      summary.handoffs.imported += 1;
    }
  
    for (const row of old.stateSnapshots) {
      const oldId = String(pickFirst(row, ["id", "snapshot_id", "snapshotId"], "") || "").trim();
      const summaryText = String(pickFirst(row, ["summary", "state_summary", "body", "content", "text"], "") || "").trim();
      if (!oldId || !summaryText) {
        summary.positions.skipped += 1;
        continue;
      }
      const lineId = await resolveImportedLineId(row);
      const positionId = stableImportId("old_continuity_snapshot_position", oldId);
      const snapshotId = stableImportId("old_continuity_state_snapshot", oldId);
      const existing = await database.query(`SELECT id FROM continuity_snapshots WHERE id = ${sqlString(snapshotId)} LIMIT 1;`);
      if (existing.length) {
        summary.positions.skipped += 1;
        continue;
      }
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "updated_at", "updatedAt"], importedAt) || importedAt);
      await database.exec(`
        INSERT INTO continuity_snapshots (id, line_id, position_id, summary, interpretation_status, facts_used_json, reason, created_at)
        VALUES (${sqlString(snapshotId)}, ${sqlString(lineId)}, ${sqlString(positionId)}, ${sqlString(summaryText)}, 'draft', '[]', 'old-state-snapshot-import', ${sqlString(createdAt)});
      `);
      summary.positions.imported += 1;
    }

    for (const row of old.agentState) {
      const agentId = String(pickFirst(row, ["id", "agent_id", "agentId"], "codex") || "codex").trim() || "codex";
      const existing = await database.query(`SELECT agent_id FROM continuity_agent_state WHERE agent_id = ${sqlString(agentId)} LIMIT 1;`);
      if (existing.length) {
        summary.agentState.skipped += 1;
        continue;
      }
      await database.updateContinuityAgentState(agentId, {
        communicationStyle: pickFirst(row, ["communication_style", "communicationStyle"], ""),
        relationshipPosition: pickFirst(row, ["relationship_position", "relationshipPosition"], ""),
        longTermPreferences: safeJsonArray(pickFirst(row, ["long_term_preferences", "longTermPreferences"], "[]")),
        boundaries: safeJsonArray(pickFirst(row, ["boundaries"], "[]")),
        stablePatterns: safeJsonArray(pickFirst(row, ["stable_patterns", "stablePatterns"], "[]")),
        notes: pickFirst(row, ["notes"], "")
      });
      summary.agentState.imported += 1;
    }

    const modelAdjustmentsPath = path.join(path.dirname(dbPath), "model_adjustments.json");
    try {
      const modelAdjustmentsRaw = await fs.readFile(modelAdjustmentsPath, "utf8");
      const modelAdjustments = JSON.parse(modelAdjustmentsRaw);
      const models = modelAdjustments?.models && typeof modelAdjustments.models === "object" ? modelAdjustments.models : {};
      for (const [model, entry] of Object.entries(models)) {
        const existing = await database.getContinuityModelAdjustment(model);
        if (existing) {
          summary.modelAdjustments.skipped += 1;
          continue;
        }
        await database.setContinuityModelAdjustment({
          model,
          forbiddenPhrases: Array.isArray(entry?.forbidden_phrases) ? entry.forbidden_phrases : [],
          forbiddenPatterns: Array.isArray(entry?.forbidden_patterns) ? entry.forbidden_patterns : [],
          injectPrompt: entry?.inject_prompt || "",
          updatedBy: entry?.updated_by || "old-continuity-import"
        });
        summary.modelAdjustments.imported += 1;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  
    const statAfter = await fs.stat(dbPath);
    summary.sourceMtimeUnchanged = statAfter.mtimeMs === statBefore.mtimeMs;
    summary.sourceSizeUnchanged = statAfter.size === statBefore.size;
    if (!summary.sourceMtimeUnchanged || !summary.sourceSizeUnchanged) {
      throw new Error("Old Continuity source changed during import.");
    }
    const activeImportedLines = await database.query(`
      SELECT id
      FROM continuity_lines
      WHERE id IN (${[...lineIdMap.values()].map((id) => sqlString(id)).join(", ") || "''"})
        AND status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1;
    `);
    const sharedLine = activeImportedLines[0]?.id
      ? await database.getResumePacket({ lineId: activeImportedLines[0].id })
      : await database.getResumePacket();
    if (activeImportedLines[0]?.id) {
      await database.setActiveContinuityLine(activeImportedLines[0].id);
    }
    return {
      ...summary,
      sharedLine
    };
  }

  return {
    importOldContinuityIntoProduct
  };
}

module.exports = {
  createLegacyContinuityRuntime
};
