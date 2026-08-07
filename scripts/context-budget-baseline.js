#!/usr/bin/env node
//
// v0.6.6 context-budget baseline.
//
// Serializes representative deterministic fixtures and emits machine-readable
// JSON describing how many UTF-8 bytes each default Agent-facing surface costs.
// Byte counts are the testable metric; token estimates are diagnostic only,
// because tokenization belongs to the receiving host and model.
//
// Usage:
//   node scripts/context-budget-baseline.js            # human summary
//   node scripts/context-budget-baseline.js --json     # machine-readable JSON

const { profileToolDefinitions } = require("../core/gateway/tool-profiles");
const { createGatewayContextService } = require("../core/gateway/context");
const { DOCS_SECTIONS, buildGatewayDocs } = require("../core/gateway/docs");
const memoria = require("../core/memoria");
const { shapeSharedLinePacket } = require("../core/continuity/resume-detail");
const {
  shapeInnerLifeBriefing,
  shapeInnerLifeStatus,
  shapePendingShares
} = require("../core/innerlife/selective");
const { arbitrateAutomaticContext } = require("../core/gateway/auto-context");
const { CONTEXT_BUDGET_CEILINGS } = require("../core/tests/fixtures/context-budget-ceilings");
const {
  ambiguousSharedLineFixture,
  gatewayLaunchFixture,
  innerLifeBriefingFixture,
  innerLifeSharesFixture,
  innerLifeSnapshotLiteFixture,
  memorySearchCore,
  memorySearchRows,
  pathsFixture,
  sharedLinePacketFixture
} = require("../core/tests/fixtures/context-budget-fixtures");

const BYTES_PER_TOKEN_ESTIMATE = 4;

function bytes(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return Buffer.byteLength(text ?? "", "utf8");
}

function measurement(name, value, ceiling, breakdown) {
  const size = bytes(value);
  return {
    name,
    bytes: size,
    tokenEstimate: Math.round(size / BYTES_PER_TOKEN_ESTIMATE),
    ceiling: ceiling ?? null,
    withinCeiling: ceiling == null ? null : size <= ceiling,
    ...(breakdown ? { breakdown } : {})
  };
}

// Totals prove a ceiling holds. Per-family breakdowns are what let the next
// regression say *which* field family grew, which is how the original audit
// found that non-body fields cost more than bodies.
function familyBytes(families) {
  return Object.fromEntries(Object.entries(families).map(([name, value]) => [name, bytes(value)]));
}

function sumOf(items, pick) {
  return (items || []).reduce((total, item) => total + bytes(pick(item)), 0);
}

async function collect() {
  const core = profileToolDefinitions("core");
  const full = profileToolDefinitions("full");
  const docsArgs = { launch: gatewayLaunchFixture, paths: pathsFixture, toolProfile: "core" };

  const toolProfiles = [
    { ...measurement("tools/list core", core, CONTEXT_BUDGET_CEILINGS.coreToolsList), toolCount: core.length },
    { ...measurement("tools/list full", full, null), toolCount: full.length }
  ];

  const docs = [measurement("gateway_docs default", buildGatewayDocs(docsArgs).text, CONTEXT_BUDGET_CEILINGS.docsDefault)];
  for (const section of DOCS_SECTIONS) {
    const text = buildGatewayDocs({ ...docsArgs, section }).text;
    docs.push(
      measurement(
        `gateway_docs section=${section}`,
        text,
        section === "full" ? CONTEXT_BUDGET_CEILINGS.docsFullSection : CONTEXT_BUDGET_CEILINGS.docsSection,
        { truncated: text.includes("[truncated") }
      )
    );
  }

  const ambiguity = ambiguousSharedLineFixture();
  const errors = [
    measurement("shared line ambiguity payload", ambiguity.payload, CONTEXT_BUDGET_CEILINGS.ambiguityPayload),
    ...ambiguity.payload.candidates.map((candidate, index) =>
      measurement(`ambiguity candidate[${index}] summaryPreview`, candidate.summaryPreview, CONTEXT_BUDGET_CEILINGS.ambiguityCandidatePreview)
    )
  ];

  const memoryCore = memorySearchCore();
  const memoryDefault = await memoria.searchSummary(memoryCore, { query: "fixture recall" });
  const memoryFull = await memoria.searchSummary(memoryCore, { query: "fixture recall", detail: "full", limit: 3 });
  const memoryResults = memoryDefault.results || [];
  const memory = [
    measurement("memoria_search default", memoryDefault, CONTEXT_BUDGET_CEILINGS.memoriaSearchDefault, {
      resultCount: memoryResults.length,
      bodyBytes: sumOf(memoryResults, (result) => result.bodyPreview),
      metadataBytes: sumOf(memoryResults, ({ bodyPreview: _body, ...rest }) => rest),
      relatedBytes: bytes(memoryDefault.related || null),
      envelopeBytes: bytes({ ...memoryDefault, results: undefined })
    }),
    measurement("memoria_search detail=full", memoryFull, null, {
      resultCount: (memoryFull.results || []).length,
      bodyBytes: sumOf(memoryFull.results, (result) => result.body),
      relatedBytes: bytes(memoryFull.related || null)
    })
  ];

  const storedPacket = sharedLinePacketFixture();
  const resumePacket = shapeSharedLinePacket(storedPacket);
  const contextPacket = shapeSharedLinePacket(storedPacket, "context");
  const fullPacket = shapeSharedLinePacket(storedPacket, "full");
  const sharedLine = [
    measurement("shared_line_get resume", resumePacket, CONTEXT_BUDGET_CEILINGS.sharedLineGetDefault, {
      currentPosition: bytes({
        summary: resumePacket.summary,
        interpretationStatus: resumePacket.interpretationStatus,
        factsUsed: resumePacket.factsUsed,
        nextStep: resumePacket.nextStep,
        updatedAt: resumePacket.updatedAt
      }),
      sharedReality: 0,
      agentState: 0,
      history: 0,
      snapshot: 0,
      arc: 0,
      handoff: bytes(resumePacket.recentHandoff || null),
      text: 0,
      omittedRefs: bytes(resumePacket.omitted)
    }),
    measurement("shared_line_get context", contextPacket, CONTEXT_BUDGET_CEILINGS.sharedLineGetContext, {
      sharedReality: bytes(contextPacket.sharedReality),
      agentState: 0,
      text: 0
    }),
    measurement("shared_line_get full", fullPacket, null, {
      ...familyBytes({
        currentPosition: fullPacket.currentPosition,
        sharedReality: fullPacket.sharedReality,
        agentState: fullPacket.agentState,
        agentStates: fullPacket.agentStates,
        history: fullPacket.history,
        snapshot: fullPacket.snapshots,
        arc: { positionHistory: fullPacket.positionHistory, affectiveTrace: fullPacket.affectiveTrace },
        text: fullPacket.text
      })
    })
  ];

  const storedSnapshot = innerLifeSnapshotLiteFixture();
  const storedBriefing = innerLifeBriefingFixture();
  const statusDefault = shapeInnerLifeStatus(storedSnapshot);
  const statusFull = shapeInnerLifeStatus(storedSnapshot, "full");
  const candidates = shapePendingShares(innerLifeSharesFixture());
  const briefingDefault = shapeInnerLifeBriefing(storedBriefing);
  const briefingFull = shapeInnerLifeBriefing(storedBriefing, "full");
  const innerLife = [
    measurement("innerlife_status default", statusDefault, CONTEXT_BUDGET_CEILINGS.innerlifeStatusDefault, {
      ...familyBytes({
        counts: statusDefault.counts,
        daemon: statusDefault.daemon,
        doctor: statusDefault.doctor,
        workIndicators: statusDefault.work,
        profile: statusDefault.profiles
      }),
      shares: 0,
      inbox: 0
    }),
    measurement("innerlife_status detail=full", statusFull, null, {
      ...familyBytes({
        profile: statusFull.profiles,
        doctor: statusFull.doctor,
        shares: statusFull.pendingShares,
        inbox: statusFull.pendingInbox
      })
    }),
    measurement("innerlife_pending_shares default", candidates, CONTEXT_BUDGET_CEILINGS.innerlifePendingSharesDefault, {
      returned: candidates.returned,
      totalPending: candidates.totalPending,
      previewBytes: sumOf(candidates.shares, (share) => share.preview),
      envelopeBytes: bytes({ ...candidates, shares: undefined })
    }),
    measurement("innerlife_briefing default", briefingDefault, CONTEXT_BUDGET_CEILINGS.innerlifeBriefingDefault, {
      ...familyBytes({
        sharedLine: briefingDefault.sharedLine || null,
        openLoops: briefingDefault.openLoops,
        memories: briefingDefault.recentMemories,
        counts: briefingDefault.counts,
        selectedShare: briefingDefault.selectedShare || null
      }),
      inbox: 0,
      text: 0
    }),
    measurement(
      "innerlife_briefing ambiguous line",
      shapeInnerLifeBriefing(innerLifeBriefingFixture({ ambiguous: true })),
      CONTEXT_BUDGET_CEILINGS.innerlifeBriefingDefault
    ),
    measurement("innerlife_briefing detail=full", briefingFull, null, {
      ...familyBytes({
        memories: briefingFull.recentMemories,
        shares: briefingFull.pendingShares,
        inbox: briefingFull.pendingInbox,
        thoughts: briefingFull.recentThoughts,
        text: briefingFull.text
      })
    })
  ];

  // Compose the aggregate from the same fixtures the domain measurements use.
  const contextService = createGatewayContextService({
    getSharedLine: async () => sharedLinePacketFixture(),
    searchMemories: async (unusedCore, input) => ({ results: memorySearchRows(input.limit) }),
    listMemories: async (unusedCore, input) => memorySearchRows(input.limit),
    getInnerLifeSnapshot: async () => storedSnapshot,
    listInnerLifeInbox: async () => storedSnapshot.pendingInbox,
    listInnerLifeShares: async () => storedSnapshot.pendingShares,
    listInnerLifeThoughts: async () => storedBriefing.recentThoughts,
    now: () => new Date("2026-08-07T01:32:46.786Z")
  });
  const briefWithQuery = await contextService.get({}, { agentId: "fixture-agent", detail: "brief", query: "fixture" });
  const briefNoQuery = await contextService.get({}, { agentId: "fixture-agent", detail: "brief" });
  const aggregate = [
    measurement("gateway_context brief (query)", briefWithQuery, CONTEXT_BUDGET_CEILINGS.gatewayContextBrief),
    measurement("gateway_context brief (no query)", briefNoQuery, CONTEXT_BUDGET_CEILINGS.gatewayContextBrief),
    measurement("gateway_context full", await contextService.get({}, { agentId: "fixture-agent", detail: "full" }), null)
  ];

  // Automatic context: what was offered, what was selected, and what a host
  // would actually deliver. "delivered" is the arbiter's block, not a claim
  // that any host injected it.
  const autoMemoryCandidate = {
    id: "mem_auto_fixture",
    agentId: "fixture-agent",
    action: "INJECT_TOP1",
    policyMode: "canary",
    stateRole: "current",
    sensitivity: "normal",
    relevance: 0.9,
    context: memoryResults[0]?.bodyPreview || ""
  };
  const autoShareCandidate = {
    id: "inner_share_auto_fixture",
    agentId: "fixture-agent",
    status: "pending",
    selected: true,
    relevance: 0.8,
    preview: candidates.shares[0]?.preview || ""
  };
  const arbitrated = arbitrateAutomaticContext({
    agentId: "fixture-agent",
    memoryCandidates: [autoMemoryCandidate],
    shareCandidates: [autoShareCandidate]
  });
  const abstained = arbitrateAutomaticContext({ agentId: "fixture-agent" });
  const automatic = [
    measurement("automatic candidates offered", [autoMemoryCandidate, autoShareCandidate], null, {
      candidateCount: 2,
      memoryBytes: bytes(autoMemoryCandidate),
      shareBytes: bytes(autoShareCandidate)
    }),
    measurement("automatic selected", arbitrated.selected, null, {
      domain: arbitrated.selected?.domain || "",
      suppressed: (arbitrated.suppressed || []).length
    }),
    measurement("automatic delivered block", arbitrated.block, CONTEXT_BUDGET_CEILINGS.automaticContextHardLimitBytes, {
      truncated: arbitrated.block?.truncated || false,
      targetBytes: CONTEXT_BUDGET_CEILINGS.automaticContextTargetTokens * BYTES_PER_TOKEN_ESTIMATE
    }),
    measurement("automatic abstain payload", abstained, CONTEXT_BUDGET_CEILINGS.automaticContextHardLimitBytes, {
      decision: abstained.decision
    })
  ];

  const groups = { toolProfiles, docs, errors, memory, sharedLine, innerLife, aggregate, automatic };
  const all = [
    ...toolProfiles,
    ...docs,
    ...errors,
    ...memory,
    ...sharedLine,
    ...innerLife,
    ...aggregate,
    ...automatic
  ];
  return {
    generatedAt: new Date().toISOString(),
    bytesPerTokenEstimate: BYTES_PER_TOKEN_ESTIMATE,
    ceilings: CONTEXT_BUDGET_CEILINGS,
    groups,
    failures: all.filter((entry) => entry.withinCeiling === false).map((entry) => entry.name)
  };
}

function printHuman(report) {
  for (const [group, entries] of Object.entries(report.groups)) {
    process.stdout.write(`\n${group}\n`);
    for (const entry of entries) {
      const ceiling = entry.ceiling == null ? "-" : String(entry.ceiling);
      const mark = entry.withinCeiling === false ? "FAIL" : entry.withinCeiling === true ? "ok" : "    ";
      const count = entry.toolCount == null ? "" : ` (${entry.toolCount} tools)`;
      process.stdout.write(
        `  ${mark}  ${entry.name.padEnd(34)} ${String(entry.bytes).padStart(6)} B  ~${String(entry.tokenEstimate).padStart(5)} tok  ceiling ${ceiling}${count}\n`
      );
    }
  }
  process.stdout.write(
    report.failures.length ? `\nover ceiling: ${report.failures.join(", ")}\n` : "\nall measured default surfaces are within ceiling\n"
  );
}

if (require.main === module) {
  collect()
    .then((report) => {
      if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      else printHuman(report);
      process.exit(report.failures.length ? 1 : 0);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message || error}\n`);
      process.exit(1);
    });
}

module.exports = { collect };
