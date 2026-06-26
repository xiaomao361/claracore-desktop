const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase2-memory-ui-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot
      }
    });
    const page = await app.firstWindow();
    await page.waitForSelector("[data-view='memory']", { timeout: 15000 });
    await page.click("[data-view='memory']");
    await page.waitForFunction(() => window.ClaraCoreDesktop && document.querySelector("#saveMemory"), null, {
      timeout: 15000
    });

    await page.fill("#memoryTitleInput", "UI Memory restore smoke");
    await page.fill("#memoryBodyInput", "UI deleted Memory should restore from the deleted list.");
    await page.fill("#memoryLabelsInput", "ui, restore");
    await page.click("#saveMemory");
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memory restore smoke"), null, {
      timeout: 15000
    });
    await page.waitForFunction(() => document.querySelector("#memoryLabelList")?.textContent.includes("restore"), null, {
      timeout: 15000
    });
    await page.waitForFunction(() => document.querySelector("#memoryGraph")?.textContent.includes("restore"), null, {
      timeout: 15000
    });
    await page.click("[data-memory-label='restore']");
    await page.waitForFunction(() => document.querySelector("#memorySearchInput")?.value === "restore", null, {
      timeout: 15000
    });

    await page.click("[data-memory-action='delete']");
    await page.waitForFunction(() => document.querySelector("#deletedMemoryList")?.textContent.includes("UI Memory restore smoke"), null, {
      timeout: 15000
    });
    await page.click("[data-memory-action='restore']");
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memory restore smoke"), null, {
      timeout: 15000
    });

    await page.fill("#memoryAliasInput", "ux");
    await page.fill("#memoryCanonicalLabelInput", "ui");
    await page.click("#saveMemoryAlias");
    await page.waitForFunction(() => document.querySelector("#memoryAliasList")?.textContent.includes("ux"), null, {
      timeout: 15000
    });
    await page.fill("#memoryTitleInput", "UI alias memory smoke");
    await page.fill("#memoryBodyInput", "Alias labels should normalize through the Desktop form.");
    await page.fill("#memoryLabelsInput", "ux");
    await page.click("#saveMemory");
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI alias memory smoke"), null, {
      timeout: 15000
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("[data-memory-alias='ux']");
    await page.waitForFunction(() => !document.querySelector("#memoryAliasList")?.textContent.includes("ux"), null, {
      timeout: 15000
    });

    await page.fill("#memoryTitleInput", "UI restricted memory smoke");
    await page.fill("#memoryBodyInput", "Restricted UI Memory should stay out of normal search until restored.");
    await page.fill("#memoryLabelsInput", "private");
    await page.check("#memoryRestrictedInput");
    await page.click("#saveMemory");
    await page.waitForFunction(() => document.querySelector("#restrictedMemoryList")?.textContent.includes("UI restricted memory smoke"), null, {
      timeout: 15000
    });
    await page.fill("#memorySearchInput", "UI restricted memory smoke");
    await page.click("#searchMemory");
    await page.waitForFunction(() => !document.querySelector("#memoryList")?.textContent.includes("UI restricted memory smoke"), null, {
      timeout: 15000
    });
    await page.click("[data-memory-action='unrestrict']");
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI restricted memory smoke"), null, {
      timeout: 15000
    });

    await page.fill("#memoryRecordTypeInput", "fitness");
    await page.fill("#memoryRecordTitleInput", "UI steps");
    await page.fill("#memoryRecordValueInput", "{\"steps\":4200,\"source\":\"ui\"}");
    await page.click("#saveMemoryRecord");
    await page.waitForFunction(() => document.querySelector("#memoryRecordList")?.textContent.includes("UI steps"), null, {
      timeout: 15000
    });
    await page.waitForFunction(() => document.querySelector("#memoryRecordStats")?.textContent.includes("fitness"), null, {
      timeout: 15000
    });
    await page.fill("#memoryRecordTitleInput", "Bad JSON");
    await page.fill("#memoryRecordValueInput", "{bad json");
    await page.click("#saveMemoryRecord");
    await page.waitForFunction(() => document.querySelector("#memoryRecordNotice")?.textContent.length > 0, null, {
      timeout: 15000
    });

    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        databasePath: snapshot.data.databasePath,
        activeCount: snapshot.memoryStats.activeCount,
        deletedCount: snapshot.memoryStats.deletedCount,
        restrictedCount: snapshot.memoryStats.restrictedCount,
        structuredRecordCount: snapshot.memoryStats.structuredRecordCount,
        labelAliasCount: snapshot.memoryStats.labelAliasCount,
        aliases: snapshot.memoryLabelAliases,
        recordStats: snapshot.memoryRecordStats,
        recordText: document.querySelector("#memoryRecordList").textContent,
        recordNotice: document.querySelector("#memoryRecordNotice").textContent,
        labels: snapshot.memoryStats.labels,
        deletedText: document.querySelector("#deletedMemoryList").textContent,
        restrictedText: document.querySelector("#restrictedMemoryList").textContent,
        activeText: document.querySelector("#memoryList").textContent,
        graphText: document.querySelector("#memoryGraph").textContent,
        graphSummary: document.querySelector("#memoryGraphSummary").textContent,
        graphEdgeCount: document.querySelectorAll("#memoryGraph .graph-edge").length,
        activeCounter: document.querySelector("#memoryActiveCount").textContent,
        deletedCounter: document.querySelector("#memoryDeletedCount").textContent
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`Memory UI wrote outside product data root: ${result.databasePath}`);
    }
    if (result.activeCount !== 3 || result.deletedCount !== 0 || result.restrictedCount !== 0) {
      throw new Error(`Memory UI counts mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.labels.some((item) => item.label === "restore" && item.count === 1)) {
      throw new Error(`Memory UI label stats mismatch: ${JSON.stringify(result.labels)}`);
    }
    if (!result.labels.some((item) => item.label === "ui" && item.count === 2) || result.labels.some((item) => item.label === "ux")) {
      throw new Error(`Memory UI alias normalization mismatch: ${JSON.stringify(result.labels)}`);
    }
    if (result.labelAliasCount !== 0 || result.aliases.some((item) => item.alias === "ux")) {
      throw new Error(`Memory UI alias delete mismatch: ${JSON.stringify(result.aliases)}`);
    }
    if (result.structuredRecordCount !== 1 || !result.recordStats.types.some((item) => item.recordType === "fitness" && item.count === 1)) {
      throw new Error(`Memory UI structured record stats mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.recordText.includes("UI steps") || !result.recordText.includes("4200")) {
      throw new Error(`Memory UI structured record list mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.recordNotice) {
      throw new Error("Memory UI did not show invalid JSON feedback.");
    }
    if (result.deletedText.includes("UI Memory restore smoke")) {
      throw new Error("Memory UI restored record still appears in deleted list.");
    }
    if (result.restrictedText.includes("UI restricted memory smoke")) {
      throw new Error("Memory UI unrestricted record still appears in restricted list.");
    }
    if (!result.activeText.includes("UI Memory restore smoke")) {
      throw new Error("Memory UI restored record is missing from active list.");
    }
    if (!result.graphText.includes("UI Memory restore smoke") || !result.graphText.includes("restore") || result.graphEdgeCount < 1) {
      throw new Error(`Memory UI graph did not render expected Memory-label relation: ${JSON.stringify(result)}`);
    }
    if (result.activeCounter !== "3" || result.deletedCounter !== "0") {
      throw new Error(`Memory UI counter text mismatch: ${JSON.stringify(result)}`);
    }

    const maintenanceResult = await page.evaluate(async () => {
      return window.ClaraCoreDesktop.runMemoryMaintenance({ dryRun: false });
    });
    if (!maintenanceResult.after || !["ok", "needs_repair"].includes(maintenanceResult.after.status)) {
      throw new Error(`Memory UI maintenance returned invalid result: ${JSON.stringify(maintenanceResult)}`);
    }
    const memoryJsonArchiveResult = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      const targetPath = `${snapshot.data.exportsDir}/ui-memory-export.json`;
      const exported = await window.ClaraCoreDesktop.exportMemoryArchive({
        targetPath,
        silent: true
      });
      const imported = await window.ClaraCoreDesktop.importMemoryArchive({
        filePath: targetPath,
        silent: true
      });
      return {
        targetPath,
        exported,
        imported
      };
    });
    if (memoryJsonArchiveResult.exported.counts.memories < 3 || memoryJsonArchiveResult.imported.memories.imported !== 0) {
      throw new Error(`Memory UI archive export/import mismatch: ${JSON.stringify(memoryJsonArchiveResult)}`);
    }
    await fs.access(memoryJsonArchiveResult.targetPath);
    const mergeResult = await page.evaluate(async () => {
      const target = await window.ClaraCoreDesktop.createMemory({
        title: "UI duplicate merge",
        body: "The UI should show duplicate Memory suggestions and merge them safely.",
        labels: "ui, duplicate"
      });
      const source = await window.ClaraCoreDesktop.createMemory({
        title: "UI duplicate merge",
        body: "The UI should show duplicate Memory suggestions and merge them safely. Source detail.",
        labels: "ui, duplicate, source"
      });
      await window.ClaraCoreDesktop.getRuntimeSnapshot();
      const suggestions = await window.ClaraCoreDesktop.getMemoryMergeSuggestions({ limit: 10 });
      const suggestion = suggestions.suggestions.find((item) => {
        const ids = [item.target.id, item.source.id];
        return ids.includes(target.id) && ids.includes(source.id);
      });
      if (!suggestion) return { target, source, suggestions };
      const merged = await window.ClaraCoreDesktop.mergeMemories({
        targetId: suggestion.target.id,
        sourceId: suggestion.source.id
      });
      return { target, source, suggestions, suggestion, merged };
    });
    if (!mergeResult.suggestion || !mergeResult.merged?.merged || mergeResult.merged.source.status !== "deleted") {
      throw new Error(`Memory UI merge flow failed: ${JSON.stringify(mergeResult)}`);
    }
    const mergeSectionVisible = await page.evaluate(() => Boolean(document.querySelector("#memoryMergeSummary") && document.querySelector("#memoryMergeList")));
    if (!mergeSectionVisible) {
      throw new Error("Memory UI merge section is missing.");
    }
    const archiveFlow = await page.evaluate(async () => {
      const memory = await window.ClaraCoreDesktop.createMemory({
        title: "UI archive memory",
        body: "The UI should archive and restore Memory records.",
        labels: "ui, archive"
      });
      const archived = await window.ClaraCoreDesktop.archiveMemory(memory.id);
      const archivedList = await window.ClaraCoreDesktop.getArchivedMemories(10);
      const restored = await window.ClaraCoreDesktop.restoreArchivedMemory(memory.id);
      const suggestions = await window.ClaraCoreDesktop.getMemoryArchiveSuggestions({ olderThanDays: 1, limit: 10 });
      const dryRun = await window.ClaraCoreDesktop.archiveDormantMemories({ olderThanDays: 1, limit: 10, dryRun: true });
      return { memory, archived, archivedList, restored, suggestions, dryRun };
    });
    if (
      archiveFlow.archived.status !== "archived" ||
      !archiveFlow.archivedList.some((memory) => memory.id === archiveFlow.memory.id) ||
      archiveFlow.restored.status !== "active" ||
      !Array.isArray(archiveFlow.suggestions.suggestions) ||
      !archiveFlow.dryRun.dryRun
    ) {
      throw new Error(`Memory UI archive flow failed: ${JSON.stringify(archiveFlow)}`);
    }
    const archiveSectionVisible = await page.evaluate(() => Boolean(document.querySelector("#memoryArchiveSummary") && document.querySelector("#archivedMemoryList")));
    if (!archiveSectionVisible) {
      throw new Error("Memory UI archive section is missing.");
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: result.databasePath,
          activeCount: result.activeCount,
          deletedCount: result.deletedCount,
          structuredRecordCount: result.structuredRecordCount
        },
        null,
        2
      )
    );
  } catch (error) {
    if (app) await app.close();
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
