# ClaraCore Desktop

ClaraCore Desktop is the local desktop manager for the first ClaraCore core package:

- Gateway
- Memoria
- Continuity
- InnerLife

It is not a chat client and does not include a primary chat model. The desktop app is meant to make the local core visible, configurable, and eventually manageable without starting every service by hand.

## Current Status

The current version is a working desktop shell with a product-owned local data
store, Desktop-native Memoria, Shared Line, InnerLife, and a separate Models
surface for model and daemon configuration.

Included:

- Electron desktop app
- ClaraCore root detection
- Product-owned SQLite data root under Desktop user data
- Home, Memoria, Shared Line, InnerLife, Models, Data, Connections, Settings, and Logs pages
- Home dashboard with Gateway, Memoria, Shared Line, InnerLife, agent-view, and Gateway trace summaries
- MCP connection command and copyable config
- Desktop-owned Gateway stdio entry for Gateway context, Memoria, Shared Line, and InnerLife MCP tools
- Memoria CLI for store, recall, get, update, tag, delete, restore, archive, import/export, records, and maintenance audit/run
- View-focused Memoria UI for search, graph, labels, all memories, restricted memories, archive/delete review, and manual delete/restore
- Lazy-loaded Memoria list tabs and cached canvas graph with primary/restricted layers
- Manual vector rebuild with progress, plus daily small-batch Memoria maintenance
- Shared Line CLI and Desktop-owned Gateway MCP tools for agent-driven line create/list/get/activate/rename/archive/restore/update/handoff
- View-focused Shared Line UI for line browsing, agent filtering, current position, metadata, history, snapshots, handoffs, and resume packet review; selecting a line only changes the reviewed detail, not the agent-active line
- Desktop-owned InnerLife storage, agent profiles, inbox, sessions, events, thoughts, shares, digest runs, and daemon state
- Agent-managed InnerLife access through Gateway MCP and CLI fallback; the Desktop UI is primarily for inspection and runtime control
- Models page for Memoria embedding configuration, InnerLife model configuration, secret references, loop cadence, and InnerLife daemon enable/pause/tick
- Copy-based import for old Continuity data into Desktop-owned Shared Line tables
- Backup-gated import preview for old Memoria, Continuity, and InnerLife data
- Backup-gated copy import for old Memoria, Continuity, and InnerLife data
- Agent identity labels using `tool:agent` form, such as `claude-code:clara` and `hermes:lara`, with single-name agents such as `codex` supported
- Settings page placeholder sections for future language, theme, window, tray, paths, logs, Gateway policy, privacy, security, and developer diagnostics
- Terminal-style runtime log view for maintenance and Gateway traces
- Chinese and English UI switching
- macOS menu bar / Windows tray entry
- Unified ClaraCore app, tray, favicon, README, and packaging icon assets
- Real local resource monitor for uptime, CPU, memory, disk, and local time

Not included yet:

- HTTP management console for the Desktop-owned Gateway
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

Start the desktop app:

```bash
npm run start
```

## Current Gateway Direction

The Desktop-owned Gateway is the primary agent contract. It is a stdio MCP
server launched by the agent client through the generated MCP config, not a
separate always-on background daemon.

The old ClaraCore Gateway web console remains a reference for useful overview
ideas, but its service Web UI launcher/supervisor model is not the Desktop
product target. Product-visible summaries now belong on the Desktop Home page,
and repeatable operations should be exposed through the Desktop-owned Gateway.

## v0.2 Direction

The next version should move from display to real local control:

- Package a macOS app.
- Keep the Desktop-owned Gateway as the primary agent MCP contract.
- Use or import existing ClaraCore data safely.
- Show real service health, not just module file presence.
- Provide agent-ready MCP config for the Desktop-managed Gateway.
- Show useful startup and service logs.
