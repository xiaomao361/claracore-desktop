// This smoke launches and operates an isolated Electron window. Run only after
// the user authorizes those UI operations; node --check does not launch it.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const runtime = require("../runtime");

function screenshotVariant(filePath, suffix) {
  const extension = path.extname(filePath);
  const stem = extension ? filePath.slice(0, -extension.length) : filePath;
  return `${stem}-${suffix}${extension || ".png"}`;
}

async function continuityState(database) {
  // Compare persisted content as well as selection: a topic read must not
  // silently activate a line, rewrite a position, or add history/snapshots.
  return {
    lines: await database.query("SELECT * FROM continuity_lines ORDER BY id;"),
    positions: await database.query("SELECT * FROM current_positions ORDER BY id;"),
    history: await database.query("SELECT * FROM continuity_position_history ORDER BY id;"),
    snapshots: await database.query("SELECT * FROM continuity_snapshots ORDER BY id;"),
    activeLine: await database.query("SELECT * FROM app_settings WHERE key = 'continuity.active_line_id';")
  };
}

async function waitForTopic(page, lineId) {
  await page.waitForFunction((id) => {
    const root = document.querySelector("#homeUnderstanding");
    const action = root?.querySelector('[data-understanding-action="open-line"]');
    return root?.dataset.state === "ready"
      && document.querySelector("#homeTopicSelect")?.value === id
      && action?.dataset.sharedLineId === id;
  }, lineId);
}

async function main() {
  const { _electron: electron } = require("playwright");
  const appRoot = path.resolve(__dirname, "..", "..");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-home-understanding-"));
  const userDataRoot = path.join(dataRoot, "user-data");
  const previousDataRoot = process.env.CLARACORE_DESKTOP_DATA_DIR;
  const appShim = { getPath: (name) => path.join(dataRoot, name), isPackaged: false };
  let app;
  let database;
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  try {
    ({ database } = await runtime.ensureProductCore(appShim));
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
    await page.waitForFunction(() => document.querySelector("#homeUnderstanding")?.dataset.state === "empty", null, { timeout: 15000 });
    const empty = await page.evaluate(() => {
      const root = document.querySelector("#homeUnderstanding");
      const disclosure = document.querySelector("#homePresenceDisclosure");
      return {
        state: root.dataset.state,
        busy: root.getAttribute("aria-busy"),
        selectDisabled: document.querySelector("#homeTopicSelect").disabled,
        hasExplanation: Boolean(root.querySelector(".understanding-empty p")?.textContent.trim()),
        catalogTarget: root.querySelector(".understanding-catalog-action")?.dataset.viewTarget,
        activityOpen: disclosure.open,
        issueHidden: document.querySelector("#homeActionableIssue").hidden,
        connection: window.ClaraCoreTestHooks.homeConnection()
      };
    });
    assert.equal(empty.state, "empty");
    assert.equal(empty.busy, "false");
    assert.equal(empty.selectDisabled, true);
    assert.equal(empty.hasExplanation, true);
    assert.equal(empty.catalogTarget, "shared-line");
    assert.equal(empty.activityOpen, false, "Activity must be collapsed on startup");
    assert.equal(empty.issueHidden, true);
    assert.equal(empty.connection.canvas, false, "Collapsed activity must not schedule animation");

    await page.evaluate(() => window.ClaraCoreTestHooks.setHomeState("loading"));
    const loading = await page.evaluate(() => ({
      state: document.querySelector("#homeUnderstanding").dataset.state,
      busy: document.querySelector("#homeUnderstanding").getAttribute("aria-busy"),
      selectDisabled: document.querySelector("#homeTopicSelect").disabled,
      notice: document.querySelector("#homeTopicNotice").textContent.trim(),
      emptyVisible: Boolean(document.querySelector("#homeUnderstanding .understanding-empty")),
      issueHidden: document.querySelector("#homeActionableIssue").hidden
    }));
    assert.equal(loading.state, "loading");
    assert.equal(loading.busy, "true");
    assert.equal(loading.selectDisabled, true);
    assert(loading.notice);
    assert.equal(loading.emptyVisible, false, "Loading must not look like a successful empty read");
    assert.equal(loading.issueHidden, true);

    await page.evaluate(() => window.ClaraCoreTestHooks.setHomeState("error"));
    const errorState = await page.evaluate(() => {
      const root = document.querySelector("#homeUnderstanding");
      const issue = document.querySelector("#homeActionableIssue");
      const bounds = issue.getBoundingClientRect();
      return {
        state: root.dataset.state,
        busy: root.getAttribute("aria-busy"),
        retryPresent: Boolean(root.querySelector('[data-home-action="retry"]')),
        issueRole: issue.getAttribute("role"),
        issueVisible: !issue.hidden && bounds.width > 0 && bounds.height > 0,
        issueOutsideDisclosure: !issue.closest("details"),
        activityOpen: document.querySelector("#homePresenceDisclosure").open,
        canvas: window.ClaraCoreTestHooks.homeConnection().canvas
      };
    });
    assert.equal(errorState.state, "error");
    assert.equal(errorState.busy, "false");
    assert.equal(errorState.retryPresent, true);
    assert.equal(errorState.issueRole, "alert");
    assert.equal(errorState.issueVisible, true, "A closed activity disclosure must not conceal actionable errors");
    assert.equal(errorState.issueOutsideDisclosure, true);
    assert.equal(errorState.activityOpen, false);
    assert.equal(errorState.canvas, false);
    await page.click('#homeUnderstanding [data-home-action="retry"]');
    await page.waitForFunction(() => document.querySelector("#homeUnderstanding")?.dataset.state === "empty"
      && document.querySelector("#homeActionableIssue")?.hidden);

    const topics = [
      {
        id: "line_ui_home_current",
        title: "共同理解 /Volumes/E61/projects/very-long-project-path/ 与多个服务的当前进展和现实边界".repeat(3),
        marker: "CURRENT TOPIC ONLY",
        summary: "CURRENT TOPIC ONLY。" + "较长的当前位置需要清晰保留共同确认、现实边界与下一步，首页只提供可继续阅读的预览。".repeat(24)
      },
      {
        id: "line_ui_home_parallel",
        title: "VeryLongUnbrokenProjectIdentifier".repeat(7),
        marker: "PARALLEL TOPIC ONLY",
        summary: "PARALLEL TOPIC ONLY。" + "LongUnbrokenSummaryWithRecordedMeaning".repeat(28)
      }
    ];
    for (const topic of topics) {
      await runtime.createProductSharedLine(appShim, { id: topic.id, title: topic.title, agentId: "ui-home-smoke", makeActive: false });
      await runtime.saveProductSharedLine(appShim, {
        lineId: topic.id,
        summary: topic.summary,
        nextStep: `Next step for ${topic.marker}`,
        confirmedGround: `Recorded understanding for ${topic.marker}`,
        provisionalRead: `Still to confirm for ${topic.marker}`,
        misreadRisks: "Do not classify another topic's content as this topic's evidence.",
        factsUsed: [`reference-for-${topic.id}`, `UnbrokenEvidenceReference${"Identifier".repeat(35)}`],
        interpretationStatus: "confirmed",
        source: "home-understanding-ui-smoke"
      });
    }
    await runtime.activateProductSharedLine(appShim, topics[0].id);
    await database.submitInnerLifeInbox({
      agentId: "ui-home-smoke",
      source: "home-understanding-ui-smoke",
      body: "PRIVATE PENDING INNERLIFE CONTENT MUST NOT APPEAR ON HOME."
    });
    await database.recordGatewayTrace({
      agentId: "ui-home-smoke",
      toolName: "gateway_context",
      status: "ok",
      durationMs: 8,
      request: {},
      responseSummary: "Observed activity for the isolated Home understanding smoke."
    });
    const persistedBeforeReading = await continuityState(database);
    await page.evaluate(() => window.ClaraCoreTestHooks.refresh());
    await waitForTopic(page, topics[0].id);
    await page.selectOption("#homeTopicSelect", topics[1].id);
    await waitForTopic(page, topics[1].id);
    const selected = await page.evaluate(() => ({
      title: document.querySelector(".understanding-topic-heading h2").textContent,
      position: document.querySelector(".understanding-position .understanding-prose").textContent,
      nextStep: document.querySelector(".understanding-next-step .understanding-prose").textContent,
      ground: document.querySelector(".understanding-ground .understanding-prose").textContent,
      references: [...document.querySelectorAll(".understanding-reference")].map((node) => node.textContent),
      pendingExposed: document.querySelector("#homeView").textContent.includes("PRIVATE PENDING INNERLIFE CONTENT"),
      previousTopicExposed: document.querySelector("#homeUnderstandingBody").textContent.includes("CURRENT TOPIC ONLY"),
      activityOpen: document.querySelector("#homePresenceDisclosure").open,
      connection: window.ClaraCoreTestHooks.homeConnection()
    }));
    assert.equal(selected.title, topics[1].title);
    assert(selected.position.startsWith(topics[1].marker));
    assert(selected.position.endsWith("…"), "Long selected summaries must be bounded previews");
    assert(Array.from(selected.position).length <= 421);
    assert.equal(selected.nextStep, `Next step for ${topics[1].marker}`);
    assert.equal(selected.ground, `Recorded understanding for ${topics[1].marker}`);
    assert.equal(selected.references[0], `reference-for-${topics[1].id}`);
    assert.equal(selected.pendingExposed, false);
    assert.equal(selected.previousTopicExposed, false);
    assert.equal(selected.activityOpen, false);
    assert.equal(selected.connection.canvas, false);
    assert.deepEqual(await continuityState(database), persistedBeforeReading, "Changing a reading topic must not mutate Continuity");

    await page.click('#homeUnderstanding [data-understanding-action="open-line"]');
    await page.waitForFunction((title) => document.querySelector("#sharedLineView")?.classList.contains("active-view")
      && document.querySelector("#sharedLineDetailTitle")?.textContent === title, topics[1].title);
    const fullReading = await page.evaluate(() => ({
      title: document.querySelector("#sharedLineDetailTitle").textContent,
      summary: document.querySelector("#sharedLineSummary").textContent,
      selectedIds: [...document.querySelectorAll('#sharedLinePrimaryList [aria-pressed="true"]')].map((node) => node.dataset.sharedLineId),
      connection: window.ClaraCoreTestHooks.homeConnection()
    }));
    assert.equal(fullReading.title, topics[1].title);
    assert(fullReading.summary.includes(topics[1].summary), "Full reading must preserve the entire selected summary");
    assert(fullReading.selectedIds.includes(topics[1].id), "The Shared Line page must select the exact requested ID");
    assert.equal(fullReading.connection.animated, false);
    assert.deepEqual(await continuityState(database), persistedBeforeReading, "Opening full reading must not activate or rewrite a line");
    await page.click('[data-view="home"]');
    await waitForTopic(page, topics[1].id);

    const layouts = [];
    for (const width of [1440, 1100, 900, 720]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => {
          document.body.dataset.theme = value;
          document.body.dataset.themePreference = value;
        }, theme);
        for (const topic of topics) {
          await page.selectOption("#homeTopicSelect", topic.id);
          await waitForTopic(page, topic.id);
          const layout = await page.evaluate(() => {
            const selectors = [".app-navigation", ".workspace", "#homeUnderstanding", ".home-topic-bar", ".understanding-main", ".understanding-topic-heading h2", ".understanding-prose", ".understanding-evidence", ".understanding-reference-list li", ".understanding-sources", ".home-world-heading", "#homeConnection"];
            const overflow = selectors.flatMap((selector) => [...document.querySelectorAll(selector)].filter((node) => {
              const bounds = node.getBoundingClientRect();
              return bounds.width > 0 && (node.scrollWidth > node.clientWidth + 1 || bounds.left < -1 || bounds.right > window.innerWidth + 1);
            }).map((node) => ({ selector, width: node.clientWidth, scrollWidth: node.scrollWidth })));
            const main = document.querySelector(".understanding-main").getBoundingClientRect();
            const evidence = document.querySelector(".understanding-evidence").getBoundingClientRect();
            const navigation = document.querySelector(".app-navigation").getBoundingClientRect();
            const workspace = document.querySelector(".workspace").getBoundingClientRect();
            return {
              overflow,
              documentOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
              columnsDoNotOverlap: evidence.left >= main.right - 1 || evidence.top >= main.bottom - 1,
              navigationAboveContent: navigation.bottom <= workspace.top + 1,
              activityOpen: document.querySelector("#homePresenceDisclosure").open,
              canvas: window.ClaraCoreTestHooks.homeConnection().canvas
            };
          });
          layouts.push({ width, theme, topic: topic.id, ...layout });
          assert.deepEqual(layout.overflow, [], `Long content overflow at ${width}px in ${theme}: ${JSON.stringify(layout)}`);
          assert.equal(layout.documentOverflow, false);
          assert.equal(layout.columnsDoNotOverlap, true);
          assert.equal(layout.navigationAboveContent, true);
          assert.equal(layout.activityOpen, false);
          assert.equal(layout.canvas, false);
        }
        if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
          await page.screenshot({ path: screenshotVariant(process.env.CLARACORE_UI_SCREENSHOT_PATH, `${theme}-${width}`), fullPage: true });
        }
      }
    }

    // Connection details never start a canvas. The small CSS light has a
    // visible pause control and the selected source continues to be read-only.
    await page.click("#homePresenceDisclosure > summary");
    const expanded = await page.evaluate(() => ({ open: document.querySelector("#homePresenceDisclosure").open, connection: window.ClaraCoreTestHooks.homeConnection() }));
    assert.equal(expanded.open, true);
    assert.equal(expanded.connection.canvas, false);
    await page.click("#homeConnectionMotion");
    assert.equal(await page.evaluate(() => window.ClaraCoreTestHooks.homeConnection().paused), true);
    await page.click("#homePresenceDisclosure > summary");
    const collapsed = await page.evaluate(() => ({ open: document.querySelector("#homePresenceDisclosure").open, connection: window.ClaraCoreTestHooks.homeConnection() }));
    assert.equal(collapsed.open, false);
    assert.equal(collapsed.connection.animated, false);
    assert.deepEqual(await continuityState(database), persistedBeforeReading);
    assert.deepEqual(rendererErrors, [], "Renderer errors during Home understanding smoke");
    console.log(JSON.stringify({ ok: true, empty, loading, errorState, selected, fullReading, layouts, expanded, collapsed }, null, 2));
  } finally {
    try {
      if (app) await app.close();
    } finally {
      try {
        if (database) await database.close();
      } finally {
        try {
          // dataRoot is the mkdtemp directory created by this test only.
          await fs.rm(dataRoot, { recursive: true, force: true });
        } finally {
          if (previousDataRoot === undefined) delete process.env.CLARACORE_DESKTOP_DATA_DIR;
          else process.env.CLARACORE_DESKTOP_DATA_DIR = previousDataRoot;
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
