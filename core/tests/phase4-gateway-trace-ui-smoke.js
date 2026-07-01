const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase4-gateway-trace-ui-"));
  const appShim = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const { database } = await runtime.ensureProductCore(appShim);
  await database.recordGatewayTrace({
    agentId: "my-agent",
    toolName: "gateway_context",
    status: "ok",
    durationMs: 12,
    request: { limit: 5 },
    responseSummary: "Gateway context returned Shared Line, Memory, InnerLife, and Doctor."
  });
  await database.recordGatewayTrace({
    agentId: "my-agent",
    toolName: "missing_gateway_tool",
    status: "error",
    durationMs: 3,
    request: {},
    error: "Unknown tool: missing_gateway_tool"
  });

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
    await page.waitForSelector("[data-view='agent-setup']", { timeout: 15000 });
    await page.waitForFunction(
      () =>
        document.querySelector("#homeTraceList")?.textContent.includes("missing_gateway_tool") &&
        document.querySelector("#homeTraceList")?.textContent.includes("Unknown tool"),
      null,
      { timeout: 15000 }
    );
    await page.click("[data-view='agent-setup']");
    await page.waitForFunction(
      () =>
        document.querySelector("#gatewayTraceList")?.textContent.includes("gateway_context") &&
        document.querySelector("#gatewayTraceList")?.textContent.includes("missing_gateway_tool"),
      null,
      { timeout: 15000 }
    );
    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        databasePath: snapshot.data.databasePath,
        traceCount: snapshot.gatewayTraces.length,
        hasErrorTrace: snapshot.gatewayTraces.some((trace) => trace.toolName === "missing_gateway_tool" && trace.status === "error"),
        agentTraceText: document.querySelector("#gatewayTraceList").textContent,
        homeTraceText: document.querySelector("#homeTraceList").textContent
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`Gateway trace UI wrote outside product data root: ${result.databasePath}`);
    }
    if (
      result.traceCount < 2 ||
      !result.hasErrorTrace ||
      !result.agentTraceText.includes("missing_gateway_tool") ||
      !result.homeTraceText.includes("Unknown tool")
    ) {
      throw new Error(`Gateway trace UI did not render traces: ${JSON.stringify(result)}`);
    }
    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: result.databasePath,
          traceCount: result.traceCount
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
