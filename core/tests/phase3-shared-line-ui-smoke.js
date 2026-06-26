const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase3-shared-line-ui-"));
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
    await page.waitForSelector("[data-view='shared-line']", { timeout: 15000 });
    await page.click("[data-view='shared-line']");
    await page.waitForSelector("#sharedLineInput", { timeout: 15000 });
    await page.waitForFunction(
      async () => {
        if (!window.ClaraCoreDesktop) return false;
        const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
        return Boolean(snapshot?.data?.databasePath && document.querySelector("#saveSharedLine") && !document.querySelector("#saveSharedLine").disabled);
      },
      null,
      { timeout: 15000 }
    );

    await page.fill("#sharedLineInput", "UI Shared Line first checkpoint for history.");
    await page.click("#saveSharedLine");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineHistoryList")?.textContent.includes("UI Shared Line first checkpoint"),
      null,
      { timeout: 15000 }
    );
    await page.evaluate(async () => {
      await window.ClaraCoreDesktop.saveSharedLine({
        summary: "UI Shared Line confirmed checkpoint for overwrite confirmation.",
        interpretationStatus: "confirmed"
      });
    });
    await page.click("#refreshButton");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("UI Shared Line confirmed checkpoint"),
      null,
      { timeout: 15000 }
    );

    await page.fill("#sharedLineInput", "UI Shared Line second checkpoint for resume packet.");
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#saveSharedLine");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineHistoryList")?.textContent.includes("UI Shared Line second checkpoint"),
      null,
      { timeout: 15000 }
    );
    await page.click("#createSharedLineHandoff");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineHandoffList")?.textContent.includes("UI Shared Line second checkpoint"),
      null,
      { timeout: 15000 }
    );
    await page.fill("#sharedLineTitleInput", "UI Shared Line parallel line");
    await page.click("#createSharedLine");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineList")?.textContent.includes("UI Shared Line parallel line"),
      null,
      { timeout: 15000 }
    );
    await page.fill("#sharedLineInput", "UI Shared Line parallel checkpoint.");
    await page.click("#saveSharedLine");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("UI Shared Line parallel checkpoint"),
      null,
      { timeout: 15000 }
    );
    await page.locator("[data-shared-line-action='rename']").first().click();
    await page.fill("#sharedLineTitleInput", "UI Shared Line renamed parallel line");
    await page.click("#createSharedLine");
    await page.waitForFunction(
      () => document.querySelector("#sharedLineList")?.textContent.includes("UI Shared Line renamed parallel line"),
      null,
      { timeout: 15000 }
    );
    await page.locator("[data-shared-line-action='activate']").first().click();
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("UI Shared Line second checkpoint"),
      null,
      { timeout: 15000 }
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("[data-shared-line-action='archive']").first().click();
    await page.waitForFunction(
      () => document.querySelector("#sharedLineList")?.textContent.includes("archived"),
      null,
      { timeout: 15000 }
    );
    await page.locator("[data-shared-line-action='restore']").first().click();
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("UI Shared Line parallel checkpoint"),
      null,
      { timeout: 15000 }
    );
    await page.locator("[data-shared-line-action='activate']").first().click();
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("UI Shared Line second checkpoint"),
      null,
      { timeout: 15000 }
    );

    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        current: document.querySelector("#sharedLineSummary").textContent,
        historyText: document.querySelector("#sharedLineHistoryList").textContent,
        handoffText: document.querySelector("#sharedLineHandoffList").textContent,
        snapshotText: document.querySelector("#sharedLineSnapshotList").textContent,
        resumeText: document.querySelector("#sharedLineResume").textContent,
        databasePath: snapshot.data.databasePath,
        lineCount: snapshot.sharedLine.lines.length,
        lineText: document.querySelector("#sharedLineList").textContent,
        historyCount: snapshot.sharedLine.history.length,
        snapshotCount: snapshot.sharedLine.snapshots.length,
        handoffCount: snapshot.sharedLine.handoffs.length
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`Shared Line UI wrote outside product data root: ${result.databasePath}`);
    }
    if (!result.current.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line UI current position did not refresh: ${result.current}`);
    }
    if (result.lineCount < 2 || !result.lineText.includes("UI Shared Line parallel checkpoint") || !result.lineText.includes("UI Shared Line renamed parallel line")) {
      throw new Error(`Shared Line UI line list missing parallel line: ${result.lineText}`);
    }
    if (!result.historyText.includes("UI Shared Line first checkpoint") || !result.historyText.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line UI history missing expected rows: ${result.historyText}`);
    }
    if (!result.snapshotText.includes("confirmed_overwrite")) {
      throw new Error(`Shared Line UI snapshot list missing confirmed overwrite: ${result.snapshotText}`);
    }
    if (!result.resumeText.includes("Recent history:") || !result.resumeText.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line UI resume packet missing history: ${result.resumeText}`);
    }
    if (!result.handoffText.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line UI handoff list missing expected row: ${result.handoffText}`);
    }
    if (!result.resumeText.includes("Recent handoffs:") || !result.resumeText.includes("UI Shared Line second checkpoint")) {
      throw new Error(`Shared Line UI resume packet missing handoff: ${result.resumeText}`);
    }
    if (result.historyCount !== 3) {
      throw new Error(`Shared Line snapshot history count mismatch: ${result.historyCount}`);
    }
    if (result.snapshotCount !== 3) {
      throw new Error(`Shared Line snapshot count mismatch: ${result.snapshotCount}`);
    }
    if (result.handoffCount !== 1) {
      throw new Error(`Shared Line snapshot handoff count mismatch: ${result.handoffCount}`);
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
          handoffCount: result.handoffCount
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
