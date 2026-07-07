# ClaraCore Desktop

## Agent-First Principle

For the next development window, ClaraCore Desktop should be treated as software
for agents to use and for humans to inspect. Human-facing UI exists to make
agent state, data, runtime health, backups, and recovery understandable and
controllable; the primary operational path should be friendly to connected
agents. Agent Access is therefore a first-class product surface, not a
secondary settings page.

Agent Access exposes the current Streamable HTTP MCP endpoint, a stdio MCP
fallback config, and token-protected localhost helper URLs while the desktop
app is running. The setup note should not show a LAN URL by default. The
localhost HTTP surface uses stable default port `50668` and a persisted bearer token
stored in a local `0600` token file, so long-lived MCP clients do not need
manual reconfiguration after every app restart. LAN binding is intentionally
off and should only become available through an explicit product mode with
clear bind address, bearer token, token regeneration, and disable controls.

ClaraCore Desktop is the local desktop manager for the first ClaraCore core package:

- Gateway
- Memoria
- Continuity
- InnerLife

It is not a chat client and does not include a primary chat model. The desktop app is meant to make the local core visible, configurable, and eventually manageable without starting every service by hand.

## Active Development Docs

Read these before adding new features:

- [Architecture](docs/ARCHITECTURE.md): current runtime, renderer, core, database,
  Gateway, and documentation boundaries.
- [Cleanup Plan](docs/CLEANUP_PLAN.md): active technical-debt cleanup order before
  feature expansion.
- [Runtime Memory Policy](docs/RUNTIME_MEMORY_POLICY.md): small snapshot,
  pagination, resource ownership, memory telemetry, and long-run checks.
- [macOS Packaging](docs/mac-packaging.md): current local packaging and packaged
  Gateway validation notes.
- Module boundary notes:
  - [Renderer modules](app/README.md)
  - [Runtime](core/runtime/README.md)
  - [Database repositories](core/db/repositories/README.md)
  - [Memoria](core/memoria/README.md)
  - [Continuity / Shared Line](core/continuity/README.md)
  - [InnerLife](core/innerlife/README.md)
  - [Gateway](core/gateway/README.md)

## Current Status

The current version is `0.4.3`. It is a working desktop shell with a
product-owned local data store, Desktop-native Memoria, Shared Line, InnerLife,
a Desktop-owned Gateway, with model configuration merged into the Settings
surface.

Included:

- Electron desktop app
- ClaraCore root detection
- Product-owned SQLite data root under Desktop user data
- Home, Memoria, Shared Line, InnerLife, Agent Access, Logs, and Settings pages (model and data management live inside Settings tabs)
- Home dashboard with Gateway, Memoria, Shared Line, InnerLife, agent-view, attention queue, and Gateway trace summaries; attention counts only human-actionable signals (agent-owned waiting state like pending shares stays ambient, and Gateway errors age out of attention after 30 minutes)
- Compact Home status board that merges the runtime strip and core module readiness below the Agent View and Attention panels
- Gateway trace chain on Home that expands one priority call as `agent -> Desktop Gateway -> MCP tool -> result`, compresses additional calls into a recent list, and sends overflow review to Agent Access
- Agent Setup page with Streamable HTTP MCP endpoint, stdio fallback config, token-protected localhost helper URLs, CLI fallback notes, runtime paths, and recent Gateway activity
- Streamable HTTP MCP uses stable localhost port `50668` by default and persisted local token file; port/token edits, random token generation, and copyable agent config live in Settings > General > Agent Gateway
- Desktop-owned Gateway Streamable HTTP endpoint for Gateway context, Memoria, Shared Line, and InnerLife MCP tools; stdio remains available for clients that do not support HTTP MCP yet
- Home Agent View includes period-based agent change summaries for yesterday, today, recent 7 days, and recent 30 days
- The built-in Memory embedding model stays lazy-loaded; Ollama and OpenAI-compatible providers do not load it.
- Memoria CLI for store, recall, get, update, tag, delete, restore, archive, import/export, records, and maintenance audit/run
- View-focused Memoria UI with four tabs: Memories (empty search lists all, with paging), Labels, Graph, and Archive & restricted (restricted, archived, and deleted review plus delete/restore)
- Lazy-loaded Memoria list tabs and cached spherical canvas graph with primary/restricted layers, depth-based links, selected label callouts, and reduced-motion fallback
- Vector maintenance behind a disclosure that auto-opens only when pending or failed vectors exist, plus daily small-batch Memoria database maintenance
- Default local Memory embeddings use the bundled ClaraCore built-in `Xenova/bge-small-zh-v1.5` model with 512-dimensional vectors
- Shared Line CLI and Desktop-owned Gateway MCP tools for agent-driven line create/list/get/activate/rename/archive/restore/update/handoff, agent state, model adjustments, and arc compaction
- Shared-reality and affective fields as first-class inputs, with a managed arc lifecycle: momentary readings stay transient, duplicates are de-duplicated, persisted arcs are capped, resume packets truncate by default (fullArc for the complete arc), and needs-review nodes are always protected
- View-focused Shared Line UI for line browsing, agent filtering, current position, metadata, history, snapshots, handoffs, and resume packet review; selecting a line only changes the reviewed detail, not the agent-active line
- Desktop-owned InnerLife storage, agent profiles, inbox, sessions, events, thoughts, shares, digest runs, exploration, convergence, and daemon state
- Model-backed InnerLife generation for digest, process-once, exploration, convergence, and session afterthoughts, with deterministic template fallback when no model is configured or a model call fails
- Fresh installs enable InnerLife by default with the bundled DeepSeek-compatible model/key settings
- Agent-managed InnerLife access through Gateway MCP and CLI fallback; the Desktop UI is primarily for inspection and runtime control
- InnerLife share timing checks connect against the current Shared Line context
  by default and record explicit/context/line overlap metadata before an agent
  chooses whether to use or defer a share
- Settings > Models tab keeps provider flows explicit: Memory embedding exposes
  ClaraCore built-in, Ollama, or Disabled, while InnerLife exposes Disabled,
  Ollama, or OpenAI-compatible provider settings
- InnerLife runtime panel for daemon enable/pause/tick and doctor status; sessions, digests, inbox, and timing checks sit behind a collapsed Pipeline evidence section
- Verified SQLite product backups with restore preview and safety-backup restore
- Full product JSON export/import for portable ClaraCore Desktop data
- Agent identity is stable per calling agent: Streamable HTTP uses `X-ClaraCore-Agent-ID`, stdio fallback uses `CLARACORE_AGENT_ID`; preferred stable ids are `lara`, `clara`, and `codex`, while legacy tool-prefixed ids can be consolidated with `agent_identity_merge`
- Settings page with General (language, theme, motion, close-window behavior, data paths, runtime facts), Models, and Data tabs
- Terminal-style runtime log view for maintenance and Gateway traces, plus a
  read-only time flow across Memory, Shared Line, InnerLife, Gateway, and runtime
  events
- Read-only decay audit that flags dormant Memory, Shared Line review items,
  old waiting InnerLife shares/inbox items, and InnerLife daemon errors without
  mutating product state
- Chinese and English UI switching
- macOS menu bar / Windows tray entry
- Unified ClaraCore app, tray, favicon, README, and packaging icon assets
- Warning-only resource bar that appears when RAM exceeds 85% or disk exceeds 90%

Not included yet:

- LAN Agent Gateway mode and HTTP management console for the Desktop-owned Gateway
- Packaged macOS release artifact
- Windows package
- Old Memoria REST API compatibility

## Development Mode

From this directory:

```bash
npm install
npm run start
```

During development the app detects the existing ClaraCore checkout two directories above this app:

```text
../../
```

You can override that with:

```bash
CLARACORE_ROOT=/path/to/ClaraCore npm run start
```

## Commands

Check JavaScript syntax:

```bash
npm run check
```

Run the full smoke suite:

```bash
npm run test:smoke
```

Useful narrower smoke gates:

```bash
npm run test:phase5
npm run test:backup
npm run test:import-preview
```

Run the opt-in long-run memory stability check:

```bash
npm run test:memory-long-run
```

Start the desktop app:

```bash
npm run start
```

Start the Desktop-owned MCP Gateway directly:

```bash
npm run gateway
```

Use the CLI fallback:

```bash
node core/cli.js --help
```

## Data Directory

ClaraCore product data lives under one data root. By default, Desktop stores
product files under the Electron user data `data/` subdirectory:

```text
~/Library/Application Support/ClaraCore Desktop/data
```

The product database is `claracore.db`; backups, exports, logs, and runtime
cache files live beside it under that data root. Electron/Chromium cache files
remain in the user data root outside `data/`.

You can change the product data root from `Settings -> Data paths`. The path is
saved in `desktop-settings.json` and takes effect after restarting the app.
`CLARACORE_DESKTOP_DATA_DIR` remains available as the highest-priority override
for tests and scripted launches.

## Current Code Layout

The app has no renderer build step. `index.html` loads classic scripts.

- `app.js`: renderer orchestration, refresh flow, and event wiring
- `app/`: DOM bindings, i18n, view registry, pure helpers, and focused view modules
- `styles.css`: CSS import entry
- `styles/`: shared and view-specific CSS
- `electron/`: Electron main process, preload bridge, IPC, tray, and schedulers
- `core/runtime/`: public runtime facade, paths, backup/restore, import
  workflows, bounded snapshots, and read-only decay audit
- `core/version.js`: single product-version source shared by Desktop runtime, resource snapshots, and Gateway metadata
- `core/db/`: schema, migrations, database adapter, settings, events, traces, and repositories
- `core/memoria/`: Desktop Memoria domain facade
- `core/continuity/`: Shared Line domain facade
- `core/innerlife/`: InnerLife domain facade
- `core/gateway/`: MCP tool definitions, handlers, and stdio fallback server
- `core/tests/`: smoke and UI smoke coverage

## Current Gateway Direction

The Desktop-owned Gateway is the primary agent contract. Streamable HTTP MCP at
the Desktop localhost `/mcp` endpoint is the preferred connection mode for
clients that support it, because one Desktop Gateway can serve multiple agents
and sessions through request-level identity. Stdio MCP remains as a compatibility
path for clients that still require a local process.
The default localhost endpoint is `http://127.0.0.1:50668/mcp`; Settings >
General > Agent Gateway is the source of truth if the user changes it.

Claude Desktop version or model changes do not change ClaraCore's Gateway
contract by themselves. If a client supports Streamable HTTP MCP, use the
current endpoint and bearer header from Agent Access or Settings > General >
Agent Gateway. If it only supports local stdio MCP, use the generated fallback
config, fully quit and restart the client, then run
`claracore_connection_test` followed by `gateway_context`.

The old ClaraCore Gateway web console remains a reference for useful overview
ideas, but its service Web UI launcher/supervisor model is not the Desktop
product target. Product-visible summaries now belong on the Desktop Home page,
and repeatable operations should be exposed through the Desktop-owned Gateway.

## Development Rules

- Keep `Memoria`, `Shared Line`, and `InnerLife` as separate product domains.
- New renderer work goes under `app/views/` or another focused `app/` module.
- New product behavior goes through a domain facade before it reaches runtime.
- New persistence work belongs in a repository or explicit migration.
- Old Python services are reference implementations and import sources, not
  the normal Desktop runtime.
- Before pushing architecture or runtime changes, run `npm run test:smoke`.
