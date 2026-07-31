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
    await page.waitForFunction(() => window.ClaraCoreTestHooks?.homeVision && document.querySelector("#homePresenceEmptyAction")?.hidden === false, null, { timeout: 15000 });

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
          presenceAgents: document.querySelectorAll("#homePresenceAgents .home-presence-agent").length,
          emptyActionVisible: document.querySelector("#homePresenceEmptyAction")?.hidden === false,
          focusBlockPresent: Boolean(document.querySelector("#homeView > .page-focus")),
          healthTone: document.querySelector("#topbarHealthIcon")?.className || "",
          scheduler: window.ClaraCoreTestHooks.homeVision()
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
      result.homeTruth.presenceAgents !== 0 ||
      !result.homeTruth.emptyActionVisible ||
      result.homeTruth.focusBlockPresent ||
      !result.homeTruth.healthTone.includes("ok-dot") ||
      result.homeTruth.scheduler.agentCount !== 0
    ) {
      throw new Error(`Fresh-install Home truth is inconsistent: ${JSON.stringify(result.homeTruth)}`);
    }

    const scopedRefresh = await page.evaluate(async () => {
      const hooks = window.ClaraCoreTestHooks;
      const state = () => hooks.runtimeRefreshState();
      const detailReads = (viewName) => Number(state().detailReads?.[viewName] || 0);
      const waitFor = async (predicate, label, timeoutMs = 8000) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          if (predicate()) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(state())}`);
      };
      const openView = async (viewName) => {
        document.querySelector(`[data-view='${viewName}']`)?.click();
        await waitFor(() => state().hydratedViews.includes(viewName), `${viewName} hydration`);
      };

      await waitFor(() => state().hydratedViews.includes("home"), "initial Home hydration");
      await openView("trace");
      await openView("innerlife");
      await openView("memory");
      await openView("agent-setup");
      await openView("memory");

      const beforeInnerLife = state();
      const memoryListBefore = document.querySelector("#memoryList")?.innerHTML || "";
      hooks.handleRuntimeChanged({ scopes: ["snapshot", "innerlife"] });
      await waitFor(
        () => state().runtimeRefreshCompletedRevision > beforeInnerLife.runtimeRefreshCompletedRevision,
        "InnerLife scoped refresh"
      );
      await waitFor(() => state().hydratedViews.includes("memory"), "unrelated Memory preservation");
      const afterInnerLife = state();

      await openView("innerlife");
      await openView("trace");
      await openView("memory");
      const beforeData = state();
      hooks.handleRuntimeChanged({ scopes: ["snapshot", "data"] });
      await waitFor(
        () => state().runtimeRefreshCompletedRevision > beforeData.runtimeRefreshCompletedRevision,
        "Data scoped refresh"
      );
      await waitFor(() => state().hydratedViews.includes("memory"), "Memory preservation after Data refresh");
      const afterData = state();

      return {
        activeView: document.querySelector(".active-view")?.id,
        memoryListPreserved: (document.querySelector("#memoryList")?.innerHTML || "") === memoryListBefore,
        localOnlyReads: {
          memory: detailReads("memory"),
          agentSetup: detailReads("agent-setup")
        },
        innerLifeInvalidation: {
          beforeInnerLifeReads: Number(beforeInnerLife.detailReads?.innerlife || 0),
          afterHiddenRefreshReads: Number(afterInnerLife.detailReads?.innerlife || 0),
          afterReopenReads: Number(beforeData.detailReads?.innerlife || 0)
        },
        traceInvalidation: {
          beforeInnerLifeReads: Number(beforeInnerLife.detailReads?.trace || 0),
          afterHiddenRefreshReads: Number(afterInnerLife.detailReads?.trace || 0),
          afterReopenReads: Number(beforeData.detailReads?.trace || 0)
        },
        dataPreservation: {
          before: beforeData.detailReads,
          after: afterData.detailReads,
          hydratedViews: afterData.hydratedViews
        },
        snapshotShape: afterData.snapshotShape
      };
    });
    if (scopedRefresh.activeView !== "memoryView" || !scopedRefresh.memoryListPreserved) {
      throw new Error(`Scoped runtime refresh disturbed an unrelated view: ${JSON.stringify(scopedRefresh)}`);
    }
    if (scopedRefresh.localOnlyReads.memory !== 0 || scopedRefresh.localOnlyReads.agentSetup !== 0) {
      throw new Error(`Local-only views issued empty detail IPC: ${JSON.stringify(scopedRefresh)}`);
    }
    if (
      scopedRefresh.innerLifeInvalidation.afterHiddenRefreshReads !== scopedRefresh.innerLifeInvalidation.beforeInnerLifeReads ||
      scopedRefresh.innerLifeInvalidation.afterReopenReads !== scopedRefresh.innerLifeInvalidation.beforeInnerLifeReads + 1 ||
      scopedRefresh.traceInvalidation.afterHiddenRefreshReads !== scopedRefresh.traceInvalidation.beforeInnerLifeReads ||
      scopedRefresh.traceInvalidation.afterReopenReads !== scopedRefresh.traceInvalidation.beforeInnerLifeReads + 1
    ) {
      throw new Error(`Scoped dependent views did not invalidate lazily: ${JSON.stringify(scopedRefresh)}`);
    }
    if (
      JSON.stringify(scopedRefresh.dataPreservation.before) !== JSON.stringify(scopedRefresh.dataPreservation.after) ||
      !["memory", "innerlife", "trace", "agent-setup"].every((viewName) =>
        scopedRefresh.dataPreservation.hydratedViews.includes(viewName)
      )
    ) {
      throw new Error(`Data scope invalidated an unrelated hydrated view: ${JSON.stringify(scopedRefresh)}`);
    }
    if (
      scopedRefresh.snapshotShape.hasMemories ||
      !scopedRefresh.snapshotShape.hasRecentMemories ||
      !scopedRefresh.snapshotShape.hasInnerLifeInbox ||
      scopedRefresh.snapshotShape.hasInnerLifePendingInbox
    ) {
      throw new Error(`Overview snapshot shape regressed: ${JSON.stringify(scopedRefresh.snapshotShape)}`);
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
