const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const appRoot = path.resolve(__dirname, "..", "..");

async function assertNoStartupLocalStorage() {
  const startupFiles = ["app.js", "app/appearance.js"];
  const offenders = [];
  for (const file of startupFiles) {
    const source = await fs.readFile(path.join(appRoot, file), "utf8");
    if (source.includes("localStorage")) offenders.push(file);
  }
  if (offenders.length) {
    throw new Error(`Renderer startup files should not synchronously read localStorage: ${offenders.join(", ")}`);
  }
}

async function launchApp(electron, electronPath, { dataRoot, userDataRoot }) {
  return electron.launch({
    executablePath: electronPath,
    args: ["."],
    cwd: appRoot,
    env: {
      ...process.env,
      CLARACORE_DESKTOP_DATA_DIR: dataRoot,
      CLARACORE_DESKTOP_TEST_INSTANCE: "1",
      CLARACORE_DESKTOP_USER_DATA_DIR: userDataRoot
    }
  });
}

async function main() {
  await assertNoStartupLocalStorage();

  const { _electron: electron } = require("playwright");
  const electronPath = require(path.join(appRoot, "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-ux-polish-data-"));
  const userDataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-ux-polish-user-"));
  let app;

  try {
    app = await launchApp(electron, electronPath, { dataRoot, userDataRoot });
    let page = await app.firstWindow();
    await page.waitForFunction(() => document.querySelector("#brandVersion")?.textContent?.includes("v0.2."), null, {
      timeout: 15000
    });

    const focusActions = await page.evaluate(async () => {
      const views = Object.keys(window.ClaraCoreViews || {}).filter((view) => view !== "home");
      const results = [];
      for (const view of views) {
        document.querySelector(`[data-view="${view}"]`)?.click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const panel = document.querySelector(".active-view");
        results.push({
          view,
          title: document.querySelector("#viewTitle")?.textContent || "",
          actionText: panel?.querySelector(".page-focus-action")?.textContent?.trim() || ""
        });
      }
      return results;
    });

    const samePageActions = focusActions.filter((result) => result.actionText);
    if (samePageActions.length) {
      throw new Error(`Current page focus blocks should not show self-navigation actions: ${JSON.stringify(samePageActions)}`);
    }

    await page.click("[data-view='settings']");
    await page.selectOption("#settingsLanguage", "zh");
    await page.selectOption("#settingsTheme", "dark");
    await page.selectOption("#settingsMotion", "off");
    await page.selectOption("#settingsCloseBehavior", "quit");
    await page.click("#saveAppearanceSettings");
    await page.waitForFunction(
      async () => {
        const preferences = await window.ClaraCoreDesktop.getUiPreferences();
        return (
          preferences.language === "zh" &&
          preferences.theme === "dark" &&
          preferences.motion === "off" &&
          preferences.closeBehavior === "quit"
        );
      },
      null,
      { timeout: 15000 }
    );

    const settingsPath = path.join(userDataRoot, "desktop-settings.json");
    const savedSettings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    if (savedSettings.uiPreferences?.language !== "zh" || savedSettings.uiPreferences?.theme !== "dark") {
      throw new Error(`UI preferences were not saved to desktop-settings.json: ${JSON.stringify(savedSettings.uiPreferences)}`);
    }

    await app.close();
    app = await launchApp(electron, electronPath, { dataRoot, userDataRoot });
    page = await app.firstWindow();
    await page.waitForFunction(() => document.querySelector("#brandVersion")?.textContent?.includes("v0.2."), null, {
      timeout: 15000
    });
    await page.waitForFunction(
      () =>
        document.documentElement.lang === "zh-CN" &&
        document.body.dataset.themePreference === "dark" &&
        document.body.dataset.motionPreference === "off",
      null,
      { timeout: 15000 }
    );

    const restored = await page.evaluate(async () => ({
      language: document.documentElement.lang,
      navHome: document.querySelector("[data-view='home'] [data-i18n]")?.textContent || "",
      themePreference: document.body.dataset.themePreference,
      motionPreference: document.body.dataset.motionPreference,
      preferences: await window.ClaraCoreDesktop.getUiPreferences()
    }));

    if (restored.navHome !== "首页") {
      throw new Error(`Saved language preference did not restore Chinese UI: ${JSON.stringify(restored)}`);
    }
    if (restored.preferences.closeBehavior !== "quit") {
      throw new Error(`Saved close behavior did not restore: ${JSON.stringify(restored.preferences)}`);
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          userDataRoot,
          checkedViews: focusActions.map((result) => result.view),
          restored
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
