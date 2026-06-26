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
      innerlifeLoop: document.querySelector("#innerLifePollSeconds").value,
      source: document.querySelector("#memoriaSource").value,
      innerlifeSource: document.querySelector("#innerLifeSource").value
    }));
    if (defaults.provider !== "ollama") throw new Error(`Unexpected provider: ${defaults.provider}`);
    if (defaults.endpoint !== "http://127.0.0.1:11434") throw new Error(`Unexpected endpoint: ${defaults.endpoint}`);
    if (defaults.model !== "bge-m3") throw new Error(`Unexpected model: ${defaults.model}`);
    if (defaults.dimension !== "1024") throw new Error(`Unexpected dimension: ${defaults.dimension}`);
    if (defaults.innerlifeBackend !== "disabled") throw new Error(`Unexpected InnerLife backend: ${defaults.innerlifeBackend}`);
    if (defaults.innerlifeLoop !== "15") throw new Error(`Unexpected InnerLife loop: ${defaults.innerlifeLoop}`);
    if (!defaults.source.includes("claracore.db") || !defaults.innerlifeSource.includes("claracore.db")) {
      throw new Error(`Settings page is not showing database-backed sources: ${JSON.stringify(defaults)}`);
    }

    await page.fill("#memoriaEndpoint", "http://127.0.0.1:11437");
    await page.fill("#memoriaModel", "bge-m3-ui-smoke");
    await page.fill("#memoriaDimension", "640");
    await page.fill("#innerLifeBackend", "openai-compatible");
    await page.fill("#innerLifeLightModel", "ui-light");
    await page.fill("#innerLifeDeepModel", "ui-deep");
    await page.fill("#innerLifePollSeconds", "44");
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
    if (snapshot.configuration.memoria.endpoint !== "http://127.0.0.1:11437") {
      throw new Error("Settings UI did not persist Memoria endpoint.");
    }
    if (snapshot.configuration.memoria.model !== "bge-m3-ui-smoke") {
      throw new Error("Settings UI did not persist Memoria model.");
    }
    if (snapshot.configuration.memoria.dimension !== "640") {
      throw new Error("Settings UI did not persist Memoria dimension.");
    }
    if (snapshot.configuration.innerlife.backend !== "openai-compatible") {
      throw new Error("Settings UI did not persist InnerLife backend.");
    }
    if (snapshot.configuration.innerlife.lightModel !== "ui-light") {
      throw new Error("Settings UI did not persist InnerLife light model.");
    }
    if (snapshot.configuration.innerlife.deepModel !== "ui-deep") {
      throw new Error("Settings UI did not persist InnerLife deep model.");
    }
    if (snapshot.configuration.innerlife.pollSeconds !== "44") {
      throw new Error("Settings UI did not persist InnerLife loop seconds.");
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
