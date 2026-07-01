# ClaraCore Desktop Code Map

This map is for agents and developers who need to inspect or repair ClaraCore
Desktop from source. It points to the current code ownership boundaries and the
shortest useful read paths.

## Product Shape

ClaraCore Desktop is a local Electron product around four agent-facing domains:

- Gateway: agent contract and activity traces.
- Memoria: memory facts, labels, search, graph, archive, and maintenance.
- Shared Line: continuity lines, current position, handoffs, agent state, and
  resume packets.
- InnerLife: agent profiles, inbox, sessions, thoughts, shares, digests, and
  daemon state.

The renderer has no build step. `index.html` loads classic scripts from `app/`.
The product runtime is Node/Electron plus a Desktop-owned SQLite database.

## Top-Level Entry Points

- `package.json`: scripts, packaging config, Electron Builder file list, and
  validation commands.
- `electron/main.js`: app lifecycle, BrowserWindow, tray/menu, packaged
  Gateway mode, runtime snapshot wiring, and quit behavior.
- `electron/preload.js`: safe renderer bridge over Electron IPC.
- `index.html`: static renderer shell, navigation, page sections, and script
  ordering.
- `app.js`: renderer state, refresh loop, cross-view event wiring, and view
  orchestration.
- `core/runtime/index.js`: public runtime facade used by Electron, CLI,
  Gateway-facing workflows, and tests.
- `core/gateway/mcp-server.js`: stdio MCP server process used by agents.
- `core/cli.js`: local CLI fallback for product operations.

## Read Paths By Task

### App Startup, Window, Tray, And Packaged Gateway

Start here:

1. `electron/main.js`
2. `electron/ipc-handlers.js`
3. `electron/http-agent-gateway.js`
4. `electron/schedulers.js`

Use this path for Dock/tray behavior, close/quit rules, packaged `--gateway`
behavior, HTTP Agent Gateway lifecycle, and background timers.

### Renderer Navigation And UI Behavior

Start here:

1. `index.html`
2. `app/view-registry.js`
3. `app/dom.js`
4. `app.js`
5. the matching file under `app/views/`
6. the matching file under `styles/views/`

Current view owners:

- `app/views/home.js`: Home runtime board, module cards, health, agent view,
  attention queue, and Gateway trace summaries.
- `app/views/memoria.js`: Memoria tabs, search, graph, labels, records,
  archive/delete/restrict flows, and embedding actions.
- `app/views/shared-innerlife.js`: Shared Line and InnerLife rendering.
- `app/views/data.js`: backups, restore preview/confirmation, import/export,
  and import preview.
- `app/views/logs.js`: runtime log view and follow mode.
- `app/views/settings.js`: Models and Settings forms.
- `app/views/agent-setup.js`: Agent Access setup brief and copy behavior.
- `app/appearance.js`: appearance-related renderer behavior.

New renderer behavior should usually go into a focused `app/views/*` module or
another focused `app/*` module, not directly into `app.js`.

### Runtime Snapshot And Home Status Truth

Start here:

1. `core/runtime/snapshot.js`
2. `core/runtime/index.js`
3. `electron/main.js`
4. `app/views/home.js`

Use this path when Home says a module is missing, paused, ready, or unhealthy.
`buildProductSnapshot()` is the bounded Home/status packet. Keep it to counts,
summaries, and recent samples. Full lists should be fetched through focused
IPC/runtime calls.

### Product Paths, Data Root, And Settings

Start here:

1. `core/runtime/paths.js`
2. `core/config/index.js`
3. `core/db/database.js`
4. `app/views/settings.js`

Use this path for data root resolution, Desktop settings, model settings,
configuration defaults, and data-path display issues.

### Database And Schema

Start here:

1. `core/db/schema.sql`
2. `core/db/database.js`
3. `core/db/migrations/`
4. `core/db/repositories/`

Repository ownership:

- `core/db/repositories/memoria.js`: Memoria tables, labels, search, graph,
  records, maintenance, embeddings, archive/delete/restrict flows.
- `core/db/repositories/continuity.js`: Shared Line tables, current position,
  history, snapshots, handoffs, agent state, model adjustments, arc lifecycle,
  and Gateway context composition.
- `core/db/repositories/innerlife.js`: InnerLife repository aggregation plus
  daemon state, inbox, sessions, events, thoughts, shares,
  digest/exploration/convergence data, and review flows.
- `core/db/repositories/innerlife/profile.js`: InnerLife profile create,
  update, list, and delete persistence.
- `core/db/repositories/innerlife/inbox.js`: InnerLife inbox list, count,
  pagination, and submit persistence.

New schema-heavy behavior should use an explicit migration and repository API.
Product policy should live in a domain module rather than directly in a
repository when possible.

### Memoria Behavior

Start here:

1. `core/memoria/index.js`
2. `core/db/repositories/memoria.js`
3. `core/runtime/memoria.js`
4. `app/views/memoria.js`
5. `core/gateway/tool-handlers/memoria.js`
6. `core/gateway/tool-definitions/memoria.js` and
   `core/gateway/tool-definitions/memoria-*.js`

Use this path for memory create/update/delete/archive/restore/restrict,
records, labels, graph, search, and embedding maintenance.

### Shared Line Behavior

Start here:

1. `core/continuity/index.js`
2. `core/db/repositories/continuity.js`
3. `app/views/shared-innerlife.js`
4. `core/gateway/tool-handlers/shared-line.js`
5. `core/gateway/tool-definitions/shared-line.js`

Use this path for line create/list/get/activate/rename/archive/restore/update,
current position, handoffs, agent state, model adjustments, shared-reality
fields, affective arcs, and resume packets.

### InnerLife Behavior

Start here:

1. `core/innerlife/index.js`
2. `core/innerlife/policy.js`
3. `core/db/repositories/innerlife.js`
4. `electron/schedulers.js`
5. `app/views/shared-innerlife.js`
6. `core/gateway/tool-handlers/innerlife.js`
7. `core/gateway/tool-definitions/innerlife.js` and
   `core/gateway/tool-definitions/innerlife-*.js`

Use this path for profiles, daemon enable/pause/tick, inbox, sessions, shares,
digest runs, exploration, convergence, model-backed generation, deterministic
fallbacks, and Doctor guidance.

### Agent Gateway And MCP Tools

Start here:

1. `core/gateway/mcp-server.js`
2. `core/gateway/tool-definitions.js`
3. `core/gateway/tool-definitions/*`
4. `core/gateway/tools.js`
5. `core/gateway/tool-handlers/*`
6. matching domain module under `core/memoria`, `core/continuity`, or
   `core/innerlife`

Gateway tools should call runtime or domain facades. Avoid adding Gateway
behavior that bypasses a domain facade into database internals.

### Data, Backup, Restore, Import, And Export

Start here:

1. `core/runtime/backup.js`
2. `core/runtime/imports.js`
3. `core/runtime/imports/`
4. `core/import-preview.js`
5. `app/views/data.js`

Use this path for verified SQLite backups, restore preview, restore safety
backup, full product JSON import/export, archive import/export, and import
source preview.

### Logs And Trace Inspection

Start here:

1. `core/db/database.js`
2. `core/gateway/mcp-server.js`
3. `app/views/logs.js`
4. `app/views/home.js`
5. `app/views/agent-setup.js`

Runtime events and Gateway traces are inspection surfaces. If a trace is wrong,
check where the Gateway records it before changing renderer formatting.

## Change Placement Rules

- New UI rendering: `app/views/*` plus `styles/views/*`.
- New cross-view renderer state or event wiring: `app.js`, only when a focused
  view module cannot own it cleanly.
- New runtime orchestration: `core/runtime/*`.
- New domain behavior: `core/memoria`, `core/continuity`, or `core/innerlife`.
- New persistence: `core/db/repositories/*` plus migration when schema changes.
- New Gateway operation: domain facade first, then tool definition and handler.
- New Electron host behavior: `electron/ipc-handlers.js`,
  `electron/http-agent-gateway.js`, `electron/schedulers.js`, or another
  focused Electron module.
- New product status fields: `core/runtime/snapshot.js`, keeping the snapshot
  bounded.

## Fast Source Search

Useful source-first commands:

```bash
rg -n "buildProductSnapshot|modules|health" core/runtime electron app
rg -n "ipcMain|handle\\(" electron
rg -n "invoke\\(|electronAPI" app app.js electron/preload.js
rg -n "toolName|tools/list|tools/call|CLARACORE_AGENT_ID" core/gateway
rg -n "shared_line_|memoria_|innerlife_|gateway_context" core/gateway
rg -n "CREATE TABLE|ALTER TABLE" core/db
rg -n "listGatewayTraces|recordGatewayTrace|runtimeEvents" core
```

## Validation Ladder

Choose the smallest validation that matches the changed surface.

- Syntax-only JavaScript change: `npm run check`
- Shell/window change: `npm run test:shell`
- Memoria CLI or domain change: `npm run test:memoria:cli` or
  `npm run test:phase2`
- Shared Line change: `npm run test:phase3`
- Gateway contract change: `npm run test:phase4`
- InnerLife change: `npm run test:phase5`
- Backup/import change: `npm run test:backup` or `npm run test:import-preview`
- Broad runtime or architecture change: `npm run test:smoke`

Do not default to the broadest gate when a targeted gate proves the changed
path.
