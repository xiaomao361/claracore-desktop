const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { createGatewayClient, parseTextResult } = require("./gateway-client");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase3-gateway-"));
  const client = createGatewayClient(dataRoot, {
    env: {
      CLARACORE_AGENT_ID: ""
    }
  });
  const ambiguityClient = createGatewayClient(dataRoot, { env: { CLARACORE_AGENT_ID: "gateway-ambiguity-agent" } });
  const ownerClient = createGatewayClient(dataRoot, { env: { CLARACORE_AGENT_ID: "owner-agent" } });
  const writerClient = createGatewayClient(dataRoot, { env: { CLARACORE_AGENT_ID: "writer-agent" } });
  try {
    const initialized = await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {}
    });
    if (initialized.result?.serverInfo?.name !== "claracore-desktop") {
      throw new Error("Gateway initialize did not return ClaraCore Desktop server info.");
    }

    // v0.6.6: stdio defaults to the core tool profile. Core carries the normal
    // continuation surface; the maintenance surface stays available under the
    // explicit full profile.
    const tools = await client.request("tools/list");
    const toolNames = new Set((tools.result?.tools || []).map((tool) => tool.name));
    for (const tool of [
      "gateway_docs",
      "shared_line_get",
      "shared_line_list",
      "shared_line_create",
      "shared_line_activate",
      "shared_line_update",
      "shared_line_archive",
      "shared_line_handoff_create"
    ]) {
      if (!toolNames.has(tool)) throw new Error(`Core profile missing tool: ${tool}`);
    }
    for (const tool of ["shared_line_rename", "shared_line_restore"]) {
      if (toolNames.has(tool)) throw new Error(`Core profile should not advertise maintenance tool: ${tool}`);
    }

    const fullProfileClient = createGatewayClient(dataRoot, {
      env: { CLARACORE_AGENT_ID: "", CLARACORE_TOOL_PROFILE: "full" }
    });
    try {
      const fullTools = await fullProfileClient.request("tools/list");
      const fullToolNames = new Set((fullTools.result?.tools || []).map((tool) => tool.name));
      for (const tool of ["shared_line_rename", "shared_line_archive", "shared_line_restore"]) {
        if (!fullToolNames.has(tool)) throw new Error(`Full profile missing tool: ${tool}`);
      }
      if (fullToolNames.size <= toolNames.size) {
        throw new Error("Full profile must expose more tools than core.");
      }
    } finally {
      await fullProfileClient.close();
    }

    // Default docs are a small summary plus a section index; they no longer
    // restate the tools/list manifest.
    const docs = await client.callTool("gateway_docs");
    const docsText = docs.result?.content?.[0]?.text || "";
    if (
      !docsText.includes("Shared Line") ||
      !docsText.includes("shared-line") ||
      !docsText.includes("claracore_connection_test")
    ) {
      throw new Error("Default Gateway docs lost the Shared Line role or the section index.");
    }
    if (Buffer.byteLength(docsText, "utf8") > 4096) {
      throw new Error(`Default Gateway docs are ${Buffer.byteLength(docsText, "utf8")} bytes, over the 4 KB ceiling.`);
    }

    const sharedLineDocs = await client.callTool("gateway_docs", { section: "shared-line" });
    const sharedLineDocsText = sharedLineDocs.result?.content?.[0]?.text || "";
    if (
      !sharedLineDocsText.includes("shared_line_get") ||
      !sharedLineDocsText.includes("shared_line_update") ||
      !sharedLineDocsText.includes("shared_line_archive") ||
      !sharedLineDocsText.includes("shared_line_handoff_create") ||
      !sharedLineDocsText.includes("SHARED_LINE_ID_REQUIRED") ||
      !sharedLineDocsText.includes("shared_line_list with status=active") ||
      !sharedLineDocsText.includes("gateway_context; omitted detail defaults to brief")
    ) {
      throw new Error("Gateway docs shared-line section does not include Shared Line tools.");
    }
    if (docsText.includes(`${path.sep}.claracore${path.sep}continuity`)) {
      throw new Error("Gateway docs point at old Continuity data.");
    }

    // v0.6.6: shared_line_get returns a resume packet by default; the stored
    // packet is still reachable with detail=full.
    const initialResponse = await client.callTool("shared_line_get");
    const initial = parseTextResult(initialResponse);
    if (initial.detail !== "resume") {
      throw new Error(`shared_line_get should default to the resume packet: ${initial.detail}`);
    }
    if (initial.lineId !== "line_default") {
      throw new Error(`Unexpected initial Shared Line id: ${initial.lineId}`);
    }
    if (initial.summary !== "") {
      throw new Error("Fresh Gateway Shared Line should be empty.");
    }
    for (const absent of ["lines", "archivedLines", "agentStates", "agentState", "text", "history", "snapshots"]) {
      if (absent in initial) {
        throw new Error(`Resume packet should not carry ${absent}.`);
      }
    }
    const initialFull = parseTextResult(await client.callTool("shared_line_get", { detail: "full" }));
    if (initialFull.detail !== "full" || initialFull.currentPosition.summary !== "") {
      throw new Error("shared_line_get detail=full did not restore the stored packet.");
    }
    if (initialFull.lines.length || initialFull.archivedLines.length || initialFull.agentStates.length) {
      throw new Error("Gateway shared_line_get should not repeat cross-line catalogs or other agent states.");
    }

    const updatedResponse = await client.callTool("shared_line_update", {
      summary: "Gateway Phase 3 position: agents should resume from this Desktop-owned line.",
      interpretationStatus: "confirmed",
      factsUsed: ["gateway-fact-1", "gateway-fact-2"]
    });
    const updated = parseTextResult(updatedResponse);
    if (updated.summary !== "Gateway Phase 3 position: agents should resume from this Desktop-owned line.") {
      throw new Error("Gateway shared_line_update did not persist summary.");
    }
    if (updated.interpretationStatus !== "confirmed") {
      throw new Error("Gateway shared_line_update did not persist interpretation status.");
    }
    if (!updated.factsUsed.includes("gateway-fact-1")) {
      throw new Error("Gateway shared_line_update did not persist factsUsed.");
    }
    const updatedFull = parseTextResult(await client.callTool("shared_line_get", { detail: "full" }));
    if (!updatedFull.text.includes("Gateway Phase 3 position")) {
      throw new Error("Gateway resume packet did not include saved summary.");
    }
    if (!Array.isArray(updatedFull.history) || updatedFull.history.length !== 1) {
      throw new Error("Gateway shared_line_update did not return Shared Line history.");
    }

    let blockedOverwrite = false;
    try {
      await client.callTool("shared_line_update", {
        summary: "Gateway Phase 3 blocked overwrite should require confirmation.",
        interpretationStatus: "draft",
        factsUsed: ["gateway-fact-2"]
      });
    } catch (error) {
      blockedOverwrite = String(error.message || "").includes("Confirmed Shared Line overwrite requires explicit confirmation");
    }
    if (!blockedOverwrite) {
      throw new Error("Gateway shared_line_update did not block confirmed overwrite.");
    }
    const secondResponse = await client.callTool("shared_line_update", {
      summary: "Gateway Phase 3 second position: agents should see recent history.",
      interpretationStatus: "draft",
      factsUsed: ["gateway-fact-2"],
      confirmOverwrite: true
    });
    const second = parseTextResult(secondResponse);
    // History and snapshots moved behind detail=full; the resume packet reports
    // that they exist so the Agent knows an explicit read is available.
    if (
      second.omitted.snapshots < 1 ||
      second.omitted.handoffs !== 0 ||
      second.omitted.agentState !== "shared_line_agent_state" ||
      second.omitted.detailRef?.arguments?.detail !== "full"
    ) {
      throw new Error(`Resume packet did not report omitted detail truthfully: ${JSON.stringify(second.omitted)}`);
    }
    const secondFull = parseTextResult(await client.callTool("shared_line_get", { detail: "full" }));
    if (secondFull.history.length !== 2) {
      throw new Error(`Gateway Shared Line history should contain two entries, got ${secondFull.history.length}.`);
    }
    if (!secondFull.text.includes("Recent history:") || !secondFull.text.includes("Gateway Phase 3 second position")) {
      throw new Error("Gateway resume packet did not include recent history.");
    }
    if (!Array.isArray(secondFull.snapshots) || secondFull.snapshots[0]?.reason !== "confirmed_overwrite") {
      throw new Error("Gateway shared_line_update did not return confirmed overwrite snapshot.");
    }
    const handoffResponse = await client.callTool("shared_line_handoff_create", {
      objective: "Gateway handoff objective",
      completed: ["Shared Line saved"],
      openItems: ["Agent resume"],
      nextStep: "Agent should continue from this handoff."
    });
    const handoffResult = parseTextResult(handoffResponse);
    if (handoffResult.handoff.objective !== "Gateway handoff objective") {
      throw new Error("Gateway handoff create did not persist objective.");
    }
    if (handoffResult.sharedLine.recentHandoff?.objective !== "Gateway handoff objective") {
      throw new Error("Gateway handoff was not included in Shared Line resume packet.");
    }
    const handoffFull = parseTextResult(await client.callTool("shared_line_get", { detail: "full" }));
    if (!handoffFull.text.includes("Recent handoffs:") || !handoffFull.text.includes("Gateway handoff objective")) {
      throw new Error("Gateway handoff was not included in the full Shared Line packet.");
    }

    const rereadResponse = await client.callTool("shared_line_get");
    const reread = parseTextResult(rereadResponse);
    if (reread.summary !== second.summary) {
      throw new Error("Gateway shared_line_get did not read back the saved position.");
    }
    const rereadFull = parseTextResult(await client.callTool("shared_line_get", { detail: "full" }));
    if (rereadFull.history.length !== 2) {
      throw new Error("Gateway shared_line_get did not read back Shared Line history.");
    }
    if (rereadFull.handoffs.length !== 1) {
      throw new Error("Gateway shared_line_get did not read back Shared Line handoffs.");
    }
    // context adds relevant Shared Reality without restoring Agent-level state.
    const rereadContext = parseTextResult(await client.callTool("shared_line_get", { detail: "context" }));
    if (rereadContext.detail !== "context" || !rereadContext.sharedReality || "agentState" in rereadContext) {
      throw new Error("shared_line_get detail=context did not return the expected shape.");
    }
    const createdLine = parseTextResult(
      await client.callTool("shared_line_create", {
        title: "Gateway Phase 3 parallel line",
        makeActive: true
      })
    );
    if (!createdLine.line?.id || createdLine.sharedLine.lineId !== createdLine.line.id) {
      throw new Error("Gateway shared_line_create did not create and activate a line.");
    }
    const lineUpdate = parseTextResult(
      await client.callTool("shared_line_update", {
        summary: "Gateway Phase 3 parallel line position.",
        interpretationStatus: "draft"
      })
    );
    if (lineUpdate.lineId !== createdLine.line.id) {
      throw new Error("Gateway shared_line_update did not use the active parallel line.");
    }
    const activatedDefault = parseTextResult(await client.callTool("shared_line_activate", { lineId: "line_default" }));
    if (activatedDefault.sharedLine.lineId !== "line_default") {
      throw new Error("Gateway shared_line_activate did not restore default line.");
    }
    const listed = parseTextResult(await client.callTool("shared_line_list"));
    if (!listed.lines.some((line) => line.id === createdLine.line.id && line.summary.includes("parallel line position"))) {
      throw new Error("Gateway shared_line_list did not include the parallel line.");
    }
    if (listed.lines.some((line) => "positionHistory" in line || "affectiveTrace" in line || "metadata" in line)) {
      throw new Error(`Gateway shared_line_list leaked rich line content: ${JSON.stringify(listed.lines)}`);
    }
    if (!listed.lines.every((line) => line.detailRef?.tool === "shared_line_get")) {
      throw new Error(`Gateway shared_line_list omitted explicit detail references: ${JSON.stringify(listed.lines)}`);
    }
    const renamed = parseTextResult(
      await client.callTool("shared_line_rename", {
        lineId: createdLine.line.id,
        title: "Gateway Phase 3 renamed line"
      })
    );
    if (renamed.line.title !== "Gateway Phase 3 renamed line") {
      throw new Error("Gateway shared_line_rename did not persist title.");
    }
    const archived = parseTextResult(await client.callTool("shared_line_archive", { lineId: createdLine.line.id }));
    if (archived.line.status !== "archived" || archived.sharedLine.lineId !== "line_default") {
      throw new Error("Gateway shared_line_archive did not archive and return to default.");
    }
    const restored = parseTextResult(
      await client.callTool("shared_line_restore", {
        lineId: createdLine.line.id,
        makeActive: true
      })
    );
    if (restored.line.status !== "active" || restored.sharedLine.lineId !== createdLine.line.id) {
      throw new Error("Gateway shared_line_restore did not restore and activate the line.");
    }

    const ambiguousLineA = parseTextResult(
      await ambiguityClient.callTool("shared_line_create", {
        title: "Gateway ambiguity line A",
        makeActive: false
      })
    ).line;
    const ambiguousLineB = parseTextResult(
      await ambiguityClient.callTool("shared_line_create", {
        title: "Gateway ambiguity line B",
        makeActive: false
      })
    ).line;
    await ambiguityClient.callTool("shared_line_update", {
      lineId: ambiguousLineA.id,
      summary: "Ambiguous context candidate A."
    });
    await ambiguityClient.callTool("shared_line_update", {
      lineId: ambiguousLineB.id,
      summary: "Ambiguous context candidate B."
    });
    let ambiguityContextMessage = "";
    try {
      await ambiguityClient.callTool("gateway_context");
    } catch (error) {
      ambiguityContextMessage = String(error.message || "");
    }
    for (const expected of [
      "SHARED_LINE_ID_REQUIRED",
      ambiguousLineA.id,
      ambiguousLineA.title,
      "Ambiguous context candidate A.",
      ambiguousLineB.id,
      ambiguousLineB.title,
      "Ambiguous context candidate B."
    ]) {
      if (!ambiguityContextMessage.includes(expected)) {
        throw new Error(`Gateway context ambiguity did not return actionable candidates: ${ambiguityContextMessage}`);
      }
    }
    const explicitGatewayContext = parseTextResult(
      await ambiguityClient.callTool("gateway_context", { lineId: ambiguousLineB.id })
    );
    if (
      explicitGatewayContext.sharedLine?.lineId !== ambiguousLineB.id ||
      explicitGatewayContext.sharedLine?.summary !== "Ambiguous context candidate B."
    ) {
      throw new Error(`Gateway context explicit retry selected the wrong line: ${JSON.stringify(explicitGatewayContext.sharedLine)}`);
    }
    if (explicitGatewayContext.detail !== "brief") {
      throw new Error(`Gateway context without detail must default to brief: ${JSON.stringify(explicitGatewayContext)}`);
    }
    let ambiguityMessage = "";
    try {
      await ambiguityClient.callTool("shared_line_update", {
        summary: "Gateway ambiguous write must be rejected."
      });
    } catch (error) {
      ambiguityMessage = String(error.message || "");
    }
    if (
      !ambiguityMessage.includes("SHARED_LINE_ID_REQUIRED") ||
      !ambiguityMessage.includes(ambiguousLineA.id) ||
      !ambiguityMessage.includes(ambiguousLineB.id)
    ) {
      throw new Error(`Gateway ambiguity error did not include actionable candidates: ${ambiguityMessage}`);
    }
    const ambiguousLinesAfterBlockedWrite = parseTextResult(
      await ambiguityClient.callTool("shared_line_list", {
        status: "active"
      })
    ).lines;
    if (ambiguousLinesAfterBlockedWrite.some((line) => line.summary === "Gateway ambiguous write must be rejected.")) {
      throw new Error("Gateway ambiguous write changed a candidate line.");
    }
    const explicitGatewayWrite = parseTextResult(
      await ambiguityClient.callTool("shared_line_update", {
        lineId: ambiguousLineB.id,
        summary: "Gateway explicit selection reached line B."
      })
    );
    if (explicitGatewayWrite.lineId !== ambiguousLineB.id) {
      throw new Error("Gateway explicit Shared Line write did not use the requested lineId.");
    }

    const ownedLine = parseTextResult(
      await ownerClient.callTool("shared_line_create", {
        title: "Owner must survive a cross-agent write",
        makeActive: false
      })
    ).line;
    const crossAgentWrite = parseTextResult(
      await writerClient.callTool("shared_line_update", {
        lineId: ownedLine.id,
        summary: "An explicit collaborator updated this line without taking ownership."
      })
    );
    // Line ownership stays visible in the resume packet. Writer provenance is
    // per-write position metadata, so it is recovered through detail=full.
    if (crossAgentWrite.agentId !== "owner-agent") {
      throw new Error(`Cross-agent write changed Shared Line owner: ${JSON.stringify(crossAgentWrite)}`);
    }
    const crossAgentFull = parseTextResult(
      await writerClient.callTool("shared_line_get", { lineId: ownedLine.id, detail: "full" })
    );
    if (crossAgentFull.currentPosition.agentId !== "owner-agent") {
      throw new Error(`Cross-agent write changed Shared Line owner: ${JSON.stringify(crossAgentFull.currentPosition)}`);
    }
    if (crossAgentFull.currentPosition.metadata?.writerAgentId !== "writer-agent") {
      throw new Error(`Cross-agent write did not preserve writer provenance: ${JSON.stringify(crossAgentFull.currentPosition.metadata)}`);
    }

    const statusResponse = await client.callTool("claracore_status");
    const status = parseTextResult(statusResponse);
    if (!status.dataRoot.startsWith(dataRoot)) {
      throw new Error(`Gateway status escaped product data root: ${status.dataRoot}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dataRoot,
          lineId: second.lineId,
          positionId: secondFull.currentPosition.positionId,
          historyCount: secondFull.history.length,
          handoffId: handoffResult.handoff.id,
          tools: [...toolNames].filter((name) => name.startsWith("shared_line_"))
        },
        null,
        2
      )
    );
  } finally {
    await Promise.all([client.close(), ambiguityClient.close(), ownerClient.close(), writerClient.close()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
