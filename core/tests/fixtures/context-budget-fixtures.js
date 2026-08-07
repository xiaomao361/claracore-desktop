// Deterministic fixtures for the context-budget baseline and smoke.
//
// No live personal content and no real counts enter CI. Fixtures are
// intentionally at or above realistic worst case so a passing ceiling is
// evidence, not luck.

const { boundedUtf8Text } = require("../../db/helpers");

const pathsFixture = Object.freeze({
  dataRoot: "/Users/fixture/Library/Application Support/claracore-desktop/data",
  databasePath: "/Users/fixture/Library/Application Support/claracore-desktop/data/claracore.db"
});

const gatewayLaunchFixture = Object.freeze({
  command: "/Applications/ClaraCore Desktop.app/Contents/MacOS/ClaraCore Desktop",
  args: ["--mcp-stdio"],
  env: { CLARACORE_DESKTOP_HEADLESS: "1" },
  displayCommand: "node core/cli.js --help",
  source: "development checkout"
});

// A long single-paragraph summary. Ambiguity previews must cut this to the
// documented byte ceiling instead of embedding the whole position.
const LONG_SUMMARY = [
  "The gateway currently returns the entire active-line catalog inside the ambiguity refusal, ",
  "including each line's full current summary, which is exactly the payload this release bounds. ",
  "This fixture text exists to be longer than any preview ceiling so truncation is exercised. ",
  "It repeats deliberately: this fixture text exists to be longer than any preview ceiling. ",
  "It repeats deliberately: this fixture text exists to be longer than any preview ceiling."
].join("");

const AMBIGUOUS_LINE_COUNT = 12;

function ambiguousLines() {
  return Array.from({ length: AMBIGUOUS_LINE_COUNT }, (unused, index) => ({
    id: `line_fixture_${String(index).padStart(2, "0")}_abcdefgh`,
    title: `Fixture Shared Line ${index} with a deliberately long descriptive title for byte pressure`,
    status: "active",
    summary: LONG_SUMMARY,
    updatedAt: "2026-08-07 01:00:00",
    positionUpdatedAt: "2026-08-07 01:30:00"
  }));
}

// Mirrors buildAmbiguousSharedLineError in
// core/db/repositories/continuity/lines.js. The smoke asserts the real
// repository produces the same bounded shape, so this stays a fixture of the
// contract rather than a second implementation of it.
function ambiguousSharedLineFixture({ candidateLimit = 5, summaryBytes = 160, titleBytes = 80 } = {}) {
  const lines = ambiguousLines();
  const candidates = lines.slice(0, candidateLimit).map((line) => ({
    lineId: line.id,
    title: boundedUtf8Text(line.title, titleBytes),
    status: line.status,
    summaryPreview: boundedUtf8Text(line.summary, summaryBytes),
    updatedAt: line.positionUpdatedAt
  }));
  return {
    lines,
    payload: {
      error: "shared_line_id_required",
      code: "SHARED_LINE_ID_REQUIRED",
      message: candidates
      .map((candidate) => `${candidate.lineId} (${candidate.title}: ${candidate.summaryPreview})`)
      .join("; "),
      agentId: "fixture-agent",
      candidates,
      candidateCount: candidates.length,
      totalCount: lines.length,
      detailRef: { tool: "shared_line_list", arguments: { agentId: "fixture-agent", status: "active" } }
    }
  };
}

// A Memory body far larger than any preview ceiling, carrying the operational
// embedding columns that a default recall must not surface.
// The prose here must never contain the literal operational column names, since
// the smoke greps the serialized payload for them.
const LONG_BODY = [
  "This fixture Memory body is deliberately longer than the summary preview ceiling so truncation is exercised. ",
  "The row it belongs to also carries the operational vector columns that listMemories joins in, because a ",
  "summary-first recall must drop those instead of shipping operational metadata into model context. ",
  "Repeat for byte pressure: this fixture Memory body is deliberately longer than the summary preview ceiling. ",
  "Repeat for byte pressure: this fixture Memory body is deliberately longer than the summary preview ceiling. ",
  "Repeat for byte pressure: this fixture Memory body is deliberately longer than the summary preview ceiling."
].join("");

const MEMORY_RESULT_COUNT = 3;

function memorySearchRows(count = MEMORY_RESULT_COUNT) {
  return Array.from({ length: count }, (unused, index) => ({
    id: `mem_fixture_${String(index).padStart(2, "0")}_abcdefgh`,
    title: `Fixture Memory ${index} with a long descriptive title used for byte pressure in default recall`,
    body: LONG_BODY,
    status: index === 2 ? "superseded" : "active",
    sensitivity: "normal",
    created_at: "2026-08-01 09:00:00",
    updated_at: "2026-08-06 18:30:00",
    labels: Array.from({ length: 12 }, (item, labelIndex) => `fixture-label-${labelIndex}`),
    embedding_status: "ready",
    embedding_provider: "claracore-builtin",
    embedding_model: "Xenova/bge-small-zh-v1.5",
    embedding_dimension: 512,
    embedding_error: null,
    embedded_at: "2026-08-06 18:30:05",
    search_source: "keyword+vector",
    search_score: 0.8123456789,
    stateRole: index === 2 ? "historical" : "current",
    supersedes: index === 0 ? ["mem_fixture_02_abcdefgh"] : [],
    supersededBy: index === 2 ? ["mem_fixture_00_abcdefgh"] : []
  }));
}

// A core whose database returns the fixture rows, so the baseline and smoke
// exercise the real shaping code rather than a copy of it.
function memorySearchCore(count = MEMORY_RESULT_COUNT) {
  return {
    database: {
      async searchMemories(query, limit) {
        const rows = memorySearchRows(count).slice(0, limit);
        return {
          mode: "hybrid",
          query: String(query || ""),
          timeView: "current",
          results: rows,
          related: rows.map((row) => ({ id: row.id, neighbors: [{ id: "mem_fixture_neighbor", body: LONG_BODY }] })),
          error: null
        };
      }
    }
  };
}

// A stored resume packet carrying everything a default line read must stop
// delivering: agent state, all agent states, snapshots, arcs, and a parallel
// text block that repeats the structured fields.
// The prose here must never contain the Agent-state field names, since the
// smoke greps the serialized packet for them.
const LONG_STATE = [
  "This fixture value is deliberately long so the resume shaping has to drop or bound it. ",
  "Agent-scoped state is identical across unrelated lines, which is exactly why repeating it ",
  "in every line read spends the same bytes twice for no new information. ",
  "Repeat for byte pressure: this fixture value is deliberately long so the shaping has to drop it."
].join("");

function sharedLinePacketFixture(lineId = "line_fixture_alpha") {
  const agentState = {
    agentId: "fixture-agent",
    communicationStyle: LONG_STATE,
    relationshipPosition: LONG_STATE,
    preferences: LONG_STATE,
    boundaries: LONG_STATE,
    stablePatterns: LONG_STATE,
    updatedAt: "2026-08-06 18:00:00"
  };
  return {
    lineId,
    agentId: "fixture-agent",
    lineTitle: `Fixture Shared Line for ${lineId} with a long descriptive title used for byte pressure`,
    lines: [],
    archivedLines: [],
    currentPosition: {
      lineId,
      agentId: "fixture-agent",
      positionId: `position_${lineId}`,
      lineTitle: `Fixture Shared Line for ${lineId}`,
      summary: LONG_STATE,
      interpretationStatus: "confirmed",
      factsUsed: Array.from({ length: 20 }, (unused, index) => `mem_fixture_fact_${index}_${LONG_STATE}`),
      metadata: {
        positionHistory: Array.from({ length: 30 }, (unused, index) => ({ position: `${index}-${LONG_STATE}` })),
        affectiveTrace: Array.from({ length: 30 }, (unused, index) => ({ tone: `${index}-${LONG_STATE}` })),
        realityLine: LONG_STATE,
        privateFullMetadata: LONG_STATE
      },
      updatedAt: "2026-08-06 18:30:00"
    },
    history: Array.from({ length: 5 }, (unused, index) => ({
      id: `history-${index}`,
      summary: LONG_STATE,
      interpretationStatus: "confirmed",
      createdAt: "2026-08-05 10:00:00"
    })),
    snapshots: Array.from({ length: 5 }, (unused, index) => ({ id: `snapshot-${index}`, body: LONG_STATE })),
    handoffs: Array.from({ length: 3 }, (unused, index) => ({
      id: `handoff-${index}`,
      objective: LONG_STATE,
      openItems: [LONG_STATE, LONG_STATE],
      nextStep: LONG_STATE,
      createdAt: "2026-08-06 12:00:00"
    })),
    sharedReality: {
      realityLine: LONG_STATE,
      entryPosture: "",
      confirmedGround: LONG_STATE,
      provisionalRead: "",
      boundaryNotes: "",
      misreadRisks: "",
      currentInterpretation: LONG_STATE,
      userConfirmed: true
    },
    agentState,
    agentStates: [agentState, { ...agentState, agentId: "other-agent" }],
    modelAdjustment: { model: "fixture-model", injectPrompt: LONG_STATE },
    positionHistory: Array.from({ length: 5 }, (unused, index) => ({ position: `${index}-${LONG_STATE}` })),
    affectiveTrace: Array.from({ length: 5 }, (unused, index) => ({ tone: `${index}-${LONG_STATE}` })),
    arcMeta: {
      fullArc: false,
      positionHistoryTotal: 30,
      positionHistoryTruncated: true,
      affectiveTraceTotal: 30,
      affectiveTraceTruncated: true
    },
    nextStep: "Resume from the current shared position and ask before overwriting it.",
    text: `Shared Line: fixture\n${LONG_STATE}\n${LONG_STATE}\n${LONG_STATE}`
  };
}


// InnerLife fixtures.
//
// The audited briefing carried five full Memories, five full shares, five Inbox
// bodies and five thoughts, and three of the share bodies were exact duplicates
// of thought bodies. These fixtures reproduce that shape so the smoke proves it
// is gone.
const LONG_THOUGHT = [
  "This fixture thought body is deliberately longer than any preview ceiling so truncation is exercised. ",
  "It stands in for a real InnerLife thought that has not yet been offered as a share. ",
  "Repeat for byte pressure: this fixture thought body is deliberately longer than any preview ceiling. ",
  "Repeat for byte pressure: this fixture thought body is deliberately longer than any preview ceiling. ",
  "Repeat for byte pressure: this fixture thought body is deliberately longer than any preview ceiling."
].join("");

function innerLifeSharesFixture(count = 20) {
  return Array.from({ length: count }, (unused, index) => ({
    id: `inner_share_fixture_${String(index).padStart(2, "0")}`,
    agent_id: "fixture-agent",
    thought_id: `inner_thought_fixture_${index}`,
    status: "pending",
    body: `${index}: ${LONG_THOUGHT}`,
    preview: `${index}: ${LONG_THOUGHT}`,
    decision_reason: "",
    created_at: "2026-08-07 01:00:00",
    updated_at: "2026-08-07 01:05:00"
  }));
}

function innerLifeSnapshotLiteFixture() {
  const shares = innerLifeSharesFixture();
  return {
    mode: "lite",
    profiles: [{ agentId: "fixture-agent", displayName: "Fixture Agent", enabled: true }],
    counts: {
      pending_shares_count: shares.length,
      pending_inbox_count: 5,
      active_sessions_count: 1,
      afterthought_retrying_count: 0,
      afterthought_terminal_failure_count: 0
    },
    pendingShares: shares,
    pendingInbox: Array.from({ length: 5 }, (unused, index) => ({
      id: `inner_inbox_fixture_${index}`,
      agentId: "fixture-agent",
      source: "claude-code",
      body: `${index}: ${LONG_THOUGHT}`,
      createdAt: "2026-08-07 00:30:00"
    })),
    daemon: {
      agentId: "fixture-agent",
      status: "running",
      enabled: true,
      lastTickAt: "2026-08-07 01:00:00",
      nextRunAt: "2026-08-07 02:00:00",
      lastResult: LONG_THOUGHT,
      lastError: "",
      tickCount: 42,
      updatedAt: "2026-08-07 01:00:00",
      metadata: { verbose: LONG_THOUGHT }
    },
    doctor: {
      status: "ok",
      summary: LONG_THOUGHT,
      issues: Array.from({ length: 6 }, (unused, index) => ({
        level: "warning",
        code: `fixture_issue_${index}`,
        message: LONG_THOUGHT,
        action: LONG_THOUGHT
      })),
      nextActions: [LONG_THOUGHT]
    },
    detail_ref: "Pass detail=true to innerlife_status for the full snapshot."
  };
}

function innerLifeBriefingFixture({ ambiguous = false } = {}) {
  const shares = innerLifeSharesFixture(5);
  return {
    agentId: "fixture-agent",
    generatedAt: "2026-08-07T01:32:46.786Z",
    sharedLineContext: ambiguous
      ? { status: "ambiguous", lineId: "", errorCode: "SHARED_LINE_ID_REQUIRED", candidateLineIds: ["a", "b", "c"] }
      : { status: "ok", lineId: "line_fixture_alpha", candidateLineIds: [] },
    sharedLine: ambiguous
      ? { lineId: "", summary: "", interpretationStatus: "", updatedAt: null }
      : {
          lineId: "line_fixture_alpha",
          summary: LONG_THOUGHT,
          interpretationStatus: "confirmed",
          updatedAt: "2026-08-06 18:30:00"
        },
    recentHandoffs: [],
    recentMemories: Array.from({ length: 5 }, (unused, index) => ({
      id: `mem_fixture_briefing_${index}`,
      title: `Fixture briefing memory ${index}`,
      body: `memory-${index}: ${LONG_THOUGHT}`,
      labels: Array.from({ length: 10 }, (item, labelIndex) => `label-${labelIndex}`)
    })),
    pendingShares: shares,
    pendingInbox: Array.from({ length: 5 }, (unused, index) => ({
      id: `inner_inbox_fixture_${index}`,
      source: "claude-code",
      body: `${index}: ${LONG_THOUGHT}`,
      createdAt: "2026-08-07 00:30:00"
    })),
    // The first three thoughts are byte-identical to the first three share
    // bodies, exactly as the live audit found.
    recentThoughts: [
      ...shares.slice(0, 3).map((share) => ({ body: share.body, createdAt: share.created_at })),
      { body: `unique-a: ${LONG_THOUGHT}`, createdAt: "2026-08-06 22:00:00" },
      { body: `unique-b: ${LONG_THOUGHT}`, createdAt: "2026-08-06 21:00:00" }
    ],
    text: `Agent: fixture-agent\n${LONG_THOUGHT}\n${LONG_THOUGHT}`
  };
}

module.exports = {
  AMBIGUOUS_LINE_COUNT,
  MEMORY_RESULT_COUNT,
  sharedLinePacketFixture,
  ambiguousLines,
  ambiguousSharedLineFixture,
  gatewayLaunchFixture,
  innerLifeBriefingFixture,
  innerLifeSharesFixture,
  innerLifeSnapshotLiteFixture,
  memorySearchCore,
  memorySearchRows,
  pathsFixture
};
