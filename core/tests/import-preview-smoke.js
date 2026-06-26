const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const sqlite = require("node:sqlite");
const runtime = require("../runtime");

function createDatabase(dbPath, statements) {
  const database = new sqlite.DatabaseSync(dbPath);
  try {
    database.exec(statements);
  } finally {
    database.close();
  }
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-import-preview-"));
  const productRoot = path.join(root, "product");
  const memoriaRoot = path.join(root, "old-memoria");
  const continuityRoot = path.join(root, "old-continuity");
  const innerlifeRoot = path.join(root, "old-innerlife");
  await fs.mkdir(memoriaRoot, { recursive: true });
  await fs.mkdir(continuityRoot, { recursive: true });
  await fs.mkdir(innerlifeRoot, { recursive: true });

  createDatabase(
    path.join(memoriaRoot, "memoria.db"),
    `
      CREATE TABLE memories (id TEXT PRIMARY KEY, body TEXT);
      CREATE TABLE records (id TEXT PRIMARY KEY, body TEXT);
      CREATE TABLE experimental_notes (id TEXT PRIMARY KEY, body TEXT);
      INSERT INTO memories VALUES ('m1', 'old memory');
      INSERT INTO records VALUES ('r1', 'old record');
      INSERT INTO records VALUES ('r2', 'old record 2');
      INSERT INTO experimental_notes VALUES ('x1', 'not mapped yet');
    `
  );
  await fs.writeFile(path.join(memoriaRoot, "label_aliases.json"), JSON.stringify({ ai: ["agent"] }), "utf8");

  createDatabase(
    path.join(continuityRoot, "continuity.db"),
    `
      CREATE TABLE continuity_lines (id TEXT PRIMARY KEY, title TEXT);
      CREATE TABLE current_positions (id TEXT PRIMARY KEY, line_id TEXT, summary TEXT, interpretation_status TEXT, facts_used_json TEXT);
      CREATE TABLE continuity_handoffs (id TEXT PRIMARY KEY, line_id TEXT, objective TEXT, completed_json TEXT, open_items_json TEXT, next_step TEXT);
      INSERT INTO continuity_lines VALUES ('line1', 'old line');
      INSERT INTO current_positions VALUES ('pos1', 'line1', 'old position', 'confirmed', '["old_fact"]');
      INSERT INTO continuity_handoffs VALUES ('handoff1', 'line1', 'old objective', '["done"]', '["todo"]', 'next');
    `
  );
  await fs.writeFile(path.join(continuityRoot, "model_adjustments.json"), JSON.stringify({ version: 1 }), "utf8");

  createDatabase(
    path.join(innerlifeRoot, "innerlife.db"),
    `
      CREATE TABLE innerlife_profiles (agent_id TEXT PRIMARY KEY, display_name TEXT, profile_json TEXT, state_json TEXT);
      CREATE TABLE innerlife_events (id TEXT PRIMARY KEY, agent_id TEXT, kind TEXT, body TEXT, status TEXT, metadata_json TEXT);
      CREATE TABLE innerlife_thoughts (id TEXT PRIMARY KEY, event_id TEXT, body TEXT, review_status TEXT);
      CREATE TABLE innerlife_shares (id TEXT PRIMARY KEY, agent_id TEXT, thought_id TEXT, body TEXT, status TEXT, decision_reason TEXT);
      INSERT INTO innerlife_profiles VALUES ('agent1', 'Old Agent', '{"tone":"calm"}', '{"loop":"manual"}');
      INSERT INTO innerlife_events VALUES ('e1', 'agent1', 'reflection', 'old event', 'processed', '{"source":"test"}');
      INSERT INTO innerlife_thoughts VALUES ('t1', 'e1', 'old thought', 'unreviewed');
      INSERT INTO innerlife_shares VALUES ('s1', 'agent1', 't1', 'old share', 'pending', '');
    `
  );
  await fs.writeFile(path.join(innerlifeRoot, "innerlife.env"), "INNERLIFE_LLM_BACKEND=fake\n", "utf8");

  const trackedFiles = [
    path.join(memoriaRoot, "memoria.db"),
    path.join(memoriaRoot, "label_aliases.json"),
    path.join(continuityRoot, "continuity.db"),
    path.join(continuityRoot, "model_adjustments.json"),
    path.join(innerlifeRoot, "innerlife.db"),
    path.join(innerlifeRoot, "innerlife.env")
  ];
  const beforeStats = new Map();
  for (const filePath of trackedFiles) {
    const stat = await fs.stat(filePath);
    beforeStats.set(filePath, { size: stat.size, mtimeMs: stat.mtimeMs });
  }

  process.env.CLARACORE_DESKTOP_DATA_DIR = productRoot;
  process.env.MEMORIA_ROOT = memoriaRoot;
  process.env.CONTINUITY_ROOT = continuityRoot;
  process.env.INNERLIFE_ROOT = innerlifeRoot;
  delete process.env.INNERLIFE_DB_PATH;

  const app = {
    getPath(name) {
      return path.join(productRoot, name);
    },
    isPackaged: false
  };
  const snapshot = await runtime.buildProductSnapshot(app);
  const preview = snapshot.importPreview;
  if (preview.mode !== "read-only-preview") throw new Error("Import preview mode is not read-only.");
  if (preview.sources.memoria.database.counts.memories !== 1) throw new Error("Memoria memory count mismatch.");
  if (preview.sources.memoria.database.counts.records !== 2) throw new Error("Memoria records count mismatch.");
  if (preview.sources.continuity.database.counts.continuity_lines !== 1) throw new Error("Continuity line count mismatch.");
  if (preview.sources.continuity.database.counts.current_positions !== 1) throw new Error("Continuity position count mismatch.");
  if (preview.sources.continuity.database.counts.continuity_handoffs !== 1) throw new Error("Continuity handoff count mismatch.");
  if (preview.sources.innerlife.database.counts.innerlife_events !== 1) throw new Error("InnerLife event count mismatch.");
  if (preview.sources.innerlife.database.counts.innerlife_profiles !== 1) throw new Error("InnerLife profile count mismatch.");
  if (preview.sources.innerlife.database.counts.innerlife_thoughts !== 1) throw new Error("InnerLife thought count mismatch.");
  if (preview.sources.innerlife.database.counts.innerlife_shares !== 1) throw new Error("InnerLife share count mismatch.");
  if (preview.sources.memoria.importPlan.candidateRows !== 3) throw new Error("Memoria import candidate count mismatch.");
  if (preview.sources.memoria.importPlan.importEnabled !== true) throw new Error("Memoria import plan should be enabled.");
  if (!preview.sources.memoria.importPlan.candidates.find((candidate) => candidate.table === "records")?.samples?.some((sample) => sample.preview.includes("old record"))) {
    throw new Error("Memoria import preview did not include read-only sample rows.");
  }
  if (!preview.sources.memoria.importPlan.skippedTables.includes("experimental_notes")) {
    throw new Error("Unsupported old Memoria table was not surfaced as skipped.");
  }
  if (preview.sources.continuity.importPlan.candidateRows !== 3) throw new Error("Continuity import candidate count mismatch.");
  if (preview.sources.continuity.importPlan.importEnabled !== true) throw new Error("Continuity import plan should be enabled.");
  if (!preview.sources.continuity.importPlan.candidates.find((candidate) => candidate.table === "current_positions")?.samples?.some((sample) => sample.preview.includes("old position"))) {
    throw new Error("Continuity import preview did not include read-only sample rows.");
  }
  if (preview.sources.innerlife.importPlan.candidateRows !== 4) throw new Error("InnerLife import candidate count mismatch.");
  if (preview.sources.innerlife.importPlan.importEnabled !== true) throw new Error("InnerLife import plan should be enabled.");
  if (!preview.sources.innerlife.importPlan.candidates.find((candidate) => candidate.table === "innerlife_shares")?.samples?.some((sample) => sample.preview.includes("old share"))) {
    throw new Error("InnerLife import preview did not include read-only sample rows.");
  }
  if (!preview.sources.memoria.labelAliases.present) throw new Error("Memoria label aliases were not detected.");
  if (!preview.sources.continuity.modelAdjustments.present) throw new Error("Continuity model adjustments were not detected.");
  if (!preview.sources.innerlife.envFile.present) throw new Error("InnerLife env file was not detected.");
  if (!snapshot.data.databasePath.startsWith(productRoot)) throw new Error("Product database escaped product root.");

  const importResult = await runtime.importOldMemoriaIntoProduct(app, {});
  if (importResult.memories.imported !== 1 || importResult.records.imported !== 2) {
    throw new Error(`Old Memoria import counts mismatch: ${JSON.stringify(importResult)}`);
  }
  if (!importResult.backup?.path) throw new Error("Old Memoria import did not create a product backup first.");
  await fs.access(importResult.backup.path);
  if (!importResult.sourceMtimeUnchanged || !importResult.sourceSizeUnchanged) {
    throw new Error("Old Memoria import changed the source database metadata.");
  }
  const search = await runtime.searchProductMemories(app, "old record 2");
  if (!search.results.some((memory) => memory.body.includes("old record 2"))) {
    throw new Error(`Imported old Memoria record was not searchable: ${JSON.stringify(search)}`);
  }
  const duplicateImport = await runtime.importOldMemoriaIntoProduct(app, {});
  if (duplicateImport.memories.imported !== 0 || duplicateImport.records.imported !== 0) {
    throw new Error(`Old Memoria duplicate import did not skip existing rows: ${JSON.stringify(duplicateImport)}`);
  }

  const continuityImport = await runtime.importOldContinuityIntoProduct(app, {});
  if (
    continuityImport.lines.imported !== 1 ||
    continuityImport.positions.imported !== 1 ||
    continuityImport.handoffs.imported !== 1
  ) {
    throw new Error(`Old Continuity import counts mismatch: ${JSON.stringify(continuityImport)}`);
  }
  if (!continuityImport.backup?.path) throw new Error("Old Continuity import did not create a product backup first.");
  await fs.access(continuityImport.backup.path);
  if (!continuityImport.sourceMtimeUnchanged || !continuityImport.sourceSizeUnchanged) {
    throw new Error("Old Continuity import changed the source database metadata.");
  }
  const sharedLine = await runtime.getProductSharedLine(app, { lineId: "old_continuity_line_line1" });
  if (!sharedLine.currentPosition.summary.includes("old position")) {
    throw new Error(`Imported old Continuity position was not readable: ${JSON.stringify(sharedLine)}`);
  }
  if (!sharedLine.handoffs.some((handoff) => handoff.objective === "old objective")) {
    throw new Error(`Imported old Continuity handoff was not readable: ${JSON.stringify(sharedLine)}`);
  }
  const duplicateContinuityImport = await runtime.importOldContinuityIntoProduct(app, {});
  if (
    duplicateContinuityImport.lines.imported !== 0 ||
    duplicateContinuityImport.positions.imported !== 0 ||
    duplicateContinuityImport.handoffs.imported !== 0
  ) {
    throw new Error(`Old Continuity duplicate import did not skip existing rows: ${JSON.stringify(duplicateContinuityImport)}`);
  }

  const innerLifeImport = await runtime.importOldInnerLifeIntoProduct(app, {});
  if (
    innerLifeImport.profiles.imported !== 1 ||
    innerLifeImport.events.imported !== 1 ||
    innerLifeImport.thoughts.imported !== 1 ||
    innerLifeImport.shares.imported !== 1
  ) {
    throw new Error(`Old InnerLife import counts mismatch: ${JSON.stringify(innerLifeImport)}`);
  }
  if (!innerLifeImport.backup?.path) throw new Error("Old InnerLife import did not create a product backup first.");
  await fs.access(innerLifeImport.backup.path);
  if (!innerLifeImport.sourceMtimeUnchanged || !innerLifeImport.sourceSizeUnchanged) {
    throw new Error("Old InnerLife import changed the source database metadata.");
  }
  const innerLife = await runtime.getProductInnerLife(app);
  if (!innerLife.recentShares.some((share) => share.body.includes("old share"))) {
    throw new Error(`Imported old InnerLife share was not readable: ${JSON.stringify(innerLife)}`);
  }
  if (innerLife.counts.events_count < 1 || innerLife.counts.thoughts_count < 1) {
    throw new Error(`Imported old InnerLife event/thought counts were not readable: ${JSON.stringify(innerLife)}`);
  }
  const duplicateInnerLifeImport = await runtime.importOldInnerLifeIntoProduct(app, {});
  if (
    duplicateInnerLifeImport.profiles.imported !== 0 ||
    duplicateInnerLifeImport.events.imported !== 0 ||
    duplicateInnerLifeImport.thoughts.imported !== 0 ||
    duplicateInnerLifeImport.shares.imported !== 0
  ) {
    throw new Error(`Old InnerLife duplicate import did not skip existing rows: ${JSON.stringify(duplicateInnerLifeImport)}`);
  }

  for (const filePath of trackedFiles) {
    const stat = await fs.stat(filePath);
    const before = beforeStats.get(filePath);
    if (stat.size !== before.size || stat.mtimeMs !== before.mtimeMs) {
      throw new Error(`Import preview modified old source file: ${filePath}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        productRoot,
        memoria: preview.sources.memoria.database.counts,
        continuity: preview.sources.continuity.database.counts,
        innerlife: preview.sources.innerlife.database.counts,
        writePolicy: preview.writePolicy,
        imported: importResult.memories.imported + importResult.records.imported,
        continuityImported:
          continuityImport.lines.imported + continuityImport.positions.imported + continuityImport.handoffs.imported,
        innerLifeImported:
          innerLifeImport.profiles.imported + innerLifeImport.events.imported + innerLifeImport.thoughts.imported + innerLifeImport.shares.imported
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
