const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");
const { parseHTML } = require("linkedom");
const { buildWebsite } = require("./build-website");

async function main() {
  await buildWebsite();
  const output = path.resolve(__dirname, "../site-dist");
  const html = await fs.readFile(path.join(output, "index.html"), "utf8");
  const script = await fs.readFile(path.join(output, "site.js"), "utf8");
  for (const search of ["", "?lang=zh", "?lang=unsupported"]) {
    const { window, document } = parseHTML(html);
    Object.defineProperty(window, "location", { value: { search }, configurable: true });
    assert.equal(document.querySelectorAll("h1").length, 1);
    assert(document.querySelector("main"));
    for (const element of document.querySelectorAll("[data-en]")) assert(element.dataset.zh, "Missing Chinese text");
    for (const element of document.querySelectorAll("[data-alt-en]")) assert(element.dataset.altZh);
    for (const element of document.querySelectorAll("[data-label-en]")) assert(element.dataset.labelZh);
    for (const element of document.querySelectorAll("a[href], img[src], script[src], link[href]")) {
      const value = element.getAttribute("src") || element.getAttribute("href");
      assert(!/^(?:javascript|data):/i.test(value));
      if (value.startsWith("#")) {
        if (value.length > 1) assert(document.getElementById(value.slice(1)), `Missing anchor ${value}`);
      } else if (!/^https:\/\//.test(value)) {
        assert(!value.startsWith("/"), "Relative paths must work on GitHub project Pages");
        await fs.access(path.join(output, value));
      }
    }
    for (const image of document.querySelectorAll("img")) assert(image.hasAttribute("alt"));
    const downloads = [...document.querySelectorAll('a[href*="/releases/download/"]')];
    assert.equal(new Set(downloads.map(anchor => anchor.href)).size, 4);
    assert(downloads.every(anchor => anchor.getAttribute("aria-label")));
    assert.equal(document.querySelector("#language").hidden, true);
    vm.runInNewContext(script, { document, window, URLSearchParams });
    const initial = search === "?lang=zh" ? "zh-CN" : "en";
    assert.equal(document.documentElement.lang, initial);
    const button = document.querySelector("#language");
    assert.equal(button.hidden, false);
    button.click();
    assert.equal(document.documentElement.lang, initial === "en" ? "zh-CN" : "en");
    button.click();
    assert.equal(document.documentElement.lang, initial);
    const title = document.querySelector("h1").textContent;
    assert(title.includes(initial === "en" ? "Keep the thread." : "跨越对话"));
    assert(document.querySelector('meta[name="description"]').content.includes(initial === "en" ? "local memory" : "本地记忆"));
    assert.equal([...document.querySelectorAll('a[href*="/releases/download/"]')].map(a => a.href).join(), downloads.map(a => a.href).join());
  }
  const css = await fs.readFile(path.join(output, "styles.css"), "utf8");
  assert(css.includes("prefers-reduced-motion"));
  assert(css.includes(":focus-visible"));
  assert(!/@import|https?:\/\//.test(css), "Styles must not load external resources");
  console.log(JSON.stringify({ suite: "website-offline-dom", languageEntrypoints: 3, downloadVariants: 4, result: "passed" }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
