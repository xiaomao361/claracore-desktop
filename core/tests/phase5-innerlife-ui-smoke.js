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
      controls: document.querySelectorAll("#innerlifeView button, #innerlifeView input, #innerlifeView textarea").length
    }));
    if (!emptyState.selectorDisabled || !emptyState.focus || emptyState.thoughts !== 0 || emptyState.controls !== 0) {
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
    await page.click("#innerLifeAdvancedDetails > summary");
    await page.click("#innerLifeAdvancedDetails > summary");
    await page.evaluate(() => {
      const thought = document.querySelector("#innerLifeUnsharedList .innerlife-thought");
      thought?.scrollIntoView({ block: "center" });
    });
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.click("[data-view='settings']");
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
      focus: document.querySelector("#innerLifeFocus")?.textContent || "",
      interests: document.querySelector("#innerLifeInterests")?.textContent || "",
      unsharedText: document.querySelector("#innerLifeUnsharedList")?.textContent || "",
      sharedText: document.querySelector("#innerLifeSharedList")?.textContent || "",
      unsharedIds: [...document.querySelectorAll("#innerLifeUnsharedList [data-innerlife-share-id]")].map((node) => node.dataset.innerlifeShareId),
      sharedIds: [...document.querySelectorAll("#innerLifeSharedList [data-innerlife-share-id]")].map((node) => node.dataset.innerlifeShareId),
      advancedOpen: document.querySelector("#innerLifeAdvancedDetails")?.open,
      focusBlock: Boolean(document.querySelector("#innerlifeView > .page-focus")),
      mutationControls: document.querySelectorAll("#innerlifeView button, #innerlifeView input, #innerlifeView textarea").length,
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
    if (!result.unsharedText.includes("Reading this complete thought must not share it.") || !result.unsharedText.includes("APPROVED UNDELIVERED")) {
      throw new Error(`InnerLife did not render complete unshared thought bodies: ${result.unsharedText}`);
    }
    if (result.unsharedText.includes("LARA ONLY THOUGHT") || result.sharedText.includes("LARA ONLY THOUGHT")) {
      throw new Error(`InnerLife leaked another agent's thought: ${JSON.stringify(result)}`);
    }
    if (result.advancedOpen !== false || result.focusBlock || result.mutationControls !== 0 || result.daemonToggle || result.profileEditor) {
      throw new Error(`InnerLife human page is not read-only and quiet: ${JSON.stringify(result)}`);
    }

    await app.close();
    console.log(JSON.stringify({
      ok: true,
      dataRoot,
      databasePath,
      profileOptions: result.profileOptions,
      unsharedIds: result.unsharedIds,
      sharedIds: result.sharedIds,
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
