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

- `views/home.js`: Home presence copy, current Shared Line and eligible
  InnerLife text, recent Agent markers, and one actionable issue.
- `views/home-presence.js`: bounded Home presence model.
- `views/home-vision.js`: Shared Horizon Canvas and animation lifecycle.
- `views/memoria.js`: read-only Memoria tabs, search, detail, labels, and graph.
- `views/memoria-list.js`: Memory list, label overview, and Agent-filter helpers.
- `views/shared-innerlife.js`: read-only Shared Line and InnerLife rendering.
- `views/trace.js`: read-only Trace narrative, milestones, Agent participation,
  domain counts, and advanced statistics.
- `views/data.js`: SQLite backups, restore confirmation, and full product JSON import/export.
- `views/logs.js`: runtime logs, follow mode, decay audit, and time flow.
- `views/settings.js`: Settings and model configuration rendering/collection.
- `views/agent-setup.js`: focused Agent Access setup and copy surface.

Event handlers still live mostly in `app.js`. Move them only when the target
view module can own the whole interaction without adding hidden cross-view
coupling.
