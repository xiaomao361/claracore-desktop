# Maintenance and audit results

Audits distinguish incomplete work, repairable failures, and advisory review.
An audit is a snapshot; read its categories rather than treating every
`needs_review` result as the same fault.

## Memory embeddings

| Category | Meaning |
| --- | --- |
| Missing | An eligible active memory has no embedding record. |
| Pending | An eligible active, non-restricted memory has a pending embedding record. |
| Failed | The embedding attempt has failed. |
| Stale | The stored vector no longer matches the relevant current state. |

`counts.pendingEmbeddings` is independent from missing/failed/stale counts.
Only pending work gives maintenance status `pending`; combined audit reports
`needs_review`. Repair issues take priority as `needs_repair`. Completion can
report `ok` when no other issue remains. Advisory archive/retention findings
may also require review without indicating a vector failure.

Pending means unfinished; it does not prove a stuck scheduler. Disabling a
provider preserves pending work rather than fabricating failure. The running
queue processes batches on its existing 15-second schedule; daily maintenance
normally runs at 03:00. Existing pending items are not re-enqueued or given
new timestamps just because an audit sees them. Runtime `after` results are
read after processing, preserving partial, disabled, failure, and completion
states. A dry run does not consume the queue.

## InnerLife candidates and switches

Pending, deferred, and approved candidates share a limit of ten per agent and
a seven-day lifetime from creation. Approved items have priority, followed by
pending and deferred, then newest first. Deferral does not extend lifetime.
Retirement preserves original text and a reason; it does not delete history.

Per-agent daemon choices are independent from the global gate. Pausing one
agent does not pause others; turning off the global gate does not erase their
choices. An already claimed job can finish. Failed background work retains
visible state and bounded retry information.

## Recovery

Read exact records, runtime errors, and provider/index state before retrying.
Do not delete locks merely because they are old or treat an uncertain write as
not written. Preserve backups and recovery evidence before changing unique
data. Supported operations live in Desktop and the explicit maintenance tools;
the internal CLI is not a replacement MCP transport.

For regression coverage, run `npm run test:desktop-maintenance`,
`npm run test:data-maintenance`, and the focused suite for the affected domain.
Use isolated data roots; see [Contributing](../CONTRIBUTING.md).
