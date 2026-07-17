const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

async function sampleMetrics(app, page, seconds) {
  const samples = [];
  const startVision = await page.evaluate(() => window.ClaraCoreTestHooks.homeVision());
  for (let index = 0; index < seconds; index += 1) {
    await page.waitForTimeout(1000);
    const metrics = await app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics());
    const renderer = metrics.find((metric) => metric.type === "Tab") || metrics.find((metric) => metric.type === "Browser") || metrics[0];
    samples.push({
      cpu: metrics.reduce((sum, metric) => sum + Number(metric.cpu?.percentCPUUsage || 0), 0),
      rendererCpu: Number(renderer?.cpu?.percentCPUUsage || 0),
      rendererPrivateMb: Number(renderer?.memory?.privateBytes ?? renderer?.memory?.workingSetSize ?? 0) / 1024
    });
  }
  const endVision = await page.evaluate(() => window.ClaraCoreTestHooks.homeVision());
  return {
    seconds,
    totalCpu: average(samples.map((sample) => sample.cpu)),
    rendererCpu: average(samples.map((sample) => sample.rendererCpu)),
    rendererPrivateMb: average(samples.map((sample) => sample.rendererPrivateMb)),
    frames: endVision.frameCount - startVision.frameCount,
    fps: (endVision.frameCount - startVision.frameCount) / seconds,
    scheduler: endVision
  };
}

async function main() {
  const { _electron: electron } = require("playwright");
  const appRoot = path.resolve(__dirname, "..", "..");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-home-performance-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const appShim = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const { database } = await runtime.ensureProductCore(appShim);
  await database.recordGatewayTrace({
    agentId: "codex",
    toolName: "gateway_context",
    status: "ok",
    durationMs: 8,
    request: {},
    responseSummary: "Performance sample."
  });

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
    await page.waitForFunction(() => window.ClaraCoreTestHooks?.homeVision()?.agentCount === 1, null, { timeout: 15000 });
    await page.click("[data-view='home']");
    await page.waitForFunction(() => {
      const vision = window.ClaraCoreTestHooks?.homeVision?.();
      return vision?.active && vision?.scheduled === 1;
    });

    await page.evaluate(() => {
      document.body.dataset.motionPreference = "off";
    });
    await page.waitForFunction(() => window.ClaraCoreTestHooks.homeVision().scheduled === 0);
    const staticBaseline = await sampleMetrics(app, page, 30);

    await page.evaluate(() => {
      document.body.dataset.motionPreference = "on";
    });
    await page.waitForFunction(() => window.ClaraCoreTestHooks.homeVision().scheduled === 1);
    const animated = await sampleMetrics(app, page, 30);

    await page.click("[data-view='memory']");
    await page.waitForFunction(() => window.ClaraCoreTestHooks.homeVision().scheduled === 0);
    const away = await sampleMetrics(app, page, 10);

    const result = {
      window: await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio })),
      staticBaseline,
      animated,
      away,
      cpuDelta: animated.totalCpu - staticBaseline.totalCpu,
      rendererMemoryDeltaMb: animated.rendererPrivateMb - staticBaseline.rendererPrivateMb
    };
    if (animated.fps > 12.8 || animated.scheduler.particleCount !== 0 || animated.scheduler.horizonLayers !== 3 || animated.scheduler.canvasPixels > 720000) {
      throw new Error(`Home scene budget failed: ${JSON.stringify(result)}`);
    }
    if (away.frames !== 0 || away.scheduler.scheduled !== 0) {
      throw new Error(`Home kept rendering away from Home: ${JSON.stringify(result)}`);
    }
    if (result.cpuDelta > 5 || result.rendererMemoryDeltaMb > 50) {
      throw new Error(`Home performance budget failed: ${JSON.stringify(result)}`);
    }
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
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
