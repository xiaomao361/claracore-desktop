# ClaraCore Desktop Product Data Design

## Decision

ClaraCore Desktop is a new main product built from an empty product core.

Existing `services/memoria`, `services/continuity`, `services/innerlife`, and `gateway` are reference implementations and feature baselines. They are not runtime dependencies for the new Desktop product.

The new product should eventually reach at least the same functional level as the original modules, while using this reset to remove old integration debt.

## Development Boundary

During the product-core phase:

- Do not migrate existing user data.
- Do not write into existing service databases.
- Do not stop or replace the current local Gateway.
- Do not assume the old checkout path is available in packaged mode.
- Build and test with a fresh Desktop-owned data directory.

Migration will be designed later after the new product has been used successfully for a while.

## Reference Systems

The existing systems define the minimum feature baseline:

### Memoria Baseline

Desktop Memory must eventually cover:

- Durable fact storage.
- Tags and source/provenance.
- Search and recall.
- Record update and deletion lifecycle.
- Import/export and backup.
- Local embedding through Ollama.
- Reviewable quality boundaries between fact and interpretation.

Current reference notes:

- Existing Memoria uses SQLite for metadata and a separate vector store.
- Existing embedding defaults are local Ollama, `bge-m3`, 1024 dimensions.
- The new product should keep Ollama as the first embedding path.

### Continuity Baseline

Desktop Shared Line must eventually cover:

- Agent-scoped current position.
- Topic/thread style continuity lines.
- Resume packet / handoff.
- Facts-used provenance.
- Interpretation status and user confirmation.
- Shared-line history.
- Lightweight affective trace where useful, without turning it into an emotion engine.

Current reference notes:

- Existing Continuity separates current position from durable memory.
- That boundary should remain: Continuity can reference facts, but should not become Memoria.

### InnerLife Baseline

Desktop InnerLife must eventually cover:

- Agent profile/state.
- Inbox/internal events.
- Reflection/digest/session lifecycle.
- Background loop controls.
- Light/deep model configuration.
- Pending share lifecycle and share-action history.
- Daemon status, heartbeat, and recovery state.

Current reference notes:

- Existing InnerLife has the most operational risk.
- The product should expose configuration early, keep the daemon paused until
  explicitly enabled, and keep human UI inspect-oriented. InnerLife state is
  created and maintained primarily by agents through MCP or CLI.

### Gateway Baseline

Desktop Gateway must eventually cover:

- One stable MCP entry for agents.
- Agent identity propagation.
- Tool list and tool call routing.
- Graceful degradation when a module is disabled.
- A generated Agent Setup document.
- Local-only access by default.

Current reference notes:

- Existing Gateway dynamically loads separate service MCP servers.
- The new product should not route through separate old service processes for normal operation.
- Product Gateway should call product core modules directly.

## Historical Debt To Remove

This reset should fix these old problems instead of preserving them:

- Multiple databases for one product experience.
- Configuration split across code constants, env files, shell scripts, and service-local defaults.
- Developer-machine absolute paths leaking into user-facing setup.
- Gateway depending on a checkout layout.
- MCP and CLI fallback documents that point agents at internal implementation details.
- Service Web UIs becoming separate product surfaces.
- Daemon behavior that is hard to see, pause, or recover from Desktop.
- Data migration pressure before the new product model is proven.

## Unified Database Direction

Use one Desktop-owned SQLite database:

```text
claracore.db
```

The database should be modular by table, not by separate files.

Primary areas:

- `app_settings`: product-owned settings.
- `secrets_refs`: configured/not-configured references, not raw displayed secrets.
- `agents`: known agents and identities.
- `memories`: durable facts and approved imported records.
- `memory_labels`: labels/tags.
- `memory_label_aliases`: canonical label aliases used to normalize user and agent input.
- `memory_sources`: provenance and import tracking.
- `memory_records`: typed structured records such as fitness logs, metric events, and recurring local observations.
- `memory_embeddings`: local Ollama embedding metadata and vectors or vector references.
- `continuity_lines`: shared-line threads/tracks.
- `continuity_positions`: current position snapshots.
- `continuity_handoffs`: resume packets.
- `innerlife_profiles`: agent InnerLife profiles.
- `innerlife_events`: inbox/internal events.
- `innerlife_thoughts`: generated thoughts and digests.
- `innerlife_shares`: pending/reviewed share candidates.
- `innerlife_digest_runs`: explicit digest runs and their inputs.
- `innerlife_share_checks`: share timing checks against current context.
- `innerlife_daemon_state`: explicit daemon status, next run, heartbeat, and last result.
- `gateway_sessions`: agent connection sessions.
- `gateway_traces`: Gateway tool-call traces for agent view and debugging.
- `runtime_events`: app and module events.
- `backups`: backup/export metadata.
- `schema_migrations`: schema history.

## Configuration Model

Configuration should be stored by Desktop and edited from Desktop.

Initial product settings:

```text
memory.embedding.provider = ollama
memory.embedding.base_url = http://127.0.0.1:11434
memory.embedding.model = bge-m3
memory.embedding.dimension = 1024
memory.embedding.max_chars = 2000

innerlife.enabled = false
innerlife.provider = disabled
innerlife.base_url = http://127.0.0.1:11434
innerlife.light_model =
innerlife.deep_model =
innerlife.loop_seconds = 900

gateway.enabled = true
gateway.transport = stdio
gateway.local_only = true

backup.enabled = true
backup.schedule = manual
```

Secrets:

- Do not store visible secret values in normal settings rows.
- Store only a secret reference/status in SQLite.
- The Models UI may store API key references for Memory embeddings and InnerLife,
  such as `env:OPENAI_API_KEY`; it should not store the secret value itself.
- Ollama providers can leave the API key reference empty.
- Later use platform secure storage where appropriate.

Provider values should leave room for a future `claracore-built-in` option. That
option is reserved for a small bundled ClaraCore model that may later cover
basic embeddings and the InnerLife daemon, but it is only a configuration
placeholder until the runtime exists.

The Models UI should present the InnerLife daemon cadence in minutes. The
database keeps `innerlife.loop_seconds` in seconds so the existing scheduler can
continue to use one internal unit.

The Models UI can discover available model names from an entered endpoint for
the implemented providers: Ollama uses `/api/tags`, and OpenAI-compatible
providers use `/v1/models`. Memoria embedding dimensions are not user-facing;
Desktop stores the dimension from the returned vector length when embeddings
are generated.

Settings is reserved for general app configuration. The current implemented
slice covers language, theme, close-window behavior, data root/path inspection,
open-data-folder, version display, runtime mode, local database state, and
Electron/Node/Chrome runtime details. Log retention, debug tracing, Gateway
local access policy, privacy/security display choices, secret-storage status,
and deeper diagnostics remain deferred.

## Vector Strategy

Start with local Ollama.

Default:

- Provider: `ollama`
- Base URL: `http://127.0.0.1:11434`
- Model: `bge-m3`
- Dimension: `1024`
- Max text length: `2000`

Early implementation should favor a simple, product-owned path:

- Store embedding metadata in SQLite.
- Store vectors in SQLite first if practical for the first usable loop.
- Keep the vector abstraction small so Chroma or another store can be added later if needed.
- Failed embedding should not block saving the memory; it should mark embedding state as pending/failed.

## Functional Parity Rule

The new module can start smaller, but it must not redefine success downward.

For each module:

1. Identify the old user-facing capabilities.
2. Build the minimal Desktop-native version.
3. Add tests for that minimal version.
4. Expand until the old baseline is covered.
5. Only then consider migration from old data.

Parity is measured by user capability, not by copying old code structure.

## Integration Opportunities

Because the modules are empty now, the product can integrate them cleanly:

- Memory facts can be referenced by Continuity through stable `memory_id` links.
- Continuity positions can create InnerLife events without copying full memory records.
- InnerLife can produce share candidates, but Memory and Shared Line writes
  happen through explicit agent calls to those product tools. The InnerLife UI
  does not auto-apply output into other modules.
- Gateway can expose one coherent product API instead of exposing three separate internal APIs.
- Runtime status can be shared across all modules in one event stream.

## Suggested Build Order

### Phase 1: Data And Settings

- Initialize `claracore.db`.
- Add migrations.
- Add settings read/write.
- Add default Ollama embedding settings.
- Show settings in Desktop from the database.

### Phase 2: Memory Minimal Loop

- Add memory create/read/list/update/delete.
- Add labels and sources.
- Add local Ollama embedding job.
- Add search: keyword first, vector when ready.
- Expose Memory through Desktop UI and Gateway MCP.
- Add typed structured records with Desktop UI, Gateway MCP, and type stats.

### Phase 3: Shared Line Minimal Loop

- Add continuity line create/read/update.
- Add current position.
- Add resume packet.
- Allow current position to reference memory IDs.
- Expose Shared Line through Desktop UI and Gateway MCP.

### Phase 4: Gateway Minimal Product Contract

- Add Desktop-owned MCP entry.
- Expose status, memory, and shared-line tools.
- Generate agent setup from product configuration.
- Keep the old Gateway untouched.
- Make the Gateway command safe for packaged macOS builds.

### Phase 5: InnerLife Controlled Loop

- Add profile/state storage.
- Add event inbox.
- Add agent-facing session, digest, share, and daemon tools.
- Add an inspect-first Desktop view for InnerLife state.
- Add daemon loop controls in Models, alongside the model provider settings.

### Phase 6: Import Preview

- Add read-only scanners for old Memoria, Continuity, and InnerLife data.
- Show import preview.
- Add copy-based import with backup.
- Do not make migration automatic.

## Next Implementation Target

The next development checkpoint should be:

- `claracore.db` is created under the Desktop product data directory.
- Product settings are initialized in the database.
- Models page reads real model values from the database.
- Ollama embedding defaults are visible and editable later.
- No old service data is read or modified.

## Phase 1 Checkpoint

Status: complete for the current product-core reset baseline.

Implemented:

- Desktop creates `claracore.db` in the product data directory.
- Schema initialization creates product-owned tables for settings, agents, memory, continuity, InnerLife, Gateway sessions, runtime events, backups, and migration history.
- Default settings are written into `app_settings`.
- Model configuration can be saved back into `app_settings` from Desktop.
- Local Ollama embedding defaults are stored in the database.
- InnerLife is stored as disabled by default.
- Secret state is represented by `secret_refs` without storing visible secret values.
- Models page reads Memoria/Ollama and InnerLife values from `claracore.db`.

Validated:

- Fresh temporary product data directory initializes successfully.
- Desktop page shows database-backed values:
  - Memory provider: `ollama`
  - Embedding endpoint: `http://127.0.0.1:11434`
  - Embedding model: `bge-m3`
  - Dimension: `1024`
  - InnerLife provider: `disabled`
- Agent setup output does not include old service paths.
- Setting changes made in the UI persist to SQLite and read back after refresh.
- `npm run test:phase1` verifies fresh database initialization, default settings, settings save/readback, secret references, product data isolation, and the old-services guard.
- `npm run test:phase1` also opens the Desktop settings page, verifies the default database-backed values are visible, saves changed values through the UI, and reads them back from the product database.

Still next:

- Add a small database-backed status card in the UI.
- Expand the first Memory loop from create/read/list to update/delete/search.
- Keep expanding regression coverage as later phases add destructive flows and import preview.

## Phase 2 Checkpoint

Status: complete for the current Memory minimal loop baseline.

Implemented:

- Desktop can create a new Memory record from the Memory page.
- Desktop can update an existing Memory record from the Memory page.
- Desktop can soft-delete a Memory record from the Memory page.
- Desktop can restore a soft-deleted Memory record from the Memory page.
- Desktop shows active, deleted, embedded, and pending-embedding Memory counts.
- Desktop shows active label counts and can search by clicking a label.
- Desktop can keyword-search Memory records by title, body, or label.
- Desktop can combine keyword search with local Ollama vector similarity when embeddings are ready.
- Desktop search falls back to keyword results when Ollama is unavailable.
- Desktop can mark a Memory as restricted and keep it out of normal list/search results.
- Desktop has an explicit restricted Memory list behind a confirmation gate.
- Desktop can create and delete Memory label aliases through agent-facing CLI/MCP surfaces.
- Desktop canonicalizes Memory labels through aliases before saving records.
- Desktop shows a bounded canvas Memory graph of Memory-label links and Shared Line fact references.
- Desktop Memory UI is view-focused: search, labels, graph, all memories, restricted memories, archived/deleted memories, and simple delete/restore.
- Desktop Memory UI list tabs are lazy and paginated. All/restricted/archived/deleted records are loaded in 20-row batches with `limit + offset` and a `Load more` control.
- Desktop Memory graph supports primary and restricted layers, drag panning, mouse-wheel zoom, and graph cache refresh during nightly maintenance.
- Desktop can check and repair Memory maintenance issues for missing/stale/failed embedding state and alias labels.
- Desktop can show conservative merge suggestions for active non-restricted Memory records.
- Desktop can merge a source Memory into a target Memory, keep the target, soft-delete the source, combine labels, and requeue the target embedding.
- Desktop can show dormant/archive suggestions for old active non-restricted Memory records.
- Desktop can archive Memory records so they leave normal list/search results without being deleted.
- Desktop can list archived Memory records and restore them to active status.
- Desktop can export Memory data to a portable JSON file outside whole-database backup.
- Desktop can import a portable Memory JSON file by adding missing records and skipping existing IDs.
- Desktop-owned Gateway MCP entry can expose Memory status/list/get/search/create/update/tag/delete/restore/stats tools over stdio.
- Desktop-owned Gateway MCP entry can expose restricted Memory list/restrict/unrestrict tools over stdio.
- Desktop-owned Gateway MCP entry can expose Memory label alias list/create/delete tools over stdio.
- Desktop-owned Gateway MCP entry can expose the bounded Memory graph over stdio.
- Desktop-owned Gateway MCP entry can expose Memory maintenance check/run/audit tools over stdio.
- Desktop-owned Gateway MCP entry can expose Memory merge suggestion/run tools over stdio.
- Desktop-owned Gateway MCP entry can expose Memory archive/list/restore and dormant archive tools over stdio.
- Desktop-owned Gateway MCP entry can expose portable Memory JSON export/import tools over stdio.
- Desktop-owned Gateway MCP entry exposes `gateway_docs` so agents can read setup notes, available tools, and CLI fallback.
- Desktop can manually generate a local Ollama embedding for a Memory record.
- Desktop Memory UI can manually process all currently pending embeddings in 20-record batches with visible progress, primarily for imported records.
- Desktop automatically processes pending Memory embeddings after create/update.
- Memory embedding state is visible in the Memory list.
- Memory search source and match score are visible in the Memory list when applicable.
- Manual Memory records are written into the product-owned `memories` table.
- Labels are written into `memory_labels`.
- Embedding metadata and vector JSON are written into `memory_embeddings`.
- Memory list reads back from `claracore.db`.
- Manual records use the `manual_desktop` source.
- Restricted records remain in `memories` with `sensitivity = restricted`.
- Restricted records are excluded from normal Memory labels/stats, normal Memory search, and vector candidates.
- Label aliases are stored in `memory_label_aliases`.
- Creating a label alias merges existing alias labels into the canonical label.
- Memory graph reads from product-owned Memory labels and Shared Line `factsUsed` references.
- Memory maintenance can requeue bad embedding state without calling Ollama directly, and can rewrite alias labels to canonical labels.
- Memory nightly maintenance runs at most once per local day by Desktop scheduler, processes a small pending embedding batch, and refreshes Memory graph cache files.
- Desktop Logs page shows runtime events and Gateway traces in a terminal-style auto-refreshing debug console.
- Desktop Home reports Memoria as product-ready from the Desktop runtime snapshot when the product database is initialized and Memoria MCP/CLI surfaces are available; this status is independent of the old Memoria service process.
- Memory merge suggestions are generated only from active non-restricted Memory records.
- Memory merge is conservative: the target stays active, the source becomes deleted, and restricted records are blocked from merge.
- Memory archive suggestions are generated only from active non-restricted Memory records older than the configured age threshold.
- Archived Memory records are excluded from normal list/search and vector candidates, but are restorable.
- Portable Memory JSON archives include memories, deleted/restricted state, labels, label aliases, and structured records.
- Portable Memory JSON archives intentionally omit machine-specific embedding vectors; imported active non-restricted memories are queued for embedding regeneration.
- Portable Memory JSON import does not delete or overwrite current product records; duplicate IDs are skipped.

Deferred:

- Old Memoria REST API compatibility is intentionally deferred. Desktop's Memoria surface is MCP/CLI-first for agents and view-first for humans.
- Permanent Memory purge remains deferred until a stricter confirmation and audit trail are designed.
- Conflict/outdated candidate reports and persisted nightly JSON review artifacts remain future maintenance enhancements.

Validated:

- Fresh temporary product data directory initializes successfully.
- A Memory saved through the Desktop UI appears in the Memory list.
- A Memory updated through the Desktop UI reads back with updated title, body, and labels.
- A Memory deleted through the Desktop UI is hidden from the active list and marked `deleted` in SQLite.
- A Memory restored through the Desktop UI leaves the deleted list and returns to the active list.
- Memory stats reflect active/deleted counts and labels after delete/restore.
- Keyword search returns matching Memory records from SQLite.
- The same Memory is present in SQLite with its labels.
- Local Ollama embedding succeeds with `bge-m3` and stores a 1024-length vector.
- Vector-assisted Memory search returns semantic matches from stored SQLite vectors.
- Desktop UI search shows keyword + vector results after automatic embedding.
- Desktop UI search shows a fallback message and still returns keyword results when the Ollama endpoint is unavailable.
- Gateway MCP smoke test can initialize, list tools, create a Memory, update it, search it back, soft-delete it, restore it, and read stats from the same Desktop-owned SQLite database.
- Gateway MCP smoke test can read `gateway_docs`, including current data directory and available tools.
- Memory maintenance smoke test can detect seeded missing embedding state and seeded alias-label drift, dry-run without mutation, then repair both.
- Memory UI smoke test verifies the view-focused UI, lazy/paginated lists, restricted-content confirmation, canvas graph controls, and delete/restore paths.
- Memory merge smoke test can detect duplicate Memory records, merge them, preserve combined labels/body, and move the source to deleted records.
- Memory archive smoke test can detect a dormant Memory, dry-run archive, archive it, verify it leaves normal search, then restore it.
- Memory archive smoke test exports JSON, verifies archive shape, imports into a fresh product database, preserves deleted Memory state, restores structured records, and skips duplicate imports.
- Bad Ollama configuration marks the Memory embedding as `failed` and stores the error message.
- Automatic embedding processing succeeds when Ollama is available and fails visibly when the configured endpoint is unavailable.
- This does not read or write old Memoria data.
- `npm run test:phase2` verifies Memory create/search/update/delete/restore, restricted-content isolation, archive/restore, dormant archive suggestions, stats, labels, label search, label alias canonicalization, Memory graph, maintenance check/repair, merge suggestions/merge execution, portable JSON export/import, manual source, structured records, embedding failure visibility, product data isolation, Gateway docs, Gateway Memory tools, and the Desktop UI viewing/deletion flow.

Still next:

- Link Memory records into Shared Line current positions where useful.
- Keep full old-service migration import backup-gated and separate from portable Memory JSON import.

## Phase 3 Checkpoint

Status: complete for the current Shared Line minimal loop baseline.

Implemented:

- Desktop initializes a default Shared Line in `continuity_lines`.
- Desktop can create multiple Shared Lines and switch the active line.
- Desktop can rename, archive, and restore Shared Lines without deleting their history.
- Desktop can save the current shared position into `current_positions`.
- Desktop writes every saved shared position into `continuity_position_history`.
- Desktop writes every saved shared position into `continuity_snapshots`.
- Desktop blocks overwriting a confirmed Shared Line unless the caller explicitly confirms the overwrite.
- Desktop can generate a resume packet from the current shared position.
- Resume packet includes recent Shared Line history.
- Runtime snapshot includes recent Shared Line snapshots.
- Runtime snapshot includes the Shared Line list and active line marker.
- Resume packet includes recent handoff records.
- Shared Line page can save and display the current position.
- Shared Line page can create and switch Shared Lines.
- Shared Line page can rename, archive, and restore Shared Lines.
- Shared Line page can display recent saved history.
- Shared Line page can display recent snapshots.
- Shared Line page asks for confirmation before overwriting a confirmed position.
- Shared Line page can create and display recent handoffs.
- Shared Line page can display a copyable resume packet.
- Desktop-owned Gateway MCP entry exposes `shared_line_get` and `shared_line_update`.
- Desktop-owned Gateway MCP entry exposes `shared_line_list`, `shared_line_create`, and `shared_line_activate`.
- Desktop-owned Gateway MCP entry exposes `shared_line_rename`, `shared_line_archive`, and `shared_line_restore`.
- Desktop-owned Gateway MCP entry exposes `shared_line_handoff_create`.
- Gateway docs include Shared Line tools.

Validated:

- Fresh temporary product data directory initializes the default Shared Line.
- Database save/read can create a second Shared Line and keep positions separate by line.
- Database save/read can rename, archive, block activation of archived lines, and restore archived lines.
- Database save/read returns the same current position and resume packet text.
- Database save/read returns recent Shared Line history.
- Database save/read blocks unconfirmed overwrite of confirmed positions.
- Database save/read records confirmed-overwrite snapshots.
- Database save/read returns recent handoff records.
- Desktop UI can save a current position and refresh the resume packet.
- Desktop UI can create a second Shared Line, save to it, and switch back to the default line.
- Desktop UI can rename, archive, and restore a second Shared Line.
- Desktop UI can save multiple positions and show recent history.
- Desktop UI can confirm overwriting a confirmed position and show the snapshot.
- Desktop UI can create a handoff and show it in the resume packet.
- Gateway MCP smoke test can update the Shared Line and read it back through stdio.
- Gateway MCP smoke test can create, list, activate, and update a separate Shared Line.
- Gateway MCP smoke test can rename, archive, and restore a separate Shared Line.
- Gateway MCP smoke test blocks unconfirmed confirmed-position overwrites and accepts explicit confirmation.
- Gateway MCP smoke test verifies recent Shared Line history is returned to agents.
- Gateway MCP smoke test verifies handoff creation and handoff context are returned to agents.
- This does not read or write old Continuity data.
- `npm run test:phase3` verifies default Shared Line initialization, multiple Shared Lines, active-line switching, line rename/archive/restore, current position save/readback, history storage, snapshot storage, confirmed-overwrite protection, resume packet content, `factsUsed` storage, product data isolation, Gateway docs, Gateway Shared Line tools, and the Shared Line UI history/snapshot/multi-line flow.
- `npm run test:phase4` verifies `shared_line_handoff_create` is part of the formal Gateway contract and Gateway docs.

Still next:

- Link current positions to Memory IDs.
- Add resume modes, privacy flags, merge/delete/compact, and agent state.

## Phase 3 Continuity Parity Checkpoint

Status: complete for the current Desktop-native Continuity review surface and old Continuity copy-import baseline.

Date: 2026-06-26.

Implemented:

- Desktop can import old Continuity `session_threads`, `handoffs`, and `state_snapshots` by copy into the Desktop-owned product database.
- Import creates a product backup first and does not mutate the old Continuity service database.
- Imported `session_threads` become Desktop `continuity_lines`.
- Imported thread state is written into `current_positions`, `continuity_position_history`, and `continuity_snapshots`.
- Imported legacy fields are preserved in `current_positions.metadata_json` for review and future testing.
- Imported handoffs are written into `continuity_handoffs`.
- Shared Line UI follows the same product direction as Memoria: humans mainly review and inspect; agents create/update/archive/restore through CLI and Gateway MCP.
- Shared Line UI now exposes line browsing, current position, legacy metadata, history, snapshots, handoffs, and resume packet review in one Desktop surface.
- Line cards include agent, mode, visibility, interpretation status, confirmation, current position, and next step where available.
- The line list can be filtered by agent.
- Clicking a line selects it for right-side detail review and does not activate it or reorder the list.
- The old page-level duplicate Shared Line heading and misleading `current line` pill were removed from the Shared Line page; the global page title is enough, and line selection is shown by the list/detail state.
- The current position, next step, history, snapshots, handoff next step, position trace, and affective trace are rendered as readable rows instead of raw long text blocks.
- The right-side detail panel groups imported fields into basic info, progress, boundary, and trace sections.
- Chinese UI names the human-facing Memory navigation/page as `记忆`, while keeping `Memoria` as the technical module name where appropriate.

Validated:

- Old Continuity import was run against the local old Continuity database and produced Desktop-owned imported lines, positions/history, snapshots, and handoffs.
- Product database contains imported Continuity data plus the default Desktop line.
- Imported old thread metadata was backfilled into `current_positions.metadata_json`.
- Shared Line card selection was corrected so `getSharedLine({ lineId })` refreshes the selected detail panel.
- `npm run check` passes after the UI and documentation updates.
- Smoke tests were intentionally not run for this checkpoint.

Still next:

- Decide whether any legacy Continuity fields should become first-class columns instead of metadata-only fields.
- Add richer agent identity display if multiple agent naming schemes appear in imported data.
- Keep human editing minimal unless a real correction workflow appears.

## Phase 4 Checkpoint

Status: complete for the current Desktop-owned Gateway baseline.

Implemented:

- Desktop has a product-owned stdio Gateway under `core/gateway/`.
- Development Gateway command uses `node core/gateway/mcp-server.js`.
- Packaged Gateway command uses the app executable with `--gateway`.
- Agent Setup uses the correct Gateway command for development vs packaged mode.
- Gateway docs expose the active data directory, available tools, MCP config, and fallback command.
- Gateway exposes `gateway_context`, an assembled agent packet containing Shared Line, recent Memory, InnerLife state, Doctor guidance, and old-service safety guidance.
- Gateway records tool-call traces in `gateway_traces`.
- Gateway exposes `gateway_trace_list` for recent successful and failed tool calls.
- Agent Setup page shows recent Gateway traces as the first trace-viewer baseline.
- Agent Setup tells agents to call `gateway_context` first after connecting.
- Home page shows a first-run check for data directory write access, database, Gateway entry, embedding setup, and old-service isolation.

Validated:

- Electron `--gateway` mode can initialize, list tools, and return Gateway docs without opening the UI.
- Packaged `.app` `--gateway` mode can create and search a Memory record.
- Packaged `.app` `--gateway` mode can return `gateway_context` with Memory, Shared Line, and Doctor status.
- Packaged `.app` `--gateway` mode can return `gateway_trace_list`.
- Packaged Desktop UI opens and shows Agent Setup with `--gateway`.
- Packaged Desktop UI shows first-run check as ready, including the data-directory write probe.
- `npm run pack:mac` creates `dist/mac-arm64/ClaraCore Desktop.app`.
- `npm run dist:mac` creates `dist/ClaraCore-Desktop-0.1.0-arm64.dmg`.
- Generated DMG mounts successfully and contains `ClaraCore Desktop.app`.
- Packaged app includes the ClaraCore icon assets instead of default Electron icons.
- `npm run test:phase4` verifies the development Agent Setup MCP config, active product data root, complete Gateway tool list, Gateway docs, status output, `gateway_context`, Gateway trace recording for success/failure, Agent Setup trace rendering, and old-service isolation text.
- `npm run test:phase4:packaged` rebuilds the packaged app and verifies the app executable works with `--gateway` for Gateway docs, `gateway_context`, `gateway_trace_list`, Memory tools, Shared Line tools, and product data isolation.

Still next:

- Add code signing and notarization.
- Add more user-facing recovery text when a first-run check fails.
- Expand the user-facing install checklist after signing/notarization is available.

## Phase 5 Checkpoint

Status: complete for the current agent-managed InnerLife baseline, explicit
daemon controls in Models, safe Desktop scheduling, retry/backoff recovery,
Doctor guidance, and Desktop-native inspection UI.

Implemented:

- InnerLife remains paused as an automatic daemon by default.
- Desktop can start an InnerLife session and return a briefing from current Shared Line, recent Memory, pending shares, and recent thoughts.
- Desktop can end an InnerLife session with a summary.
- Ending a session writes an `innerlife_events` row, an `innerlife_thoughts` row, and a pending `innerlife_shares` afterthought.
- Desktop can submit inbox items for later InnerLife processing.
- Desktop can run an explicit InnerLife digest.
- A digest writes an `innerlife_digest_runs` row, an `innerlife_events` row, and an `innerlife_thoughts` row, then marks consumed inbox items as processed.
- Agent-triggered processing consumes pending inbox items and marks them processed.
- Agent-triggered processing reads the current Shared Line and recent Memory context from `claracore.db`.
- Agent-triggered processing writes an `innerlife_events` row, an `innerlife_thoughts` row, and a pending `innerlife_shares` row.
- InnerLife page shows profiles, inbox, events, thoughts, sessions, shares, digest runs, and share-action history as inspectable product state.
- InnerLife page has agent filtering like Memoria and Shared Line.
- Desktop can check whether a pending/approved/deferred share fits the current context.
- Share timing checks write `innerlife_share_checks` rows and do not automatically change share status.
- Share status stays in `innerlife_shares`; output is not automatically copied into Memory or Shared Line.
- Memory and Shared Line updates from InnerLife happen only when an agent explicitly calls the corresponding product tools.
- InnerLife session counts, share counts, event counts, and thought counts are visible in Desktop.
- InnerLife daemon state is stored in `innerlife_daemon_state`.
- InnerLife daemon remains paused by default.
- Desktop can enable, pause, and manually tick the InnerLife daemon from the Models page.
- Desktop runs a lightweight automatic scheduler after startup, but it only processes when the daemon is enabled.
- A daemon tick records status, next run, last tick, last result, and tick count.
- A daemon tick with no pending inbox records an idle tick and does not create output.
- A daemon tick with pending inbox creates only a reviewable pending share.
- A failed daemon tick records `status = error`, `last_error`, `failureCount`, `retrySeconds`, and a delayed `next_run_at`.
- Failed daemon ticks leave pending inbox material pending so it can be retried.
- A successful retry clears the daemon failure count and recovery delay.
- Desktop shows daemon recovery state in the Models page.
- Desktop shows InnerLife Doctor status and recovery guidance in the Models page.
- The scheduler does not run in `--gateway` mode.
- Gateway exposes InnerLife daemon status, enable/pause, tick, and Doctor tools.
- No old InnerLife daemon or old service data is started, read, or modified.
- The Models page owns Memoria embedding settings, InnerLife model settings, endpoint model discovery, secret references, loop cadence in minutes, and daemon controls.
- The Settings page owns implemented appearance/window preferences, local data-path inspection, and read-only app/runtime details.

Validated:

- `npm run test:phase5` verifies session start, briefing, idempotent external session IDs, session end, reviewable afterthought creation, inbox submission/processing, explicit digest records, share timing checks, daemon pause/enable/tick/pause, daemon failure state, retry delay, pending-input preservation, Doctor recovery guidance, successful retry, Doctor clearing, Memory context use, Shared Line context use, pending share creation, share lifecycle, SQLite counts, product data isolation, and old-service isolation.
- Development Desktop UI can show InnerLife session and daemon state, inspect inbox/events/thoughts/shares/digests, filter by agent, show Doctor state, and operate daemon enable/pause/tick from Models.
- `npm run test:phase5:scheduler-ui` verifies the Desktop scheduler processes a pending inbox item automatically after the daemon is enabled, refreshes the UI, creates only a reviewable pending share, and stops again after pause.
- `npm run test:phase4` verifies Gateway docs and tool calls for InnerLife daemon status, enable/pause, tick, and Doctor.

Still next:

- Replace deterministic digest/timing with model-backed digest/timing.
- Add model-backed generation after the agent-managed MCP/CLI contract stays stable.
- Add richer repeated-failure workflows such as one-click pause, export diagnostic bundle, and model-provider repair checks.

## Backup Checkpoint

Status: started.

Implemented:

- Data page can create a product-owned backup from the current `claracore.db`.
- Backup uses a SQLite-consistent database copy through `VACUUM INTO`.
- Backups are written under the Desktop product data directory `backups/`.
- Backup metadata is recorded in the `backups` table.
- Data page lists recent backups with status, creation time, and path.
- Each backup has a sidecar JSON manifest for inspection.
- Each backup is reopened and checked with SQLite `quick_check`.
- Verified backups are marked `verified`; failed checks are marked `failed`.
- Data page can open the backup directory.
- Data page can restore a verified product backup after user confirmation.
- Restore confirmation shows a current-vs-target preview before requiring the `RESTORE` phrase.
- Restore preview shows Memory records that will return, be removed, or be reverted to the backup version.
- Restore requires both a confirmation dialog and typing `RESTORE` in the page.
- Restore creates a safety backup of the current database before replacing it.
- Restore re-registers that safety backup in the restored database so it remains visible after restore.
- Restore records a local runtime event in the restored database.
- Import remains disabled until the old-data migration model is designed.

Validated:

- Runtime backup creation produces a `.db` file in the product backup directory.
- The backup database can be opened and contains a test Memory record.
- The backup record appears in the runtime snapshot.
- Development Desktop UI can create and list a backup.
- Packaged Desktop UI can create and list a backup.
- Development and packaged Desktop UI create both `.db` and `.json` backup files.
- Development and packaged Desktop UI show backup verification status and `quick_check` result.
- Runtime restore test confirms data created after the restore point is removed and restore-point data returns.
- Development Desktop UI verifies cancel, wrong phrase, and correct `RESTORE` phrase paths.
- Development Desktop UI shows restore preview with memory counts and `quick_check`.
- Development Desktop UI shows record-level Memory restore preview and restores the expected records.
- Packaged Desktop UI shows restore preview and restores a verified backup after the `RESTORE` phrase is entered.
- Packaged Desktop UI shows record-level Memory restore preview and restores the expected records.
- Final macOS DMG was rebuilt after the backup flow was added.
- `npm run test:backup` verifies SQLite backup creation, sidecar manifest, `quick_check`, restore preview record diff, safety backup file creation and re-registration, Memory restore/removal, Shared Line restore, runtime restore event, and product data isolation.
- `npm run test:backup:ui` verifies the development Desktop UI export button, verified backup listing, record-level restore preview, `RESTORE` confirmation, Memory restore/removal, Shared Line restore, and post-restore safety backup visibility.

Still next:

- Expand restore preview beyond Memory records when Shared Line history becomes destructive enough to need item-level review.

## Import Preview Checkpoint

Status: complete for scanner baseline, backup-gated old Memoria import, backup-gated old Continuity import, and backup-gated old InnerLife import.

Implemented:

- Desktop scans old Memoria, Continuity, and InnerLife candidate paths in read-only mode.
- Default candidates are under `~/.claracore/memoria`, `~/.claracore/continuity`, and `~/.claracore/innerlife`.
- Scanner also respects `MEMORIA_ROOT`, `CONTINUITY_ROOT`, `INNERLIFE_ROOT`, and `INNERLIFE_DB_PATH` for explicit preview paths.
- Scanner reports whether each old database exists, SQLite `quick_check`, table names, selected table counts, file size, and modified time.
- Scanner reports adjacent known files such as `label_aliases.json`, `model_adjustments.json`, and `innerlife.env` without reading secrets into normal settings.
- Scanner builds a copy-based import plan preview with candidate row counts, mapped target areas, and skipped unknown tables.
- Scanner includes up to three read-only, truncated sample rows per mapped candidate table so the operator can validate real-machine data shape before importing.
- Data page shows the import preview.
- Data page shows source path, `quick_check`, candidate rows, mapped target tables, skipped tables, import requirement, and sample rows for each old source.
- Data page can import old Memoria after explicit confirmation.
- Data page can import old Continuity after explicit confirmation.
- Data page can import old InnerLife after explicit confirmation.
- Old Memoria import creates a verified product backup first.
- Old Memoria import reads the source database read-only and verifies the source size and modified time did not change.
- Old Memoria `memories` and `records` rows are copied into product-owned Memory records with imported labels.
- Old Continuity import creates a verified product backup first.
- Old Continuity import reads the source database read-only and verifies the source size and modified time did not change.
- Old Continuity lines, current positions, snapshots, history, and handoffs are copied into product-owned Shared Line records with stable imported IDs.
- Old InnerLife import creates a verified product backup first.
- Old InnerLife import reads the source database read-only and verifies the source size and modified time did not change.
- Old InnerLife profiles, agent state, inbox events, internal events, pending shares, digest runs, sessions, share actions, summaries, autonomous experiences, exploration runs, convergence runs, and source subscriptions are copied or preserved as product-owned InnerLife records with stable imported IDs where possible.
- Old InnerLife shares remain inspectable records; import does not automatically apply them to Memory or Shared Line.

Validated:

- `npm run test:import-preview` creates temporary old Memoria, Continuity, and InnerLife databases, verifies counts, verifies adjacent files are detected, verifies read-only sample rows, verifies product data isolation, verifies old Memoria, old Continuity, and old InnerLife imports create backups, imports old memories/records/lines/positions/handoffs/profiles/events/thoughts/shares, skips duplicate imports, and verifies source file size/mtime do not change.
- `npm run test:import-preview` also verifies candidate row counts, skipped unknown tables, sample row previews, and Memoria, Continuity, and InnerLife import enabled states.
- Development Desktop UI shows the import preview with old source names and counts.
- `npm run test:import-preview:ui` opens the Desktop UI with temporary old databases, verifies candidate rows, skipped tables, enabled import states, sample rows, and verifies the Data page can import old Memoria, old Continuity, and old InnerLife with backups.

Still next:

- Shift deeper import, restore preview, diagnostics, and maintenance operations toward Gateway/MCP tools first.
- Keep UI focused on source preview, state visibility, configuration, simple correction, and simple delete/restore/edit paths.

## Regression Checkpoint

Status: active baseline.

Use this command before and after meaningful product-core changes:

```bash
npm run test:smoke
```

It runs syntax checks and the current non-packaged product smoke coverage:

- Phase 1 data/settings.
- Phase 2 Memory.
- Phase 3 Shared Line.
- Phase 4 development Gateway contract.
- Phase 5 agent-managed InnerLife.
- Backup/restore runtime path.
- Import preview scanner.

Packaged macOS validation remains separate because it rebuilds the app:

```bash
npm run test:phase4:packaged
npm run test:backup:ui
npm run dist:mac
```
