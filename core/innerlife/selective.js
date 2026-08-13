// v0.6.6 InnerLife selective contracts.
//
// Status, candidates, and briefing are three different questions and stop
// answering all three at once:
//
//   status    is InnerLife healthy and is there work waiting?
//   candidates which shares could be surfaced, as bounded previews?
//   briefing   what does this session need to decide right now?
//
// The stored read models are unchanged. Reading a candidate never marks
// delivery, and none of these shapes create profiles, sessions, or content.

const STATUS_SUMMARY_BYTES = 600;
const STATUS_ISSUE_BYTES = 300;
const STATUS_ISSUE_LIMIT = 3;

const SHARE_PREVIEW_BYTES = 320;
const SHARE_CANDIDATE_LIMIT = 3;
const SHARE_CHECK_REASON_BYTES = 600;
const SHARE_CHECK_EVIDENCE_LIMIT = 5;

const BRIEFING_SUMMARY_BYTES = 800;
const BRIEFING_LOOP_BYTES = 260;
const BRIEFING_LOOP_LIMIT = 3;
const BRIEFING_MEMORY_BYTES = 320;
const BRIEFING_MEMORY_LIMIT = 2;

const DETAIL_LEVELS = Object.freeze(["summary", "full"]);

function normalizeInnerLifeDetail(value) {
  if (value === true) return "full";
  const detail = String(value || "summary").trim().toLowerCase() || "summary";
  if (!DETAIL_LEVELS.includes(detail)) {
    throw new Error(`InnerLife detail must be one of: ${DETAIL_LEVELS.join(", ")}.`);
  }
  return detail;
}

function bounded(value, maxBytes) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
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

// innerlife_status becomes operational state only: counts, daemon, doctor, and
// indicators that work is waiting. It stops shipping a 20-item share catalog
// and five Inbox bodies to answer "is this healthy".
function shapeInnerLifeStatus(snapshot, detailInput) {
  const detail = normalizeInnerLifeDetail(detailInput);
  // `mode` is stated by the shape, not inherited from whichever read model was
  // used. Before 0.6.6 the default read reported mode="lite"; it now reports
  // mode="status" and the full read reports mode="full". Clients that branched
  // on "lite" must move to `detail`.
  if (detail === "full") {
    const profiles = (snapshot?.profiles || []).map((profile) => {
      const { enabled: _enabled, ...rest } = profile;
      return { ...rest, profileEnabled: Boolean(profile.enabled) };
    });
    const { enabled: _daemonEnabled, ...daemonRest } = snapshot?.daemon || {};
    return {
      ...snapshot,
      profiles,
      daemon: { ...daemonRest, loopEnabled: Boolean(snapshot?.daemon?.enabled) },
      detail,
      mode: "full"
    };
  }

  const counts = snapshot?.counts || {};
  const daemon = snapshot?.daemon || {};
  const doctor = snapshot?.doctor || { status: "ok", summary: "", issues: [] };
  const pendingShares = snapshot?.pendingShares || [];
  const pendingInbox = snapshot?.pendingInbox || [];

  return {
    detail,
    mode: "status",
    profiles: (snapshot?.profiles || []).map((profile) => ({
      agentId: profile.agentId,
      profileEnabled: Boolean(profile.enabled)
    })),
    counts,
    daemon: {
      agentId: daemon.agentId || "",
      status: daemon.status || "paused",
      loopEnabled: Boolean(daemon.enabled),
      lastTickAt: daemon.lastTickAt || null,
      nextRunAt: daemon.nextRunAt || null,
      lastError: bounded(daemon.lastError, STATUS_ISSUE_BYTES),
      tickCount: Number(daemon.tickCount || 0)
    },
    doctor: {
      status: doctor.status || "ok",
      summary: bounded(doctor.summary, STATUS_SUMMARY_BYTES),
      issues: (doctor.issues || []).slice(0, STATUS_ISSUE_LIMIT).map((issue) => ({
        level: issue?.level || "",
        code: issue?.code || "",
        message: bounded(issue?.message, STATUS_ISSUE_BYTES)
      })),
      issueCount: (doctor.issues || []).length
    },
    // Indicators, not contents.
    work: {
      hasPendingShares: pendingShares.length > 0,
      pendingShareCount: Number(counts.pending_shares_count ?? pendingShares.length),
      hasPendingInbox: pendingInbox.length > 0,
      pendingInboxCount: Number(counts.pending_inbox_count ?? pendingInbox.length)
    },
    detailRefs: {
      shares: { tool: "innerlife_pending_shares", arguments: {} },
      inbox: { tool: "innerlife_status", arguments: { detail: true } },
      full: { tool: "innerlife_status", arguments: { detail: true } }
    }
  };
}

// Candidates are previews. A full share body is earned by explicit inspection
// or by passing innerlife_share_check, never by listing.
function shapePendingShares(shares, detailInput, requestedLimit, totalInput) {
  const detail = normalizeInnerLifeDetail(detailInput);
  const all = Array.isArray(shares) ? shares : [];
  const totalPending = Number.isFinite(Number(totalInput)) ? Number(totalInput) : all.length;
  if (detail === "full") return { detail, shares: all, totalPending };

  const parsedLimit = Number.parseInt(String(requestedLimit ?? SHARE_CANDIDATE_LIMIT), 10);
  const limit = Math.max(1, Math.min(Number.isFinite(parsedLimit) ? parsedLimit : SHARE_CANDIDATE_LIMIT, 10));
  const candidates = all.slice(0, limit).map((share) => ({
    id: share.id,
    agentId: share.agent_id || share.agentId || "",
    status: share.status,
    preview: bounded(share.preview || share.body, SHARE_PREVIEW_BYTES),
    createdAt: share.created_at || share.createdAt || null
  }));
  return {
    detail,
    shares: candidates,
    returned: candidates.length,
    totalPending,
    note: "Previews only. Reading candidates does not mark delivery.",
    detailRef: { tool: "innerlife_share_check", arguments: {} }
  };
}

// A timing check explicitly earns one share body, not a second candidate
// catalog. Keep the reasoning and enough operational status to judge it, while
// dropping the repeated 20-item lite snapshot returned by the domain service.
function shapeShareCheckResult(result = {}) {
  const check = result.check || {};
  const metadata = check.metadata || {};
  const snapshotStatus = shapeInnerLifeStatus(result.snapshot || {});
  const candidateLineIds = (metadata.candidateLineIds || []).slice(0, SHARE_CHECK_EVIDENCE_LIMIT);
  return {
    check: {
      id: check.id || "",
      shareId: check.shareId || "",
      agentId: check.agentId || "",
      sessionId: check.sessionId || null,
      decision: check.decision || "defer",
      reason: bounded(check.reason, SHARE_CHECK_REASON_BYTES),
      createdAt: check.createdAt || null,
      contextEvaluated: Boolean(check.context),
      metadata: {
        contextSource: metadata.contextSource || "none",
        sharedLineStatus: metadata.sharedLineStatus || "",
        lineId: metadata.lineId || "",
        positionId: metadata.positionId || "",
        hasAsk: Boolean(metadata.hasAsk),
        overlap: (metadata.overlap || []).slice(0, SHARE_CHECK_EVIDENCE_LIMIT),
        explicitOverlap: (metadata.explicitOverlap || []).slice(0, SHARE_CHECK_EVIDENCE_LIMIT),
        lineOverlap: (metadata.lineOverlap || []).slice(0, SHARE_CHECK_EVIDENCE_LIMIT),
        candidateLineIds,
        candidateLineCount: (metadata.candidateLineIds || []).length
      }
    },
    share: result.share || null,
    status: {
      counts: snapshotStatus.counts || {},
      doctor: snapshotStatus.doctor || {},
      work: snapshotStatus.work || {},
      detailRef: snapshotStatus.detailRefs?.full || { tool: "innerlife_status", arguments: { detail: true } }
    }
  };
}

function normalizedBody(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

// A briefing answers one question: what does this session need to decide now.
// It is not an aggregate dump, and the same body never appears twice.
function shapeInnerLifeBriefing(briefing, detailInput) {
  const detail = normalizeInnerLifeDetail(detailInput);
  if (detail === "full") return { detail, ...briefing };

  const sharedLineContext = briefing?.sharedLineContext || {};
  const unambiguous = sharedLineContext.status !== "ambiguous" && Boolean(briefing?.sharedLine?.lineId);
  const pendingShares = briefing?.pendingShares || [];
  const pendingInbox = briefing?.pendingInbox || [];
  const recentMemories = briefing?.recentMemories || [];
  const recentThoughts = briefing?.recentThoughts || [];

  // Shares win over thoughts: a share is the deliverable form of a thought, so
  // an identical thought body is the same material twice.
  const shareBodies = new Set(pendingShares.map((share) => normalizedBody(share.body || share.preview)));
  const openLoops = recentThoughts
    .filter((thought) => !shareBodies.has(normalizedBody(thought.body)))
    .slice(0, BRIEFING_LOOP_LIMIT)
    .map((thought) => ({ preview: bounded(thought.body, BRIEFING_LOOP_BYTES), createdAt: thought.createdAt || null }));

  const selectedShare = pendingShares[0]
    ? {
        id: pendingShares[0].id,
        preview: bounded(pendingShares[0].preview || pendingShares[0].body, SHARE_PREVIEW_BYTES)
      }
    : null;

  return {
    detail,
    agentId: briefing?.agentId || "",
    generatedAt: briefing?.generatedAt || null,
    sharedLineContext: {
      status: sharedLineContext.status || "",
      ...(sharedLineContext.errorCode ? { errorCode: sharedLineContext.errorCode } : {}),
      candidateCount: (sharedLineContext.candidateLineIds || []).length
    },
    ...(unambiguous
      ? {
          sharedLine: {
            lineId: briefing.sharedLine.lineId,
            summary: bounded(briefing.sharedLine.summary, BRIEFING_SUMMARY_BYTES),
            interpretationStatus: briefing.sharedLine.interpretationStatus || "",
            updatedAt: briefing.sharedLine.updatedAt || null
          }
        }
      : {}),
    openLoops,
    recentMemories: recentMemories.slice(0, BRIEFING_MEMORY_LIMIT).map((memory) => ({
      id: memory.id,
      title: bounded(memory.title, 200),
      preview: bounded(memory.body, BRIEFING_MEMORY_BYTES)
    })),
    counts: {
      pendingShares: pendingShares.length,
      pendingInbox: pendingInbox.length,
      recentMemories: recentMemories.length,
      recentThoughts: recentThoughts.length,
      recentHandoffs: (briefing?.recentHandoffs || []).length
    },
    ...(selectedShare ? { selectedShare } : {}),
    nextRead: selectedShare
      ? { tool: "innerlife_share_check", arguments: { shareId: selectedShare.id } }
      : { tool: "innerlife_pending_shares", arguments: {} },
    detailRef: { tool: "innerlife_briefing", arguments: { detail: "full" } }
  };
}

module.exports = {
  BRIEFING_LOOP_LIMIT,
  BRIEFING_MEMORY_LIMIT,
  DETAIL_LEVELS,
  SHARE_CANDIDATE_LIMIT,
  SHARE_PREVIEW_BYTES,
  normalizeInnerLifeDetail,
  shapeInnerLifeBriefing,
  shapeInnerLifeStatus,
  shapePendingShares,
  shapeShareCheckResult
};
