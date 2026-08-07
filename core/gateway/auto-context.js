// v0.6.6 automatic-context arbiter.
//
// Before this, Memory and InnerLife could each add a block to the same user
// turn with no shared budget and no cross-domain winner. They now compete for
// one bounded delivery slot.
//
// The arbiter is deterministic and read-only. It records every candidate it saw
// and why each was discarded, selects at most one winner or abstains, and never
// claims delivery. Delivery and use are separate states that only the host can
// report, with evidence, after the response exists.
//
// This module is the single source of that logic so Codex, Claude, and Hermes
// hooks cannot drift apart. The host hooks themselves live outside this repo
// and must call it rather than re-deriving it.

const AUTO_CONTEXT_TARGET_TOKENS = 600;
const AUTO_CONTEXT_HARD_LIMIT_TOKENS = 900;
const BYTES_PER_TOKEN_ESTIMATE = 4;
const AUTO_CONTEXT_HARD_LIMIT_BYTES = AUTO_CONTEXT_HARD_LIMIT_TOKENS * BYTES_PER_TOKEN_ESTIMATE;
const AUTO_CONTEXT_TARGET_BYTES = AUTO_CONTEXT_TARGET_TOKENS * BYTES_PER_TOKEN_ESTIMATE;

const MIN_MEMORY_RELEVANCE = 0.35;
// 0.35, matching MIN_MEMORY_RELEVANCE so both domains face one floor.
// Measured over six real cases: the lowest score that should deliver is 0.438
// (a full Chinese question against a paraphrasing share) and the highest that
// should not is 0.286 (one incidental shared word), so 0.35 has room on both
// sides. At 0.5 no ordinary Chinese question could ever fire, because bigram
// tokenisation puts more boundary junk in the denominator than English filler
// words do. Six hand-built cases is a small sample; this is a floor that beats
// 0.5 on every one of them, not a calibrated constant.
const MIN_SHARE_RELEVANCE = 0.35;

// Evidence states are kept separate on purpose. "selected" is the only one this
// arbiter can produce; the rest belong to the host and to explicit tool calls.
const EVIDENCE_STATES = Object.freeze([
  "selected",
  "delivered",
  "used",
  "ignored",
  "wrong",
  "corrected",
  "unknown"
]);

function bytesOf(value) {
  return Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value ?? ""), "utf8");
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

function discard(candidate, reason) {
  return { ...candidate, eligible: false, discardReason: reason };
}

// A Memory candidate is the Memory Controller's own decision. The arbiter never
// widens it: everything the Controller already refused stays refused.
function evaluateMemoryCandidate(memory, callerAgentId) {
  const base = {
    domain: "memory",
    id: memory?.id || memory?.memoryId || "",
    relevance: Number(memory?.relevance ?? memory?.score ?? 0),
    body: memory?.context || memory?.bodyPreview || memory?.body || ""
  };
  if (!base.id || !base.body) return discard(base, "empty_candidate");
  if (memory.action && memory.action !== "INJECT_TOP1") return discard(base, "controller_did_not_inject");
  if (memory.policyMode && memory.policyMode !== "canary") return discard(base, "controller_not_in_canary");
  if (memory.sensitivity === "restricted") return discard(base, "restricted");
  if (memory.stateRole && memory.stateRole !== "current") return discard(base, "historical");
  if (memory.agentId && callerAgentId && memory.agentId !== callerAgentId) return discard(base, "cross_agent");
  if (base.relevance < MIN_MEMORY_RELEVANCE) return discard(base, "weak_relevance");
  return { ...base, eligible: true, urgency: 0 };
}

// An InnerLife candidate reached the arbiter because its timing gate opened.
// Timing is not relevance: a candidate that is merely due can still be
// semantically irrelevant, and rejecting it here must not mark it used.
function evaluateShareCandidate(share, callerAgentId) {
  const base = {
    domain: "innerlife",
    id: share?.id || share?.shareId || "",
    relevance: Number(share?.relevance ?? share?.score ?? 0),
    body: share?.preview || share?.body || ""
  };
  if (!base.id || !base.body) return discard(base, "empty_candidate");
  if (share.status && share.status !== "pending") return discard(base, "not_pending");
  if (share.agentId && callerAgentId && share.agentId !== callerAgentId) return discard(base, "cross_agent");
  if (share.selected === false) return discard(base, "share_check_did_not_select");
  if (base.relevance < MIN_SHARE_RELEVANCE) return discard(base, "weak_relevance");
  return { ...base, eligible: true, urgency: Number(share.urgency ?? 0) };
}

function rank(left, right) {
  // Urgency first: a share that is about to expire beats an equally relevant
  // Memory. Relevance breaks the tie. Memory wins a true tie because it is
  // reviewed durable fact, while a share is an unreviewed thought.
  if (right.urgency !== left.urgency) return right.urgency - left.urgency;
  if (right.relevance !== left.relevance) return right.relevance - left.relevance;
  if (left.domain === right.domain) return 0;
  return left.domain === "memory" ? -1 : 1;
}

function arbitrateAutomaticContext(input = {}) {
  const callerAgentId = String(input.agentId || "").trim();
  // A domain that never ran is not a domain with no candidates. Without this,
  // a permanently timing-out Memory Controller looks exactly like a quiet one.
  const domainStatus = {
    memory: "ok",
    innerlife: "ok",
    ...(input.domainStatus || {})
  };
  const candidates = [
    ...(input.memoryCandidates || []).map((memory) => evaluateMemoryCandidate(memory, callerAgentId)),
    ...(input.shareCandidates || []).map((share) => evaluateShareCandidate(share, callerAgentId))
  ];

  const eligible = candidates.filter((candidate) => candidate.eligible).sort(rank);
  const record = candidates.map((candidate) => ({
    domain: candidate.domain,
    id: candidate.id,
    eligible: Boolean(candidate.eligible),
    ...(candidate.discardReason ? { discardReason: candidate.discardReason } : {})
  }));

  const base = {
    agentId: callerAgentId,
    domainStatus,
    budget: {
      targetTokens: AUTO_CONTEXT_TARGET_TOKENS,
      hardLimitTokens: AUTO_CONTEXT_HARD_LIMIT_TOKENS,
      bytesPerTokenEstimate: BYTES_PER_TOKEN_ESTIMATE
    },
    candidates: record,
    evidenceStates: EVIDENCE_STATES,
    note: "At most one block per turn. selected is not delivered and not used; report those separately with evidence."
  };

  if (!eligible.length) {
    // Distinguish "nothing qualified" from "nothing was collected", so a broken
    // domain is visible in the trace instead of reading as a quiet turn.
    const degraded = Object.values(domainStatus).some((status) => status === "timeout" || status === "error");
    return {
      ...base,
      decision: "abstain",
      selected: null,
      block: null,
      reason: degraded ? "no_eligible_candidate_degraded" : "no_eligible_candidate"
    };
  }

  const winner = eligible[0];
  // The budget is shared, so the winner is trimmed rather than allowed to push
  // the turn over the hard limit.
  const body = bounded(winner.body, AUTO_CONTEXT_TARGET_BYTES);
  const block = {
    domain: winner.domain,
    id: winner.id,
    body,
    bytes: bytesOf(body),
    truncated: bytesOf(winner.body) > bytesOf(body)
  };

  if (block.bytes > AUTO_CONTEXT_HARD_LIMIT_BYTES) {
    return { ...base, decision: "abstain", selected: null, block: null, reason: "over_hard_limit" };
  }

  return {
    ...base,
    decision: "deliver_one",
    selected: { domain: winner.domain, id: winner.id, evidenceState: "selected" },
    block,
    suppressed: eligible.slice(1).map((candidate) => ({
      domain: candidate.domain,
      id: candidate.id,
      reason: "one_winner_per_turn"
    })),
    reason: "single_winner"
  };
}

module.exports = {
  AUTO_CONTEXT_HARD_LIMIT_BYTES,
  AUTO_CONTEXT_HARD_LIMIT_TOKENS,
  AUTO_CONTEXT_TARGET_BYTES,
  AUTO_CONTEXT_TARGET_TOKENS,
  EVIDENCE_STATES,
  MIN_MEMORY_RELEVANCE,
  MIN_SHARE_RELEVANCE,
  arbitrateAutomaticContext
};
