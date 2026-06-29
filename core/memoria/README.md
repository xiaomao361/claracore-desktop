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
- structured records,
- embedding queue and maintenance audit/run,
- archive import/export,
- old Memoria copy import.

## Boundary

Memoria stores facts and structured records. It should not become Shared Line
current position or InnerLife interpretation state.

Old Memoria text records can be imported as searchable product memories for
compatibility, while structured product records continue to use the records
surface.
