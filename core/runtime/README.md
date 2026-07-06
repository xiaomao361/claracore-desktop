# Runtime

`core/runtime/` is the Desktop runtime boundary.

The public runtime entry is `core/runtime/index.js`. Electron, CLI, Gateway, and
tests should import `core/runtime` instead of reaching into product modules
directly.

Keep this layer focused on orchestration:

- resolve product paths and initialize the local product core
- coordinate backup, restore, import, and export workflows
- assemble bounded snapshots and read-only inspection summaries
- expose stable functions used by Electron IPC, CLI, and Gateway
- delegate domain behavior to `core/memoria`, `core/continuity`, and
  `core/innerlife`

Do not add new feature logic here when it belongs to a domain module.

## Files

- `index.js`: public facade imported as `core/runtime`.
- `paths.js`: ClaraCore root and product data path resolution.
- `snapshot.js`: bounded Home/Logs/status snapshot assembly.
- `decay.js`: read-only audit of dormant, stale, waiting, or error state across
  Memory, Shared Line, and InnerLife.
- `backup.js`: product backup, restore, restore preview, and backup listing.
- `imports.js`: product JSON import/export, memory archive import/export, and
  hidden old Memoria, Continuity, and InnerLife copy import workflows.

## Import Rules

Product data import/export should default to verified SQLite backups or full
product JSON. Old-service imports are one-off migration helpers, not a normal
user-facing product flow; keep them hidden unless an explicit migration task
requires them. Source databases are read only.

If a new import source is added, put the source-specific reading and copy logic
in `imports.js` or a focused helper under `core/runtime/`, then expose only a
small facade from `index.js`.

Old Memoria imports have additional label constraints:

- treat `labels` / `tags` as JSON arrays when possible,
- only fall back to comma-separated strings for legacy text,
- ignore label rows that do not carry a real `memory_id`,
- drop single-character and pure-punctuation labels.

This keeps copied data useful for Memoria search, filtering, and graph views
without importing tokenizer-like noise from old service tables.

## Decay Audit Rules

Decay audit is diagnostic only. It may suggest that state needs review, but it
must not archive Memory, approve or discard InnerLife shares, rewrite Shared
Line positions, or recover daemon state by itself. Those mutations belong to
explicit user or agent actions.
