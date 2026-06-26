# ClaraCore Desktop Product Core Reset

## Decision

ClaraCore Desktop is the main product.

It is not a shell around Gateway, Memoria, Continuity, and InnerLife. It is the user-facing app where normal daily use happens.

Existing ClaraCore modules remain valuable references, but the new Desktop product should be designed as a standalone product and should not depend on the current local Gateway or service Web UIs for normal use.

## Immediate Safety Boundary

Current local ClaraCore usage must not be disturbed.

Development rules:

- Do not stop, replace, or mutate the user's current local Gateway.
- Do not migrate or rewrite existing `~/.claracore` data during product-core work.
- Treat existing Gateway, Memoria, Continuity, and InnerLife as references and migration sources, not runtime dependencies.
- New product data should use a separate development directory until migration is deliberately planned.
- Old data migration comes later, after the product data model is stable.

## Product Shape

The app should open and contain everything needed for normal use:

- Memory management.
- Shared-line/current-position management.
- InnerLife state and model configuration.
- Agent connection setup.
- Data import/export and backup.
- Model and embedding configuration.
- Local resource and runtime status.
- Gateway-like agent access owned by the app.

The app should not send users to separate service Web UIs for ordinary workflows.

## Agent-First Product Direction

Desktop is the product runtime and control center, but the main operator is the
agent through the Desktop-owned Gateway.

Human UI should stay light:

- View health, data state, recent activity, traces, and configuration.
- Make small corrections such as edit, delete, restore, rename, and simple
  settings changes.
- Run explicit high-risk actions such as import, backup, restore, and daemon
  enable/pause.
- Avoid building approval-heavy or workflow-heavy human operation panels.

Human UI should not become the primary deep-management surface. Deep and
repeatable operations should be exposed first as product-core APIs and Gateway
MCP tools, with UI controls only where human visibility or simple correction is
needed.

At the same time, Desktop UI must still cover the old systems' user-visible
capabilities. Coverage means the capability exists inside the Desktop product
and can be reached by either UI or Gateway as appropriate:

- UI covers viewing, search, status, configuration, diagnostics, and small
  corrections.
- Gateway covers agent-driven create/update/search/import/export/maintenance
  operations.
- Core modules own the actual behavior and data integrity.

The Desktop visual style should carry the old systems into one consistent
ClaraCore product style. Do not restyle the old Web UIs as product surfaces;
instead, implement the needed product UI in Desktop using the shared Desktop
style.

## Existing Service UI Position

The three service Web UIs are not long-term product surfaces.

They may remain temporarily as development or comparison tools, but we should not spend product effort restyling or extending them.

Implication:

- Do not redesign the Memoria Web UI as the product memory UI.
- Do not redesign the Continuity Web UI as the product shared-line UI.
- Do not redesign the InnerLife Web UI as the product InnerLife UI.
- Rebuild the needed workflows directly inside Desktop.

## Proposed Repository Structure

The existing Electron app should grow into a product repo with explicit internal boundaries:

```text
apps/claracore-desktop/
  app/                  # Electron renderer UI, pages, components
  electron/             # Electron main/preload process
  core/                 # Product core logic
    db/                 # Unified SQLite schema and migrations
    memory/             # Memory domain logic
    continuity/         # Shared-line/current-position domain logic
    innerlife/          # InnerLife domain logic
    gateway/            # Agent-facing MCP/HTTP entry owned by Desktop
    config/             # App/service configuration model
  runtime/              # Bundled runtime assets, Python plan, launch helpers
  migrations/           # Importers from old Memoria/Continuity/InnerLife data
  docs/                 # Product, architecture, packaging, and agent docs
```

Use `core/`, not `lib/`, because this is the product's internal core rather than a generic helper library.

## Unified Database Direction

The product should converge on one app-owned SQLite database.

Detailed product data design lives in `docs/product-data-design.md`.

Working name:

```text
claracore.db
```

Initial domains:

- `memories`: durable user-approved or imported memory records.
- `memory_sources`: provenance and import/source tracking.
- `memory_vectors`: vector index references or cached embedding metadata.
- `continuity_lines`: shared-line threads or tracks.
- `current_positions`: current interpretation, active context, and resume state.
- `innerlife_events`: background events and observations.
- `innerlife_thoughts`: generated or reviewed thoughts.
- `agent_connections`: agent identities, setup metadata, and access state.
- `app_settings`: model, endpoint, runtime, and feature settings.
- `runtime_events`: local app/service events.
- `backups`: backup metadata.
- `schema_migrations`: database migration history.

This database is for the new product. It should not replace existing local databases until import/migration is explicitly built and validated.

## Data Migration Strategy

Migration is later, not now.

Phases:

1. Define the new schema.
2. Build the new product against empty/new data.
3. Add read-only scanners for old Memoria, Continuity, and InnerLife data.
4. Add import preview.
5. Add copy-based import.
6. Add backup-before-import.
7. Only then consider using old data as the default user path.

Never make the first stable product depend on destructive or in-place migration.

## Gateway and Agent Strategy

Desktop should own the product Gateway.

Rules:

- Agents connect to the Desktop-owned Gateway.
- The existing local Gateway remains untouched during this product reset.
- The product Gateway should be built under `core/gateway/`.
- Existing Gateway code can be used as a reference.
- The product Gateway should expose one stable agent contract.
- Sub-service MCP entry points are not primary product contracts.
- CLI fallback can exist for development and recovery, but not as the main path.

Agent Setup remains important, but it should eventually describe the Desktop-owned product Gateway, not the old local checkout path.

## Configuration Strategy

Configuration should be product-owned and visible inside Desktop.

Model configuration belongs on the Models page, not the general Settings page:

- Memory embedding provider.
- Embedding model.
- Embedding endpoint.
- InnerLife provider.
- InnerLife light/deep model.
- InnerLife loop settings.

Settings is reserved for general app and runtime configuration:

- Language and theme.
- Window and tray behavior.
- Data, backup, import, and export paths.
- Log retention and debug tracing.
- Gateway local access policy, port, and transport preference.
- Privacy and security display choices, automatic maintenance policy, and secret-storage status.
- Development paths, packaged runtime information, and diagnostic toggles.

Other product configuration areas:

- Agent access configuration.
- Runtime paths.
- Backup settings.

Secrets:

- Do not show secret values by default.
- Store secret references separately from normal settings.
- Prefer platform-appropriate secure storage later.
- Early development can use local private files, but the UI should show only configured/not configured.

## Bundled Runtime Direction

The finished app should not require the user's conda environment.

Long-term packaged mode:

- Desktop includes or installs a self-contained runtime.
- Runtime paths are internal to the app or app data directory.
- Python and service execution are not resolved through absolute developer-machine paths.

Development mode:

- May use local tools.
- Must clearly mark paths as development-only.
- Must not leak hardcoded local paths into agent-facing production docs.

## Current Code Optimization Notes

These are known issues in the current v0.1/v0.2 exploratory code and should be corrected as part of the reset:

### Tray State

The tray/menu-bar behavior is not visible enough.

Follow-up:

- Add a visible tray/status indicator in the app.
- Add platform-specific validation for macOS menu bar and Windows tray.
- Make hide/show/quit behavior explicit.

### Absolute Paths

The current UI and generated agent setup include absolute development paths.

Follow-up:

- Introduce runtime path abstraction.
- Separate development paths from packaged paths.
- Avoid exposing developer-machine paths in production setup docs.
- Use app data directories and relative package resources in packaged mode.

### Windows

Windows should be considered from the start, even if macOS ships first.

Follow-up:

- Avoid POSIX-only path assumptions.
- Use `path.join` and platform-aware app data paths.
- Plan Windows tray behavior explicitly.
- Keep packaging layout cross-platform.
- Avoid shell scripts as the only product execution path.

## New Development Sequence

Do not continue building service-wrapper features.

Recommended next steps:

1. Freeze the product reset decision in docs.
2. Add a minimal `core/` skeleton.
3. Define the first SQLite schema draft.
4. Add a local development database under an isolated Desktop dev data directory.
5. Initialize product settings in the database, including local Ollama embedding defaults.
6. Move Desktop UI data reads away from old absolute ClaraCore paths.
7. Build the first internal Memory page against the new database.
8. Build the first internal Shared Line page against the new database.
9. Build the first internal Models page backed by product settings.
10. Build the Desktop-owned agent setup contract.
11. Only after that, design importers from existing systems.

## What Not To Do Next

- Do not restyle old service Web UIs.
- Do not wire Desktop deeper into the existing local Gateway.
- Do not migrate existing user data in place.
- Do not lower module capability targets below the original service baselines.
- Do not make the old checkout path the product runtime path.
- Do not rely on conda as the packaged runtime.

## Success Criteria For The Reset Phase

This reset phase is complete when:

- The repo has a clear product-core structure.
- The app can run with an isolated development database.
- No existing local Gateway is stopped or replaced.
- No existing local data is modified.
- Desktop pages start reading from the new product core rather than old service paths.
- A clear migration plan exists, but migration has not run automatically.
