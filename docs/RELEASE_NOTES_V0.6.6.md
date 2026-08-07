# ClaraCore Desktop v0.6.6 Release Notes

## Status

`v0.6.6` is a **source checkpoint only**. The version in `package.json` and
`package-lock.json` is `0.6.6`, and the full source suite passes. Packaging,
installation, signing, notarization, tagging, and publication have not been
performed and are separate acceptance layers. Passing source tests does not
prove the installed app, the signed package, the release asset, or a real host
integration.

## Theme

v0.6.6 makes ClaraCore Desktop a more selective Agent context layer. Storage
richness is not delivery richness: stored history, profile, affective trace, and
diagnostic metadata remain complete, while default Agent reads answer only the
next decision. Every field removed from a default read is recoverable through a
named explicit call.

No data is deleted or compacted to reduce context, and no database migration is
required for the context shaping itself.

## Measured Result

| Surface | Before | After | Ceiling |
| --- | ---: | ---: | ---: |
| `tools/list` default | 37,130 B / 84 tools | 12,049 B / 26 tools | 12,288 B |
| `gateway_docs` default | 23,961 B | 1,535 B | 4,096 B |
| Shared Line ambiguity refusal | 5,526 B | 3,413 B | 4,096 B |
| `memoria_search` default | 9,535 B | 3,929 B | 6,144 B |
| `shared_line_get` default | 7,694 B | 3,017 B | 4,096 B |
| `innerlife_status` default | 20,620 B | 2,350 B | 3,072 B |
| `innerlife_pending_shares` default | 4,651 B | 1,521 B | 3,072 B |
| `innerlife_briefing` default | 30,564 B | 2,859 B | 6,144 B |
| `gateway_context(detail=brief)` | 16,509 B | 7,798 B | 8,192 B |

Fixed per-connection overhead (`tools/list` + `gateway_docs`) drops from about
61 KB to about 13.6 KB. Track B "after" figures are measured against
deterministic worst-case fixtures rather than live data, so they are comparable
in order of magnitude, not to the byte.

Reproduce with `npm run baseline:context-budget`. The ceilings are enforced by
`npm run test:context-budget`, which runs inside `npm run check`.

## Highlights

### Tool profiles

`tools/list` is now served from a maintained profile. `core` is the default and
carries the normal connection, recall, continuation, and sharing surface.
`full` preserves every existing tool name and schema and is selected with
`X-ClaraCore-Tool-Profile: full` (HTTP) or `CLARACORE_TOOL_PROFILE=full`
(stdio). An unknown or missing value resolves to `core`; an invalid profile
never broadens the surface.

Gateway tool input is not schema-validated, so `core` narrows what is
*advertised*, not what is *authorized*: every tool still executes when called by
name under either profile.

### Progressive documentation

`gateway_docs` returns a bounded summary plus a section index by default, with
`start`, `memory`, `shared-line`, `innerlife`, `diagnostics`, and `full`
sections. It no longer restates the tool manifest — 13.3 KB of the old payload
was a verbatim second copy of every tool description already in `tools/list`.
It is also no longer a mandatory startup read.

### Bounded refusals

An ambiguous Shared Line selection returns at most five candidates with bounded
previews, the true total count, and an explicit catalog reference. Both
transports now also carry the structured refusal in JSON-RPC `error.data`.

### Summary-first Memory

`memoria_search` returns three bounded summaries by default instead of up to
fifty full records, with embedding operational metadata and related records
behind explicit detail. `memoria_get` remains the full-record path, and current,
historical, restricted, superseded, and same-Agent semantics are unchanged.

### Shared Line resume packets

`shared_line_get` and the Shared Line write acknowledgements return a `resume`
packet by default, with `context` and `full` as named escalations. Agent-level
Continuity state is no longer repeated in every line read; load it once per
session with `shared_line_agent_state`. Removing it from a default read never
deletes or mutates it.

### Selective InnerLife

`innerlife_status`, `innerlife_pending_shares`, and `innerlife_briefing` now
answer three different questions instead of all three at once. The briefing is a
decision synthesis and drops any thought body that duplicates a share body.
Reading candidates still marks nothing: delivery and use remain separate states
that require evidence.

### One automatic winner

`gateway_auto_context` arbitrates automatic per-prompt injection. Memory and
InnerLife candidates compete for one bounded delivery slot with a 600-token
target and a 900-token hard limit, and the arbiter selects one winner or
abstains. It records every discard reason and never claims delivery or use.

**Host hooks are not updated by this release.** The Codex, Claude, and Hermes
hooks live outside this repository and must be pointed at
`gateway_auto_context`; until they are, live turn behavior is unchanged.

## Compatibility

- No database migration is required for context shaping.
- Stored Memory, Shared Line, Agent state, model adjustment, and InnerLife data
  are unchanged.
- Clients depending on the previous default payloads must select the `full`
  profile or pass the explicit detail argument. See
  `docs/MULTI_AGENT_CLIENTS.md` for the per-tool mapping.
- Identity, same-Agent canary filtering, sensitivity, time view, ambiguity
  refusal, delivery evidence, and read-only behavior remain fail-closed.

## Also In This Release

- The InnerLife daemon default loop moves from 900 s to 3600 s, with migration
  `006_innerlife_hourly_default` updating existing installs that still hold the
  old default.
- Fixed: `nextStep` was the one unbounded field in the Shared Line packet.
- Fixed: `phase4-gateway-trace-ui-smoke` did not pin the InnerLife provider, so
  it depended on live model output and was flaky.

## Verification

`npm run check`, `npm run test:context-budget`, `npm run test:gateway:http`,
`npm run test:agent-access`, `npm run test:phase2` through `test:phase5`,
`npm run test:memory-controller`, `npm run test:smoke`, and
`git diff --check` all pass on the source tree.

Package, installed-runtime, signing, notarization, and publication verification
are not part of this checkpoint.
