# Multi-Agent Client Contract

This guide is for Codex, Claude, and Hermes clients that connect to ClaraCore
Desktop through MCP. Since version 0.5.0, the contract separates the stable
agent persona, the host client, the host conversation, and domain object ids.
The goal is to let several agents use one Desktop database without overwriting
each other's identity, Shared Line ownership, or InnerLife lifecycle.

## Identity Contract

Use three independent caller fields:

| Field | Meaning | Examples |
| --- | --- | --- |
| `agentId` | Stable persona and data subject | `codex`, `clara`, `lara` |
| `clientId` | Host application | `codex-app`, `claude-code`, `hermes` |
| `conversationId` | One host conversation | Claude UUID, Hermes session id |

Recommended assignments:

| Client | `agentId` | `clientId` |
| --- | --- | --- |
| Codex | `codex` | `codex-app` |
| Claude | `clara` | `claude-code` |
| Hermes | `lara` | `hermes` |

`agentId` belongs to the persona, not the host tool. If Lara later moves from
Hermes to another client, her stable agent id remains `lara`.

## Streamable HTTP Headers

New clients should send:

```text
Authorization: Bearer <token>
X-ClaraCore-Agent-ID: <stable-persona-id>
X-ClaraCore-Client-ID: <host-client-id>
X-ClaraCore-Conversation-ID: <current-host-conversation-id>
```

`X-ClaraCore-Session-ID` remains a compatibility alias for the caller
conversation. New integrations should use `X-ClaraCore-Conversation-ID` so it
cannot be confused with an InnerLife `sessionId` tool argument.

For stdio fallback, set:

```text
CLARACORE_AGENT_ID=<stable-persona-id>
CLARACORE_CLIENT_ID=<host-client-id>
CLARACORE_CONVERSATION_ID=<current-host-conversation-id>
```

Only `CLARACORE_AGENT_ID` is required. Do not set a static conversation id when
the stdio process is reused across unrelated host conversations.

Desktop's generated stdio JSON includes placeholders for all three values so
the copied config is self-describing. Replace the agent and client placeholders
before use. Replace the conversation placeholder only when the host keeps it
current; otherwise remove `CLARACORE_CONVERSATION_ID` from the copied config.

## InnerLife Session Contract

Keep these identifiers separate:

| Identifier | Owner | Purpose |
| --- | --- | --- |
| `conversationId` | Host client | Gateway tracing and caller correlation |
| `externalSessionId` | Calling client | Optional host-to-InnerLife correlation |
| `inner_session_*` | ClaraCore Desktop | Canonical InnerLife lifecycle handle |

Start a session with the current host conversation as the external correlation:

```json
{
  "externalSessionId": "<current-host-conversation-id>",
  "host": "claude-code-or-hermes"
}
```

Save the returned internal id:

```json
{
  "session": {
    "id": "inner_session_xxx"
  }
}
```

End the session with that returned id:

```json
{
  "sessionId": "inner_session_xxx",
  "summary": "Short session summary"
}
```

`sessionId` remains the canonical argument name. Desktop also accepts
`session_id` as a compatibility alias for callers that use snake_case domain
arguments. `summary` may be a short string or a structured JSON object; objects
are persisted as readable JSON text in the session, inbox, and event records.

Rules:

- Do not pass the current Claude or Hermes conversation id as
  `innerlife_session_end.sessionId` unless it is the exact `externalSessionId`
  registered at start.
- Do not invent ids such as `session_lara_xxx`.
- Prefer the returned `inner_session_*` id. The registered external id remains
  a compatibility lookup.
- One agent cannot end another agent's InnerLife session.
- Desktop does not automatically end an arbitrary previous active session when
  a new one starts.

Lifecycle hooks that intentionally tolerate a missing start may use:

```json
{
  "sessionId": "<saved-session-reference>",
  "bestEffort": true,
  "summary": "<summary-if-available>"
}
```

`bestEffort` is for host lifecycle hooks. Normal model calls should keep strict
errors so invalid ids remain visible.

Desktop also recognizes one legacy fallback: if `transcript` starts with the
literal `"[SessionEnd hook"`, a missing session is treated as best-effort even
without `bestEffort: true`. This exists only for Claude's existing SessionEnd
hook transcript convention. Codex and Hermes hooks do not share that
transcript prefix and must pass `bestEffort: true` explicitly, or a missing
session throws.

## Shared Line Contract

`continuity_lines.agent_id` is the stable owner. A different agent may update a
line only by supplying its exact `lineId`. That explicit write records
`writerAgentId` but does not transfer ownership.

Before reading or writing a Shared Line:

1. Call `shared_line_list` with `status: "active"`.
2. If more than one active line is returned, select the intended line.
3. Pass its `lineId` to `gateway_context`, `shared_line_get`, and
   `shared_line_update`.
4. If `SHARED_LINE_ID_REQUIRED` is returned, no write occurred. Select a
   candidate and retry.

Do not guess the line from recency or summary text.

## Agent-Scoped InnerLife Data

The following agent-facing tools are scoped to the authenticated caller:

- `innerlife_status`
- `innerlife_sessions`
- `innerlife_pending_shares`
- `innerlife_share_actions`
- `innerlife_mark_share`

Claude operating as `clara` cannot act on Lara's shares or sessions. Hermes
operating as `lara` cannot act on Clara's or Codex's data. The Desktop UI may
still request an all-agent inspection snapshot.

## Codex Migration Checklist

1. Keep `agentId=codex` stable.
2. Send `X-ClaraCore-Client-ID: codex-app` for HTTP MCP.
3. Send the current Codex conversation id through
   `X-ClaraCore-Conversation-ID` when the host exposes it.
4. For stdio, set `CLARACORE_CLIENT_ID=codex-app`.
5. Omit `CLARACORE_CONVERSATION_ID` when one long-lived stdio process spans
   multiple Codex conversations.
6. After changing caller configuration, reconnect and run
   `claracore_connection_test`, `gateway_docs`, and `gateway_context`.

## Claude Migration Checklist

1. Keep `agentId=clara` stable.
2. Send `X-ClaraCore-Client-ID: claude-code` for HTTP MCP.
3. Send the current Claude conversation UUID through
   `X-ClaraCore-Conversation-ID` when available.
4. Save the `inner_session_*` id returned by `innerlife_session_start`.
5. Pass that saved id to `innerlife_session_end`.
6. Add `bestEffort: true` to lifecycle-hook fallback calls. The existing
   SessionEnd hook transcript (`"[SessionEnd hook..."`) already gets this
   behavior automatically as a legacy fallback, but pass the flag explicitly
   for any new hook call.
7. Fully restart Claude and its MCP connection after changing stdio identity
   environment variables.
8. For stdio, set `CLARACORE_CLIENT_ID=claude-code`; omit the conversation
   variable when one long-lived MCP process spans multiple Claude conversations.

## Hermes Migration Checklist

1. Keep `agentId=lara` stable.
2. Send `X-ClaraCore-Client-ID: hermes` for HTTP MCP.
3. Send the current Hermes session id through
   `X-ClaraCore-Conversation-ID`.
4. Stop replacing `innerlife_session_end.sessionId` with the current Hermes
   session id.
5. Persist the `inner_session_*` id returned at start and pass it back at end.
6. Before `/new`, end the current InnerLife session when a saved handle exists.
7. Use `bestEffort: true` when a lifecycle hook has no confirmed successful
   start. Hermes has no legacy transcript-prefix fallback, so this must be
   explicit or a missing session throws.
8. Do not implement client-side `autoEndPrevious`; v0.5.0 intentionally does
   not use that lifecycle rule.
9. For stdio, set `CLARACORE_CLIENT_ID=hermes`; omit the conversation variable
   when Hermes cannot refresh the MCP process per session.
10. After upgrading Desktop, restart the Hermes MCP connection, run
    `claracore_connection_test`, and read the live `gateway_docs` and tool list.
11. Treat `memory_context` as observe-only. Call it per non-empty prompt only
    when Hermes has a verified per-prompt hook; never inject its empty context.
12. Without that hook, keep explicit `memoria_search` for real recall requests
    and report automatic Controller routing as unavailable instead of implied.
13. On HTTP `429` / JSON-RPC `-32001`, honor `Retry-After`, use bounded retries,
    and do not fan out more concurrent calls.

The current copy-ready Hermes upgrade message and verification receipt live in
[Hermes v0.6.2 Update](HERMES_V0.6.2_UPDATE.md).

## Compatibility And Verification

Existing integrations are not immediately broken:

- `X-ClaraCore-Session-ID` still works as a conversation-header alias.
- `innerlife_session_end` accepts the internal id or the exact external id
  registered at start.
- The legacy Claude SessionEnd transcript fallback remains available.

After reconnecting, verify:

1. `claracore_connection_test` reports server version `0.5.0`.
2. The response contains the expected `agentId`, `clientId`, and transport.
3. `shared_line_list(status="active")` returns only the caller's owned lines.
4. `innerlife_status` returns only the caller's profile and counts.
5. `gateway_trace_list` records the correct agent, client, and conversation.
