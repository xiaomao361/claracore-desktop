const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { initializeProductDatabase } = require("../db/database");
const { saveKnowledgeRootPreference } = require("../knowledge/preferences");
const { createMaterialReference, resolveMaterialReference, bindMaterialResolver, resolveInboxMaterials } = require("../innerlife/material-reference");

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-material-"));
  const database = await initializeProductDatabase(path.join(root, "test.db"));
  const core = { database, paths: { dataRoot: root } }, app = { getPath: () => root };
  const agentId = "codex";
  try {
    const library = path.join(root, "library"); await fs.mkdir(path.join(library, "notes"), { recursive: true });
    const document = path.join(library, "notes/source.md");
    await fs.writeFile(document, "# Material\n\n<a id=\"evidence\"></a>\n## Evidence\n\n来源：fixture\n\n日期：2026-10-15 · 归属：来源陈述\n\nACTUAL_KNOWLEDGE_BODY_CANARY\n");
    await saveKnowledgeRootPreference(app, library);
    bindMaterialResolver(core, app);
    const memory = await database.createMemory({ agentId, body: "MEMORY_MATERIAL_CANARY" });
    const memoryReference = await createMaterialReference(core, app, agentId, memory.id);
    assert((await resolveMaterialReference(core, app, memoryReference, agentId)).body.includes("MEMORY_MATERIAL_CANARY"));
    const escaped = await database.createMemory({ agentId, body: '\\"'.repeat(1000) });
    const escapedReference = await createMaterialReference(core, app, agentId, escaped.id);
    const envelope = await resolveInboxMaterials(database, [{ id: "escaped", source: "shared_understanding", metadata: { materialReference: escapedReference } }], agentId);
    assert(envelope.items[0].body.length <= 1900); assert.equal(JSON.parse(envelope.items[0].body).excerptOnly, true);
    const descriptor = await createMaterialReference(core, app, agentId, "notes/source.md#evidence");
    const inbox = await database.submitInnerLifeInbox({ agentId, source: "shared_understanding", body: "Material reference: notes/source.md#evidence", metadata: { materialReference: descriptor } });
    assert(!inbox.body.includes("ACTUAL_KNOWLEDGE_BODY_CANARY"));
    let prompts = [];
    database.innerLifeGenerate = async input => { prompts.push(input.prompt); return "[NO_SHARE]"; };
    const processed = await database.processInnerLifeOnce({ agentId });
    assert(prompts.some(prompt => prompt.includes("ACTUAL_KNOWLEDGE_BODY_CANARY")));
    assert.equal(processed.share, null, "Resolving material must not force a thought or delivery");
    assert.equal(processed.materialResolution[0].status, "resolved");
    assert.equal((await database.getInnerLifeInboxItem(inbox.id)).status, "processed");

    // A changed reference cannot silently become new evidence. It remains
    // pending, while another valid material in the same page can proceed.
    const changed = await database.submitInnerLifeInbox({ agentId, source: "shared_understanding", body: "Material reference", metadata: { materialReference: descriptor } });
    await fs.appendFile(document, "\nEXTERNALLY_CHANGED_CONTENT\n");
    const valid = await database.submitInnerLifeInbox({ agentId, source: "shared_understanding", body: "Material reference", metadata: { materialReference: memoryReference } });
    prompts = [];
    const partial = await database.processInnerLifeOnce({ agentId });
    assert(partial.materialResolution.some(item => item.inboxId === changed.id && item.code === "material_changed"));
    assert(partial.materialResolution.some(item => item.inboxId === valid.id && item.status === "resolved"));
    assert(prompts.some(prompt => prompt.includes("MEMORY_MATERIAL_CANARY")));
    assert(!prompts.some(prompt => prompt.includes("EXTERNALLY_CHANGED_CONTENT")));
    assert.equal((await database.getInnerLifeInboxItem(changed.id)).status, "pending");
    assert.equal((await database.getInnerLifeInboxItem(valid.id)).status, "processed");
    prompts = [];
    const blocked = await database.processInnerLifeOnce({ agentId });
    assert.equal(blocked.shareDecision.reason, "material_unavailable"); assert.equal(prompts.length, 0);
    assert.equal((await database.getInnerLifeInboxItem(changed.id)).status, "pending");

    const currentDescriptor = await createMaterialReference(core, app, agentId, "notes/source.md#evidence");
    const digestItem = await database.submitInnerLifeInbox({ agentId, source: "shared_understanding", body: "Material reference", metadata: { materialReference: currentDescriptor } });
    prompts = [];
    const digested = await database.runInnerLifeDigest({ agentId });
    assert.equal(digested.status, "partial");
    assert(prompts.some(prompt => prompt.includes("EXTERNALLY_CHANGED_CONTENT")));
    assert(digested.processedInboxIds.includes(digestItem.id)); assert(!digested.processedInboxIds.includes(changed.id));
    assert(digested.digest.metadata.materialResolution.some(item => item.status === "failed"));
    assert.equal((await database.getInnerLifeInboxItem(changed.id)).status, "pending");

    // Exploration shares the same resolver and never sees stale pointer bodies.
    prompts = [];
    const explored = await database.exploreInnerLife({ agentId, ingestSources: false });
    assert(explored.materialResolution.some(item => item.code === "material_changed"));
    assert(!prompts.some(prompt => prompt.includes("Material reference")));

    await database.setMemorySensitivity(memory.id, "restricted");
    await assert.rejects(resolveMaterialReference(core, app, memoryReference, agentId), /material_unavailable/);
    await database.createContinuityLine({ id: "line-foreign", title: "Other agent", agentId: "other", makeActive: false });
    await database.saveCurrentPosition({ lineId: "line-foreign", summary: "PRIVATE_FOREIGN_CANARY" });
    await assert.rejects(createMaterialReference(core, app, agentId, "line-foreign"), /material_not_owned/);
    await assert.rejects(createMaterialReference(core, app, agentId, "https://example.invalid/source"), /unsupported_material_reference/);
    const legacy = await resolveInboxMaterials(database, [{ id: "legacy", source: "shared_understanding", body: "a path", metadata: {} }], agentId);
    assert.equal(legacy.receipts[0].code, "legacy_material_reference_needs_review"); assert.equal(legacy.items.length, 0);
    const otherLibrary = path.join(root, "other-library"); await fs.mkdir(otherLibrary);
    await saveKnowledgeRootPreference(app, otherLibrary);
    await assert.rejects(resolveMaterialReference(core, app, currentDescriptor, agentId), /material_changed/);
    console.log(JSON.stringify({ suite: "understanding-material", actualSQLiteMarkdown: true, processDigestExploreResolved: true, changedRestrictedForeignBlocked: true, failedItemsRemainPending: true, noNetworkOrLiveModel: true }));
  } finally { await database.close(); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
