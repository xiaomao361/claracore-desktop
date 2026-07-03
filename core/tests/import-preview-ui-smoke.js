const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const productRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-product-json-ui-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: productRoot,
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page.waitForSelector("[data-view='settings']", { timeout: 15000 });
    await page.click("[data-view='settings']");
    await page.click("[data-settings-tab='data']");
    await page.waitForFunction(() => window.ClaraCoreDesktop && document.querySelector("#exportProductJson"));

    const dataText = await page.textContent("#dataView");
    if (!dataText.includes("product JSON") && !dataText.includes("产品 JSON")) {
      throw new Error(`Data page does not expose product JSON: ${dataText}`);
    }
    if (dataText.includes("Import old Memoria") || dataText.includes("导入旧 Memoria")) {
      throw new Error("Data page still exposes old-system import as a main UI action.");
    }
    if (await page.locator("#importPreviewList").count()) {
      throw new Error("Data page still exposes old-system import preview.");
    }

    const before = await page.evaluate(() =>
      window.ClaraCoreDesktop.createMemory({
        title: "UI product JSON before",
        body: "This Memory should return after product JSON import.",
        labels: "ui, json"
      })
    );
    const exported = await page.evaluate(() => window.ClaraCoreDesktop.exportProductJson({ silent: true }));
    await fs.access(exported.path);
    const after = await page.evaluate(() =>
      window.ClaraCoreDesktop.createMemory({
        title: "UI product JSON after",
        body: "This Memory should disappear after product JSON import.",
        labels: "ui, json"
      })
    );
    const imported = await page.evaluate((filePath) => window.ClaraCoreDesktop.importProductJson({ filePath, silent: true }), exported.path);
    if (!imported.imported || imported.quickCheck !== "ok") {
      throw new Error(`Product JSON UI import failed: ${JSON.stringify(imported)}`);
    }
    const result = await page.evaluate(async ({ beforeId, afterId }) => {
      const beforeSearch = await window.ClaraCoreDesktop.searchMemories("UI product JSON before");
      const afterSearch = await window.ClaraCoreDesktop.searchMemories("UI product JSON after");
      const snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
      return {
        beforeFound: beforeSearch.results.some((memory) => memory.id === beforeId),
        afterFound: afterSearch.results.some((memory) => memory.id === afterId),
        backups: snapshot.backups.length
      };
    }, { beforeId: before.id, afterId: after.id });
    if (!result.beforeFound) throw new Error("Product JSON UI import did not restore exported Memory.");
    if (result.afterFound) throw new Error("Product JSON UI import did not replace post-export Memory.");
    if (result.backups < 1) throw new Error("Product JSON UI import did not register a safety backup.");

    await app.close();
    console.log(
      JSON.stringify(
        {
          ok: true,
          productRoot,
          productJsonPath: exported.path,
          restoredMemoryId: before.id,
          removedMemoryId: after.id,
          backups: result.backups
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
