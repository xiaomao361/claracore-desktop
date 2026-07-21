# ClaraCore Desktop Code Map

This map is for agents and developers who need to inspect or repair ClaraCore
Desktop from source. It points to the current code ownership boundaries and the
shortest useful read paths.

## Product Shape

ClaraCore Desktop is a local Electron product around four agent-facing domains:

- Gateway: agent/client/conversation caller contract and activity traces.
- Memoria: memory facts, labels, search, graph, archive, and maintenance.
- Shared Line: continuity lines, current position, handoffs, agent state, and
  resume packets.
- InnerLife: agent profiles, inbox, sessions, thoughts, shares, digests, and
  daemon state.

The renderer has no build step. `index.html` loads classic scripts from `app/`
and owns the renderer CSP. The Electron BrowserWindow runs with renderer
sandboxing enabled. The product runtime is Node/Electron plus a Desktop-owned
SQLite database.

## Top-Level Entry Points

- `package.json`: scripts, packaging config, Electron Builder file list, and
  validation commands.
- `electron/main.js`: app lifecycle, BrowserWindow, tray/menu, packaged
  Gateway mode, renderer sandbox policy, runtime snapshot wiring, and quit
  behavior.
- `electron/preload.js`: safe renderer bridge over Electron IPC.
- `electron/ipc-contracts.js`: main-process IPC channel registry, shared with
  registration and enforced against the sandboxed preload by contract lint.
- `index.html`: static renderer shell, navigation, page sections, and script
  ordering, plus the renderer CSP.
- `app.js`: renderer state, refresh loop, cross-view event wiring, and view
  orchestration.
- `core/runtime/index.js`: public runtime facade used by Electron, CLI,
  Gateway-facing workflows, and tests.
- `electron/http-agent-gateway.js`: localhost HTTP helper and Streamable HTTP MCP endpoint.
- `core/gateway/mcp-server.js`: stdio MCP fallback process used by agents; reads
  process-scoped agent, client, and optional conversation identity.
- `core/runtime/snapshot.js`: generates the copyable stdio configuration,
  including packaged launch environment and multi-agent caller placeholders.
- `core/cli.js`: local CLI fallback for product operations.

## Read Paths By Task

### App Startup, Window, Tray, And Packaged Gateway

Start here:

1. `electron/main.js`
2. `electron/ipc-handlers.js`
3. `electron/http-agent-gateway.js`
4. `electron/schedulers.js`

Use this path for Dock/tray behavior, close/quit rules, packaged `--gateway`
behavior, BrowserWindow security policy, HTTP Agent Gateway lifecycle, and
background timers. The daily maintenance timer also owns Memory Controller
ledger retention and its bounded runtime receipt, independently of optional
Memoria repair.

### Renderer Navigation And UI Behavior

Start here:

1. `index.html`
2. `app/view-registry.js`
3. `app/dom.js`
4. `app.js`
5. the matching file under `app/views/`
6. the matching file under `styles/views/`

Current view owners:

- `app/views/home.js`: Home presence copy, Shared Line and InnerLife text,
  recent Agent markers, and one actionable issue.
- `app/views/home-presence.js`: bounded presence model derived from recent
  Gateway truth, current Shared Line, and eligible InnerLife material.
- `app/views/home-vision.js`: Shared Horizon Canvas rendering, Agent ripples,
  pixel/FPS budgets, reduced motion, and inactive-view scheduling.
- `app/views/memoria.js`: Memoria tabs (Memories / Labels / Graph / Archive &
  restricted), search, paging, and embedding maintenance actions.
- `app/views/memoria-list.js`: Memoria list cards, inline labels, label
  overview, agent filter, and maintenance count helpers.
- `app/views/shared-innerlife.js`: Shared Line and InnerLife rendering.
- `app/views/trace.js`: read-only Trace narrative, milestones, Agent
  participation, domain detail cards, and collapsed advanced metrics.
- `app/views/data.js`: backups, restore preview/confirmation, import/export,
  and import preview.
- `app/views/logs.js`: runtime log view, follow mode, read-only decay audit,
  and time flow.
- `app/views/settings.js`: Settings forms; Models and Data are tabs inside the
  Settings view (`data-settings-tab` / `data-settings-panel` in `app.js`).
- `app/views/agent-setup.js`: Agent Access setup brief and copy behavior.
- `app/appearance.js`: appearance-related renderer behavior.

New renderer behavior should usually go into a focused `app/views/*` module or
another focused `app/*` module, not directly into `app.js`.

### Runtime Snapshot And Home Presence Truth

Start here:

1. `core/runtime/snapshot.js`
2. `core/runtime/index.js`
3. `electron/main.js`
4. `app/views/home-presence.js`
5. `app/views/home.js`
6. `app/views/home-vision.js`

Use this path when Home shows the wrong current line, thought, Agent presence,
arrival state, or visual cadence. `buildProductOverviewSnapshot()` owns the
bounded startup path; `buildProductViewSnapshot()` hydrates page detail and
`buildProductLogsSnapshot()` owns Follow polling. Full lists stay behind
focused IPC/runtime calls.

Decay audit is part of the focused Logs snapshot and remains read-only. Start
at `core/runtime/decay.js` when dormant Memory, stale Shared Line, old
InnerLife waiting state, or daemon-error review indicators look wrong.

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
- `core/db/helpers.js`: shared helper functions injected into database
  repositories, including SQL escaping, JSON/date parsing, agent identity,
  label/value normalization, vector math, and JSON HTTP calls.
- `core/db/repositories/system.js`: settings, secrets, configuration,
  runtime events, Gateway traces with agent/client/conversation identity,
  backup records, LLM calls, database summary persistence, and the bounded
  cross-domain Trace aggregate.
- `core/db/migrations/003_multi_agent_caller_context.js`: additive v0.5
  migration for Gateway trace `client_id` / `conversation_id` columns and
  legacy `session_id` backfill.
- `core/db/repositories/memoria/labels.js`: Memoria label alias listing,
  creation, deletion, and canonicalization.
- `core/db/repositories/memoria/records.js`: Memoria structured record create,
  get, list, stats, and summary persistence.
- `core/db/repositories/memoria/embeddings.js`: Memoria embedding creation,
  vector candidates, hybrid search, and pending embedding processing.
- `core/db/repositories/memoria/maintenance.js`: Memoria archive suggestions,
  maintenance reports and repair, audit reports, merge suggestions, and merge
  persistence.
- `core/db/repositories/continuity.js`: Shared Line tables, stable owner plus
  writer provenance, current position, history, snapshots, handoffs, arc
  lifecycle, and Gateway context composition.
- `core/db/repositories/continuity/agents.js`: Shared Line agent state and
  model adjustment persistence.
- `core/db/repositories/innerlife.js`: InnerLife repository aggregation plus
  events, thoughts, shares, digest/exploration/convergence data, compact status
  and view snapshots, and review flows.
- `core/db/repositories/innerlife/profile.js`: InnerLife profile create,
  update, list, and delete persistence.
- `core/db/repositories/innerlife/inbox.js`: InnerLife inbox list, count,
  pagination, and submit persistence.
- `core/db/repositories/innerlife/daemon.js`: InnerLife daemon state,
  enable/pause/tick scheduling, and per-agent tick locking.
- `core/db/repositories/innerlife/history.js`: InnerLife history, experience,
  summary, and digest-summary read models.
- `core/db/repositories/innerlife/sessions.js`: agent-scoped InnerLife session
  count/list/page, start packet, canonical internal/external session lookup,
  best-effort lifecycle-hook close, and session-end persistence.
- `core/db/repositories/innerlife/shares.js`: InnerLife share list, timing
  checks, review/mark actions, and apply-to-Memory/Shared-Line persistence.
  Timing checks may use the current Shared Line resume packet as implicit
  context, and persist overlap metadata for later inspection.
- `core/db/repositories/innerlife/retention.js`: scheduled age/capacity cleanup
  for processed inbox, ended sessions, share checks, and digest runs while
  protecting active work.

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

For MCP `memoria_update`, inspect the handler before the repository: the
handler preserves omitted `title`, `labels`, and `sensitivity`, while the
repository remains a full-record update primitive.

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

1. `electron/http-agent-gateway.js`
2. `core/gateway/mcp-server.js`
3. `core/gateway/tool-definitions.js`
4. `core/gateway/tool-definitions/*`
5. `core/gateway/tools.js`
6. `core/gateway/tool-handlers/*`
7. matching domain module under `core/memoria`, `core/continuity`, or
   `core/innerlife`

Gateway tools should call runtime or domain facades. Avoid adding Gateway
behavior that bypasses a domain facade into database internals.

`electron/http-agent-gateway.js` also owns tool-call admission. Keep health,
initialize, tools/list, and ping outside its bounded active/queued tool-call
limits; overload must return the retryable 429 busy contract rather than an
unbounded promise backlog.

For test launches, read `electron/main.js` and
`electron/http-agent-gateway.js` together. A test instance must set both
`CLARACORE_DESKTOP_DATA_DIR` and `CLARACORE_DESKTOP_USER_DATA_DIR`; random port
`0` is test-only and must never persist into the live Gateway token file.

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
2. `core/runtime/snapshot.js`
3. `core/runtime/decay.js`
4. `core/gateway/mcp-server.js`
5. `app/views/logs.js`
6. `app/views/home.js`
7. `app/views/agent-setup.js`

Runtime events and Gateway traces are inspection surfaces. If a trace is wrong,
check where the Gateway records it before changing renderer formatting.
The Logs time flow is also an inspection surface: it orders bounded recent
Memory, Shared Line, InnerLife, Gateway, and runtime events from the current
snapshot. Decay audit cards must stay read-only; automatic archive, share
review, or daemon recovery belongs in explicit agent or human actions.

### Trace Page

Start here:

1. `core/db/repositories/system.js`
2. `core/runtime/snapshot.js`
3. `app/views/trace.js`
4. `styles/views/trace.css`
5. `core/tests/trace-ui-smoke.js`

Use this path for the separate product page named Trace / 痕迹. Its aggregate
is read-only and bounded; it does not add a schema, write path, ranking, streak,
or synthetic identifier. Maintained metric definitions live in
`docs/TRACE_PAGE.md`.

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
- Trace snapshot or page change: `npm run test:trace`
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
