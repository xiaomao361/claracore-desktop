const fs = require("fs/promises");
const os = require("os");
const path = require("path");

async function main() {
  const { _electron: electron } = require("playwright");
  const electronPath = require(path.resolve(__dirname, "..", "..", "node_modules", "electron"));
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-home-orb-"));
  let app;
  try {
    app = await electron.launch({
      executablePath: electronPath,
      args: ["."],
      cwd: path.resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        CLARACORE_DESKTOP_DATA_DIR: dataRoot,
        CLARACORE_DESKTOP_TEST_INSTANCE: "1"
      }
    });
    const page = await app.firstWindow();
    await page.waitForSelector("#homeOrbCanvas", { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector("#homeRuntimePanel")?.dataset.canvasReady === "1", null, { timeout: 15000 });
    await page.waitForFunction(() => {
      const canvas = document.querySelector("#homeOrbCanvas");
      if (!canvas || canvas.width <= 300 || canvas.height <= 150) return false;
      const context = canvas.getContext("2d");
      const sample = context.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let index = 3; index < sample.length; index += 4) {
        if (sample[index] > 0) return true;
      }
      return false;
    }, null, { timeout: 15000 });

    const result = await page.evaluate(() => {
      const canvas = document.querySelector("#homeOrbCanvas");
      const panel = document.querySelector("#homeRuntimePanel");
      const before = {
        width: canvas.width,
        height: canvas.height,
        cssWidth: getComputedStyle(canvas).width,
        cssDisplay: getComputedStyle(canvas).display,
        canvasReady: panel?.dataset.canvasReady || ""
      };
      const context = canvas.getContext("2d");
      const sample = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBlank = 0;
      for (let index = 3; index < sample.length; index += 4) {
        if (sample[index] > 0) nonBlank += 1;
      }
      document.body.dataset.motion = "off";
      window.dispatchEvent(new Event("resize"));
      const afterMotionOff = getComputedStyle(canvas).display;
      return {
        ...before,
        nonBlank,
        afterMotionOff
      };
    });

    if (result.width < 180 || result.height < 180) {
      throw new Error(`Home orb canvas is too small: ${JSON.stringify(result)}`);
    }
    if (result.cssDisplay === "none" || result.canvasReady !== "1") {
      throw new Error(`Home orb canvas was not enabled: ${JSON.stringify(result)}`);
    }
    if (result.nonBlank < 100) {
      throw new Error(`Home orb canvas did not draw enough pixels: ${JSON.stringify(result)}`);
    }
    if (result.afterMotionOff !== "none") {
      throw new Error(`Home orb canvas did not respect motion off: ${JSON.stringify(result)}`);
    }

    await app.close();
    console.log(JSON.stringify({ ok: true, dataRoot, canvas: result }, null, 2));
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
