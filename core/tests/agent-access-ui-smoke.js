const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const appRoot = path.resolve(__dirname, "..", "..");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-agent-access-data-"));
  const userDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-agent-access-user-"));
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
    await app.evaluate(async ({ clipboard }) => {
      globalThis.__claracoreAgentSetupClipboard = "";
      clipboard.writeText = (value) => {
        globalThis.__claracoreAgentSetupClipboard = value;
      };
    });
    const page = await app.firstWindow();
    await page.click("[data-view='agent-setup']");
    await page.waitForFunction(() => !document.querySelector("#copyAgentSetup")?.disabled, null, { timeout: 15000 });

    const hierarchy = await page.evaluate(() => {
      const side = document.querySelector("#agentSetupView .agent-access-side");
      return {
        visibleActions: [...side.querySelectorAll("button")].filter((button) => !button.hidden).map((button) => button.id),
        connectedAgentsPresent: Boolean(document.querySelector("#gatewayHandshakeList")),
        recentActivityPresent: Boolean(document.querySelector("#gatewayTraceList")),
        removedControlsPresent: Boolean(
          document.querySelector(
            "#rotateAgentGatewayToken, #openGatewayFolder, #agentIdentityList, #mcpCommand, #mcpConfig, #httpEndpointList, #agentSetupMarkdown"
          )
        ),
        helper: side.querySelector("[data-i18n='agentSetup.copyHelper']")?.textContent || "",
        status: document.querySelector("#agentSetupStatus")?.textContent || ""
      };
    });
    if (
      JSON.stringify(hierarchy.visibleActions) !== JSON.stringify(["copyAgentSetup"]) ||
      !hierarchy.connectedAgentsPresent ||
      !hierarchy.recentActivityPresent ||
      hierarchy.removedControlsPresent ||
      !hierarchy.helper ||
      !hierarchy.status
    ) {
      throw new Error(`Agent Access hierarchy contract failed: ${JSON.stringify(hierarchy)}`);
    }

    await page.click("#copyAgentSetup");
    await page.waitForFunction(() => document.querySelector("#agentSetupNotice")?.textContent.trim().length > 0);
    const copied = await app.evaluate(() => globalThis.__claracoreAgentSetupClipboard || "");
    const required = [
      "Streamable HTTP MCP",
      "Authorization: Bearer",
      "stdio MCP",
      "claracore_connection_test",
      "gateway_docs",
      "shared_line_list",
      "status=active",
      "gateway_context",
      "Current Memory Controller Contract",
      "memory_context",
      "observe-only",
      "memoria_search",
      "proactively report"
    ];
    for (const marker of required) {
      if (!copied.includes(marker)) throw new Error(`Copied setup brief is missing: ${marker}`);
    }
    for (const forbidden of ["## Module Playbook", "## Runtime Paths", "## HTTP Management Endpoints"] ) {
      if (copied.includes(forbidden)) throw new Error(`Copied setup brief contains detailed reference material: ${forbidden}`);
    }

    await page.click("[data-view='settings']");
    await page.selectOption("#settingsLanguage", "en");
    await page.selectOption("#settingsTheme", "dark");
    await page.click("#saveAppearanceSettings");
    await page.waitForFunction(
      () => document.documentElement.lang === "en" && document.body.dataset.themePreference === "dark",
      null,
      { timeout: 15000 }
    );
    await page.setViewportSize({ width: 900, height: 760 });
    await page.click("[data-view='agent-setup']");
    const responsive = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      actionCount: document.querySelectorAll("#agentSetupView .agent-access-side button").length,
      title: document.querySelector("#agentSetupView [data-i18n='agentSetup.inviteTitle']")?.textContent || "",
      theme: document.body.dataset.themePreference,
      language: document.documentElement.lang
    }));
    if (responsive.horizontalOverflow || responsive.actionCount !== 1 || responsive.theme !== "dark" || responsive.language !== "en") {
      throw new Error(`Agent Access responsive/theme contract failed: ${JSON.stringify(responsive)}`);
    }
    if (process.env.CLARACORE_UI_SCREENSHOT_PATH) {
      await page.screenshot({ path: process.env.CLARACORE_UI_SCREENSHOT_PATH, fullPage: true });
    }

    console.log(JSON.stringify({ ok: true, dataRoot, hierarchy, responsive, copiedLength: copied.length }, null, 2));
    await app.close();
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
