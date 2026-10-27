// Default-surface byte ceilings maintained by docs/CONTEXT_DELIVERY.md.
// They bound DEFAULT reads only. Full-profile manifests, explicit detail reads,
// and diagnostic payloads are measured and reported but never share these
// ceilings; storage richness is not delivery richness.
//
// Track A ceilings are enforced from v0.6.6 Phase 1. Track B ceilings are
// recorded here so later phases have a single source of truth, and are marked
// pending until the phase that implements them lands.
const CONTEXT_BUDGET_CEILINGS = Object.freeze({
  // Track A: MCP interface context. The 2026-10-22 daily catalog keeps
  // complete workflows in 25 tools; core-compat measures the old 38 separately.
  // Byte ceilings are regression guards, not targets for semantic compression.
  coreToolsList: 14 * 1024,
  coreToolCount: 25,
  docsDefault: 4 * 1024,
  docsSection: 8 * 1024,
  // `full` concatenates every section, so it is bounded as the sum rather than
  // as one more independent section.
  // v0.8.0 includes the new Knowledge section in explicit full-guide reads.
  // Includes the explicit cross-domain workflow and authority/recovery limits.
  docsFullSection: 22 * 1024, // Explicit full guide includes diagnostic/recovery contracts; default/section ceilings stay unchanged.
  ambiguityPayload: 4 * 1024,
  ambiguityCandidatePreview: 240,
  ambiguityCandidateLimit: 5,

  // Track B: everyday product context (enforced by later phases)
  memoriaSearchDefault: 6 * 1024,
  sharedLineListDefault: 16 * 1024,
  memoriaLinkListDefault: 16 * 1024,
  memoriaRecordListDefault: 16 * 1024,
  mutationAckDefault: 2 * 1024,
  sharedLineGetDefault: 4 * 1024,
  // detail=context is an explicit escalation, not the default read, so it gets
  // its own bound rather than forcing Shared Reality to be cut to fit 4 KB.
  sharedLineGetContext: 6 * 1024,
  innerlifeStatusDefault: 3 * 1024,
  innerlifePendingSharesDefault: 6 * 1024, // General catalog now defaults to ten identifiable previews.
  innerlifeShareCheckDefault: 6 * 1024,
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
