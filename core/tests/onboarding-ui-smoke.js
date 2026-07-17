const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const appRoot = path.resolve(__dirname, "..", "..");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-empty-home-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: appRoot,
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot,
        CLARACORE_DESKTOP_USER_DATA_DIR: userDataRoot,
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    await page.waitForFunction(
      () => window.ClaraCoreTestHooks?.homeVision && document.querySelector("#homePresenceEmptyAction")?.hidden === false,
      null,
      { timeout: 15000 }
    );
    const emptyState = await page.evaluate(() => ({
      agentCount: document.querySelectorAll("#homePresenceAgents .home-presence-agent").length,
      emptyActionHidden: document.querySelector("#homePresenceEmptyAction")?.hidden,
      title: document.querySelector("#homePresenceTitle")?.textContent || "",
      checklistPresent: Boolean(document.querySelector("#homeOnboarding")),
      legacyDashboardPresent: Boolean(document.querySelector("#homeRuntimeDetails, .home-command-grid")),
      vision: window.ClaraCoreTestHooks.homeVision()
    }));
    if (
      emptyState.agentCount !== 0 ||
      emptyState.emptyActionHidden ||
      emptyState.checklistPresent ||
      emptyState.legacyDashboardPresent ||
      emptyState.vision.agentCount !== 0 ||
      emptyState.vision.particleCount !== 0 ||
      emptyState.vision.horizonLayers !== 3 ||
      emptyState.vision.visualMode !== "shared-horizon" ||
      emptyState.vision.atmosphereCachePixels !== 0
    ) {
      throw new Error(`Empty Home rendered incorrectly: ${JSON.stringify(emptyState)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH });
    }
    await page.click("#homePresenceEmptyAction");
    await page.waitForFunction(() => document.querySelector("#agentSetupView")?.classList.contains("active-view"));
    console.log(JSON.stringify({ ok: true, emptyState }, null, 2));
  } finally {
    if (app) await app.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
