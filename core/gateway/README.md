# Product Gateway

ClaraCore Desktop owns two MCP transports for agents:

- Streamable HTTP at the Desktop localhost `/mcp` endpoint.
- Stdio through `core/gateway/mcp-server.js` for clients that do not support
  Streamable HTTP yet.

MCP is the primary agent contract for this app. Agent clients should prefer the
Streamable HTTP endpoint shown in Agent Access when supported, and use the
generated stdio config as a compatibility fallback. CLI commands remain a
fallback when MCP is unavailable.

## Boundary

- Gateway exposes product tools for Gateway context, Memoria, Shared Line, and
  InnerLife.
- Gateway calls `core/runtime`; it should not bypass runtime into database
  internals.
- Gateway writes trace records so Desktop can show recent agent activity.
- Gateway is not the old ClaraCore Python/web Gateway service.

## Runtime Contract

- Streamable HTTP keeps Desktop as the single local Gateway service. Agents send
  `Authorization: Bearer <token>`, `X-ClaraCore-Agent-ID`, and optionally
  `X-ClaraCore-Client-ID` and `X-ClaraCore-Conversation-ID` with each request.
  `X-ClaraCore-Session-ID` remains a compatible conversation-header alias.
- Each stdio agent client normally launches Gateway as its own helper process.
- The process keeps one cached product database connection and closes it on
  stdin close, process exit, `SIGINT`, and `SIGTERM`.
- Packaged Gateway mode runs the app executable with `ELECTRON_RUN_AS_NODE=1`
  plus the `app.asar` path of `mcp-server.js`, so each agent connection is a
  single Node process (the legacy `--gateway` flag still works); development
  mode is `node core/gateway/mcp-server.js`.
- Agents must use stable ids such as `lara`, `clara`, or `codex`. Do not share
  one id across multiple agents.
- HTTP agent identity is request-scoped through `X-ClaraCore-Agent-ID`.
- `CLARACORE_AGENT_ID` is the authoritative stdio Gateway process identity.
  Gateway uses it before any `agentId` or `agent_id` tool argument and rewrites
  trace request metadata to that process identity. Tool arguments should not be
  used to override the caller identity.
- Generated stdio configs also include `CLARACORE_CLIENT_ID` and an optional
  `CLARACORE_CONVERSATION_ID` placeholder. Replace the client placeholder before
  use. Remove the conversation entry when a long-lived stdio process spans
  multiple host conversations, because its environment is process-scoped.
- Changing an agent's configured identity does not update an already-running
  stdio Gateway process. Restart the agent client, or stop stale packaged
  `--gateway` processes, before trusting new traces.
- Use `agent_identity_merge` to consolidate data after renaming an agent id.
- First connection order is `claracore_connection_test` -> `gateway_docs` ->
  `shared_line_list(status=active)` -> `gateway_context(lineId when needed)`.
  After reading context, the agent proactively explains ClaraCore's useful
  capabilities and the actual resumable context to the user.

## Streamable HTTP

The Desktop app exposes a local `/mcp` endpoint while it is running. It is bound
to `127.0.0.1`, uses stable default port `50668`, requires bearer-token authorization,
and rejects non-local `Origin` headers. The token is persisted in the local
`agent-gateway.json` file with `0600` permissions and changes only when rotated.
Packaged macOS builds also sync that token into the user launch environment used
by Codex. After a token rotation, restart Codex so its MCP connection inherits
the new credential.
Do not expose this endpoint beyond localhost without a separate security review.
Users can change the port, save a custom token, generate a random token, and
copy a complete agent config from Settings > General > Agent Gateway.

If the configured port is occupied, fix the conflict or change the configured
port intentionally. Do not silently fall back to a random port for normal
Desktop use, because existing MCP client configs would then point at the wrong
endpoint.

The v0.5.x endpoint supports the MCP JSON-RPC methods needed for local tools.
Memory writers must search first: update the same fact, use
`memoria_supersede` for a confirmed new state, and use `contradicts` when the
conflict is unresolved. `memoria_search` defaults to current facts and accepts
`timeView: historical|all` for explicit temporal recall:

- `initialize`
- `tools/list`
- `tools/call`
- `ping`

`initialize` includes short server instructions: read Memoria and Shared Line
only when prior context matters, review pending InnerLife selectively, and write
Memoria only for explicit durable decisions or an explicit request to remember.

Server-initiated event streams are not used in this local checkpoint.

## Claude Desktop Clients

Claude Desktop updates can move the MCP setup UI between Developer and
Extensions settings, but the ClaraCore contract remains MCP-first. Use
Streamable HTTP when the client supports it; otherwise use the generated stdio
fallback config from Agent Access.

- Use the current Agent Access instructions as the source of truth.
- Keep `type: "stdio"` for fallback config; ClaraCore Desktop does not
  currently ship a `.mcpb` Desktop Extension package.
- Set `CLARACORE_AGENT_ID` to a stable Claude-owned id such as `claude` or
  `clara`; do not reuse another connected agent's id.
- Set `CLARACORE_CLIENT_ID=claude-code`. Only set
  `CLARACORE_CONVERSATION_ID` when Claude keeps the stdio process aligned with
  the current conversation.
- Fully quit and restart Claude Desktop after config or identity changes so the
  stdio Gateway process is relaunched.
- Verify with `claracore_connection_test`, read `gateway_docs`, list active
  Shared Lines, then read `gateway_context` with `lineId` when needed.

## Shared Line Rules

- `lineId` values are real `continuity_lines.id` values. Agents should get them
  from `shared_line_list`; names such as `lara_love` are not implicit aliases.
- `shared_line_update` writes the requested `lineId` when provided. Without
  `lineId`, it writes the caller agent's own active line using the transport
  identity (`X-ClaraCore-Agent-ID` for Streamable HTTP, `CLARACORE_AGENT_ID` for
  stdio), creating that line when needed. Without either `lineId` or agent
  identity, it falls back to the global active line.
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
