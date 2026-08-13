const memoria = require("../../memoria");
const { exportProductMemoryArchive, importProductMemoryArchive } = require("../../runtime");
const {
  catalogPage,
  boundedText,
  shapeMemoryAck,
  shapeMemoryCatalogEntry,
  shapeMemoryLinkCatalogEntry,
  shapeMemoryRecordCatalogEntry,
  shapeMemoryRecordDetail
} = require("../bounded-response");

function withoutAgentFilter(args = {}) {
  const input = { ...args };
  delete input.agentId;
  delete input.agent_id;
  return input;
}

function preserveMissingMemoryFields(memory, args = {}) {
  const input = { ...args };
  for (const field of ["title", "labels", "sensitivity"]) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) {
      input[field] = memory?.[field];
    }
  }
  return input;
}

async function handleMemoriaTool(name, args, context) {
  const { core, runtimeAppForGateway, textResult } = context;

  if (name === "memoria_list") {
    const page = await memoria.listSummaries(core, { ...withoutAgentFilter(args), bucket: "active" });
    return textResult({
      results: page.items.map(shapeMemoryCatalogEntry),
      page: catalogPage(page.items, page.total, page)
    });
  }

  if (name === "memoria_search") {
    return textResult(await memoria.searchSummary(core, withoutAgentFilter(args)));
  }

  if (name === "memoria_get") {
    const memory = await memoria.get(core, args.id);
    return textResult(memory ? { memory } : { error: "not found", id: args.id });
  }

  if (name === "memoria_create") {
    const memory = await memoria.create(core, args);
    return textResult({ memory: shapeMemoryAck(memory), persisted: true });
  }

  if (name === "memoria_update") {
    const existing = await memoria.get(core, args.id);
    const memory = await memoria.update(core, args.id, preserveMissingMemoryFields(existing, args));
    return textResult({ memory: shapeMemoryAck(memory), persisted: true });
  }

  if (name === "memoria_tag") {
    const result = await memoria.tag(core, args.id, args);
    return textResult({ ...result, memory: shapeMemoryAck(result.memory) });
  }

  if (name === "memoria_restricted_list") {
    const page = await memoria.listSummaries(core, { ...withoutAgentFilter(args), bucket: "restricted" });
    return textResult({
      results: page.items.map(shapeMemoryCatalogEntry),
      page: catalogPage(page.items, page.total, page)
    });
  }

  if (name === "memoria_restrict") {
    return textResult({
      memory: shapeMemoryAck(await memoria.restrict(core, args.id))
    });
  }

  if (name === "memoria_unrestrict") {
    return textResult({
      memory: shapeMemoryAck(await memoria.unrestrict(core, args.id))
    });
  }

  if (name === "memoria_delete") {
    return textResult(await memoria.remove(core, args.id));
  }

  if (name === "memoria_restore") {
    return textResult({
      memory: shapeMemoryAck(await memoria.restore(core, args.id))
    });
  }

  if (name === "memoria_archive") {
    return textResult({
      memory: shapeMemoryAck(await memoria.archive(core, args.id))
    });
  }

  if (name === "memoria_archived_list") {
    const page = await memoria.listSummaries(core, { ...withoutAgentFilter(args), bucket: "archived" });
    return textResult({
      results: page.items.map(shapeMemoryCatalogEntry),
      page: catalogPage(page.items, page.total, page)
    });
  }

  if (name === "memoria_restore_archived") {
    return textResult({
      memory: shapeMemoryAck(await memoria.restoreArchived(core, args.id))
    });
  }

  if (name === "memoria_archive_suggestions") {
    return textResult(await memoria.archiveSuggestions(core, args));
  }

  if (name === "memoria_archive_dormant") {
    return textResult(await memoria.archiveDormant(core, args));
  }

  if (name === "memoria_stats") {
    return textResult(await memoria.stats(core));
  }

  if (name === "memoria_graph") {
    const graph = await memoria.graph(core, args);
    return textResult({
      ...graph,
      nodes: (graph.nodes || []).map((node) => {
        const { excerpt: _excerpt, ...summary } = node;
        return {
          ...summary,
          ...(node.excerpt ? { excerptPreview: boundedText(node.excerpt, 320) } : {}),
          ...(node.kind === "memory" && node.refId
            ? { detailRef: { tool: "memoria_get", arguments: { id: node.refId } } }
            : {})
        };
      })
    });
  }

  if (name === "memoria_maintenance_check") {
    return textResult(await memoria.maintenance(core));
  }

  if (name === "memoria_maintenance_run") {
    return textResult(await memoria.maintenanceRun(core, args));
  }

  if (name === "memoria_maintenance_audit") {
    return textResult(await memoria.maintenanceAudit(core, args));
  }

  if (name === "memoria_export") {
    return textResult(await exportProductMemoryArchive(runtimeAppForGateway(), args));
  }

  if (name === "memoria_import") {
    return textResult(await importProductMemoryArchive(runtimeAppForGateway(), args));
  }

  if (name === "memoria_merge_suggestions") {
    return textResult(await memoria.mergeSuggestions(core, args));
  }

  if (name === "memoria_merge") {
    return textResult(await memoria.merge(core, args));
  }

  if (name === "memoria_label_alias_list") {
    return textResult({
      aliases: await memoria.labelAliases(core)
    });
  }

  if (name === "memoria_label_alias_create") {
    return textResult(await memoria.createLabelAlias(core, args));
  }

  if (name === "memoria_label_alias_delete") {
    return textResult(await memoria.deleteLabelAlias(core, args.alias));
  }

  if (name === "memoria_link_create") {
    return textResult({
      link: shapeMemoryLinkCatalogEntry(await memoria.createLink(core, args)),
      persisted: true
    });
  }

  if (name === "memoria_supersede") {
    const result = await memoria.supersede(core, args);
    return textResult({
      link: shapeMemoryLinkCatalogEntry(result.link),
      current: shapeMemoryAck(result.current),
      historical: shapeMemoryAck(result.historical),
      persisted: true
    });
  }

  if (name === "memoria_link_list") {
    const page = await memoria.linkSummaries(core, args);
    return textResult({
      links: page.items.map(shapeMemoryLinkCatalogEntry),
      page: catalogPage(page.items, page.total, page)
    });
  }

  if (name === "memoria_link_delete") {
    return textResult(await memoria.deleteLink(core, args.id));
  }

  if (name === "memoria_record_create") {
    const record = await memoria.createRecord(core, args);
    return textResult({
      record: shapeMemoryRecordCatalogEntry(record),
      persisted: true
    });
  }

  if (name === "memoria_record_list") {
    const page = await memoria.recordSummaries(core, args);
    return textResult({
      records: page.items.map(shapeMemoryRecordCatalogEntry),
      page: catalogPage(page.items, page.total, page)
    });
  }

  if (name === "memoria_record_get") {
    const record = await memoria.record(core, args.id);
    return textResult(record ? { record: shapeMemoryRecordDetail(record) } : { error: "not found", id: args.id });
  }

  if (name === "memoria_record_summary") {
    return textResult(await memoria.recordSummary(core, args));
  }

  if (name === "memoria_record_stats") {
    return textResult(await memoria.recordStats(core));
  }

  return undefined;
}

module.exports = {
  handleMemoriaTool
};
