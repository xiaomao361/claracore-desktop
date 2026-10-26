# Multi-client identity

Several agents can use the same Desktop workspace. Keep the agent persona,
host application, host conversation, and domain object IDs separate.

## Caller headers

```text
Authorization: Bearer <token>
X-ClaraCore-Agent-ID: <stable-persona-id>
X-ClaraCore-Client-ID: <host-client-id>
X-ClaraCore-Conversation-ID: <current-conversation-id>
X-ClaraCore-Tool-Profile: core
```

| Field | Meaning | Example |
| --- | --- | --- |
| Agent ID | Stable persona and data subject | `assistant-a` |
| Client ID | Host application | `codex-app`, `claude-code`, `hermes` |
| Conversation ID | One real host conversation | Host-provided conversation UUID |

A persona can move between clients without changing its agent ID. Send caller
headers per request or through a conversation-isolated connection. Do not mutate
one globally shared connection's conversation header during concurrent chats.
Use the same conversation identity for reconnect/recovery and a different one
for a new chat.

`X-ClaraCore-Session-ID` remains a legacy alias for the conversation header.
It is not an InnerLife session handle. Understanding submit/resume require a
real conversation ID; ordinary context reads do not. Supplying identity grants
neither write authority nor model-call permission.

Profiles select the advertised catalog: `core` 25, `core-compat` 38, and `full`
83 canonical tools. Unknown/missing profiles resolve to `core`. Reconnect after
changing the profile. Profiles are discovery settings, not authorization.
See [MCP compatibility](MCP_COMPATIBILITY.md).

## InnerLife lifecycle

Start with the real host conversation as `externalSessionId` and retain the
returned `inner_session_*` ID. End with that exact internal ID:

```json
{
  "sessionId": "<returned-inner-session-id>",
  "summary": "A short factual summary of this session."
}
```

The registered external ID remains a compatibility lookup. Do not invent an
ID or pass an unrelated conversation ID. One agent cannot end another agent's
session. Desktop does not automatically end a previous active session merely
because a new one starts.

Host lifecycle hooks can pass `bestEffort: true` when a missing saved session
reference should produce a diagnostic no-op. Ordinary model calls should keep
strict errors. Do not infer a conversation ended from silence or elapsed time.

InnerLife session/share/action reads are caller-scoped. The Desktop UI may
request an all-agent inspection snapshot; this does not grant clients the same
write scope.

## Shared Lines

A line retains its stable owner. An explicitly selected cross-agent update uses
an exact `lineId`, records the writer, and does not transfer ownership.

List bounded candidates with `shared_line_list`, read the selected line with
`shared_line_get(lineId)`, and pass the same ID to updates. A no-ID read can
return `SHARED_LINE_ID_REQUIRED`; choose a relevant candidate before retrying.
Do not select a goal from recency alone. Line lifecycle (`active`/`archived`) and
the global fallback selection (`isCurrent`) are distinct.

Agent-level state is read separately with `shared_line_agent_state`; it is not
repeated in every line packet. See [Context delivery](CONTEXT_DELIVERY.md).

## Automatic context and sharing

An automatic host adapter calls `gateway_auto_context` once per user turn.
Under the default Memory contract it consumes only a returned eligible
`block.body`, or abstains. Hosts should not add a second independent automatic
Memory retrieval path. With no new human message, use
`turnKind: goal_continuation`, which skips collection.

Knowledge-aware hosts explicitly negotiate
[`memory-knowledge-v1`](KNOWLEDGE_CONTEXT.md). The host must consume the correct
shape and preserve source attribution; connecting to Desktop does not install
this integration automatically.

InnerLife remains separate. A pending count contains no thought content.
The agent chooses whether the conversational register makes review appropriate,
then calls `innerlife_share_check` with the actual context. Selection, delivery,
and actual use have separate evidence; none should be inferred from a count or
successful read.

## Validate an integration

Confirm the resolved identity/profile with `claracore_connection_test`. Test
resume ambiguity, exact-line updates, and the same-session end path using
isolated data. For an understanding bridge, also verify real host event payloads,
stable IDs, recovery, and permitted evidence through the
[host contract](UNDERSTANDING_HOST.md). A working MCP connection alone does not
prove that hooks, context delivery, or conversation capture are installed.
