const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-shell-window-"));
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
    await page.waitForSelector("#homeView > .page-focus", { timeout: 15000 });

    const result = await page.evaluate(async () => {
      const shellState = await window.ClaraCoreDesktop.getShellState();
      const bodyRegion = getComputedStyle(document.body).webkitAppRegion;
      const topbarRegion = getComputedStyle(document.querySelector(".topbar")).webkitAppRegion;
      const sidebarRegion = getComputedStyle(document.querySelector(".sidebar")).webkitAppRegion;
      const navRegion = getComputedStyle(document.querySelector("nav")).webkitAppRegion;
      return {
        title: document.title,
        shellState,
        bodyRegion,
        topbarRegion,
        sidebarRegion,
        navRegion,
        homeTruth: {
          attentionItems: document.querySelectorAll("#homeAttentionList .attention-item").length,
          focusTone: document.querySelector("#homeView > .page-focus")?.className || "",
          healthTone: document.querySelector("#topbarHealthIcon")?.className || "",
          runtimeExpanded: Boolean(document.querySelector("#homeRuntimeDetails")?.open)
        },
        text: document.body.textContent
      };
    });

    if (result.title !== "ClaraCore Desktop" || !result.text.includes("ClaraCore")) {
      throw new Error(`Shell window did not render the expected app: ${JSON.stringify(result)}`);
    }
    if (!result.shellState.hasTray || !result.shellState.windowVisible) {
      throw new Error(`Shell state missing tray or visible window: ${JSON.stringify(result.shellState)}`);
    }
    if (process.platform === "darwin" && result.shellState.trayTitle) {
      throw new Error(`macOS tray should use the icon asset without title text: ${JSON.stringify(result.shellState)}`);
    }
    if (process.platform === "darwin" && Number(result.shellState.trayBounds?.width || 0) > 36) {
      throw new Error(`macOS tray is wider than an icon-only status item: ${JSON.stringify(result.shellState)}`);
    }
    if (process.platform === "darwin" && result.shellState.dockVisible !== true) {
      throw new Error(`macOS dock should be visible while the main window is visible: ${JSON.stringify(result.shellState)}`);
    }
    if (result.bodyRegion !== "drag" || result.topbarRegion !== "drag" || result.sidebarRegion !== "drag") {
      throw new Error(`Shell drag regions are not enabled: ${JSON.stringify(result)}`);
    }
    if (result.navRegion !== "no-drag") {
      throw new Error(`Interactive controls are not excluded from drag regions: ${JSON.stringify(result)}`);
    }
    if (
      result.homeTruth.attentionItems !== 0 ||
      !result.homeTruth.focusTone.includes("ok") ||
      !result.homeTruth.healthTone.includes("ok-dot") ||
      result.homeTruth.runtimeExpanded
    ) {
      throw new Error(`Fresh-install Home truth is inconsistent: ${JSON.stringify(result.homeTruth)}`);
    }

    const scopedRefresh = await page.evaluate(async () => {
      document.querySelector("[data-view='innerlife']")?.click();
      const memoryListBefore = document.querySelector("#memoryList")?.innerHTML || "";
      window.ClaraCoreTestHooks.handleRuntimeChanged({ scopes: ["snapshot", "innerlife"] });
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        activeView: document.querySelector(".active-view")?.id,
        memoryListPreserved: (document.querySelector("#memoryList")?.innerHTML || "") === memoryListBefore
      };
    });
    if (scopedRefresh.activeView !== "innerlifeView" || !scopedRefresh.memoryListPreserved) {
      throw new Error(`Scoped runtime refresh disturbed an unrelated view: ${JSON.stringify(scopedRefresh)}`);
    }

    const hiddenState = await app.evaluate(async ({ BrowserWindow, app: electronApp }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.close();
      await new Promise((resolve) => setTimeout(resolve, 200));
      return {
        dockVisible: process.platform === "darwin" && electronApp.dock && typeof electronApp.dock.isVisible === "function"
          ? electronApp.dock.isVisible()
          : null,
        windowVisible: window.isVisible()
      };
    });
    if (hiddenState.windowVisible) {
      throw new Error(`Close should hide the main window: ${JSON.stringify(hiddenState)}`);
    }
    if (process.platform === "darwin" && hiddenState.dockVisible !== false) {
      throw new Error(`Close-to-tray should hide the macOS dock icon: ${JSON.stringify(hiddenState)}`);
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          trayBounds: result.shellState.trayBounds,
          trayTitle: result.shellState.trayTitle,
          dragRegions: {
            body: result.bodyRegion,
            topbar: result.topbarRegion,
            sidebar: result.sidebarRegion,
            nav: result.navRegion
          }
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
