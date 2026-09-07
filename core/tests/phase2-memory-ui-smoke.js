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
    await runtime.saveProductSettings(runtimeApp, {
      "memory.embedding.provider": "disabled",
      "memory.embedding.model": ""
    });
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
    const historicalPreference = await runtime.createProductMemory(runtimeApp, {
      title: "Historical editor preference",
      body: "The user previously preferred the light editor theme.",
      labels: "state-chain"
    });
    const currentPreference = await runtime.createProductMemory(runtimeApp, {
      title: "Current editor preference",
      body: "The user now prefers the system editor theme.",
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
    await database.supersedeMemory({
      currentMemoryId: currentPreference.id,
      historicalMemoryId: historicalPreference.id,
      note: "The confirmed editor preference changed."
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
    const searchFeedback = await page.evaluate(() => ({
      title: document.querySelector("#memoryRecentTitle")?.textContent || "",
      status: document.querySelector("#memoryAllHint")?.textContent || "",
      buttonText: document.querySelector("#searchMemory")?.textContent || "",
      buttonDisabled: document.querySelector("#searchMemory")?.disabled ?? null,
      inputBusy: document.querySelector("#memorySearchInput")?.getAttribute("aria-busy")
    }));
    if (
      searchFeedback.title !== "搜索结果" ||
      !searchFeedback.status.includes("找到") ||
      searchFeedback.buttonText !== "搜索" ||
      searchFeedback.buttonDisabled ||
      searchFeedback.inputBusy !== null
    ) {
      throw new Error(`Memoria search did not expose a complete visible result state: ${JSON.stringify(searchFeedback)}`);
    }
    if ((await page.textContent("#memoryList")).includes("UI Memoria restricted fact")) {
      throw new Error("Memoria UI normal search showed restricted memory.");
    }

    await page.fill("#memorySearchInput", "no reliable memory fixture");
    await page.click("#searchMemory");
    await page.waitForFunction(
      () => (document.querySelector("#memoryList")?.textContent || "").includes("没有找到与“no reliable memory fixture”可靠相关的记忆"),
      null,
      { timeout: 15000 }
    );
    const emptySearchFeedback = await page.evaluate(() => ({
      list: document.querySelector("#memoryList")?.textContent || "",
      status: document.querySelector("#memoryAllHint")?.textContent || ""
    }));
    if (!emptySearchFeedback.status.includes("没有找到与“no reliable memory fixture”可靠相关的记忆")) {
      throw new Error(`Memoria search did not expose a reliable-result empty state: ${JSON.stringify(emptySearchFeedback)}`);
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
    await page.fill("#memorySearchInput", "");
    await page.click("#searchMemory");
    await page.waitForFunction(() => document.querySelector("#memoryRecentTitle")?.textContent === "最近形成");

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
      agentCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.agentCount || 0),
      agentLegendRows: document.querySelectorAll("#memoryGraphPanel .agent-legend .graph-legend-row").length,
      agentLegendText: document.querySelector("#memoryGraphPanel .agent-legend")?.textContent || "",
      agentSwatches: [...document.querySelectorAll("#memoryGraphPanel .graph-legend-swatch.agent")].map((swatch) => {
        const style = getComputedStyle(swatch);
        return { width: style.width, height: style.height, color: style.backgroundColor };
      }),
      layoutAspect: Number(document.querySelector("#memoryGraphCanvas")?.dataset.layoutAspect || 0),
      memoryMapLabel: document.querySelector("#memoryGraph [data-graph-mode='all']")?.textContent.trim(),
      stateModeLabel: document.querySelector("#memoryGraph [data-graph-mode='state']")?.textContent.trim()
    }));
    await page.waitForFunction(() => Number(document.querySelector("#memoryGraphCanvas")?.dataset.visibleLabelCount || 0) > 0);
    const mapPanel = await page.evaluate(() => {
      const canvas = document.querySelector("#memoryGraphCanvas");
      const rect = canvas.getBoundingClientRect();
      for (let y = 20; y < rect.height - 20; y += 12) {
        for (let x = 20; x < rect.width - 20; x += 12) {
          canvas.dispatchEvent(new MouseEvent("click", {
            bubbles: true,
            clientX: rect.left + x,
            clientY: rect.top + y
          }));
          const excerpt = document.querySelector("#memoryGraphPanel .graph-panel-excerpt")?.textContent || "";
          const subtitle = document.querySelector("#memoryGraphPanel .graph-panel-subtitle")?.textContent || "";
          if (excerpt && !/·\s*0\s*$/.test(subtitle)) {
            return {
              title: document.querySelector("#memoryGraphPanel .graph-panel-title")?.textContent || "",
              excerpt,
              subtitle
            };
          }
        }
      }
      return null;
    });
    if (!mapPanel?.title || !mapPanel.excerpt || /·\s*0\s*$/.test(mapPanel.subtitle)) {
      throw new Error(`Memoria memory-map selection did not expose memory content and structure: ${JSON.stringify(mapPanel)}`);
    }
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
      graphControls.agentCount < 3 ||
      graphControls.agentLegendRows < 3 ||
      !graphControls.agentLegendText.includes("claude-code:clara") ||
      !graphControls.agentLegendText.includes("hermes:lara") ||
      new Set(graphControls.agentSwatches.map((swatch) => swatch.color)).size < 3 ||
      graphControls.agentSwatches.some((swatch) => swatch.width !== swatch.height) ||
      graphControls.layoutAspect < 0.72 ||
      graphControls.layoutAspect > 1.38 ||
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
    const networkGraph = await page.evaluate(() => ({
      edgeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.edgeCount || 0),
      linkCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.linkCount || 0),
      labelCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.labelCount || 0),
      clusterCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.networkClusterCount || 0),
      activeCluster: document.querySelector("#memoryGraphCanvas")?.dataset.activeNetworkCluster || "",
      clusterChoices: document.querySelectorAll("#memoryGraphPanel .network-cluster-choice").length,
      selectedClusters: document.querySelectorAll("#memoryGraphPanel .network-cluster-choice.selected").length
    }));
    if (
      networkGraph.labelCount !== 0
      || networkGraph.edgeCount < 1
      || networkGraph.edgeCount >= networkGraph.linkCount
      || networkGraph.clusterCount < 2
      || networkGraph.clusterChoices !== networkGraph.clusterCount
      || networkGraph.selectedClusters !== 1
      || !networkGraph.activeCluster
    ) {
      throw new Error(`Memoria relationship network should focus one explicit-link cluster: ${JSON.stringify(networkGraph)}`);
    }
    await page.click("#memoryGraph [data-graph-mode='state']");
    await page.waitForSelector("#memoryGraph .state-chain-overview", { timeout: 15000 });
    const stateOverview = await page.evaluate(() => ({
      cards: document.querySelectorAll("#memoryGraph .state-chain-overview-card").length,
      hasCanvas: Boolean(document.querySelector("#memoryGraphCanvas")),
      hasPanel: Boolean(document.querySelector("#memoryGraphPanel")),
      activeMode: document.querySelector("#memoryGraph [data-graph-mode='state']")?.classList.contains("active"),
      text: document.querySelector("#memoryGraph .state-chain-overview")?.textContent || ""
    }));
    if (
      stateOverview.cards !== 2
      || stateOverview.hasCanvas
      || stateOverview.hasPanel
      || !stateOverview.activeMode
      || !stateOverview.text.includes("所有状态链")
    ) {
      throw new Error(`Memoria state-chain overview failed: ${JSON.stringify(stateOverview)}`);
    }
    await page.evaluate(() => { document.body.dataset.theme = "dark"; });
    await page.waitForTimeout(180);
    const darkStateOverview = await page.evaluate(() => {
      const parseRgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
      const luminance = (value) => {
        const channels = parseRgb(value).map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const contrast = (foreground, background) => {
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        return (lighter + 0.05) / (darker + 0.05);
      };
      const overview = document.querySelector("#memoryGraph .state-chain-overview");
      const card = overview?.querySelector(".state-chain-overview-card");
      const title = overview?.querySelector("h3");
      const body = overview?.querySelector("p");
      const cardTitle = card?.querySelector("strong");
      const overviewStyle = getComputedStyle(overview);
      const cardStyle = getComputedStyle(card);
      const titleStyle = getComputedStyle(title);
      const bodyStyle = getComputedStyle(body);
      const cardTitleStyle = getComputedStyle(cardTitle);
      return {
        overviewBackground: overviewStyle.backgroundColor,
        cardBackground: cardStyle.backgroundColor,
        bodySurfaceSoft: getComputedStyle(document.body).getPropertyValue("--surface-soft").trim(),
        cardSurfaceSoft: cardStyle.getPropertyValue("--surface-soft").trim(),
        titleContrast: contrast(titleStyle.color, overviewStyle.backgroundColor),
        bodyContrast: contrast(bodyStyle.color, overviewStyle.backgroundColor),
        cardTitleContrast: contrast(cardTitleStyle.color, cardStyle.backgroundColor)
      };
    });
    if (
      darkStateOverview.overviewBackground !== "rgb(35, 40, 37)"
      || darkStateOverview.cardBackground !== "rgb(43, 48, 45)"
      || darkStateOverview.titleContrast < 4.5
      || darkStateOverview.bodyContrast < 4.5
      || darkStateOverview.cardTitleContrast < 4.5
    ) {
      throw new Error(`Memoria dark state-chain overview contrast failed: ${JSON.stringify(darkStateOverview)}`);
    }
    await page.evaluate(() => document.querySelector("#memoryGraph .state-chain-overview-card")?.click());
    await page.waitForFunction(
      () => document.querySelector("#memoryGraphCanvas")?.dataset.mode === "state"
        && Number(document.querySelector("#memoryGraphCanvas")?.dataset.stateEdgeCount || 0) > 0,
      null,
      { timeout: 15000 }
    );
    const stateGraph = await page.evaluate(() => ({
      mode: document.querySelector("#memoryGraphCanvas")?.dataset.mode,
      layout: document.querySelector("#memoryGraphCanvas")?.dataset.stateLayout,
      stateEdgeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.stateEdgeCount || 0),
      nodeCount: Number(document.querySelector("#memoryGraphCanvas")?.dataset.nodeCount || 0),
      panelText: document.querySelector("#memoryGraphPanel")?.textContent || "",
      panelKicker: Boolean(document.querySelector("#memoryGraphPanel .graph-panel-kicker")),
      legendEntries: document.querySelectorAll("#memoryGraphPanel .state-legend > div").length,
      chainChoices: document.querySelectorAll("#memoryGraphPanel .state-chain-choice").length,
      zoomControls: document.querySelectorAll("#memoryGraph [data-graph-zoom]").length,
      naturalScroll: document.querySelector("#memoryGraphCanvas")?.parentElement?.classList.contains("state-scroll"),
      hasReadingGuide: Boolean(document.querySelector("#memoryGraph .state-chain-explainer")),
      hasOverviewBack: Boolean(document.querySelector("#memoryGraphPanel .state-overview-back")),
      excerptOverflow: getComputedStyle(document.querySelector("#memoryGraphPanel .state-panel-excerpt")).overflowY,
      titleClipping: document.querySelector("#memoryGraphCanvas")?.dataset.stateTitleClipping,
      activeMode: document.querySelector("#memoryGraph [data-graph-mode='state']")?.classList.contains("active"),
      explainerBackground: getComputedStyle(document.querySelector("#memoryGraph .state-chain-explainer")).backgroundColor
    }));
    if (
      stateGraph.mode !== "state" ||
      stateGraph.layout !== "timeline" ||
      stateGraph.stateEdgeCount < 1 ||
      stateGraph.nodeCount < 2 ||
      !stateGraph.activeMode ||
      !stateGraph.panelKicker ||
      stateGraph.legendEntries !== 0 ||
      stateGraph.chainChoices !== 0 ||
      stateGraph.zoomControls !== 0 ||
      !stateGraph.naturalScroll ||
      !stateGraph.hasReadingGuide ||
      !stateGraph.hasOverviewBack ||
      stateGraph.excerptOverflow !== "hidden" ||
      stateGraph.titleClipping !== "pixel" ||
      stateGraph.explainerBackground !== "rgb(43, 48, 45)" ||
      stateGraph.nodeCount !== 2 ||
      !stateGraph.panelText.trim()
    ) {
      throw new Error(`Memoria UI state-chain mode failed: ${JSON.stringify(stateGraph)}`);
    }
    await page.evaluate(() => {
      const canvas = document.querySelector("#memoryGraphCanvas");
      if (canvas) canvas.style.height = "800px";
    });
    await page.locator("#memoryGraphCanvas").hover();
    await page.mouse.wheel(0, 180);
    await page.waitForFunction(() => (document.querySelector("#memoryGraphCanvas")?.parentElement?.scrollTop || 0) > 0, null, {
      timeout: 15000
    });
    const firstStateChain = await page.locator("#memoryGraphCanvas").getAttribute("data-active-state-chain");
    const dialogScrollBeforeOverview = await page.evaluate(() => {
      const dialog = document.querySelector("#memoryDetailDialog");
      dialog.scrollTop = Math.min(120, Math.max(0, dialog.scrollHeight - dialog.clientHeight));
      return dialog.scrollTop;
    });
    await page.evaluate(() => document.querySelector("#memoryGraphPanel .state-overview-back")?.click());
    await page.waitForSelector("#memoryGraph .state-chain-overview", { timeout: 15000 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dialogScrollAfterOverview = await page.locator("#memoryDetailDialog").evaluate((dialog) => dialog.scrollTop);
    if (Math.abs(dialogScrollAfterOverview - dialogScrollBeforeOverview) > 1) {
      throw new Error(`Memoria state overview reset dialog scroll: ${JSON.stringify({ dialogScrollBeforeOverview, dialogScrollAfterOverview })}`);
    }
    await page.evaluate(() => document.querySelectorAll("#memoryGraph .state-chain-overview-card")[1]?.click());
    await page.waitForFunction(
      (previous) => document.querySelector("#memoryGraphCanvas")?.dataset.activeStateChain !== previous,
      firstStateChain,
      { timeout: 15000 }
    );
    await page.click("#memoryGraph [data-graph-mode='all']");
    await page.waitForFunction(() => document.querySelector("#memoryGraphCanvas")?.dataset.mode === "all", null, { timeout: 15000 });
    await page.evaluate(() => { document.body.dataset.theme = "light"; });
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
    if (result.activeCount !== 6 + PAGING_FIXTURE_COUNT || result.deletedCount !== 0 || result.restrictedCount !== 1) {
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
