# ClaraCore Desktop v0.6.7 Release Notes

## Status

`v0.6.7` is a **source checkpoint with a verified local Lite package**, not a
public release. No tag, no GitHub Release, no signing or notarization. `v0.6.5`
remains the newest signed, notarized public release.

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

## Verification

Source: `npm run check`, `npm run test:turn-context`, `npm run test:phase1`
through `test:phase5`, `npm run test:gateway:http`,
`npm run test:memory-controller`, `npm run test:smoke`, `git diff --check`.

Package: `npm run test:lite`, `npm run test:package:lite`, and
`core/tests/phase4-packaged-gateway-smoke.js` driven against the Lite build.

Signing, notarization, and publication are separate and were not performed.
