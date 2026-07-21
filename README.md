# ClaraCore Desktop

## Agent-First Principle

ClaraCore Desktop is software
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
- [Code Map](docs/CODE_MAP.md): shortest source-reading paths by task.
- [Version and Branching](docs/VERSION_BRANCHING.md): current development,
  isolation, checkpoint, and release rules.
- [Runtime Memory Policy](docs/RUNTIME_MEMORY_POLICY.md): small snapshot,
  pagination, resource ownership, memory telemetry, and long-run checks.
- [macOS Packaging](docs/mac-packaging.md): current local packaging and packaged
  Gateway validation notes.
- [v0.5.8 release notes](docs/RELEASE_NOTES_V0.5.8.md): Agent First human
  surfaces, Home Shared Horizon, the read-only Trace page, and verified Full/Lite
  packages for macOS arm64 and Windows x64.
- [Home Shared Horizon](docs/HOME_SHARED_HORIZON.md): current Home presence,
  performance, and test-isolation contract.
- [Trace page](docs/TRACE_PAGE.md): read-only narrative, metric definitions,
  milestones, and Agent participation contract.
- [Multi-Agent Clients](docs/MULTI_AGENT_CLIENTS.md):
  Codex, Claude, and Hermes identity, conversation, InnerLife session, and
  Shared Line integration rules.
- [Docs index](docs/README.md): current contracts versus archived historical
  material.
- Module boundary notes:
  - [Renderer modules](app/README.md)
  - [Runtime](core/runtime/README.md)
  - [Database repositories](core/db/repositories/README.md)
  - [Memoria](core/memoria/README.md)
  - [Continuity / Shared Line](core/continuity/README.md)
  - [InnerLife](core/innerlife/README.md)
  - [Gateway](core/gateway/README.md)

## Current Status

The current development and installed-test version is `0.6.2`; the current public release remains
`0.5.8`. It is a working desktop shell with a
product-owned local data store, Desktop-native Memoria, Shared Line, InnerLife,
a Desktop-owned Gateway, with model configuration merged into the Settings
surface.

Visible timestamps follow the current system time zone. Database audit fields
remain stored as UTC, while structured records preserve their event time zone.

Included:

- Electron desktop app
- Empty-data Home with one quiet shared-line horizon and a direct Agent
  Access entry; configured-only Agents are never presented as recently active.
- ClaraCore root detection
- Product-owned SQLite data root under Desktop user data
- Home, Memoria, Shared Line, InnerLife, Trace, Agent Access, Logs, and Settings pages (model and data management live inside Settings tabs)
- Home presence surface with a layered shared-line horizon representing the
  shared consciousness space, at most three recently observed Agent ripples, stable
  identity colors, reduced-motion fallback, and strict
  animation/pixel budgets. It uses recent Gateway activity as presence truth
  and keeps Shared Line / eligible InnerLife text readable without Canvas.
- Agent Access page with connected-agent/recent-activity evidence and one
  primary `复制给智能体` / `Copy for agent` action. The copied brief carries
  the current Streamable HTTP endpoint, bearer authorization, setup order, and
  stdio fallback without duplicating a technical manual in the human UI.
- Streamable HTTP MCP uses stable localhost port `50668` by default and persisted local token file; port/token edits, random token generation, and copyable agent config live in Settings > General > Agent Gateway
- Desktop-owned Gateway Streamable HTTP endpoint for Gateway context, Memory Controller, Memoria, Shared Line, and InnerLife MCP tools; stdio remains available for clients that do not support HTTP MCP yet
- Memory Controller automatic recall is off by default. Settings > Advanced
  can enable observe-only decisions without injecting Memory, and Trace >
  Advanced data shows bounded raw counts plus the latest ten decisions.
- Gateway `memoria_update` requires `id` and `body`; omitted `title`, `labels`,
  and `sensitivity` preserve their current values, while explicitly supplied
  fields replace them.
- Shared Line defaults are agent-scoped for Gateway callers: without an explicit `lineId`, `X-ClaraCore-Agent-ID` / `CLARACORE_AGENT_ID` reads and writes the agent's own line only when that choice is unambiguous. Multiple active lines fail closed with `SHARED_LINE_ID_REQUIRED`; the agent must list lines and retry with an explicit `lineId`. InnerLife shared-line context follows the same agent scope.
- The Full build's built-in Memory embedding model stays lazy-loaded; Ollama and OpenAI-compatible providers do not load it. Lite excludes that runtime entirely.
- Memoria CLI for store, recall, get, update, tag, delete, restore, archive, import/export, records, and maintenance audit/run
- Read-only human Memoria path: search, select, and inspect full Memory detail,
  with Agent filtering, paging, truthful labels/time evidence, and keyboard
  selection. Labels and the graph remain lazy behind one closed Advanced view;
  mutations, vector maintenance, restricted/archive/deleted management, scores,
  and maintenance counts stay Agent/runtime owned rather than primary UI.
- Full defaults to the bundled ClaraCore built-in `Xenova/bge-small-zh-v1.5` Memory embedding model with 512-dimensional vectors. Fresh Lite starts with Ollama and requires the user to fetch and select an installed embedding model.
- Shared Line CLI and Desktop-owned Gateway MCP tools for agent-driven line create/list/get/activate/rename/archive/restore/update/handoff, agent state, model adjustments, and arc compaction
- Shared-reality and affective fields as first-class inputs, with a managed arc lifecycle: momentary readings stay transient, duplicates are de-duplicated, persisted arcs are capped, resume packets truncate by default (fullArc for the complete arc), and needs-review nodes are always protected
- Read-only, line-first Shared Line UI: active lines on the left and selected
  `过去 -> 现在 -> 下一步`, shared understanding, and unresolved material on
  the right. Selecting a line only changes reviewed detail, never Agent-active
  state; history, snapshots, metadata, and Agent evidence stay under Advanced.
- Desktop-owned InnerLife storage, agent profiles, inbox, sessions, events, thoughts, shares, digest runs, exploration, convergence, and daemon state
- Model-backed InnerLife generation for digest, process-once, exploration, convergence, and session afterthoughts, with deterministic template fallback when no model is configured or a model call fails
- Fresh installs enable InnerLife by default with the bundled DeepSeek-compatible model/key settings
- Agent-managed InnerLife access through Gateway MCP and CLI fallback; the Desktop UI is primarily for inspection and runtime control
- InnerLife share timing checks connect against the current Shared Line context
  by default and record explicit/context/line overlap metadata before an agent
  chooses whether to use or defer a share
- Settings > Models keeps provider flows explicit: Full exposes ClaraCore
  built-in, Ollama, or Disabled for Memory embedding; Lite exposes only Ollama
  or Disabled. Selecting the Full built-in provider hides endpoint, model, key,
  fetch, and connection-test controls because no external wiring is required.
  InnerLife exposes Disabled, Ollama, or OpenAI-compatible in both.
- Read-only human InnerLife view organized by selected profile, current focus,
  full unshared thoughts, and verified shared history. A thought appears as
  shared only after a `used` action with conversational delivery evidence;
  daemon/pipeline controls and raw diagnostics are not primary human UI.
- Read-only Trace page that first tells the accumulated story in plain language,
  then shows recent confirmed milestones, non-ranked Agent participation, and
  detailed Memoria, Shared Line, and InnerLife statistics. Advanced raw counts
  remain collapsed by default.
- Verified SQLite product backups with restore preview and safety-backup restore
- Full product JSON export/import for portable ClaraCore Desktop data
- Agent identity is stable per calling agent: Streamable HTTP uses `X-ClaraCore-Agent-ID`, stdio fallback uses `CLARACORE_AGENT_ID`; preferred stable ids are `lara`, `clara`, and `codex`, while legacy tool-prefixed ids can be consolidated with `agent_identity_merge`
- Gateway caller context separates the stable persona (`agentId`), client host (`clientId`), and host conversation (`conversationId`) from domain ids such as `inner_session_*` and `line_*`; caller metadata is traced without overwriting tool arguments
- Shared Line `agent_id` is the stable owner. An explicit cross-agent update records `writerAgentId` provenance and never transfers ownership implicitly
- Agent-facing InnerLife status, pending shares, and share actions are scoped to the calling agent; Desktop UI snapshots may still request the all-agent view
- Settings with Common / Capabilities / Advanced hierarchy: appearance,
  window behavior, version/privacy/update checks, intentionally collapsed
  Memory and InnerLife provider controls, Agent Gateway access, storage,
  backup/import/export, and diagnostic paths.
- Manual GitHub Release update check for macOS arm64 DMG and Windows x64 EXE installers, with user-directed download and installation
- Read-only Logs with one recent-error status, local filters, terminal stream,
  Refresh/Follow controls, and closed Advanced Diagnostics containing Decay
  Audit and technical Time Flow evidence.
- Read-only decay audit that flags dormant Memory, Shared Line review items,
  old waiting InnerLife shares/inbox items, and InnerLife daemon errors without
  mutating product state
- Chinese and English UI switching
- macOS menu bar / Windows tray entry
- Unified ClaraCore app, tray, favicon, README, and packaging icon assets
- Warning-only resource bar that appears when RAM exceeds 85% or disk exceeds 90%

Not included yet:

- LAN Agent Gateway mode and HTTP management console for the Desktop-owned Gateway
- Signed and notarized public macOS release artifact
- Signed public Windows release artifact
- Old Memoria REST API compatibility

## Development Mode

From this directory:

```bash
npm install
npm run start:next
```

`start:next` isolates both product data and Electron user data from the
daily-use Desktop app. Use `npm run start:product` only when intentionally
opening the normal product instance.

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
npm run test:lite
```

## Full And Lite Builds

Full keeps the bundled local Memory embedding runtime. Lite removes its model,
Xenova, ONNX, Sharp, and transitive production packages, while retaining Ollama
embedding and all other Desktop domains.

```bash
npm run pack:mac          # Full unpacked app under dist/
npm run pack:mac:lite     # Lite unpacked app under dist-lite/
npm run test:package:lite # compare and inspect both packages
npm run dist:mac:lite     # Lite DMG under dist-lite/
npm run pack:win:lite     # Lite unpacked Windows app under dist-lite/
npm run dist:win:lite     # Lite Windows installer under dist-lite/
npm run test:package:win:lite # inspect Full/Lite Windows package contents
```

`npm run test:lite:ollama` is an opt-in real-runtime gate and requires Ollama at
`http://127.0.0.1:11434` with `bge-m3` available.

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
~/Library/Application Support/claracore-desktop/data
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

The generated stdio fallback is multi-agent aware: replace its stable persona
and host-client placeholders before use. Keep its optional conversation
environment value only when the client refreshes the stdio process per host
conversation; otherwise remove that entry to avoid stale trace attribution.

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
