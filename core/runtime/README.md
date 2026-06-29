# Runtime

`core/runtime/` is the Desktop runtime boundary.

The public runtime entry is `core/runtime/index.js`. Electron, CLI, Gateway, and
tests should import `core/runtime` instead of reaching into product modules
directly.

Keep this layer focused on orchestration:

- resolve product paths and initialize the local product core
- coordinate backup, restore, import, and export workflows
- expose stable functions used by Electron IPC, CLI, and Gateway
- delegate domain behavior to `core/memoria`, `core/continuity`, and
  `core/innerlife`

Do not add new feature logic here when it belongs to a domain module.

## Files

- `index.js`: public facade imported as `core/runtime`.
- `paths.js`: ClaraCore root and product data path resolution.
- `backup.js`: product backup, restore, restore preview, and backup listing.
- `imports.js`: memory archive import/export plus old Memoria, Continuity, and
  InnerLife copy import workflows.

## Import Rules

Old-service imports are backup-gated and copy-based. Source databases are read
only. Import preview must remain read-only.

If a new import source is added, put the source-specific reading and copy logic
in `imports.js` or a focused helper under `core/runtime/`, then expose only a
small facade from `index.js`.
