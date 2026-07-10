# ClaraCore Agent MCP Playbook

This guide is for external agents connected to ClaraCore Desktop through the
Gateway MCP endpoint. Agents should use MCP tools as the product contract
instead of reading packaged app source files.

Prefer the Streamable HTTP MCP endpoint shown in Agent Access when the client
supports it. Use the generated stdio MCP config only as a compatibility fallback.
Streamable HTTP callers should send `Authorization: Bearer <token>`,
`X-ClaraCore-Agent-ID`, `X-ClaraCore-Client-ID`, and optionally
`X-ClaraCore-Conversation-ID`. `X-ClaraCore-Session-ID` remains a legacy
conversation-header alias and is not an InnerLife session reference.
The localhost endpoint uses stable default port `50668` and the bearer token
persists in the local `agent-gateway.json` token file until the user rotates it.
Users can change the port, generate a new token, and copy a complete agent
config from Settings > General > Agent Gateway.

For the complete Codex, Claude, and Hermes migration checklist, see
[Multi-Agent Client Migration for v0.5.0](MULTI_AGENT_CLIENT_MIGRATION_V0_5.md).

The generated stdio fallback config includes three caller fields:

```text
CLARACORE_AGENT_ID=<stable-persona-id>
CLARACORE_CLIENT_ID=<codex-app|claude-code|hermes>
CLARACORE_CONVERSATION_ID=<optional-host-conversation-id>
```

Replace the agent and client placeholders before use. Keep the conversation
entry only when the host refreshes or relaunches its stdio MCP process for each
conversation; otherwise remove it so a stale id is not traced across unrelated
work. A caller conversation id never replaces an `inner_session_*` id.

## Startup Contract

After MCP is installed, connected, or restarted, run this sequence:

1. `claracore_connection_test`
2. `gateway_docs`
3. `shared_line_list` with `status: "active"`
4. `gateway_context` with an explicit `lineId` when your agent owns multiple
   active lines

`gateway_docs` explains the product boundary and available tools.
`gateway_context` returns the current working packet: Shared Line, recent
Memory, InnerLife state, Doctor guidance, and recovery advice.

Do not invent tool names. If a tool name is uncertain, call `gateway_docs` and
use the names listed there.

## Common Recipes

### Resume Work

1. Call `shared_line_list` with `status: "active"`.
2. If your agent owns multiple active lines, choose the intended line and pass
   its `lineId` to `gateway_context`.
3. Read the selected Shared Line and recent Memory.
4. Continue from the selected state instead of starting a new thread of work.

### Record A Durable Fact Or Decision

1. Call `memoria_search` with the topic first.
2. If an existing memory is the same fact, call `memoria_update`.
3. If it is new, call `memoria_create`.
4. Add labels such as `agent-id:<your-agent-id>`, project labels, and stable
   topic labels.

### Connect Related Memories

1. Call `memoria_link_list` before adding more links.
2. Call `memoria_link_create` with one of these kinds:
   - `related`
   - `causes`
   - `evolved-from`
   - `contradicts`
   - `part-of`
3. Add a short `note` explaining why the link exists.

### Update The Current Shared Line

1. Call `shared_line_list` with `status: "active"`.
2. When your agent owns multiple active lines, choose one and pass its explicit
   `lineId` to `shared_line_get` or `gateway_context`.
3. Pass the same `lineId` to `shared_line_update` after meaningful progress, a
   handoff, or a changed interpretation.
4. If a call returns `SHARED_LINE_ID_REQUIRED`, no line was changed. Select one
   of the returned candidates and retry with `lineId`.
5. Use `interpretationStatus: "needs_review"` when the state is uncertain.

### Use InnerLife

1. Call `innerlife_session_start` at the beginning of a meaningful session.
   Its bundled `shared_lines` list is active-only; archived lines require an
   explicit `shared_line_list` call with `status: "archived"` or `"all"`.
2. Use `innerlife_submit_inbox`, `innerlife_submit_fact`, or
   `innerlife_submit_continuity` for material that should be digested later.
3. Shared Line context is optional for InnerLife digestion. Pass `lineId` when
   one line matters. With multiple active lines and no `lineId`, briefing,
   digest, daemon tick, and provided-context share checks continue with
   `sharedLineContext.status: "ambiguous"` instead of rejecting the request.
4. Call `innerlife_pending_shares` and `innerlife_share_check` before surfacing
   a waiting share to the user.
5. Call `innerlife_status` without arguments for the compact status packet.
   Pass `detail: true` only when you need full sessions, digest runs, or
   history.
6. Call `innerlife_doctor` when InnerLife seems idle, paused, or misconfigured.

### Diagnose Gateway State

1. Call `claracore_status` for product health and configuration.
2. Call `gateway_trace_list` to inspect recent tool calls.
3. Do not mutate SQLite directly.

## CLI Fallback

Use CLI commands only when MCP is unavailable and the operator has granted local
shell access. CLI writes should follow the same rules as MCP writes: search
first, keep facts focused, label agent-scoped records, and update the Shared
Line only after meaningful progress.
