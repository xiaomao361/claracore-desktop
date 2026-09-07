# Memoria Core

Desktop-owned Memoria logic lives here.

Existing `services/memoria` is a Python reference implementation and import
source. The Desktop product writes to its own `claracore.db` and exposes Memoria
through Desktop UI, CLI, and the Desktop-owned Gateway.

This directory owns the product Memoria boundary. The low-level SQLite adapter
currently lives in `core/db/database.js` plus
`core/db/repositories/memoria.js`; new Memoria behavior should enter through
`core/memoria/index.js` first instead of being added directly to
`core/runtime/index.js`.

## Current Surface

Desktop Memoria owns:

- durable observable memories,
- labels and label aliases,
- restricted, archived, deleted, and active memory states,
- graph and merge suggestions,
- keyword-first hybrid search with a semantic relevance floor and a bounded
  semantic result set,
- structured records,
- embedding queue and maintenance audit/run,
- archive import/export,
- old Memoria copy import.

## Database Maintenance

Memoria maintenance is database cleanup, not an agent inner loop. The automatic
Desktop scheduler runs it at most once per local day, using
`memory.maintenance.hour` and `memory.maintenance.last_run_date` in product
settings to compute the next run. The scheduler sets a single timer for the next
maintenance window; it does not wake every minute just to check the clock.

The scheduled job should stay small and mechanical:

- requeue missing, failed, or stale embedding state,
- process a small pending embedding batch,
- remove orphan labels,
- canonicalize alias labels,
- refresh Memory graph caches.

Long foreground rebuilds remain manual operations.

## Boundary

Memoria stores facts and structured records. It should not become Shared Line
current position or InnerLife interpretation state.

Old Memoria text records can be imported as searchable product memories for
compatibility, while structured product records continue to use the records
surface.

## Human Graph Reading

The stored graph supports three different human questions. The memory map
shows the overall memory-and-label structure and uses Agent identity only as a
stable color distinction. The relationship network uses explicit memory links
and opens one connected cluster at a time. State chains open as a catalog of
all replacement histories; selecting one chain reveals its current conclusion,
earlier versions, and replacement reasons in order.

These views organize inspection only. They do not replace recall evidence or
change memory lifecycle state when a person selects a node or chain.

## Label Rules

Labels are user-visible grouping keys and graph inputs, not raw tokenizer
output. Import and write paths should keep them stable and meaningful:

- Normalize labels to trimmed lowercase strings.
- Accept arrays directly.
- When a legacy string is provided, parse JSON arrays first, then fall back to
  comma-separated labels.
- Drop empty labels, pure punctuation labels, and single-character labels.
- Do not import labels from old tables unless the source row has a real
  `memory_id`.

These rules prevent old imports from creating graph-polluting labels such as
`,`, `:`, `a`, `系`, or `统`.

## Semantic Retrieval Coverage

Semantic search scans eligible stored vectors in 200-row keyset pages and keeps
only the best 10 scores above the existing relevance floor. It does not limit
recall to recently embedded memories. Provider, model, and actual query-vector
dimension must match; Agent, time-view, and restricted-memory filters apply to
every page. Saving changed embedding provider/model/endpoint/dimension/input
length settings queues non-restricted active memories for rebuilding through existing embedding
maintenance. Unchanged settings preserve ready vectors. Historical vectors are
retained and only participate when they match the query model.

Embedding completion writes check the saved configuration in SQL, so a delayed
success or failure from an old configuration cannot overwrite queued rebuild work.
