# Renderer Modules

The renderer is loaded by plain `<script>` tags from `index.html`; there is no
frontend build step yet.

Keep files narrow:

- `dom.js`: DOM queries only.
- `i18n.js`: translation dictionaries only.
- `view-registry.js`: view registry only.
- `utils.js`: pure formatting and HTML helpers only.
- `views/`: focused page modules.
- `app.js`: application state, refresh flow, rendering orchestration, and event
  wiring until those areas are extracted.

New renderer behavior should go into a focused file under `app/` instead of
expanding `app.js`.

## Current View Modules

- `views/home.js`: dashboard, module state, agent views, health, and Gateway traces.
- `views/memoria.js`: Memoria tabs, search, labels, graph, archive/delete, and embedding actions.
- `views/shared-innerlife.js`: Shared Line and InnerLife rendering.
- `views/data.js`: backups, restore confirmation, archive import/export, and old-service import preview.
- `views/logs.js`: runtime log rendering, follow mode, and periodic refresh.
- `views/settings.js`: Models and settings form rendering/collection.
- `views/agent-setup.js`: agent MCP/CLI setup guide.

Event handlers still live mostly in `app.js`. Move them only when the target
view module can own the whole interaction without adding hidden cross-view
coupling.
