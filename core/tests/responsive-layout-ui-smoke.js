const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-responsive-layout-ui-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const screenshotRoot = process.env.CLARACORE_UI_SCREENSHOT_DIR || "";
  if (screenshotRoot) await fs.mkdir(screenshotRoot, { recursive: true });
  let app;

  function assertInsideViewport(surface, item) {
    if (item.left < -1 || item.right > item.viewportWidth + 1) {
      throw new Error(`${surface} extends outside the viewport: ${JSON.stringify(item)}`);
    }
  }

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
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    await page.waitForSelector("[data-view='memory']", { timeout: 15000 });

    await page.setViewportSize({ width: 1440, height: 960 });
    const desktopAgentBars = [];
    for (const view of ["memory", "shared-line", "innerlife"]) {
      await page.click(`[data-view='${view}']`);
      const contract = await page.evaluate((viewName) => {
        const activeView = document.querySelector(".view.active-view");
        const pageSurface = activeView?.firstElementChild;
        const header = activeView?.querySelector(".module-page-heading");
        const bar = activeView?.querySelector(".module-agent-bar");
        const select = bar?.querySelector("select");
        const pageRect = pageSurface?.getBoundingClientRect();
        const barRect = bar?.getBoundingClientRect();
        const selectRect = select?.getBoundingClientRect();
        return {
          view: viewName,
          followsHeader: header?.nextElementSibling === bar,
          label: bar?.querySelector(".module-agent-filter > span")?.textContent || "",
          relativeTop: pageRect && barRect ? barRect.top - pageRect.top : null,
          left: barRect?.left,
          right: barRect?.right,
          selectHeight: selectRect?.height,
          selectRadius: select ? getComputedStyle(select).borderRadius : "",
          columns: bar ? getComputedStyle(bar).gridTemplateColumns : "",
          viewportWidth: innerWidth
        };
      }, view);
      desktopAgentBars.push(contract);
      assertInsideViewport(`${view} agent scope`, contract);
      if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, `desktop-${view}-agent-scope.png`), fullPage: false });
    }
    const desktopAgentBaseline = desktopAgentBars[0];
    for (const contract of desktopAgentBars) {
      if (
        !contract.followsHeader ||
        contract.label !== "智能体" ||
        Math.abs(contract.relativeTop - desktopAgentBaseline.relativeTop) > 1 ||
        Math.abs(contract.left - desktopAgentBaseline.left) > 1 ||
        Math.abs(contract.right - desktopAgentBaseline.right) > 1 ||
        Math.abs(contract.selectHeight - desktopAgentBaseline.selectHeight) > 1 ||
        contract.selectRadius !== desktopAgentBaseline.selectRadius ||
        contract.columns.trim().split(/\s+/).length !== 2
      ) {
        throw new Error(`Core module Agent scope bars are inconsistent: ${JSON.stringify(desktopAgentBars)}`);
      }
    }

    await page.click("[data-view='memory']");
    const desktopMemory = await page.evaluate(() => {
      const overview = document.querySelector(".memory-overview").getBoundingClientRect();
      const process = document.querySelector(".memory-process-flow");
      return {
        left: overview.left,
        right: overview.right,
        viewportWidth: innerWidth,
        processColumns: getComputedStyle(process).gridTemplateColumns
      };
    });
    assertInsideViewport("Desktop Memory", desktopMemory);
    if (desktopMemory.processColumns.split(" ").length !== 5) {
      throw new Error(`Desktop Memory should show the five recall steps in one row: ${desktopMemory.processColumns}`);
    }
    if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, "desktop-memory.png"), fullPage: false });

    await page.setViewportSize({ width: 1180, height: 820 });
    await page.click("[data-view='shared-line']");
    const mediumSharedLine = await page.evaluate(() => {
      const layout = document.querySelector(".shared-line-layout");
      const detail = document.querySelector(".shared-line-detail-panel").getBoundingClientRect();
      return {
        columns: getComputedStyle(layout).gridTemplateColumns,
        left: detail.left,
        right: detail.right,
        viewportWidth: innerWidth
      };
    });
    assertInsideViewport("Medium Shared Line", mediumSharedLine);
    if (mediumSharedLine.columns.includes(" ")) {
      throw new Error(`Shared Line should use one column at medium width: ${mediumSharedLine.columns}`);
    }
    const darkSharedLineCounts = await page.evaluate(() => {
      document.body.dataset.theme = "dark";
      const card = document.querySelector(".shared-line-overview-counts p");
      const value = document.querySelector(".shared-line-overview-counts strong");
      return {
        background: getComputedStyle(card).backgroundColor,
        valueColor: getComputedStyle(value).color
      };
    });
    const darkBackgroundChannels = (darkSharedLineCounts.background.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    if (!darkBackgroundChannels.length || Math.max(...darkBackgroundChannels) > 90) {
      throw new Error(`Shared Line dark overview count card stayed light: ${JSON.stringify(darkSharedLineCounts)}`);
    }
    if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, "medium-shared-line-dark.png"), fullPage: false });
    await page.evaluate(() => { document.body.dataset.theme = "light"; });

    await page.setViewportSize({ width: 900, height: 760 });
    await page.click("[data-view='memory']");
    const memoryRects = await page.evaluate(() =>
      [".memory-overview", ".memory-toolbar", ".memory-process-section", ".memory-recall-section", ".memory-knowledge-actions"].map((selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right, viewportWidth: innerWidth };
      })
    );
    memoryRects.forEach((item) => assertInsideViewport("Memory", item));
    const narrowProcessColumns = await page.locator(".memory-process-flow").evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    if (narrowProcessColumns.includes(" ")) {
      throw new Error(`Narrow Memory should stack the five recall steps: ${narrowProcessColumns}`);
    }
    if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, "narrow-memory.png"), fullPage: false });

    await page.click("[data-view='shared-line']");
    const sharedLineRects = await page.evaluate(() =>
      [".shared-line-list-panel", ".shared-line-detail-panel"].map((selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right, viewportWidth: innerWidth };
      })
    );
    sharedLineRects.forEach((item) => assertInsideViewport("Shared Line", item));
    if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, "narrow-shared-line.png"), fullPage: false });

    await page.click("[data-view='settings']");
    await page.click("[data-settings-tab='app-data']");
    await page.evaluate(() => { document.querySelector("#dataRecoveryDetails").open = true; });
    const dataGroupRects = await page.locator(".data-action-group").evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right, viewportWidth: innerWidth };
      })
    );
    dataGroupRects.forEach((item) => assertInsideViewport("Data recovery", item));
    if (dataGroupRects.length !== 2 || dataGroupRects[1].top <= dataGroupRects[0].top) {
      throw new Error(`Data recovery actions do not stack at medium width: ${JSON.stringify(dataGroupRects)}`);
    }
    if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, "narrow-data-recovery.png"), fullPage: false });

    await page.setViewportSize({ width: 620, height: 900 });
    for (const view of ["memory", "shared-line", "innerlife"]) {
      await page.click(`[data-view='${view}']`);
      const narrowAgentBar = await page.evaluate(() => {
        const bar = document.querySelector(".view.active-view .module-agent-bar");
        const select = bar?.querySelector("select");
        const barRect = bar?.getBoundingClientRect();
        const selectRect = select?.getBoundingClientRect();
        return {
          columns: bar ? getComputedStyle(bar).gridTemplateColumns : "",
          left: barRect?.left,
          right: barRect?.right,
          selectLeft: selectRect?.left,
          selectRight: selectRect?.right,
          viewportWidth: innerWidth
        };
      });
      assertInsideViewport(`${view} narrow agent scope`, narrowAgentBar);
      if (
        narrowAgentBar.columns.trim().split(/\s+/).length !== 1 ||
        narrowAgentBar.selectLeft < narrowAgentBar.left ||
        narrowAgentBar.selectRight > narrowAgentBar.right
      ) {
        throw new Error(`${view} Agent scope did not stack cleanly: ${JSON.stringify(narrowAgentBar)}`);
      }
    }

    if (consoleErrors.length) throw new Error(`Responsive layout emitted console errors: ${consoleErrors.join(" | ")}`);
    await app.close();
    console.log(JSON.stringify({ ok: true, viewports: ["1440x960", "1180x820", "900x760", "620x900"], coreModuleAgentScopeUnified: true, consoleErrors: 0 }, null, 2));
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
