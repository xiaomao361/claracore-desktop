const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");
const { jsonSql, sqlString } = require("../db/helpers");

function screenshotVariant(filePath, suffix) {
  const extension = path.extname(filePath);
  return `${filePath.slice(0, -extension.length)}-${suffix}${extension}`;
}

async function main() {
  const { _electron: electron } = require("playwright");
  const appRoot = path.resolve(__dirname, "..", "..");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-trace-ui-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const runtimeApp = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;

  const decision = await runtime.createProductMemory(runtimeApp, {
    agentId: "codex",
    title: "Agent First 成为页面原则",
    body: "Desktop 页面坚持人查看、Agent 维护。",
    labels: "product-decision, agent-id:codex, agent:codex"
  });
  await runtime.createProductMemory(runtimeApp, {
    agentId: "clara",
    title: "ClaraCore Desktop 0.5.7 形成",
    body: "0.5.7 完成三类页面的只读简化。",
    labels: "release, agent-id:clara, agent:clara"
  });
  await runtime.saveProductSharedLine(runtimeApp, {
    agentId: "codex",
    summary: "痕迹页面开始承接三类数据统计。",
    interpretationStatus: "confirmed",
    factsUsed: [decision.id]
  });
  await runtime.updateProductInnerLifeProfile(runtimeApp, {
    agentId: "clara",
    displayName: "Clara",
    state: { recent_focus: "让痕迹页保持真实和克制。" }
  });
  const { database } = await runtime.ensureProductCore(runtimeApp);
  const compactUtcStart = new Date(Date.now() - 86400000).toISOString().replace(/\.\d{3}Z$/, "+0000");
  await database.exec(`
    INSERT INTO memories (id, title, body, status, sensitivity, created_at, updated_at)
    VALUES (
      'trace_archived_legacy_memory',
      'Legacy archived Memory',
      'This older imported Memory remains in totals but must not start the Trace span.',
      'archived',
      'normal',
      '2020-01-02T03:04:05+0000',
      '2020-01-02T03:04:05+0000'
    );
    UPDATE memories
    SET created_at = ${sqlString(compactUtcStart)}, updated_at = ${sqlString(compactUtcStart)}
    WHERE id = ${sqlString(decision.id)};
    INSERT INTO innerlife_events (id, agent_id, kind, body, status)
    VALUES ('trace_event_clara', 'clara', 'explore', 'A thought formed for the trace page.', 'completed');
    INSERT INTO innerlife_thoughts (id, event_id, body, review_status)
    VALUES ('trace_thought_clara', 'trace_event_clara', 'The Trace page should stay narrative before statistics.', 'reviewed');
    INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body)
    VALUES ('trace_share_clara', 'clara', 'trace_thought_clara', 'used', 'The Trace page should stay narrative before statistics.');
    INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, metadata_json)
    VALUES (
      'trace_action_clara',
      'trace_share_clara',
      'clara',
      'used',
      ${sqlString("Shared in the trace-page design discussion.")},
      ${jsonSql({
        deliveryEvidence: {
          conversationId: "trace-ui-conversation",
          responseExcerpt: "The Trace page should stay narrative before statistics.",
          sharedAt: new Date().toISOString(),
          source: "trace-ui-smoke"
        }
      })}
    );
  `);
  database.close();

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

    await page.waitForSelector("[data-view='trace']", { timeout: 15000 });
    await page.click("[data-view='trace']");
    await page.waitForFunction(
      () => document.querySelector("#traceView")?.classList.contains("active-view")
        && document.querySelectorAll("#traceStatements .trace-statement").length === 4,
      null,
      { timeout: 15000 }
    );
    await page.evaluate(() => setLanguage("zh"));
    await page.waitForFunction(() => document.querySelector("#viewTitle")?.textContent === "痕迹");

    const initial = await page.evaluate(async () => {
      const runtimeSnapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        title: document.querySelector("#viewTitle")?.textContent || "",
        subtitle: document.querySelector("#viewSubtitle")?.textContent || "",
        span: document.querySelector("#traceSpanTitle")?.textContent || "",
        statements: [...document.querySelectorAll("#traceStatements .trace-statement")].map((node) => node.textContent.replace(/\s+/g, "")),
        milestones: document.querySelector("#traceMilestoneList")?.textContent || "",
        participants: document.querySelector("#traceParticipantList")?.textContent || "",
        detailCards: document.querySelectorAll("#traceView .trace-data-card").length,
        metricRows: document.querySelectorAll("#traceView .trace-data-card .trace-metric-row").length,
        advancedOpen: document.querySelector("#traceAdvancedDetails")?.open,
        buttons: document.querySelectorAll("#traceView button").length,
        semantic: runtimeSnapshot.trace.semantic,
        firstAt: runtimeSnapshot.trace.firstAt,
        spanDays: runtimeSnapshot.trace.spanDays,
        memory: runtimeSnapshot.trace.memory,
        dataRoot: runtimeSnapshot.data.databasePath
      };
    });
    if (
      initial.title !== "痕迹" ||
      !initial.subtitle.includes("逐渐留下") ||
      !initial.span.includes("天的痕迹") ||
      initial.statements.length !== 4 ||
      !initial.statements.some((text) => text.includes("1个值得保留的决定")) ||
      !initial.statements.some((text) => text.includes("1次过去的记忆")) ||
      !initial.statements.some((text) => text.includes("1个Agent想法")) ||
      !initial.milestones.includes("Agent First 成为页面原则") ||
      !initial.milestones.includes("ClaraCore Desktop 0.5.7 形成") ||
      !initial.participants.includes("Codex") ||
      !initial.participants.includes("Clara") ||
      initial.detailCards !== 3 ||
      initial.metricRows !== 12 ||
      initial.advancedOpen ||
      initial.buttons !== 0 ||
      initial.semantic.decisions !== 1 ||
      initial.semantic.reusedMemories !== 1 ||
      initial.semantic.verifiedShares !== 1 ||
      initial.firstAt !== compactUtcStart ||
      initial.spanDays < 1 ||
      initial.spanDays > 2 ||
      initial.memory.archivedCount !== 1 ||
      !initial.dataRoot.startsWith(dataRoot)
    ) {
      throw new Error(`Trace first-screen contract failed: ${JSON.stringify(initial)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH, fullPage: true });
    }

    await page.click("#traceAdvancedDetails > summary");
    await page.waitForFunction(() => document.querySelector("#traceAdvancedDetails")?.open === true);
    const advanced = await page.evaluate(() => ({
      rows: document.querySelectorAll("#traceAdvancedMetrics .trace-metric-row").length,
      text: document.querySelector("#traceAdvancedMetrics")?.textContent || ""
    }));
    if (advanced.rows !== 12 || !advanced.text.includes("InnerLife 会话") || !advanced.text.includes("等待生成向量")) {
      throw new Error(`Trace advanced data did not render: ${JSON.stringify(advanced)}`);
    }

    const desktopLayout = await page.evaluate(() => ({
      bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      storyColumns: getComputedStyle(document.querySelector(".trace-story-grid")).gridTemplateColumns,
      cardColumns: getComputedStyle(document.querySelector(".trace-data-grid")).gridTemplateColumns
    }));
    if (desktopLayout.bodyOverflow > 1 || desktopLayout.storyColumns.split(" ").length < 2 || desktopLayout.cardColumns.split(" ").length < 3) {
      throw new Error(`Trace desktop layout failed: ${JSON.stringify(desktopLayout)}`);
    }

    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "advanced"), fullPage: true });
    }
    await page.click("#traceAdvancedDetails > summary");
    await page.setViewportSize({ width: 760, height: 900 });
    await page.evaluate(() => {
      document.body.dataset.theme = "dark";
      document.body.dataset.themePreference = "dark";
    });
    await page.waitForTimeout(150);
    const narrowLayout = await page.evaluate(() => ({
      bodyOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      storyColumns: getComputedStyle(document.querySelector(".trace-story-grid")).gridTemplateColumns,
      cardColumns: getComputedStyle(document.querySelector(".trace-data-grid")).gridTemplateColumns
    }));
    if (narrowLayout.bodyOverflow > 1 || narrowLayout.storyColumns.split(" ").length !== 1 || narrowLayout.cardColumns.split(" ").length !== 1) {
      throw new Error(`Trace narrow layout failed: ${JSON.stringify(narrowLayout)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, "dark-narrow"), fullPage: true });
    }
    if (rendererErrors.length) throw new Error(`Renderer errors: ${rendererErrors.join(" | ")}`);

    console.log(JSON.stringify({ ok: true, initial, advanced, desktopLayout, narrowLayout }, null, 2));
  } finally {
    if (app) await app.close();
    runtime.resetCachedDatabase();
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
