# ClaraCore Desktop v0.6.7 Release Notes

## Status

`v0.6.7` is the current public release. It contains a Developer ID signed,
Apple-notarized, and stapled macOS Apple Silicon Lite DMG plus its SHA-256
checksum. Full, Windows, Intel macOS, and Mac App Store packages are not part of
this release.

## Assets

- `ClaraCore-Desktop-0.6.7-lite-arm64.dmg`
- `SHA256SUMS.txt`
- SHA-256: `abe1bd0adc3edf8259cd31bec254e5db6d4ecf441b4ac83a9a7f21fb82a9dc86`

## Why This Is Not 0.6.6

`0.6.6` was never published, so it kept moving while the context-budget work
landed. This release stops that: it **removes a capability** that a 0.6.6 build
had, which is a contract change rather than a fix.

Four distinct builds all reported `0.6.6` — before turn context, with turn
context, with the follow-up fixes, and this one. The DMG filenames were
suffixed with their commit, but a running app reports only its version string
through `claracore_connection_test`, `serverInfo.version`, and the UI. One
string for four behaviours is not diagnosable, and Codex and Hermes are adapting
against this contract now and need a version they can name.

## Change

**`gateway_auto_context` no longer delivers InnerLife shares.** Automatic
context is Memory only. Waiting thoughts are reached through
`innerlife_share_check`.

This is a product decision, not a missing feature.

### Why

Topical relevance was the wrong gate. A waiting thought does not have to be
about the current topic — an off-topic engineering thought during engineering
work is fine. What makes a share wrong is the **register**: that same thought
dropped into an intimate conversation. A server can match topics; it cannot read
register. So the model owns the decision, and the per-prompt hook carries only
the pending **count**, which says something is waiting without deciding to say
it.

The measurement that settled it: asked in Chinese about a rendering problem, the
lexical scorer ranked three unrelated Chinese shares at 0.18 above the English
share that actually matched, which scored 0. Chinese bigrams tie on function
words, and cross-language overlap is structurally zero while roughly half the
corpus is in the other language from any given question. The preceding threshold
work had been calibrated against six hand-built cases; against real data nothing
cleared even the lowered floor, and the top result was usually wrong.

The Memory Controller earned automatic injection by having embeddings and a
measured 0.72 vector gate. InnerLife has neither. If shares ever get embeddings
this can be revisited — but topic matching would still be the wrong gate.

### What changed in the contract

- `domainStatus.innerlife` is now always `"not_collected"`. That is deliberately
  neither `"skipped"` nor `"error"`: nothing failed and nothing was quiet, the
  domain is simply not on this path.
- An abstain with no Memory candidate stays a plain `no_eligible_candidate`
  rather than a degraded one.
- The arbiter is unchanged and still ranks **host-supplied** share candidates on
  the compatibility path, so a host that wants to do its own selection can.
- `core/innerlife/relevance.js` is removed rather than left unused.

Clients should detect capability through `domainStatus`, not through the version
string. See `docs/MULTI_AGENT_CLIENTS.md`.

## Also In This Release

**Three tools moved from `full` into `core`.** The core profile was originally
picked by asking whether a tool sounded like maintenance, which put
`memoria_supersede` in `full` — while the first-party Agent instructions name it
as the everyday remedy for a stale fact. `memoria_link_create` was in `core`
without `memoria_link_list`, so the profile could write links it could not read,
and `memoria_record_create` had no `memoria_record_list`.

This failed silently. Nothing broke until a closeout actually needed to
supersede a record and the tool was not there; the workaround was
`memoria_update` plus an `evolved-from` link, which preserves history but leaves
the old record `active` instead of `historical`.

`core` is now 29 tools at 13,065 bytes against a ceiling raised from 12 KB to
14 KB. Descriptions were compressed first, recovering about 490 bytes; going
further would have meant deleting the "when not to use this" clauses that stop
misuse. Spending 2 KB beats making every description shallower. `core` remains
31.7% of the full manifest and 65% below the 37,130-byte 0.6.5 baseline.

`context-budget-smoke` now asserts workflow completeness: if `core` advertises
one half of a pair it must advertise the other. Verified to actually fail by
removing `memoria_supersede` and watching it go red.

## Verification

Source: `npm run check`, `npm run test:turn-context`, `npm run test:phase1`
through `test:phase5`, `npm run test:gateway:http`,
`npm run test:memory-controller`, `npm run test:smoke`, `git diff --check`.

Package: `npm run test:lite`, `npm run test:package:lite`, and
`core/tests/phase4-packaged-gateway-smoke.js` driven against the Lite build.

Release acceptance completed on 2026-08-10:

- the App and DMG signatures pass `codesign` verification with Hardened Runtime;
- Apple accepted App submission `c7c709da-e41f-46c9-bcd7-99ec3823cc42` and DMG
  submission `538d2a10-a2bb-45a4-af54-7c1f9254c95c`;
- App and DMG stapler validation and Gatekeeper assessment pass as
  `Notarized Developer ID`;
- `hdiutil verify`, `npm run test:package:lite`, and the packaged Gateway smoke
  pass against the final artifact, which reports version `0.6.7`;
- the published DMG and `SHA256SUMS.txt` were downloaded from GitHub and their
  checksum was reverified after publication.
