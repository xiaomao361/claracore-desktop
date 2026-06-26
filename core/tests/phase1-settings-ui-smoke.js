const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase1-settings-ui-"));
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
    await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
    await page.click("[data-view='settings']");
    await page.waitForFunction(() => document.querySelector("#memoriaEndpoint")?.value, null, { timeout: 15000 });

    const defaults = await page.evaluate(() => ({
      provider: document.querySelector("#memoriaProvider").value,
      endpoint: document.querySelector("#memoriaEndpoint").value,
      model: document.querySelector("#memoriaModel").value,
      dimension: document.querySelector("#memoriaDimension").value,
      innerlifeBackend: document.querySelector("#innerLifeBackend").value,
      innerlifeEndpoint: document.querySelector("#innerLifeEndpoint").value,
      innerlifeApiKeyReadonly: document.querySelector("#innerLifeApiKey").hasAttribute("readonly"),
      innerlifeLoop: document.querySelector("#innerLifePollSeconds").value,
      innerlifeStatus: document.querySelector("#innerLifeModelStatus").textContent,
      source: document.querySelector("#memoriaSource").value,
      innerlifeSource: document.querySelector("#innerLifeSource").value
    }));
    if (defaults.provider !== "ollama") throw new Error(`Unexpected provider: ${defaults.provider}`);
    if (defaults.endpoint !== "http://127.0.0.1:11434") throw new Error(`Unexpected endpoint: ${defaults.endpoint}`);
    if (defaults.model !== "bge-m3") throw new Error(`Unexpected model: ${defaults.model}`);
    if (defaults.dimension !== "1024") throw new Error(`Unexpected dimension: ${defaults.dimension}`);
    if (defaults.innerlifeBackend !== "disabled") throw new Error(`Unexpected InnerLife backend: ${defaults.innerlifeBackend}`);
    if (defaults.innerlifeEndpoint !== "http://127.0.0.1:11434") throw new Error(`Unexpected InnerLife endpoint: ${defaults.innerlifeEndpoint}`);
    if (defaults.innerlifeApiKeyReadonly) throw new Error("InnerLife API key reference should be editable.");
    if (defaults.innerlifeLoop !== "15") throw new Error(`Unexpected InnerLife loop minutes: ${defaults.innerlifeLoop}`);
    if (!["disabled", "关闭"].some((label) => defaults.innerlifeStatus.toLowerCase().includes(label))) {
      throw new Error(`Unexpected InnerLife status: ${defaults.innerlifeStatus}`);
    }
    if (!defaults.source.includes("claracore.db") || !defaults.innerlifeSource.includes("claracore.db")) {
      throw new Error(`Settings page is not showing database-backed sources: ${JSON.stringify(defaults)}`);
    }

    await page.selectOption("#memoriaProvider", "claracore-built-in");
    await page.fill("#memoriaEndpoint", "http://127.0.0.1:11437");
    await page.fill("#memoriaModel", "bge-m3-ui-smoke");
    await page.fill("#memoriaDimension", "640");
    await page.selectOption("#innerLifeBackend", "claracore-built-in");
    await page.fill("#innerLifeEndpoint", "http://127.0.0.1:11438");
    await page.fill("#innerLifeLightModel", "ui-light");
    await page.fill("#innerLifeDeepModel", "ui-deep");
    await page.fill("#innerLifePollSeconds", "44");
    await page.fill("#innerLifeApiKey", "env:UI_INNERLIFE_API_KEY");
    await page.click("#saveSettings");
    await page.waitForFunction(
      async () => {
        const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
        return snapshot.configuration.memoria.endpoint === "http://127.0.0.1:11437";
      },
      null,
      { timeout: 15000 }
    );

    const snapshot = await page.evaluate(() => window.ClaraCoreDesktop.getRuntimeSnapshot());
    if (!snapshot.data.databasePath.startsWith(dataRoot)) {
      throw new Error(`Settings UI wrote outside product data root: ${snapshot.data.databasePath}`);
    }
    if (snapshot.configuration.memoria.provider !== "claracore-built-in") {
      throw new Error("Settings UI did not persist future ClaraCore built-in Memory provider.");
    }
    if (snapshot.configuration.memoria.endpoint !== "http://127.0.0.1:11437") {
      throw new Error("Settings UI did not persist Memoria endpoint.");
    }
    if (snapshot.configuration.memoria.model !== "bge-m3-ui-smoke") {
      throw new Error("Settings UI did not persist Memoria model.");
    }
    if (snapshot.configuration.memoria.dimension !== "640") {
      throw new Error("Settings UI did not persist Memoria dimension.");
    }
    if (snapshot.configuration.innerlife.backend !== "claracore-built-in") {
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
    if (snapshot.configuration.innerlife.apiKeyStatus !== "configured" || snapshot.configuration.innerlife.apiKeyRef !== "env:UI_INNERLIFE_API_KEY") {
      throw new Error("Settings UI did not persist InnerLife API key reference.");
    }

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          databasePath: snapshot.data.databasePath,
          endpoint: snapshot.configuration.memoria.endpoint,
          model: snapshot.configuration.memoria.model,
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
