const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const packagedExecutable = String(process.env.CLARACORE_DESKTOP_TEST_EXECUTABLE || "").trim();
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-update-settings-ui-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: packagedExecutable || electronPath,
      args: packagedExecutable ? [] : ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot,
        CLARACORE_DESKTOP_USER_DATA_DIR: path.join(dataRoot, "user-data"),
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    const fixture = await app.evaluate(async ({ app, shell }) => {
      const platform = process.platform;
      const arch = process.arch;
      const version = "0.5.5";
      const assetName = platform === "darwin"
        ? `ClaraCore-Desktop-${version}-arm64.dmg`
        : `ClaraCore-Desktop-${version}-x64-Setup.exe`;
      globalThis.__claracoreOpenedUpdateUrl = null;
      shell.openExternal = async (url) => {
        globalThis.__claracoreOpenedUpdateUrl = url;
      };
      globalThis.fetch = async () => ({
        status: 200,
        ok: true,
        async json() {
          return {
            tag_name: `v${version}`,
            name: `ClaraCore Desktop ${version}`,
            html_url: `https://github.com/xiaomao361/claracore-desktop/releases/tag/v${version}`,
            published_at: "2026-07-16T12:00:00Z",
            draft: false,
            prerelease: false,
            assets: [
              {
                name: assetName,
                state: "uploaded",
                browser_download_url: `https://github.com/xiaomao361/claracore-desktop/releases/download/v${version}/${assetName}`
              }
            ]
          };
        }
      });
      return { platform, arch, appVersion: app.getVersion(), assetName };
    });

    await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
    await page.click("[data-view='settings']");
    await page.click("[data-settings-tab='general']");
    await page.click("#checkForUpdates");
    await page.waitForFunction(
      () => document.querySelector("#updateCheckStatus")?.textContent.includes("0.5.5"),
      null,
      { timeout: 10000 }
    );

    const rendered = await page.evaluate(() => ({
      status: document.querySelector("#updateCheckStatus")?.textContent,
      downloadHidden: document.querySelector("#downloadUpdate")?.hidden,
      notesHidden: document.querySelector("#viewUpdateNotes")?.hidden,
      buttonDisabled: document.querySelector("#checkForUpdates")?.disabled
    }));
    if (rendered.downloadHidden || rendered.notesHidden || rendered.buttonDisabled) {
      throw new Error(`Update actions were not rendered correctly: ${JSON.stringify(rendered)}`);
    }

    await page.click("#downloadUpdate");
    const openedUrl = await app.evaluate(() => globalThis.__claracoreOpenedUpdateUrl);
    if (!openedUrl?.endsWith(`/${fixture.assetName}`)) {
      throw new Error(`Download action opened the wrong URL: ${openedUrl}`);
    }
    const blocked = await page.evaluate(() => window.ClaraCoreDesktop.openUpdateUrl("https://example.com/evil.exe"));
    if (blocked !== false) throw new Error("Untrusted update URL was not blocked.");

    await app.evaluate(() => {
      globalThis.fetch = async () => ({
        status: 200,
        ok: true,
        async json() {
          return {
            tag_name: "v0.5.4",
            name: "ClaraCore Desktop 0.5.4",
            html_url: "https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.5.4",
            published_at: "2026-07-16T12:00:00Z",
            draft: false,
            prerelease: false,
            assets: []
          };
        }
      });
    });
    await page.click("#checkForUpdates");
    await page.waitForFunction(
      () => !document.querySelector("#updateCheckStatus")?.textContent.includes("0.5.5"),
      null,
      { timeout: 10000 }
    );
    const current = await page.evaluate(() => ({
      status: document.querySelector("#updateCheckStatus")?.textContent,
      downloadHidden: document.querySelector("#downloadUpdate")?.hidden
    }));
    if (!current.downloadHidden) throw new Error(`Up-to-date state kept download visible: ${JSON.stringify(current)}`);

    await app.close();
    console.log(JSON.stringify({ ok: true, packaged: Boolean(packagedExecutable), fixture, rendered, current, dataRoot }, null, 2));
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
