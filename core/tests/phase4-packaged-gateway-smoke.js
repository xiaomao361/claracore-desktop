const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createGatewayClient, parseTextResult } = require("./gateway-client");

async function main() {
  if (process.platform !== "darwin") {
    console.log(JSON.stringify({ ok: true, skipped: "packaged macOS Gateway test only runs on macOS" }, null, 2));
    return;
  }

  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase4-packaged-gateway-"));
  const executablePath = path.resolve(
    __dirname,
    "..",
    "..",
    "dist",
    "mac-arm64",
    "ClaraCore Desktop.app",
    "Contents",
    "MacOS",
    "ClaraCore Desktop"
  );
  await fs.access(executablePath);

  const client = createGatewayClient(dataRoot, {
    command: executablePath,
    args: ["--gateway"]
  });
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {}
    });
    if (initialized.result?.serverInfo?.name !== "claracore-desktop") {
      throw new Error("Packaged Gateway initialize did not return ClaraCore Desktop server info.");
    }

    const docsResponse = await client.callTool("gateway_docs");
    const docsText = docsResponse.result?.content?.[0]?.text || "";
    if (!docsText.includes("--gateway")) throw new Error("Packaged Gateway docs do not include --gateway fallback.");
    if (!docsText.includes("packaged app")) throw new Error("Packaged Gateway docs do not report packaged app source.");
    if (!docsText.includes(dataRoot)) throw new Error("Packaged Gateway docs do not include active data root.");

    const created = parseTextResult(
      await client.callTool("memory_create", {
        title: "Packaged Gateway phase4 smoke",
        body: "The packaged app executable should work as the Desktop-owned Gateway.",
        labels: ["packaged", "gateway", "phase4"]
      })
    ).memory;
    if (!created?.id) throw new Error("Packaged Gateway memory_create did not return a Memory id.");

    const aliasResult = parseTextResult(
      await client.callTool("memory_label_alias_create", {
        alias: "pkg",
        canonicalLabel: "packaged"
      })
    );
    if (!aliasResult.aliases.some((item) => item.alias === "pkg" && item.canonicalLabel === "packaged")) {
      throw new Error(`Packaged Gateway memory_label_alias_create did not save alias: ${JSON.stringify(aliasResult)}`);
    }

    const restricted = parseTextResult(
      await client.callTool("memory_create", {
        title: "Packaged restricted Gateway smoke",
        body: "Packaged restricted Memory should use explicit restricted tools.",
        labels: ["packaged", "restricted"],
        sensitivity: "restricted"
      })
    ).memory;
    if (restricted.sensitivity !== "restricted") {
      throw new Error("Packaged Gateway did not save restricted Memory sensitivity.");
    }
    const restrictedList = parseTextResult(await client.callTool("memory_restricted_list", { limit: 10 }));
    if (!restrictedList.results.some((memory) => memory.id === restricted.id)) {
      throw new Error("Packaged Gateway memory_restricted_list did not include restricted Memory.");
    }

    const search = parseTextResult(
      await client.callTool("memory_search", {
        query: "Desktop-owned Gateway",
        limit: 10
      })
    );
    if (!search.results.some((memory) => memory.id === created.id)) {
      throw new Error("Packaged Gateway memory_search did not find the created Memory.");
    }
    const graph = parseTextResult(await client.callTool("memory_graph", { limit: 20 }));
    if (!graph.nodes.some((node) => node.kind === "memory" && node.refId === created.id)) {
      throw new Error(`Packaged Gateway memory_graph did not include created Memory: ${JSON.stringify(graph)}`);
    }
    const maintenanceCheck = parseTextResult(await client.callTool("memory_maintenance_check"));
    if (!["ok", "needs_repair"].includes(maintenanceCheck.status) || !maintenanceCheck.counts) {
      throw new Error(`Packaged Gateway memory_maintenance_check returned invalid report: ${JSON.stringify(maintenanceCheck)}`);
    }
    const exportedArchive = parseTextResult(await client.callTool("memory_export"));
    if (!exportedArchive.path || exportedArchive.counts.memories < 1) {
      throw new Error(`Packaged Gateway memory_export did not create archive: ${JSON.stringify(exportedArchive)}`);
    }
    await fs.access(exportedArchive.path);
    const mergeTarget = parseTextResult(
      await client.callTool("memory_create", {
        title: "Packaged Gateway duplicate merge",
        body: "Packaged Gateway should expose Memory merge suggestions.",
        labels: ["packaged", "merge"]
      })
    ).memory;
    const mergeSource = parseTextResult(
      await client.callTool("memory_create", {
        title: "Packaged Gateway duplicate merge",
        body: "Packaged Gateway should expose Memory merge suggestions. Source detail.",
        labels: ["packaged", "merge", "source"]
      })
    ).memory;
    const mergeSuggestions = parseTextResult(await client.callTool("memory_merge_suggestions", { limit: 10 }));
    const mergeSuggestion = mergeSuggestions.suggestions.find((item) => {
      const ids = [item.target.id, item.source.id];
      return ids.includes(mergeTarget.id) && ids.includes(mergeSource.id);
    });
    if (!mergeSuggestion) {
      throw new Error(`Packaged Gateway memory_merge_suggestions did not find duplicate pair: ${JSON.stringify(mergeSuggestions)}`);
    }
    const archiveCandidate = parseTextResult(
      await client.callTool("memory_create", {
        title: "Packaged Gateway archive candidate",
        body: "Packaged Gateway should archive Memory records.",
        labels: ["packaged", "archive"]
      })
    ).memory;
    const archived = parseTextResult(await client.callTool("memory_archive", { id: archiveCandidate.id })).memory;
    if (archived.status !== "archived") {
      throw new Error(`Packaged Gateway memory_archive did not archive Memory: ${JSON.stringify(archived)}`);
    }
    const archivedList = parseTextResult(await client.callTool("memory_archived_list", { limit: 10 }));
    if (!archivedList.results.some((memory) => memory.id === archiveCandidate.id)) {
      throw new Error(`Packaged Gateway memory_archived_list did not include archived Memory: ${JSON.stringify(archivedList)}`);
    }
    const restoredArchive = parseTextResult(await client.callTool("memory_restore_archived", { id: archiveCandidate.id })).memory;
    if (restoredArchive.status !== "active") {
      throw new Error(`Packaged Gateway memory_restore_archived did not restore Memory: ${JSON.stringify(restoredArchive)}`);
    }

    const sharedLine = parseTextResult(
      await client.callTool("shared_line_update", {
        summary: "Packaged Gateway can update Shared Line from --gateway mode.",
        interpretationStatus: "confirmed",
        factsUsed: [created.id]
      })
    );
    if (!sharedLine.currentPosition.factsUsed.includes(created.id)) {
      throw new Error("Packaged Gateway shared_line_update did not persist factsUsed.");
    }
    const handoffResult = parseTextResult(
      await client.callTool("shared_line_handoff_create", {
        objective: "Packaged Gateway handoff",
        completed: ["Memory and Shared Line verified"],
        openItems: ["Continue agent setup"],
        nextStep: "Agent can resume from packaged Gateway handoff."
      })
    );
    if (handoffResult.handoff.objective !== "Packaged Gateway handoff") {
      throw new Error("Packaged Gateway shared_line_handoff_create did not persist objective.");
    }
    if (!handoffResult.sharedLine.handoffs.some((handoff) => handoff.id === handoffResult.handoff.id)) {
      throw new Error("Packaged Gateway handoff was not returned in Shared Line context.");
    }
    const context = parseTextResult(
      await client.callTool("gateway_context", {
        query: "packaged Gateway",
        limit: 5
      })
    );
    if (!context.text?.includes("Packaged Gateway can update Shared Line") || !context.memories?.some((memory) => memory.id === created.id)) {
      throw new Error(`Packaged Gateway context did not assemble Memory and Shared Line: ${JSON.stringify(context)}`);
    }
    if (context.innerLife?.doctor?.status !== "ok") {
      throw new Error("Packaged Gateway context did not include Doctor status.");
    }
    const traceList = parseTextResult(
      await client.callTool("gateway_trace_list", {
        limit: 20
      })
    );
    if (!traceList.traces?.some((trace) => trace.toolName === "gateway_context" && trace.status === "ok")) {
      throw new Error(`Packaged Gateway trace list did not include gateway_context: ${JSON.stringify(traceList.traces)}`);
    }

    const status = parseTextResult(await client.callTool("claracore_status"));
    if (status.dataRoot !== dataRoot) throw new Error(`Packaged Gateway status data root mismatch: ${status.dataRoot}`);
    if (!status.database?.initialized) throw new Error("Packaged Gateway did not initialize the product database.");

    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          executablePath,
          memoryId: created.id,
          sharedLineId: sharedLine.lineId,
          handoffId: handoffResult.handoff.id
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
