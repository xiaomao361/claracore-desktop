# Database Migrations

Schema changes belong here before new schema-heavy features are added.

Current contract:

- `core/db/schema.sql` remains the baseline product schema for new databases.
- `index.js` runs ordered JavaScript migrations before or after the baseline
  schema, then records each successful id in `schema_migrations`.
- pre-schema migrations exist only for compatibility needed before the current
  baseline can be applied to an older database.
- new schema changes get one ordered migration module with an id, phase, and
  idempotent `up(database)` implementation.
- domain modules request repositories instead of embedding schema logic.

Current feature migrations:

- `004_memory_controller_ledger`: additive controller event and feedback audit
  tables plus bounded-query/retention indexes. Empty tables are the valid
  upgrade state; old Gateway traces are not backfilled as controller evidence.
- `005_memory_controller_watermark`: a singleton Memoria mutation revision and
  triggers covering Memory, label/alias, link, and embedding writes. The
  controller uses it to reject cache entries created before any eligibility or
  retrieval-source change; existing domain rows are not rewritten.
- `006_innerlife_hourly_default`: moves the former 15-minute InnerLife interval
  to the new one-hour default while preserving every non-default custom value.
- `007_innerlife_single_model`: preserves the effective legacy light model as
  the unified InnerLife model, falling back to the former deep model only when
  needed.
- `008_innerlife_afterthought_drafting`: reclassifies only legacy pending
  session-afterthought shares whose generation jobs are still unfinished, so
  placeholder bodies cannot enter the shareable queue after an upgrade.
