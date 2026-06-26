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
    await page.waitForFunction(() => window.ClaraCoreDesktop && document.querySelector("#memorySearchInput"), null, {
      timeout: 15000
    });

    const seeded = await page.evaluate(async () => {
      const visible = await window.ClaraCoreDesktop.createMemory({
        title: "UI Memoria visible fact",
        body: "Memoria UI should prioritize viewing, search, labels, graph, and deletion.",
        labels: "ui, inspect"
      });
      const restricted = await window.ClaraCoreDesktop.createMemory({
        title: "UI Memoria restricted fact",
        body: "Restricted Memoria entries should stay out of normal search.",
        labels: "ui, restricted",
        sensitivity: "restricted"
      });
      await window.ClaraCoreDesktop.createMemory({
        title: "UI Memoria second fact",
        body: "Label filtering should show related visible memories.",
        labels: "inspect"
      });
      return { visible, restricted };
    });
    await page.evaluate(() => refresh());
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memoria visible fact"), null, {
      timeout: 15000
    });

    const writeControls = await page.evaluate(() => ({
      factForm: Boolean(document.querySelector("#saveMemory")),
      recordForm: Boolean(document.querySelector("#saveMemoryRecord")),
      aliasForm: Boolean(document.querySelector("#saveMemoryAlias")),
      maintenanceRun: Boolean(document.querySelector("#runMemoryMaintenance")),
      mergeSection: Boolean(document.querySelector("#memoryMergeList")),
      archiveSuggestionSection: Boolean(document.querySelector("#memoryArchiveList")),
      memoriaTabs: document.querySelectorAll("[data-memory-tab]").length
    }));
    if (
      writeControls.factForm ||
      writeControls.recordForm ||
      writeControls.aliasForm ||
      writeControls.maintenanceRun ||
      writeControls.mergeSection ||
      writeControls.archiveSuggestionSection
    ) {
      throw new Error(`Memoria UI exposed write/maintenance controls: ${JSON.stringify(writeControls)}`);
    }
    if (writeControls.memoriaTabs < 6) {
      throw new Error(`Memoria UI did not render viewing tabs: ${JSON.stringify(writeControls)}`);
    }

    await page.fill("#memorySearchInput", "prioritize viewing");
    await page.click("#searchMemory");
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memoria visible fact"), null, {
      timeout: 15000
    });
    if ((await page.textContent("#memoryList")).includes("UI Memoria restricted fact")) {
      throw new Error("Memoria UI normal search showed restricted memory.");
    }

    await page.click("[data-memory-tab='labels']");
    await page.waitForFunction(() => document.querySelector("#memoryAllLabelList")?.textContent.includes("inspect"), null, {
      timeout: 15000
    });
    await page.click("[data-memory-label='inspect']");
    await page.waitForFunction(() => document.querySelector("#memorySearchInput")?.value === "inspect", null, {
      timeout: 15000
    });
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memoria second fact"), null, {
      timeout: 15000
    });

    await page.click("[data-memory-tab='graph']");
    await page.waitForSelector("#memoryGraphCanvas", { timeout: 15000 });
    await page.waitForFunction(
      () => Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0) > 0,
      null,
      { timeout: 15000 }
    );
    const graphControls = await page.evaluate(() => ({
      zoomControls: document.querySelectorAll("#memoryGraph [data-graph-zoom]").length,
      layerControls: document.querySelectorAll("#memoryGraph [data-graph-layer]").length,
      initialZoom: document.querySelector("#memoryGraphCanvas")?.dataset.zoom,
      initialPanX: document.querySelector("#memoryGraphCanvas")?.dataset.panX,
      initialNodeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0),
      initialEdgeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0)
    }));
    await page.click("#memoryGraph [data-graph-zoom='in']");
    await page.waitForFunction(() => document.querySelector("#memoryGraphCanvas")?.dataset.zoom !== "1", null, { timeout: 15000 });
    const zoomedValue = await page.locator("#memoryGraphCanvas").getAttribute("data-zoom");
    await page.click("#memoryGraph [data-graph-zoom='fit']");
    await page.waitForFunction(() => document.querySelector("#memoryGraphCanvas")?.dataset.zoom === "1", null, { timeout: 15000 });
    const fitValue = await page.locator("#memoryGraphCanvas").getAttribute("data-zoom");
    await page.locator("#memoryGraph .graph-canvas").hover();
    await page.mouse.wheel(0, -120);
    await page.waitForFunction(() => document.querySelector("#memoryGraphCanvas")?.dataset.zoom !== "1", null, { timeout: 15000 });
    const wheelZoomedValue = await page.locator("#memoryGraphCanvas").getAttribute("data-zoom");
    const canvasBox = await page.locator("#memoryGraphCanvas").boundingBox();
    await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + 150, canvasBox.y + 130);
    await page.mouse.up();
    const draggedPanX = await page.locator("#memoryGraphCanvas").getAttribute("data-pan-x");
    await page.click("#memoryGraph [data-graph-zoom='fit']");
    if (
      graphControls.zoomControls !== 3 ||
      graphControls.layerControls !== 2 ||
      graphControls.initialNodeCount < 1 ||
      graphControls.initialEdgeCount < 1 ||
      zoomedValue === graphControls.initialZoom ||
      wheelZoomedValue === fitValue ||
      draggedPanX === graphControls.initialPanX
    ) {
      throw new Error(`Memoria UI graph canvas controls failed: ${JSON.stringify({ graphControls, zoomedValue, fitValue, wheelZoomedValue, draggedPanX })}`);
    }
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.click("#memoryGraph [data-graph-layer='restricted']");
    const restrictedGraphCancelled = await page.evaluate(() =>
      document.querySelector("#memoryGraph [data-graph-layer='restricted']")?.classList.contains("active")
    );
    if (restrictedGraphCancelled) {
      throw new Error("Memoria UI entered restricted graph layer after cancelled confirmation.");
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("#memoryGraph [data-graph-layer='restricted']");
    await page.waitForFunction(() => document.querySelector("#memoryGraph [data-graph-layer='restricted']")?.classList.contains("active"), null, {
      timeout: 15000
    });
    const restrictedGraphHasRestrictedNode = await page.evaluate(() => Number(document.querySelector("#memoryGraphCanvas")?.dataset.restrictedCount || 0) > 0);
    if (!restrictedGraphHasRestrictedNode) {
      throw new Error("Memoria UI restricted graph layer did not render restricted nodes.");
    }

    page.once("dialog", (dialog) => dialog.dismiss());
    await page.click("[data-memory-tab='restricted']");
    const restrictedCancelled = await page.evaluate(() => ({
      activeRestrictedTab: document.querySelector("[data-memory-tab='restricted']")?.classList.contains("active"),
      activeRestrictedPanel: document.querySelector("[data-memory-panel='restricted']")?.classList.contains("active")
    }));
    if (restrictedCancelled.activeRestrictedTab || restrictedCancelled.activeRestrictedPanel) {
      throw new Error(`Memoria UI entered restricted view after cancelled confirmation: ${JSON.stringify(restrictedCancelled)}`);
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("[data-memory-tab='restricted']");
    await page.waitForFunction(() => document.querySelector("#restrictedMemoryList")?.textContent.includes("UI Memoria restricted fact"), null, {
      timeout: 15000
    });
    const restrictedText = await page.textContent("#restrictedMemoryList");
    if (!restrictedText.includes("UI Memoria restricted fact")) {
      throw new Error("Memoria UI restricted list did not show restricted memory.");
    }

    await page.click("[data-memory-tab='search']");
    page.once("dialog", (dialog) => dialog.accept());
    await page.click(`[data-memory-action='delete'][data-memory-id='${seeded.visible.id}']`);
    await page.waitForFunction(() => document.querySelector("#memoryDeletedCount")?.textContent === "1", null, {
      timeout: 15000
    });
    await page.click("[data-memory-tab='archive']");
    await page.waitForFunction(
      (title) => document.querySelector("#deletedMemoryList")?.textContent.includes(title),
      "UI Memoria visible fact",
      { timeout: 15000 }
    );

    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        databasePath: snapshot.data.databasePath,
        activeCount: snapshot.memoryStats.activeCount,
        deletedCount: snapshot.memoryStats.deletedCount,
        restrictedCount: snapshot.memoryStats.restrictedCount,
        labels: snapshot.memoryStats.labels,
        activeText: document.querySelector("#memoryList").textContent,
        deletedText: document.querySelector("#deletedMemoryList").textContent,
        restrictedText: document.querySelector("#restrictedMemoryList").textContent,
        graphText: document.querySelector("#memoryGraph").textContent,
        graphEdgeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0),
        graphNodeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0),
        activeCounter: document.querySelector("#memoryActiveCount").textContent,
        deletedCounter: document.querySelector("#memoryDeletedCount").textContent
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`Memoria UI wrote outside product data root: ${result.databasePath}`);
    }
    if (result.activeCount !== 1 || result.deletedCount !== 1 || result.restrictedCount !== 1) {
      throw new Error(`Memoria UI counts mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.labels.some((item) => item.label === "inspect" && item.count === 1)) {
      throw new Error(`Memoria UI label stats mismatch: ${JSON.stringify(result.labels)}`);
    }
    if (!result.deletedText.includes("UI Memoria visible fact")) {
      throw new Error("Memoria UI deleted list did not include deleted memory.");
    }
    if (result.graphEdgeCount < 1 || result.graphNodeCount < 1) {
      throw new Error(`Memoria UI graph did not render expected label relation: ${JSON.stringify(result)}`);
    }
    if (result.activeCounter !== "1" || result.deletedCounter !== "1") {
      throw new Error(`Memoria UI counter text mismatch: ${JSON.stringify(result)}`);
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
          restrictedCount: result.restrictedCount
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
