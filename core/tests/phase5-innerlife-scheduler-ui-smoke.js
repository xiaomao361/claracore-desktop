const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase5-innerlife-scheduler-ui-"));
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
    await page.waitForSelector("[data-view='innerlife']", { timeout: 15000 });
    await page.waitForFunction(() => window.ClaraCoreDesktop && document.querySelector("#innerLifeInboxInput"), null, {
      timeout: 15000
    });
    await page.evaluate(async () => {
      await window.ClaraCoreDesktop.saveSettings({
        "innerlife.loop_seconds": 1
      });
    });
    await page.click("[data-view='innerlife']");
    await page.fill("#innerLifeInboxInput", "Scheduler UI inbox item should be processed automatically.");
    await page.click("#submitInnerLifeInbox");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.innerLife.counts.pending_inbox_count === 1;
    }, null, { timeout: 15000 });
    await page.click("#enableInnerLifeDaemon");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return (
        snapshot.innerLife.daemon.tickCount >= 1 &&
        snapshot.innerLife.counts.pending_inbox_count === 0 &&
        snapshot.innerLife.counts.pending_shares_count === 1 &&
        snapshot.innerLife.pendingShares.some((share) =>
          String(share.body || "").includes("Scheduler UI inbox item should be processed automatically.")
        )
      );
    }, null, { timeout: 15000 });
    await page.waitForFunction(
      () =>
        document.querySelector("#innerLifeLastResult")?.textContent.includes("processed") &&
        document.querySelector("#innerLifeShareList")?.textContent.includes("Scheduler UI inbox item"),
      null,
      { timeout: 15000 }
    );
    const processedState = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        daemonLastResult: snapshot.innerLife.daemon.lastResult,
        daemonTicks: snapshot.innerLife.daemon.tickCount,
        renderedLastResult: document.querySelector("#innerLifeLastResult")?.textContent || ""
      };
    });
    await page.click("#pauseInnerLifeDaemon");
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
          shareText: document.querySelector("#innerLifeShareList").textContent
        };
      });
      if (result.daemonStatus === "paused" && result.daemonEnabled === false) break;
      await page.waitForTimeout(250);
    }
    result.daemonLastResult = processedState.daemonLastResult;
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`InnerLife scheduler UI wrote outside product data root: ${result.databasePath}`);
    }
    if (result.pendingShares !== 1 || result.pendingInbox !== 0 || result.processedInbox !== 1) {
      throw new Error(`InnerLife scheduler UI counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.daemonStatus !== "paused" || result.daemonTicks < 1) {
      throw new Error(`InnerLife scheduler UI daemon mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.shareText.includes("Scheduler UI inbox item should be processed automatically.")) {
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
          daemonLastResult: result.daemonLastResult
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
