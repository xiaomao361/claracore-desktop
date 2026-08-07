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

For the complete Codex, Claude, and Hermes caller checklist, see
[Multi-Agent Clients](MULTI_AGENT_CLIENTS.md).

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

## Tool Profiles (v0.6.6)

`tools/list` is served from a maintained profile.

| Profile | Contents | Selection |
| --- | --- | --- |
| `core` (default) | 29 tools: connection/context, Memory recall/write/supersede/link, Shared Line continuation, InnerLife session and sharing | nothing to set |
| `full` | every tool, including maintenance, import/export, graph, retention, identity, daemon, archive, and advanced editing | `X-ClaraCore-Tool-Profile: full` (HTTP) or `CLARACORE_TOOL_PROFILE=full` (stdio) |

`core` covers complete everyday workflows, not just the write half of each: if a
tool is in `core`, its natural counterpart is too — `memoria_create` with
`memoria_supersede`, `memoria_link_create` with `memoria_link_list`. A half
workflow fails silently, since the caller only discovers the gap mid-task.

An unknown or missing value resolves to `core`; an invalid profile never
broadens the surface. `claracore_connection_test` reports the resolved profile
in its `toolProfile` field.

The `core` manifest advertises fewer tools and, for some tools, fewer
arguments. Gateway tool input is not schema-validated, so every handler still
accepts the full argument set and every tool still executes when called by
name. Select `full` when you want those tools and arguments advertised.

## Changed Defaults (v0.6.6)

Every default read below got smaller. Nothing was deleted: each one names the
explicit call that recovers the full record.

| Tool | New default | Recover full detail with |
| --- | --- | --- |
| `memoria_search` | 3 results, bounded body previews, no embedding metadata, no related records | `detail: "full"`, or `memoria_get(id)` per result |
| `shared_line_get` | `resume` packet: line id/title, summary, interpretation status, facts used, next step, updated time, at most one recent handoff | `detail: "context"` adds relevant Shared Reality; `detail: "full"` restores history, snapshots, arcs, agent state, and the stored text |
| `shared_line_update` / `create` / `activate` / `handoff_create` | acknowledgement uses the same `resume` shape | `detail: "full"`, or a follow-up `shared_line_get` |
| `innerlife_status` | operational state only: counts, daemon, doctor, pending-work indicators. Reports `mode: "status"`; the pre-0.6.6 `mode: "lite"` is retired | `detail: "full"`, or the boolean `true` alias |
| `innerlife_pending_shares` | 3 bounded previews | `detail: "full"`, or `innerlife_share_check` for one share |
| `innerlife_briefing` | decision synthesis: selected line summary when unambiguous, open loops, counts, at most one candidate preview | `detail: "full"` |
| `gateway_context(detail=brief)` | one resume packet, up to 3 Memory summaries, InnerLife status plus at most one candidate | `detail: "full"` |

Two things that did **not** change:

- **Agent-level Continuity state** is no longer in any line packet. It is
  Agent-scoped, so repeating it per line was the same bytes twice. Load it once
  per session with `shared_line_agent_state`. Removing it from a default read
  never deletes or mutates it.
- **Reading a candidate still marks nothing.** `innerlife_pending_shares` and
  `innerlife_briefing` are read-only. Delivery and use remain separate states
  that only `innerlife_mark_share` records, and `action="used"` still requires
  `deliveryEvidence` from the response that actually said it.

## Automatic Context (v0.6.6)

`gateway_auto_context` arbitrates automatic per-prompt injection into **one**
bounded delivery slot. It collects Memory only; InnerLife shares are never
delivered automatically, because whether a waiting thought fits is a question of
register rather than topic and only the model can read register. Reach them
through `innerlife_share_check`. Candidates supplied by a host on the
compatibility path are still arbitrated:

1. invalid, restricted, historical, cross-Agent, not-pending, and weak
   candidates are discarded, each with a recorded reason;
2. eligible candidates are ranked by urgency, then relevance;
3. exactly one wins, or the arbiter abstains;
4. the winner is trimmed to a 600-token target and a 900-token hard limit;
5. `selected` is returned — never `delivered` and never `used`.

A Memory hit therefore suppresses a second InnerLife block in the same turn. An
irrelevant timing candidate is rejected without being marked used.

Since the turn-context patch it takes `prompt` directly and collects both
domains itself, so a host makes one call per turn:

```text
gateway_auto_context({ prompt, sessionId })
```

Inject `block.body` only for `decision=deliver_one`. Branch fallback on
`domainStatus`, which marks that the desktop actually arbitrated. The full
adapter contract, including the fallback table, is in
`docs/MULTI_AGENT_CLIENTS.md`.

The arbiter is read-only and creates no product state. Until a host hook is
updated, its turn behavior is unchanged.

## Startup Contract

After MCP is installed, connected, or restarted, run this sequence:

1. `claracore_connection_test`
2. `gateway_context` with `detail: "brief"` and without `lineId`

If the context call returns `SHARED_LINE_ID_REQUIRED`, choose one of the
returned candidates and retry with its explicit `lineId`. Use
`shared_line_list` only when you need the full active or archived catalog.

After these calls, proactively respond in the user's current language with the
truthful connection result, ClaraCore's Memory, Shared Line, InnerLife, and
Gateway/diagnostics capabilities, a bounded summary of actual context, three to
five natural-language example requests, and one evidence-backed next action
when appropriate. Do not wait for the user to ask how to use ClaraCore.

`gateway_docs` is no longer a mandatory startup read. Call it when you need the
usage guide. Omitting `section` returns a bounded summary (connection truth,
domain roles, startup sequence, section index). Pass `section` for one topic:
`start`, `memory`, `shared-line`, `innerlife`, `diagnostics`, or `full`. It no
longer restates the tool manifest — tool names and argument schemas come from
`tools/list`.

`gateway_context` returns the current working packet: Shared Line, recent
Memory, InnerLife state, Doctor guidance, and recovery advice. Use
`detail: "brief"` for bounded startup and resume reads. Omit `detail`, or pass
`detail: "full"`, only when a 0.6.4 compatibility client or a specific task
needs the complete packet.

Do not invent tool names. If a tool name is uncertain, read `tools/list`.

## Shared Line Ambiguity (v0.6.6)

`SHARED_LINE_ID_REQUIRED` is a safe refusal: nothing was read or written and no
line was guessed. The refusal is bounded rather than a catalog:

- at most five candidates, each with `lineId`, `title`, `status`,
  `summaryPreview`, and `updatedAt`;
- `candidateCount` and the true `totalCount`;
- `detailRef` pointing at `shared_line_list` for the rest.

The message text carries the same bounded previews because some hosts surface
only `error.message`. Hosts that read JSON-RPC `error.data` get the structured
form on both transports.

## Common Recipes

### Resume Work

1. Call `gateway_context` with `detail: "brief"` and without `lineId`.
2. If it returns `SHARED_LINE_ID_REQUIRED`, choose the intended candidate and
   retry with its `lineId`.
3. Read the selected Shared Line and recent Memory.
4. Continue from the selected state instead of starting a new thread of work.

### Record A Durable Fact Or Decision

1. Call `memoria_search` with the topic first.
2. If an existing memory is the same fact, call `memoria_update`. `id` and
   `body` are required. Omit `title`, `labels`, or `sensitivity` to preserve
   their current values; pass one explicitly only when replacing that field.
3. If a confirmed new state replaces an old fact, call `memoria_create` for
   the new fact, then `memoria_supersede` with `currentMemoryId` = new and
   `historicalMemoryId` = old.
4. If the conflict is unresolved, connect the facts with `contradicts` instead
   of superseding either one.
5. If it is independent and new, call `memoria_create` and add stable labels.

### Connect Related Memories

1. Call `memoria_link_list` before adding more links.
2. Call `memoria_link_create` with one of these kinds:
   - `related`
   - `causes`
   - `evolved-from`
   - `contradicts`
   - `part-of`
3. Use `memoria_supersede`, not `memoria_link_create`, for confirmed state
   replacement. Add a short `note` explaining the evidence.

### Recall Current Or Historical State

- `memoria_search` defaults to `timeView: "current"` and excludes superseded
  facts.
- Use `timeView: "historical"` when the question asks what used to be true.
- Use `timeView: "all"` only when comparing the current and historical states.
- Superseded facts remain durable history; do not archive or delete them merely
  because they are no longer current.

### Update The Current Shared Line

1. Call `shared_line_list` with `status: "active"`.
2. When your agent owns multiple active lines, choose one and pass its explicit
   `lineId` to `shared_line_get` or `gateway_context`. Treat
   `shared_line_list` as the line catalog and `shared_line_get` as the scoped
   content read; `shared_line_get` intentionally does not repeat active or
   archived catalogs or other agents' states.
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
   For a terminal persisted afterthought, inspect its job id with
   `innerlife_status(detail=true)`, then use
   `innerlife_afterthought_resolve` explicitly: retry after repair, or
   acknowledge with a reason when no generated share is required.

### Diagnose Gateway State

1. Call `claracore_status` for product health and configuration.
2. Call `gateway_trace_list` to inspect recent tool calls.
3. Do not mutate SQLite directly.

## CLI Fallback

Use CLI commands only when MCP is unavailable and the operator has granted local
shell access. CLI writes should follow the same rules as MCP writes: search
first, keep facts focused, label agent-scoped records, and update the Shared
Line only after meaningful progress.
