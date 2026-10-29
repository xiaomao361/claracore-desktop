# Milestones and lifecycle evidence

The standalone Trace page has been retired. Home shows up to five recent
confirmed milestones after the current Shared Line. Ordinary activity does not
become a milestone. Empty results hide the section; pending or failed reads are
shown distinctly. Connection details lead to Agent Access.

Logs retains the read-only composition/lifecycle dialog. Source records and
historical data remain in their owning domains. The legacy trace snapshot read
is retained for compatibility; normal Home hydration queries only milestones
and activity, not the complete cross-domain aggregation.

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

## Implementation boundary

- `core/db/repositories/system.js`: shared milestone query and trace aggregation.
- `core/runtime/snapshot.js`: bounded Home hydration and Logs diagnostics.
- `app/views/activity-summary.js`: Home list and Logs composition dialog.
- `core/tests/activity-summary-smoke.js`: data boundaries and DOM regression.

The mechanism explanations formerly repeated in Memoria, Shared Line, and
InnerLife are available in [Workflow overview](WORKFLOW_OVERVIEW.md).
