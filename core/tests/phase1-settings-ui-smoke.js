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
        return originalFetch(url, options);
      };
    });
    // Changing the embedding provider/model now raises a rebuild-vectors confirm;
    // accept it so the save proceeds under headless automation.
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
    await page.click("[data-view='settings']");
    await page.click("[data-settings-tab='models']");
    await page.waitForFunction(() => document.querySelector("#memoriaEndpoint")?.value, null, { timeout: 15000 });

    const defaults = await page.evaluate(() => ({
      provider: document.querySelector("#memoriaProvider").value,
      endpoint: document.querySelector("#memoriaEndpoint").value,
      model: document.querySelector("#memoriaModel").value,
      innerlifeBackend: document.querySelector("#innerLifeBackend").value,
      innerlifeEndpoint: document.querySelector("#innerLifeEndpoint").value,
      innerlifeApiKeyReadonly: document.querySelector("#innerLifeApiKey").hasAttribute("readonly"),
      innerlifeLoop: document.querySelector("#innerLifePollSeconds").value,
      timeZone: document.querySelector("#settingsTimeZone").value,
      expectedTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      innerlifeStatus: document.querySelector("#innerLifeModelStatus").textContent,
      memoriaOptions: [...document.querySelectorAll("#memoriaProvider option")].map((option) => option.value),
      innerlifeOptions: [...document.querySelectorAll("#innerLifeBackend option")].map((option) => option.value),
      memoriaEndpointHidden: document.querySelector("#memoriaEndpointField").hidden,
      memoriaModelHidden: document.querySelector("#memoriaModelField").hidden,
      memoriaApiKeyHidden: document.querySelector("#memoriaApiKeyField").hidden,
      memoriaConnectionHidden: document.querySelector("#memoriaConnectionRow").hidden,
      memoriaEndpointDisplay: getComputedStyle(document.querySelector("#memoriaEndpointField")).display,
      memoriaModelDisplay: getComputedStyle(document.querySelector("#memoriaModelField")).display,
      memoriaApiKeyDisplay: getComputedStyle(document.querySelector("#memoriaApiKeyField")).display,
      memoriaConnectionDisplay: getComputedStyle(document.querySelector("#memoriaConnectionRow")).display,
      innerlifeApiKeyHidden: document.querySelector("#innerLifeApiKeyField").hidden,
      hasDimensionField: Boolean(document.querySelector("#memoriaDimension")),
      hasMemoriaSourceField: Boolean(document.querySelector("#memoriaSource")),
      hasInnerLifeSourceField: Boolean(document.querySelector("#innerLifeSource"))
    }));
    if (defaults.provider !== "claracore-built-in") throw new Error(`Unexpected provider: ${defaults.provider}`);
    if (defaults.endpoint !== "http://127.0.0.1:11434") throw new Error(`Unexpected endpoint: ${defaults.endpoint}`);
    if (defaults.model !== "Xenova/bge-small-zh-v1.5") throw new Error(`Unexpected model: ${defaults.model}`);
    if (defaults.innerlifeBackend !== "openai-compatible") throw new Error(`Unexpected InnerLife backend: ${defaults.innerlifeBackend}`);
    if (defaults.innerlifeEndpoint !== "https://api.deepseek.com") throw new Error(`Unexpected InnerLife endpoint: ${defaults.innerlifeEndpoint}`);
    if (defaults.innerlifeApiKeyReadonly) throw new Error("InnerLife API key reference should be editable.");
    if (defaults.innerlifeLoop !== "15") throw new Error(`Unexpected InnerLife loop minutes: ${defaults.innerlifeLoop}`);
    if (!defaults.timeZone.includes(defaults.expectedTimeZone)) {
      throw new Error(`Settings should show the current system time zone: ${JSON.stringify(defaults)}`);
    }
    if (!["ready", "可用"].some((label) => defaults.innerlifeStatus.toLowerCase().includes(label))) {
      throw new Error(`Unexpected InnerLife status: ${defaults.innerlifeStatus}`);
    }
    if (defaults.memoriaOptions.join(",") !== "claracore-built-in,ollama,disabled") {
      throw new Error(`Unexpected Memoria provider options: ${defaults.memoriaOptions.join(",")}`);
    }
    if (defaults.innerlifeOptions.join(",") !== "disabled,ollama,openai-compatible") {
      throw new Error(`Unexpected InnerLife provider options: ${defaults.innerlifeOptions.join(",")}`);
    }
    if (!defaults.memoriaEndpointHidden || !defaults.memoriaModelHidden || !defaults.memoriaApiKeyHidden || !defaults.memoriaConnectionHidden) {
      throw new Error(`Built-in Memoria fields should be hidden: ${JSON.stringify(defaults)}`);
    }
    if ([defaults.memoriaEndpointDisplay, defaults.memoriaModelDisplay, defaults.memoriaApiKeyDisplay, defaults.memoriaConnectionDisplay].some((display) => display !== "none")) {
      throw new Error(`Built-in Memoria fields should not be rendered: ${JSON.stringify(defaults)}`);
    }
    if (defaults.innerlifeApiKeyHidden) {
      throw new Error("OpenAI-compatible InnerLife API key field should be visible.");
    }
    if (defaults.hasDimensionField || defaults.hasMemoriaSourceField || defaults.hasInnerLifeSourceField) {
      throw new Error(`Settings page should not expose internal dimension/source fields: ${JSON.stringify(defaults)}`);
    }

    await page.selectOption("#memoriaProvider", "ollama");
    await page.waitForFunction(() => !document.querySelector("#memoriaEndpointField")?.hidden && !document.querySelector("#memoriaConnectionRow")?.hidden);
    await fillExact(page, "#memoriaEndpoint", "http://127.0.0.1:11437");
    await fillExact(page, "#memoriaModel", "bge-m3");
    await page.click("#testMemoriaConnection");
    await page.waitForFunction(
      () => document.querySelector("#memoriaConnectionNotice")?.textContent.includes("bge-m3:latest")
        && document.querySelector("#memoriaConnectionNotice")?.classList.contains("ok"),
      null,
      { timeout: 10000 }
    );
    await page.click("#refreshMemoriaModels");
    await page.waitForFunction(
      () => document.querySelector("#memoriaModel")?.value === "bge-m3:latest"
        && /save|保存/i.test(document.querySelector("#memoriaModelNotice")?.textContent || ""),
      null,
      { timeout: 10000 }
    );
    await fillExact(page, "#memoriaModel", "bge-m3-ui-smoke");
    await page.selectOption("#innerLifeBackend", "ollama");
    await fillExact(page, "#innerLifeEndpoint", "http://127.0.0.1:11438");
    await fillExact(page, "#innerLifeLightModel", "ui-light");
    await fillExact(page, "#innerLifeDeepModel", "ui-deep");
    await fillExact(page, "#innerLifePollSeconds", "44");
    const modelFormBeforeSave = await page.evaluate(() => ({
      memoriaProvider: document.querySelector("#memoriaProvider").value,
      memoriaEndpoint: document.querySelector("#memoriaEndpoint").value,
      memoriaModel: document.querySelector("#memoriaModel").value,
      innerLifeBackend: document.querySelector("#innerLifeBackend").value,
      innerLifeEndpoint: document.querySelector("#innerLifeEndpoint").value,
      innerLifeLightModel: document.querySelector("#innerLifeLightModel").value,
      innerLifeDeepModel: document.querySelector("#innerLifeDeepModel").value,
      innerLifePollSeconds: document.querySelector("#innerLifePollSeconds").value,
      activePanel: document.querySelector(".settings-tab-panel.active")?.dataset.settingsPanel
    }));
    if (
      modelFormBeforeSave.memoriaProvider !== "ollama"
      || modelFormBeforeSave.memoriaEndpoint !== "http://127.0.0.1:11437"
      || modelFormBeforeSave.memoriaModel !== "bge-m3-ui-smoke"
      || modelFormBeforeSave.innerLifeBackend !== "ollama"
      || modelFormBeforeSave.innerLifeEndpoint !== "http://127.0.0.1:11438"
      || modelFormBeforeSave.innerLifeLightModel !== "ui-light"
      || modelFormBeforeSave.innerLifeDeepModel !== "ui-deep"
      || modelFormBeforeSave.innerLifePollSeconds !== "44"
      || modelFormBeforeSave.activePanel !== "models"
    ) {
      throw new Error(`Settings model form was not ready before save: ${JSON.stringify(modelFormBeforeSave)}`);
    }
    await page.click("#saveSettings");
    await page.waitForTimeout(500);
    const modelSaveState = await page.evaluate(() => ({
      notice: document.querySelector("#settingsNotice").textContent,
      disabled: document.querySelector("#saveSettings").disabled
    }));
    if (/failed|失败/i.test(modelSaveState.notice)) {
      throw new Error(`Settings model save failed in UI: ${JSON.stringify(modelSaveState)}`);
    }
    await waitForRuntimeSnapshot(
      page,
      (snapshot) => (
        snapshot.configuration.memoria.provider === "ollama"
        && snapshot.configuration.memoria.endpoint === "http://127.0.0.1:11437"
      )
    );

    const snapshot = await page.evaluate(() => window.ClaraCoreDesktop.getRuntimeSnapshot());
    if (!snapshot.data.databasePath.startsWith(dataRoot)) {
      throw new Error(`Settings UI wrote outside product data root: ${snapshot.data.databasePath}`);
    }
    if (snapshot.configuration.memoria.provider !== "ollama") {
      throw new Error(`Settings UI did not persist Ollama Memory provider: ${JSON.stringify(snapshot.configuration.memoria)}`);
    }
    if (snapshot.configuration.memoria.endpoint !== "http://127.0.0.1:11437") {
      throw new Error("Settings UI did not persist Memoria endpoint.");
    }
    if (snapshot.configuration.memoria.model !== "bge-m3-ui-smoke") {
      throw new Error(`Settings UI did not persist Memoria model: ${JSON.stringify(snapshot.configuration.memoria)}`);
    }
    if (snapshot.configuration.innerlife.backend !== "ollama") {
      throw new Error("Settings UI did not persist InnerLife backend.");
    }
    if (snapshot.configuration.innerlife.baseUrl !== "http://127.0.0.1:11438") {
      throw new Error("Settings UI did not persist InnerLife endpoint.");
    }
    if (snapshot.configuration.innerlife.lightModel !== "ui-light") {
      throw new Error("Settings UI did not persist InnerLife light model.");
    }
    if (snapshot.configuration.innerlife.deepModel !== "ui-deep") {
      throw new Error("Settings UI did not persist InnerLife deep model.");
    }
    if (snapshot.configuration.innerlife.pollSeconds !== "2640") {
      throw new Error("Settings UI did not persist InnerLife loop minutes as seconds.");
    }
    if (snapshot.configuration.innerlife.apiKeyStatus !== "configured" || !snapshot.configuration.innerlife.apiKeyRef) {
      throw new Error("Settings UI cleared the default InnerLife API key reference.");
    }

    await page.click("[data-settings-tab='general']");
    await page.evaluate(() => {
      const details = document.querySelector(".settings-gateway-details");
      if (details) details.open = true;
    });
    await page.waitForFunction(() => document.querySelector("#settingsAgentGatewayPort")?.value, null, { timeout: 15000 });
    const gatewayDefaults = await page.evaluate(() => ({
      port: document.querySelector("#settingsAgentGatewayPort").value,
      token: document.querySelector("#settingsAgentGatewayToken").value,
      endpoint: document.querySelector("#settingsAgentGatewayEndpoint").textContent,
      tokenFile: document.querySelector("#settingsAgentGatewayTokenFile").textContent,
      status: document.querySelector("#settingsAgentGatewayStatus").textContent
    }));
    if (!Number(gatewayDefaults.port)) throw new Error(`Agent Gateway port was not rendered: ${JSON.stringify(gatewayDefaults)}`);
    if (gatewayDefaults.token.length < 32) throw new Error("Agent Gateway token was not rendered.");
    if (!gatewayDefaults.endpoint.includes(`:${gatewayDefaults.port}/mcp`)) {
      throw new Error(`Agent Gateway endpoint did not match rendered port: ${JSON.stringify(gatewayDefaults)}`);
    }
    if (!gatewayDefaults.tokenFile.includes("agent-gateway.json")) {
      throw new Error(`Agent Gateway token file was not rendered: ${gatewayDefaults.tokenFile}`);
    }

    await page.click("#generateAgentGatewayToken");
    const generatedToken = await page.locator("#settingsAgentGatewayToken").inputValue();
    if (generatedToken === gatewayDefaults.token || generatedToken.length !== 64) {
      throw new Error("Agent Gateway random token generation did not update the token field.");
    }
    await page.click("#saveAgentGatewayConfig");
    await waitForRuntimeSnapshot(
      page,
      (updatedSnapshot) => updatedSnapshot.connections.httpGateway.token === generatedToken
    );
    const gatewaySnapshot = await page.evaluate(() => window.ClaraCoreDesktop.getRuntimeSnapshot().then((currentSnapshot) => currentSnapshot.connections.httpGateway));
    if (gatewaySnapshot.endpoint !== `http://127.0.0.1:${gatewaySnapshot.port}/mcp`) {
      throw new Error(`Agent Gateway endpoint did not refresh after save: got ${gatewaySnapshot.endpoint}, snapshot ${JSON.stringify(gatewaySnapshot)}`);
    }
    const renderedGateway = await page.evaluate(() => ({
      port: document.querySelector("#settingsAgentGatewayPort").value,
      token: document.querySelector("#settingsAgentGatewayToken").value,
      endpoint: document.querySelector("#settingsAgentGatewayEndpoint").textContent
    }));
    if (renderedGateway.token !== generatedToken || renderedGateway.endpoint !== gatewaySnapshot.endpoint) {
      throw new Error(`Agent Gateway settings fields did not refresh after save: ${JSON.stringify(renderedGateway)}`);
    }

    await app.close();
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
    const restartedPage = await app.firstWindow();
    const restartedSnapshot = await waitForRuntimeSnapshot(
      restartedPage,
      (currentSnapshot) => currentSnapshot?.configuration?.memoria?.model === "bge-m3-ui-smoke"
    );
    if (
      restartedSnapshot.configuration.memoria.provider !== "ollama"
      || restartedSnapshot.configuration.memoria.endpoint !== "http://127.0.0.1:11437"
    ) {
      throw new Error(`Saved Memoria configuration did not survive restart: ${JSON.stringify(restartedSnapshot.configuration.memoria)}`);
    }
    await app.close();
    app = null;
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: snapshot.data.databasePath,
          endpoint: snapshot.configuration.memoria.endpoint,
          model: snapshot.configuration.memoria.model,
          persistedAfterRestart: restartedSnapshot.configuration.memoria.model,
          innerlifeBackend: snapshot.configuration.innerlife.backend
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
