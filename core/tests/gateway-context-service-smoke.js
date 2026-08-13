const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  BRIEF_MEMORY_LIMIT,
  createGatewayContextService,
  truncateUtf8
} = require("../gateway/context");

const FIXED_NOW = new Date("2026-07-31T08:00:00.000Z");
const LARGE_TEXT = "共享上下文🙂".repeat(4000);

function buildSharedLine() {
  return {
    lineId: "line-alpha",
    agentId: "agent-alpha",
    lineTitle: LARGE_TEXT,
    currentPosition: {
      lineId: "line-alpha",
      agentId: "agent-alpha",
      positionId: "position-alpha",
      summary: LARGE_TEXT,
      interpretationStatus: "confirmed",
      factsUsed: Array.from({ length: 20 }, (_, index) => `fact-${index}-${LARGE_TEXT}`),
      metadata: {
        positionHistory: Array.from({ length: 30 }, (_, index) => ({
          position: `${index}-${LARGE_TEXT}`
        })),
        privateFullMetadata: LARGE_TEXT
      },
      updatedAt: "2026-07-31T07:59:00.000Z"
    },
    sharedReality: {
      confirmedGround: LARGE_TEXT,
      userConfirmed: true
    },
    history: Array.from({ length: 10 }, (_, index) => ({
      id: `history-${index}`,
      summary: LARGE_TEXT,
      interpretationStatus: "confirmed",
      createdAt: "2026-07-31T07:00:00.000Z"
    })),
    handoffs: Array.from({ length: 10 }, (_, index) => ({
      id: `handoff-${index}`,
      objective: LARGE_TEXT,
      openItems: [LARGE_TEXT],
      nextStep: LARGE_TEXT,
      createdAt: "2026-07-31T07:00:00.000Z"
    })),
    nextStep: LARGE_TEXT,
    text: `Full Shared Line\n${LARGE_TEXT}`
  };
}

function buildPorts(calls, overrides = {}) {
  const memories = Array.from({ length: 8 }, (_, index) => ({
    id: `memory-${index}`,
    title: `${index}-${LARGE_TEXT}`,
    body: LARGE_TEXT,
    labels: ["agent:agent-alpha", LARGE_TEXT],
    status: "active",
    sensitivity: "normal",
    updatedAt: "2026-07-31T07:30:00.000Z"
  }));
  const ports = {
    async getSharedLine(_core, input) {
      calls.push(["getSharedLine", input]);
      return buildSharedLine();
    },
    async listMemories(_core, input) {
      calls.push(["listMemories", input]);
      return memories.slice(0, input.limit);
    },
    async searchMemories(_core, input) {
      calls.push(["searchMemories", input]);
      return { results: memories.slice(0, input.limit) };
    },
    async getInnerLifeSnapshot(_core, agentId) {
      calls.push(["getInnerLifeSnapshot", agentId]);
      return {
        counts: {
          pending_inbox_count: 2,
          pending_shares_count: 2
        },
        daemon: {
          agentId,
          status: "idle",
          enabled: true,
          lastResult: LARGE_TEXT
        },
        doctor: {
          status: "warn",
          summary: LARGE_TEXT,
          issues: [{
            level: "warn",
            code: "large_fixture",
            message: LARGE_TEXT,
            action: LARGE_TEXT
          }]
        },
        pendingShares: [
          { id: "share-alpha", agent_id: "agent-alpha", status: "pending", preview: LARGE_TEXT },
          { id: "share-beta", agent_id: "agent-beta", status: "pending", preview: "Beta must not leak" }
        ],
        pendingInbox: [
          { id: "inbox-alpha", agentId: "agent-alpha", source: "smoke", body: LARGE_TEXT },
          { id: "inbox-beta", agentId: "agent-beta", source: "smoke", body: "Beta must not leak" }
        ]
      };
    },
    async listInnerLifeInbox(_core, agentId, limit) {
      calls.push(["listInnerLifeInbox", agentId, limit]);
      return [
        { id: "inbox-alpha", agentId: "agent-alpha", source: "smoke", body: "Alpha inbox" },
        { id: "inbox-beta", agentId: "agent-beta", source: "smoke", body: "Beta must not leak" }
      ];
    },
    async listInnerLifeShares(_core, agentId, limit) {
      calls.push(["listInnerLifeShares", agentId, limit]);
      return [
        { id: "recent-alpha", agent_id: "agent-alpha", body: "Alpha recent share" },
        { id: "recent-beta", agent_id: "agent-beta", body: "Beta must not leak" }
      ];
    },
    async listInnerLifeThoughts(_core, agentId, limit) {
      calls.push(["listInnerLifeThoughts", agentId, limit]);
      return [{ id: "thought-alpha", body: "Alpha recent thought" }];
    },
    now: () => FIXED_NOW,
    ...overrides
  };
  return ports;
}

async function main() {
  const continuityRepository = fs.readFileSync(
    path.resolve(__dirname, "../db/repositories/continuity.js"),
    "utf8"
  );
  assert(
    !continuityRepository.includes("getGatewayContext"),
    "Gateway context composition must not return to the Continuity repository."
  );

  const utf8 = truncateUtf8("你🙂好", 7);
  assert.deepStrictEqual(utf8, { text: "你🙂", truncated: true });
  assert(!utf8.text.includes("\uFFFD"), "UTF-8 truncation must not split a character.");

  const omittedCalls = [];
  const service = createGatewayContextService(buildPorts(omittedCalls));
  const omitted = await service.get({}, { agentId: "agent-alpha", limit: 7 });
  assert.strictEqual(omitted.detail, "brief", "Omitted detail must select the bounded brief payload.");
  assert(!omittedCalls.some(([name]) => name === "listInnerLifeInbox"));
  assert(!omittedCalls.some(([name]) => name === "listInnerLifeShares"));
  assert(!omittedCalls.some(([name]) => name === "listInnerLifeThoughts"));

  const fullCalls = [];
  const full = await createGatewayContextService(buildPorts(fullCalls)).get({}, {
    agentId: "agent-alpha",
    detail: "full",
    limit: 7
  });
  assert.strictEqual(full.detail, "full", "Explicit full detail must preserve the complete compatibility payload.");
  assert.strictEqual(full.generatedAt, FIXED_NOW.toISOString());
  assert(full.sharedLine.currentPosition.metadata.privateFullMetadata, "Full context lost Shared Line metadata.");
  assert.strictEqual(full.memories.length, 7);
  assert(fullCalls.some(([name]) => name === "listInnerLifeInbox"));
  assert(fullCalls.some(([name]) => name === "listInnerLifeShares"));
  assert(fullCalls.some(([name]) => name === "listInnerLifeThoughts"));
  assert.deepStrictEqual(
    fullCalls.find(([name]) => name === "listMemories")[1],
    { limit: 7, agentId: "agent-alpha" },
    "Full Memory reads must remain scoped to the authenticated Agent."
  );
  assert(!JSON.stringify(full).includes("Beta must not leak"), "Full context leaked another Agent's InnerLife data.");

  const briefCalls = [];
  const brief = await createGatewayContextService(buildPorts(briefCalls)).get({}, {
    agentId: "agent-alpha",
    detail: "brief",
    limit: 20
  });
  assert.strictEqual(brief.detail, "brief");
  assert.strictEqual(brief.memories.length, BRIEF_MEMORY_LIMIT);
  assert.strictEqual(brief.memoryPage.requestedLimit, 20);
  assert.strictEqual(brief.memoryPage.appliedLimit, BRIEF_MEMORY_LIMIT);
  assert.strictEqual(brief.memoryPage.requestCapped, true);
  assert.strictEqual(brief.memoryPage.mayHaveMore, true);
  // v0.6.6: brief embeds the Shared Line resume packet and the InnerLife status
  // shape instead of a second, larger copy of each domain.
  assert.strictEqual(brief.sharedLine.detail, "resume");
  assert(!Object.hasOwn(brief.sharedLine, "currentPosition"));
  assert(!Object.hasOwn(brief.sharedLine, "snapshots"));
  assert(!Object.hasOwn(brief.sharedLine, "agentState"));
  assert(!JSON.stringify(brief.sharedLine).includes("privateFullMetadata"));
  // Multibyte text cannot split a character, so the cut lands at or below the bound.
  assert(Buffer.byteLength(brief.memories[0].bodyPreview, "utf8") <= 480);
  assert(Buffer.byteLength(brief.memories[0].bodyPreview, "utf8") > 400);
  assert.strictEqual(brief.memories[0].bodyTruncated, true);
  assert(Buffer.byteLength(brief.text, "utf8") <= 1024);
  assert(Buffer.byteLength(JSON.stringify(brief), "utf8") <= 8 * 1024);
  assert.deepStrictEqual(brief.sharedLine.omitted.detailRef, {
    tool: "shared_line_get",
    arguments: { lineId: "line-alpha", detail: "full" }
  });
  assert.deepStrictEqual(brief.innerLife.detailRef, {
    tool: "innerlife_status",
    arguments: { agentId: "agent-alpha", detail: true }
  });
  assert(!Object.hasOwn(brief.innerLife, "pendingInbox"), "Brief must not carry Inbox bodies.");
  assert(brief.innerLife.pendingShares.length <= 1, "Brief carries at most one candidate preview.");
  assert(!JSON.stringify(brief).includes("Beta must not leak"), "Brief context leaked another Agent's data.");
  assert(!briefCalls.some(([name]) => name === "listInnerLifeInbox"));
  assert(!briefCalls.some(([name]) => name === "listInnerLifeShares"));
  assert(!briefCalls.some(([name]) => name === "listInnerLifeThoughts"));
  assert.deepStrictEqual(
    briefCalls.find(([name]) => name === "listMemories")[1],
    { limit: BRIEF_MEMORY_LIMIT, agentId: "agent-alpha" }
  );

  const searchCalls = [];
  await createGatewayContextService(buildPorts(searchCalls)).get({}, {
    agentId: "agent-alpha",
    detail: "brief",
    query: "bounded search",
    limit: 20
  });
  assert.deepStrictEqual(
    searchCalls.find(([name]) => name === "searchMemories")[1],
    {
      query: "bounded search",
      limit: BRIEF_MEMORY_LIMIT,
      agentId: "agent-alpha",
      timeView: "current"
    }
  );
  assert(!searchCalls.some(([name]) => name === "listMemories"));

  const invalidCalls = [];
  await assert.rejects(
    createGatewayContextService(buildPorts(invalidCalls)).get({}, {
      agentId: "agent-alpha",
      detail: "expanded"
    }),
    /detail must be brief or full/
  );
  assert.deepStrictEqual(invalidCalls, [], "Invalid detail should fail before any domain read.");

  const blockedCalls = [];
  const blockedService = createGatewayContextService(buildPorts(blockedCalls, {
    async getSharedLine(_core, input) {
      blockedCalls.push(["getSharedLine", input]);
      const error = new Error("SHARED_LINE_ID_REQUIRED: choose a line");
      error.code = "SHARED_LINE_ID_REQUIRED";
      throw error;
    }
  }));
  await assert.rejects(
    blockedService.get({}, { agentId: "agent-alpha", detail: "brief" }),
    (error) => error.code === "SHARED_LINE_ID_REQUIRED"
  );
  assert.deepStrictEqual(
    blockedCalls.map(([name]) => name),
    ["getSharedLine"],
    "Shared Line ambiguity must fail before unrelated domain reads."
  );

  process.stdout.write("Gateway context service smoke passed.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message || error}\n`);
  process.exitCode = 1;
});
