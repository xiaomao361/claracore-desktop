const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase2-memory-ui-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  let app;
  try {
    process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
    const runtimeApp = {
      getPath(name) {
        return path.join(dataRoot, name);
      },
      isPackaged: false
    };
    const historicalResidence = await runtime.createProductMemory(runtimeApp, {
      title: "Residence before the move",
      body: "The user lived in Shanghai before July 2026.",
      labels: "state-chain"
    });
    const currentResidence = await runtime.createProductMemory(runtimeApp, {
      title: "Current residence",
      body: "The user lives in Hangzhou from July 2026.",
      labels: "state-chain"
    });
    const restrictedMemory = await runtime.createProductMemory(runtimeApp, {
      title: "UI Memoria restricted fact",
      body: "Restricted Memoria entries should stay out of normal search.",
      labels: "ui, restricted",
      sensitivity: "restricted"
    });
    const { database } = await runtime.ensureProductCore(runtimeApp);
    await database.supersedeMemory({
      currentMemoryId: currentResidence.id,
      historicalMemoryId: historicalResidence.id,
      note: "The confirmed residence changed in July 2026."
    });
    await database.createMemoryLink({
      fromMemoryId: currentResidence.id,
      toMemoryId: restrictedMemory.id,
      kind: "related",
      note: "Restricted-layer graph coverage."
    });

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
    const rendererErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") rendererErrors.push(message.text());
    });
    page.on("pageerror", (error) => rendererErrors.push(error.message));
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
      await window.ClaraCoreDesktop.createMemory({
        title: "UI Memoria second fact",
        body: "Label filtering should show related visible memories.",
        labels: "inspect"
      });
      await window.ClaraCoreDesktop.createMemory({
        title: "UI Memoria Clara agent fact",
        body: "Agent filter should search Clara-owned memories.",
        labels: "agent-filter",
        agentId: "claude-code:clara"
      });
      await window.ClaraCoreDesktop.createMemory({
        title: "UI Memoria Lara agent fact",
        body: "Agent filter should hide other agent memories.",
        labels: "agent-filter",
        agentId: "hermes:lara"
      });
      return { visible };
    });
    await page.evaluate(() => refresh());
    await page.fill("#memorySearchInput", "UI Memoria visible fact");
    await page.click("#searchMemory");
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
    if (writeControls.memoriaTabs !== 4) {
      throw new Error(`Memoria UI should render exactly 4 viewing tabs: ${JSON.stringify(writeControls)}`);
    }

    await page.fill("#memorySearchInput", "prioritize viewing");
    await page.click("#searchMemory");
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memoria visible fact"), null, {
      timeout: 15000
    });
    if ((await page.textContent("#memoryList")).includes("UI Memoria restricted fact")) {
      throw new Error("Memoria UI normal search showed restricted memory.");
    }

    await page.selectOption("#memoryAgentFilter", "claude-code:clara");
    await page.fill("#memorySearchInput", "agent filter");
    await page.click("#searchMemory");
    await page.waitForFunction(
      () => {
        const text = document.querySelector("#memoryList")?.textContent || "";
        return text.includes("UI Memoria Clara agent fact") && !text.includes("UI Memoria Lara agent fact");
      },
      null,
      { timeout: 15000 }
    );
    const filteredAgentText = await page.textContent("#memoryList");
    if (filteredAgentText.includes("UI Memoria Lara agent fact")) {
      throw new Error("Memoria UI agent search included another agent.");
    }
    await page.selectOption("#memoryAgentFilter", "");

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
      modeControls: document.querySelectorAll("#memoryGraph [data-graph-mode]").length,
      sidePanel: Boolean(document.querySelector("#memoryGraphPanel")),
      graphMode: document.querySelector("#memoryGraphCanvas")?.dataset.mode,
      initialZoom: document.querySelector("#memoryGraphCanvas")?.dataset.zoom,
      initialPanX: document.querySelector("#memoryGraphCanvas")?.dataset.panX,
      initialNodeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0),
      initialEdgeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0),
      initialLabelCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.labelCount || 0),
      memoryMapLabel: document.querySelector("#memoryGraph [data-graph-mode='all']")?.textContent.trim(),
      stateModeLabel: document.querySelector("#memoryGraph [data-graph-mode='state']")?.textContent.trim()
    }));
    await page.evaluate(() => refreshRuntimeSnapshotOnly());
    await page.waitForFunction(
      () => Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0) > 0
        && Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0) > 0,
      null,
      { timeout: 15000 }
    );
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
      graphControls.modeControls !== 3 ||
      !graphControls.sidePanel ||
      graphControls.graphMode !== "all" ||
      graphControls.initialLabelCount < 1 ||
      !graphControls.memoryMapLabel ||
      !graphControls.stateModeLabel ||
      graphControls.initialNodeCount < 1 ||
      graphControls.initialEdgeCount < 1 ||
      zoomedValue === graphControls.initialZoom ||
      wheelZoomedValue === fitValue ||
      draggedPanX === graphControls.initialPanX
    ) {
      throw new Error(`Memoria UI graph canvas controls failed: ${JSON.stringify({ graphControls, zoomedValue, fitValue, wheelZoomedValue, draggedPanX })}`);
    }
    await page.click("#memoryGraph [data-graph-mode='network']");
    await page.waitForFunction(() => document.querySelector("#memoryGraphCanvas")?.dataset.mode === "network", null, { timeout: 15000 });
    await page.click("#memoryGraph [data-graph-mode='state']");
    await page.waitForFunction(
      () => document.querySelector("#memoryGraphCanvas")?.dataset.mode === "state"
        && Number(document.querySelector("#memoryGraphCanvas")?.dataset.stateEdgeCount || 0) > 0,
      null,
      { timeout: 15000 }
    );
    const stateGraph = await page.evaluate(() => ({
      mode: document.querySelector("#memoryGraphCanvas")?.dataset.mode,
      stateEdgeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.stateEdgeCount || 0),
      nodeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0),
      panelText: document.querySelector("#memoryGraphPanel")?.textContent || "",
      panelKicker: Boolean(document.querySelector("#memoryGraphPanel .graph-panel-kicker")),
      legendEntries: document.querySelectorAll("#memoryGraphPanel .state-legend > div").length,
      activeMode: document.querySelector("#memoryGraph [data-graph-mode='state']")?.classList.contains("active")
    }));
    if (
      stateGraph.mode !== "state" ||
      stateGraph.stateEdgeCount < 1 ||
      stateGraph.nodeCount < 2 ||
      !stateGraph.activeMode ||
      !stateGraph.panelKicker ||
      stateGraph.legendEntries !== 3 ||
      !stateGraph.panelText.trim()
    ) {
      throw new Error(`Memoria UI state-chain mode failed: ${JSON.stringify(stateGraph)}`);
    }
    await page.click("#memoryGraph [data-graph-mode='all']");
    await page.waitForFunction(() => document.querySelector("#memoryGraphCanvas")?.dataset.mode === "all", null, { timeout: 15000 });
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
    await page.click("[data-memory-tab='archive']");
    const restrictedCancelled = await page.evaluate(() => ({
      activeRestrictedTab: document.querySelector("[data-memory-tab='archive']")?.classList.contains("active"),
      activeRestrictedPanel: document.querySelector("[data-memory-panel='archive']")?.classList.contains("active")
    }));
    if (restrictedCancelled.activeRestrictedTab || restrictedCancelled.activeRestrictedPanel) {
      throw new Error(`Memoria UI entered restricted view after cancelled confirmation: ${JSON.stringify(restrictedCancelled)}`);
    }
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("[data-memory-tab='archive']");
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
    page.once("dialog", (dialog) => dialog.accept());
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
    if (result.activeCount !== 4 || result.deletedCount !== 1 || result.restrictedCount !== 1) {
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
    if (result.activeCounter !== "4" || result.deletedCounter !== "1") {
      throw new Error(`Memoria UI counter text mismatch: ${JSON.stringify(result)}`);
    }

    await app.close();
    app = null;

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
    const reopenedPage = await app.firstWindow();
    reopenedPage.on("console", (message) => {
      if (message.type() === "error") rendererErrors.push(message.text());
    });
    reopenedPage.on("pageerror", (error) => rendererErrors.push(error.message));
    await reopenedPage.waitForSelector("[data-view='memory']", { timeout: 15000 });
    const reopenedTitle = await reopenedPage.title();
    if (reopenedTitle !== "ClaraCore Desktop") {
      throw new Error(`Memoria UI reopened the wrong window: ${reopenedTitle}`);
    }
    await reopenedPage.click("[data-view='memory']");
    await reopenedPage.click("[data-memory-tab='graph']");
    await reopenedPage.waitForSelector("#memoryGraphCanvas", { timeout: 15000 });
    await reopenedPage.waitForFunction(
      () => Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0) > 0
        && Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0) > 0,
      null,
      { timeout: 15000 }
    );
    const reopenedGraph = await reopenedPage.evaluate(() => ({
      nodes: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0),
      edges: Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0)
    }));
    if (reopenedGraph.nodes < 1 || reopenedGraph.edges < 1) {
      throw new Error(`Memoria UI graph disappeared after app reopen: ${JSON.stringify(reopenedGraph)}`);
    }
    if (rendererErrors.length > 0) {
      throw new Error(`Memoria UI renderer logged errors: ${JSON.stringify(rendererErrors)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await reopenedPage.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH });
    }
    await app.close();
    app = null;
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: result.databasePath,
          activeCount: result.activeCount,
          deletedCount: result.deletedCount,
          restrictedCount: result.restrictedCount,
          reopenedGraph,
          reopenedTitle
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
