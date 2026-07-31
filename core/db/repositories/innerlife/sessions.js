const SESSION_REPOSITORY_SERVICES = [
  "endInnerLifeSession",
  "processPendingSessionAfterthoughts",
  "startInnerLifeSession"
];

const SESSION_STORE_METHODS = [
  "count",
  "get",
  "list",
  "listCompact",
  "resolveAfterthoughtFailure"
];

function createInnerLifeSessionRepository(_helpers, dependencies = {}) {
  const { DEFAULT_AGENT_ID } = _helpers;
  const sessionLifecycle = dependencies.sessionLifecycle || {};
  const sessionStore = dependencies.sessionStore || {};
  const missingServices = SESSION_REPOSITORY_SERVICES.filter(
    (name) => typeof sessionLifecycle[name] !== "function"
  );
  const missingStoreMethods = SESSION_STORE_METHODS.filter(
    (name) => typeof sessionStore[name] !== "function"
  );
  if (missingServices.length || missingStoreMethods.length) {
    throw new Error(
      `InnerLife session repository requires lifecycle services: ${missingServices.join(", ") || "none"}; `
      + `store methods: ${missingStoreMethods.join(", ") || "none"}.`
    );
  }

  return {
    async countInnerLifeSessions(agentId = "all") {
      return sessionStore.count(this, agentId);
    },

    async listInnerLifeSessions(agentId = DEFAULT_AGENT_ID, limit = 20, offset = 0) {
      return sessionStore.list(this, agentId, limit, offset);
    },

    async listInnerLifeSessionsCompact(agentId = DEFAULT_AGENT_ID, limit = 20, offset = 0) {
      return sessionStore.listCompact(this, agentId, limit, offset);
    },

    async getInnerLifeSession(id) {
      return sessionStore.get(this, id);
    },

    async listInnerLifeSessionsPage(input = {}) {
      const agentId = String(input.agentId || input.agent_id || "all").trim() || "all";
      const limit = Math.max(1, Math.min(Number.parseInt(String(input.limit || 10), 10) || 10, 50));
      const offset = Math.max(0, Number.parseInt(String(input.offset || 0), 10) || 0);
      const [items, total] = await Promise.all([
        sessionStore.listCompact(this, agentId, limit, offset),
        sessionStore.count(this, agentId)
      ]);
      return {
        agentId,
        items,
        limit,
        offset,
        total,
        hasMore: offset + items.length < total
      };
    },

    async startInnerLifeSession(input = {}) {
      return sessionLifecycle.startInnerLifeSession(this, input);
    },

    async endInnerLifeSession(sessionId, input = {}) {
      return sessionLifecycle.endInnerLifeSession(this, sessionId, input);
    },

    async processPendingSessionAfterthoughts(limit = 5) {
      return sessionLifecycle.processPendingSessionAfterthoughts(this, limit);
    },

    async resolveInnerLifeSessionAfterthoughtFailure(id, input = {}) {
      return sessionStore.resolveAfterthoughtFailure(this, id, input);
    }
  };
}

module.exports = {
  createInnerLifeSessionRepository
};
