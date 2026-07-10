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
