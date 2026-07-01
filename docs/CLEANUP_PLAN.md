# Cleanup Plan

This project is in cleanup mode before new product features continue.

## Current Priority

Keep the new boundaries intact while feature work resumes. The first cleanup
pass has split the former large renderer, style, runtime, and database files
into focused modules.

Current largest files after the current split:

- `core/db/repositories/innerlife.js`: InnerLife persistence aggregation, about
  970 lines
- `core/db/repositories/memoria.js`: Memoria persistence aggregation, about
  1010 lines
- `core/db/database.js`: SQLite adapter, migrations, settings, and runtime
  database metadata, about 910 lines
- `app.js`: renderer orchestration and event wiring, about 850 lines
- `app/views/memoria.js`: Memoria view rendering and actions, about 830 lines
- `core/db/repositories/continuity.js`: Shared Line persistence, about 950
  lines
- `app/i18n/en.js` and `app/i18n/zh.js`: locale dictionaries, about 900 lines
  each
- `app/views/home.js`: Home view rendering, about 820 lines
- `core/db/repositories/innerlife/daemon.js`: InnerLife daemon persistence,
  about 270 lines
- `core/runtime/imports/legacy-innerlife.js`: old InnerLife copy import, about
  620 lines
- `styles/base-layout.css`: shared layout shell styles, about 540 lines

This is acceptable for the current checkpoint. The rule is not "split every
large file immediately"; the rule is "do not grow these files when a focused
module can own the behavior."

## Order

1. Renderer split
   - Done: `app/dom.js` contains DOM bindings only.
   - Done: `app/appearance.js` owns theme, motion, and window preference state.
   - Done: `app/i18n.js` aggregates locale dictionaries only.
   - Done: locale dictionaries live under `app/i18n/`.
   - Done: `app/model-options.js` owns provider model-list loading.
   - Done: `app/view-registry.js` contains the view registry only.
   - Done: `app/utils.js` contains pure formatting and HTML helpers.
   - Done: extract view renderers into focused files under `app/views/`.
   - Done: `app/views/agent-setup.js` owns Agent Access markdown rendering and
     copy behavior.
   - Done: `app/views/data.js` owns Data page backup, archive import/export,
     legacy import preview, and restore confirmation behavior.
   - Done: `app/views/logs.js` owns log rendering, live UI log lines, follow
     state, and log auto-refresh.
   - Done: `app/views/settings.js` owns settings and model config form logic.
   - Done: `app/views/home-trace.js` owns Home Gateway trace and agent
     activity helpers.
   - Done: `app/memoria-actions.js` owns Memoria search, tab, graph, and list
     action wiring.
   - Done: `app/shared-line-actions.js` owns Shared Line tab, filter, line
     action, and resume copy wiring.
   - Done: `app/innerlife-actions.js` owns InnerLife agent filter, daemon,
     profile save, and paginated load-more actions.
   - Done: `app/views/home.js` owns Home/Health/Modules rendering.
   - Done: `app/views/memoria.js` owns Memoria tabs, graph, labels, search, and
     embedding actions.
   - Done: Memoria list and label rendering helpers moved to
     `app/views/memoria-list.js`.
   - Done: `app/views/shared-innerlife.js` owns Shared Line and InnerLife
     rendering.

2. Style split
   - Done: `styles.css` is now only an ordered import entry.
   - Done: shared layout/component styles live under `styles/`.
   - Done: view-specific styles live under `styles/views/`.
   - Done: Home styles are split behind `styles/views/home.css` into base,
     runtime, module, dashboard, and event/motion files.
   - Done: InnerLife styles are split behind `styles/views/innerlife.css` into
     layout, runtime, profile, and record/share files.
   - Done: Memoria detail styles are split behind
     `styles/views/memoria-detail.css` into base, graph, labels, and results
     files.

3. Core runtime split
   - `core/runtime/` is the runtime boundary.
   - `core/runtime/index.js` is the public entry for Electron, CLI, Gateway, and
     tests.
   - Done: Home/status snapshot assembly moved to `core/runtime/snapshot.js`.
   - Done: Memoria runtime workflows, graph cache refresh, maintenance, and
     embedding batch processing moved to `core/runtime/memoria.js`.
   - Done: backup and restore moved to `core/runtime/backup.js`.
   - Done: archive import/export and old-service imports moved to
     `core/runtime/imports.js`.
   - Done: focused archive/import implementations are split under
     `core/runtime/imports/`.
   - Runtime coordinates paths, initialization, snapshots, and cross-module
     orchestration.
   - Domain behavior belongs in `core/memoria`, `core/continuity`, and
     `core/innerlife`.

4. Database split
   - Keep SQLite in Node for the Desktop product.
   - Done: shared database/repository helpers moved to `core/db/helpers.js`.
   - Done: Memoria persistence moved to `core/db/repositories/memoria.js`.
   - Done: Memoria label alias and canonicalization persistence moved to
     `core/db/repositories/memoria/labels.js`.
   - Done: Memoria structured record persistence moved to
     `core/db/repositories/memoria/records.js`.
   - Done: Memoria embedding/search persistence moved to
     `core/db/repositories/memoria/embeddings.js`.
   - Done: Continuity persistence moved to
     `core/db/repositories/continuity.js`.
   - Done: InnerLife persistence moved to `core/db/repositories/innerlife.js`.
   - Done: InnerLife profile persistence moved to
     `core/db/repositories/innerlife/profile.js`.
   - Done: InnerLife inbox persistence moved to
     `core/db/repositories/innerlife/inbox.js`.
   - Done: InnerLife daemon state and tick locking moved to
     `core/db/repositories/innerlife/daemon.js`.
   - Done: InnerLife history, experience, and summary read models moved to
     `core/db/repositories/innerlife/history.js`.
   - Done: InnerLife session count/list/page/start/end persistence moved to
     `core/db/repositories/innerlife/sessions.js`.
   - Done: InnerLife prompts/share policy/compact response shaping moved to
     `core/innerlife/policy.js`.
   - Add explicit migrations before new schema-heavy features.

5. Documentation cleanup
   - Keep current architecture, development, runtime, packaging, and data docs.
   - Archive superseded phase plans and stale planning documents.
   - Remove placeholder-only directories unless they contain an active boundary.
   - Done: old phase and planning docs live under `docs/archive/`.
   - Done: current architecture and cleanup docs describe the split runtime.
   - Done: completed bugfix notes and stale polish/install logs live under
     `docs/archive/`.
   - Done: `docs/README.md` lists the current doc entry points.

6. Scheduler and runtime reliability
   - Done: InnerLife daemon enable can process pending inbox immediately from
     the UI without waiting for the background interval.
   - Done: InnerLife daemon ticks are guarded against concurrent background and
     manual execution for the same product database and agent.
   - Done: background idle ticks no longer pollute manual tick counts.
   - Done: Home/runtime snapshot is bounded to counts, summaries, and recent
     samples instead of full product lists.
   - Done: runtime resource ownership and long-run memory policy are documented
     in `docs/RUNTIME_MEMORY_POLICY.md`.
   - Done: Electron HTTP Agent Gateway ownership moved to
     `electron/http-agent-gateway.js`.
   - Done: Electron background schedulers moved to `electron/schedulers.js`.
   - Done: Electron IPC registration moved to `electron/ipc-handlers.js`.

7. Packaging resource checks
   - Done: bundled `sqlite3` tools live under `resources/sqlite/` and are copied
     through `build.extraResources`.
   - Done: `core/tests/sqlite-binary-smoke.js` verifies target files, SHA-256
     hashes, executable bits where relevant, and resolver behavior.

8. Gateway split
   - Done: `core/gateway/mcp-server.js` now owns stdio MCP transport, process
     lifecycle, database connection caching, and trace recording.
   - Done: `core/gateway/tool-definitions.js` owns MCP tool schemas.
   - Done: MCP tool schemas are grouped by domain under
     `core/gateway/tool-definitions/`.
   - Done: Memoria MCP tool schemas are split into core, maintenance/import/export/merge,
     label alias, and structured-record files.
   - Done: InnerLife MCP tool schemas are split into session/status, profile,
     share/inbox, daemon, and history/exploration files.
   - Done: `core/gateway/tools.js` owns handler dispatch.
   - Done: Gateway tool handlers are split under
     `core/gateway/tool-handlers/`.
   - Done: Memoria Gateway behavior routes through `core/memoria` instead of
     direct repository/database calls.
   - Done: Shared Line Gateway behavior routes through `core/continuity`.
   - Done: InnerLife Gateway behavior routes through `core/innerlife`.

## Before New Features

Complete these first:

1. Done: renderer split has moved major views into `app/views/`; further work is
   now fine-grained extraction rather than one-file expansion.
2. Done: `styles.css` is now an ordered import entry for structured CSS files.
3. Done: stale plans are archived under `docs/archive/`; current entry docs are
   `ARCHITECTURE.md` and `CLEANUP_PLAN.md`.
4. Done: `core/config` owns real settings defaults and validation.
5. Done: database migrations/repositories and runtime path boundaries exist.

Remaining refinement:

- Keep shrinking `app.js` only when event wiring naturally belongs with a view.
- Consider splitting `core/runtime/imports/legacy-innerlife.js` further if old
  InnerLife migration grows again.
- Consider smaller schema helper builders only if individual Gateway schema
  groups become repetitive.
- Consider splitting Memoria repository search/records/maintenance sections if
  persistence changes keep growing.
- Consider a separate gateway repository if gateway trace persistence expands.
- Continue moving deeper domain rules out of repository methods when Memoria,
  Shared Line, or InnerLife behavior is next changed.

## Development Target For Tomorrow

Tomorrow's new features should start only after:

- `npm run check` passes.
- `npm run test:smoke` passes for structural or runtime changes.
- Current architecture docs are committed or at least up to date.
- New feature entry point is chosen before coding.
- New renderer behavior goes into `app/views/*` or `app/actions/*`, not
  `app.js`.
- New product behavior goes into a domain module, not directly into
  `core/runtime/index.js` or `core/db/database.js`.
- New Electron host behavior goes into `electron/ipc-handlers.js`,
  `electron/http-agent-gateway.js`, `electron/schedulers.js`, or another
  focused Electron module, not directly into `electron/main.js`.

## Rules For Future Changes

- Do not add new renderer behavior directly to `app.js` when a smaller module
  can own it.
- Do not add new domain behavior directly to `core/runtime/index.js`.
- Do not add product semantics directly to the SQLite adapter.
- Do not add full product lists to `buildProductSnapshot()`; page or lazy-load
  large views through focused IPC calls.
- Do not add long-lived resources without a clear owner and dispose path.
- Do not leave placeholder directories with only aspirational README files.
- Keep `memoria` as the product name; do not introduce new `memory` module
  directories.
- Keep packaged runtime resources covered by a smoke check before depending on
  them in `electron-builder` config.
