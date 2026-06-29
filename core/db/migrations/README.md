# Database Migrations

Schema changes belong here before new schema-heavy features are added.

Current state:

- `core/db/schema.sql` remains the baseline product schema.
- `core/db/database.js` still applies the baseline schema during initialization.

Target state:

- one ordered migration file per schema change
- migration metadata recorded in `schema_migrations`
- domain modules request repositories instead of embedding schema logic
