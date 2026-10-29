const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function waitForRuntimeSnapshot(page, predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot = null;
  while (Date.now() < deadline) {
    lastSnapshot = await page.evaluate(() => window.ClaraCoreDesktop.getRuntimeSnapshot());
    if (predicate(lastSnapshot)) return lastSnapshot;
    await page.waitForTimeout(150);
  }
  throw new Error(`Timed out waiting for runtime snapshot. Last snapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function fillExact(page, selector, value) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.fill(selector, value);
    if ((await page.locator(selector).inputValue()) === value) return;
  }
  throw new Error(`Could not fill ${selector} with the exact test value.`);
}

function screenshotVariant(filePath, suffix) {
  const extension = path.extname(filePath);
  return `${filePath.slice(0, -extension.length)}-${suffix}${extension}`;
}

async function stabilizeScreenshot(page) {
  const viewport = page.viewportSize();
  if (viewport?.width > 1) {
    await page.setViewportSize({ width: viewport.width - 1, height: viewport.height });
    await page.setViewportSize(viewport);
  }
  await page.waitForTimeout(150);
}

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase1-settings-ui-"));
  const userDataRoot = path.join(dataRoot, "user-data");
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
    page.on("pageerror", (error) => rendererErrors.push(error?.message || String(error)));
    const pageTitle = await page.title();
    if (!pageTitle.includes("ClaraCore Desktop")) throw new Error(`Unexpected Electron page title: ${pageTitle}`);
    await app.evaluate(() => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (String(url).endsWith("/api/tags")) {
          return {
            ok: true,
            async json() {
              return { models: [{ name: "bge-m3:latest" }] };
            }
          };
        }
        if (String(url).endsWith("/v1/models")) {
          return {
            ok: true,
            async json() {
              return { data: [{ id: "ui-model-a" }, { id: "ui-model-b" }] };
            }
          };
        }
        return originalFetch(url, options);
      };
    });
    // Changing the embedding provider/model now raises a rebuild-vectors confirm;
    // accept it so the save proceeds under headless automation.
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
    await page.click("[data-view='settings']");
    await page.waitForSelector("[data-settings-open='models']");
    const assert = require("node:assert/strict");
    assert.equal(await page.locator("[data-settings-open]").count(), 7);
    assert.equal(await page.locator("[data-settings-tab]").count(), 0);
    for (const scope of ["appearance", "models", "controller", "gateway", "knowledge", "storage", "recovery"]) {
      await page.click(`[data-settings-open='${scope}']`);
      await page.waitForFunction(() => document.querySelector("#settingsDetailDialog").open);
      assert.equal(await page.locator("[data-settings-editor]:visible").count(), 1);
      assert.equal(await page.locator(`[data-settings-editor='${scope}']`).isVisible(), true);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#settingsDetailDialog").open);
      assert.equal(await page.locator(`[data-settings-open='${scope}']`).evaluate(node => node === document.activeElement), true);
    }
    await page.click("[data-settings-open='models']");
    await page.selectOption("#innerLifeBackend", "openai-compatible");
    await fillExact(page, "#innerLifeEndpoint", "https://models.example.test/v1");
    await fillExact(page, "#innerLifeModel", "typed-model");
    await fillExact(page, "#innerLifePollSeconds", "1.5");
    await page.click("#refreshInnerLifeModels");
    await page.waitForFunction(() => document.querySelector("#innerLifeModelOptions").children.length === 2);
    assert.equal(await page.locator("#innerLifeModel").inputValue(), "typed-model");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#settingsDiscardPrompt").isVisible(), true);
    await page.click("#settingsKeepEditing");
    await page.click("#saveReflectionSettings");
    await page.waitForFunction(() => !document.querySelector("#settingsDetailDialog").open);
    const snapshot = await waitForRuntimeSnapshot(page, state => state.configuration.innerlife.model === "typed-model");
    assert.equal(snapshot.configuration.innerlife.pollSeconds, "90");
    assert.equal(snapshot.configuration.innerlife.autonomyEnabled, "false");
    assert.equal(snapshot.configuration.memoria.model, "", "Saving reflection must not configure retrieval");
    await page.click("[data-settings-open='models']");
    await fillExact(page, "#innerLifeModel", "discard-this");
    await page.click("#settingsDialogClose");
    await page.click("#settingsDiscardChanges");
    await page.click("[data-settings-open='models']");
    assert.equal(await page.locator("#innerLifeModel").inputValue(), "typed-model");
    await page.click("#settingsDialogClose");
    await page.click("[data-settings-open='models']");
    await page.selectOption("#memoriaProvider", "ollama");
    await page.click("#saveMemorySettings");
    assert.equal(await page.locator("#settingsDetailDialog").evaluate(node => node.open), true);
    await page.click("#refreshMemoriaModels");
    await page.waitForFunction(() => document.querySelector("#memoriaModelOptions").children.length === 1);
    await fillExact(page, "#memoriaModel", "bge-m3:latest");
    await page.click("#saveMemorySettings");
    await page.waitForFunction(() => !document.querySelector("#settingsDetailDialog").open);
    await waitForRuntimeSnapshot(page, state => state.configuration.memoria.model === "bge-m3:latest");
    await page.click("[data-settings-open='appearance']");
    await page.selectOption("#settingsLanguage", "zh");
    await page.selectOption("#settingsTheme", "dark");
    await page.click("#saveAppearanceSettings");
    await page.waitForFunction(() => !document.querySelector("#settingsDetailDialog").open && document.documentElement.lang === "zh-CN");
    assert.deepEqual(rendererErrors, []);
    await app.close(); app = null;
    console.log(JSON.stringify({ ok: true, settings: "overview-and-independent-dialogs", dataRoot }));
  } finally {
    if (app) await app.close().catch(() => {});
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
