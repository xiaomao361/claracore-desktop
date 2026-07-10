const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase5-innerlife-scheduler-ui-"));
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
    await page.evaluate(async () => {
      await window.ClaraCoreDesktop.saveSettings({
        "innerlife.loop_seconds": 1,
        // Keep daemon processing deterministic/offline; shipping default now
        // points at a hosted provider this smoke must not call.
        "innerlife.provider": "disabled"
      });
      await window.ClaraCoreDesktop.submitInnerLifeInbox({
        agentId: "codex",
        source: "agent",
        body: "Scheduler agent item should be processed automatically."
      });
      await window.ClaraCoreDesktop.setInnerLifeDaemon({ action: "enable" });
    });
    await page.click("[data-view='innerlife']");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return (
        snapshot.innerLife.daemon.tickCount >= 1 &&
        snapshot.innerLife.counts.pending_inbox_count === 0 &&
        snapshot.innerLife.counts.pending_shares_count === 1 &&
        snapshot.innerLife.pendingShares.some((share) =>
          String(share.body || "").includes("Scheduler agent item should be processed automatically.")
        )
      );
    }, null, { timeout: 15000 });
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.waitForFunction(
      () =>
        document.querySelector("#innerLifeLastResult")?.textContent.includes("processed") &&
        document.querySelector("#innerLifeShareList")?.textContent.includes("Scheduler agent item"),
      null,
      { timeout: 15000 }
    );
    const processedState = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      await window.ClaraCoreDesktop.setInnerLifeDaemon({ action: "pause" });
      return {
        daemonLastResult: snapshot.innerLife.daemon.lastResult,
        daemonTicks: snapshot.innerLife.daemon.tickCount,
        renderedLastResult: document.querySelector("#innerLifeLastResult")?.textContent || "",
        renderedNextRun: document.querySelector("#innerLifeNextRun")?.textContent || "",
        expectedNextRun: new Date(`${snapshot.innerLife.daemon.nextRunAt.replace(" ", "T")}Z`).toLocaleString(undefined, {
          hour12: false
        })
      };
    });
    let result = null;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      result = await page.evaluate(async () => {
        const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
        return {
          databasePath: snapshot.data.databasePath,
          pendingShares: snapshot.innerLife.counts.pending_shares_count,
          pendingInbox: snapshot.innerLife.counts.pending_inbox_count,
          processedInbox: snapshot.innerLife.counts.processed_inbox_count,
          daemonStatus: snapshot.innerLife.daemon.status,
          daemonEnabled: snapshot.innerLife.daemon.enabled,
          daemonTicks: snapshot.innerLife.daemon.tickCount,
          missingManualControls:
            Boolean(document.querySelector("#innerLifeDaemonToggle")) &&
            !document.querySelector("#tickInnerLifeDaemon") &&
            !document.querySelector("#processInnerLifeOnce") &&
            !document.querySelector("[data-innerlife-action]"),
          shareText: document.querySelector("#innerLifeShareList").textContent
        };
      });
      if (result.daemonStatus === "paused" && result.daemonEnabled === false) break;
      await page.waitForTimeout(250);
    }
    result.daemonLastResult = processedState.daemonLastResult;
    if (processedState.renderedNextRun !== processedState.expectedNextRun) {
      throw new Error(`InnerLife next run should render in local time: ${JSON.stringify(processedState)}`);
    }
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`InnerLife scheduler UI wrote outside product data root: ${result.databasePath}`);
    }
    if (!result.missingManualControls) {
      throw new Error("InnerLife scheduler UI still exposes daemon operation controls.");
    }
    if (result.pendingShares !== 1 || result.pendingInbox !== 0 || result.processedInbox !== 1) {
      throw new Error(`InnerLife scheduler UI counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.daemonStatus !== "paused" || result.daemonTicks < 1) {
      throw new Error(`InnerLife scheduler UI daemon mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.shareText.includes("Scheduler agent item should be processed automatically.")) {
      throw new Error(`InnerLife scheduler UI did not render generated share: ${result.shareText}`);
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: result.databasePath,
          pendingShares: result.pendingShares,
          processedInbox: result.processedInbox,
          daemonStatus: result.daemonStatus,
          daemonTicks: result.daemonTicks,
          daemonLastResult: result.daemonLastResult,
          readOnly: result.missingManualControls
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
