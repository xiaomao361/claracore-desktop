const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function lifecycleFingerprint(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return JSON.stringify({
      profiles: database.prepare(`
        SELECT agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at
        FROM innerlife_profiles ORDER BY agent_id
      `).all(),
      shares: database.prepare(`
        SELECT id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at
        FROM innerlife_shares ORDER BY id
      `).all(),
      actions: database.prepare(`
        SELECT id, share_id, agent_id, action, reason, metadata_json, created_at
        FROM innerlife_share_actions ORDER BY id
      `).all(),
      checks: database.prepare(`
        SELECT id, share_id, agent_id, session_id, context, decision, reason, metadata_json, created_at
        FROM innerlife_share_checks ORDER BY id
      `).all(),
      daemon: database.prepare(`
        SELECT agent_id, enabled, status, last_tick_at, next_run_at, last_result, last_error, tick_count, metadata_json, updated_at
        FROM innerlife_daemon_state ORDER BY agent_id
      `).all()
    });
  } finally {
    database.close();
  }
}

async function createShare(page, agentId, summary) {
  return page.evaluate(async ({ agentId: id, summary: body }) => {
    const started = await window.ClaraCoreDesktop.startInnerLifeSession({
      agentId: id,
      userId: "local-user",
      host: "agent",
      externalSessionId: `${id}-${Date.now()}-${Math.random()}`
    });
    const sessionId = started.session?.id || started.id;
    const ended = await window.ClaraCoreDesktop.endInnerLifeSession(sessionId, { agentId: id, summary: body });
    return ended.share;
  }, { agentId, summary });
}

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase5-innerlife-ui-"));
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
    await page.waitForSelector("[data-view='innerlife']", { timeout: 15000 });
    await page.waitForFunction(() => window.ClaraCoreDesktop, null, { timeout: 15000 });
    await page.click("[data-view='innerlife']");
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    const emptyState = await page.evaluate(() => ({
      selectorDisabled: document.querySelector("#innerLifeAgentFilter")?.disabled,
      focus: document.querySelector("#innerLifeFocus")?.textContent || "",
      thoughts: document.querySelectorAll("#innerLifeUnsharedList .innerlife-thought").length,
      mutationControls: document.querySelectorAll("#innerlifeView input, #innerlifeView textarea, #innerLifeDaemonToggle, #saveInnerLifeProfile").length,
      shellLeft: document.querySelector(".innerlife-shell")?.getBoundingClientRect().left,
      readerLeft: document.querySelector(".innerlife-reader")?.getBoundingClientRect().left,
      shellPaddingLeft: Number.parseFloat(getComputedStyle(document.querySelector(".innerlife-shell")).paddingLeft)
    }));
    if (!emptyState.selectorDisabled || !emptyState.focus || emptyState.thoughts !== 0 || emptyState.mutationControls !== 0 || Math.abs(emptyState.shellLeft + emptyState.shellPaddingLeft - emptyState.readerLeft) > 1) {
      throw new Error(`InnerLife empty state is not quiet and read-only: ${JSON.stringify(emptyState)}`);
    }
    await page.evaluate(async () => {
      await window.ClaraCoreDesktop.saveSettings({ "innerlife.provider": "disabled" });
      await window.ClaraCoreDesktop.updateInnerLifeProfile({
        agentId: "codex",
        displayName: "Codex",
        profile: { share_policy: { default_mode: "when_relevant" } },
        state: {
          recent_focus: "Keep read paths observational and delivery claims auditable.",
          current_interests: ["read-only UI", "delivery evidence"]
        }
      });
      await window.ClaraCoreDesktop.updateInnerLifeProfile({
        agentId: "lara",
        displayName: "Lara",
        profile: {},
        state: { recent_focus: "Keep Lara's thoughts separate.", current_interests: ["agent isolation"] }
      });
    });

    const pending = await createShare(page, "codex", "PENDING THOUGHT: Reading this complete thought must not share it.");
    const approved = await createShare(page, "codex", "APPROVED UNDELIVERED: Approval alone is not conversational delivery.");
    const deferred = await createShare(page, "codex", "DEFERRED THOUGHT: This remains readable but unshared.");
    const delivered = await createShare(page, "codex", "DELIVERED THOUGHT: This was actually included in a response.");
    await createShare(page, "lara", "LARA ONLY THOUGHT: This must never leak into the Codex view.");
    const stale = await createShare(page, "stale-agent", "STALE ID THOUGHT: No profile should mean no selector entry.");

    const databasePath = path.join(dataRoot, "claracore.db");
    const fixtureDatabase = new DatabaseSync(databasePath);
    fixtureDatabase.prepare("DELETE FROM innerlife_profiles WHERE agent_id = ?").run("stale-agent");
    fixtureDatabase.close();

    await page.evaluate(async ({ approvedId, deferredId, deliveredId, staleId }) => {
      await window.ClaraCoreDesktop.reviewInnerLifeShare(approvedId, "approve", "agent approved, not delivered");
      await window.ClaraCoreDesktop.markInnerLifeShare(deferredId, "deferred", "wait for a fitting conversation");
      await window.ClaraCoreDesktop.reviewInnerLifeShare(deliveredId, "approve", "ready to share");
      await window.ClaraCoreDesktop.markInnerLifeShare(
        deliveredId,
        "used",
        "shared in the conversation",
        {
          conversationId: "phase5-ui-conversation",
          responseId: "phase5-ui-response",
          responseExcerpt: "The response actually included the delivered InnerLife thought.",
          sharedAt: "2026-07-16T10:00:00.000Z",
          source: "phase5-ui-smoke"
        }
      );
      await window.ClaraCoreDesktop.markInnerLifeShare(staleId, "discarded", "stale fixture");
    }, {
      approvedId: approved.id,
      deferredId: deferred.id,
      deliveredId: delivered.id,
      staleId: stale.id
    });

    for (let index = 0; index < 22; index += 1) {
      await createShare(page, "codex", `NEWER WAITING THOUGHT ${index}: keeps the unshared queue busy.`);
    }
    const orderingDatabase = new DatabaseSync(databasePath);
    orderingDatabase.prepare(`
      UPDATE innerlife_shares
      SET updated_at = '2099-01-01 00:00:00'
      WHERE id IN (?, ?, ?)
    `).run(pending.id, approved.id, deferred.id);
    orderingDatabase.close();

    await page.click("[data-view='innerlife']");
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.waitForFunction(
      () => document.querySelector("#innerLifeUnsharedList")?.textContent.includes("APPROVED UNDELIVERED"),
      null,
      { timeout: 15000 }
    );

    const before = lifecycleFingerprint(databasePath);

    await page.selectOption("#innerLifeAgentFilter", "lara");
    await page.waitForFunction(() => document.querySelector("#innerLifeUnsharedList")?.textContent.includes("LARA ONLY THOUGHT"));
    await page.selectOption("#innerLifeAgentFilter", "codex");
    const readerStructure = await page.evaluate(() => ({
      thoughtCards: document.querySelectorAll("#innerLifeUnsharedList .innerlife-thought").length,
      sharedRows: document.querySelectorAll("#innerLifeSharedList .innerlife-archive-row").length,
      processSteps: document.querySelectorAll("#innerLifeProcessFlow button").length,
      processBeforeThoughts: Boolean(
        document.querySelector(".innerlife-process-section")?.compareDocumentPosition(document.querySelector(".innerlife-primary-section"))
        & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      insightEntries: document.querySelectorAll(".innerlife-insight-grid button").length,
      nestedDetails: document.querySelectorAll("#innerlifeView details").length,
      hasSingleReader: Boolean(document.querySelector("#innerLifeDetailDialog"))
    }));
    const thoughtCardLayout = await page.evaluate(() => {
      const card = document.querySelector("#innerLifeUnsharedList .innerlife-thought");
      const body = card?.querySelector("p")?.getBoundingClientRect();
      const action = card?.querySelector(".innerlife-read-more")?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      return {
        bodyBottom: body?.bottom,
        actionTop: action?.top,
        actionBottom: action?.bottom,
        cardBottom: cardRect?.bottom
      };
    });
    if (
      thoughtCardLayout.actionTop < thoughtCardLayout.bodyBottom ||
      thoughtCardLayout.actionBottom > thoughtCardLayout.cardBottom
    ) {
      throw new Error(`InnerLife read action overlaps or escapes thought content: ${JSON.stringify(thoughtCardLayout)}`);
    }
    if (readerStructure.thoughtCards !== 3 || readerStructure.sharedRows !== 1 || readerStructure.processSteps !== 5 || !readerStructure.processBeforeThoughts || readerStructure.insightEntries !== 3 || readerStructure.nestedDetails !== 0 || !readerStructure.hasSingleReader) {
      throw new Error(`InnerLife reader structure is wrong: ${JSON.stringify(readerStructure)}`);
    }
    const thoughtTrigger = page.locator(`#innerLifeUnsharedList [data-innerlife-share-id="${approved.id}"]`);
    await thoughtTrigger.click();
    await page.waitForFunction(() => document.querySelector("#innerLifeDetailDialog")?.open);
    const thoughtDetail = await page.evaluate(() => {
      const head = document.querySelector(".innerlife-dialog-head")?.getBoundingClientRect();
      const close = document.querySelector("#innerLifeDetailClose")?.getBoundingClientRect();
      return {
        text: document.querySelector("#innerLifeDetailBody")?.textContent || "",
        backHidden: document.querySelector("#innerLifeDetailBack")?.hidden,
        closeRightInset: head && close ? head.right - close.right : null,
        closeInTrailingQuarter: head && close ? close.left > head.left + head.width * 0.75 : false,
        gridColumns: getComputedStyle(document.querySelector(".innerlife-dialog-head")).gridTemplateColumns
      };
    });
    if (
      !thoughtDetail.text.includes("APPROVED UNDELIVERED: Approval alone is not conversational delivery.") ||
      !thoughtDetail.backHidden ||
      thoughtDetail.closeRightInset < 17 ||
      thoughtDetail.closeRightInset > 27 ||
      !thoughtDetail.closeInTrailingQuarter ||
      thoughtDetail.gridColumns.trim().split(/\s+/).length !== 2
    ) {
      throw new Error(`Thought detail layout is wrong: ${JSON.stringify(thoughtDetail)}`);
    }
    const dialogViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    await page.setViewportSize({ width: 620, height: 900 });
    const narrowDialogLayout = await page.evaluate(() => {
      const head = document.querySelector(".innerlife-dialog-head")?.getBoundingClientRect();
      const close = document.querySelector("#innerLifeDetailClose")?.getBoundingClientRect();
      return {
        closeRightInset: head && close ? head.right - close.right : null,
        closeInTrailingQuarter: head && close ? close.left > head.left + head.width * 0.75 : false
      };
    });
    if (narrowDialogLayout.closeRightInset < 17 || narrowDialogLayout.closeRightInset > 19 || !narrowDialogLayout.closeInTrailingQuarter) {
      throw new Error(`Narrow InnerLife detail layout is wrong: ${JSON.stringify(narrowDialogLayout)}`);
    }
    await page.setViewportSize(dialogViewport);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("#innerLifeDetailDialog")?.open);
    await page.waitForFunction((id) => document.activeElement?.dataset?.innerlifeShareId === id, approved.id);
    const focusState = await page.evaluate((id) => ({
      restored: document.activeElement?.dataset?.innerlifeShareId === id,
      activeId: document.activeElement?.id || "",
      activeClass: document.activeElement?.className || "",
      activeShareId: document.activeElement?.dataset?.innerlifeShareId || ""
    }), approved.id);
    if (!focusState.restored) throw new Error(`InnerLife dialog did not restore focus to its trigger: ${JSON.stringify(focusState)}`);

    await page.click('[data-innerlife-open="profile"]');
    await page.waitForFunction(() => document.querySelector("#innerLifeDetailDialog")?.open);
    const profileDetail = await page.evaluate(() => ({
      text: document.querySelector("#innerLifeDetailBody")?.textContent || "",
      rawVisible: Boolean(document.querySelector("#innerLifeDetailBody pre"))
    }));
    if (!profileDetail.text.includes("与当前对话相关时分享") || profileDetail.rawVisible) {
      throw new Error(`Profile explanation is not human-first: ${JSON.stringify(profileDetail)}`);
    }
    await page.click('[data-innerlife-open="raw-profile"]');
    const rawDetail = await page.evaluate(() => ({
      preCount: document.querySelectorAll("#innerLifeDetailBody pre").length,
      maxHeights: [...document.querySelectorAll("#innerLifeDetailBody pre")].map((node) => getComputedStyle(node).maxHeight),
      backVisible: !document.querySelector("#innerLifeDetailBack")?.hidden,
      closeRightInset: (() => {
        const head = document.querySelector(".innerlife-dialog-head")?.getBoundingClientRect();
        const close = document.querySelector("#innerLifeDetailClose")?.getBoundingClientRect();
        return head && close ? head.right - close.right : null;
      })(),
      closeInTrailingQuarter: (() => {
        const head = document.querySelector(".innerlife-dialog-head")?.getBoundingClientRect();
        const close = document.querySelector("#innerLifeDetailClose")?.getBoundingClientRect();
        return head && close ? close.left > head.left + head.width * 0.75 : false;
      })(),
      gridColumns: getComputedStyle(document.querySelector(".innerlife-dialog-head")).gridTemplateColumns
    }));
    if (
      rawDetail.preCount !== 2 ||
      rawDetail.maxHeights.some((value) => value !== "none") ||
      !rawDetail.backVisible ||
      rawDetail.closeRightInset < 17 ||
      rawDetail.closeRightInset > 27 ||
      !rawDetail.closeInTrailingQuarter ||
      rawDetail.gridColumns.trim().split(/\s+/).length !== 3
    ) {
      throw new Error(`Raw configuration is not a full single-reader view: ${JSON.stringify(rawDetail)}`);
    }
    await page.click("#innerLifeDetailClose");
    await page.evaluate(() => {
      const thought = document.querySelector("#innerLifeUnsharedList .innerlife-thought");
      thought?.scrollIntoView({ block: "center" });
    });
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.click("[data-view='settings']");
    await page.click("[data-settings-tab='app-data']");
    await page.selectOption("#settingsLanguage", "zh");
    await page.selectOption("#settingsTheme", "dark");
    await page.click("#saveAppearanceSettings");
    await page.click("[data-view='innerlife']");
    await page.waitForFunction(() => document.querySelector("#innerLifeUnsharedList")?.textContent.includes("APPROVED UNDELIVERED"));

    const after = lifecycleFingerprint(databasePath);
    if (after !== before) {
      throw new Error(`InnerLife reading changed lifecycle state.\nBEFORE ${before}\nAFTER ${after}`);
    }

    const result = await page.evaluate(({ pendingId, approvedId, deferredId, deliveredId }) => ({
      title: document.querySelector("#viewTitle")?.textContent || "",
      profileOptions: [...document.querySelectorAll("#innerLifeAgentFilter option")].map((option) => option.value),
      profileOptionLabels: [...document.querySelectorAll("#innerLifeAgentFilter option")].map((option) => option.textContent.trim()),
      focus: document.querySelector("#innerLifeFocus")?.textContent || "",
      interests: document.querySelector("#innerLifeInterests")?.textContent || "",
      unsharedText: document.querySelector("#innerLifeUnsharedList")?.textContent || "",
      sharedText: document.querySelector("#innerLifeSharedList")?.textContent || "",
      unsharedIds: [...document.querySelectorAll("#innerLifeUnsharedList [data-innerlife-share-id]")].map((node) => node.dataset.innerlifeShareId),
      sharedIds: [...document.querySelectorAll("#innerLifeSharedList [data-innerlife-share-id]")].map((node) => node.dataset.innerlifeShareId),
      focusBlock: Boolean(document.querySelector("#innerlifeView > .page-focus")),
      mutationControls: document.querySelectorAll("#innerlifeView input, #innerlifeView textarea, #innerLifeDaemonToggle, #saveInnerLifeProfile").length,
      daemonToggle: Boolean(document.querySelector("#innerLifeDaemonToggle")),
      profileEditor: Boolean(document.querySelector("#saveInnerLifeProfile, #innerLifeProfileJson, #innerLifeStateJson")),
      pendingId,
      approvedId,
      deferredId,
      deliveredId
    }), {
      pendingId: pending.id,
      approvedId: approved.id,
      deferredId: deferred.id,
      deliveredId: delivered.id
    });

    if (result.profileOptions.join(",") !== "codex,lara") {
      throw new Error(`InnerLife selector must come only from profiles: ${JSON.stringify(result.profileOptions)}`);
    }
    if (result.profileOptionLabels.join(",") !== "codex,lara") {
      throw new Error(`InnerLife selector labels must match the stable Agent ids used by other modules: ${JSON.stringify(result.profileOptionLabels)}`);
    }
    if (!result.focus.includes("Keep read paths observational") || !result.interests.includes("read-only UI")) {
      throw new Error(`InnerLife profile focus did not render: ${JSON.stringify(result)}`);
    }
    for (const id of [result.pendingId, result.approvedId, result.deferredId]) {
      if (!result.unsharedIds.includes(id)) throw new Error(`Undelivered share ${id} is missing from 尚未分享: ${JSON.stringify(result)}`);
      if (result.sharedIds.includes(id)) throw new Error(`Undelivered share ${id} was mislabeled as 已经分享: ${JSON.stringify(result)}`);
    }
    if (!result.sharedIds.includes(result.deliveredId) || result.unsharedIds.includes(result.deliveredId)) {
      throw new Error(`Delivered share classification is wrong: ${JSON.stringify(result)}`);
    }
    if (!result.sharedText.includes("已在对话中分享") || result.sharedText.includes("送达未验证")) {
      throw new Error(`Verified delivery evidence was lost from 已经分享: ${result.sharedText}`);
    }
    if (!result.unsharedText.includes("Reading this complete thought must not share it.") || !result.unsharedText.includes("APPROVED UNDELIVERED")) {
      throw new Error(`InnerLife did not render complete unshared thought bodies: ${result.unsharedText}`);
    }
    if (result.unsharedText.includes("LARA ONLY THOUGHT") || result.sharedText.includes("LARA ONLY THOUGHT")) {
      throw new Error(`InnerLife leaked another agent's thought: ${JSON.stringify(result)}`);
    }
    if (result.focusBlock || result.mutationControls !== 0 || result.daemonToggle || result.profileEditor) {
      throw new Error(`InnerLife human page is not read-only and quiet: ${JSON.stringify(result)}`);
    }

    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH, fullPage: true });
    }

    await app.close();
    console.log(JSON.stringify({
      ok: true,
      dataRoot,
      databasePath,
      profileOptions: result.profileOptions,
      unsharedIds: result.unsharedIds,
      sharedIds: result.sharedIds,
      sharedQueueIndependent: true,
      singleReaderDetail: true,
      processVisible: true,
      lifecycleUnchanged: true,
      readOnly: true
    }, null, 2));
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
