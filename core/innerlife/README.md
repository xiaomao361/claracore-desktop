# InnerLife Core

Desktop-owned InnerLife state and loop configuration live in the product
database, not in the old standalone service database.

Existing `services/innerlife` code is a reference and import source. Normal
Desktop product use should go through this app's SQLite-backed product core,
Gateway MCP tools, or CLI fallback.

## Current Surface

Desktop currently owns:

- InnerLife profile state.
- Inbox material from agents or imported sources.
- Session start/end records.
- Briefing generation from Shared Line, Memory, pending shares, and inbox.
- Digest runs and share candidate generation.
- Pending share lifecycle records.
- Share timing checks against current context.
- Daemon enable/pause/tick state and recovery doctor.
- Backup-gated copy import from the old InnerLife v2 database.
- Model provider, endpoint, model names, API key references, and loop cadence
  configured from the Desktop Models page.

The Desktop InnerLife page is intentionally inspect-oriented. Agents create and
update InnerLife state through Gateway MCP or CLI fallback. Humans can inspect
state and operate daemon controls from Models, but the page should not become a
manual workflow surface for writing thoughts, reviewing shares, or applying
InnerLife output into other modules.

InnerLife output is product state until an agent explicitly writes Memory or
Shared Line through the corresponding product tools. The UI does not auto-apply
shares into Memory or Shared Line.

Agent IDs should use the product identity shape `tool:agent`, for example
`claude-code:clara` or `hermes:lara`. A single tool/name such as `codex` is also
valid for agents that do not need a two-part identity.

## Agent Access

Preferred path: Desktop-owned Gateway MCP.

Useful MCP tools include:

- `innerlife_status`
- `innerlife_briefing`
- `innerlife_sessions`
- `innerlife_session_start`
- `innerlife_session_end`
- `innerlife_submit_inbox`
- `innerlife_submit_fact`
- `innerlife_submit_continuity`
- `innerlife_digest`
- `innerlife_share_check`
- `innerlife_pending_shares`
- `innerlife_share_actions`
- `innerlife_mark_share`
- `innerlife_daemon_status`
- `innerlife_daemon_set`
- `innerlife_daemon_tick`

CLI fallback:

```bash
node core/cli.js innerlife status
node core/cli.js innerlife briefing --agent codex
node core/cli.js innerlife session-start --agent codex --user local-user --host cli
node core/cli.js innerlife inbox --body "material to digest later"
node core/cli.js innerlife digest --mode light
node core/cli.js innerlife pending
node core/cli.js innerlife share-check --context "current conversation context"
```
