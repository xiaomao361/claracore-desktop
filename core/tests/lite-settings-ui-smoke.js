const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function launch(electron, executablePath, dataRoot, userDataRoot, flavor, packaged = false) {
  const env = {
    ...process.env,
    CLARACORE_DESKTOP_DATA_DIR: dataRoot,
    CLARACORE_DESKTOP_USER_DATA_DIR: userDataRoot,
    CLARACORE_DESKTOP_TEST_INSTANCE: "1"
  };
  if (flavor) env.CLARACORE_DESKTOP_BUILD_FLAVOR = flavor;
  return electron.launch({
    executablePath,
    args: packaged ? [] : ["."],
    cwd: path.resolve(__dirname, "..", ".."),
    env
  });
}

async function openModels(page) {
  await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
  await page.click("[data-view='settings']");
  await page.click("[data-settings-tab='models']");
}

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const packagedLiteExecutable = String(process.env.CLARACORE_DESKTOP_LITE_TEST_EXECUTABLE || "").trim();
  const packagedFullExecutable = String(process.env.CLARACORE_DESKTOP_FULL_TEST_EXECUTABLE || "").trim();
  const useRealOllama = process.env.CLARACORE_DESKTOP_TEST_REAL_OLLAMA === "1";
  const freshRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-lite-settings-fresh-"));
  let app;
  let realEmbedding = null;
  try {
    app = await launch(
      electron,
      packagedLiteExecutable || electronPath,
      freshRoot,
      path.join(freshRoot, "user-data"),
      packagedLiteExecutable ? "" : "lite",
      Boolean(packagedLiteExecutable)
    );
    const page = await app.firstWindow();
    page.on("dialog", (dialog) => dialog.accept().catch(() => {}));
    if (!useRealOllama) {
      await app.evaluate(() => {
        globalThis.fetch = async (url) => {
          if (String(url).endsWith("/api/tags")) {
            return { ok: true, async json() { return { models: [{ name: "bge-m3:latest" }] }; } };
          }
          throw new Error(`Unexpected test URL: ${url}`);
        };
      });
    }
    await openModels(page);
    await page.waitForFunction(() => document.querySelector("#memoriaProvider")?.value === "ollama");
    const fresh = await page.evaluate(() => ({
      flavor: document.querySelector("#settingsBuildFlavor")?.textContent,
      provider: document.querySelector("#memoriaProvider")?.value,
      model: document.querySelector("#memoriaModel")?.value,
      providers: [...document.querySelectorAll("#memoriaProvider option")].map((option) => option.value),
      builtInVisible: Boolean(document.querySelector("#memoriaProvider option[value='claracore-built-in']"))
    }));
    if (fresh.flavor !== "Lite" || fresh.provider !== "ollama" || fresh.model !== "") {
      throw new Error(`Fresh Lite defaults are wrong: ${JSON.stringify(fresh)}`);
    }
    if (fresh.builtInVisible || fresh.providers.join(",") !== "ollama,disabled") {
      throw new Error(`Lite exposed the built-in provider: ${JSON.stringify(fresh)}`);
    }
    await page.click("#saveSettings");
    await page.waitForFunction(() => /model|模型/i.test(document.querySelector("#settingsNotice")?.textContent || ""));
    await page.click("#refreshMemoriaModels");
    await page.waitForFunction(() => document.querySelector("#memoriaModel")?.value === "bge-m3:latest");
    await page.click("#saveSettings");
    await page.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.configuration.memoria.model === "bge-m3:latest";
    });
    if (useRealOllama) {
      realEmbedding = await page.evaluate(async () => {
        const memory = await window.ClaraCoreDesktop.createMemory({
          title: "Packaged Lite Ollama smoke",
          body: "The packaged Lite build must create an Ollama embedding without bundled model dependencies.",
          labels: "lite, packaged-smoke"
        });
        return window.ClaraCoreDesktop.embedMemory(memory.id);
      });
      if (realEmbedding.embedding_status !== "ready" || realEmbedding.embedding_dimension !== 1024) {
        throw new Error(`Packaged Lite Ollama embedding failed: ${JSON.stringify(realEmbedding)}`);
      }
    }
    await app.close();
    app = null;

    const migratedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-lite-settings-migrated-"));
    app = await launch(
      electron,
      packagedFullExecutable || electronPath,
      migratedRoot,
      path.join(migratedRoot, "full-user-data"),
      packagedFullExecutable ? "" : "full",
      Boolean(packagedFullExecutable)
    );
    let migratedPage = await app.firstWindow();
    await migratedPage.waitForFunction(async () => {
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return snapshot.configuration.memoria.provider === "claracore-built-in";
    });
    await app.close();

    app = await launch(
      electron,
      packagedLiteExecutable || electronPath,
      migratedRoot,
      path.join(migratedRoot, "lite-user-data"),
      packagedLiteExecutable ? "" : "lite",
      Boolean(packagedLiteExecutable)
    );
    migratedPage = await app.firstWindow();
    await openModels(migratedPage);
    await migratedPage.waitForFunction(() => !document.querySelector("#memoriaProviderNotice")?.hidden);
    const migrated = await migratedPage.evaluate(() => ({
      provider: document.querySelector("#memoriaProvider")?.value,
      model: document.querySelector("#memoriaModel")?.value,
      providers: [...document.querySelectorAll("#memoriaProvider option")].map((option) => option.value),
      notice: document.querySelector("#memoriaProviderNotice")?.textContent,
      builtInVisible: Boolean(document.querySelector("#memoriaProvider option[value='claracore-built-in']"))
    }));
    if (migrated.provider !== "" || migrated.model !== "" || migrated.builtInVisible || !migrated.notice) {
      throw new Error(`Lite did not safely explain the saved Full provider: ${JSON.stringify(migrated)}`);
    }
    await app.close();
    app = null;

    console.log(JSON.stringify({
      ok: true,
      packagedLite: Boolean(packagedLiteExecutable),
      packagedFull: Boolean(packagedFullExecutable),
      realOllama: useRealOllama,
      realEmbedding: realEmbedding ? {
        status: realEmbedding.embedding_status,
        provider: realEmbedding.embedding_provider,
        model: realEmbedding.embedding_model,
        dimension: realEmbedding.embedding_dimension
      } : null,
      fresh,
      migrated,
      freshRoot,
      migratedRoot
    }, null, 2));
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
