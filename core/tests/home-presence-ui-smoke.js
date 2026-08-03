const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

function screenshotVariant(filePath, suffix) {
  const extension = path.extname(filePath);
  return `${filePath.slice(0, -extension.length)}-${suffix}${extension}`;
}

async function main() {
  const { _electron: electron } = require("playwright");
  const appRoot = path.resolve(__dirname, "..", "..");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-home-presence-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const appShim = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const { database } = await runtime.ensureProductCore(appShim);
  const longSharedLineSummary = [
    "Make Home a truthful shared consciousness space.",
    "当共同线同时保存较长的情绪纹理、当前判断、现实边界和下一步时，首页仍然应该保持安静、克制并且容易阅读。",
    "这里展示的是当前共同位置的预览，不应该随着正文增长而不断向下扩张，挤压地平线、智能体存在和内在活动区域。",
    "完整内容继续保留在共同线页面，首页只承担快速恢复上下文的职责。"
  ].join(" ");
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: appRoot,
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
    await page.waitForFunction(() => document.querySelector(".home-presence")?.dataset.state === "empty", null, { timeout: 15000 });
    const empty = await page.evaluate(() => {
      const presence = document.querySelector(".home-presence");
      const action = document.querySelector("#homePresenceEmptyAction");
      return {
        state: presence.dataset.state,
        busy: presence.getAttribute("aria-busy"),
        title: document.querySelector("#homePresenceTitle")?.textContent || "",
        detail: document.querySelector("#homePresenceDetail")?.textContent || "",
        horizon: document.querySelector("#homeHorizonLabel")?.textContent || "",
        actionVisible: !action.hidden,
        actionTarget: action.dataset.viewTarget || "",
        issueHidden: document.querySelector("#homeActionableIssue").hidden,
        agentCount: document.querySelectorAll("#homePresenceAgents .home-presence-agent").length,
        horizontalOverflow: presence.scrollWidth > presence.clientWidth
      };
    });
    if (
      empty.state !== "empty" ||
      empty.busy !== "false" ||
      !empty.title.includes("共同位置") ||
      empty.detail.includes("共同线仍然保持") ||
      empty.horizon !== "共同线" ||
      !empty.actionVisible ||
      empty.actionTarget !== "agent-setup" ||
      !empty.issueHidden ||
      empty.agentCount !== 0 ||
      empty.horizontalOverflow
    ) {
      throw new Error(`Empty Home presence contract failed: ${JSON.stringify(empty)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "empty") });
    }

    await page.evaluate(() => window.ClaraCoreTestHooks.setHomeState("loading"));
    const loading = await page.evaluate(() => {
      const presence = document.querySelector(".home-presence");
      return {
        state: presence.dataset.state,
        busy: presence.getAttribute("aria-busy"),
        detail: document.querySelector("#homePresenceDetail")?.textContent || "",
        actionHidden: document.querySelector("#homePresenceEmptyAction").hidden,
        sharedLineHidden: document.querySelector("#homeSharedLineSection").hidden,
        issueHidden: document.querySelector("#homeActionableIssue").hidden
      };
    });
    if (
      loading.state !== "loading" ||
      loading.busy !== "true" ||
      !loading.detail ||
      !loading.actionHidden ||
      !loading.sharedLineHidden ||
      !loading.issueHidden
    ) {
      throw new Error(`Loading Home presence contract failed: ${JSON.stringify(loading)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "loading") });
    }

    await page.evaluate(() => window.ClaraCoreTestHooks.setHomeState("error"));
    const errorState = await page.evaluate(() => {
      const presence = document.querySelector(".home-presence");
      const action = document.querySelector("#homePresenceEmptyAction");
      const issue = document.querySelector("#homeActionableIssue");
      return {
        state: presence.dataset.state,
        busy: presence.getAttribute("aria-busy"),
        actionVisible: !action.hidden,
        action: action.dataset.homeAction || "",
        actionTarget: action.dataset.viewTarget || "",
        issueRole: issue.getAttribute("role"),
        issueVisible: !issue.hidden,
        horizontalOverflow: presence.scrollWidth > presence.clientWidth
      };
    });
    if (
      errorState.state !== "error" ||
      errorState.busy !== "false" ||
      !errorState.actionVisible ||
      errorState.action !== "retry" ||
      errorState.actionTarget ||
      errorState.issueRole !== "alert" ||
      !errorState.issueVisible ||
      errorState.horizontalOverflow
    ) {
      throw new Error(`Error Home presence contract failed: ${JSON.stringify(errorState)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "error") });
    }
    await page.click("#homePresenceEmptyAction");
    await page.waitForFunction(() => document.querySelector(".home-presence")?.dataset.state === "empty");

    await runtime.saveProductSharedLine(appShim, {
      lineTitle: "Home presence direction",
      summary: longSharedLineSummary,
      interpretationStatus: "confirmed"
    });
    await database.submitInnerLifeInbox({
      agentId: "codex",
      source: "home-presence-smoke",
      body: "A long emerging thought remains readable beside the bounded Shared Line preview without either column covering the horizon, the presence markers, or the edge of the Home surface."
    });
    for (const agentId of ["codex", "clara", "hermes", "fourth-agent", "fifth-agent"]) {
      await database.recordGatewayTrace({
        agentId,
        toolName: "gateway_context",
        status: "ok",
        durationMs: 8,
        request: {},
        responseSummary: "Observed activity for Home presence smoke."
      });
    }
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.waitForFunction(
      () => document.querySelectorAll("#homePresenceAgents .home-presence-agent").length === 3 && window.ClaraCoreTestHooks?.homeVision,
      null,
      { timeout: 15000 }
    );

    const initial = await page.evaluate(() => ({
      title: document.querySelector("#homePresenceTitle")?.textContent || "",
      sharedLine: document.querySelector("#homeSharedLineText")?.textContent || "",
      emergingThought: document.querySelector("#homeEmergingText")?.textContent || "",
      sharedLineLayout: (() => {
        const presence = document.querySelector(".home-presence");
        const line = document.querySelector("#homeSharedLineText");
        const style = getComputedStyle(line);
        const lineHeight = Number.parseFloat(style.lineHeight) || 0;
        const lineRect = line.getBoundingClientRect();
        const presenceRect = presence.getBoundingClientRect();
        return {
          clientHeight: line.clientHeight,
          scrollHeight: line.scrollHeight,
          lineHeight,
          overflow: style.overflow,
          lineClamp: style.webkitLineClamp,
          bottomGap: presenceRect.bottom - lineRect.bottom
        };
      })(),
      lowerColumns: (() => {
        const sharedLineRect = document.querySelector("#homeSharedLineSection").getBoundingClientRect();
        const emergingRect = document.querySelector("#homeEmergingSection").getBoundingClientRect();
        const presenceRect = document.querySelector(".home-presence").getBoundingClientRect();
        return {
          separated: sharedLineRect.right < emergingRect.left,
          alignedBottom: Math.abs(sharedLineRect.bottom - emergingRect.bottom) <= 1,
          emergingBottomGap: presenceRect.bottom - emergingRect.bottom
        };
      })(),
      container: (() => {
        const style = getComputedStyle(document.querySelector(".home-presence"));
        return {
          borderRadius: style.borderRadius,
          borderTopWidth: style.borderTopWidth,
          borderTopStyle: style.borderTopStyle,
          backgroundImage: style.backgroundImage
        };
      })(),
      agents: [...document.querySelectorAll("#homePresenceAgents .home-presence-agent")].map((node) => ({
        label: node.textContent.trim(),
        color: node.style.getPropertyValue("--agent-color")
      })).sort((left, right) => left.label.localeCompare(right.label)),
      legacyPeriods: document.querySelectorAll("[data-agent-activity-period]").length,
      legacyModules: document.querySelectorAll("#homeView .module-card").length,
      legacyRuntime: Boolean(document.querySelector("#homeRuntimeDetails")),
      focusBlock: Boolean(document.querySelector("#homeView > .page-focus")),
      vision: window.ClaraCoreTestHooks.homeVision()
    }));
    if (
      initial.agents.length !== 3 ||
      !initial.sharedLine.includes("truthful shared consciousness space") ||
      !initial.emergingThought.includes("long emerging thought") ||
      initial.sharedLineLayout.overflow !== "hidden" ||
      initial.sharedLineLayout.lineClamp !== "6" ||
      initial.sharedLineLayout.clientHeight > initial.sharedLineLayout.lineHeight * 6 + 1 ||
      initial.sharedLineLayout.scrollHeight <= initial.sharedLineLayout.clientHeight ||
      initial.sharedLineLayout.bottomGap < 40 ||
      !initial.lowerColumns.separated ||
      !initial.lowerColumns.alignedBottom ||
      initial.lowerColumns.emergingBottomGap < 40 ||
      initial.legacyPeriods ||
      initial.legacyModules ||
      initial.legacyRuntime ||
      initial.focusBlock ||
      initial.container.borderRadius !== "8px" ||
      initial.container.borderTopWidth !== "1px" ||
      initial.container.borderTopStyle !== "solid" ||
      !initial.container.backgroundImage.includes("linear-gradient") ||
      initial.vision.particleCount !== 0 ||
      initial.vision.horizonLayers !== 3 ||
      initial.vision.visualMode !== "shared-horizon" ||
      initial.vision.atmosphereCachePixels !== 0 ||
      initial.vision.agentCount !== 3 ||
      initial.vision.canvasPixels > 720000
    ) {
      throw new Error(`Initial Home presence contract failed: ${JSON.stringify(initial)}`);
    }

    const initialColors = JSON.stringify(initial.agents);
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.waitForTimeout(100);
    const stableAgents = await page.evaluate(() =>
      [...document.querySelectorAll("#homePresenceAgents .home-presence-agent")].map((node) => ({
        label: node.textContent.trim(),
        color: node.style.getPropertyValue("--agent-color")
      })).sort((left, right) => left.label.localeCompare(right.label))
    );
    if (JSON.stringify(stableAgents) !== initialColors) {
      throw new Error(`Agent colors/order changed across the same snapshot: ${JSON.stringify(stableAgents)}`);
    }

    await page.click("[data-view='memory']");
    await page.waitForFunction(() => window.ClaraCoreTestHooks.homeVision().scheduled === 0);
    const away = await page.evaluate(() => window.ClaraCoreTestHooks.homeVision());
    if (away.running || away.scheduled !== 0) throw new Error(`Home scheduler continued off-screen: ${JSON.stringify(away)}`);

    await page.click("[data-view='home']");
    await page.waitForFunction(() => window.ClaraCoreTestHooks.homeVision().scheduled === 1);
    const returned = await page.evaluate(() => window.ClaraCoreTestHooks.homeVision());
    if (!returned.running || returned.scheduled !== 1) throw new Error(`Home scheduler did not resume exactly once: ${JSON.stringify(returned)}`);

    await page.evaluate(() => {
      document.body.dataset.motionPreference = "off";
    });
    await page.waitForFunction(() => {
      const state = window.ClaraCoreTestHooks.homeVision();
      return state.reducedMotion && !state.running && state.scheduled === 0;
    });
    const reduced = await page.evaluate(() => window.ClaraCoreTestHooks.homeVision());

    await page.evaluate(() => {
      document.body.dataset.motionPreference = "on";
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await database.recordGatewayTrace({
      agentId: "arrival-agent",
      toolName: "shared_line_update",
      status: "ok",
      durationMs: 7,
      request: {},
      responseSummary: "New activity after the previous Home snapshot."
    });
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await page.waitForFunction(() => window.ClaraCoreTestHooks.homeVision().arrivalActive);
    await page.waitForTimeout(1600);
    const arrivalSettled = await page.evaluate(() => window.ClaraCoreTestHooks.homeVision());
    if (arrivalSettled.arrivalActive) throw new Error(`Arrival ripple replayed perpetually: ${JSON.stringify(arrivalSettled)}`);

    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH });
    }
    await page.setViewportSize({ width: 900, height: 720 });
    await page.click("[data-view='home']");
    await page.waitForFunction(() => document.querySelector("#homeView")?.classList.contains("active-view"));
    const narrow = await page.evaluate(() => {
      const presence = document.querySelector(".home-presence");
      const sharedLine = document.querySelector("#homeSharedLineSection");
      const emerging = document.querySelector("#homeEmergingSection");
      const lineText = document.querySelector("#homeSharedLineText");
      const presenceRect = presence.getBoundingClientRect();
      const sharedLineRect = sharedLine.getBoundingClientRect();
      const emergingRect = emerging.getBoundingClientRect();
      return {
        lineClamp: getComputedStyle(lineText).webkitLineClamp,
        sameColumn: Math.abs(sharedLineRect.left - emergingRect.left) <= 1,
        stacked: emergingRect.top >= sharedLineRect.bottom,
        rightGap: presenceRect.right - Math.max(sharedLineRect.right, emergingRect.right),
        bottomGap: presenceRect.bottom - emergingRect.bottom,
        horizontalOverflow: presence.scrollWidth > presence.clientWidth
      };
    });
    if (
      narrow.lineClamp !== "4" ||
      !narrow.sameColumn ||
      !narrow.stacked ||
      narrow.rightGap < 20 ||
      narrow.bottomGap < 30 ||
      narrow.horizontalOverflow
    ) {
      throw new Error(`Narrow Home presence layout failed: ${JSON.stringify(narrow)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.evaluate(() => {
        document.body.dataset.theme = "dark";
        document.body.dataset.themePreference = "dark";
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "dark-narrow") });
    }
    await page.evaluate(() => window.ClaraCoreTestHooks.setHomeState("error"));
    const narrowError = await page.evaluate(() => {
      const presence = document.querySelector(".home-presence");
      const title = document.querySelector("#homePresenceTitle").getBoundingClientRect();
      const issue = document.querySelector("#homeActionableIssue").getBoundingClientRect();
      return {
        issueBelowTitle: issue.top >= title.bottom,
        issueInside: issue.right <= presence.getBoundingClientRect().right,
        horizontalOverflow: presence.scrollWidth > presence.clientWidth,
        retryVisible: !document.querySelector("#homePresenceEmptyAction").hidden
      };
    });
    if (!narrowError.issueBelowTitle || !narrowError.issueInside || narrowError.horizontalOverflow || !narrowError.retryVisible) {
      throw new Error(`Narrow error Home presence layout failed: ${JSON.stringify(narrowError)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "error-narrow") });
    }
    await page.click("#homePresenceEmptyAction");
    await page.waitForFunction(() => ["ready", "attention"].includes(document.querySelector(".home-presence")?.dataset.state));
    if (rendererErrors.length) throw new Error(`Renderer errors: ${rendererErrors.join(" | ")}`);

    console.log(JSON.stringify({ ok: true, empty, loading, errorState, initial, away, returned, reduced, arrivalSettled, narrow, narrowError }, null, 2));
  } finally {
    if (app) await app.close();
    await Promise.resolve(database.close?.()).catch(() => {});
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
