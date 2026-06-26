# ClaraCore Desktop

ClaraCore Desktop is the local desktop manager for the first ClaraCore core package:

- Gateway
- Memoria
- Continuity
- InnerLife

It is not a chat client and does not include a primary chat model. The desktop app is meant to make the local core visible, configurable, and eventually manageable without starting every service by hand.

## Current Status

The current version is a working desktop shell with a product-owned local data store, a mostly complete Memoria module, and a Desktop-native Shared Line module.

Included:

- Electron desktop app
- ClaraCore root detection
- Product-owned SQLite data root under Desktop user data
- Home, Memoria, Shared Line, InnerLife, Data, Connections, Settings, and Logs pages
- MCP connection command and copyable config
- Desktop-owned Gateway stdio entry for Memoria MCP tools
- Memoria CLI for store, recall, get, update, tag, delete, restore, archive, import/export, records, and maintenance audit/run
- View-focused Memoria UI for search, graph, labels, all memories, restricted memories, archive/delete review, and manual delete/restore
- Lazy-loaded Memoria list tabs and cached canvas graph with primary/restricted layers
- Manual vector rebuild with progress, plus daily small-batch Memoria maintenance
- Shared Line CLI and Desktop-owned Gateway MCP tools for agent-driven line create/list/get/activate/rename/archive/restore/update/handoff
- View-focused Shared Line UI for line browsing, agent filtering, current position, metadata, history, snapshots, handoffs, and resume packet review
- Copy-based import for old Continuity data into Desktop-owned Shared Line tables
- Backup-gated import preview for old Memoria, Continuity, and InnerLife data
- Terminal-style runtime log view for maintenance and Gateway traces
- Chinese and English UI switching
- macOS menu bar / Windows tray entry
- Real local resource monitor for uptime, CPU, memory, disk, and local time

Not included yet:

- Starting or stopping Gateway from Desktop
- Replacing the existing manually started local gateway
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

## v0.2 Direction

The next version should move from display to real local control:

- Package a macOS app.
- Let Desktop start, stop, and restart the Gateway it owns.
- Detect and avoid interfering with a Gateway started outside Desktop.
- Use or import existing ClaraCore data safely.
- Show real service health, not just module file presence.
- Provide agent-ready MCP config for the Desktop-managed Gateway.
- Show useful startup and service logs.
