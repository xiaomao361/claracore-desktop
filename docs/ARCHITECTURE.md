# ClaraCore Desktop Architecture

This app is the Desktop-owned ClaraCore product surface. It does not run the old
Python Memoria, Continuity, or InnerLife services during normal product use.
Those services are reference implementations and import sources.

## Runtime Boundary

The Desktop runtime is Node/Electron.

- Renderer UI: `index.html`, `app.js`, `app/`, `styles.css`
- Electron host and IPC: `electron/`
  - `electron/main.js`: app lifecycle, window/tray ownership, runtime snapshots,
    quit handling, and module wiring
  - `electron/ipc-handlers.js`: renderer IPC channel registration
  - `electron/http-agent-gateway.js`: token-protected localhost HTTP Agent
    Gateway lifecycle and request handling
  - `electron/schedulers.js`: InnerLife and Memoria maintenance timers
- Product runtime facade: `core/runtime/index.js`
- Memoria runtime workflows: `core/runtime/memoria.js`
- Runtime snapshot assembly: `core/runtime/snapshot.js`
- Runtime path helpers: `core/runtime/paths.js`
- Backup and restore workflows: `core/runtime/backup.js`
- Archive import/export and old-service copy imports: `core/runtime/imports.js`
  and `core/runtime/imports/`
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
`CLARACORE_DESKTOP_DATA_DIR` or the default Electron user data `data/`
subdirectory. The product database and product-owned files live under
`<userData>/data` by default so Electron cache files stay outside the
ClaraCore data root.

The Settings page can save a custom data root to `<userData>/desktop-settings.json`.
That file is read on app startup, before opening `claracore.db`; changing the
path requires restarting the app. `CLARACORE_DESKTOP_DATA_DIR` remains the
highest-priority override for test and scripted launches.

## Renderer Boundary

The renderer currently uses plain script tags and no frontend build step.

`app.js` is orchestration:

- load and refresh product snapshots
- coordinate active view state
- call focused view modules
- bind cross-view event handlers

Focused renderer modules live under `app/`:

- `app/dom.js`: DOM bindings only
- `app/appearance.js`: theme, motion, and window preference state
- `app/i18n.js`: translation aggregation only
- `app/i18n/`: locale dictionaries
- `app/memoria-actions.js`: Memoria search, tab, graph, and list action wiring
- `app/shared-line-actions.js`: Shared Line tab, filter, line action, and resume copy wiring
- `app/innerlife-actions.js`: InnerLife agent filter, daemon, profile save, and paginated load-more actions
- `app/model-options.js`: provider model-list loading
- `app/view-registry.js`: view metadata only
- `app/utils.js`: pure formatting and HTML helpers
- `app/views/agent-setup.js`: Agent Access view
- `app/views/data.js`: Data, backup, import, export, and restore view
- `app/views/home.js`: overview, modules, health, and trace summary view
- `app/views/home-trace.js`: Home Gateway trace and agent activity helpers
- `app/views/logs.js`: Logs view
- `app/views/memoria.js`: Memoria workbench, tabs, graph, labels, and embedding
- `app/views/memoria-list.js`: Memoria list, label overview, agent filter, and
  memory item render helpers
- `app/views/settings.js`: model configuration collection plus Settings-page appearance, window, data-path, and about rendering
- `app/views/shared-innerlife.js`: Shared Line and InnerLife views

New renderer work should go into a focused module, not into `app.js`.

`styles.css` is an import entry. Shared and view-specific styles live under
`styles/`; add new CSS near the view or component it serves instead of growing a
single stylesheet again.
`styles/views/home.css` is a Home style entry that imports focused Home files
for base, runtime, module, dashboard, and event/motion styling.
`styles/views/innerlife.css` is an InnerLife style entry that imports focused
layout, runtime, profile, and record/share styling.
`styles/views/memoria-detail.css` is a Memoria detail style entry that imports
focused base, graph, label, and result styling.

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
Gateway-facing workflows, and tests. It stays small by delegating focused
workflows to sibling runtime modules.

`core/version.js` is the single product-version source. It reads
`package.json` and is used by runtime snapshots, resource snapshots, Gateway
metadata, and renderer display.

Runtime should coordinate cross-module workflows:

- resolve paths
- initialize the product database
- delegate Home/status snapshot assembly to `core/runtime/snapshot.js`
- delegate Memoria runtime workflows, graph cache refresh, maintenance, and
  embedding batch processing to `core/runtime/memoria.js`
- delegate backup and restore to `core/runtime/backup.js`
- delegate archive import/export and old-service imports through
  `core/runtime/imports.js`; focused implementation modules live under
  `core/runtime/imports/`
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

Domain policy should live with the domain module even when persistence still
uses repository methods. For example, InnerLife prompts, share policy defaults,
compact response shaping, and model-generation fallback live in
`core/innerlife/policy.js`; `core/db/repositories/innerlife.js` should keep
moving toward persistence and query orchestration only.

Runtime modules may compose multiple domains for product workflows, such as
snapshots, backup-gated imports, or archive export. They should not become the
home for new domain rules.

Runtime snapshots must stay bounded. `buildProductSnapshot()` is the Home and
status snapshot, so it should carry counts, summaries, and recent samples only.
Full Memory lists, InnerLife history, Gateway trace browsing, and graph data
must be fetched through focused paged or lazy-loaded IPC calls. The detailed
resource rules live in [Runtime Memory Policy](RUNTIME_MEMORY_POLICY.md).

Database implementation belongs in `core/db`. Product persistence is split into
repositories under `core/db/repositories/`.

## Database Boundary

SQLite through Node is acceptable for this Desktop product.

The current problem is not JavaScript using SQLite. SQLite is the product
database for this Desktop runtime.

Current shape:

- `core/db/database.js`: connection, initialization, migrations, legacy agent
  identity normalization, and agent identity merge
- `core/db/helpers.js`: shared repository/database helpers for SQL escaping,
  JSON parsing, agent identity normalization, label/date/value normalization,
  vector math, and JSON HTTP calls
- `core/db/migrations/`: explicit migrations
- `core/db/repositories/system.js`: settings, configuration, runtime events,
  gateway traces, backup records, LLM calls, and database summary
- `core/db/repositories/memoria.js`: Memoria persistence
- `core/db/repositories/memoria/`: focused Memoria repository submodules,
  including label alias, canonicalization, structured record, and
  embedding/search/maintenance persistence
- `core/db/repositories/continuity.js`: Shared Line persistence
- `core/db/repositories/continuity/`: focused Shared Line repository
  submodules, including agent state and model adjustment persistence
- `core/db/repositories/innerlife.js`: InnerLife persistence
- `core/db/repositories/innerlife/`: focused InnerLife repository submodules,
  including profile, inbox, daemon, history, session, and share persistence

Future schema-heavy changes should keep using repositories instead of growing
`core/db/database.js` again.

SQLite access is serialized through the product database helper. Long-running
or scheduler-driven workflows should still protect their own product semantics;
for example InnerLife daemon ticks are guarded so background scheduler ticks and
manual UI ticks do not create duplicate share candidates.

Desktop schedulers should match the product cadence they represent. Memoria
database maintenance is a once-per-local-day cleanup job, not a high-frequency
poll: the Electron host computes the next scheduled local hour from product
settings, sets a single timer, runs a missed same-day job immediately if the app
starts after the scheduled hour, then schedules the following day after
completion. Use short polling only for loops that are genuinely interactive,
such as InnerLife daemon due checks.

The Node runtime uses a cached `ProductDatabase` connection per process. In
packaged mode, `node:sqlite` may be unavailable, so the database helper can
fall back to the `sqlite3` CLI. Both paths must set WAL mode and a non-zero busy
timeout; otherwise short write contention between Desktop and multiple Gateway
processes can surface as immediate `database is locked` failures.

Multi-statement writes that must be atomic must wrap their SQL in an explicit
`BEGIN; ... COMMIT;` block. The `exec()` helper runs multiple statements in
one call but does not add an implicit transaction; partial writes will persist
if an intermediate statement fails without a transaction boundary.

`ensureProductCore` caches the initialized `ProductDatabase` instance at module
level so schema initialization and migrations only run once per process. Do not
call `initializeProductDatabase` directly from code that runs on every request
or IPC handler; route through `ensureProductCore` instead.

Repositories build SQL by string interpolation and escape values by
convention (`sqlString()`/`jsonSql()` from `core/db/helpers.js`), not by
parameter binding. This is a direct consequence of the dual execution path
above: the `node:sqlite` path could bind parameters, but the `sqlite3` CLI
fallback pipes a full SQL text blob over stdin and has no bind-parameter
protocol, so both paths have to go through the same string-built `query(sql)`/
`exec(sql)` interface. `core/tests/sql-interpolation-lint.js` (part of
`npm run check`) statically checks every SQL template literal under
`core/db/repositories/` and `core/db/database.js` and fails the build if a
`${}` interpolation is not provably escaped, numeric, or an explicitly
verified pre-built SQL fragment. Extend its allowlist only after reading
where the flagged identifier is declared and confirming it cannot carry
unescaped external input.

## Gateway Boundary

`core/gateway/mcp-server.js` is the agent-facing MCP transport surface. It owns
stdio protocol handling, process lifecycle, database connection caching, and
Gateway trace recording.

Gateway behavior is split by responsibility:

- `core/gateway/tool-definitions.js`: MCP tool schema aggregation only
- `core/gateway/tool-definitions/`: MCP tool schemas grouped by domain
- `core/gateway/tool-definitions/memoria-*.js`: Memoria schemas grouped by
  core operations, maintenance/import/export/merge, label aliases, and records
- `core/gateway/tool-definitions/innerlife-*.js`: InnerLife schemas grouped by
  sessions/status, profiles, shares/inbox, daemon, and history/exploration
- `core/gateway/tools.js`: handler dispatch only
- `core/gateway/tool-handlers/system.js`: Gateway/system tools
- `core/gateway/tool-handlers/memoria.js`: Memoria tools through
  `core/memoria`
- `core/gateway/tool-handlers/shared-line.js`: Shared Line tools through
  `core/continuity`
- `core/gateway/tool-handlers/innerlife.js`: InnerLife tools through
  `core/innerlife`

Gateway should expose stable product tools and call domain/runtime facades. New
Gateway behavior should not bypass a domain facade into database internals.

The MCP config shown in Agent Setup launches this Gateway as a stdio server.
Gateway is part of the product runtime, while the Logs view and Gateway trace
tables are inspection surfaces for what agents are doing.

Each MCP agent usually owns its own stdio Gateway process. In-process database
serialization does not coordinate across sibling Gateway processes, so database
writes must also be correct under SQLite's cross-process WAL and busy-timeout
rules. The Desktop UI's quit path best-effort stops packaged sibling Gateway
processes so replacing `/Applications/ClaraCore Desktop.app` is not blocked by
a stale `--gateway` process.

Agent identity is a process boundary, not a tool-call override. Gateway treats
`CLARACORE_AGENT_ID` as authoritative, uses it before any request-level
`agentId` or `agent_id`, and normalizes trace request metadata to that value.
When an agent changes identity, restart its MCP client or stop stale packaged
Gateway processes so the launched stdio environment changes too. After an
identity rename, `agent_identity_merge` is the supported repair path; it updates
agent-owned tables and stored Gateway trace request JSON.

Gateway tool responses must describe the actual record a write changed. For
example `shared_line_update` saves one current position and then reads the
resume packet for that exact `lineId`; it must not re-infer a line from agent
identity after the write.

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

## Packaging Resource Boundary

Packaged builds must not depend on a user-installed `sqlite3` binary. When
`node:sqlite` is unavailable, Desktop falls back to bundled SQLite tools under
`resources/sqlite/`, copied outside `app.asar` through `build.extraResources`.

The bundled tools are part of the release contract. `npm run test:sqlite-binary`
checks that every target binary exists, matches the recorded SHA-256, has an
executable bit where relevant, and is discoverable through
`core/sqlite-binary.js`.

## Validation Boundary

Use these gates for current development:

- `npm run check`: syntax and module-load check across Electron, core, tests,
  and renderer modules; also runs the SQL interpolation lint
  (`npm run test:sql-lint` runs it alone).
- `npm run test:sqlite-binary`: packaged SQLite resource integrity and resolver
  check.
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

See `docs/README.md` for the current docs index. Completed bugfix notes and
single-run polish logs belong in `docs/archive/`.
