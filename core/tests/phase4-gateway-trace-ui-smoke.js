const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

const READ_ONLY_TABLES = [
  "runtime_events",
  "gateway_traces",
  "memories",
  "continuity_lines",
  "continuity_position_history",
  "innerlife_shares"
];

async function fingerprintProductState(database) {
  const entries = await Promise.all(READ_ONLY_TABLES.map(async (table) => {
    const rows = await database.query(`SELECT * FROM ${table} ORDER BY rowid;`);
    return [table, rows];
  }));
  return JSON.stringify(Object.fromEntries(entries));
}

function screenshotVariant(filePath, suffix) {
  const extension = path.extname(filePath);
  return `${filePath.slice(0, -extension.length)}-${suffix}${extension}`;
}

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
    const rendererErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") rendererErrors.push(message.text());
    });
    page.on("pageerror", (error) => rendererErrors.push(error.message));
    await page.waitForSelector("[data-view='agent-setup']", { timeout: 15000 });
    await page.waitForFunction(
      () => document.querySelector("#homeActionableIssue")?.textContent.includes("Unknown tool"),
      null,
      { timeout: 15000 }
    );
    await page.waitForFunction(
      () => document.querySelector("#homePresenceAgents")?.textContent.includes("My-Agent"),
      null,
      { timeout: 15000 }
    );
    const fingerprintBefore = await fingerprintProductState(database);
    await page.click("[data-view='agent-setup']");
    await page.waitForFunction(
      () =>
        document.querySelector("#gatewayTraceList")?.textContent.includes("gateway_context") &&
        document.querySelector("#gatewayTraceList")?.textContent.includes("missing_gateway_tool"),
      null,
      { timeout: 15000 }
    );
    await page.click("[data-view='settings']");
    await page.selectOption("#settingsLanguage", "en");
    await page.selectOption("#settingsTheme", "light");
    await page.click("#saveAppearanceSettings");
    await page.waitForFunction(
      () => document.documentElement.lang === "en" && document.body.dataset.themePreference === "light",
      null,
      { timeout: 15000 }
    );
    await page.click("[data-view='logs']");
    await page.waitForFunction(
      () => document.querySelector("#logTerminal")?.textContent.includes("missing_gateway_tool"),
      null,
      { timeout: 15000 }
    );
    await page.waitForFunction(
      () => document.querySelector("#logDecayList")?.textContent.includes("Dormant Decay Memory"),
      null,
      { timeout: 15000 }
    );
    const primaryContract = await page.evaluate(() => ({
      advancedOpen: document.querySelector("#logAdvancedDiagnostics")?.open,
      clearButtonPresent: Boolean(document.querySelector("#clearLogs")),
      backendClearAvailable: typeof window.ClaraCoreDesktop.clearLogs === "function",
      statusText: document.querySelector("#logStatusSummary")?.textContent || "",
      statusTone: document.querySelector(".log-status-line")?.className || "",
      terminalText: document.querySelector("#logTerminal")?.textContent || ""
    }));
    if (
      primaryContract.advancedOpen ||
      primaryContract.clearButtonPresent ||
      !primaryContract.backendClearAvailable ||
      !primaryContract.statusTone.includes("error") ||
      !primaryContract.terminalText.includes("missing_gateway_tool")
    ) {
      throw new Error(`Logs primary hierarchy contract failed: ${JSON.stringify(primaryContract)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH });
    }

    const filterEvidence = {};
    for (const filter of ["errors", "runtime", "gateway", "ui", "all"]) {
      await page.selectOption("#logFilter", filter);
      filterEvidence[filter] = await page.locator("#logTerminal").textContent();
    }
    if (!filterEvidence.errors.includes("missing_gateway_tool") || !filterEvidence.gateway.includes("missing_gateway_tool")) {
      throw new Error(`Logs filters hid expected Gateway error evidence: ${JSON.stringify(filterEvidence)}`);
    }
    await page.click("#toggleLogFollow");
    await page.waitForFunction(() => !document.querySelector("#toggleLogFollow")?.classList.contains("active"));
    await page.click("#toggleLogFollow");
    await page.waitForFunction(() => document.querySelector("#toggleLogFollow")?.classList.contains("active"));
    await page.click("#refreshLogs");
    await page.waitForFunction(() => !document.querySelector("#refreshLogs")?.disabled, null, { timeout: 15000 });

    await page.click("#logAdvancedDiagnostics > summary");
    await page.waitForFunction(
      () =>
        document.querySelector("#logAdvancedDiagnostics")?.open &&
        document.querySelector("#logDecayList")?.querySelectorAll(".decay-audit-item").length >= 3 &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("Time Flow Memory") &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("Time Flow Shared Line") &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("InnerLife") &&
        document.querySelector("#logTimeFlowList")?.textContent.includes("missing_gateway_tool"),
      null,
      { timeout: 15000 }
    );
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "advanced") });
    }
    const result = await page.evaluate(async () => {
      const [snapshot, logsDetail] = await Promise.all([
        window.ClaraCoreDesktop.getRuntimeSnapshot(),
        window.ClaraCoreDesktop.getViewSnapshot("logs")
      ]);
      const decayIssueCodes = (logsDetail.decayAudit?.issues || []).map((issue) => issue.code);
      return {
        databasePath: snapshot.data.databasePath,
        traceCount: snapshot.gatewayTraces.length,
        hasErrorTrace: snapshot.gatewayTraces.some((trace) => trace.toolName === "missing_gateway_tool" && trace.status === "error"),
        agentTraceText: document.querySelector("#gatewayTraceList").textContent,
        homeIssueText: document.querySelector("#homeActionableIssue").textContent,
        decayIssueCodes,
        decayStatus: logsDetail.decayAudit?.status || "",
        decayText: document.querySelector("#logDecayList")?.textContent || "",
        timeFlowCount: document.querySelectorAll("#logTimeFlowList .time-flow-item").length,
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
      !result.homeIssueText.includes("Unknown tool") ||
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

    await page.click("#logAdvancedDiagnostics > summary");
    await page.waitForFunction(() => !document.querySelector("#logAdvancedDiagnostics")?.open);
    await page.click("[data-view='settings']");
    await page.selectOption("#settingsLanguage", "zh");
    await page.selectOption("#settingsTheme", "dark");
    await page.click("#saveAppearanceSettings");
    await page.waitForFunction(
      () => document.documentElement.lang === "zh-CN" && document.body.dataset.themePreference === "dark",
      null,
      { timeout: 15000 }
    );
    await page.click("[data-view='home']");
    await page.click("[data-view='logs']");
    const reentryState = await page.evaluate(() => ({
      advancedOpen: document.querySelector("#logAdvancedDiagnostics")?.open,
      title: document.querySelector("#logAdvancedDiagnostics > summary strong")?.textContent || "",
      theme: document.body.dataset.themePreference,
      language: document.documentElement.lang,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }));
    if (
      reentryState.advancedOpen ||
      reentryState.title !== "高级诊断" ||
      reentryState.theme !== "dark" ||
      reentryState.language !== "zh-CN" ||
      reentryState.horizontalOverflow
    ) {
      throw new Error(`Logs re-entry/theme/language contract failed: ${JSON.stringify(reentryState)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "zh-dark") });
      await page.setViewportSize({ width: 820, height: 900 });
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "narrow") });
    }

    const fingerprintAfter = await fingerprintProductState(database);
    if (fingerprintAfter !== fingerprintBefore) {
      throw new Error("Logs reading changed database-backed diagnostic or product state.");
    }
    if (rendererErrors.length > 0) {
      throw new Error(`Logs renderer logged errors: ${JSON.stringify(rendererErrors)}`);
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
          timeFlowCount: result.timeFlowCount,
          primaryContract,
          reentryState,
          readOnlyFingerprint: "unchanged"
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
