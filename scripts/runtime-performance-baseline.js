const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const { sqliteCommand } = require("../core/sqlite-binary");

const execFileAsync = promisify(execFile);

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function summarize(values) {
  const safe = values.map(Number).filter(Number.isFinite);
  return {
    count: safe.length,
    average: safe.reduce((sum, value) => sum + value, 0) / Math.max(1, safe.length),
    p50: percentile(safe, 0.5),
    p95: percentile(safe, 0.95),
    max: safe.length ? Math.max(...safe) : 0
  };
}

function roundMetrics(value) {
  if (Array.isArray(value)) return value.map(roundMetrics);
  if (!value || typeof value !== "object") {
    return typeof value === "number" ? Math.round(value * 1000) / 1000 : value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundMetrics(item)]));
}

async function consistentDatabaseCopy(source, destination) {
  const escapedDestination = destination.replaceAll("'", "''");
  await execFileAsync(sqliteCommand(), [source, `.backup '${escapedDestination}'`]);
}

async function main() {
  const { _electron: electron } = require("playwright");
  const appRoot = path.resolve(__dirname, "..");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-runtime-baseline-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const sourceDatabase = String(process.env.CLARACORE_PERFORMANCE_DB || "").trim();
  const sampleCount = Math.max(5, Math.min(100, Number.parseInt(process.env.CLARACORE_PERFORMANCE_SAMPLES || "20", 10) || 20));
  const databasePath = path.join(dataRoot, "claracore.db");
  if (sourceDatabase) await consistentDatabaseCopy(path.resolve(sourceDatabase), databasePath);
  const databaseBytes = sourceDatabase ? (await fs.stat(databasePath)).size : 0;

  let app;
  try {
    const launchedAt = performance.now();
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
    await page.waitForFunction(() => {
      const version = document.querySelector("#brandVersion")?.textContent || "";
      return Boolean(window.ClaraCoreTestHooks && /^Desktop v\d/.test(version));
    }, null, { timeout: 30000 });
    const startupToReadyMs = performance.now() - launchedAt;
    await page.evaluate(() => {
      document.body.dataset.motionPreference = "off";
    });

    const snapshotSamples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      snapshotSamples.push(await page.evaluate(async () => {
        const startedAt = performance.now();
        const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
        return {
          durationMs: performance.now() - startedAt,
          memoryRows: snapshot.memories?.length || 0,
          gatewayTraceRows: snapshot.gatewayTraces?.length || 0,
          runtimeEventRows: snapshot.runtimeEvents?.length || 0,
          controllerEventCount: snapshot.memoryController?.eventCount || 0
        };
      }));
    }

    const navigation = [];
    for (const view of ["memory", "shared-line", "innerlife", "trace", "logs", "settings", "home"]) {
      navigation.push(await page.evaluate(async (targetView) => {
        const button = document.querySelector(`[data-view='${targetView}']`);
        const startedAt = performance.now();
        button.click();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return {
          view: targetView,
          durationMs: performance.now() - startedAt,
          active: Boolean(document.querySelector(`#${targetView === "shared-line" ? "sharedLine" : targetView}View.active-view`))
        };
      }, view));
    }

    const appMetrics = await app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics().map((metric) => ({
      type: metric.type,
      cpuPercent: Number(metric.cpu?.percentCPUUsage || 0),
      privateMemoryMb: Number(metric.memory?.privateBytes ?? metric.memory?.workingSetSize ?? 0) / 1024
    })));
    const snapshotDurations = snapshotSamples.map((sample) => sample.durationMs);
    const result = roundMetrics({
      ok: true,
      source: sourceDatabase ? "consistent temporary copy" : "empty temporary database",
      sourceDatabaseBytes: databaseBytes,
      sampleCount,
      startupToReadyMs,
      snapshotMs: summarize(snapshotDurations),
      snapshotShape: snapshotSamples.at(-1),
      navigation,
      appMetrics
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (app) await app.close();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
