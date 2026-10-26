# Context delivery

ClaraCore preserves rich source state while delivering minimum-sufficient
context by default. Callers can request more through explicit scope; even
explicit reads remain bounded.

## Server contract

Catalogs answer which object to inspect. They return identity, status, enough
preview to choose, truthful pagination, and detail references. General catalogs
default to 10 and allow explicit pages up to 50. A write returns a bounded
acknowledgement rather than another copy of the full saved body.

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

Tool manifests have separate maintained ceilings: `core` has 25 tools and a
14 KiB budget; `core-compat` preserves 38 tools; `full` exposes 83 canonical
contracts. The final Gateway result ceiling is 128 KiB. Over-budget results
return a narrowing error instead of invalid, silently truncated JSON.

## Automatic context

The default Memory protocol returns at most one eligible block or abstains.
Knowledge-aware hosts must explicitly negotiate `memory-knowledge-v1`; see
[Knowledge context](KNOWLEDGE_CONTEXT.md). Selecting a block does not establish
host delivery or actual use. InnerLife sharing remains a separate review path.

Explicit understanding packets preserve evidence and detail references within
bounded inputs and outputs. See [Understanding](UNDERSTANDING_CONTRACT.md).

## Validation

`npm run test:context-budget` checks adversarial payloads, projections,
pagination, manifests, and compatibility. Keep ceilings in
`core/tests/fixtures/context-budget-ceilings.js` aligned with the contract;
do not shrink them to hide omitted meaning.
