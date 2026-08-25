const SHARE_TIMING_PORTS = [
  "ensureProfile",
  "findAvailableShareId",
  "getOptionalResumePacket",
  "getShare",
  "getShareCheck",
  "getSnapshotLite",
  "meaningfulTokens",
  "newId",
  "recordCheck",
  "resolveAgentIdentity"
];

function buildSharedLineTimingContext(resumePacket = {}) {
  const current = resumePacket.currentPosition || {};
  const sharedReality = resumePacket.sharedReality || {};
  const agentState = resumePacket.agentState || {};
  return [
    current.summary ? `Current position: ${current.summary}` : "",
    current.interpretationStatus ? `Interpretation status: ${current.interpretationStatus}` : "",
    sharedReality.realityLine ? `Reality line: ${sharedReality.realityLine}` : "",
    sharedReality.currentInterpretation
      ? `Current interpretation: ${sharedReality.currentInterpretation}`
      : "",
    sharedReality.confirmedGround ? `Confirmed ground: ${sharedReality.confirmedGround}` : "",
    sharedReality.provisionalRead ? `Provisional read: ${sharedReality.provisionalRead}` : "",
    sharedReality.boundaryNotes ? `Boundary notes: ${sharedReality.boundaryNotes}` : "",
    sharedReality.misreadRisks ? `Misread risks: ${sharedReality.misreadRisks}` : "",
    resumePacket.nextStep ? `Next step: ${resumePacket.nextStep}` : "",
    agentState.notes ? `Agent notes: ${agentState.notes}` : ""
  ].filter(Boolean).join("\n");
}

function uniqueTokens(tokens) {
  return [...new Set(tokens || [])];
}

function createInnerLifeShareTimingService(inputPorts = {}) {
  const missingPorts = SHARE_TIMING_PORTS.filter((name) => typeof inputPorts[name] !== "function");
  if (missingPorts.length) {
    throw new Error(`InnerLife share timing service requires ports: ${missingPorts.join(", ")}.`);
  }

  const ports = Object.freeze({ ...inputPorts });

  return async function checkInnerLifeShareTiming(database, input = {}) {
    const providedContext = String(input.context || "").trim();
    const sessionId = String(input.sessionId || "").trim() || null;
    const requestedShareId = String(input.shareId || "").trim();
    const requestedShareRecord = requestedShareId
      ? await ports.getShare(database, requestedShareId)
      : null;
    const hasExplicitAgent = Boolean(input?.agentId || input?.agent_id || input?.agent);
    const agentId = hasExplicitAgent
      ? ports.resolveAgentIdentity(input || {}).id
      : requestedShareRecord?.agent_id || ports.resolveAgentIdentity(input || {}).id;
    if (requestedShareRecord && requestedShareRecord.agent_id !== agentId) {
      throw new Error("InnerLife share belongs to another agent.");
    }
    const requestedShare = requestedShareRecord?.status === "drafting"
      ? null
      : requestedShareRecord;
    const profile = await ports.ensureProfile(database, agentId);
    const {
      resumePacket,
      sharedLineContext: sharedLineSelection
    } = await ports.getOptionalResumePacket(database, input, profile.agent_id);
    const sharedLineContext = buildSharedLineTimingContext(resumePacket);
    const context = providedContext || sharedLineContext;
    let share = requestedShare;
    if (!share && !requestedShareId) {
      const availableShareId = await ports.findAvailableShareId(database, profile.agent_id);
      if (availableShareId) {
        share = await ports.getShare(database, availableShareId);
      }
    }

    const checkId = ports.newId("inner_share_check");
    if (!share) {
      const draftingRequested = requestedShareRecord?.status === "drafting";
      await ports.recordCheck(database, {
        id: checkId,
        shareId: "",
        agentId: profile.agent_id,
        sessionId,
        context,
        decision: "none",
        reason: draftingRequested
          ? "The requested InnerLife thought is still being generated."
          : "No shareable InnerLife thought is available.",
        metadata: {
          contextSource: providedContext ? "provided" : "none",
          ...(draftingRequested ? { requestedShareStatus: "drafting" } : {}),
          sharedLineStatus: sharedLineSelection.status,
          candidateLineIds: sharedLineSelection.candidateLineIds
        }
      });
      return {
        check: await ports.getShareCheck(database, checkId),
        share: null,
        snapshot: await ports.getSnapshotLite(database, profile.agent_id)
      };
    }

    const explicitTokens = ports.meaningfulTokens(providedContext);
    const lineTokens = ports.meaningfulTokens(sharedLineContext);
    const contextTokens = ports.meaningfulTokens(
      [providedContext, sharedLineContext].filter(Boolean).join("\n")
    );
    const shareTokens = new Set(ports.meaningfulTokens(share.body));
    const explicitOverlap = uniqueTokens(
      explicitTokens.filter((token) => shareTokens.has(token))
    );
    const lineOverlap = uniqueTokens(
      lineTokens.filter((token) => shareTokens.has(token))
    );
    const overlap = uniqueTokens(
      contextTokens.filter((token) => shareTokens.has(token))
    );
    const hasAsk =
      /\b(ask|asked|question|share|need|use|recall|remember)\b/i.test(providedContext)
      || /分享|需要|使用|记得|回忆|问题/u.test(providedContext);
    const hasDirectUseSignal = hasAsk || explicitOverlap.length > 0 || lineOverlap.length > 0;
    let decision = "defer";
    let reason = "The share is not available for timing review.";
    if (!context) {
      decision = "defer";
      reason = "No current context or Shared Line context was available.";
    } else if (share.status === "pending") {
      decision = "review_first";
      reason = hasDirectUseSignal && overlap.length > 0
        ? `Pending share connects to the ${sharedLineContext ? "current line" : "provided context"}: ${overlap.slice(0, 5).join(", ")}. Review before use.`
        : hasDirectUseSignal
          ? "Pending share may fit the current context, but it still requires review before use."
          : "Pending share has no lexical connection to the current context. Topic overlap is only evidence; review the conversational register before use.";
    } else if (share.status === "approved" && hasDirectUseSignal) {
      decision = "use";
      reason = overlap.length > 0
        ? `Approved share connects to the ${sharedLineContext ? "current line" : "provided context"}: ${overlap.slice(0, 5).join(", ")}.`
        : "Approved share fits the current context.";
    } else if (share.status === "deferred" && hasDirectUseSignal) {
      decision = "use";
      reason = "Deferred share now matches the current context.";
    } else if (["approved", "deferred"].includes(share.status)) {
      decision = "review_first";
      reason = `${share.status[0].toUpperCase()}${share.status.slice(1)} share has no lexical connection to the current context. Topic overlap is only evidence; review the conversational register before use.`;
    }
    await ports.recordCheck(database, {
      id: checkId,
      shareId: share.id,
      agentId: profile.agent_id,
      sessionId,
      context,
      decision,
      reason,
      metadata: {
        overlap,
        explicitOverlap,
        lineOverlap,
        hasAsk,
        contextSource: providedContext
          ? sharedLineContext ? "provided+shared_line" : "provided"
          : sharedLineContext ? "shared_line" : "none",
        sharedLineStatus: sharedLineSelection.status,
        candidateLineIds: sharedLineSelection.candidateLineIds,
        lineId: resumePacket.lineId || "",
        positionId: resumePacket.currentPosition?.positionId || ""
      }
    });
    return {
      check: await ports.getShareCheck(database, checkId),
      share,
      snapshot: await ports.getSnapshotLite(database, profile.agent_id)
    };
  };
}

module.exports = {
  SHARE_TIMING_PORTS,
  createInnerLifeShareTimingService
};
