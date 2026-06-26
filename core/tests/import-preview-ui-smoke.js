const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const sqlite = require("node:sqlite");

function createDatabase(dbPath, statements) {
  const database = new sqlite.DatabaseSync(dbPath);
  try {
    database.exec(statements);
  } finally {
    database.close();
  }
}

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-import-preview-ui-"));
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
      CREATE TABLE old_unmapped (id TEXT PRIMARY KEY, body TEXT);
      INSERT INTO memories VALUES ('m1', 'old memory');
      INSERT INTO records VALUES ('r1', 'old record');
      INSERT INTO records VALUES ('r2', 'old record 2');
      INSERT INTO old_unmapped VALUES ('u1', 'old unmapped row');
    `
  );
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

  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: productRoot,
        MEMORIA_ROOT: memoriaRoot,
        CONTINUITY_ROOT: continuityRoot,
        INNERLIFE_ROOT: innerlifeRoot
      }
    });
    const page = await app.firstWindow();
    await page.waitForSelector("[data-view='data']", { timeout: 15000 });
    await page.click("[data-view='data']");
    await page.waitForFunction(() => document.querySelector("#importPreviewList")?.textContent.includes("Memoria"), null, {
      timeout: 15000
    });
    const text = await page.textContent("#importPreviewList");
    const expectedGroups = [
      ["Memoria"],
      ["Continuity"],
      ["InnerLife"],
      ["candidate rows", "候选行"],
      ["old_unmapped"],
      ["Import enabled", "导入已开启"],
      ["Sample rows", "样例行"],
      ["old record"],
      ["old position"],
      ["old share"]
    ];
    for (const expected of expectedGroups) {
      if (!expected.some((candidate) => text.includes(candidate))) {
        throw new Error(`Import preview UI missing one of "${expected.join(" / ")}": ${text}`);
      }
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#importOldMemoria");
    await page.waitForFunction(
      async () => {
        const search = await window.ClaraCoreDesktop.searchMemories("old record 2");
        const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
        return search.results.some((memory) => memory.body.includes("old record 2")) && snapshot.backups.length >= 1;
      },
      null,
      { timeout: 15000 }
    );
    const imported = await page.evaluate(async () => {
      const search = await window.ClaraCoreDesktop.searchMemories("old record 2");
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        found: search.results.some((memory) => memory.body.includes("old record 2")),
        backups: snapshot.backups.length
      };
    });
    if (!imported.found || imported.backups < 1) {
      throw new Error(`Import preview UI did not import old Memoria with backup: ${JSON.stringify(imported)}`);
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#importOldContinuity");
    let continuityImported = null;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      continuityImported = await page.evaluate(async () => {
        try {
          const sharedLine = await window.ClaraCoreDesktop.getSharedLine({ lineId: "old_continuity_line_line1" });
          const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
          return {
            position: sharedLine.currentPosition.summary,
            handoffs: sharedLine.handoffs.map((handoff) => handoff.objective),
            backups: snapshot.backups.length
          };
        } catch (error) {
          return { error: error.message, position: "", handoffs: [], backups: 0 };
        }
      });
      if (
        continuityImported.position.includes("old position") &&
        continuityImported.handoffs.includes("old objective") &&
        continuityImported.backups >= 2
      ) {
        break;
      }
      await page.waitForTimeout(250);
    }
    if (!continuityImported.position.includes("old position") || !continuityImported.handoffs.includes("old objective") || continuityImported.backups < 2) {
      throw new Error(`Import preview UI did not import old Continuity with backup: ${JSON.stringify(continuityImported)}`);
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#importOldInnerLife");
    let innerLifeImported = null;
    const innerLifeDeadline = Date.now() + 15000;
    while (Date.now() < innerLifeDeadline) {
      innerLifeImported = await page.evaluate(async () => {
        const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
        return {
          shares: snapshot.innerLife.recentShares.map((share) => share.body),
          eventCount: snapshot.innerLife.counts.events_count,
          thoughtCount: snapshot.innerLife.counts.thoughts_count,
          backups: snapshot.backups.length
        };
      });
      if (
        innerLifeImported.shares.some((body) => body.includes("old share")) &&
        innerLifeImported.eventCount >= 1 &&
        innerLifeImported.thoughtCount >= 1 &&
        innerLifeImported.backups >= 3
      ) {
        break;
      }
      await page.waitForTimeout(250);
    }
    if (
      !innerLifeImported.shares.some((body) => body.includes("old share")) ||
      innerLifeImported.eventCount < 1 ||
      innerLifeImported.thoughtCount < 1 ||
      innerLifeImported.backups < 3
    ) {
      throw new Error(`Import preview UI did not import old InnerLife with backup: ${JSON.stringify(innerLifeImported)}`);
    }
    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          productRoot,
          memoriaRoot,
          visible: ["candidate rows", "old_unmapped", "Import enabled", "Sample rows"],
          continuityImported,
          innerLifeImported
        },
        null,
        2
      )
    );
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
