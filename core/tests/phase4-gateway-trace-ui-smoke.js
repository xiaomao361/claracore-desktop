const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase4-gateway-trace-ui-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const appShim = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const { database } = await runtime.ensureProductCore(appShim);
  const memory = await runtime.createProductMemory(appShim, {
    title: "Time Flow Memory",
    body: "Time flow should include a recent memory item.",
    labels: "time-flow, smoke"
  });
  const dormantMemory = await runtime.createProductMemory(appShim, {
    title: "Dormant Decay Memory",
    body: "Decay audit should flag this old active memory as dormant.",
    labels: "decay, smoke"
  });
  await runtime.saveProductSharedLine(appShim, {
    summary: "Time Flow Shared Line position should be visible.",
    interpretationStatus: "needs_review",
    factsUsed: [memory.id]
  });
  const share = await runtime.processProductInnerLifeOnce(appShim, {
    agentId: "my-agent",
    prompt: "Time Flow InnerLife share should be visible."
  });
  await runtime.checkProductInnerLifeShareTiming(appShim, {
    agentId: "my-agent",
    shareId: share.share.id,
    context: "Gateway asks about Time Flow Shared Line and InnerLife now."
  });
  const waitingShare = await runtime.processProductInnerLifeOnce(appShim, {
    agentId: "my-agent",
    prompt: "Waiting InnerLife share should be visible in decay audit."
  });
  await database.exec(`
    UPDATE memories
    SET updated_at = datetime('now', '-45 days')
    WHERE id = '${dormantMemory.id}';

    UPDATE innerlife_shares
    SET updated_at = datetime('now', '-10 days')
    WHERE id = '${waitingShare.share.id}';
  `);
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
        CLARACORE_DESKTOP_USER_DATA_DIR: userDataRoot,
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    await page.waitForSelector("[data-view='agent-setup']", { timeout: 15000 });
    await page.waitForFunction(
      () =>
        document.querySelector("#homeAttentionList")?.textContent.includes("网关轨迹") ||
        document.querySelector("#homeAttentionList")?.textContent.includes("Gateway Trace"),
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
    await page.click("[data-view='logs']");
    await page.waitForFunction(
      () =>
        document.querySelector("#logDecayList")?.querySelectorAll(".decay-audit-item").length >= 3 &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("Time Flow Memory") &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("Time Flow Shared Line") &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("InnerLife") &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("missing_gateway_tool"),
      null,
      { timeout: 15000 }
    );
    const result = await page.evaluate(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      const decayIssueCodes = (snapshot.decayAudit?.issues || []).map((issue) => issue.code);
      return {
        databasePath: snapshot.data.databasePath,
        traceCount: snapshot.gatewayTraces.length,
        hasErrorTrace: snapshot.gatewayTraces.some((trace) => trace.toolName === "missing_gateway_tool" && trace.status === "error"),
        agentTraceText: document.querySelector("#gatewayTraceList").textContent,
        homeAttentionText: document.querySelector("#homeAttentionList").textContent,
        decayIssueCodes,
        decayStatus: document.querySelector("#logDecayStatus")?.textContent || "",
        decayText: document.querySelector("#logDecayList")?.textContent || "",
        timeFlowCount: Number(document.querySelector("#logTimeFlowCount")?.textContent || 0),
        timeFlowText: document.querySelector("#logTimeFlowList")?.textContent || ""
      };
    });
    if (!result.databasePath.startsWith(dataRoot)) {
      throw new Error(`Gateway trace UI wrote outside product data root: ${result.databasePath}`);
    }
    if (
      result.traceCount < 2 ||
      !result.hasErrorTrace ||
      !result.agentTraceText.includes("missing_gateway_tool") ||
      !result.homeAttentionText.includes("Unknown tool") ||
      result.decayStatus !== "needs_review" ||
      !result.decayIssueCodes.includes("memory_dormant") ||
      !result.decayIssueCodes.includes("shared_line_review") ||
      !result.decayIssueCodes.includes("innerlife_old_shares") ||
      result.timeFlowCount < 4 ||
      !result.timeFlowText.includes("Time Flow Memory") ||
      !result.timeFlowText.includes("Time Flow Shared Line") ||
      !result.timeFlowText.includes("InnerLife") ||
      !result.timeFlowText.includes("missing_gateway_tool")
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
          traceCount: result.traceCount,
          decayStatus: result.decayStatus,
          timeFlowCount: result.timeFlowCount
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
