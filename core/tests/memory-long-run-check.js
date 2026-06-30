const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const runtime = require("../runtime");
const { createGatewayClient, parseTextResult } = require("./gateway-client");

const execFileAsync = promisify(execFile);

function numberEnv(name, fallback) {
  const value = Number.parseFloat(String(process.env[name] || ""));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, Number(bytes) || 0);
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

async function processRssBytes(pid) {
  if (!pid) return 0;
  try {
    const { stdout } = await execFileAsync("/bin/ps", ["-o", "rss=", "-p", String(pid)]);
    return (Number.parseInt(String(stdout || "").trim(), 10) || 0) * 1024;
  } catch (_error) {
    return 0;
  }
}

function summarizeSamples(samples, key) {
  const first = samples[0]?.[key] || 0;
  const last = samples[samples.length - 1]?.[key] || 0;
  const max = Math.max(...samples.map((sample) => sample[key] || 0));
  return {
    first,
    last,
    max,
    delta: last - first,
    deltaText: `${last >= first ? "+" : "-"}${formatBytes(Math.abs(last - first))}`,
    maxText: formatBytes(max)
  };
}

async function main() {
  const durationMinutes = numberEnv("CLARACORE_LONG_RUN_DURATION_MINUTES", 30);
  const intervalMs = numberEnv("CLARACORE_LONG_RUN_INTERVAL_MS", 5000);
  const maxRssGrowthBytes = numberEnv("CLARACORE_LONG_RUN_MAX_RSS_GROWTH_MB", 128) * 1024 * 1024;
  const startedAt = Date.now();
  const deadline = startedAt + durationMinutes * 60 * 1000;
  const providedDataRoot = Boolean(process.env.CLARACORE_DESKTOP_DATA_DIR);
  const dataRoot = process.env.CLARACORE_DESKTOP_DATA_DIR || await fs.mkdtemp(path.join(os.tmpdir(), "claracore-long-run-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  const client = createGatewayClient(dataRoot, {
    env: {
      CLARACORE_AGENT_ID: "long-run:probe"
    }
  });
  const samples = [];

  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {}
    });
    await runtime.createProductMemory(app, {
      title: "Long-run baseline",
      body: "Long-run memory stability check baseline record.",
      labels: ["long-run", "agent-id:long-run:probe"]
    });

    let iteration = 0;
    while (Date.now() < deadline) {
      iteration += 1;
      const snapshot = await runtime.buildProductSnapshot(app);
      if ((snapshot.memories || []).length > 25) {
        throw new Error(`Runtime snapshot is too large: ${snapshot.memories.length} memories in global snapshot.`);
      }
      if (iteration % 12 === 0) {
        await runtime.createProductMemory(app, {
          title: `Long-run sample ${iteration}`,
          body: `Memory stability sample ${iteration}.`,
          labels: ["long-run", "agent-id:long-run:probe"]
        });
      }
      parseTextResult(await client.callTool("gateway_context", {
        agentId: "long-run:probe",
        limit: 5
      }));
      parseTextResult(await client.callTool("memoria_list", {
        limit: 5
      }));
      samples.push({
        at: Date.now(),
        runnerRss: process.memoryUsage().rss,
        gatewayRss: await processRssBytes(client.childPid)
      });
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const runner = summarizeSamples(samples, "runnerRss");
    const gateway = summarizeSamples(samples, "gatewayRss");
    const totalGrowth = Math.max(0, runner.delta) + Math.max(0, gateway.delta);
    const result = {
      ok: totalGrowth <= maxRssGrowthBytes,
      durationMinutes,
      intervalMs,
      sampleCount: samples.length,
      dataRoot,
      maxAllowedGrowth: formatBytes(maxRssGrowthBytes),
      runner,
      gateway,
      totalGrowthText: `${totalGrowth >= 0 ? "+" : "-"}${formatBytes(Math.abs(totalGrowth))}`
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) {
      throw new Error(`Long-run RSS growth exceeded ${formatBytes(maxRssGrowthBytes)}: ${result.totalGrowthText}`);
    }
  } finally {
    await client.close();
    runtime.resetCachedDatabase();
    if (!providedDataRoot && process.env.CLARACORE_LONG_RUN_KEEP_DATA !== "1") {
      await fs.rm(dataRoot, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
