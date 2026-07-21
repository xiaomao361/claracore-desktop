#!/usr/bin/env node
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))] || 0;
}

function summary(values) {
  return {
    samples: values.length,
    p50Ms: Math.round(percentile(values, 0.5) * 10) / 10,
    p95Ms: Math.round(percentile(values, 0.95) * 10) / 10,
    maxMs: Math.round(Math.max(0, ...values) * 10) / 10
  };
}

async function main() {
  const { _electron: electron } = require("playwright");
  const appRoot = path.resolve(__dirname, "..");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-http-ui-baseline-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: require(path.join(appRoot, "node_modules", "electron")),
      args: ["."],
      cwd: appRoot,
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: root,
        CLARACORE_DESKTOP_USER_DATA_DIR: path.join(root, "user-data"),
        CLARACORE_DESKTOP_HTTP_PORT: "0",
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    await page.waitForFunction(() => /^Desktop v\d/.test(document.querySelector("#brandVersion")?.textContent || ""), null, { timeout: 30000 });
    const gateway = await page.evaluate(async () => (await window.ClaraCoreDesktop.getRuntimeSnapshot()).connections.httpGateway);
    const endpoint = `${gateway.baseUrl}/mcp`;
    const healthUrl = `${gateway.baseUrl}/health`;
    const token = gateway.token;

    async function toolCall(agentId, index) {
      const startedAt = performance.now();
      const write = index % 10 === 9;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-ClaraCore-Agent-ID": agentId,
          "X-ClaraCore-Client-ID": "http-ui-baseline"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `${agentId}-${index}`,
          method: "tools/call",
          params: write
            ? { name: "innerlife_submit_inbox", arguments: { source: "http-ui-baseline", body: `${agentId} sample ${index}` } }
            : { name: "memoria_list", arguments: { limit: 10 } }
        })
      });
      const payload = await response.json();
      return { durationMs: performance.now() - startedAt, ok: response.ok && !payload.error };
    }

    const scenarios = [];
    for (const agents of [1, 4, 8]) {
      const stop = { value: false };
      const healthDurations = [];
      const healthProbe = (async () => {
        while (!stop.value) {
          const startedAt = performance.now();
          await fetch(healthUrl);
          healthDurations.push(performance.now() - startedAt);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      })();
      const uiIpc = page.evaluate(async () => {
        const samples = [];
        for (let index = 0; index < 30; index += 1) {
          const startedAt = performance.now();
          await window.ClaraCoreDesktop.getResourceSnapshot();
          samples.push(performance.now() - startedAt);
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return samples;
      });
      const calls = (await Promise.all(Array.from({ length: agents }, (_, agentIndex) =>
        Promise.all(Array.from({ length: 30 }, (_, index) => toolCall(`http-agent-${agentIndex + 1}`, index)))
      ))).flat();
      const uiIpcDurations = await uiIpc;
      stop.value = true;
      await healthProbe;
      scenarios.push({
        agents,
        calls: calls.length,
        failures: calls.filter((call) => !call.ok).length,
        toolLatency: summary(calls.map((call) => call.durationMs)),
        mainEventLoopHealth: summary(healthDurations),
        uiIpcLatency: summary(uiIpcDurations)
      });
    }
    const workerRequired = scenarios.some((scenario) => scenario.mainEventLoopHealth.p95Ms >= 50);
    const result = {
      ok: scenarios.every((scenario) => scenario.failures === 0),
      databasePath: path.join(root, "claracore.db"),
      databaseOwnership: "Electron main process shared ensureProductCore connection",
      workerThresholdMs: 50,
      workerRequired,
      scenarios
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.ok) process.exitCode = 1;
  } finally {
    if (app) await app.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
