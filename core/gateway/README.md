# Product Gateway

`core/gateway/mcp-server.js` is the Desktop-owned stdio MCP server for agents.

It is the primary agent contract for this app. Agent clients should launch it
from the MCP config shown in the Agent Setup page. CLI commands remain a
fallback when MCP is unavailable.

## Boundary

- Gateway exposes product tools for Gateway context, Memoria, Shared Line, and
  InnerLife.
- Gateway calls `core/runtime`; it should not bypass runtime into database
  internals.
- Gateway writes trace records so Desktop can show recent agent activity.
- Gateway is not the old ClaraCore Python/web Gateway service.

## Runtime Contract

- Each agent client normally launches Gateway as its own stdio process.
- The process keeps one cached product database connection and closes it on
  stdin close, process exit, `SIGINT`, and `SIGTERM`.
- Packaged Gateway mode is the app executable plus `--gateway`; development
  mode is `node core/gateway/mcp-server.js`.
- Agents must use stable ids such as `hermes:lara`, `claude-code:clara`, or
  `codex`. Do not share one id across multiple agents.
- Agent setup should tell agents to call `gateway_context` first. The old
  `claracore_connection_test` is only a lightweight status probe.

## Shared Line Rules

- `lineId` values are real `continuity_lines.id` values. Agents should get them
  from `shared_line_list`; names such as `lara_love` are not implicit aliases.
- `shared_line_update` writes the requested `lineId` when provided. Without
  `lineId`, it writes the current active line.
- The tool response is loaded from the line that was actually written, so
  agents can trust the returned resume packet.
- Existing `current_positions` rows are updated by `line_id`. There is one
  current position per line; history and snapshots are append-only records.

## Validation

When changing MCP behavior, validate both schema-level and real tool-call
paths:

- `npm run check`
- targeted Gateway smoke tests such as `node core/tests/phase3-gateway-smoke.js`
- a temporary-data all-tools MCP pass when changing broad Gateway/database
  behavior. Temporary data roots must be deleted after the run.

## Development Rules

- Keep tool schemas stable and explicit.
- Add new agent operations here only after the product domain facade exists.
- Keep validation in smoke tests when adding or changing tools.
- Prefer small tool groups if `mcp-server.js` grows further.
