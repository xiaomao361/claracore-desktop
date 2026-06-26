const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createGatewayClient, parseTextResult } = require("./gateway-client");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase2-gateway-"));
  const client = createGatewayClient(dataRoot);
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {}
    });
    if (initialized.result?.serverInfo?.name !== "claracore-desktop") {
      throw new Error("Gateway initialize did not return ClaraCore Desktop server info.");
    }

    const tools = await client.request("tools/list");
    const toolNames = new Set((tools.result?.tools || []).map((tool) => tool.name));
    for (const tool of [
      "gateway_docs",
      "memory_list",
      "memory_search",
      "memory_create",
      "memory_update",
      "memory_delete",
      "memory_restore",
      "memory_archive",
      "memory_archived_list",
      "memory_restore_archived",
      "memory_archive_suggestions",
      "memory_archive_dormant",
      "memory_stats",
      "memory_graph",
      "memory_maintenance_check",
      "memory_maintenance_run",
      "memory_export",
      "memory_import",
      "memory_merge_suggestions",
      "memory_merge",
      "memory_restricted_list",
      "memory_restrict",
      "memory_unrestrict",
      "memory_label_alias_list",
      "memory_label_alias_create",
      "memory_label_alias_delete",
      "memory_record_create",
      "memory_record_list",
      "memory_record_stats"
    ]) {
      if (!toolNames.has(tool)) throw new Error(`Gateway missing tool: ${tool}`);
    }

    const docs = await client.callTool("gateway_docs");
    const docsText = docs.result?.content?.[0]?.text || "";
    if (!docsText.includes(dataRoot) || !docsText.includes("memory_create")) {
      throw new Error("Gateway docs do not include the active data root and Memory tools.");
    }
    if (docsText.includes(`${path.sep}.claracore${path.sep}memoria`)) {
      throw new Error("Gateway docs point at old Memoria data.");
    }

    const createdResponse = await client.callTool("memory_create", {
      title: "Gateway phase2 smoke",
      body: "Gateway Memory tools should use the Desktop product database.",
      labels: ["gateway", "phase2"]
    });
    const created = parseTextResult(createdResponse).memory;
    if (!created?.id) throw new Error("Gateway memory_create did not return a Memory id.");

    const aliasCreate = parseTextResult(await client.callTool("memory_label_alias_create", {
      alias: "gw",
      canonicalLabel: "gateway"
    }));
    if (!aliasCreate.aliases.some((item) => item.alias === "gw" && item.canonicalLabel === "gateway")) {
      throw new Error(`Gateway memory_label_alias_create did not save the alias: ${JSON.stringify(aliasCreate)}`);
    }
    const aliasList = parseTextResult(await client.callTool("memory_label_alias_list"));
    if (!aliasList.aliases.some((item) => item.alias === "gw" && item.canonicalLabel === "gateway")) {
      throw new Error(`Gateway memory_label_alias_list did not include the alias: ${JSON.stringify(aliasList)}`);
    }

    const searchResponse = await client.callTool("memory_search", {
      query: "product database",
      limit: 10
    });
    const search = parseTextResult(searchResponse);
    if (!search.results.some((memory) => memory.id === created.id)) {
      throw new Error("Gateway memory_search did not find the created Memory.");
    }
    const graph = parseTextResult(await client.callTool("memory_graph", { limit: 20 }));
    if (!graph.nodes.some((node) => node.kind === "memory" && node.refId === created.id)) {
      throw new Error(`Gateway memory_graph did not include created Memory: ${JSON.stringify(graph)}`);
    }
    if (!graph.nodes.some((node) => node.kind === "label" && node.refId === "gateway")) {
      throw new Error(`Gateway memory_graph did not include label node: ${JSON.stringify(graph)}`);
    }
    if (!graph.edges.some((edge) => edge.from === `memory:${created.id}` && edge.to === "label:gateway" && edge.kind === "labeled")) {
      throw new Error(`Gateway memory_graph did not include Memory-label edge: ${JSON.stringify(graph.edges)}`);
    }
    const maintenanceCheck = parseTextResult(await client.callTool("memory_maintenance_check"));
    if (!["ok", "needs_repair"].includes(maintenanceCheck.status) || !maintenanceCheck.counts) {
      throw new Error(`Gateway memory_maintenance_check returned invalid report: ${JSON.stringify(maintenanceCheck)}`);
    }
    const maintenanceDryRun = parseTextResult(await client.callTool("memory_maintenance_run", { dryRun: true }));
    if (!maintenanceDryRun.dryRun || !maintenanceDryRun.before || !maintenanceDryRun.after) {
      throw new Error(`Gateway memory_maintenance_run dry run returned invalid result: ${JSON.stringify(maintenanceDryRun)}`);
    }
    const exportedArchive = parseTextResult(await client.callTool("memory_export"));
    if (!exportedArchive.path || exportedArchive.counts.memories < 1) {
      throw new Error(`Gateway memory_export did not create an archive: ${JSON.stringify(exportedArchive)}`);
    }
    await fs.access(exportedArchive.path);
    const duplicateImport = parseTextResult(await client.callTool("memory_import", { filePath: exportedArchive.path }));
    if (duplicateImport.memories.imported !== 0 || duplicateImport.memories.skipped < 1) {
      throw new Error(`Gateway memory_import did not skip existing archive records: ${JSON.stringify(duplicateImport)}`);
    }
    const mergeTarget = parseTextResult(
      await client.callTool("memory_create", {
        title: "Gateway duplicate merge",
        body: "Gateway should find duplicate Memory records and merge them safely.",
        labels: ["gateway", "duplicate"]
      })
    ).memory;
    const mergeSource = parseTextResult(
      await client.callTool("memory_create", {
        title: "Gateway duplicate merge",
        body: "Gateway should find duplicate Memory records and merge them safely. Source detail.",
        labels: ["gateway", "duplicate", "source"]
      })
    ).memory;
    const mergeSuggestions = parseTextResult(await client.callTool("memory_merge_suggestions", { limit: 10 }));
    const mergeSuggestion = mergeSuggestions.suggestions.find(
      (suggestion) =>
        [suggestion.target.id, suggestion.source.id].includes(mergeTarget.id) &&
        [suggestion.target.id, suggestion.source.id].includes(mergeSource.id)
    );
    if (!mergeSuggestion) {
      throw new Error(`Gateway memory_merge_suggestions did not include duplicate pair: ${JSON.stringify(mergeSuggestions)}`);
    }
    const mergeResult = parseTextResult(
      await client.callTool("memory_merge", {
        targetId: mergeSuggestion.target.id,
        sourceId: mergeSuggestion.source.id
      })
    );
    if (!mergeResult.merged || mergeResult.source.status !== "deleted" || !mergeResult.target.labels.includes("source")) {
      throw new Error(`Gateway memory_merge did not merge source into target: ${JSON.stringify(mergeResult)}`);
    }
    const archiveCandidate = parseTextResult(
      await client.callTool("memory_create", {
        title: "Gateway archive candidate",
        body: "Gateway should archive and restore Memory records without deleting them.",
        labels: ["gateway", "archive"]
      })
    ).memory;
    const archived = parseTextResult(await client.callTool("memory_archive", { id: archiveCandidate.id })).memory;
    if (archived.status !== "archived") {
      throw new Error(`Gateway memory_archive did not mark Memory archived: ${JSON.stringify(archived)}`);
    }
    const archivedList = parseTextResult(await client.callTool("memory_archived_list", { limit: 10 }));
    if (!archivedList.results.some((memory) => memory.id === archiveCandidate.id)) {
      throw new Error(`Gateway memory_archived_list did not include archived Memory: ${JSON.stringify(archivedList)}`);
    }
    const restoredArchived = parseTextResult(await client.callTool("memory_restore_archived", { id: archiveCandidate.id })).memory;
    if (restoredArchived.status !== "active") {
      throw new Error(`Gateway memory_restore_archived did not restore Memory: ${JSON.stringify(restoredArchived)}`);
    }
    const archiveSuggestions = parseTextResult(await client.callTool("memory_archive_suggestions", { olderThanDays: 1, limit: 10 }));
    if (!Array.isArray(archiveSuggestions.suggestions)) {
      throw new Error(`Gateway memory_archive_suggestions returned invalid result: ${JSON.stringify(archiveSuggestions)}`);
    }
    const archiveDryRun = parseTextResult(await client.callTool("memory_archive_dormant", { olderThanDays: 1, limit: 10, dryRun: true }));
    if (!archiveDryRun.dryRun || typeof archiveDryRun.archived !== "number") {
      throw new Error(`Gateway memory_archive_dormant dry run returned invalid result: ${JSON.stringify(archiveDryRun)}`);
    }

    const updatedResponse = await client.callTool("memory_update", {
      id: created.id,
      title: "Gateway phase2 smoke updated",
      body: "Gateway Memory update should replace the saved content.",
      labels: "gw, updated"
    });
    const updated = parseTextResult(updatedResponse).memory;
    if (updated.title !== "Gateway phase2 smoke updated") {
      throw new Error("Gateway memory_update did not persist the updated title.");
    }
    if (!updated.labels.includes("updated")) {
      throw new Error("Gateway memory_update did not persist updated labels.");
    }
    if (!updated.labels.includes("gateway") || updated.labels.includes("gw")) {
      throw new Error(`Gateway memory_update did not canonicalize alias labels: ${JSON.stringify(updated.labels)}`);
    }
    const restrictedCreated = parseTextResult(
      await client.callTool("memory_create", {
        title: "Gateway restricted smoke",
        body: "Gateway restricted Memory should not appear in normal search.",
        labels: "gateway, restricted",
        sensitivity: "restricted"
      })
    ).memory;
    if (restrictedCreated.sensitivity !== "restricted") {
      throw new Error(`Gateway memory_create did not save restricted sensitivity: ${JSON.stringify(restrictedCreated)}`);
    }
    const hiddenRestricted = parseTextResult(
      await client.callTool("memory_search", {
        query: "Gateway restricted Memory",
        limit: 10
      })
    );
    if (hiddenRestricted.results.some((memory) => memory.id === restrictedCreated.id)) {
      throw new Error("Gateway normal memory_search returned restricted Memory.");
    }
    const restrictedList = parseTextResult(await client.callTool("memory_restricted_list", { limit: 10 }));
    if (!restrictedList.results.some((memory) => memory.id === restrictedCreated.id)) {
      throw new Error("Gateway memory_restricted_list did not include restricted Memory.");
    }
    const unrestricted = parseTextResult(await client.callTool("memory_unrestrict", { id: restrictedCreated.id })).memory;
    if (unrestricted.sensitivity !== "normal") {
      throw new Error("Gateway memory_unrestrict did not restore normal sensitivity.");
    }
    const restrictedAgain = parseTextResult(await client.callTool("memory_restrict", { id: restrictedCreated.id })).memory;
    if (restrictedAgain.sensitivity !== "restricted") {
      throw new Error("Gateway memory_restrict did not restore restricted sensitivity.");
    }
    const aliasDelete = parseTextResult(await client.callTool("memory_label_alias_delete", { alias: "gw" }));
    if (aliasDelete.aliases.some((item) => item.alias === "gw")) {
      throw new Error("Gateway memory_label_alias_delete did not remove the alias.");
    }

    const recordResponse = await client.callTool("memory_record_create", {
      recordType: "metric",
      title: "Gateway metric",
      value: {
        score: 8,
        unit: "points"
      },
      occurredAt: "2026-06-25T09:00:00.000Z",
      source: "phase2-gateway-smoke"
    });
    const record = parseTextResult(recordResponse).record;
    if (!record?.id || record.recordType !== "metric" || record.value.score !== 8) {
      throw new Error(`Gateway memory_record_create did not return the saved record: ${JSON.stringify(record)}`);
    }
    const recordList = parseTextResult(await client.callTool("memory_record_list", {
      recordType: "metric",
      limit: 10
    }));
    if (!recordList.records.some((item) => item.id === record.id)) {
      throw new Error("Gateway memory_record_list did not include the saved structured record.");
    }
    const recordStats = parseTextResult(await client.callTool("memory_record_stats"));
    if (!recordStats.types.some((item) => item.recordType === "metric" && item.count === 1)) {
      throw new Error(`Gateway memory_record_stats did not count the saved structured record: ${JSON.stringify(recordStats)}`);
    }

    const listResponse = await client.callTool("memory_list", { limit: 5 });
    const list = parseTextResult(listResponse);
    if (!list.results.some((memory) => memory.id === created.id)) {
      throw new Error("Gateway memory_list did not include the updated Memory.");
    }

    await client.callTool("memory_delete", { id: created.id });
    const statsAfterDelete = parseTextResult(await client.callTool("memory_stats"));
    if (statsAfterDelete.deletedCount !== 2 || statsAfterDelete.labels.some((item) => item.label === "updated")) {
      throw new Error(`Gateway memory_stats did not reflect delete and labels: ${JSON.stringify(statsAfterDelete)}`);
    }
    const afterDeleteResponse = await client.callTool("memory_search", {
      query: "Gateway phase2 smoke updated",
      limit: 10
    });
    const afterDelete = parseTextResult(afterDeleteResponse);
    if (afterDelete.results.some((memory) => memory.id === created.id)) {
      throw new Error("Gateway memory_delete did not hide the Memory from active search.");
    }
    const restored = parseTextResult(await client.callTool("memory_restore", { id: created.id })).memory;
    if (restored.status !== "active") {
      throw new Error("Gateway memory_restore did not restore the Memory.");
    }
    const statsAfterRestore = parseTextResult(await client.callTool("memory_stats"));
    if (statsAfterRestore.deletedCount !== 1 || statsAfterRestore.activeCount !== 3) {
      throw new Error(`Gateway memory_stats did not reflect restore: ${JSON.stringify(statsAfterRestore)}`);
    }
    if (!statsAfterRestore.labels.some((item) => item.label === "updated")) {
      throw new Error(`Gateway memory_stats did not restore active labels: ${JSON.stringify(statsAfterRestore)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          memoryId: created.id,
          structuredRecordId: record.id,
          tools: [...toolNames].filter((name) => name.startsWith("memory_"))
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
