# ClaraCore Desktop v0.6.10 Release Notes

Date: 2026-08-13

Status: public stable release. The complete macOS Apple Silicon and Windows
x64 Full/Lite matrix has passed its release contract.

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

Published artifact evidence:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ClaraCore-Desktop-0.6.10-arm64.dmg` | 207,783,510 | `2fe9a7cbcb4c0fdb4edb87b8e7260ac84dfaed7196e79e383ba9df3ac7c21e8f` |
| `ClaraCore-Desktop-0.6.10-lite-arm64.dmg` | 126,733,390 | `f3c9f45b8e22853faf020900168e3c4471248fa2f0838cc6be1f6173dba7ecef` |
| `ClaraCore-Desktop-0.6.10-x64-Setup.exe` | 178,738,928 | `a35a357946c2bcc97ee850963b008508707df0e670ba4b4fc1245f1ff60a8e9e` |
| `ClaraCore-Desktop-0.6.10-lite-x64-Setup.exe` | 108,734,470 | `c9178692e1da2b606c7b3d116685dcd345f853301361d118ee9ceefeac8cef59` |

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

Release acceptance covers both macOS Apps and DMGs with Developer ID signing,
Apple notarization, stapling, Gatekeeper assessment, DMG integrity, Full/Lite
package boundaries, and isolated packaged-Gateway workflows. Apple accepted
the Full App/DMG submissions `ad677a98-248e-4e65-9c36-562b2e10ae77` and
`448ef4fe-3e61-4c77-acbc-5a0670f3c68c`, plus the Lite App/DMG submissions
`4e2921a2-4c57-4398-a8b5-3589b7cfc179` and
`82ce2a41-d52e-4b7e-98d5-0217bf009cb6`.

Windows release workflow
[`31687116961`](https://github.com/xiaomao361/claracore-desktop/actions/runs/31687116961)
passed source checks, both installer builds, packaged Full embedding, package
boundaries, portable LF checksum generation, and release upload. All six
GitHub assets were downloaded again before publication; both checksum files
passed `shasum -a 256 -c`, and the downloaded sizes and hashes matched GitHub's
asset metadata.
