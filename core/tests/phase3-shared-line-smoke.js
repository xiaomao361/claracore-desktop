const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const runtime = require("../runtime");

async function main() {
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claracore-phase3-shared-line-"));
  process.env.CLARACORE_DESKTOP_DATA_DIR = dataRoot;
  const app = {
    getPath(name) {
      return path.join(dataRoot, name);
    },
    isPackaged: false
  };

  const initial = await runtime.getProductSharedLine(app);
  if (initial.lineId !== "line_default") {
    throw new Error(`Unexpected default Shared Line id: ${initial.lineId}`);
  }
  if (initial.currentPosition.summary !== "") {
    throw new Error("Fresh Shared Line should start with an empty current position.");
  }
  if (!initial.text.includes("Current position: (empty)")) {
    throw new Error("Fresh resume packet should show an empty current position.");
  }

  const memory = await runtime.createProductMemory(app, {
    title: "Shared Line linked fact",
    body: "This Memory id should be accepted as a Shared Line fact reference.",
    labels: "shared-line, phase3"
  });
  const saved = await runtime.saveProductSharedLine(app, {
    summary: "Phase 3 position: Memory and Shared Line are now connected enough for agent resume.",
    interpretationStatus: "confirmed",
    factsUsed: [memory.id, "  ", "manual-note"]
  });
  if (saved.currentPosition.summary !== "Phase 3 position: Memory and Shared Line are now connected enough for agent resume.") {
    throw new Error("Shared Line summary did not save correctly.");
  }
  if (saved.currentPosition.interpretationStatus !== "confirmed") {
    throw new Error("Shared Line interpretation status did not save correctly.");
  }
  if (!saved.currentPosition.factsUsed.includes(memory.id) || !saved.currentPosition.factsUsed.includes("manual-note")) {
    throw new Error(`Shared Line factsUsed did not save correctly: ${saved.currentPosition.factsUsed}`);
  }
  if (saved.currentPosition.factsUsed.includes("")) {
    throw new Error("Shared Line factsUsed should trim blank references.");
  }
  if (!saved.text.includes("Interpretation status: confirmed")) {
    throw new Error("Resume packet did not include the saved interpretation status.");
  }
  if (!saved.text.includes("Phase 3 position")) {
    throw new Error("Resume packet did not include the saved current position.");
  }
  if (!Array.isArray(saved.history) || saved.history.length !== 1) {
    throw new Error("Shared Line history did not include the saved position.");
  }
  if (saved.history[0].summary !== saved.currentPosition.summary) {
    throw new Error("Shared Line history summary mismatch.");
  }
  let blockedOverwrite = false;
  try {
    await runtime.saveProductSharedLine(app, {
      summary: "Phase 3 blocked overwrite: confirmed state should require confirmation.",
      interpretationStatus: "draft",
      factsUsed: [memory.id]
    });
  } catch (error) {
    blockedOverwrite = String(error.message || "").includes("Confirmed Shared Line overwrite requires explicit confirmation");
  }
  if (!blockedOverwrite) {
    throw new Error("Shared Line confirmed overwrite was not blocked without explicit confirmation.");
  }
  const second = await runtime.saveProductSharedLine(app, {
    summary: "Phase 3 second position: history should keep the previous checkpoint visible.",
    interpretationStatus: "draft",
    factsUsed: [memory.id],
    confirmOverwrite: true
  });
  if (second.history.length !== 2) {
    throw new Error(`Shared Line history should contain two entries, got ${second.history.length}.`);
  }
  if (!second.text.includes("Recent history:") || !second.text.includes("Phase 3 second position")) {
    throw new Error("Resume packet did not include recent Shared Line history.");
  }
  if (!Array.isArray(second.snapshots) || second.snapshots.length !== 2) {
    throw new Error(`Shared Line snapshots should contain two entries, got ${second.snapshots?.length}.`);
  }
  if (second.snapshots[0].reason !== "confirmed_overwrite") {
    throw new Error(`Confirmed overwrite snapshot reason mismatch: ${second.snapshots[0].reason}`);
  }
  const { database } = await runtime.ensureProductCore(app);
  const handoff = await database.createContinuityHandoff({
    objective: "Phase 3 handoff objective",
    completed: ["history exists"],
    openItems: ["handoff review"],
    nextStep: "Agent should resume from the handoff."
  });
  if (handoff.objective !== "Phase 3 handoff objective") {
    throw new Error("Shared Line handoff did not save objective.");
  }
  const withHandoff = await database.getResumePacket();
  if (withHandoff.handoffs.length !== 1) {
    throw new Error("Shared Line resume packet did not include handoff records.");
  }
  if (!withHandoff.text.includes("Recent handoffs:") || !withHandoff.text.includes("Phase 3 handoff objective")) {
    throw new Error("Shared Line resume text did not include handoff details.");
  }

  const snapshot = await runtime.buildProductSnapshot(app);
  if (snapshot.sharedLine.currentPosition.summary !== second.currentPosition.summary) {
    throw new Error("Runtime snapshot did not read the saved Shared Line position.");
  }
  if (!snapshot.data.databasePath.startsWith(dataRoot)) {
    throw new Error(`Shared Line database escaped product data root: ${snapshot.data.databasePath}`);
  }
  const oldServices = snapshot.health.checks.find((check) => check.id === "old-services");
  if (oldServices?.detail !== "not controlled by Desktop") {
    throw new Error("Old services are not explicitly isolated in the runtime health check.");
  }
  if (!snapshot.memoryGraph.nodes.some((node) => node.kind === "shared_line" && node.refId === "line_default")) {
    throw new Error(`Memory graph did not include Shared Line node: ${JSON.stringify(snapshot.memoryGraph)}`);
  }
  if (!snapshot.memoryGraph.edges.some((edge) => edge.from === "line:line_default" && edge.to === `memory:${memory.id}` && edge.kind === "uses")) {
    throw new Error(`Memory graph did not include Shared Line fact edge: ${JSON.stringify(snapshot.memoryGraph.edges)}`);
  }

  const positionRows = await database.query(`
    SELECT summary, interpretation_status, facts_used_json
    FROM current_positions
    WHERE line_id = 'line_default';
  `);
  if (positionRows.length !== 1) {
    throw new Error("Shared Line current position was not written to SQLite.");
  }
  const factsUsed = JSON.parse(positionRows[0].facts_used_json);
  if (!factsUsed.includes(memory.id)) {
    throw new Error("Shared Line fact reference was not stored in SQLite.");
  }
  const historyRows = await database.query(`
    SELECT summary, interpretation_status, facts_used_json
    FROM continuity_position_history
    ORDER BY created_at ASC, id ASC;
  `);
  if (historyRows.length !== 2) {
    throw new Error(`Shared Line history was not written to SQLite: ${historyRows.length}`);
  }
  if (!historyRows[0].summary.includes("Phase 3 position") || !historyRows[1].summary.includes("Phase 3 second position")) {
    throw new Error("Shared Line history rows are not in the expected order.");
  }
  const snapshotRows = await database.query(`
    SELECT summary, reason
    FROM continuity_snapshots
    ORDER BY created_at ASC, id ASC;
  `);
  if (snapshotRows.length !== 2) {
    throw new Error(`Shared Line snapshots were not written to SQLite: ${snapshotRows.length}`);
  }
  if (snapshotRows[1].reason !== "confirmed_overwrite") {
    throw new Error(`Shared Line confirmed overwrite snapshot was not recorded: ${JSON.stringify(snapshotRows)}`);
  }
  const secondLine = await database.createContinuityLine({
    title: "Phase 3 parallel line",
    makeActive: true
  });
  if (!secondLine?.id || !secondLine.active) {
    throw new Error("Shared Line create did not create and activate a second line.");
  }
  const parallel = await runtime.saveProductSharedLine(app, {
    summary: "Phase 3 parallel line position: separate thread.",
    interpretationStatus: "draft"
  });
  if (parallel.lineId !== secondLine.id || !parallel.currentPosition.summary.includes("parallel line position")) {
    throw new Error("Shared Line save did not use the active second line.");
  }
  const restoredDefault = await database.setActiveContinuityLine("line_default");
  if (!restoredDefault.active) {
    throw new Error("Shared Line activate did not switch back to default line.");
  }
  const defaultPacket = await runtime.getProductSharedLine(app);
  if (defaultPacket.lineId !== "line_default" || !defaultPacket.currentPosition.summary.includes("Phase 3 second position")) {
    throw new Error("Shared Line default line did not retain its own current position.");
  }
  if (!defaultPacket.lines.some((line) => line.id === secondLine.id && line.summary.includes("parallel line position"))) {
    throw new Error("Shared Line line list did not include the parallel line summary.");
  }
  const renamedLine = await database.renameContinuityLine(secondLine.id, "Phase 3 renamed parallel line");
  if (renamedLine.title !== "Phase 3 renamed parallel line") {
    throw new Error("Shared Line rename did not persist title.");
  }
  const archivedLine = await database.archiveContinuityLine(secondLine.id);
  if (archivedLine.status !== "archived") {
    throw new Error("Shared Line archive did not mark the line archived.");
  }
  let archivedActivationBlocked = false;
  try {
    await database.setActiveContinuityLine(secondLine.id);
  } catch (error) {
    archivedActivationBlocked = String(error.message || "").includes("Shared Line not found");
  }
  if (!archivedActivationBlocked) {
    throw new Error("Archived Shared Line should not be activatable.");
  }
  const restoredLine = await database.restoreContinuityLine(secondLine.id, true);
  if (!restoredLine.active || restoredLine.status !== "active") {
    throw new Error("Shared Line restore did not reactivate the archived line.");
  }
  const restoredPacket = await runtime.getProductSharedLine(app);
  if (restoredPacket.lineId !== secondLine.id || !restoredPacket.currentPosition.summary.includes("parallel line position")) {
    throw new Error("Restored Shared Line did not return its own current position.");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dataRoot,
        databasePath: snapshot.data.databasePath,
        lineId: second.lineId,
        positionId: second.currentPosition.positionId,
        historyCount: historyRows.length,
        handoffId: handoff.id,
        factsUsed
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
