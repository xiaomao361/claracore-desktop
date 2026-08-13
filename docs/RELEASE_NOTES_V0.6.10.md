# ClaraCore Desktop v0.6.10 Release Notes

Date: 2026-08-13

Status: release candidate. Source acceptance and a local Lite tester package
have passed; public status requires the complete signed/notarized macOS and
verified Windows asset matrix. Until then, the current public release remains
v0.6.9.

## Release Assets

The public release is complete only when all six files are present:

- `ClaraCore-Desktop-0.6.10-arm64.dmg` — macOS Full, Developer ID signed,
  Apple-notarized, and stapled
- `ClaraCore-Desktop-0.6.10-lite-arm64.dmg` — macOS Lite, Developer ID signed,
  Apple-notarized, and stapled
- `ClaraCore-Desktop-0.6.10-x64-Setup.exe` — Windows Full
- `ClaraCore-Desktop-0.6.10-lite-x64-Setup.exe` — Windows Lite
- `SHA256SUMS-macos.txt`
- `SHA256SUMS-windows.txt`

## Product Direction

v0.6.10 establishes one context-delivery contract across Memory, Continuity,
InnerLife, Gateway, and diagnostics:

> Minimum sufficient by default. Disclose more through explicit scope.
> Explicit reads remain bounded.

Rich stored state remains intact. Ordinary Agent calls receive only the
catalog, resume, acknowledgement, or diagnostic summary needed for the next
safe decision.

## Agent Contract Changes

- `gateway_context` now defaults to `brief` when `detail` is omitted.
- `shared_line_list` uses a paged SQL summary projection and no longer returns
  full position history, affective trace, or raw position metadata.
- Memory, Memory-link, and structured-record lists return bounded catalogs.
  `memoria_get` and the new `memoria_record_get` expand one object.
- Memory and structured-record writes return bounded acknowledgements with a
  `detailRef` instead of echoing stored bodies or values.
- InnerLife pending shares, profiles, sessions, histories, experiences,
  summaries, and share actions use summary projections by default. Explicit
  full reads remain capped.
- General catalogs default to 10 rows and remain explicitly pageable to 50;
  byte ceilings are transport guardrails rather than a universal truncation
  target.
- `innerlife_share_check` returns one selected share plus compact timing and
  operational evidence instead of repeating the pending-share snapshot.
- Security fix: Agent-facing `claracore_status` never returns inline API keys;
  it exposes only configured status and `env:VARIABLE`, `inline`, or empty
  source classification. The trusted local Settings renderer keeps its
  existing secret-preservation path.
- `claracore_status.connection` now reports the authenticated request identity,
  while stored Gateway defaults use explicit configured/default names.
- All Agent-facing InnerLife profile reads and writes use `profileEnabled`;
  `innerlife_status` keeps the independent daemon scheduler state at
  `loopEnabled`, including explicit full reads.
- Agent-facing Shared Line descriptors rename ambiguous `active` to
  `isCurrent`. Lifecycle remains in `status`; `isCurrent` identifies only the
  globally selected fallback line.
- Gateway traces list summaries without request JSON; `gateway_trace_get`
  opens one trace. Trace detail distinguishes shortened text (`truncated`), a
  whole-request bounded preview (`previewOnly`), and request serialization
  failure (`serializationFailed`).
- Both MCP transports enforce a 128 KiB final serialized-result ceiling and
  return `GATEWAY_RESPONSE_TOO_LARGE` with a narrowing instruction.

## Documentation

- `docs/CONTEXT_DELIVERY.md` is the canonical product and engineering contract.
- Positioning and UI design language connect progressive disclosure to the
  shared-world north star and the existing understand-view-verify hierarchy.
- The Agent MCP Playbook, Multi-Agent Clients guide, Gateway module guide, and
  runtime policy describe the new defaults and expansion paths.
- Completed context-budget plans, performance checkpoints, old release notes,
  and one-off handoffs have moved to `docs/archive/`; the active docs index no
  longer presents them as current instructions.

## Human Inspection Polish

- Memoria keeps the landing page bounded to six records and moves real paging
  into the full library reader. Background refreshes no longer reset the
  effective next-page offset.
- Memoria, Shared Line, and InnerLife use one Agent-scope bar and stable
  `agentId` labels. InnerLife no longer renders duplicated labels such as
  `Codex · codex`.
- Dialog close actions use one trailing placement and icon treatment. Thought
  cards reserve a separate footer for the full-reader action, and Agent Access
  keeps guide copy and version evidence in a non-overlapping vertical flow.

## Upgrade Notes

- Existing product data, Memoria, Shared Lines, InnerLife records, Agent
  identities, Gateway token, and provider settings remain in place.
- Restart Desktop and reconnect each Agent after upgrading so its MCP schema
  and versioned `gateway_docs` contract refresh.
- Agent clients that parsed raw response fields must adopt the names and
  catalog/detail split above. In particular, `gateway_context` no longer
  defaults to the historical full payload.
- Lite continues to exclude the bundled embedding runtime; Full retains it.
- Windows installers remain unsigned. Windows CI validates package boundaries
  and a real packaged Full embedding, but real-device installation acceptance
  remains a separate layer.

## Validation Contract

The context-budget suite now measures default Shared Line, Memory-link, and
structured-record catalogs, light mutation acknowledgements, omitted-detail
Gateway context, and the oversize-response refusal. Repository-boundary tests
also lock the dedicated summary read paths so future handlers do not regress
to full hydration followed by response trimming.

Local acceptance additionally covers the ad-hoc-signed arm64 Lite App and DMG,
the Lite flavor boundary, DMG integrity, and a packaged Gateway workflow. The
release matrix separately requires Developer ID signing, Apple notarization,
stapling, Gatekeeper assessment, Full/Lite package checks, packaged Gateway
verification, Windows packaged Full embedding, and published checksum parity.
