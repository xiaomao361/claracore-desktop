const {
  IL_SYSTEM,
  compactSession,
  compactShare,
  isNoShareInnerLifeOutput
} = require("../policy");

const SESSION_AFTERTHOUGHT_MAX_ATTEMPTS = 8;
const SESSION_AFTERTHOUGHT_RETRY_BASE_SECONDS = 60;
const SESSION_AFTERTHOUGHT_RETRY_MAX_SECONDS = 60 * 60;

const SESSION_LIFECYCLE_PORTS = [
  "claimAfterthoughts",
  "closeSession",
  "completeAfterthought",
  "converge",
  "createSession",
  "ensureProfile",
  "findExistingSession",
  "findSessionForEnd",
  "findSimilarShare",
  "generateAfterthought",
  "getBriefing",
  "getShare",
  "listShares",
  "newId",
  "resolveAgentIdentity",
  "retryAfterthought"
];

function sessionAfterthoughtRetrySeconds(attempts) {
  const safeAttempts = Math.max(
    1,
    Math.min(Number.parseInt(String(attempts), 10) || 1, SESSION_AFTERTHOUGHT_MAX_ATTEMPTS)
  );
  return Math.min(
    SESSION_AFTERTHOUGHT_RETRY_MAX_SECONDS,
    SESSION_AFTERTHOUGHT_RETRY_BASE_SECONDS * 2 ** (safeAttempts - 1)
  );
}

function normalizeSessionSummary(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    let serialized;
    try {
      serialized = JSON.stringify(value, null, 2);
    } catch (_error) {
      throw new Error("InnerLife session summary must be JSON-serializable.");
    }
    if (typeof serialized !== "string") {
      throw new Error("InnerLife session summary must be JSON-serializable.");
    }
    return serialized.trim();
  }
  return String(value || "").trim();
}

function createInnerLifeSessionLifecycleService(inputPorts = {}) {
  const missingPorts = SESSION_LIFECYCLE_PORTS.filter((name) => typeof inputPorts[name] !== "function");
  if (missingPorts.length) {
    throw new Error(`InnerLife session lifecycle service requires ports: ${missingPorts.join(", ")}.`);
  }

  const ports = Object.freeze({ ...inputPorts });

  async function buildStartPacket(database, profile, session, briefing, options = {}) {
    const [pendingShares, approvedShares] = await Promise.all([
      ports.listShares(database, "pending", 20),
      ports.listShares(database, "approved", 20)
    ]);
    const selected = pendingShares.find((share) => share.agent_id === profile.agent_id)
      || approvedShares.find((share) => share.agent_id === profile.agent_id)
      || null;
    const sharePlan = selected
      ? {
          selected: true,
          decision: "share_now",
          reason: selected.status === "pending"
            ? "A thought is waiting for a fitting moment to be shared."
            : "A previously approved thought is available for this agent.",
          delivery_style: "natural",
          share: compactShare(selected),
          suggested_opening: String(selected.body || "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)[0]
            ?.slice(0, 180) || ""
        }
      : {
          selected: false,
          decision: "wait",
          reason: "No thought is waiting to be shared for this agent.",
          delivery_style: null,
          share: null,
          suggested_opening: ""
        };
    return {
      session: compactSession(session),
      share_plan: sharePlan,
      briefing_ref: {
        tool: "innerlife_briefing",
        agentId: profile.agent_id,
        note: "Call innerlife_briefing only when the full context is needed."
      },
      instruction: options.existing
        ? "Existing session. Use share_plan first; fetch full briefing lazily only if needed."
        : "Use share_plan first. Do not mechanically read briefing aloud; fetch full briefing lazily only if needed.",
      ...(options.includeBriefing ? { briefing } : {})
    };
  }

  async function startInnerLifeSession(database, input = {}) {
    const agentId = ports.resolveAgentIdentity(input || {}).id;
    const profile = await ports.ensureProfile(database, agentId);
    const externalSessionId = String(input.externalSessionId || "").trim()
      || ports.newId("external_session");
    const existing = await ports.findExistingSession(database, {
      agentId: profile.agent_id,
      externalSessionId
    });
    if (existing) {
      return buildStartPacket(database, profile, existing, existing.briefing || {}, {
        existing: true,
        includeBriefing: Boolean(input.includeBriefing)
      });
    }

    const briefing = await ports.getBriefing(database, {
      agentId: profile.agent_id,
      lineId: input.lineId || input.line_id || ""
    });
    const session = await ports.createSession(database, {
      id: ports.newId("inner_session"),
      agentId: profile.agent_id,
      userId: String(input.userId || "local-user").trim() || "local-user",
      host: String(input.host || "desktop").trim() || "desktop",
      externalSessionId,
      briefing
    });
    return buildStartPacket(database, profile, session, briefing, {
      existing: false,
      includeBriefing: Boolean(input.includeBriefing)
    });
  }

  async function endInnerLifeSession(database, sessionId, input = {}) {
    const requestedId = String(sessionId || "").trim();
    if (!requestedId) throw new Error("InnerLife session id is required.");
    const session = await ports.findSessionForEnd(database, {
      requestedId,
      callerAgentId: String(input.agentId || "").trim()
    });
    if (!session) {
      const legacyHookFallback = String(input.transcript || "").startsWith("[SessionEnd hook");
      if (input.bestEffort === true || legacyHookFallback) {
        return { session: null, missing: true, repeated: false };
      }
      throw new Error("InnerLife session not found.");
    }
    if (session.status === "ended") {
      const { briefing: _briefing, ...endedSession } = session;
      return {
        session: endedSession,
        repeated: true
      };
    }

    const summary = normalizeSessionSummary(input.summary || input.transcript || "");
    const eventId = ports.newId("inner_event");
    const thoughtId = ports.newId("inner_thought");
    const shareId = ports.newId("inner_share");
    const inboxId = ports.newId("inner_inbox");
    if (!summary) {
      const closed = await ports.closeSession(database, {
        session,
        summary: "",
        eventId
      });
      const { briefing: _briefing, ...endedSession } = closed;
      return {
        session: endedSession,
        inboxId: null,
        eventId,
        thoughtId: null,
        share: null,
        shareDecision: { create: false, reason: "empty_session_summary" },
        afterthoughtJob: null,
        converged: false,
        convergenceReason: "empty_session_summary"
      };
    }

    const template = [
      "Session afterthought",
      "",
      `Session: ${session.id}`,
      `Summary: ${summary || "No summary provided."}`,
      "",
      "Review before sharing or applying this anywhere."
    ].join("\n");
    const closed = await ports.closeSession(database, {
      session,
      summary,
      eventId,
      thoughtId,
      shareId,
      inboxId,
      template
    });
    const share = await ports.getShare(database, shareId);
    const { briefing: _briefing, ...endedSession } = closed;
    return {
      session: endedSession,
      inboxId,
      eventId,
      thoughtId,
      share,
      afterthoughtJob: { id: inboxId, status: "pending" },
      converged: false,
      convergenceReason: "queued"
    };
  }

  async function processPendingSessionAfterthoughts(database, limit = 5) {
    const safeLimit = Math.max(1, Math.min(20, Number.parseInt(String(limit), 10) || 5));
    const jobs = await ports.claimAfterthoughts(database, safeLimit);
    const results = [];
    for (const job of jobs) {
      const metadata = { ...(job.metadata || {}) };
      const template = String(metadata.template || job.body || "Session ended");
      try {
        const share = await ports.getShare(database, metadata.shareId);
        let generated = { body: share?.body || template, source: "skipped" };
        let shareDecision = null;
        if (share && ["drafting", "pending", "approved", "deferred"].includes(share.status)) {
          generated = await ports.generateAfterthought(database, {
            tier: "light",
            system: IL_SYSTEM.session,
            prompt: template,
            template
          });
          const noModelOutput = generated?.source === "template";
          if (generated?.error) {
            const generationError = new Error(String(generated.error));
            generationError.code = "INNERLIFE_AFTERTHOUGHT_GENERATION_FAILED";
            throw generationError;
          }
          const noShareOutput = !noModelOutput && isNoShareInnerLifeOutput(generated.body);
          const duplicate = noModelOutput || noShareOutput
            ? null
            : await ports.findSimilarShare(database, job.agentId, generated.body, {
                excludeId: metadata.shareId
              });
          shareDecision = noModelOutput
            ? { create: false, reason: "no_model_output" }
            : noShareOutput
              ? { create: false, reason: "model_no_share" }
              : duplicate
                ? {
                    create: false,
                    reason: "similar_share_exists",
                    duplicateOf: duplicate.id,
                    similarity: duplicate.similarity
                  }
                : { create: true, reason: "distinct_shareable_thought" };
          metadata.shareDecision = shareDecision;
        }
        const completion = await ports.completeAfterthought(database, {
          job,
          metadata,
          generated,
          share,
          shareDecision
        });
        if (completion?.completed === false) {
          results.push({
            id: job.id,
            ok: false,
            status: "stale_claim",
            error: "The afterthought lease expired before this worker completed; its output was discarded."
          });
          continue;
        }
        let convergence = null;
        let convergenceError = "";
        if (metadata.shareDecision?.create !== false) {
          try {
            convergence = await ports.converge(database, {
              agentId: job.agentId,
              sourceThoughtId: metadata.thoughtId,
              automated: true,
              reason: "session_end"
            });
          } catch (error) {
            // The generated thought/share and job receipt are already durable.
            // Requeueing here would regenerate the same afterthought and could
            // duplicate a share. Surface convergence as a follow-up warning.
            convergenceError = error.message || String(error);
          }
        }
        results.push({
          id: job.id,
          ok: true,
          status: convergenceError ? "processed_with_warning" : "processed",
          shareId: metadata.shareId,
          source: generated.source,
          converged: Boolean(convergence?.converged),
          ...(convergenceError ? { warning: `Convergence failed after persistence: ${convergenceError}` } : {})
        });
      } catch (error) {
        const errorCode = String(error?.code || "").trim();
        const attempts = Math.max(0, Number.parseInt(String(metadata.attempts || 0), 10) || 0) + 1;
        const terminal = attempts >= SESSION_AFTERTHOUGHT_MAX_ATTEMPTS;
        const failedAt = new Date();
        const retrySeconds = terminal ? 0 : sessionAfterthoughtRetrySeconds(attempts);
        const nextRetryAt = terminal
          ? null
          : new Date(failedAt.getTime() + retrySeconds * 1000).toISOString();
        const retry = await ports.retryAfterthought(database, {
          job,
          metadata,
          attempts,
          error: error.message || String(error),
          ...(errorCode ? { errorCode } : {}),
          failedAt: failedAt.toISOString(),
          nextRetryAt,
          retrySeconds,
          terminal
        });
        if (retry?.updated === false) {
          results.push({
            id: job.id,
            ok: false,
            status: "stale_claim",
            error: "The afterthought lease expired before this worker recorded its failure."
          });
          continue;
        }
        results.push({
          id: job.id,
          ok: false,
          error: error.message || String(error),
          ...(errorCode ? { errorCode } : {}),
          status: terminal ? "failed" : "retrying",
          attempts,
          retrySeconds,
          nextRetryAt
        });
      }
    }
    return {
      processed: results.filter((item) => item.ok).length,
      retrying: results.filter((item) => item.status === "retrying").length,
      terminalFailures: results.filter((item) => item.status === "failed").length,
      staleClaims: results.filter((item) => item.status === "stale_claim").length,
      results
    };
  }

  return Object.freeze({
    endInnerLifeSession,
    processPendingSessionAfterthoughts,
    startInnerLifeSession
  });
}

module.exports = {
  SESSION_AFTERTHOUGHT_MAX_ATTEMPTS,
  SESSION_AFTERTHOUGHT_RETRY_BASE_SECONDS,
  SESSION_AFTERTHOUGHT_RETRY_MAX_SECONDS,
  SESSION_LIFECYCLE_PORTS,
  createInnerLifeSessionLifecycleService,
  sessionAfterthoughtRetrySeconds
};
