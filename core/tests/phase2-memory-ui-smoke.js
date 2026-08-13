const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const PAGING_FIXTURE_COUNT = 45;

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
    await database.recordMemoryControlEvent({
      id: "memory-control-observe-relevant",
      policyVersion: "memory-controller-v1",
      policyMode: "observe",
      agentId: "codex",
      queryPreview: "我们之前是怎么决定记忆页面设计的？",
      stageAAction: "RETRIEVE",
      stageAReason: "prior_decision_request",
      stageBAction: "INJECT_TOP1",
      stageBReason: "high_confidence_top1",
      candidates: [
        { id: currentResidence.id, title: "Current residence", score: 0.87, source: "keyword+vector", status: "active" },
        { id: historicalResidence.id, title: "Residence before the move", score: 0.66, source: "vector", status: "superseded" }
      ],
      resultStatus: "completed"
    });
    await database.recordMemoryControlEvent({
      id: "memory-control-ordinary-noop",
      policyVersion: "memory-controller-v1",
      policyMode: "observe",
      agentId: "codex",
      queryPreview: "把按钮往左移动一点",
      stageAAction: "NOOP",
      stageAReason: "ordinary_current_turn",
      resultStatus: "completed"
    });
    for (let index = 0; index < PAGING_FIXTURE_COUNT; index += 1) {
      await runtime.createProductMemory(runtimeApp, {
        title: `Paged memory ${String(index + 1).padStart(2, "0")}`,
        body: `Pagination fixture ${index + 1} should appear when the full memory library loads more.`,
        labels: "pagination"
      });
    }

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

    await page.evaluate(async () => {
      await window.ClaraCoreDesktop.saveSettings({ "memory.controller.mode": "observe" });
      await window.ClaraCoreDesktop.createMemory({
        title: "UI Memoria visible fact",
        body: "Memoria UI should prioritize viewing, search, labels, and graph.",
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
    });
    await page.evaluate(() => refresh());
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memoria visible fact"), null, {
      timeout: 15000
    });

    const pageContract = await page.evaluate(() => {
      const searchLabel = document.querySelector(".memory-search > label")?.getBoundingClientRect();
      const searchControls = document.querySelector(".memory-search > div")?.getBoundingClientRect();
      return {
      body: document.querySelector("#viewSubtitle")?.textContent || "",
      focusBlock: Boolean(document.querySelector("#memoryView > .page-focus")),
      detailPresent: Boolean(document.querySelector("#memoryDetail")),
      detailDialog: Boolean(document.querySelector("#memoryDetailDialog")),
      processSteps: document.querySelectorAll("#memoryProcessFlow > div").length,
      processBeforeToolbar: Boolean(
        document.querySelector(".memory-process-section")?.compareDocumentPosition(document.querySelector(".memory-toolbar"))
        & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      searchLabelCenterDelta: searchLabel && searchControls
        ? Math.abs((searchLabel.top + searchLabel.height / 2) - (searchControls.top + searchControls.height / 2))
        : null,
      recallRows: document.querySelectorAll("#memoryRecallList .memory-recall-row").length,
      nestedDetails: document.querySelectorAll("#memoryView details").length,
      listOverflow: getComputedStyle(document.querySelector("#memoryList")).overflowY,
      factForm: Boolean(document.querySelector("#saveMemory")),
      recordForm: Boolean(document.querySelector("#saveMemoryRecord")),
      aliasForm: Boolean(document.querySelector("#saveMemoryAlias")),
      maintenanceRun: Boolean(document.querySelector("#runMemoryMaintenance")),
      vectorMaintenance: Boolean(document.querySelector("#processMemoryEmbeddings")),
      stats: Boolean(document.querySelector(".memory-stats-grid")),
      archivePanel: Boolean(document.querySelector("[data-memory-panel='archive']")),
      mutationControls: document.querySelectorAll("[data-memory-action]").length,
      memoriaTabs: document.querySelectorAll("[data-memory-tab]").length
      };
    });
    if (
      (!pageContract.body.includes("Facts, decisions") && !pageContract.body.includes("事实、决定")) ||
      !pageContract.detailPresent ||
      !pageContract.detailDialog ||
      pageContract.processSteps !== 5 ||
      !pageContract.processBeforeToolbar ||
      pageContract.searchLabelCenterDelta > 1 ||
      pageContract.recallRows !== 2 ||
      pageContract.nestedDetails !== 0 ||
      pageContract.listOverflow === "auto" ||
      pageContract.focusBlock ||
      pageContract.factForm ||
      pageContract.recordForm ||
      pageContract.aliasForm ||
      pageContract.maintenanceRun ||
      pageContract.vectorMaintenance ||
      pageContract.stats ||
      pageContract.archivePanel ||
      pageContract.mutationControls
    ) {
      throw new Error(`Memoria UI did not keep the Agent First read-only contract: ${JSON.stringify(pageContract)}`);
    }
    if (pageContract.memoriaTabs !== 2) {
      throw new Error(`Memoria UI should render exactly 2 knowledge tabs: ${JSON.stringify(pageContract)}`);
    }

    const mainMemoryCount = await page.locator("#memoryList .memory-item").count();
    if (mainMemoryCount !== 6 || await page.locator(".memory-recent-section > .load-more-button").count()) {
      throw new Error(`Memoria main page should stay bounded without an orphan load-more control: ${JSON.stringify({ mainMemoryCount })}`);
    }
    await page.click("#memoryAllAction");
    await page.waitForFunction(() => document.querySelector("#memoryDetailDialog")?.open);
    const libraryCountBefore = await page.locator("#memoryDialogLibrary .memory-item").count();
    const libraryLoadMore = page.locator("#memoryLibraryLoadMore");
    if (libraryCountBefore < 20 || !await libraryLoadMore.isVisible()) {
      throw new Error(`Memoria library did not expose meaningful paging: ${JSON.stringify({ libraryCountBefore, loadMoreVisible: await libraryLoadMore.isVisible() })}`);
    }
    await libraryLoadMore.click();
    await page.waitForFunction((before) => document.querySelectorAll("#memoryDialogLibrary .memory-item").length > before, libraryCountBefore);
    const libraryPaging = await page.evaluate((before) => ({
      before,
      after: document.querySelectorAll("#memoryDialogLibrary .memory-item").length,
      meta: document.querySelector("#memoryDetailMeta")?.textContent || "",
      mainCount: document.querySelectorAll("#memoryList .memory-item").length,
      orphanLoadMore: Boolean(document.querySelector(".memory-recent-section > .load-more-button")),
      loadMoreDisabled: document.querySelector("#memoryLibraryLoadMore")?.disabled ?? null
    }), libraryCountBefore);
    if (
      libraryPaging.after <= libraryPaging.before ||
      libraryPaging.mainCount !== 6 ||
      libraryPaging.orphanLoadMore ||
      !libraryPaging.meta.includes(String(libraryPaging.after))
    ) {
      throw new Error(`Memoria library paging did not visibly append records: ${JSON.stringify(libraryPaging)}`);
    }
    await page.click("#memoryDetailClose");

    await page.click("[data-memory-id]:has-text('UI Memoria visible fact')");
    await page.waitForFunction(() => document.querySelector("#memoryDetailDialog")?.open);
    await page.waitForFunction(() => document.querySelector("#memoryDetail")?.textContent.includes("prioritize viewing"), null, {
      timeout: 15000
    });
    const selectedState = await page.evaluate(() => ({
      selectedCount: document.querySelectorAll("#memoryList [aria-pressed='true']").length,
      selectedTitle: document.querySelector("#memoryList [aria-pressed='true'] strong")?.textContent || "",
      detailText: document.querySelector("#memoryDetail")?.textContent || "",
      actionCount: document.querySelectorAll("#memoryDetail button, #memoryDetail [data-memory-action]").length
    }));
    if (selectedState.selectedCount !== 1 || selectedState.selectedTitle !== "UI Memoria visible fact" || !selectedState.detailText.includes("prioritize viewing") || selectedState.actionCount !== 0) {
      throw new Error(`Memoria UI selection/detail failed: ${JSON.stringify(selectedState)}`);
    }
    await page.keyboard.press("Escape");

    await page.click("#memoryRecallList .memory-recall-row:has-text('怎么决定记忆页面设计')");
    await page.waitForFunction(() => document.querySelector("#memoryRecallDetail")?.textContent.includes("相关，但仅观察"));
    const recallEvidence = await page.evaluate(() => ({
      text: document.querySelector("#memoryRecallDetail")?.textContent || "",
      candidateCount: document.querySelectorAll("#memoryRecallDetail .memory-candidate-row").length,
      backVisible: !document.querySelector("#memoryDetailBack")?.hidden
    }));
    if (!recallEvidence.text.includes("关键词 + 语义") || !recallEvidence.text.includes("87%") || recallEvidence.candidateCount !== 2 || !recallEvidence.backVisible) {
      throw new Error(`Memory recall evidence is incomplete: ${JSON.stringify(recallEvidence)}`);
    }
    await page.keyboard.press("Escape");

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

    await page.click('[data-memory-open="labels"]');
    await page.waitForFunction(() => document.querySelector("#memoryDetailDialog")?.open, null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("#memoryAllLabelList")?.textContent.includes("inspect"), null, {
      timeout: 15000
    });
    const knowledgeDialogLayout = await page.evaluate(() => {
      const dialog = document.querySelector("#memoryDetailDialog");
      const head = dialog.querySelector(".memory-dialog-head").getBoundingClientRect();
      const close = document.querySelector("#memoryDetailClose").getBoundingClientRect();
      const back = document.querySelector("#memoryDetailBack");
      return {
        closeAtTrailingEdge: close.right > head.left + head.width * 0.85 && close.right <= head.right,
        hiddenBackDisplay: getComputedStyle(back).display,
        scrollbarWidth: getComputedStyle(dialog).scrollbarWidth
      };
    });
    if (!knowledgeDialogLayout.closeAtTrailingEdge || knowledgeDialogLayout.hiddenBackDisplay !== "none" || knowledgeDialogLayout.scrollbarWidth !== "none") {
      throw new Error(`Memoria knowledge dialog chrome regressed: ${JSON.stringify(knowledgeDialogLayout)}`);
    }
    await page.click("#memoryAllLabelList [data-memory-label='inspect']");
    await page.waitForFunction(() => document.querySelector("#memorySearchInput")?.value === "inspect", null, {
      timeout: 15000
    });
    await page.waitForFunction(() => document.querySelector("#memoryList")?.textContent.includes("UI Memoria second fact"), null, {
      timeout: 15000
    });
    if (await page.locator("#memoryDetailDialog").getAttribute("open")) throw new Error("Memoria label navigation should return to the normal reading path.");

    await page.click('[data-memory-open="graph"]');
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
    await page.click("#memoryDetailClose");
    await page.click('[data-memory-open="graph"]');
    await page.waitForSelector("#memoryGraphCanvas", { timeout: 15000 });
    const reopenedDisclosureGraph = await page.evaluate(() => ({
      open: document.querySelector("#memoryDetailDialog")?.open,
      activeGraph: document.querySelector("[data-memory-tab='graph']")?.classList.contains("active"),
      nodes: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0),
      edges: Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0)
    }));
    if (!reopenedDisclosureGraph.open || !reopenedDisclosureGraph.activeGraph || reopenedDisclosureGraph.nodes < 1 || reopenedDisclosureGraph.edges < 1) {
      throw new Error(`Memoria graph failed after disclosure reopen: ${JSON.stringify(reopenedDisclosureGraph)}`);
    }

    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        databasePath: snapshot.data.databasePath,
        activeCount: snapshot.memoryStats.activeCount,
        deletedCount: snapshot.memoryStats.deletedCount,
        restrictedCount: snapshot.memoryStats.restrictedCount,
        labels: snapshot.memoryStats.labels,
        activeText: document.querySelector("#memoryList").textContent,
        graphText: document.querySelector("#memoryGraph").textContent,
        graphEdgeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0),
        graphNodeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0)
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`Memoria UI wrote outside product data root: ${result.databasePath}`);
    }
    if (result.activeCount !== 5 + PAGING_FIXTURE_COUNT || result.deletedCount !== 0 || result.restrictedCount !== 1) {
      throw new Error(`Memoria UI counts mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.labels.some((item) => item.label === "inspect" && item.count === 2)) {
      throw new Error(`Memoria UI label stats mismatch: ${JSON.stringify(result.labels)}`);
    }
    if (result.graphEdgeCount < 1 || result.graphNodeCount < 1) {
      throw new Error(`Memoria UI graph did not render expected label relation: ${JSON.stringify(result)}`);
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
    await reopenedPage.click('[data-memory-open="graph"]');
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
      await reopenedPage.click("#memoryDetailClose");
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
          pageContract,
          selectedState,
          reopenedDisclosureGraph,
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
