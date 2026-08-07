// v0.6.6 turn-context patch: server-owned candidate collection.
//
// Before this, every host hook did the orchestration itself — call the Memory
// Controller, list shares, invent a relevance weight, normalize both into
// candidate shapes, then call the arbiter. That put one policy in three
// codebases and made it drift.
//
// This service owns collection. The arbiter stays a pure function and keeps
// owning the decision. Nothing here writes: Memory Controller keeps its own
// bounded ledger, and InnerLife relevance uses the read-only scorer rather than
// innerlife_share_check, which would INSERT a row per check.
//
// Per-domain timeouts are deliberate. The Memory Controller's own hard timeout
// is 2500 ms, which would eat an entire 3 s turn budget on its own and leave
// nothing for InnerLife. Each domain gets its own slice, and a domain that
// overruns is discarded with a recorded reason instead of failing the turn.

const TURN_BUDGET_MS = 3000;
const MEMORY_TIMEOUT_MS = 1500;
const INNERLIFE_TIMEOUT_MS = 800;
const SHARE_CANDIDATE_LIMIT = 3;

const TURN_CONTEXT_PORTS = Object.freeze([
  "runMemoryController",
  "listPendingShares",
  "scoreShareRelevance"
]);

class DomainTimeoutError extends Error {
  constructor(domain) {
    super(`${domain} exceeded its turn-context budget.`);
    this.domain = domain;
  }
}

function withTimeout(operation, timeoutMs, domain) {
  let timer = null;
  return Promise.race([
    Promise.resolve()
      .then(operation)
      .finally(() => {
        if (timer) clearTimeout(timer);
      }),
    new Promise((unused, reject) => {
      timer = setTimeout(() => reject(new DomainTimeoutError(domain)), timeoutMs);
    })
  ]);
}

// "no candidates" and "never ran" must stay distinguishable, or a permanently
// timing-out domain is indistinguishable from a quiet one for as long as it
// keeps failing.
function domainOutcome(settled, domain) {
  if (settled.status === "fulfilled") return { status: "ok", value: settled.value };
  const error = settled.reason;
  if (error instanceof DomainTimeoutError) return { status: "timeout", value: null, domain };
  return { status: "error", value: null, reason: error?.message || String(error) };
}

function createTurnContextService(inputPorts = {}) {
  const missing = TURN_CONTEXT_PORTS.filter((name) => typeof inputPorts[name] !== "function");
  if (missing.length) {
    throw new Error(`Turn context service requires ports: ${missing.join(", ")}.`);
  }
  const ports = Object.freeze({ ...inputPorts });

  async function collectMemory(core, { prompt, agentId }) {
    const packet = await ports.runMemoryController(core, { prompt, agentId });
    const context = typeof packet?.context === "string" ? packet.context : "";
    // Forward the Controller's real similarity score. Hardcoding 1 here made
    // any injected Memory outrank every share permanently: a 0.4 Memory beat a
    // 0.9 share, so InnerLife could never win a turn while Memory was live.
    // The Controller only injects above its own 0.72 vector floor, well clear
    // of the arbiter's 0.35, so the true score never costs a valid candidate.
    const selectedId = packet?.stageB?.selectedIds?.[0] || packet?.injectedIds?.[0] || "";
    const selected = (packet?.candidates || []).find((candidate) => candidate.id === selectedId);
    const score = Number(selected?.score);
    return [
      {
        id: selectedId || packet?.decisionId || "",
        agentId,
        action: packet?.action || "",
        policyMode: packet?.policyMode || "",
        stateRole: selected?.stateRole || "current",
        sensitivity: "normal",
        relevance: context ? (Number.isFinite(score) ? score : 0) : 0,
        context
      }
    ].filter((candidate) => candidate.id || candidate.context);
  }

  async function collectInnerLife(core, { prompt, agentId }) {
    const shares = await ports.listPendingShares(core, agentId, SHARE_CANDIDATE_LIMIT);
    return (shares || []).slice(0, SHARE_CANDIDATE_LIMIT).map((share) => {
      const scored = ports.scoreShareRelevance(prompt, share);
      return {
        id: share.id,
        agentId: share.agent_id || share.agentId || "",
        status: share.status,
        selected: true,
        relevance: scored.relevance,
        signals: scored.signals,
        preview: share.preview || share.body || ""
      };
    });
  }

  return {
    ports: TURN_CONTEXT_PORTS,

    async collect(core, input = {}) {
      const prompt = String(input.prompt || "").trim();
      const agentId = String(input.agentId || "").trim();
      const startedAt = Date.now();

      if (!prompt) {
        return {
          memoryCandidates: [],
          shareCandidates: [],
          domainStatus: { memory: "skipped", innerlife: "skipped" },
          latencyMs: 0
        };
      }

      const [memorySettled, innerLifeSettled] = await Promise.allSettled([
        withTimeout(() => collectMemory(core, { prompt, agentId }), MEMORY_TIMEOUT_MS, "memory"),
        withTimeout(() => collectInnerLife(core, { prompt, agentId }), INNERLIFE_TIMEOUT_MS, "innerlife")
      ]);

      const memory = domainOutcome(memorySettled, "memory");
      const innerLife = domainOutcome(innerLifeSettled, "innerlife");

      return {
        memoryCandidates: memory.value || [],
        shareCandidates: innerLife.value || [],
        domainStatus: { memory: memory.status, innerlife: innerLife.status },
        latencyMs: Date.now() - startedAt
      };
    }
  };
}

module.exports = {
  INNERLIFE_TIMEOUT_MS,
  MEMORY_TIMEOUT_MS,
  SHARE_CANDIDATE_LIMIT,
  TURN_BUDGET_MS,
  TURN_CONTEXT_PORTS,
  createTurnContextService
};
