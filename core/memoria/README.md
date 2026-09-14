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

### Experimental SQLite vector projection (0.7.0 branch)

`sqlite-vec` is the default engine in the personal 0.7.0 Lite package.
`CLARACORE_DESKTOP_VECTOR_ENGINE=legacy` explicitly selects the old engine.
The environment switch is not a saved user setting. Large-corpus performance
acceptance remains incomplete; this default is approved for personal small-corpus use.

The authoritative `memory_embeddings.vector_json` rows stay in the main DB.
Migration 009 adds ordinary SQLite revision triggers, which also observe writes
from other connections and older code. Migration 010 adds a covering index on
provider/model/dimension/status/memory ID, so eligibility filtering does not
fetch every raw vector JSON payload. Each ProductDatabase instance owns a
private disposable cache DB with one vec0 table per provider/model/dimension.
Closing the instance removes its cache; backups contain source vectors and
rebuild the cache on first use, without requiring virtual tables in the main DB.

Search synchronizes a changed space and reads its eligible results in one
transaction. Source revision races fail explicitly instead of returning a stale
projection. Native KNN grows its candidate set when the cutoff could hide a tie
or precision-sensitive result, falling back to a full native scan at the vec0 K
limit. Source JSON scores are refined in double precision near the cutoff; the existing 0.55 floor,
10-result cap, JS localeCompare tie order and keyword merge remain in force.
Invalid ready vectors produce classified issues; pending embeddings are excluded.
Extension, rebuild and source errors preserve keyword results with `error` and
`vectorSearch.status=failed`; Agent summary search continues to expose `degraded`.
No automatic legacy fallback hides an experimental-engine failure.

Rebuild validation stages only IDs and classified issues in its temporary table;
valid vectors are read from the locked source when inserting the projection.
Migration 011 records the latest revision per memory ID (including deletion
tombstones), and synchronizes only changed IDs after the first build. Tombstones
are retained so independent process caches cannot miss deletions; storage grows
with distinct IDs ever changed, not with every update. Reopening still starts
with an empty cache. Large-space cold rebuild cost remains unresolved; local
trial readiness is measured separately against the actual small corpus.

Run `npm run test:sqlite-vec:projection` for Node/CLI integration checks.
`npm run baseline:sqlite-vec` writes a synthetic 1k/10k/50k report to
`out/sqlite-vec-baseline.json`; failed/timeout engines remain explicit and the
command exits nonzero when the comparison is incomplete. Default sample count
is 20; `CLARACORE_VEC_BASELINE_SAMPLES` (5–100) and
`CLARACORE_VEC_BASELINE_TIMEOUT_MS` (1000–300000) allow bounded exploratory runs.
`npm run profile:sqlite-vec -- 50000 current` records cumulative SQL-stage timings
and query plans in `out/sqlite-vec-profile-current.json`. Stage timings are not
additive. `CLARACORE_VEC_PROFILE_NO_INDEX=1` removes the covering index only from
the generated fixture. `CLARACORE_VEC_PROFILE_BUILD=1` splits the fixture's build
SQL into statements for diagnosis; `CLARACORE_VEC_PROFILE_MUTATION=1` also times
the next search after changing one synthetic vector. These use temporary roots.

The persisted embedding worker also rebuilds ready vectors whose provider/model
no longer matches the current configuration. It only selects active, non-restricted
memories; disabled embedding leaves the queue untouched. Failed jobs retain their
failure status for explicit retry. Model aliases are not merged as a substitute
for regenerating vectors with the configured model.
