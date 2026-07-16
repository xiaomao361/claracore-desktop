const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase3-shared-line-ui-"));
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
      await window.ClaraCoreDesktop.archiveSharedLine(archived.sharedLine.lineId);
      return { activeLineId, parallelLineId, sparseLineId: sparse.sharedLine.lineId };
    });

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
      mutationControls: document.querySelectorAll("#sharedLineView button, #sharedLineView input, #sharedLineView textarea").length,
      advancedOpen: document.querySelector("#sharedLineAdvancedDetails")?.open,
      archiveOpen: document.querySelector("#sharedLineArchiveDetails")?.open
    }));
    if (removedHumanControls.resume || removedHumanControls.copy || removedHumanControls.archive || removedHumanControls.mutationControls) {
      throw new Error(`Shared Line human mutation/resume controls remain: ${JSON.stringify(removedHumanControls)}`);
    }
    if (removedHumanControls.advancedOpen || removedHumanControls.archiveOpen) {
      throw new Error(`Shared Line disclosures should start closed: ${JSON.stringify(removedHumanControls)}`);
    }

    await page.click(`[data-shared-line-id='${seeded.parallelLineId}']`);
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
        selectedCount: document.querySelectorAll("#sharedLineList [aria-selected='true']").length
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

    await page.click("#sharedLineAdvancedDetails > summary");
    await page.waitForFunction(() => document.querySelector("#sharedLineAdvancedDetails")?.open === true);
    const advancedText = await page.textContent("#sharedLineAdvancedDetails");
    if (!advancedText.includes("PARALLEL PAST") || advancedText.includes("ACTIVE PAST")) {
      throw new Error(`Advanced evidence leaked across lines: ${advancedText}`);
    }
    await page.click("#sharedLineAdvancedDetails > summary");
    if (await page.$eval("#sharedLineAdvancedDetails", (details) => details.open)) {
      throw new Error("Advanced disclosure did not close again.");
    }

    await page.click("#sharedLineArchiveDetails > summary");
    const archiveText = await page.textContent("#sharedLineArchiveList");
    if (!archiveText.includes("Already traveled line")) throw new Error(`Archived line not shown read-only: ${archiveText}`);

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

    await page.click(`[data-shared-line-id='${seeded.sparseLineId}']`);
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
