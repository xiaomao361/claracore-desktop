# Context delivery

ClaraCore preserves rich source state while delivering minimum-sufficient
context by default. Callers can request more through explicit scope; even
explicit reads remain bounded.

## Server contract

Catalogs answer which object to inspect. They return identity, status, enough
preview to choose, truthful pagination, and detail references. General catalogs
default to 10 and allow explicit pages up to 50. A write returns a bounded
acknowledgement rather than another copy of the full saved body.

Shared Line packets/catalogs and Memory acknowledgements/catalogs identify
clipped key fields with `truncatedFields`; follow `detailRef` for the stored
object. An InnerLife briefing also marks a clipped current-line summary.
Shared Line updates return `persisted: true` and `receipt` with the exact
target and read-back call after saving. Invalid detail is rejected before
writing. A missing response leaves the write outcome uncertain: read the exact
target before retrying. These receipts do not make updates idempotent.

An explicitly selected object should remain semantically complete when it fits
the safety ceiling. Byte budgets are regression guardrails, not targets for
shortening every result. Projection and pagination must be enforced by the
server, not left to an agent's prompt discipline.

| Entry | Default | Expand with |
| --- | --- | --- |
| Memory search | Up to 3 bounded summaries | `memoria_get(id)` or explicit detail. |
| Memory catalogs | Paged identity/status summaries | Read the selected memory. |
| Shared Line get | Resume packet: position, facts used, next step | `detail: context` or bounded `detail: full`. |
| Shared Line catalog | Paged summaries | Exact `lineId`. |
| InnerLife status | Operational state and counts | A section or exact record read. |
| Knowledge search | Section previews and source pointers | Read the selected reference. |
| Trace catalog | Bounded summaries | Exact trace read. |

The five ambiguity candidates are recovery hints, not the whole catalog.
Session startup bundles a default ten-row catalog with next steps and previews. An opening
should use one canonical catalog page and its next offset, so older long-term
lines do not become invisible behind five recent entries. The global fallback
flag (`isGlobalFallback`, legacy `isCurrent`) is not session selection and does
not influence an Agent-filtered catalog's order.

Session startup with a briefing reads current state even for an existing
external session. The original saved briefing stays historical. Pending totals
and preview counts are separate fields; startup's `share_plan` is its single
recommendation. The personal hook shows next steps and applies only explicitly
configured cwd exclusions. Old-server refresh or count failures remain
unavailable rather than falling back to stale opening content or zero.

Tool manifests have separate maintained ceilings: `core` has 25 tools and a
14 KiB budget; `core-compat` preserves 38 tools; `full` exposes 83 canonical
contracts. The final Gateway result ceiling is 128 KiB. Over-budget results
return a narrowing error instead of invalid, silently truncated JSON.
The explicit full Agent Guide allows 22 KiB; default/section guide budgets
remain 4/8 KiB.

## Automatic context

The default Memory protocol returns at most one eligible block or abstains.
Knowledge-aware hosts must explicitly negotiate `memory-knowledge-v1`; see
[Knowledge context](KNOWLEDGE_CONTEXT.md). Selecting a block does not establish
host delivery or actual use. InnerLife sharing remains a separate review path.

Prompt calls default to `detail: summary`, preserving the prepared block(s),
decision, reason, per-domain status, and unknown delivery/use/outcome. Candidate
and routing diagnostics are available with `detail: full` for that call.
`diagnosticsRef` uses `gateway_auto_context({diagnosticsFor: decisionId})` to
read the already recorded Memory decision without rerunning recall or calling
a model; caller/client/conversation ownership is enforced. This is a Memory
ledger read, not a persisted Knowledge or routing-model trace. Diagnostics
reads cannot be combined with recall arguments. The older explicit candidate
input path retains its default diagnostic shape.

Explicit understanding packets preserve evidence and detail references within
bounded inputs and outputs. See [Understanding](UNDERSTANDING_CONTRACT.md).

## Validation

`npm run test:context-budget` checks adversarial payloads, projections,
pagination, manifests, and compatibility. Keep ceilings in
`core/tests/fixtures/context-budget-ceilings.js` aligned with the contract;
do not shrink them to hide omitted meaning.
