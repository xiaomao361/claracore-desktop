# ClaraCore Context Delivery

## Product Principle

ClaraCore preserves a rich shared world without placing that whole world into
every Agent turn.

The delivery contract is:

> Minimum sufficient by default. Disclose more through explicit scope.
> Explicit reads remain bounded.

In Chinese:

> 默认最小充分，按明确范围逐层展开；显式请求仍然有界。

This is progressive disclosure, not austerity. A byte ceiling is a regression
guardrail, not a content target. Defaults must retain enough identity, state,
and preview to make the next choice confidently; explicit catalog pages may
request up to 50 items. One explicitly selected object should remain
semantically complete whenever it fits the final safety ceiling, rather than
being shortened merely to make every response look equally small.

Storage richness is not delivery richness. Memory bodies, Shared Line history,
InnerLife activity, traces, and diagnostic metadata may remain complete in the
product store while ordinary Agent reads return only what is needed for the
next safe decision.

## Agent-Facing Field Naming

Fields that describe the same concept across Agent-facing tools must use the
same name. Shape them at the Gateway boundary rather than renaming repository
or renderer read models.

Short names remain appropriate when sibling parent keys already disambiguate
their meaning. For example, `configuration.gateway.enabled` and
`configuration.backup.enabled` are distinct without repeating their parent
names. When independent booleans appear in the same object or the same concept
crosses tools, use explicit stable names such as `profileEnabled`,
`loopEnabled`, and `isCurrent`.

Boolean names must describe the state that is actually true. Text shortened
at a byte boundary may use `truncated`; a whole object replaced by a preview
uses `previewOnly`, while a failed JSON conversion uses
`serializationFailed`.

## Why This Belongs To ClaraCore

ClaraCore maintains the private world shared by Clara and the user. That world
grows over time. Returning all stored material by default would make growth
indistinguishable from noise, latency, token cost, and accidental disclosure.

Progressive delivery protects four product qualities:

- **continuity**: the current position remains legible instead of being buried
  under its history;
- **attention**: the Agent receives the evidence needed for this decision, not
  every adjacent record;
- **privacy**: unrelated private material does not enter a conversation merely
  because it is stored nearby;
- **performance**: product growth does not make ordinary entry and recall grow
  without bound.

## Canonical Read Levels

### Catalog

A catalog answers “which object should I inspect?” It returns bounded identity,
status, preview, timestamps, pagination truth, and a detail reference. It never
returns full bodies, raw metadata, histories, traces, or parallel text copies.

### Resume or Summary

A resume answers “what is the minimum state needed to continue safely?” It is
the default for a selected object. It contains the current conclusion, state,
next step, evidence references, and enough identity to avoid guessing.

### Context

Context adds bounded supporting material for one explicitly selected object.
It does not turn a catalog into a bulk full-record read.

### Full Detail

Full detail is an explicit inspection of one object or one bounded diagnostic
range. `detail=full` never means “return every full object in this list.” Very
large single objects must page, chunk, or produce an artifact reference.

## Write And Export Contracts

A write returns a bounded acknowledgement: target id, resulting state,
timestamp/version, a short summary when needed, and a detail reference. Writing
one relationship or state change must not automatically rehydrate every
affected entity.

Exports, backups, and large diagnostic captures return an artifact path or
resource reference with size, digest, and a bounded summary. They do not embed
the exported data in an MCP text response.

## Domain Application

| Domain | Default | Explicit expansion |
| --- | --- | --- |
| Memoria | bounded search/list previews | `memoria_get(id)` for one Memory |
| Continuity | bounded line catalog and one resume packet | `shared_line_get(lineId, detail=context/full)` |
| InnerLife | operational counts and bounded candidate previews | `innerlife_share_check` for one waiting thought |
| Gateway | one bounded orientation packet | explicit bounded diagnostic detail |
| Trace and logs | recent summaries and ids | one trace/detail read or an artifact |

## Server Responsibilities

The Agent states intent; the server enforces delivery shape. Correctness must
not depend on a prompt reminding every Agent to pass `brief`, choose a small
limit, or avoid a full catalog.

Every ordinary Agent-facing surface must therefore provide:

- a safe default when detail is omitted;
- server-side field projection, not full hydration followed by response-only
  trimming;
- bounded fields and bounded result counts;
- truthful `returned`, `total`, `hasMore`, and page/cursor information;
- a `detailRef` for intentionally omitted material;
- a maintained UTF-8 byte ceiling with adversarial fixtures;
- a structured over-budget refusal or next read, never malformed JSON or
  silent truncation.

Configuration status follows the same minimum-disclosure rule. Secret status
may say configured and may identify an `env:VARIABLE` reference, but an inline
credential is represented only as `inline`; it is never returned or masked in
a way that preserves credential material. Connection identity is request
context, so it must be reported separately from stored Gateway defaults.

## Exceptions

Small does not mean incomplete or unverifiable.

- Ambiguity errors may include a few bounded candidates so the caller can
  recover without guessing.
- Destructive or overwrite acknowledgements must identify the exact affected
  object and resulting state.
- A single explicitly selected object may return richer evidence, subject to
  its own field and response bounds. Those bounds protect transport and
  privacy; they must not erase the evidence needed to understand that object.
- Desktop UI and internal workflows may use richer read models, but their IPC
  and view snapshots still page and lazy-load. MCP defaults remain independent
  from renderer convenience.

## Acceptance Rule

A new list, aggregate, write acknowledgement, or diagnostic read is incomplete
until its default projection, expansion path, pagination truth, and byte budget
are tested. A schema description that merely asks an Agent to be restrained is
not an implementation of this contract.
