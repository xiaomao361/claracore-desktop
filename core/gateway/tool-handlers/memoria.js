const memoria = require("../../memoria");
const { exportProductMemoryArchive, importProductMemoryArchive } = require("../../runtime");

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
    return textResult({
      results: await memoria.list(core, withoutAgentFilter(args))
    });
  }

  if (name === "memoria_search") {
    return textResult(await memoria.search(core, withoutAgentFilter(args)));
  }

  if (name === "memoria_get") {
    const memory = await memoria.get(core, args.id);
    return textResult(memory ? { memory } : { error: "not found", id: args.id });
  }

  if (name === "memoria_create") {
    const memory = await memoria.create(core, args);
    return textResult({ memory, embedding: { status: memory.embeddingStatus || "pending", persisted: true } });
  }

  if (name === "memoria_update") {
    const existing = await memoria.get(core, args.id);
    const memory = await memoria.update(core, args.id, preserveMissingMemoryFields(existing, args));
    return textResult({ memory, embedding: { status: memory.embeddingStatus || "pending", persisted: true } });
  }

  if (name === "memoria_tag") {
    return textResult(await memoria.tag(core, args.id, args));
  }

  if (name === "memoria_restricted_list") {
    return textResult({
      results: await memoria.restricted(core, withoutAgentFilter(args))
    });
  }

  if (name === "memoria_restrict") {
    return textResult({
      memory: await memoria.restrict(core, args.id)
    });
  }

  if (name === "memoria_unrestrict") {
    return textResult({
      memory: await memoria.unrestrict(core, args.id)
    });
  }

  if (name === "memoria_delete") {
    return textResult(await memoria.remove(core, args.id));
  }

  if (name === "memoria_restore") {
    return textResult({
      memory: await memoria.restore(core, args.id)
    });
  }

  if (name === "memoria_archive") {
    return textResult({
      memory: await memoria.archive(core, args.id)
    });
  }

  if (name === "memoria_archived_list") {
    return textResult({
      results: await memoria.archived(core, withoutAgentFilter(args))
    });
  }

  if (name === "memoria_restore_archived") {
    return textResult({
      memory: await memoria.restoreArchived(core, args.id)
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
    return textResult(await memoria.graph(core, args));
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
      link: await memoria.createLink(core, args)
    });
  }

  if (name === "memoria_supersede") {
    return textResult(await memoria.supersede(core, args));
  }

  if (name === "memoria_link_list") {
    return textResult({
      links: await memoria.links(core, args)
    });
  }

  if (name === "memoria_link_delete") {
    return textResult(await memoria.deleteLink(core, args.id));
  }

  if (name === "memoria_record_create") {
    const record = await memoria.createRecord(core, args);
    return textResult({
      record,
      stats: await memoria.recordStats(core)
    });
  }

  if (name === "memoria_record_list") {
    return textResult(await memoria.records(core, args));
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
