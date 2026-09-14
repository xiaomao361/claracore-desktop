# Product Gateway

ClaraCore Desktop exposes one MCP transport: Streamable HTTP at localhost `/mcp`.
Both 2026-07-28 and 2025-06-18 protocols are supported. Stdio MCP has been retired.
Desktop owns the listener and shared product core. Keep Desktop running.
CLI is reserved for authorized internal maintenance, not client fallback.
See [migration](../../docs/HTTP_MCP_MIGRATION.md).

## Boundary

- Gateway exposes product tools for Gateway context, Memory Controller,
  Memoria, Shared Line, and InnerLife.
- Gateway calls product domain facades such as `core/runtime` and
  `core/memory-controller`; it should not implement policy or edit database
  state directly.
- Gateway writes trace records so Desktop can show recent agent activity.
- Gateway is not the old ClaraCore Python/web Gateway service.

## Runtime Contract

- Streamable HTTP keeps Desktop as the single local Gateway service. Agents send
  `Authorization: Bearer <token>`, `X-ClaraCore-Agent-ID`, and optionally
  `X-ClaraCore-Client-ID` and `X-ClaraCore-Conversation-ID` with each request.
  `X-ClaraCore-Session-ID` remains a compatible conversation-header alias.


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

The authenticated `GET /gateway/context` compatibility helper accepts
`detail`, `agentId`, and an optional `lineId`. When an Agent owns multiple
active Shared Lines and no line is selected, it returns HTTP `409` with
`SHARED_LINE_ID_REQUIRED` and bounded candidates. Retry with the chosen
candidate's `lineId`; the helper never guesses which line to read.

Tool backpressure applies both a global active-call cap and a per-Agent cap, so
one Agent cannot occupy every active slot. The bounded shared wait queue and
timeout remain global; `/health` stays outside tool-call backpressure.

If the configured port is occupied, fix the conflict or change the configured
port intentionally. Do not silently fall back to a random port for normal
Desktop use, because existing MCP client configs would then point at the wrong
endpoint.

The current local endpoint supports the MCP JSON-RPC methods needed for local tools.
Memory writers must search first: update the same fact, use
`memoria_supersede` for a confirmed new state, and use `contradicts` when the
conflict is unresolved. `memoria_search` defaults to current facts and accepts
`timeView: historical|all` for explicit temporal recall:

- `initialize`
- `tools/list`
- `tools/call`
- `ping`

Agent delivery follows [Context Delivery](../../docs/CONTEXT_DELIVERY.md):
catalogs are summary-only and paged, writes return bounded acknowledgements,
one-object get tools provide explicit expansion, and both transports enforce a
128 KiB final response ceiling. An over-budget result returns
`GATEWAY_RESPONSE_TOO_LARGE` with a narrowing instruction rather than silently
truncating JSON.

HTTP now accepts modern `2026-07-28` requests (discovery, tools/list, tools/call,
per-request metadata and mirrored-header validation), alongside legacy
`2025-06-18`. Legacy HTTP initialize always offers
the implemented version instead of echoing an unsupported request.

Modern requests reuse the existing HTTP identity, tool profile, result budget,
Trace and backpressure implementation. `clientInfo` is not an identity source.
Tool catalogs are deterministic and use `cacheScope: private`, `ttlMs: 0` and
HTTP `no-store`: no client cache reuse is promised across changing Agent/profile
contexts. Unknown methods and malformed protocol requests are protocol errors;
tool execution failures return `isError: true` with the existing recovery data.
Writes are not automatically retried or made idempotent by modern MCP: after a
lost response, inspect the operation result before repeating a write.

`npm run test:mcp:protocol` uses the pinned official client SDK 2.0.0 and modern
backpressure tests. It verifies real modern requests, not an initialize fallback.
Claude/Hermes integration remains a separate user-operated acceptance step.
