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
        CLARACORE_DESKTOP_DATA_DIR: dataRoot
      }
    });
    const page = await app.firstWindow();
    await page.waitForSelector("[data-view='innerlife']", { timeout: 15000 });
    await page.click("[data-view='innerlife']");
    await page.waitForFunction(() => window.ClaraCoreDesktop && document.querySelector("#startInnerLifeSession"), null, {
      timeout: 15000
    });
    await page.waitForFunction(() => document.querySelector("#innerLifeDoctorStatus")?.textContent.includes("ok"), null, {
      timeout: 15000
    });

    await page.click("#startInnerLifeSession");
    await page.waitForFunction(() => document.querySelector("#innerLifeSessionList")?.textContent.includes("active"), null, {
      timeout: 15000
    });
    await page.fill("#innerLifeSessionSummary", "UI InnerLife session ended with a reviewable afterthought.");
    await page.click("#endInnerLifeSession");
    await page.waitForFunction(() => document.querySelector("#innerLifeSessionList")?.textContent.includes("ended"), null, {
      timeout: 15000
    });
    await page.waitForFunction(() => document.querySelector("#innerLifeShareList")?.textContent.includes("Session afterthought"), null, {
      timeout: 15000
    });
    await page.fill("#innerLifeInboxInput", "UI inbox item should appear in the next InnerLife process once.");
    await page.click("#submitInnerLifeInbox");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.innerLife.counts.pending_inbox_count === 1;
    }, null, { timeout: 15000 });
    await page.click("#processInnerLifeOnce");
    await page.waitForFunction(() => document.querySelector("#innerLifeShareList")?.textContent.includes("UI inbox item should appear"), null, {
      timeout: 15000
    });
    const firstApproveButton = page.locator("[data-innerlife-action='approve']").first();
    await firstApproveButton.click();
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.innerLife.counts.approved_shares_count === 1 && document.querySelector("[data-innerlife-action='used']");
    }, null, { timeout: 15000 });
    await page.fill("#innerLifeShareContext", "The user asked to use the UI inbox item and approved InnerLife output now.");
    await page.click("#checkInnerLifeShareTiming");
    await page.waitForFunction(() => document.querySelector("#innerLifeShareCheckList")?.textContent.includes("use"), null, {
      timeout: 15000
    });
    const usedButton = page.locator("[data-innerlife-action='used']").first();
    await usedButton.click();
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.innerLife.counts.used_shares_count === 1;
    }, null, { timeout: 15000 });
    await page.click("#enableInnerLifeDaemon");
    await page.waitForFunction(() => document.querySelector("#innerLifeDaemonStatus")?.textContent.includes("enabled"), null, {
      timeout: 15000
    });
    await page.click("#tickInnerLifeDaemon");
    await page.waitForFunction(() => document.querySelector("#innerLifeLastResult")?.textContent.includes("idle"), null, {
      timeout: 15000
    });
    await page.click("#pauseInnerLifeDaemon");
    await page.waitForFunction(() => document.querySelector("#innerLifeDaemonStatus")?.textContent.includes("paused"), null, {
      timeout: 15000
    });
    await page.fill("#innerLifeInboxInput", "UI digest item should appear in the digest list.");
    await page.click("#submitInnerLifeInbox");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.innerLife.counts.pending_inbox_count === 1;
    }, null, { timeout: 15000 });
    await page.click("#runInnerLifeDigest");
    await page.waitForFunction(() => document.querySelector("#innerLifeDigestList")?.textContent.includes("Current position"), null, {
      timeout: 15000
    });

    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        databasePath: snapshot.data.databasePath,
        activeSessions: snapshot.innerLife.counts.active_sessions_count,
        endedSessions: snapshot.innerLife.counts.ended_sessions_count,
        pendingShares: snapshot.innerLife.counts.pending_shares_count,
        pendingInbox: snapshot.innerLife.counts.pending_inbox_count,
        processedInbox: snapshot.innerLife.counts.processed_inbox_count,
        usedShares: snapshot.innerLife.counts.used_shares_count,
        digestRuns: snapshot.innerLife.counts.digest_runs_count,
        shareChecks: snapshot.innerLife.counts.share_checks_count,
        daemonStatus: snapshot.innerLife.daemon.status,
        daemonTicks: snapshot.innerLife.daemon.tickCount,
        doctorStatus: snapshot.innerLife.doctor.status,
        sessionText: document.querySelector("#innerLifeSessionList").textContent,
        digestText: document.querySelector("#innerLifeDigestList").textContent,
        shareCheckText: document.querySelector("#innerLifeShareCheckList").textContent,
        doctorText: document.querySelector("#innerLifeDoctorList").textContent
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`InnerLife UI wrote outside product data root: ${result.databasePath}`);
    }
    if (result.activeSessions !== 0 || result.endedSessions !== 1) {
      throw new Error(`InnerLife UI session counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.pendingShares !== 1 || result.usedShares !== 1) {
      throw new Error(`InnerLife UI share counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.pendingInbox !== 0 || result.processedInbox !== 3) {
      throw new Error(`InnerLife UI inbox counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.digestRuns !== 1 || result.shareChecks !== 1) {
      throw new Error(`InnerLife UI digest/share check counts mismatch: ${JSON.stringify(result)}`);
    }
    if (result.daemonStatus !== "paused" || result.daemonTicks !== 1) {
      throw new Error(`InnerLife UI daemon state mismatch: ${JSON.stringify(result)}`);
    }
    if (result.doctorStatus !== "ok" || !result.doctorText.includes("healthy")) {
      throw new Error(`InnerLife UI doctor state mismatch: ${JSON.stringify(result)}`);
    }
    if (!result.sessionText.includes("UI InnerLife session ended")) {
      throw new Error(`InnerLife UI session list missing summary: ${result.sessionText}`);
    }
    if (!result.digestText.includes("Current position")) {
      throw new Error(`InnerLife UI digest list missing digest result: ${result.digestText}`);
    }
    if (!result.shareCheckText.includes("use")) {
      throw new Error(`InnerLife UI share check list missing timing decision: ${result.shareCheckText}`);
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: result.databasePath,
          endedSessions: result.endedSessions,
          pendingShares: result.pendingShares,
          usedShares: result.usedShares,
          processedInbox: result.processedInbox,
          digestRuns: result.digestRuns,
          shareChecks: result.shareChecks,
          daemonStatus: result.daemonStatus,
          daemonTicks: result.daemonTicks,
          doctorStatus: result.doctorStatus
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
