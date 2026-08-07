// v0.6.6 default-surface byte ceilings.
//
// These are the acceptance numbers from docs/V0.6.6_CONTEXT_BUDGET_PLAN.md.
// They bound DEFAULT reads only. Full-profile manifests, explicit detail reads,
// and diagnostic payloads are measured and reported but never share these
// ceilings; storage richness is not delivery richness.
//
// Track A ceilings are enforced from v0.6.6 Phase 1. Track B ceilings are
// recorded here so later phases have a single source of truth, and are marked
// pending until the phase that implements them lands.
const CONTEXT_BUDGET_CEILINGS = Object.freeze({
  // Track A: MCP interface context
  coreToolsList: 12 * 1024,
  coreToolCount: 26,
  docsDefault: 4 * 1024,
  docsSection: 8 * 1024,
  // `full` concatenates every section, so it is bounded as the sum rather than
  // as one more independent section.
  docsFullSection: 12 * 1024,
  ambiguityPayload: 4 * 1024,
  ambiguityCandidatePreview: 240,
  ambiguityCandidateLimit: 5,

  // Track B: everyday product context (enforced by later phases)
  memoriaSearchDefault: 6 * 1024,
  sharedLineGetDefault: 4 * 1024,
  // detail=context is an explicit escalation, not the default read, so it gets
  // its own bound rather than forcing Shared Reality to be cut to fit 4 KB.
  sharedLineGetContext: 6 * 1024,
  innerlifeStatusDefault: 3 * 1024,
  innerlifePendingSharesDefault: 3 * 1024,
  innerlifeBriefingDefault: 6 * 1024,
  gatewayContextBrief: 8 * 1024,
  // innerlife_session_start is what a host hook injects at the top of every
  // session: one briefing plus one Shared Line resume packet.
  sessionStartInjection: 10 * 1024,
  // The plan listed a 5 KB stretch target. Dropped by decision on 2026-08-07:
  // brief sits at ~7.8 KB, and the remaining headroom could only come out of
  // the Shared Line resume packet or the Memory previews, which is a usability
  // cost for no budget problem. 8 KB is the enforced contract.
  gatewayContextBriefStretch: null,
  automaticContextHardLimitTokens: 900,
  automaticContextTargetTokens: 600,
  automaticContextHardLimitBytes: 900 * 4
});

module.exports = { CONTEXT_BUDGET_CEILINGS };
