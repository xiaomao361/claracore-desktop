const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-shell-window-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot
      }
    });
    const page = await app.firstWindow();
    await page.waitForSelector(".topbar", { timeout: 15000 });

    const result = await page.evaluate(async () => {
      const shellState = await window.ClaraCoreDesktop.getShellState();
      const bodyRegion = getComputedStyle(document.body).webkitAppRegion;
      const topbarRegion = getComputedStyle(document.querySelector(".topbar")).webkitAppRegion;
      const sidebarRegion = getComputedStyle(document.querySelector(".sidebar")).webkitAppRegion;
      const navRegion = getComputedStyle(document.querySelector("nav")).webkitAppRegion;
      const refreshRegion = getComputedStyle(document.querySelector("#refreshButton")).webkitAppRegion;
      return {
        title: document.title,
        shellState,
        bodyRegion,
        topbarRegion,
        sidebarRegion,
        navRegion,
        refreshRegion,
        text: document.body.textContent
      };
    });

    if (result.title !== "ClaraCore Desktop" || !result.text.includes("ClaraCore")) {
      throw new Error(`Shell window did not render the expected app: ${JSON.stringify(result)}`);
    }
    if (!result.shellState.hasTray || !result.shellState.windowVisible) {
      throw new Error(`Shell state missing tray or visible window: ${JSON.stringify(result.shellState)}`);
    }
    if (process.platform === "darwin" && result.shellState.trayTitle !== "◉") {
      throw new Error(`macOS tray should show a single visible status icon: ${JSON.stringify(result.shellState)}`);
    }
    if (process.platform === "darwin" && Number(result.shellState.trayBounds?.width || 0) > 36) {
      throw new Error(`macOS tray is wider than an icon-only status item: ${JSON.stringify(result.shellState)}`);
    }
    if (result.bodyRegion !== "drag" || result.topbarRegion !== "drag" || result.sidebarRegion !== "drag") {
      throw new Error(`Shell drag regions are not enabled: ${JSON.stringify(result)}`);
    }
    if (result.navRegion !== "no-drag" || result.refreshRegion !== "no-drag") {
      throw new Error(`Interactive controls are not excluded from drag regions: ${JSON.stringify(result)}`);
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          trayBounds: result.shellState.trayBounds,
          trayTitle: result.shellState.trayTitle,
          dragRegions: {
            body: result.bodyRegion,
            topbar: result.topbarRegion,
            sidebar: result.sidebarRegion,
            nav: result.navRegion,
            refresh: result.refreshRegion
          }
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
