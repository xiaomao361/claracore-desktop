const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { getKnowledgeRootPreference, saveKnowledgeRootPreference } = require("../knowledge/preferences");

async function main() {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-knowledge-config-"));
  const app = { getPath: (name) => name === "userData" ? path.join(sandbox, "user-data") : "" };
  const root = path.join(sandbox, "library");
  try {
    assert.deepEqual(await getKnowledgeRootPreference(app), { root: "", status: "not_selected" });
    await fs.mkdir(path.join(root, "notes"), { recursive: true });
    await fs.writeFile(path.join(root, "notes", "entry.md"), "# 有来源的条目\n");
    const saved = await saveKnowledgeRootPreference(app, root);
    assert.deepEqual(saved, { root, status: "ok", documentCount: 1 });
    assert.deepEqual(await getKnowledgeRootPreference(app), saved);

    await fs.rename(root, `${root}-unmounted`);
    const missing = await getKnowledgeRootPreference(app);
    assert.equal(missing.root, root);
    assert.equal(missing.status, "root_missing");
    await assert.rejects(saveKnowledgeRootPreference(app, path.join(sandbox, "does-not-exist")), { code: "root_missing" });
    assert.equal((await getKnowledgeRootPreference(app)).root, root);

    const cleared = await saveKnowledgeRootPreference(app, "");
    assert.deepEqual(cleared, { root: "", status: "not_selected" });
    assert.equal(await fs.readFile(path.join(`${root}-unmounted`, "notes", "entry.md"), "utf8"), "# 有来源的条目\n", "Removing the directory setting must preserve source files.");
    await fs.writeFile(path.join(app.getPath("userData"), "knowledge-root.json"), "{broken");
    await assert.rejects(getKnowledgeRootPreference(app), { code: "config_corrupt" });
    console.log("Knowledge root preference: ok");
  } finally {
    await fs.rm(sandbox, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
