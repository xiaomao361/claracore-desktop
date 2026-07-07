const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-backup-restore-ui-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot,
        CLARACORE_DESKTOP_USER_DATA_DIR: userDataRoot,
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
    await page.waitForFunction(() => window.ClaraCoreDesktop && document.querySelector("#backupList"));

    const before = await page.evaluate(() =>
      window.ClaraCoreDesktop.createMemory({
        title: "UI backup restore before A",
        body: "This UI backup Memory should return after restore.",
        labels: "ui, backup"
      })
    );
    await page.evaluate((id) =>
      window.ClaraCoreDesktop.saveSharedLine({
        summary: "UI backup restore shared line checkpoint.",
        interpretationStatus: "confirmed",
        factsUsed: [id]
      }), before.id);

    await page.click("[data-view='settings']");
    await page.click("[data-settings-tab='data']");
    await page.click("#exportBackup");
    await page.waitForSelector("[data-backup-action='restore']", { timeout: 15000 });
    const backupText = await page.textContent("#backupList");
    if (!backupText.includes("verified") || (!backupText.includes("Quick check") && !backupText.includes("快速检查"))) {
      throw new Error(`Backup list does not show verification: ${backupText}`);
    }

    await page.evaluate((id) => window.ClaraCoreDesktop.deleteMemory(id), before.id);
    const after = await page.evaluate(() =>
      window.ClaraCoreDesktop.createMemory({
        title: "UI backup restore after B",
        body: "This UI backup Memory should disappear after restore.",
        labels: "ui, backup"
      })
    );

    await page.click("[data-backup-action='restore']");
    await page.waitForSelector("#restoreConfirmPanel:not(.hidden)", { timeout: 15000 });
    const previewText = await page.textContent("#restorePreview");
    if (!previewText.includes("UI backup restore before A")) {
      throw new Error(`Restore preview missing returning Memory: ${previewText}`);
    }
    if (!previewText.includes("UI backup restore after B")) {
      throw new Error(`Restore preview missing removed Memory: ${previewText}`);
    }
    await page.fill("#restoreConfirmInput", "RESTORE");
    await page.click("#confirmRestoreBackup");
    await page.waitForFunction(() => document.querySelector("#restoreConfirmPanel").classList.contains("hidden"), null, { timeout: 15000 });

    const result = await page.evaluate(async ({ beforeId, afterId }) => {
      const beforeSearch = await window.ClaraCoreDesktop.searchMemories("UI backup restore before A");
      const afterSearch = await window.ClaraCoreDesktop.searchMemories("UI backup restore after B");
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        beforeFound: beforeSearch.results.some((memory) => memory.id === beforeId),
        afterFound: afterSearch.results.some((memory) => memory.id === afterId),
        sharedLine: snapshot.sharedLine.currentPosition.summary,
        backups: snapshot.backups.length
      };
    }, { beforeId: before.id, afterId: after.id });
    if (!result.beforeFound) throw new Error("UI restore did not bring back checkpoint Memory.");
    if (result.afterFound) throw new Error("UI restore did not remove post-backup Memory.");
    if (result.sharedLine !== "UI backup restore shared line checkpoint.") {
      throw new Error(`UI restore did not recover Shared Line checkpoint: ${result.sharedLine}`);
    }
    if (result.backups < 1) throw new Error("UI restore did not show the re-registered safety backup.");

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          restoredMemoryId: before.id,
          removedMemoryId: after.id,
          backups: result.backups
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
