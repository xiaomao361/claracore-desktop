# Trace Page

## Product Contract

Trace / 痕迹 is a separate read-only page for what has accumulated inside this
ClaraCore. It is not a work dashboard, usage streak, leaderboard, or claim that
ClaraCore is a living entity. It combines durable data statistics with the
distinctive history formed through one or more Agents using the same core.

The page reads in this order:

1. a human conclusion about evidence already left in the shared world;
2. the real aggregation path from domain records through explicit evidence
   boundaries to a bounded read model;
3. four completed-state semantic statements, up to five recent confirmed
   milestones, and non-ranked Agent participation;
4. one unified detail layer for Memoria, Shared Line, and InnerLife composition
   plus lower-level lifecycle counts.

Semantic statements describe evidence that is already confirmed. They are not
an approval queue and must not use copy such as “worth keeping” that sounds like
the user still needs to decide. Mutation remains in the owning module.

The detail cards reuse the same module icon grammar as primary navigation. A
module must not gain an unrelated letter badge or second visual identity here.

Empty states stay quiet and truthful. The page contains no mutation controls.

## Maintained Definitions

- **Span days**: inclusive local calendar days from the earliest active Memory,
  Shared Line position-history record, InnerLife event, or InnerLife share.
  Archived or superseded imported Memories remain visible in detailed totals
  but do not start the span. Empty default records do not start it either.
- **Decisions worth keeping**: distinct active Memories carrying an exact
  decision label (`decision`, `product-decision`, `design-decision`, their
  namespaced forms, or the maintained Chinese equivalents).
- **Shared Lines still continuing**: active Shared Lines with a non-empty
  current-position summary. An untouched default line is not counted.
- **Old memories used again**: valid persisted Memory ids referenced by Shared
  Line position-history `facts_used_json`. Each history/reference pair is
  counted once; free text or missing ids do not qualify.
- **Agent ideas brought into discussion**: distinct InnerLife shares marked
  `used` with complete delivery evidence: conversation id, response excerpt,
  and shared-at time.
- **Recent milestones**: the five most recently updated active Memories marked
  as milestone, release, product decision, design decision, or their maintained
  Chinese equivalents. Ordinary recent activity is not promoted automatically.
- **Agent participation**: attributed persisted Memory, Shared Line, and
  InnerLife items grouped by stable Agent id. It is descriptive and
  alphabetically ordered, never scored or ranked.

Detailed cards use the existing domain truth: Memory status and label totals;
Shared Line active, archived, history, snapshot, and handoff totals; and
InnerLife profile, thought, share-action, session, digest, and inbox totals.

Memory Controller events are Memoria recall evidence rather than Trace content.
They remain available in Memoria and settings instead of being repeated inside
the Trace detail layer.

## Implementation Boundary

- `core/db/repositories/system.js` owns the bounded cross-domain query.
- `core/runtime/snapshot.js` includes it in the existing product snapshot.
- `app/views/trace.js` renders the page without issuing another poll.
- `styles/views/trace.css` owns the page layout and responsive behavior.
- `core/tests/trace-ui-smoke.js` seeds isolated evidence and validates the
  rendered semantics, read-only boundary, advanced disclosure, and wide/narrow
  overflow.

This checkpoint adds no schema or Gateway operation. Validate focused changes
with:

```bash
npm run test:trace
```
