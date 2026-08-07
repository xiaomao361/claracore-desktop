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
X-ClaraCore-Tool-Profile: core|full
```

`X-ClaraCore-Session-ID` remains a compatibility alias for the caller
conversation. New integrations should use `X-ClaraCore-Conversation-ID` so it
cannot be confused with an InnerLife `sessionId` tool argument.

`X-ClaraCore-Tool-Profile` is new in v0.6.6 and optional. It selects which
manifest `tools/list` returns. Omitting it, or sending an unknown value, gives
the smaller `core` manifest; only an explicit `full` broadens the surface.
The stdio equivalent is `CLARACORE_TOOL_PROFILE`. Every tool still executes
when called by name under either profile — the profile changes what is
advertised, not what is authorized. Clients that depend on the full manifest
being advertised must select `full` during the compatibility window.

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

For a resume read:

1. Call `gateway_context` with `detail: "brief"` and without `lineId`.
2. If `SHARED_LINE_ID_REQUIRED` is returned, select one of its candidates and
   retry with that explicit `lineId`.

Before a write, call `shared_line_list` with `status: "active"`, select the
intended line when more than one is present, and pass its `lineId` to
`shared_line_update`. `shared_line_list` remains the full catalog operation.

Do not guess the line from recency or summary text.

## Agent-Scoped InnerLife Data

The following agent-facing tools are scoped to the authenticated caller:

- `innerlife_status`
- `innerlife_sessions`
- `innerlife_pending_shares`
- `innerlife_share_actions`
- `innerlife_mark_share`
- `innerlife_afterthought_resolve`

Claude operating as `clara` cannot act on Lara's shares or sessions. Hermes
operating as `lara` cannot act on Clara's or Codex's data. The Desktop UI may
still request an all-agent inspection snapshot.

## v0.6.6 Compatibility Matrix

Read this as: what each client gets by default after upgrading Desktop, and what
it must change to keep its previous behavior.

| Client / transport | Default tool manifest | Default payload shapes | Needs a client change? |
| --- | --- | --- | --- |
| **Codex** (HTTP MCP) | `core` (29 tools) | new bounded defaults | Only if it used maintenance tools by advertisement; then send `X-ClaraCore-Tool-Profile: full`. Its per-prompt hook should move to `gateway_auto_context`. |
| **Claude Code** (HTTP MCP) | `core` (29 tools) | new bounded defaults | No, for ordinary recall/continuation. Its SessionStart hook now receives a much smaller briefing. |
| **Hermes / Lara** (HTTP MCP) | `core` (29 tools) | new bounded defaults | Only if it parsed `currentPosition` from Shared Line writes; use `detail: "full"` or read the new top-level fields. |
| **Any stdio client** | `core` (29 tools) | new bounded defaults | Set `CLARACORE_TOOL_PROFILE=full` to keep the old manifest. |
| **HTTP `/agent/setup`** | reports `toolProfiles` and `contextStates` | `firstCalls` no longer requires `gateway_docs` | No. |
| **HTTP `/gateway/context`** | unchanged endpoint | bounded ambiguity body with `candidateCount`, `totalCount`, `detailRef` | No, unless it assumed an unbounded `candidates` array. |
| **Desktop UI / CLI** | not applicable | **unchanged — full records** | No. Shaping is a Gateway-boundary concern only. |

Behavior that is identical on every client and transport:

- an unknown or missing tool profile resolves to `core`; only an explicit `full`
  broadens the surface;
- every tool still executes when called by name under either profile, because
  Gateway tool input is not schema-validated;
- `claracore_connection_test` reports the resolved profile in `toolProfile`;
- ambiguity refusals, delivery evidence, sensitivity, time view, and same-Agent
  filtering remain fail-closed.


## v0.6.6 Default Payload Changes

Every domain default read is smaller. Clients that parsed the old shapes must
adapt or pass the explicit detail argument during the compatibility window:

- `memoria_search` returns 3 bounded summaries with `bodyPreview`, not whole
  bodies; pass `detail: "full"` for the previous shape.
- `shared_line_get` and the Shared Line write acknowledgements return a resume
  packet with top-level `summary` / `interpretationStatus` / `factsUsed`, not a
  nested `currentPosition`. Pass `detail: "full"` for the previous shape.
- `agentState` is absent from every line packet. Read it once per session with
  `shared_line_agent_state`.
- `innerlife_status` returns operational state only; pass `detail: "full"` (or
  the boolean `true` alias) for the previous snapshot. **Its `mode` value
  changed**: the default read now reports `mode: "status"` and the full read
  reports `mode: "full"`. The pre-0.6.6 `mode: "lite"` is retired — branch on
  `detail`, not on `mode`.
- `innerlife_pending_shares` returns 3 previews; pass `detail: "full"` for whole
  bodies.
- `innerlife_briefing` returns a decision synthesis with `counts` and no `text`
  block; pass `detail: "full"` for the previous aggregate.
- `gateway_context(detail=brief)` embeds the resume packet and the InnerLife
  status shape. Its `text` field is now a short orientation summary and no
  longer repeats the structured content.

Hosts that inject context per prompt should route Memory and InnerLife
candidates through `gateway_auto_context` so at most one bounded block enters a
turn. That hook change is client-side work and is not done by upgrading Desktop.


## Automatic Turn Context: Host Adapter Contract

A host prompt hook makes **one** call per user turn and injects at most one
block. It must not retrieve Memory itself — that policy lives in ClaraCore so it
cannot drift between hosts.

**Automatic context is Memory only.** InnerLife shares are never delivered
automatically, and this is a product decision rather than a missing feature. A
waiting thought does not need to be about the current topic: an off-topic
engineering thought during engineering work is fine. What makes a share wrong is
the **register** — that same thought dropped into an intimate conversation. A
server can match topics; it cannot read register. So the model owns the
decision, through `innerlife_share_check`, and the hook carries only the pending
**count** as a signal that something is waiting.

This was measured, not assumed. Lexical relevance over real shares ranked three
unrelated Chinese shares above the English one that actually matched: Chinese
bigrams tie on function words, and cross-language overlap is structurally zero.
The Memory Controller earned automatic injection by having embeddings and a
measured 0.72 vector gate. If InnerLife ever gets share embeddings, automatic
delivery can be revisited — but topic matching would still be the wrong gate.

### Request

```json
{ "prompt": "the current user message", "sessionId": "optional InnerLife session id" }
```

`prompt` and the `memoryCandidates` / `shareCandidates` arrays are **mutually
exclusive**. Sending both is rejected, not merged. The arrays are the
compatibility/test path and are only advertised under the `full` tool profile.

Identity comes from the authenticated caller headers, never from the body.

### Response

```json
{
  "decision": "deliver_one" | "abstain",
  "domainStatus": { "memory": "ok|timeout|error|skipped", "innerlife": "not_collected" },
  "selected": { "domain": "memory|innerlife", "id": "...", "evidenceState": "selected" },
  "block": { "domain": "...", "id": "...", "body": "...", "bytes": 0, "truncated": false },
  "candidates": [ { "domain": "...", "id": "...", "eligible": false, "discardReason": "..." } ],
  "reason": "single_winner | no_eligible_candidate | no_eligible_candidate_degraded"
}
```

Inject `block.body` only when `decision === "deliver_one"`. Nothing else.

### Fallback rules

Branch on `domainStatus`, not on `decision`. **`domainStatus` is the marker that
this desktop actually arbitrated.**

| Response | Adapter does |
| --- | --- |
| `deliver_one` with a block | inject that one block (always Memory) |
| anything carrying `domainStatus` | nothing — the desktop looked and abstained |
| RPC error `Unknown tool` | fall back to the old `memory_context` path |
| any other shape | fall back to the old `memory_context` path |

Only *unknown tool* and *unrecognised shape* fall back. A network, auth, or
timeout failure must inject nothing rather than starting a second uncoordinated
retrieval.

This rule is not obvious and it is easy to get wrong in a way that looks fine:
an adapter that only falls back on an explicit pre-patch abstain will inject
nothing forever against any desktop that answers differently, and will show no
error while doing it.

### Evidence

`selected` is not `delivered` and not `used`. An InnerLife block must carry its
share id into the injected text so the model can report the outcome through
`innerlife_mark_share`, which still requires real `deliveryEvidence` for
`action="used"`. The arbiter never marks anything.

### Counts are not blocks

A pending-share **count** carries no product content and does not compete for
the delivery slot. Fetching it separately (throttled) is fine. Fetching share
**bodies** separately is not — that is a second uncoordinated injection.

### When the prompt event does not fire

On a host where the per-prompt hook is not reliably emitted, automatic context
is **unavailable**. A session-level instruction telling the model to call the
tool each turn is model-driven, must be labelled best-effort, and must not be
counted as acceptance. Gateway traces show whether the call actually happened;
a missing call is never reported as success.

### Traces

The prompt is not stored verbatim: `gateway_traces` keeps a hash plus an
80-byte preview, with `truncated` reporting whether anything was withheld. A
prompt shorter than the bound is still recorded in full.


## Codex Migration Checklist

1. Keep `agentId=codex` stable.
2. Send `X-ClaraCore-Client-ID: codex-app` for HTTP MCP.
3. Send the current Codex conversation id through
   `X-ClaraCore-Conversation-ID` when the host exposes it.
4. For stdio, set `CLARACORE_CLIENT_ID=codex-app`.
5. Omit `CLARACORE_CONVERSATION_ID` when one long-lived stdio process spans
   multiple Codex conversations.
6. After changing caller configuration, reconnect and run
   `claracore_connection_test` then `gateway_context(detail=brief)`.
   `gateway_docs` is now an on-demand read, not a startup step.
7. Codex maintenance workflows that need the import/export, graph, or retention
   tools advertised must send `X-ClaraCore-Tool-Profile: full`.

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
    `claracore_connection_test`, and read the live `tools/list`. Read
    `gateway_docs` only when the usage guide is actually needed; it now returns
    a bounded summary and takes a `section` argument.
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
