const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-backup-list-ui-"));
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
    await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
    await page.click("[data-view='settings']");
    await page.click("[data-settings-tab='advanced']");
    await page.evaluate(() => { document.querySelector("#advancedDataRecoveryDetails").open = true; });

    for (let expectedBackups = 1; expectedBackups <= 4; expectedBackups += 1) {
      await page.click("#exportBackup");
      await page.waitForFunction(
        (expected) => window.ClaraCoreDesktop
          .getViewSnapshot("settings")
          .then((snapshot) => snapshot.backups.length >= expected),
        expectedBackups,
        { timeout: 15000 }
      );
    }

    if ((await page.locator(".backup-item").count()) !== 3) {
      throw new Error("Recent backups should stay collapsed to three rows.");
    }
    if (!(await page.locator("#backupListToggle").isVisible())) {
      throw new Error("Backup list toggle is not visible when more than three backups exist.");
    }
    await page.click("#backupListToggle");
    if ((await page.locator(".backup-item").count()) !== 4) {
      throw new Error("Expanded backup list does not show all backups.");
    }
    if (!(await page.locator("#backupList").evaluate((element) => element.classList.contains("expanded")))) {
      throw new Error("Expanded backup list does not enable its bounded scroll state.");
    }
    await page.click("#backupListToggle");
    if ((await page.locator(".backup-item").count()) !== 3) {
      throw new Error("Backup list does not collapse back to three rows.");
    }
    if (process.env.CLARACORE_UI_SCREENSHOT) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT, fullPage: true });
    }

    await app.close();
    console.log(JSON.stringify({ ok: true, backups: 4, collapsedRows: 3 }, null, 2));
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
