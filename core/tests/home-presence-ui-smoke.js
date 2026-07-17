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
  await runtime.saveProductSharedLine(appShim, {
    lineTitle: "Home presence direction",
    summary: "Make Home a truthful shared consciousness space.",
    interpretationStatus: "confirmed"
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
    await page.waitForFunction(
      () => document.querySelectorAll("#homePresenceAgents .home-presence-agent").length === 3 && window.ClaraCoreTestHooks?.homeVision,
      null,
      { timeout: 15000 }
    );

    const initial = await page.evaluate(() => ({
      title: document.querySelector("#homePresenceTitle")?.textContent || "",
      sharedLine: document.querySelector("#homeSharedLineText")?.textContent || "",
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
      await page.setViewportSize({ width: 900, height: 720 });
      await page.click("[data-view='home']");
      await page.waitForFunction(() => document.querySelector("#homeView")?.classList.contains("active-view"));
      await page.evaluate(() => {
        document.body.dataset.theme = "dark";
        document.body.dataset.themePreference = "dark";
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "dark-narrow") });
    }
    if (rendererErrors.length) throw new Error(`Renderer errors: ${rendererErrors.join(" | ")}`);

    console.log(JSON.stringify({ ok: true, initial, away, returned, reduced, arrivalSettled }, null, 2));
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
