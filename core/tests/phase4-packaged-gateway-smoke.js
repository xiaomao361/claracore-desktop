const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createGatewayClient, parseTextResult } = require("./gateway-client");
const packageJson = require("../../package.json");
const runtime = require("../runtime");

async function main() {
  if (process.platform !== "darwin") {
    console.log(JSON.stringify({ ok: true, skipped: "packaged macOS Gateway test only runs on macOS" }, null, 2));
    return;
  }

  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase4-packaged-gateway-"));
  const executablePath = path.resolve(String(process.env.CLARACORE_DESKTOP_TEST_EXECUTABLE || path.join(
    __dirname,
    "..",
    "..",
    "dist",
    "mac-arm64",
    "ClaraCore Desktop.app",
    "Contents",
    "MacOS",
    "ClaraCore Desktop"
  )).trim());
  await fs.access(executablePath);

  const gatewayScript = path.join(
    path.dirname(path.dirname(executablePath)),
    "Resources",
    "app.asar",
    "core",
    "gateway",
    "mcp-server.js"
  );
  const client = createGatewayClient(dataRoot, {
    command: executablePath,
    args: [gatewayScript],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      CLARACORE_AGENT_ID: "codex",
      CLARACORE_CLIENT_ID: "packaged-gateway-smoke",
      CLARACORE_CONVERSATION_ID: "packaged-controller"
    }
  });
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {}
    });
    if (initialized.result?.serverInfo?.name !== "claracore-desktop") {
      throw new Error("Packaged Gateway initialize did not return ClaraCore Desktop server info.");
    }
    if (initialized.result?.serverInfo?.version !== packageJson.version) {
      throw new Error(`Packaged Gateway version mismatch: ${JSON.stringify(initialized.result?.serverInfo)}`);
    }

    const docsResponse = await client.callTool("gateway_docs");
    const docsText = docsResponse.result?.content?.[0]?.text || "";
    if (!docsText.includes("ELECTRON_RUN_AS_NODE")) throw new Error("Packaged Gateway docs do not include run-as-node launch.");
    if (!docsText.includes("CLARACORE_CLIENT_ID") || !docsText.includes("CLARACORE_CONVERSATION_ID")) {
      throw new Error("Packaged Gateway docs do not include complete stdio caller context.");
    }
    if (!docsText.includes("packaged app")) throw new Error("Packaged Gateway docs do not report packaged app source.");
    if (!docsText.includes(dataRoot)) throw new Error("Packaged Gateway docs do not include active data root.");

    const created = parseTextResult(
      await client.callTool("memoria_create", {
        title: "Packaged Gateway phase4 smoke",
        body: "The packaged app executable should work as the Desktop-owned Gateway.",
        labels: ["packaged", "gateway", "phase4"]
      })
    ).memory;
    if (!created?.id) throw new Error("Packaged Gateway memoria_create did not return a Memory id.");

    const controllerPrompt = "还记得我们之前决定的 packaged Gateway Controller 范围吗";
    const controllerMemory = parseTextResult(
      await client.callTool("memoria_create", {
        title: "Packaged Memory Controller smoke",
        body: controllerPrompt,
        labels: ["packaged", "controller"]
      })
    ).memory;
    const disabledController = parseTextResult(await client.callTool("memory_context", { prompt: controllerPrompt }));
    if (disabledController.reason !== "controller_disabled" || disabledController.decisionId) {
      throw new Error(`Packaged Gateway controller did not default off: ${JSON.stringify(disabledController)}`);
    }
    const runtimeApp = {
      getPath(name) {
        return path.join(dataRoot, name);
      },
      isPackaged: false
    };
    process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
    await runtime.saveProductSettings(runtimeApp, { "memory.controller.mode": "observe" });
    const observedController = parseTextResult(await client.callTool("memory_context", { prompt: controllerPrompt }));
    if (observedController.action !== "RETRIEVE" || observedController.context !== "" || !observedController.decisionId) {
      throw new Error(`Packaged Gateway controller did not observe retrieval: ${JSON.stringify(observedController)}`);
    }
    if (!observedController.candidates.some((candidate) => candidate.id === controllerMemory.id)) {
      throw new Error(`Packaged Gateway controller did not preserve Agent scope: ${JSON.stringify(observedController)}`);
    }

    const aliasResult = parseTextResult(
      await client.callTool("memoria_label_alias_create", {
        alias: "pkg",
        canonicalLabel: "packaged"
      })
    );
    if (!aliasResult.aliases.some((item) => item.alias === "pkg" && item.canonicalLabel === "packaged")) {
      throw new Error(`Packaged Gateway memoria_label_alias_create did not save alias: ${JSON.stringify(aliasResult)}`);
    }

    const restricted = parseTextResult(
      await client.callTool("memoria_create", {
        title: "Packaged restricted Gateway smoke",
        body: "Packaged restricted Memory should use explicit restricted tools.",
        labels: ["packaged", "restricted"],
        sensitivity: "restricted"
      })
    ).memory;
    if (restricted.sensitivity !== "restricted") {
      throw new Error("Packaged Gateway did not save restricted Memory sensitivity.");
    }
    const restrictedList = parseTextResult(await client.callTool("memoria_restricted_list", { limit: 10 }));
    if (!restrictedList.results.some((memory) => memory.id === restricted.id)) {
      throw new Error("Packaged Gateway memoria_restricted_list did not include restricted Memory.");
    }

    const search = parseTextResult(
      await client.callTool("memoria_search", {
        query: "Desktop-owned Gateway",
        limit: 10
      })
    );
    if (!search.results.some((memory) => memory.id === created.id)) {
      throw new Error("Packaged Gateway memoria_search did not find the created Memory.");
    }
    const graph = parseTextResult(await client.callTool("memoria_graph", { limit: 20 }));
    if (!graph.nodes.some((node) => node.kind === "memory" && node.refId === created.id)) {
      throw new Error(`Packaged Gateway memoria_graph did not include created Memory: ${JSON.stringify(graph)}`);
    }
    const maintenanceCheck = parseTextResult(await client.callTool("memoria_maintenance_check"));
    if (!["ok", "needs_repair"].includes(maintenanceCheck.status) || !maintenanceCheck.counts) {
      throw new Error(`Packaged Gateway memoria_maintenance_check returned invalid report: ${JSON.stringify(maintenanceCheck)}`);
    }
    const exportedArchive = parseTextResult(await client.callTool("memoria_export"));
    if (!exportedArchive.path || exportedArchive.counts.memories < 1) {
      throw new Error(`Packaged Gateway memoria_export did not create archive: ${JSON.stringify(exportedArchive)}`);
    }
    await fs.access(exportedArchive.path);
    const mergeTarget = parseTextResult(
      await client.callTool("memoria_create", {
        title: "Packaged Gateway duplicate merge",
        body: "Packaged Gateway should expose Memory merge suggestions.",
        labels: ["packaged", "merge"]
      })
    ).memory;
    const mergeSource = parseTextResult(
      await client.callTool("memoria_create", {
        title: "Packaged Gateway duplicate merge",
        body: "Packaged Gateway should expose Memory merge suggestions. Source detail.",
        labels: ["packaged", "merge", "source"]
      })
    ).memory;
    const mergeSuggestions = parseTextResult(await client.callTool("memoria_merge_suggestions", { limit: 10 }));
    const mergeSuggestion = mergeSuggestions.suggestions.find((item) => {
      const ids = [item.target.id, item.source.id];
      return ids.includes(mergeTarget.id) && ids.includes(mergeSource.id);
    });
    if (!mergeSuggestion) {
      throw new Error(`Packaged Gateway memoria_merge_suggestions did not find duplicate pair: ${JSON.stringify(mergeSuggestions)}`);
    }
    const archiveCandidate = parseTextResult(
      await client.callTool("memoria_create", {
        title: "Packaged Gateway archive candidate",
        body: "Packaged Gateway should archive Memory records.",
        labels: ["packaged", "archive"]
      })
    ).memory;
    const archived = parseTextResult(await client.callTool("memoria_archive", { id: archiveCandidate.id })).memory;
    if (archived.status !== "archived") {
      throw new Error(`Packaged Gateway memoria_archive did not archive Memory: ${JSON.stringify(archived)}`);
    }
    const archivedList = parseTextResult(await client.callTool("memoria_archived_list", { limit: 10 }));
    if (!archivedList.results.some((memory) => memory.id === archiveCandidate.id)) {
      throw new Error(`Packaged Gateway memoria_archived_list did not include archived Memory: ${JSON.stringify(archivedList)}`);
    }
    const restoredArchive = parseTextResult(await client.callTool("memoria_restore_archived", { id: archiveCandidate.id })).memory;
    if (restoredArchive.status !== "active") {
      throw new Error(`Packaged Gateway memoria_restore_archived did not restore Memory: ${JSON.stringify(restoredArchive)}`);
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
          version: initialized.result.serverInfo.version,
          controllerDecisionId: observedController.decisionId,
          controllerDefaultOff: true,
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
    runtime.resetCachedDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
