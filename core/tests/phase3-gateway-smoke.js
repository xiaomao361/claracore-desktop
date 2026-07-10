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
      "shared_line_get",
      "shared_line_list",
      "shared_line_create",
      "shared_line_activate",
      "shared_line_rename",
      "shared_line_archive",
      "shared_line_restore",
      "shared_line_update",
      "shared_line_handoff_create"
    ]) {
      if (!toolNames.has(tool)) throw new Error(`Gateway missing tool: ${tool}`);
    }

    const docs = await client.callTool("gateway_docs");
    const docsText = docs.result?.content?.[0]?.text || "";
    if (
      !docsText.includes("shared_line_get") ||
      !docsText.includes("shared_line_update") ||
      !docsText.includes("shared_line_handoff_create") ||
      !docsText.includes("shared_line_create") ||
      !docsText.includes("shared_line_archive") ||
      !docsText.includes("SHARED_LINE_ID_REQUIRED") ||
      !docsText.includes("shared_line_list with status=active")
    ) {
      throw new Error("Gateway docs do not include Shared Line tools.");
    }
    if (docsText.includes(`${path.sep}.claracore${path.sep}continuity`)) {
      throw new Error("Gateway docs point at old Continuity data.");
    }

    const initialResponse = await client.callTool("shared_line_get");
    const initial = parseTextResult(initialResponse);
    if (initial.lineId !== "line_default") {
      throw new Error(`Unexpected initial Shared Line id: ${initial.lineId}`);
    }
    if (initial.currentPosition.summary !== "") {
      throw new Error("Fresh Gateway Shared Line should be empty.");
    }

    const updatedResponse = await client.callTool("shared_line_update", {
      summary: "Gateway Phase 3 position: agents should resume from this Desktop-owned line.",
      interpretationStatus: "confirmed",
      factsUsed: ["gateway-fact-1", "gateway-fact-2"]
    });
    const updated = parseTextResult(updatedResponse);
    if (updated.currentPosition.summary !== "Gateway Phase 3 position: agents should resume from this Desktop-owned line.") {
      throw new Error("Gateway shared_line_update did not persist summary.");
    }
    if (updated.currentPosition.interpretationStatus !== "confirmed") {
      throw new Error("Gateway shared_line_update did not persist interpretation status.");
    }
    if (!updated.currentPosition.factsUsed.includes("gateway-fact-1")) {
      throw new Error("Gateway shared_line_update did not persist factsUsed.");
    }
    if (!updated.text.includes("Gateway Phase 3 position")) {
      throw new Error("Gateway resume packet did not include saved summary.");
    }
    if (!Array.isArray(updated.history) || updated.history.length !== 1) {
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
    if (second.history.length !== 2) {
      throw new Error(`Gateway Shared Line history should contain two entries, got ${second.history.length}.`);
    }
    if (!second.text.includes("Recent history:") || !second.text.includes("Gateway Phase 3 second position")) {
      throw new Error("Gateway resume packet did not include recent history.");
    }
    if (!Array.isArray(second.snapshots) || second.snapshots[0]?.reason !== "confirmed_overwrite") {
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
    if (!handoffResult.sharedLine.text.includes("Recent handoffs:") || !handoffResult.sharedLine.text.includes("Gateway handoff objective")) {
      throw new Error("Gateway handoff was not included in Shared Line resume packet.");
    }

    const rereadResponse = await client.callTool("shared_line_get");
    const reread = parseTextResult(rereadResponse);
    if (reread.currentPosition.summary !== second.currentPosition.summary) {
      throw new Error("Gateway shared_line_get did not read back the saved position.");
    }
    if (reread.history.length !== 2) {
      throw new Error("Gateway shared_line_get did not read back Shared Line history.");
    }
    if (reread.handoffs.length !== 1) {
      throw new Error("Gateway shared_line_get did not read back Shared Line handoffs.");
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
      await client.callTool("shared_line_create", {
        agentId: "gateway-ambiguity-agent",
        title: "Gateway ambiguity line A",
        makeActive: false
      })
    ).line;
    const ambiguousLineB = parseTextResult(
      await client.callTool("shared_line_create", {
        agentId: "gateway-ambiguity-agent",
        title: "Gateway ambiguity line B",
        makeActive: false
      })
    ).line;
    let ambiguityMessage = "";
    try {
      await client.callTool("shared_line_update", {
        agentId: "gateway-ambiguity-agent",
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
      await client.callTool("shared_line_list", {
        agentId: "gateway-ambiguity-agent",
        status: "active"
      })
    ).lines;
    if (ambiguousLinesAfterBlockedWrite.some((line) => line.summary === "Gateway ambiguous write must be rejected.")) {
      throw new Error("Gateway ambiguous write changed a candidate line.");
    }
    const explicitGatewayWrite = parseTextResult(
      await client.callTool("shared_line_update", {
        agentId: "gateway-ambiguity-agent",
        lineId: ambiguousLineB.id,
        summary: "Gateway explicit selection reached line B."
      })
    );
    if (explicitGatewayWrite.currentPosition.lineId !== ambiguousLineB.id) {
      throw new Error("Gateway explicit Shared Line write did not use the requested lineId.");
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
          positionId: second.currentPosition.positionId,
          historyCount: second.history.length,
          handoffId: handoffResult.handoff.id,
          tools: [...toolNames].filter((name) => name.startsWith("shared_line_"))
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
