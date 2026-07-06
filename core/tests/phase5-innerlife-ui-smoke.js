const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase5-innerlife-ui-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot,
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    await page.waitForSelector("[data-view='innerlife']", { timeout: 15000 });
    await page.waitForFunction(() => window.ClaraCoreDesktop, null, { timeout: 15000 });
    // Pin the InnerLife provider to disabled so afterthoughts/digests stay
    // deterministic and offline; the shipping default now points at a hosted
    // provider that this UI smoke must not call over the network.
    await page.evaluate(() => window.ClaraCoreDesktop.saveSettings({ "innerlife.provider": "disabled" }));
    await page.evaluate(async () => {
      const started = await window.ClaraCoreDesktop.startInnerLifeSession({
        agentId: "codex",
        userId: "local-user",
        host: "agent",
        externalSessionId: `agent-${Date.now()}`
      });
      const sessionId =
        started.id ||
        started.session?.id ||
        (await window.ClaraCoreDesktop.getRuntimeSnapshot()).innerLife.sessions.find((session) => session.status === "active")?.id;
      await window.ClaraCoreDesktop.endInnerLifeSession(sessionId, {
        summary: "Agent InnerLife session ended with a reviewable afterthought."
      });
      for (let index = 0; index < 12; index += 1) {
        const extraStarted = await window.ClaraCoreDesktop.startInnerLifeSession({
          agentId: "codex",
          userId: "local-user",
          host: "agent",
          externalSessionId: `lazy-agent-${index}-${Date.now()}`
        });
        const extraSessionId =
          extraStarted.id ||
          extraStarted.session?.id ||
          (await window.ClaraCoreDesktop.getRuntimeSnapshot()).innerLife.sessions.find((session) => session.status === "active")?.id;
        await window.ClaraCoreDesktop.endInnerLifeSession(extraSessionId, {
          summary: `Lazy loaded InnerLife session ${index}`
        });
      }
      await window.ClaraCoreDesktop.submitInnerLifeInbox({
        agentId: "codex",
        source: "agent",
        body: "Agent inbox item should render in the read-only InnerLife page."
      });
      await window.ClaraCoreDesktop.processInnerLifeOnce({});
      await window.ClaraCoreDesktop.checkInnerLifeShareTiming({
        context: "Agent asked whether an InnerLife share should be used now."
      });
      await window.ClaraCoreDesktop.runInnerLifeDigest({
        mode: "agent",
        prompt: "Summarize current agent-owned InnerLife state."
      });
    });
    await page.click("[data-view='innerlife']");
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.waitForFunction(() => document.querySelector("#innerLifeDoctorStatus")?.textContent.includes("ok"), null, {
      timeout: 15000
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#innerLifeShareList")?.textContent.includes("Agent inbox item should render") &&
        document.querySelector("#innerLifeSessionList")?.textContent.includes("Lazy loaded InnerLife session 11"),
      null,
      { timeout: 15000 }
    );
    await page.evaluate(() => {
      const pipeline = document.querySelector(".innerlife-pipeline-details");
      if (pipeline) pipeline.open = true;
    });
    await page.click("#loadMoreInnerLifeSessions");
    await page.waitForFunction(
      () => document.querySelector("#innerLifeSessionList")?.textContent.includes("Agent InnerLife session ended"),
      null,
      { timeout: 15000 }
    );

    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      const removedSelectors = [
        "#startInnerLifeSession",
        "#endInnerLifeSession",
        "#runInnerLifeDigest",
        "#processInnerLifeOnce",
        "#innerLifeInboxInput",
        "#submitInnerLifeInbox",
        "#innerLifeShareContext",
        "#checkInnerLifeShareTiming",
        "#tickInnerLifeDaemon",
        "[data-innerlife-action]"
      ];
      return {
        databasePath: snapshot.data.databasePath,
        activeSessions: snapshot.innerLife.counts.active_sessions_count,
        endedSessions: snapshot.innerLife.counts.ended_sessions_count,
        pendingShares: snapshot.innerLife.counts.pending_shares_count,
        processedInbox: snapshot.innerLife.counts.processed_inbox_count,
        digestRuns: snapshot.innerLife.counts.digest_runs_count,
        shareChecks: snapshot.innerLife.counts.share_checks_count,
        doctorStatus: snapshot.innerLife.doctor.status,
        missingManualControls: removedSelectors.every((selector) => !document.querySelector(selector)),
        sessionText: document.querySelector("#innerLifeSessionList").textContent,
        digestText: document.querySelector("#innerLifeDigestList").textContent,
        shareCheckText: document.querySelector("#innerLifeShareCheckList").textContent,
        shareText: document.querySelector("#innerLifeShareList").textContent,
        doctorText: document.querySelector("#innerLifeDoctorList").textContent,
        hasDaemonToggle: Boolean(document.querySelector("#innerLifeDaemonToggle")),
        loadMoreHidden: document.querySelector("#loadMoreInnerLifeSessions")?.hidden
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`InnerLife UI wrote outside product data root: ${result.databasePath}`);
    }
    if (!result.missingManualControls) {
      throw new Error("InnerLife UI still exposes manual operation controls.");
    }
    if (!result.hasDaemonToggle) {
      throw new Error("InnerLife UI is missing the human daemon switch.");
    }
    if (result.activeSessions !== 0 || result.endedSessions !== 13) {
      throw new Error(`InnerLife UI session counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.pendingShares < 1 || result.processedInbox < 1) {
      throw new Error(`InnerLife UI queue counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.digestRuns !== 1 || result.shareChecks !== 1) {
      throw new Error(`InnerLife UI digest/share check counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.doctorStatus !== "ok" || !result.doctorText.includes("healthy")) {
      throw new Error(`InnerLife UI doctor state mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.digestText.includes("Current position")) {
      throw new Error(`InnerLife UI digest list missing digest result: ${result.digestText}`);
    }
    if (!result.shareCheckText.includes("use")) {
      throw new Error(`InnerLife UI share check list missing timing decision: ${result.shareCheckText}`);
    }
    if (!result.shareText.includes("Agent inbox item should render")) {
      throw new Error(`InnerLife UI share list missing generated share: ${result.shareText}`);
    }
    if (result.loadMoreHidden !== true) {
      throw new Error(`InnerLife session lazy loading did not exhaust the session page: ${JSON.stringify(result)}`);
    }
    await page.click("#innerLifeDaemonToggle");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.innerLife.daemon.enabled === true && document.querySelector("#innerLifeDaemonToggle")?.getAttribute("aria-pressed") === "true";
    }, null, { timeout: 15000 });
    await page.click("#innerLifeDaemonToggle");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.innerLife.daemon.enabled === false && document.querySelector("#innerLifeDaemonToggle")?.getAttribute("aria-pressed") === "false";
    }, null, { timeout: 15000 });

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: result.databasePath,
          endedSessions: result.endedSessions,
          pendingShares: result.pendingShares,
          processedInbox: result.processedInbox,
          digestRuns: result.digestRuns,
          shareChecks: result.shareChecks,
          doctorStatus: result.doctorStatus,
          readOnly: result.missingManualControls,
          daemonSwitch: result.hasDaemonToggle
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
