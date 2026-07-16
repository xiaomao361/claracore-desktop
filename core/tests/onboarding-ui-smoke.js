const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-onboarding-"));
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
    await page.waitForSelector(".topbar", { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("#homeOnboarding") && !document.querySelector("#homeOnboarding").hidden, null, { timeout: 15000 });

    const emptyState = await page.evaluate(() => ({
      loadHidden: document.querySelector("#loadDemoData")?.hidden,
      clearHidden: document.querySelector("#clearDemoData")?.hidden,
      steps: document.querySelectorAll("[data-onboarding-step]").length
    }));
    if (emptyState.loadHidden || !emptyState.clearHidden || emptyState.steps !== 2) {
      throw new Error(`Empty-state onboarding rendered incorrectly: ${JSON.stringify(emptyState)}`);
    }

    await page.click("#loadDemoData");
    await page.waitForFunction(() => !document.querySelector("#clearDemoData")?.hidden, null, { timeout: 30000 });

    const seededState = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        onboardingHidden: document.querySelector("#homeOnboarding")?.hidden,
        loadHidden: document.querySelector("#loadDemoData")?.hidden,
        memories: snapshot.memoryStats?.activeCount ?? 0,
        traces: (snapshot.gatewayTraces || []).length,
        notice: document.querySelector("#demoDataNotice")?.textContent || ""
      };
    });
    if (seededState.onboardingHidden || !seededState.loadHidden || seededState.memories < 3 || seededState.traces < 4 || !seededState.notice) {
      throw new Error(`Demo seed did not render expected state: ${JSON.stringify(seededState)}`);
    }

    await page.click("#clearDemoData");
    await page.waitForFunction(() => !document.querySelector("#loadDemoData")?.hidden, null, { timeout: 30000 });

    const clearedState = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        onboardingHidden: document.querySelector("#homeOnboarding")?.hidden,
        clearHidden: document.querySelector("#clearDemoData")?.hidden,
        memories: snapshot.memoryStats?.activeCount ?? 0,
        traces: (snapshot.gatewayTraces || []).length
      };
    });
    if (clearedState.onboardingHidden || !clearedState.clearHidden || clearedState.memories !== 0 || clearedState.traces !== 0) {
      throw new Error(`Demo clear did not restore empty onboarding state: ${JSON.stringify(clearedState)}`);
    }

    console.log(JSON.stringify({ ok: true, emptyState, seededState: { memories: seededState.memories, traces: seededState.traces }, clearedState: { memories: clearedState.memories } }, null, 2));
  } finally {
    if (app) await app.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
