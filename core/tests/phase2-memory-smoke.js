const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase2-memory-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  await runtime.saveProductSettings(app, {
    "memory.embedding.base_url": "http://127.0.0.1:9",
    "memory.embedding.model": "bge-m3-phase2-smoke"
  });

  const created = await runtime.createProductMemory(app, {
    title: "Phase 2 memory smoke",
    body: "Memory CRUD and keyword search should work without old Memoria data.",
    labels: "phase2, smoke"
  });
  if (!created.id || created.title !== "Phase 2 memory smoke") {
    throw new Error("Memory create did not return the created record.");
  }
  if (!created.labels.includes("phase2") || !created.labels.includes("smoke")) {
    throw new Error(`Memory labels were not normalized: ${created.labels}`);
  }

  const snapshotAfterCreate = await runtime.buildProductSnapshot(app);
  if (!snapshotAfterCreate.data.databasePath.startsWith(dataRoot)) {
    throw new Error(`Memory database escaped product data root: ${snapshotAfterCreate.data.databasePath}`);
  }
  const memoriesAfterCreate = await runtime.getProductMemories(app, { limit: 20 });
  if (!memoriesAfterCreate.some((memory) => memory.id === created.id)) {
    throw new Error("Created Memory is missing from the runtime snapshot.");
  }
  const { database } = await runtime.ensureProductCore(app);

  const structuredRecord = await runtime.createProductMemoryRecord(app, {
    recordType: "fitness",
    title: "Morning walk",
    value: {
      steps: 3200,
      mood: "steady"
    },
    occurredAt: "2026-06-25T08:00:00.000Z",
    source: "phase2-smoke"
  });
  if (!structuredRecord?.id || structuredRecord.recordType !== "fitness" || structuredRecord.value.steps !== 3200) {
    throw new Error(`Structured Memory record was not saved: ${JSON.stringify(structuredRecord)}`);
  }
  const structuredRecords = await runtime.getProductMemoryRecords(app, {
    recordType: "fitness",
    limit: 5
  });
  if (!structuredRecords.records.some((record) => record.id === structuredRecord.id)) {
    throw new Error("Structured Memory record list did not include the saved record.");
  }
  if (!structuredRecords.stats.types.some((item) => item.recordType === "fitness" && item.count === 1)) {
    throw new Error(`Structured Memory stats did not count the saved record: ${JSON.stringify(structuredRecords.stats)}`);
  }
  const snapshotAfterStructuredRecord = await runtime.buildProductSnapshot(app);
  if (snapshotAfterStructuredRecord.memoryStats.structuredRecordCount !== 1) {
    throw new Error(`Memory stats did not include structured record count: ${JSON.stringify(snapshotAfterStructuredRecord.memoryStats)}`);
  }

  const aliasResult = await runtime.createProductMemoryLabelAlias(app, {
    alias: "ai",
    canonicalLabel: "agent"
  });
  if (!aliasResult.aliases.some((item) => item.alias === "ai" && item.canonicalLabel === "agent")) {
    throw new Error(`Memory label alias was not saved: ${JSON.stringify(aliasResult)}`);
  }
  const aliasMemory = await runtime.createProductMemory(app, {
    title: "Alias memory smoke",
    body: "Alias labels should normalize before Memory is saved.",
    labels: "ai, phase2"
  });
  if (!aliasMemory.labels.includes("agent") || aliasMemory.labels.includes("ai")) {
    throw new Error(`Memory labels did not use alias canonical label: ${JSON.stringify(aliasMemory.labels)}`);
  }
  const snapshotAfterAlias = await runtime.buildProductSnapshot(app);
  if (!snapshotAfterAlias.memoryStats.labels.some((item) => item.label === "agent" && item.count === 1)) {
    throw new Error(`Memory stats did not count canonical alias label: ${JSON.stringify(snapshotAfterAlias.memoryStats.labels)}`);
  }
  if (snapshotAfterAlias.memoryStats.labels.some((item) => item.label === "ai")) {
    throw new Error(`Memory stats still include alias label: ${JSON.stringify(snapshotAfterAlias.memoryStats.labels)}`);
  }
  const aliasesAfterCreate = await runtime.getProductMemoryLabelAliases(app);
  if (!aliasesAfterCreate.some((item) => item.alias === "ai" && item.canonicalLabel === "agent")) {
    throw new Error("Memory label aliases are missing from runtime snapshot.");
  }
  await runtime.deleteProductMemoryLabelAlias(app, "ai");
  const aliasesAfterDelete = await runtime.getProductMemoryLabelAliases(app);
  if (aliasesAfterDelete.some((item) => item.alias === "ai")) {
    throw new Error("Memory label alias delete did not remove the alias.");
  }
  const graphAfterAlias = await runtime.getProductMemoryGraph(app, { limit: 20 });
  if (!graphAfterAlias.nodes.some((node) => node.kind === "memory" && node.refId === aliasMemory.id)) {
    throw new Error(`Memory graph did not include Memory node: ${JSON.stringify(graphAfterAlias)}`);
  }
  if (!graphAfterAlias.nodes.some((node) => node.kind === "label" && node.refId === "agent")) {
    throw new Error(`Memory graph did not include canonical label node: ${JSON.stringify(graphAfterAlias)}`);
  }
  if (!graphAfterAlias.edges.some((edge) => edge.from === `memory:${aliasMemory.id}` && edge.to === "label:agent" && edge.kind === "labeled")) {
    throw new Error(`Memory graph did not include Memory-label edge: ${JSON.stringify(graphAfterAlias.edges)}`);
  }

  await database.exec(`
    DELETE FROM memory_embeddings
    WHERE memory_id = ${sqlString(created.id)};
  `);
  await database.exec(`
    INSERT INTO memory_label_aliases (alias, canonical_label)
    VALUES ('ai', 'agent')
    ON CONFLICT(alias) DO UPDATE SET canonical_label = excluded.canonical_label;
  `);
  await database.exec(`
    INSERT INTO memory_labels (memory_id, label)
    VALUES (${sqlString(aliasMemory.id)}, 'ai')
    ON CONFLICT(memory_id, label) DO NOTHING;
  `);
  const seededAliasRows = await database.query(`
    SELECT l.memory_id, l.label, a.canonical_label
    FROM memory_labels l
    JOIN memory_label_aliases a ON a.alias = l.label
    WHERE l.memory_id = ${sqlString(aliasMemory.id)};
  `);
  if (seededAliasRows.length !== 1) {
    throw new Error(`Memory maintenance test did not seed alias-label drift: ${JSON.stringify(seededAliasRows)}`);
  }
  const maintenanceBefore = await runtime.getProductMemoryMaintenance(app);
  if (maintenanceBefore.counts.missingEmbeddings < 1 || maintenanceBefore.counts.aliasLabels < 1) {
    throw new Error(`Memory maintenance did not detect seeded issues: ${JSON.stringify(maintenanceBefore)}`);
  }
  const maintenanceDryRun = await runtime.runProductMemoryMaintenance(app, { dryRun: true });
  if (!maintenanceDryRun.dryRun || maintenanceDryRun.actions.length !== 0) {
    throw new Error(`Memory maintenance dry run mutated actions: ${JSON.stringify(maintenanceDryRun)}`);
  }
  const maintenanceResult = await runtime.runProductMemoryMaintenance(app, { dryRun: false });
  if (!maintenanceResult.actions.some((action) => action.code === "queued_embeddings" && action.count >= 1)) {
    throw new Error(`Memory maintenance did not requeue embeddings: ${JSON.stringify(maintenanceResult)}`);
  }
  if (!maintenanceResult.actions.some((action) => action.code === "canonicalized_alias_labels" && action.count >= 1)) {
    throw new Error(`Memory maintenance did not canonicalize alias labels: ${JSON.stringify(maintenanceResult)}`);
  }
  if (maintenanceResult.after.status !== "ok") {
    throw new Error(`Memory maintenance left issues behind: ${JSON.stringify(maintenanceResult.after)}`);
  }
  const aliasMemoryAfterMaintenance = await database.getMemory(aliasMemory.id);
  if (aliasMemoryAfterMaintenance.labels.includes("ai") || !aliasMemoryAfterMaintenance.labels.includes("agent")) {
    throw new Error(`Memory maintenance did not repair alias labels: ${JSON.stringify(aliasMemoryAfterMaintenance.labels)}`);
  }

  // Neither body may contain the other: mergeMemories skips the "Merged from"
  // header for contained bodies, and suggestion direction flips whenever the
  // two creates land on different CURRENT_TIMESTAMP seconds.
  const mergeTarget = await runtime.createProductMemory(app, {
    title: "Duplicate merge candidate",
    body: "The same product note should be merged when duplicate memory records appear in ClaraCore Desktop. Extra detail from target.",
    labels: "phase2, duplicate"
  });
  const mergeSource = await runtime.createProductMemory(app, {
    title: "Duplicate merge candidate",
    body: "The same product note should be merged when duplicate memory records appear in ClaraCore Desktop. Extra detail from source.",
    labels: "phase2, duplicate, source"
  });
  const mergeSuggestions = await runtime.getProductMemoryMergeSuggestions(app, { limit: 10 });
  const mergeSuggestion = mergeSuggestions.suggestions.find(
    (suggestion) =>
      [suggestion.target.id, suggestion.source.id].includes(mergeTarget.id) &&
      [suggestion.target.id, suggestion.source.id].includes(mergeSource.id)
  );
  if (!mergeSuggestion) {
    throw new Error(`Memory merge suggestions did not include duplicate pair: ${JSON.stringify(mergeSuggestions)}`);
  }
  const mergeResult = await runtime.mergeProductMemories(app, {
    targetId: mergeSuggestion.target.id,
    sourceId: mergeSuggestion.source.id
  });
  if (!mergeResult.merged || mergeResult.target.status !== "active" || mergeResult.source.status !== "deleted") {
    throw new Error(`Memory merge did not keep target active and soft-delete source: ${JSON.stringify(mergeResult)}`);
  }
  if (!mergeResult.target.body.includes("Merged from") || !mergeResult.target.labels.includes("source")) {
    throw new Error(`Memory merge did not combine body and labels: ${JSON.stringify(mergeResult.target)}`);
  }
  const archiveCandidate = await runtime.createProductMemory(app, {
    title: "Dormant archive candidate",
    body: "Old Memory records should be suggested for archive instead of staying in the main list forever.",
    labels: "phase2, archive"
  });
  await database.exec(`
    UPDATE memories
    SET updated_at = '2000-01-01 00:00:00'
    WHERE id = ${sqlString(archiveCandidate.id)};
  `);
  const archiveSuggestions = await runtime.getProductMemoryArchiveSuggestions(app, {
    olderThanDays: 30,
    limit: 10
  });
  if (!archiveSuggestions.suggestions.some((item) => item.id === archiveCandidate.id)) {
    throw new Error(`Memory archive suggestions did not include dormant candidate: ${JSON.stringify(archiveSuggestions)}`);
  }
  const archiveDryRun = await runtime.archiveProductDormantMemories(app, {
    olderThanDays: 30,
    limit: 10,
    dryRun: true
  });
  if (!archiveDryRun.dryRun || archiveDryRun.archived !== 0) {
    throw new Error(`Memory archive dry run should not archive records: ${JSON.stringify(archiveDryRun)}`);
  }
  const archiveResult = await runtime.archiveProductDormantMemories(app, {
    olderThanDays: 30,
    limit: 10
  });
  if (archiveResult.archived < 1) {
    throw new Error(`Memory archive dormant did not archive candidate: ${JSON.stringify(archiveResult)}`);
  }
  const archivedMemoriesAfterArchive = await runtime.getProductArchivedMemories(app, { limit: 20 });
  if (!archivedMemoriesAfterArchive.some((memory) => memory.id === archiveCandidate.id)) {
    throw new Error("Archived Memory is missing from runtime snapshot.");
  }
  const archivedSearch = await runtime.searchProductMemories(app, "Dormant archive candidate");
  if (archivedSearch.results.some((memory) => memory.id === archiveCandidate.id)) {
    throw new Error("Archived Memory appeared in normal search results.");
  }
  const restoredArchived = await runtime.restoreArchivedProductMemory(app, archiveCandidate.id);
  if (restoredArchived.status !== "active") {
    throw new Error(`Archived Memory did not restore to active: ${JSON.stringify(restoredArchived)}`);
  }
  const restoredArchiveSearch = await runtime.searchProductMemories(app, "Dormant archive candidate");
  if (!restoredArchiveSearch.results.some((memory) => memory.id === archiveCandidate.id)) {
    throw new Error("Restored archived Memory did not reappear in normal search.");
  }

  const restricted = await runtime.createProductMemory(app, {
    title: "Restricted phase2 memory",
    body: "Restricted Memory should not appear in normal list or search results.",
    labels: "phase2, private",
    sensitivity: "restricted"
  });
  if (restricted.sensitivity !== "restricted") {
    throw new Error(`Restricted Memory was not saved as restricted: ${JSON.stringify(restricted)}`);
  }
  const snapshotAfterRestricted = await runtime.buildProductSnapshot(app);
  if (snapshotAfterRestricted.memoryStats.restrictedCount !== 1 || snapshotAfterRestricted.memoryStats.labels.some((item) => item.label === "private")) {
    throw new Error(`Restricted Memory leaked into normal stats: ${JSON.stringify(snapshotAfterRestricted.memoryStats)}`);
  }
  const normalMemoriesAfterRestrict = await runtime.getProductMemories(app, { limit: 50 });
  if (normalMemoriesAfterRestrict.some((memory) => memory.id === restricted.id)) {
    throw new Error("Restricted Memory appeared in the normal runtime Memory list.");
  }
  const restrictedList = await runtime.getProductRestrictedMemories(app, { limit: 20 });
  if (!restrictedList.some((memory) => memory.id === restricted.id)) {
    throw new Error("Restricted Memory is missing from the restricted runtime list.");
  }
  const restrictedSearch = await runtime.searchProductMemories(app, "Restricted Memory");
  if (restrictedSearch.results.some((memory) => memory.id === restricted.id)) {
    throw new Error("Restricted Memory appeared in normal search results.");
  }
  const normalAgain = await runtime.unrestrictProductMemory(app, restricted.id);
  if (normalAgain.sensitivity !== "normal") {
    throw new Error("Restricted Memory did not restore to normal sensitivity.");
  }
  const normalSearch = await runtime.searchProductMemories(app, "Restricted Memory");
  if (!normalSearch.results.some((memory) => memory.id === restricted.id)) {
    throw new Error("Unrestricted Memory did not reappear in normal search.");
  }

  const keywordSearch = await runtime.searchProductMemories(app, "keyword search");
  if (!keywordSearch.results.some((memory) => memory.id === created.id)) {
    throw new Error("Keyword search did not find the created Memory.");
  }

  const updated = await runtime.updateProductMemory(app, created.id, {
    title: "Phase 2 memory smoke updated",
    body: "Updated Memory records should replace title, body, and labels.",
    labels: ["phase2", "updated"]
  });
  if (updated.title !== "Phase 2 memory smoke updated") {
    throw new Error("Memory update did not persist the new title.");
  }
  if (!updated.labels.includes("updated") || updated.labels.includes("smoke")) {
    throw new Error(`Memory update did not replace labels: ${updated.labels}`);
  }

  const updateSearch = await runtime.searchProductMemories(app, "replace title");
  if (!updateSearch.results.some((memory) => memory.id === created.id)) {
    throw new Error("Keyword search did not find the updated Memory body.");
  }

  const embedResult = await runtime.processProductMemoryEmbeddings(app, 1);
  const embedded = await runtime.searchProductMemories(app, "Updated Memory");
  const embeddedRecord = embedded.results.find((memory) => memory.id === created.id);
  if (!embeddedRecord) {
    throw new Error("Memory disappeared after failed embedding attempt.");
  }
  if (!["failed", "pending"].includes(embeddedRecord.embedding_status)) {
    throw new Error(`Unexpected embedding state after unavailable Ollama endpoint: ${embeddedRecord.embedding_status}`);
  }
  if (embedResult.processed < 1) {
    throw new Error("Embedding processor did not process the pending Memory.");
  }

  await runtime.deleteProductMemory(app, created.id);
  const afterDeleteSearch = await runtime.searchProductMemories(app, "Phase 2 memory smoke updated");
  if (afterDeleteSearch.results.some((memory) => memory.id === created.id)) {
    throw new Error("Soft-deleted Memory still appears in active search results.");
  }
  const snapshotAfterDelete = await runtime.buildProductSnapshot(app);
  if (snapshotAfterDelete.memoryStats.deletedCount !== 2 || snapshotAfterDelete.memoryStats.labels.some((item) => item.label === "updated")) {
    throw new Error(`Memory stats did not reflect delete and labels: ${JSON.stringify(snapshotAfterDelete.memoryStats)}`);
  }
  const deletedMemoriesAfterDelete = await runtime.getProductDeletedMemories(app, { limit: 20 });
  if (!deletedMemoriesAfterDelete.some((memory) => memory.id === created.id)) {
    throw new Error("Deleted Memory is missing from the deleted-memory snapshot.");
  }
  const restored = await runtime.restoreProductMemory(app, created.id);
  if (restored.status !== "active") {
    throw new Error("Memory restore did not reactivate the deleted record.");
  }
  const afterRestoreSearch = await runtime.searchProductMemories(app, "Phase 2 memory smoke updated");
  if (!afterRestoreSearch.results.some((memory) => memory.id === created.id)) {
    throw new Error("Restored Memory did not reappear in active search.");
  }
  const snapshotAfterRestore = await runtime.buildProductSnapshot(app);
  if (snapshotAfterRestore.memoryStats.deletedCount !== 1 || snapshotAfterRestore.memoryStats.activeCount !== 5) {
    throw new Error(`Memory stats did not reflect restore: ${JSON.stringify(snapshotAfterRestore.memoryStats)}`);
  }
  if (!snapshotAfterRestore.memoryStats.labels.some((item) => item.label === "updated")) {
    throw new Error(`Memory stats did not restore active labels: ${JSON.stringify(snapshotAfterRestore.memoryStats)}`);
  }
  await runtime.deleteProductMemory(app, created.id);

  await runtime.createProductMemoryLabelAlias(app, {
    alias: "portable",
    canonicalLabel: "exported"
  });
  const exportTarget = path.join(runtime.resolveProductPaths(app).exportsDir, "phase2-memory-export.json");
  const exportedArchive = await runtime.exportProductMemoryArchive(app, { targetPath: exportTarget });
  if (exportedArchive.counts.memories < 3 || exportedArchive.counts.records !== 1 || exportedArchive.path !== exportTarget) {
    throw new Error(`Memory archive export counts mismatch: ${JSON.stringify(exportedArchive)}`);
  }
  await fs.access(exportedArchive.path);
  const archiveJson = JSON.parse(await fs.readFile(exportedArchive.path, "utf8"));
  if (archiveJson.format !== "claracore.memory.archive" || archiveJson.version !== 1) {
    throw new Error(`Memory archive format mismatch: ${JSON.stringify(archiveJson)}`);
  }
  if (!archiveJson.memories.some((memory) => memory.id === created.id && memory.status === "deleted")) {
    throw new Error("Memory archive did not include deleted Memory state.");
  }
  if (archiveJson.memories.some((memory) => memory.embedding_status || memory.embeddingStatus)) {
    throw new Error("Memory archive should not include machine-specific embedding state.");
  }

  const importRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase2-memory-import-"));
  const importApp = {
    getPath(name) {
      return path.join(importRoot, name);
    },
    isPackaged: false
  };
  process.env.CLARACORE_DESKTOP_DATA_DIR = importRoot;
  const importResult = await runtime.importProductMemoryArchive(importApp, { filePath: exportedArchive.path });
  if (importResult.memories.imported < 3 || importResult.records.imported !== 1) {
    throw new Error(`Memory archive import counts mismatch: ${JSON.stringify(importResult)}`);
  }
  const importedSnapshot = await runtime.buildProductSnapshot(importApp);
  const importedMemories = await runtime.getProductMemories(importApp, { limit: 50 });
  if (!importedMemories.some((memory) => memory.id === aliasMemory.id)) {
    throw new Error("Memory archive import did not restore active Memory.");
  }
  const importedDeleted = await runtime.getProductDeletedMemories(importApp, { limit: 20 });
  if (!importedDeleted.some((memory) => memory.id === created.id)) {
    throw new Error("Memory archive import did not preserve deleted Memory state.");
  }
  const importedRecordStats = await runtime.getProductMemoryRecords(importApp, { recordType: "fitness", limit: 5 });
  if (!importedRecordStats.stats.types.some((item) => item.recordType === "fitness" && item.count === 1)) {
    throw new Error(`Memory archive import did not restore structured records: ${JSON.stringify(importedSnapshot.memoryStats)}`);
  }
  const duplicateImport = await runtime.importProductMemoryArchive(importApp, { filePath: exportedArchive.path });
  if (duplicateImport.memories.imported !== 0 || duplicateImport.records.imported !== 0 || duplicateImport.memories.skipped < 3) {
    throw new Error(`Memory archive duplicate import did not skip existing records: ${JSON.stringify(duplicateImport)}`);
  }
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;

  const deletedRows = await database.query(`
    SELECT status
    FROM memories
    WHERE id = '${created.id.replaceAll("'", "''")}';
  `);
  if (deletedRows[0]?.status !== "deleted") {
    throw new Error("Memory delete did not mark the record as deleted in SQLite.");
  }
  const sourceRows = await database.query(`
    SELECT source_id
    FROM memories
    WHERE id = '${created.id.replaceAll("'", "''")}';
  `);
  if (sourceRows[0]?.source_id !== "manual_desktop") {
    throw new Error("Manual Memory source was not recorded as manual_desktop.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dataRoot,
        databasePath: runtime.resolveProductPaths(app).databasePath,
        memoryId: created.id,
        structuredRecordId: structuredRecord.id,
        embeddingProcessed: embedResult.processed,
        restoredStatus: restored.status,
        deletedStatus: deletedRows[0].status
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
