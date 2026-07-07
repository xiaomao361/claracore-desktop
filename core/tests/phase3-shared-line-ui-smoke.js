const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase3-shared-line-ui-"));
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
    await page.waitForSelector("[data-view='shared-line']", { timeout: 15000 });
    await page.click("[data-view='shared-line']");
    await page.waitForFunction(
      async () => {
        if (!window.ClaraCoreDesktop) return false;
        const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
        return Boolean(snapshot?.data?.databasePath && document.querySelector("#sharedLineList"));
      },
      null,
      { timeout: 15000 }
    );

    // Seed shared line data via IPC
    const seeded = await page.evaluate(async () => {
      await window.ClaraCoreDesktop.saveSharedLine({
        summary: "UI Shared Line first checkpoint for history.",
        interpretationStatus: "needs_review"
      });
      await window.ClaraCoreDesktop.saveSharedLine({
        summary: "UI Shared Line confirmed checkpoint.",
        interpretationStatus: "confirmed"
      });
      await window.ClaraCoreDesktop.saveSharedLine({
        summary: "UI Shared Line second checkpoint for resume packet.",
        interpretationStatus: "active",
        confirmOverwrite: true
      });
      const handoffResult = await window.ClaraCoreDesktop.createSharedLineHandoff({
        summary: "UI Shared Line second checkpoint for resume packet."
      });
      const parallelResult = await window.ClaraCoreDesktop.createSharedLine({
        title: "UI Shared Line parallel line",
        agentId: "clara",
        makeActive: false
      });
      return { parallelLineId: parallelResult?.sharedLine?.lineId || parallelResult?.lineId || "" };
    });

    await page.evaluate(() => refresh());
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("UI Shared Line second checkpoint"),
      null,
      { timeout: 15000 }
    );

    // Verify current position displayed
    const summaryText = await page.textContent("#sharedLineSummary");
    if (!summaryText.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line UI did not display current position: ${summaryText}`);
    }

    // Verify history tab shows past positions
    await page.click("[data-shared-line-tab='history']");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineHistoryList")?.textContent.includes("UI Shared Line first checkpoint"),
      null,
      { timeout: 15000 }
    );
    const historyText = await page.textContent("#sharedLineHistoryList");
    if (!historyText.includes("UI Shared Line first checkpoint") || !historyText.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line history tab missing expected entries: ${historyText}`);
    }

    // Verify snapshot section (inside history tab) shows confirmed snapshot
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSnapshotList")?.textContent.includes("confirmed"),
      null,
      { timeout: 15000 }
    );
    const snapshotText = await page.textContent("#sharedLineSnapshotList");
    if (!snapshotText.includes("confirmed")) {
      throw new Error(`Shared Line snapshots tab missing confirmed snapshot: ${snapshotText}`);
    }

    // Verify parallel line shows in lines tab
    await page.click("[data-shared-line-tab='lines']");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineList")?.textContent.includes("UI Shared Line parallel line"),
      null,
      { timeout: 15000 }
    );
    const linesText = await page.textContent("#sharedLineList");
    if (!linesText.includes("UI Shared Line parallel line")) {
      throw new Error(`Shared Line lines tab missing parallel line: ${linesText}`);
    }

    // Test archive action on the parallel line (click archive with confirmation)
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("[data-shared-line-action='archive']");
    // Archived lines now live in the history tab
    await page.click("[data-shared-line-tab='history']");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineArchiveList")?.textContent.includes("UI Shared Line parallel line"),
      null,
      { timeout: 15000 }
    );

    // Verify resume packet text
    const resumeText = await page.textContent("#sharedLineResume");
    if (!resumeText.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line resume packet missing current position: ${resumeText}`);
    }

    // Final snapshot assertions
    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        databasePath: snapshot.data.databasePath,
        lineCount: (snapshot.sharedLine?.lines || []).length,
        historyCount: (snapshot.sharedLine?.history || []).length,
        snapshotCount: (snapshot.sharedLine?.snapshots || []).length,
        archivedCount: (snapshot.sharedLine?.archivedLines || []).length,
        currentSummary: snapshot.sharedLine?.currentPosition?.summary || ""
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`Shared Line UI wrote outside product data root: ${result.databasePath}`);
    }
    if (!result.currentSummary.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line snapshot current position mismatch: ${result.currentSummary}`);
    }
    if (result.historyCount < 2) {
      throw new Error(`Shared Line history count too low: ${result.historyCount}`);
    }
    if (result.snapshotCount < 1) {
      throw new Error(`Shared Line snapshot count too low: ${result.snapshotCount}`);
    }
    if (result.archivedCount < 1) {
      throw new Error(`Shared Line archived count too low: ${result.archivedCount}`);
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: result.databasePath,
          lineCount: result.lineCount,
          historyCount: result.historyCount,
          snapshotCount: result.snapshotCount,
          archivedCount: result.archivedCount
        },
        null,
        2
      )
    );
  } catch (error) {
    if (app) await app.close().catch(() => {});
    console.error(error);
    process.exit(1);
  }
}

main();
