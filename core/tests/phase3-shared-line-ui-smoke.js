const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function clickSharedLine(page, lineId) {
  const selector = `[data-shared-line-id='${lineId}']`;
  if (!(await page.locator(`#sharedLinePrimaryList ${selector}`).count())) await page.click("[data-shared-line-open='lines']");
  await page.click(selector);
}

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase3-shared-line-ui-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const screenshotRoot = process.env.CLARACORE_UI_DIALOG_SCREENSHOT_DIR || "";
  if (screenshotRoot) await fs.mkdir(screenshotRoot, { recursive: true });
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
    await page.waitForSelector("[data-view='shared-line']", { timeout: 15000 });
    await page.click("[data-view='shared-line']");
    await page.waitForFunction(() => Boolean(window.ClaraCoreDesktop && document.querySelector("#sharedLineList")), null, {
      timeout: 15000
    });

    const seeded = await page.evaluate(async () => {
      const initial = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      const activeLineId = initial.sharedLine.lineId;
      await window.ClaraCoreDesktop.saveSharedLine({
        lineId: activeLineId,
        agentId: "codex",
        summary: "ACTIVE PAST must stay on the active line.",
        nextStep: "ACTIVE OLD NEXT",
        interpretationStatus: "active"
      });
      await window.ClaraCoreDesktop.saveSharedLine({
        lineId: activeLineId,
        agentId: "codex",
        summary: "ACTIVE NOW must never leak into the selected line.",
        nextStep: "ACTIVE NEXT must never leak.",
        confirmedGround: "ACTIVE UNDERSTANDING must never leak.",
        interpretationStatus: "active"
      });

      for (let index = 0; index < 8; index += 1) {
        await window.ClaraCoreDesktop.createSharedLine({
          title: index === 0
            ? `Overflow line ${index} with a very-long-unbroken-identifier-${"x".repeat(160)}`
            : `Overflow line ${index}`,
          agentId: "codex",
          makeActive: false
        });
      }

      const parallel = await window.ClaraCoreDesktop.createSharedLine({
        title: "Parallel continuity",
        agentId: "clara",
        makeActive: false
      });
      const parallelLineId = parallel.sharedLine.lineId;
      await window.ClaraCoreDesktop.saveSharedLine({
        lineId: parallelLineId,
        agentId: "clara",
        summary: "PARALLEL PAST belongs only to the selected line.",
        nextStep: "PARALLEL OLD NEXT",
        interpretationStatus: "active"
      });
      await window.ClaraCoreDesktop.saveSharedLine({
        lineId: parallelLineId,
        agentId: "clara",
        summary: "PARALLEL NOW belongs only to the selected line.",
        nextStep: "PARALLEL NEXT belongs only to the selected line.",
        confirmedGround: "PARALLEL UNDERSTANDING belongs only to the selected line.",
        provisionalRead: "PARALLEL QUESTION remains unresolved.",
        interpretationStatus: "needs_review"
      });

      const sparse = await window.ClaraCoreDesktop.createSharedLine({
        title: "Sparse continuity",
        agentId: "lara",
        makeActive: false
      });
      const archived = await window.ClaraCoreDesktop.createSharedLine({
        title: "Already traveled line",
        agentId: "clara",
        makeActive: false
      });
      await window.ClaraCoreDesktop.saveSharedLine({
        lineId: archived.sharedLine.lineId,
        agentId: "clara",
        summary: `Archived text must stay inside its rail ${"archive/path/without/a/natural/break/".repeat(18)}`,
        interpretationStatus: "closed"
      });
      await window.ClaraCoreDesktop.archiveSharedLine(archived.sharedLine.lineId);
      return { activeLineId, parallelLineId, sparseLineId: sparse.sharedLine.lineId };
    });

    const cliPath = path.resolve(__dirname, "..", "cli.js");
    const cliEnv = {
      ...process.env,
      CLARACORE_DESKTOP_DATA_DIR: dataRoot,
      CLARACORE_DESKTOP_USER_DATA_DIR: userDataRoot,
      CLARACORE_DESKTOP_TEST_INSTANCE: "1"
    };
    await execFileAsync(process.execPath, [
      cliPath, "shared-line", "agent-state",
      "--agent-id", "codex",
      "--communication-style", "CODEX ROLE STYLE",
      "--relationship-position", "CODEX ROLE POSITION",
      "--long-term-preferences", "stable order,small loops",
      "--boundaries", "never follow selected line"
    ], { env: cliEnv });
    await execFileAsync(process.execPath, [
      cliPath, "shared-line", "agent-state",
      "--agent-id", "clara",
      "--communication-style", "CLARA ROLE STYLE",
      "--relationship-position", "CLARA ROLE POSITION",
      "--stable-patterns", "warm,precise"
    ], { env: cliEnv });

    await page.evaluate(() => refresh());
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("ACTIVE NOW"),
      null,
      { timeout: 15000 }
    );

    const removedHumanControls = await page.evaluate(() => ({
      resume: Boolean(document.querySelector("#sharedLineResume")),
      copy: Boolean(document.querySelector("#copySharedLineResume")),
      archive: Boolean(document.querySelector("[data-shared-line-action='archive']")),
      mutationControls: document.querySelectorAll("#sharedLineView input, #sharedLineView textarea, #sharedLineView form, [data-shared-line-action='archive'], [data-shared-line-action='save']").length,
      dialogOpen: document.querySelector("#sharedLineDetailDialog")?.open
    }));
    if (removedHumanControls.resume || removedHumanControls.copy || removedHumanControls.archive || removedHumanControls.mutationControls) {
      throw new Error(`Shared Line human mutation/resume controls remain: ${JSON.stringify(removedHumanControls)}`);
    }
    if (removedHumanControls.dialogOpen) {
      throw new Error(`Shared Line reader should start closed: ${JSON.stringify(removedHumanControls)}`);
    }

    const layoutStructure = await page.evaluate(() => {
      const detail = document.querySelector(".shared-line-detail-panel");
      const detailStyle = getComputedStyle(detail);
      const lineList = document.querySelector(".shared-line-list-panel").getBoundingClientRect();
      const lineDetail = detail.getBoundingClientRect();
      return {
        primaryCount: document.querySelectorAll("#sharedLinePrimaryList .shared-line-card").length,
        readerCount: document.querySelectorAll("#sharedLineOverflowList .shared-line-card").length,
        processSteps: document.querySelectorAll("#sharedLineProcessFlow > div").length,
        agentScopeBeforeOverview: Boolean(
          document.querySelector(".module-agent-bar")?.compareDocumentPosition(document.querySelector(".shared-line-overview"))
          & Node.DOCUMENT_POSITION_FOLLOWING
        ),
        titleLineClamp: getComputedStyle(document.querySelector(".shared-line-card-head strong")).webkitLineClamp,
        agentContextOutsideLineDetail: Boolean(
          document.querySelector("#sharedLineAgentStatePanel")?.closest("dialog")
          && !document.querySelector("#sharedLineAgentStatePanel")?.closest(".shared-line-detail-panel")
        ),
        alignedColumns: Math.abs(lineList.top - lineDetail.top) < 2,
        roleCardIds: [...document.querySelectorAll("[data-agent-role-id]")].map((card) => card.dataset.agentRoleId),
        roleContextText: document.querySelector("#sharedLineAgentStatePanel")?.textContent || "",
        legacyAgentGroups: document.querySelectorAll("#sharedLineAgentStatePanel .shared-line-detail-group").length,
        lineOrder: [...document.querySelectorAll("#sharedLineList .shared-line-card")].map((card) => card.dataset.sharedLineId),
        detailMaxHeight: detailStyle.maxHeight,
        detailOverflowY: detailStyle.overflowY
      };
    });
    if (
      layoutStructure.primaryCount !== 6
      || layoutStructure.readerCount < 7
      || layoutStructure.processSteps !== 4
      || !layoutStructure.agentScopeBeforeOverview
      || layoutStructure.titleLineClamp !== "2"
      || !layoutStructure.agentContextOutsideLineDetail
      || !layoutStructure.alignedColumns
      || !layoutStructure.roleCardIds.includes("codex")
      || !layoutStructure.roleCardIds.includes("clara")
      || !layoutStructure.roleContextText.includes("CODEX ROLE STYLE")
      || !layoutStructure.roleContextText.includes("CLARA ROLE STYLE")
      || layoutStructure.legacyAgentGroups !== 0
      || layoutStructure.detailMaxHeight !== "none"
      || layoutStructure.detailOverflowY !== "visible"
    ) {
      throw new Error(`Shared Line rail or flowing detail structure is wrong: ${JSON.stringify(layoutStructure)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH, fullPage: true });
    }
    await page.click("[data-shared-line-open='agents']");
    const agentDialogLayout = await page.evaluate(() => {
      const dialog = document.querySelector("#sharedLineDetailDialog");
      const close = document.querySelector("#sharedLineDialogClose").getBoundingClientRect();
      const head = dialog.querySelector(".memory-dialog-head").getBoundingClientRect();
      const cards = [...document.querySelectorAll("#sharedLineAgentStatePanel .shared-line-agent-role-card")];
      return {
        open: dialog.open,
        horizontalOverflow: dialog.scrollWidth > dialog.clientWidth + 1,
        closeInHeader: close.top >= head.top && close.bottom <= head.bottom + 1,
        cardsFit: cards.every((card) => card.scrollWidth <= card.clientWidth + 1)
      };
    });
    if (!agentDialogLayout.open || agentDialogLayout.horizontalOverflow || !agentDialogLayout.closeInHeader || !agentDialogLayout.cardsFit) {
      throw new Error(`Agent context reader layout regressed: ${JSON.stringify(agentDialogLayout)}`);
    }
    if (screenshotRoot) {
      await page.screenshot({ path: path.join(screenshotRoot, "shared-line-agents.png"), fullPage: false });
    }
    await page.click("#sharedLineDialogClose");

    await clickSharedLine(page, seeded.parallelLineId);
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("PARALLEL NOW"),
      null,
      { timeout: 15000 }
    );
    const selected = await page.evaluate(async () => {
      const runtime = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        activeLineId: runtime.sharedLine.lineId,
        title: document.querySelector("#sharedLineDetailTitle")?.textContent || "",
        participants: document.querySelector("#sharedLineParticipants")?.textContent || "",
        past: document.querySelector("#sharedLinePast")?.textContent || "",
        now: document.querySelector("#sharedLineSummary")?.textContent || "",
        next: document.querySelector("#sharedLineNext")?.textContent || "",
        understanding: document.querySelector("#sharedLineUnderstanding")?.textContent || "",
        unresolved: document.querySelector("#sharedLineUnresolved")?.textContent || "",
        selectedCount: document.querySelectorAll("#sharedLineOverflowList [aria-pressed='true']").length,
        lineOrder: [...document.querySelectorAll("#sharedLineList .shared-line-card")].map((card) => card.dataset.sharedLineId),
        roleCardIds: [...document.querySelectorAll("[data-agent-role-id]")].map((card) => card.dataset.agentRoleId),
        roleContextText: document.querySelector("#sharedLineAgentStatePanel")?.textContent || ""
      };
    });
    if (selected.activeLineId !== seeded.activeLineId) {
      throw new Error(`Selecting a line activated it for agents: ${JSON.stringify(selected)}`);
    }
    for (const [field, expected] of Object.entries({
      title: "Parallel continuity",
      participants: "clara",
      past: "PARALLEL PAST",
      now: "PARALLEL NOW",
      next: "PARALLEL NEXT",
      understanding: "PARALLEL UNDERSTANDING",
      unresolved: "PARALLEL QUESTION"
    })) {
      if (!selected[field].includes(expected) || selected[field].includes("ACTIVE")) {
        throw new Error(`Selected-line ${field} leaked or missed scoped data: ${JSON.stringify(selected)}`);
      }
    }
    if (selected.selectedCount !== 1) throw new Error(`Expected one selected line: ${JSON.stringify(selected)}`);
    if (JSON.stringify(selected.lineOrder) !== JSON.stringify(layoutStructure.lineOrder)) {
      throw new Error(`Selecting a line reordered the rail: ${JSON.stringify({ before: layoutStructure.lineOrder, after: selected.lineOrder })}`);
    }
    if (
      !selected.roleCardIds.includes("codex")
      || !selected.roleCardIds.includes("clara")
      || !selected.roleContextText.includes("CODEX ROLE STYLE")
      || !selected.roleContextText.includes("CLARA ROLE STYLE")
    ) {
      throw new Error(`All-agent role context followed the selected line: ${JSON.stringify(selected)}`);
    }

    const filteredRoleContext = await page.evaluate(() => {
      const filter = document.querySelector("#sharedLineAgentFilter");
      filter.value = "clara";
      filter.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        ids: [...document.querySelectorAll("[data-agent-role-id]")].map((card) => card.dataset.agentRoleId),
        text: document.querySelector("#sharedLineAgentStatePanel")?.textContent || ""
      };
    });
    if (
      filteredRoleContext.ids.length !== 1
      || filteredRoleContext.ids[0] !== "clara"
      || !filteredRoleContext.text.includes("CLARA ROLE STYLE")
      || filteredRoleContext.text.includes("CODEX ROLE STYLE")
    ) {
      throw new Error(`Agent view did not own role-card selection: ${JSON.stringify(filteredRoleContext)}`);
    }
    await page.click("[data-shared-line-open='agents']");
    const singleAgentLayout = await page.evaluate(() => {
      const grid = document.querySelector("#sharedLineAgentStatePanel").getBoundingClientRect();
      const card = document.querySelector("#sharedLineAgentStatePanel .shared-line-agent-role-card").getBoundingClientRect();
      const fields = document.querySelector("#sharedLineAgentStatePanel .shared-line-agent-role-fields");
      return {
        fillsRow: Math.abs(card.left - grid.left) < 2 && Math.abs(card.right - grid.right) < 2,
        fieldColumns: getComputedStyle(fields).gridTemplateColumns.split(" ").length,
        horizontalOverflow: document.querySelector("#sharedLineDetailDialog").scrollWidth > document.querySelector("#sharedLineDetailDialog").clientWidth + 1
      };
    });
    if (!singleAgentLayout.fillsRow || singleAgentLayout.fieldColumns !== 2 || singleAgentLayout.horizontalOverflow) {
      throw new Error(`Single Agent role card did not adapt to the reader width: ${JSON.stringify(singleAgentLayout)}`);
    }
    if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, "shared-line-single-agent.png"), fullPage: false });
    await page.click("#sharedLineDialogClose");
    await page.evaluate(() => {
      const filter = document.querySelector("#sharedLineAgentFilter");
      filter.value = "";
      filter.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await page.click("[data-shared-line-open='evidence']");
    await page.waitForFunction(() => document.querySelector("#sharedLineDetailDialog")?.open === true);
    const advancedText = await page.textContent("#sharedLineDialogEvidence");
    if (screenshotRoot) await page.screenshot({ path: path.join(screenshotRoot, "shared-line-evidence.png"), fullPage: false });
    if (!advancedText.includes("PARALLEL PAST") || advancedText.includes("ACTIVE PAST")) {
      throw new Error(`Advanced evidence leaked across lines: ${advancedText}`);
    }
    const advancedFlow = await page.$eval("#sharedLineDetailDialog", (detail) => ({
      bodyOverflowY: getComputedStyle(document.querySelector("#sharedLineDialogEvidence")).overflowY,
      nestedScrollers: [...document.querySelectorAll("#sharedLineDialogEvidence *")].filter((item) => getComputedStyle(item).overflowY === "auto").length,
      scrollbarWidth: getComputedStyle(detail).scrollbarWidth,
      horizontalOverflow: detail.scrollWidth > detail.clientWidth + 1,
      closeInHeader: (() => {
        const close = document.querySelector("#sharedLineDialogClose").getBoundingClientRect();
        const head = detail.querySelector(".memory-dialog-head").getBoundingClientRect();
        return close.top >= head.top && close.bottom <= head.bottom + 1;
      })(),
      open: detail.open
    }));
    if (
      !advancedFlow.open
      || advancedFlow.bodyOverflowY === "auto"
      || advancedFlow.nestedScrollers !== 0
      || advancedFlow.scrollbarWidth !== "none"
      || advancedFlow.horizontalOverflow
      || !advancedFlow.closeInHeader
    ) {
      throw new Error(`Advanced content is still trapped in an internal scroller: ${JSON.stringify(advancedFlow)}`);
    }
    await page.click("#sharedLineDialogClose");

    await page.click("[data-shared-line-open='archive']");
    const archiveText = await page.textContent("#sharedLineArchiveList");
    if (!archiveText.includes("Already traveled line")) throw new Error(`Archived line not shown read-only: ${archiveText}`);
    const archiveLayout = await page.$eval("#sharedLineArchiveList", (list) => ({
      listFits: list.scrollWidth <= list.clientWidth + 1,
      itemsFit: [...list.querySelectorAll(".shared-line-archive-item")].every((item) => item.scrollWidth <= item.clientWidth + 1),
      lineClamp: getComputedStyle(list.querySelector(".shared-line-archive-item p")).webkitLineClamp
    }));
    if (!archiveLayout.listFits || !archiveLayout.itemsFit || archiveLayout.lineClamp !== "2") {
      throw new Error(`Archived line text escaped the rail: ${JSON.stringify(archiveLayout)}`);
    }
    await page.click("#sharedLineDialogClose");

    await page.evaluate(() => refresh());
    await page.waitForFunction(
      () => document.querySelector("#sharedLineSummary")?.textContent.includes("PARALLEL NOW"),
      null,
      { timeout: 15000 }
    );
    const refreshed = await page.evaluate(async () => ({
      title: document.querySelector("#sharedLineDetailTitle")?.textContent || "",
      now: document.querySelector("#sharedLineSummary")?.textContent || "",
      activeLineId: (await window.ClaraCoreDesktop.getRuntimeSnapshot()).sharedLine.lineId
    }));
    if (!refreshed.title.includes("Parallel continuity") || !refreshed.now.includes("PARALLEL NOW") || refreshed.activeLineId !== seeded.activeLineId) {
      throw new Error(`Runtime refresh did not preserve human selection: ${JSON.stringify(refreshed)}`);
    }

    await clickSharedLine(page, seeded.sparseLineId);
    await page.waitForFunction(() => document.querySelector("#sharedLineDetailTitle")?.textContent.includes("Sparse continuity"));
    const sparse = await page.evaluate(() => ({
      now: document.querySelector("#sharedLineSummary")?.textContent || "",
      past: document.querySelector("#sharedLinePast")?.textContent || "",
      next: document.querySelector("#sharedLineNext")?.textContent || "",
      understandingHidden: document.querySelector("#sharedLineUnderstandingSection")?.hidden,
      unresolvedHidden: document.querySelector("#sharedLineUnresolvedSection")?.hidden
    }));
    if (!sparse.now || !sparse.past || !sparse.next || !sparse.understandingHidden || !sparse.unresolvedHidden) {
      throw new Error(`Sparse line did not degrade gracefully: ${JSON.stringify(sparse)}`);
    }

    const finalSnapshot = await page.evaluate(() => window.ClaraCoreDesktop.getRuntimeSnapshot());
    if (!finalSnapshot.data.databasePath.startsWith(dataRoot)) {
      throw new Error(`Shared Line UI escaped isolated data root: ${finalSnapshot.data.databasePath}`);
    }

    await app.close();
    console.log(JSON.stringify({
      ok: true,
      dataRoot,
      databasePath: finalSnapshot.data.databasePath,
      selectedLineLeakage: "passed",
      selectionDoesNotActivate: "passed",
      selectionKeepsStableOrder: "passed",
      globalRoleContext: "passed",
      roleCardSurface: "passed",
      refreshPreservesSelection: "passed",
      readOnlyHumanSurface: "passed",
      sparseState: "passed"
    }, null, 2));
  } catch (error) {
    if (app) await app.close().catch(() => {});
    console.error(error);
    process.exit(1);
  }
}

main();
