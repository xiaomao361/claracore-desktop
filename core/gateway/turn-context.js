// v0.6.6 turn-context patch: server-owned candidate collection.
//
// Before this, every host hook did the orchestration itself — call the Memory
// Controller, list shares, invent a relevance weight, normalize both into
// candidate shapes, then call the arbiter. That put one policy in three
// codebases and made it drift.
//
// This service owns collection. The arbiter stays a pure function and keeps
// owning the decision. Nothing here writes: the Memory Controller keeps its own
// bounded ledger.
//
// InnerLife is deliberately not collected here. Automatic delivery needs the
// server to judge whether a waiting thought fits, and measured against real
// shares it cannot: lexical overlap scored three unrelated Chinese shares above
// the English one that actually matched, because Chinese bigrams tie on function
// words and cross-language overlap is structurally zero.
//
// The deeper reason is that topical relevance was never the right gate. A
// waiting thought does not need to be about the current topic — an engineering
// thought during engineering work is fine even off-topic. What makes a share
// wrong is the register: an engineering thought in the middle of an intimate
// conversation. The server cannot read register; the model can. So InnerLife
// stays model-driven through innerlife_share_check, and the per-prompt hook only
// carries the pending count, which is a signal that something is waiting rather
// than a decision to say it.
//
// The Memory Controller earned automatic injection by having embeddings and a
// measured 0.72 vector gate. If InnerLife ever gets share embeddings, this is
// where it would come back.
//
// The Memory timeout is deliberate: the Controller's own hard timeout is 2500 ms,
// which would eat an entire 3 s turn budget on its own.

const TURN_BUDGET_MS = 3000;
const MEMORY_TIMEOUT_MS = 1500;

const TURN_CONTEXT_PORTS = Object.freeze(["runMemoryController"]);

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
          domainStatus: { memory: "skipped", innerlife: "not_collected" },
          latencyMs: 0
        };
      }

      const [memorySettled] = await Promise.allSettled([
        withTimeout(() => collectMemory(core, { prompt, agentId }), MEMORY_TIMEOUT_MS, "memory")
      ]);
      const memory = domainOutcome(memorySettled, "memory");

      return {
        memoryCandidates: memory.value || [],
        shareCandidates: [],
        // "not_collected" is not "nothing was waiting": InnerLife is reached
        // through innerlife_share_check, not through automatic delivery.
        domainStatus: { memory: memory.status, innerlife: "not_collected" },
        latencyMs: Date.now() - startedAt
      };
    }
  };
}

module.exports = {
  MEMORY_TIMEOUT_MS,
  TURN_BUDGET_MS,
  TURN_CONTEXT_PORTS,
  createTurnContextService
};
