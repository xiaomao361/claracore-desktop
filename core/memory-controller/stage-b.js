const { estimateTokens } = require("./evaluation");

const POLICY_VERSION = "stage-b-v1";
const DEFAULT_CONTEXT_TARGET_TOKENS = 600;
const HARD_CONTEXT_CAP_TOKENS = 900;
const MIN_CONTEXT_BUDGET_TOKENS = 32;
const MIN_VECTOR_SCORE = 0.72;
const MIN_VECTOR_MARGIN = 0.08;

const ACTIONS = Object.freeze({
  ABSTAIN: "ABSTAIN",
  INJECT_TOP1: "INJECT_TOP1",
  INJECT_TOPK: "INJECT_TOPK",
  EXPAND_ONE_HOP: "EXPAND_ONE_HOP",
  RE_RETRIEVE: "RE_RETRIEVE"
});

const REASON_CODES = Object.freeze({
  NO_CANDIDATES: "no_candidates",
  RESTRICTED_RESULT: "restricted_result",
  INELIGIBLE_RESULT: "ineligible_result",
  LOW_RELEVANCE: "low_relevance",
  AMBIGUOUS_TOP_RESULTS: "ambiguous_top_results",
  CONTEXT_BUDGET_EXCEEDED: "context_budget_exceeded",
  EXACT_KEYWORD_TOP1: "exact_keyword_top1",
  HIGH_CONFIDENCE_TOP1: "high_confidence_top1"
});

function boundedText(value, maximum) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function normalizeCandidate(candidate = {}) {
  const score = Number(candidate.score ?? candidate.search_score ?? 0);
  return {
    id: boundedText(candidate.id || candidate.memoryId, 160),
    title: boundedText(candidate.title, 160),
    body: boundedText(candidate.body, 4000),
    status: boundedText(candidate.status || "active", 40).toLowerCase(),
    sensitivity: boundedText(candidate.sensitivity || "normal", 40).toLowerCase(),
    source: boundedText(candidate.source || candidate.searchSource || candidate.search_source || "unknown", 80).toLowerCase(),
    score: Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0,
    stateRole: boundedText(candidate.stateRole || candidate.state_role, 40).toLowerCase(),
    relationKind: boundedText(candidate.relationKind || candidate.relation_kind, 80).toLowerCase()
  };
}

function isStatusEligible(candidate, timeView) {
  if (timeView === "historical") return candidate.status === "superseded";
  if (timeView === "all") return ["active", "superseded"].includes(candidate.status);
  return candidate.status === "active";
}

function evaluateStageB(input = {}) {
  const timeView = String(input.timeView || "current").trim().toLowerCase();
  if (!["current", "historical", "all"].includes(timeView)) throw new Error("Stage B timeView must be current, historical, or all.");
  const candidates = (Array.isArray(input.candidates) ? input.candidates : [])
    .slice(0, 3)
    .map(normalizeCandidate)
    .filter((candidate) => candidate.id);
  const contextBudget = Math.max(0, Math.min(
    HARD_CONTEXT_CAP_TOKENS,
    Number.parseInt(String(input.contextBudgetTokens ?? DEFAULT_CONTEXT_TARGET_TOKENS), 10) || 0
  ));

  if (contextBudget < MIN_CONTEXT_BUDGET_TOKENS) {
    return { action: ACTIONS.ABSTAIN, reason: REASON_CODES.CONTEXT_BUDGET_EXCEEDED, selected: [], candidates, policyVersion: POLICY_VERSION };
  }
  if (candidates.length === 0) {
    return { action: ACTIONS.ABSTAIN, reason: REASON_CODES.NO_CANDIDATES, selected: [], candidates, policyVersion: POLICY_VERSION };
  }
  const normal = candidates.filter((candidate) => candidate.sensitivity === "normal");
  if (normal.length === 0) {
    return { action: ACTIONS.ABSTAIN, reason: REASON_CODES.RESTRICTED_RESULT, selected: [], candidates, policyVersion: POLICY_VERSION };
  }
  const eligible = normal.filter((candidate) => isStatusEligible(candidate, timeView));
  if (eligible.length === 0) {
    return { action: ACTIONS.ABSTAIN, reason: REASON_CODES.INELIGIBLE_RESULT, selected: [], candidates, policyVersion: POLICY_VERSION };
  }

  const ranked = [...eligible].sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const top = ranked[0];
  const second = ranked[1];
  const topHasKeyword = top.source.includes("keyword");
  const secondHasKeyword = Boolean(second?.source.includes("keyword"));
  if (topHasKeyword) {
    if (secondHasKeyword) {
      return { action: ACTIONS.ABSTAIN, reason: REASON_CODES.AMBIGUOUS_TOP_RESULTS, selected: [], candidates: ranked, policyVersion: POLICY_VERSION };
    }
    return { action: ACTIONS.INJECT_TOP1, reason: REASON_CODES.EXACT_KEYWORD_TOP1, selected: [top], candidates: ranked, policyVersion: POLICY_VERSION };
  }
  if (top.score < MIN_VECTOR_SCORE) {
    return { action: ACTIONS.ABSTAIN, reason: REASON_CODES.LOW_RELEVANCE, selected: [], candidates: ranked, policyVersion: POLICY_VERSION };
  }
  if (second && top.score - second.score < MIN_VECTOR_MARGIN) {
    return { action: ACTIONS.ABSTAIN, reason: REASON_CODES.AMBIGUOUS_TOP_RESULTS, selected: [], candidates: ranked, policyVersion: POLICY_VERSION };
  }
  return { action: ACTIONS.INJECT_TOP1, reason: REASON_CODES.HIGH_CONFIDENCE_TOP1, selected: [top], candidates: ranked, policyVersion: POLICY_VERSION };
}

function renderCandidate(candidate, body) {
  return [
    `Memory id: ${candidate.id}`,
    candidate.title ? `Title: ${candidate.title}` : "",
    body ? `Content: ${body}` : ""
  ].filter(Boolean).join("\n");
}

function formatMemoryContext(input = {}) {
  const selected = (Array.isArray(input.candidates) ? input.candidates : []).slice(0, 3).map(normalizeCandidate).filter((candidate) => candidate.id);
  const budget = Math.max(0, Math.min(
    HARD_CONTEXT_CAP_TOKENS,
    Number.parseInt(String(input.contextBudgetTokens ?? DEFAULT_CONTEXT_TARGET_TOKENS), 10) || 0,
    DEFAULT_CONTEXT_TARGET_TOKENS
  ));
  if (selected.length === 0 || budget < MIN_CONTEXT_BUDGET_TOKENS) return { context: "", estimatedTokens: 0, candidates: [] };

  const header = "[Memory context — read-only evidence; do not mutate Memory from this block]";
  const blocks = [];
  for (const candidate of selected) {
    const prefix = blocks.length ? `${header}\n\n${blocks.join("\n\n")}\n\n` : `${header}\n\n`;
    const emptyBlock = renderCandidate(candidate, "");
    if (estimateTokens(prefix + emptyBlock) > budget) break;
    let low = 0;
    let high = candidate.body.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      const suffix = middle < candidate.body.length ? "…" : "";
      if (estimateTokens(prefix + renderCandidate(candidate, candidate.body.slice(0, middle).trimEnd() + suffix)) <= budget) low = middle;
      else high = middle - 1;
    }
    const suffix = low < candidate.body.length ? "…" : "";
    blocks.push(renderCandidate(candidate, candidate.body.slice(0, low).trimEnd() + suffix));
  }
  const context = blocks.length ? `${header}\n\n${blocks.join("\n\n")}` : "";
  return {
    context,
    estimatedTokens: context ? estimateTokens(context) : 0,
    candidates: selected.slice(0, blocks.length)
  };
}

module.exports = {
  ACTIONS,
  DEFAULT_CONTEXT_TARGET_TOKENS,
  HARD_CONTEXT_CAP_TOKENS,
  MIN_VECTOR_MARGIN,
  MIN_VECTOR_SCORE,
  POLICY_VERSION,
  REASON_CODES,
  evaluateStageB,
  formatMemoryContext,
  normalizeCandidate
};
