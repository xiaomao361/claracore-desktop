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

## Development Rules

- Keep tool schemas stable and explicit.
- Add new agent operations here only after the product domain facade exists.
- Keep validation in smoke tests when adding or changing tools.
- Prefer small tool groups if `mcp-server.js` grows further.
