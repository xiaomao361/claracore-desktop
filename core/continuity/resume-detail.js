// v0.6.6 Shared Line detail levels.
//
// The stored resume packet stays complete. These shapes decide how much of it a
// default Agent read delivers:
//
//   resume  (default) the smallest packet needed to continue work
//   context           resume plus non-empty relevant Shared Reality
//   full              the stored packet, unchanged
//
// Agent-level state is deliberately absent from resume and context. It is
// Agent-scoped, not line-scoped, so repeating it in every line read duplicates
// the same bytes across unrelated lines. It stays available through
// shared_line_agent_state and should be loaded once per Agent session.

const DETAIL_LEVELS = Object.freeze(["resume", "context", "full"]);

const RESUME_SUMMARY_BYTES = 1600;
const RESUME_TITLE_BYTES = 200;
const RESUME_FACT_BYTES = 160;
const RESUME_FACT_LIMIT = 8;
const RESUME_HANDOFF_BYTES = 400;
const RESUME_NEXT_STEP_BYTES = 500;
const CONTEXT_REALITY_BYTES = 480;

function normalizeSharedLineDetail(value) {
  const detail = String(value || "resume").trim().toLowerCase() || "resume";
  if (!DETAIL_LEVELS.includes(detail)) {
    throw new Error(`shared_line detail must be one of: ${DETAIL_LEVELS.join(", ")}.`);
  }
  return detail;
}

function boundedText(value, maxBytes) {
  const text = String(value || "");
  if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
  const characters = Array.from(text);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(characters.slice(0, middle).join(""), "utf8") <= maxBytes) low = middle;
    else high = middle - 1;
  }
  return characters.slice(0, low).join("");
}

function resumeHandoff(handoffs, maxBytes = RESUME_HANDOFF_BYTES) {
  const handoff = (handoffs || [])[0];
  if (!handoff) return null;
  return {
    id: handoff.id,
    objective: boundedText(handoff.objective, maxBytes),
    nextStep: boundedText(handoff.nextStep, maxBytes),
    createdAt: handoff.createdAt || null
  };
}

function relevantSharedReality(sharedReality) {
  return Object.fromEntries(
    Object.entries(sharedReality || {})
      .filter(([, value]) => (typeof value === "boolean" ? value : String(value || "").trim().length > 0))
      .map(([key, value]) => [key, typeof value === "boolean" ? value : boundedText(value, CONTEXT_REALITY_BYTES)])
  );
}

function shapeSharedLinePacket(packet, detailInput, options = {}) {
  const detail = normalizeSharedLineDetail(detailInput);
  if (detail === "full") return { detail, ...packet };

  // Callers that embed a resume packet inside a larger aggregate may tighten
  // the bounds; the per-domain read stays reachable through detailRef.
  const bounds = {
    summary: RESUME_SUMMARY_BYTES,
    title: RESUME_TITLE_BYTES,
    fact: RESUME_FACT_BYTES,
    factLimit: RESUME_FACT_LIMIT,
    handoff: RESUME_HANDOFF_BYTES,
    nextStep: RESUME_NEXT_STEP_BYTES,
    ...(options.bounds || {})
  };
  const current = packet?.currentPosition || {};
  const handoff = resumeHandoff(packet?.handoffs, bounds.handoff);
  const arcMeta = packet?.arcMeta || {};

  const shaped = {
    detail,
    lineId: packet?.lineId || current.lineId || "",
    agentId: packet?.agentId || current.agentId || "",
    lineTitle: boundedText(packet?.lineTitle || current.lineTitle || "", bounds.title),
    summary: boundedText(current.summary, bounds.summary),
    interpretationStatus: current.interpretationStatus || "",
    factsUsed: (current.factsUsed || []).slice(0, bounds.factLimit).map((fact) => boundedText(fact, bounds.fact)),
    nextStep: boundedText(packet?.nextStep, bounds.nextStep),
    updatedAt: current.updatedAt || null,
    ...(handoff ? { recentHandoff: handoff } : {}),
    // Counts, not contents: the Agent learns that an arc exists and how to read
    // it, without paying for it on every resume.
    omitted: {
      agentState: "shared_line_agent_state",
      positionHistory: Number(arcMeta.positionHistoryTotal || 0),
      affectiveTrace: Number(arcMeta.affectiveTraceTotal || 0),
      snapshots: (packet?.snapshots || []).length,
      handoffs: (packet?.handoffs || []).length,
      detailRef: {
        tool: "shared_line_get",
        arguments: { ...(packet?.lineId ? { lineId: packet.lineId } : {}), detail: "full" }
      }
    }
  };

  if (detail === "context") {
    shaped.sharedReality = relevantSharedReality(packet?.sharedReality);
  }

  // A model adjustment is only relevant when a model was explicitly requested.
  if (options.model && packet?.modelAdjustment) {
    shaped.modelAdjustment = packet.modelAdjustment;
  }

  return shaped;
}

module.exports = {
  CONTEXT_REALITY_BYTES,
  DETAIL_LEVELS,
  RESUME_NEXT_STEP_BYTES,
  RESUME_SUMMARY_BYTES,
  normalizeSharedLineDetail,
  relevantSharedReality,
  shapeSharedLinePacket
};
