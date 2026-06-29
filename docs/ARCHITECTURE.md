# ClaraCore Desktop Architecture

This app is the Desktop-owned ClaraCore product surface. It does not run the old
Python Memoria, Continuity, or InnerLife services during normal product use.
Those services are reference implementations and import sources.

## Runtime Boundary

The Desktop runtime is Node/Electron.

- Renderer UI: `index.html`, `app.js`, `app/`, `styles.css`
- Electron host and IPC: `electron/`
- Product runtime facade: `core/runtime/index.js`
- Runtime path helpers: `core/runtime/paths.js`
- Backup and restore workflows: `core/runtime/backup.js`
- Archive import/export and old-service copy imports: `core/runtime/imports.js`
- Product database: `core/db/`
- Domain modules: `core/memoria`, `core/continuity`, `core/innerlife`
- Agent Gateway: `core/gateway`
- CLI fallback: `core/cli.js`

Agents should use Gateway MCP first, then CLI fallback when MCP is unavailable.
When the Desktop app is running, Agent Access may also expose a
token-protected localhost HTTP Agent Gateway for setup JSON and the first
Gateway context packet. This HTTP surface binds to `127.0.0.1` by default and
uses an OS-assigned runtime port. Do not document or depend on a fixed port;
agents should read the current URL from Agent Access or `/agent/setup` each app
session.

Do not show or bind a LAN URL by default. A LAN Agent Gateway must be an
explicit product mode with visible bind address, bearer token, token
regeneration, and disable controls because Gateway context includes product
state such as Shared Line, Memory, and InnerLife status.

Old Python services are not started by the Desktop app during normal product
use. They are reference implementations and read-only import sources. Product
state lives in the Desktop-owned SQLite database selected by
`CLARACORE_DESKTOP_DATA_DIR` or Electron user data.

## Renderer Boundary

The renderer currently uses plain script tags and no frontend build step.

`app.js` is orchestration:

- load and refresh product snapshots
- coordinate active view state
- call focused view modules
- bind cross-view event handlers

Focused renderer modules live under `app/`:

- `app/dom.js`: DOM bindings only
- `app/i18n.js`: translation dictionaries only
- `app/view-registry.js`: view metadata only
- `app/utils.js`: pure formatting and HTML helpers
- `app/views/agent-setup.js`: Agent Access view
- `app/views/data.js`: Data, backup, import, export, and restore view
- `app/views/home.js`: overview, modules, health, and trace summary view
- `app/views/logs.js`: Logs view
- `app/views/memoria.js`: Memoria workbench, tabs, graph, labels, and embedding
- `app/views/settings.js`: model configuration collection plus Settings-page appearance, window, data-path, and about rendering
- `app/views/shared-innerlife.js`: Shared Line and InnerLife views

New renderer work should go into a focused module, not into `app.js`.

`styles.css` is an import entry. Shared and view-specific styles live under
`styles/`; add new CSS near the view or component it serves instead of growing a
single stylesheet again.

The Home page is the operational board for the local agent runtime. It should
make runtime state inspectable at a glance without becoming a generic settings
page:

- The runtime overview owns the breathing core visualization. Its color and
  cadence derive from current snapshot state: quiet, active, warning, or error.
- Motion must respect the Settings motion preference and system reduced-motion
  preference. Disabling motion should leave a readable static state.
- The Gateway trace panel should show one expanded priority call chain and keep
  repeated calls compact. Priority is error first, then newest call. Additional
  calls belong in a compressed recent list with overflow review through Agent
  Access, not as repeated expanded JSON cards.
- Chinese UI copy should stay Chinese except for protocol, format, runtime, or
  actual tool names such as MCP, CLI, HTTP, JSON, SQLite, localhost, token,
  Electron, Node, Chrome, and real agent/tool identifiers.

## Core Boundary

`core/runtime/index.js` is the public runtime facade used by Electron, CLI,
Gateway, and tests. It stays small by delegating focused workflows to sibling
runtime modules.

`core/version.js` is the single product-version source. It reads
`package.json` and is used by runtime snapshots, resource snapshots, Gateway
metadata, and renderer display.

Runtime should coordinate cross-module workflows:

- resolve paths
- initialize the product database
- create snapshots
- delegate backup and restore to `core/runtime/backup.js`
- delegate archive import/export and old-service imports to `core/runtime/imports.js`
- delegate domain behavior

Product data portability is the normal Data page contract: use verified SQLite
database backups for exact restore points, and full product JSON for portable
inspection/import. Old-service imports are migration helpers for explicit
one-off tasks, not the default user-facing flow.

Domain behavior belongs in:

- `core/memoria`: facts, labels, search, records, maintenance, archive
- `core/continuity`: Shared Line, position history, handoff, agent state, model
  adjustments, shared-reality/affective arc lifecycle (cap, truncation, compaction)
- `core/innerlife`: sessions, inbox, digest, exploration, convergence,
  model-backed generation, share timing, daemon state

Runtime modules may compose multiple domains for product workflows, such as
snapshots, backup-gated imports, or archive export. They should not become the
home for new domain rules.

Database implementation belongs in `core/db`. Product persistence is split into
repositories under `core/db/repositories/`.

## Database Boundary

SQLite through Node is acceptable for this Desktop product.

The current problem is not JavaScript using SQLite. SQLite is the product
database for this Desktop runtime.

Current shape:

- `core/db/database.js`: connection, initialization, settings, runtime events,
  gateway traces, backup records, configuration, and summary
- `core/db/migrations/`: explicit migrations
- `core/db/repositories/memoria.js`: Memoria persistence
- `core/db/repositories/continuity.js`: Shared Line persistence
- `core/db/repositories/innerlife.js`: InnerLife persistence

Future schema-heavy changes should keep using repositories instead of growing
`core/db/database.js` again.

SQLite access is serialized through the product database helper. Long-running
or scheduler-driven workflows should still protect their own product semantics;
for example InnerLife daemon ticks are guarded so background scheduler ticks and
manual UI ticks do not create duplicate share candidates.

## Gateway Boundary

`core/gateway/mcp-server.js` is the agent-facing MCP surface.

Gateway should expose stable product tools and call `core/runtime`. It should
not bypass runtime into database internals.

The MCP config shown in Agent Setup launches this Gateway as a stdio server.
Gateway is part of the product runtime, while the Logs view and Gateway trace
tables are inspection surfaces for what agents are doing.

## Import And Backup Boundary

Old Memoria, Continuity, and InnerLife imports are copy-based and backup-gated.

- Import preview is read-only.
- Product backup is created before import.
- Source databases and source files must not be mutated.
- Old Memoria `memories` rows import as product memories.
- Old Memoria text `records` rows import as searchable product memories while
  preserving the `records` import count.
- Structured Memoria records continue to import into product record tables.
- Old Continuity data maps into Shared Line lines, positions, history,
  snapshots, and handoffs.
- Old InnerLife data maps into Desktop-owned profiles, events, thoughts, and
  shares.

## Validation Boundary

Use these gates for current development:

- `npm run check`: syntax and module-load check across Electron, core, tests,
  and renderer modules.
- `npm run test:phase5`: InnerLife runtime, UI, and scheduler coverage.
- `npm run test:backup`: backup and restore coverage.
- `npm run test:import-preview`: read-only preview and copy import coverage for
  old services.
- `npm run test:smoke`: full project smoke suite before pushing structural or
  runtime changes.

## Documentation Boundary

Keep current, build-relevant docs in `docs/`. Move superseded plans to
`docs/archive/` so agents do not treat old phase plans as active instructions.

Current docs should answer:

- what the app is
- how it runs
- where data lives
- how agents connect
- how to continue development safely
