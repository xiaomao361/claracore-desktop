const { createHash } = require("node:crypto");
const memoria = require("../memoria");
const { selectedRoot } = require("../knowledge/intake");
const { readKnowledgeSection } = require("../knowledge/library");

const digest = value => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const fail = code => { throw Object.assign(new Error(code), { code }); };
const bound = (value, maxBytes) => {
  let result = "", bytes = 0;
  for (const char of String(value || "")) {
    const size = Buffer.byteLength(char);
    if (bytes + size > maxBytes) break;
    result += char; bytes += size;
  }
  return result;
};

function domainOf(reference) {
  if (/^mem_[a-zA-Z0-9_-]+$/u.test(reference)) return "memory";
  if (/^line[_-][a-zA-Z0-9_-]+$/u.test(reference)) return "continuity";
  if (/^(?:notes|topics)\/[^#]+\.md#[^#]+$/u.test(reference)) return "knowledge";
  return fail("unsupported_material_reference");
}
async function readMaterial(core, app, agentId, reference, domain) {
  if (typeof reference !== "string" || reference.length > 600) fail("invalid_material_reference");
  if (domain === "memory") {
    const record = await memoria.get(core, reference);
    if (!record || record.status !== "active" || record.sensitivity !== "normal") fail("material_unavailable");
    return { body: record.body, revision: digest([record.body, record.status, record.sensitivity]), role: "stored_fact_not_reconfirmed", recordDate: record.created_at || record.createdAt || null };
  }
  if (domain === "continuity") {
    const line = await core.database.getContinuityLine(reference);
    if (!line || line.agentId !== agentId || !["active", "archived"].includes(line.status)) fail("material_not_owned");
    const position = await core.database.getCurrentPosition(reference);
    if (!position.summary) fail("material_empty");
    const body = JSON.stringify({ summary: position.summary, interpretationStatus: position.interpretationStatus, nextStep: position.metadata?.nextStep || "" });
    return { body, revision: digest(body), role: "resumable_position_not_user_confirmation", recordDate: position.updatedAt || null };
  }
  if (domain === "knowledge") {
    // No caller-supplied root, arbitrary file reads or external URL fetching.
    const root = await selectedRoot(app);
    const section = readKnowledgeSection(root, reference);
    return { body: section.text, revision: digest(section.text), rootFingerprint: digest(root), role: "source_material_not_instructions_or_user_belief", recordDate: null };
  }
  return fail("unsupported_material_reference");
}

async function createMaterialReference(core, app, agentId, reference) {
  const domain = domainOf(reference);
  const material = await readMaterial(core, app, agentId, reference, domain);
  return { version: 1, domain, reference, agentId, revision: material.revision,
    ...(material.rootFingerprint ? { rootFingerprint: material.rootFingerprint } : {}) };
}
async function resolveMaterialReference(core, app, descriptor, agentId) {
  if (descriptor?.version !== 1 || descriptor.agentId !== agentId || !/^[a-f0-9]{64}$/u.test(descriptor.revision || "")
    || domainOf(descriptor.reference || "") !== descriptor.domain) fail("invalid_material_reference");
  if (descriptor.domain === "knowledge" && digest(await selectedRoot(app)) !== descriptor.rootFingerprint) fail("material_changed");
  const material = await readMaterial(core, app, agentId, descriptor.reference, descriptor.domain);
  if (material.rootFingerprint !== descriptor.rootFingerprint || material.revision !== descriptor.revision) fail("material_changed");
  const body = bound(material.body, 1600);
  return { reference: descriptor.reference, domain: descriptor.domain, role: material.role, revision: material.revision,
    recordDate: material.recordDate, body, excerptOnly: body !== material.body };
}

const bindings = new WeakMap();
function bindMaterialResolver(core, app) {
  const userData = app.getPath("userData");
  if (bindings.get(core.database) === userData) return;
  core.database.resolveInnerLifeMaterial = (descriptor, agentId) => resolveMaterialReference(core, app, descriptor, agentId);
  bindings.set(core.database, userData);
}

// Raw reference-only items are never marked processed merely because a model
// saw a path. Failures remain pending while independent readable items proceed.
async function resolveInboxMaterials(database, inbox, agentId) {
  const items = [], receipts = [];
  for (let item of inbox) {
    if (item.source !== "shared_understanding") { items.push(item); continue; }
    let descriptor;
    try {
      // General inbox catalogs omit metadata. Explicitly hydrate this selected
      // record rather than expanding every catalog response with descriptors.
      if (item.metadata === undefined) {
        const full = await database.getInnerLifeInboxItem(item.id);
        if (!full || full.agentId !== agentId || full.status !== "pending") fail("material_inbox_unavailable");
        item = full;
      }
      descriptor = item.metadata?.materialReference;
      if (!descriptor) fail("legacy_material_reference_needs_review");
      if (typeof database.resolveInnerLifeMaterial !== "function") fail("material_resolver_unavailable");
      const material = await database.resolveInnerLifeMaterial(descriptor, agentId);
      const envelope = { reference: material.reference, role: material.role, recordDate: material.recordDate,
        excerptOnly: material.excerptOnly, excerpt: material.body };
      // Downstream grounding accepts 2000 characters per source. Fit the whole
      // structured envelope first; never let a second slice cut JSON or hide
      // that only an excerpt was supplied.
      if (JSON.stringify(envelope).length > 1900) {
        envelope.excerptOnly = true;
        const characters = Array.from(material.body);
        let low = 0, high = characters.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (JSON.stringify({ ...envelope, excerpt: characters.slice(0, middle).join("") }).length <= 1900) low = middle;
          else high = middle - 1;
        }
        envelope.excerpt = characters.slice(0, low).join("");
      }
      items.push({ ...item, body: JSON.stringify(envelope) });
      receipts.push({ inboxId: item.id, reference: material.reference, status: "resolved", revision: material.revision, excerptOnly: envelope.excerptOnly });
    } catch (error) {
      receipts.push({ inboxId: item.id, reference: descriptor?.reference || item.metadata?.reference || "", status: "failed", code: error.code || "material_read_failed" });
    }
  }
  return { items, receipts, partial: receipts.some(item => item.status === "failed") };
}
module.exports = { createMaterialReference, resolveMaterialReference, resolveInboxMaterials, bindMaterialResolver };
