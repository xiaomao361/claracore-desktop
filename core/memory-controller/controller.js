const crypto = require("crypto");
const { MemoryRetrievalCache, createCacheKey } = require("./cache");
const { ACTIONS: STAGE_A_ACTIONS, evaluateStageA } = require("./stage-a");
const { ACTIONS: STAGE_B_ACTIONS, evaluateStageB, formatMemoryContext } = require("./stage-b");

const CONTROLLER_POLICY_VERSION = "memory-controller-v1";
const HARD_TIMEOUT_MS = 2500;
const POLICY_MODES = new Set(["off", "observe", "canary"]);
const CANARY_ALLOWED_LABELS = new Set(["engineering-experience", "knowledge-card", "knowledge-card-pointer"]);
const CANARY_BLOCKED_LABELS = new Set(["affective", "intimate", "personal-preference", "relationship"]);

class ControllerTimeoutError extends Error {
  constructor() {
    super("Memory Controller retrieval timed out.");
    this.name = "ControllerTimeoutError";
  }
}

function elapsedMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1e6;
}

function queryHash(prompt) {
  return `sha256:${crypto.createHash("sha256").update(String(prompt || "")).digest("hex")}`;
}

function newDecisionId() {
  return `memory_control_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function isTrustedCanaryCandidate(candidate = {}) {
  const labels = new Set((Array.isArray(candidate.labels) ? candidate.labels : [])
    .map((label) => String(label || "").trim().toLowerCase())
    .filter(Boolean));
  if ([...CANARY_BLOCKED_LABELS].some((label) => labels.has(label))) return false;
  if ([...CANARY_ALLOWED_LABELS].some((label) => labels.has(label))) return true;
  const projectScoped = [...labels].some((label) => label.startsWith("project:"))
    || labels.has("claracore-desktop");
  return labels.has("decision") && projectScoped;
}

function withTimeout(operation, timeoutMs) {
  let timer;
  return Promise.race([
    Promise.resolve().then(operation),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new ControllerTimeoutError()), timeoutMs);
      timer.unref?.();
    })
  ]).finally(() => clearTimeout(timer));
}

function auditCandidate(candidate) {
  return {
    id: candidate.id,
    title: String(candidate.title || "").slice(0, 160),
    score: candidate.score || 0,
    source: candidate.source || "unknown",
    status: candidate.status || "",
    stateRole: candidate.stateRole || ""
  };
}

function publicStageB(stageB) {
  if (!stageB) return null;
  return {
    action: stageB.action,
    reason: stageB.reason,
    policyVersion: stageB.policyVersion || "",
    selectedIds: (Array.isArray(stageB.selected) ? stageB.selected : []).map((candidate) => candidate.id).filter(Boolean).slice(0, 3)
  };
}

function createMemoryController(options = {}) {
  const database = options.database;
  if (!database) throw new Error("Memory Controller database is required.");
  const cache = options.cache || new MemoryRetrievalCache(options.cacheOptions);
  const search = options.search || ((prompt, limit, searchOptions) => database.searchMemories(prompt, limit, searchOptions));
  const defaultMode = String(options.mode || "observe").trim().toLowerCase();
  if (!POLICY_MODES.has(defaultMode)) throw new Error("Memory Controller mode must be off, observe, or canary.");
  const parsedTimeout = Number.parseInt(String(options.timeoutMs || HARD_TIMEOUT_MS), 10) || HARD_TIMEOUT_MS;
  const timeoutMs = Math.max(1, Math.min(HARD_TIMEOUT_MS, parsedTimeout));

  async function record(input) {
    if (typeof database.recordMemoryControlEvent !== "function") return null;
    try {
      return await database.recordMemoryControlEvent(input);
    } catch (_error) {
      return null;
    }
  }

  async function run(input = {}) {
    const startedAt = process.hrtime.bigint();
    const prompt = String(input.prompt || "").trim();
    const agentId = String(input.agentId || input.agent_id || "").trim();
    if (!agentId) throw new Error("Memory Controller requires a trusted agentId.");
    const mode = String(input.mode || defaultMode).trim().toLowerCase();
    if (!POLICY_MODES.has(mode)) throw new Error("Memory Controller mode must be off, observe, or canary.");
    const timeView = String(input.timeView || input.time_view || "current").trim().toLowerCase();
    if (!["current", "historical", "all"].includes(timeView)) throw new Error("Memory Controller timeView must be current, historical, or all.");
    const contextBudgetTokens = Math.max(0, Math.min(900, Number.parseInt(String(input.contextBudgetTokens ?? 600), 10) || 0));
    const decisionId = newDecisionId();
    const stageA = evaluateStageA({ prompt, mode });
    const hash = queryHash(stageA.normalizedPrompt);
    const commonEvent = {
      policyVersion: CONTROLLER_POLICY_VERSION,
      policyMode: mode,
      agentId,
      clientId: input.clientId || input.client_id || "",
      conversationId: input.conversationId || input.conversation_id || "",
      sessionId: input.sessionId || input.session_id || "",
      queryHash: hash,
      queryPreview: stageA.normalizedPrompt.slice(0, 160),
      features: {
        promptLength: stageA.normalizedPrompt.length,
        stageARule: stageA.ruleId,
        timeView,
        contextBudgetTokens
      },
      stageAAction: stageA.action,
      stageAReason: stageA.reason
    };

    if (stageA.action === STAGE_A_ACTIONS.NOOP) {
      const event = await record({
        id: decisionId,
        ...commonEvent,
        resultStatus: "completed",
        totalLatencyMs: elapsedMs(startedAt)
      });
      return {
        decisionId: event?.id || "",
        action: "NOOP",
        reason: stageA.reason,
        stageA,
        stageB: null,
        candidates: [],
        context: "",
        policyMode: mode,
        policyVersion: CONTROLLER_POLICY_VERSION,
        cacheStatus: "none",
        resultStatus: event ? "completed" : "error",
        timing: { totalMs: elapsedMs(startedAt), searchMs: 0 }
      };
    }

    let searchLatencyMs = 0;
    let cacheStatus = "miss";
    try {
      const retrieval = await withTimeout(async () => {
        const watermark = await database.getMemoryControlWatermark("memoria");
        if (!watermark) throw new Error("Memory Controller watermark is unavailable.");
        const eligibilityScope = mode === "canary" ? "trusted-canary-v1" : "normal";
        const searchParams = { limit: 3, timeView, eligibilityScope };
        const key = createCacheKey({
          queryHash: hash,
          agentScope: agentId,
          sensitivityScope: "normal",
          timeView,
          policyVersion: CONTROLLER_POLICY_VERSION,
          retrievalParams: searchParams,
          watermark: watermark.revision
        });
        const cached = await cache.get(key, {
          revalidate: (ids) => database.getMemoryControlEligibleIds({ ids, agentId, timeView, sensitivityScope: "normal" })
        });
        if (cached.status === "hit") {
          cacheStatus = "hit";
          return { value: cached.value, searchParams };
        }

        const searchStartedAt = process.hrtime.bigint();
        const result = await search(stageA.normalizedPrompt, 3, { agentId, timeView, includeRestricted: false });
        searchLatencyMs = elapsedMs(searchStartedAt);
        const rawCandidates = (Array.isArray(result?.results) ? result.results : [])
          .slice(0, 3)
          .filter((candidate) => mode !== "canary"
            || (timeView === "current" && isTrustedCanaryCandidate(candidate)));
        const eligibleIds = await database.getMemoryControlEligibleIds({
          ids: rawCandidates.map((candidate) => candidate.id),
          agentId,
          timeView,
          sensitivityScope: "normal"
        });
        const eligible = new Set(eligibleIds);
        const value = {
          candidates: rawCandidates.filter((candidate) => eligible.has(candidate.id)),
          retrieval: {
            mode: String(result?.mode || "unknown").slice(0, 40),
            timeView,
            error: String(result?.error || "").slice(0, 200)
          }
        };
        cache.set(key, value, { watermark: watermark.revision });
        return { value, searchParams };
      }, timeoutMs);

      const stageB = evaluateStageB({ candidates: retrieval.value.candidates, timeView, contextBudgetTokens });
      const formatted = stageB.action === STAGE_B_ACTIONS.INJECT_TOP1 || stageB.action === STAGE_B_ACTIONS.INJECT_TOPK
        ? formatMemoryContext({ candidates: stageB.selected, contextBudgetTokens, decisionId })
        : { context: "", estimatedTokens: 0, candidates: [] };
      const effectiveStageB = formatted.context || stageB.action === STAGE_B_ACTIONS.ABSTAIN
        ? stageB
        : { ...stageB, action: STAGE_B_ACTIONS.ABSTAIN, reason: "context_budget_exceeded", selected: [] };
      const recommendationInjects = [STAGE_B_ACTIONS.INJECT_TOP1, STAGE_B_ACTIONS.INJECT_TOPK].includes(effectiveStageB.action);
      const effectiveAction = effectiveStageB.action === STAGE_B_ACTIONS.ABSTAIN
        ? "ABSTAIN"
        : mode === "canary"
          ? effectiveStageB.action
          : "RETRIEVE";
      const context = mode === "canary" && recommendationInjects ? formatted.context : "";
      const injectedIds = context ? formatted.candidates.map((candidate) => candidate.id) : [];
      const resultStatus = effectiveStageB.action === STAGE_B_ACTIONS.ABSTAIN ? "abstained" : "completed";
      const event = await record({
        id: decisionId,
        ...commonEvent,
        stageBAction: effectiveStageB.action,
        stageBReason: effectiveStageB.reason,
        searchParams: retrieval.searchParams,
        candidates: effectiveStageB.candidates.map(auditCandidate),
        injectedIds,
        cacheStatus,
        searchLatencyMs,
        totalLatencyMs: elapsedMs(startedAt),
        estimatedTokens: recommendationInjects ? formatted.estimatedTokens : 0,
        resultStatus
      });
      if (!event) {
        return {
          decisionId: "",
          action: "NOOP",
          reason: "audit_unavailable",
          stageA,
          stageB: publicStageB(effectiveStageB),
          candidates: [],
          context: "",
          policyMode: mode,
          policyVersion: CONTROLLER_POLICY_VERSION,
          cacheStatus,
          resultStatus: "error",
          timing: { totalMs: elapsedMs(startedAt), searchMs: searchLatencyMs }
        };
      }
      return {
        decisionId: event.id,
        action: effectiveAction,
        reason: mode === "observe" && recommendationInjects ? "observe_only" : effectiveStageB.reason,
        stageA,
        stageB: publicStageB(effectiveStageB),
        candidates: effectiveStageB.candidates.map(auditCandidate),
        context,
        policyMode: mode,
        policyVersion: CONTROLLER_POLICY_VERSION,
        cacheStatus,
        resultStatus,
        timing: { totalMs: elapsedMs(startedAt), searchMs: searchLatencyMs }
      };
    } catch (error) {
      const timedOut = error instanceof ControllerTimeoutError;
      const reason = timedOut ? "controller_timeout" : "controller_error";
      const resultStatus = timedOut ? "timeout" : "error";
      const event = await record({
        id: decisionId,
        ...commonEvent,
        stageBAction: "ABSTAIN",
        stageBReason: reason,
        cacheStatus,
        searchLatencyMs,
        totalLatencyMs: elapsedMs(startedAt),
        resultStatus,
        error: error.message
      });
      return {
        decisionId: event?.id || "",
        action: "NOOP",
        reason,
        stageA,
        stageB: { action: "ABSTAIN", reason, selected: [], candidates: [] },
        candidates: [],
        context: "",
        policyMode: mode,
        policyVersion: CONTROLLER_POLICY_VERSION,
        cacheStatus,
        resultStatus,
        timing: { totalMs: elapsedMs(startedAt), searchMs: searchLatencyMs }
      };
    }
  }

  return { cache, run };
}

module.exports = {
  CONTROLLER_POLICY_VERSION,
  ControllerTimeoutError,
  HARD_TIMEOUT_MS,
  createMemoryController,
  isTrustedCanaryCandidate,
  newDecisionId,
  queryHash,
  withTimeout
};
