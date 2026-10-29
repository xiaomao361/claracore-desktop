# Agent experience: historical 1.0.6 local test baseline

> This records the October 27 test, not the final public package. See the
> [1.0.6 release record](RELEASE_1.0.6.md) for current delivery status.

2026-10-27: implementation is paused for field testing. This is an unsigned,
unnotarized macOS Apple Silicon Lite build, not a public release. At that test checkpoint, public stable was 1.0.3. Sign and notarize the final release after acceptance.

## Delivered artifact

- File: `dist-lite/test-1.0.6-unsigned-20261027173556/ClaraCore-Desktop-1.0.6-lite-arm64.dmg`
- Size: 121.2 MiB.
- SHA-256: `2b76b70bdffcf3abadd69a61357779c8003ae699443e07fd5de0f3b208006988`.
- The same directory contains `validation-receipt.json`, `source-hashes.json`,
  and `SHA256SUMS.txt`.
- Six relevant packaged source files still match the source at closeout.
  No application code changed after packaging; later changes are documentation
  and the separate personal hook repository.

## Behavior under test

- Agent-filtered line catalogs and ambiguity hints use the same order.
  `isGlobalFallback` describes a global pointer; legacy `isCurrent` does not
  establish a session selection. Other sessions can change the global pointer.
  A restart persistence defect was not established.
- Line search matches literal text in titles, the latest position, and next
  steps. Paging and clipped-field references remain explicit.
- Automatic context defaults to a compact delivery envelope. Stored Memory
  decision diagnostics can be read without another recall or model request.
- Line writes return a persistence receipt. Invalid presentation arguments are
  rejected before mutations.
- Repeated session start reuses the session and returns a current briefing;
  the original saved opening snapshot remains historical. Startup has one
  share recommendation. Consumed/retired share thoughts are excluded from
  summary open loops. Live pending totals differ from bounded preview counts.

The personal `tools/creflex` repository is a separate delivery, committed at
`0f2c890df0c8d57080fb49229f4c77863bc1e678`. It has no configured remote.
Its home-directory exclusions are explicit local configuration, not a Desktop
rule that automatically hides every cwd-mapped project. Opening candidates
show next steps and interpretation status; missing state stays `null`. Notes
identify excluded titles and IDs. Legacy briefings are refreshed, counts have
no ten-minute cache, and refresh failures remain unavailable. Compact injects
no share recommendation. These hook changes do not require rebuilding the app.

## Verified evidence

- `git diff --check` and the full `npm run check` passed for application source.
- Focused Phase 4 Gateway contract and Phase 5 InnerLife checks passed.
- Source and packaged Agent experience checks passed with Node and CLI SQLite,
  including repeated sessions, consumed-share suppression, pending totals
  changing from 10 to 9 to 0, and distinct preview counts.
- Hook startup/compact tests passed in 21 isolated scenarios; per-turn count
  and older Desktop compatibility checks passed. Tests use isolated fixtures.
- Lite resources, six packaged source hashes, DMG integrity, and a read-only
  mounted ASAR comparison passed. Validation services ended and the mount was
  detached. The daily installed application was not replaced or restarted.

## Field checks still pending

1. At the home directory, inspect the four retained candidate lines, their
   next steps/statuses, and the reasons/identities of excluded candidates.
2. After actually using a share, compact the same conversation. Confirm a
   fresh `generatedAt`, current pending count, and no repeated consumed share.
3. In concurrent sessions, check that the global pointer is not interpreted
   as the current conversation's selection.
4. Observe relevance, noise, and perceived latency during ordinary use.

These are user acceptance checks, not completed claims. Continue from concrete
field feedback. Structured topic/register tags and a broader `continuity_open`
tool remain deferred; this baseline does not implement either feature.
