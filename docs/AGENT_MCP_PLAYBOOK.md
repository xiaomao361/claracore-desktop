# Agent MCP playbook

Connect to the Streamable HTTP endpoint shown in Desktop's Agent Access page.
Keep Desktop running. Send the bearer token and stable agent/client identities;
use a real per-conversation header when the host supports it. Start with
`claracore_connection_test` and `gateway_docs`.

See [Getting started](GETTING_STARTED.md), [Multi-client identity](MULTI_AGENT_CLIENTS.md),
and [Profiles and compatibility](MCP_COMPATIBILITY.md) for connection details.

## Everyday workflows

| Intent | Workflow |
| --- | --- |
| Recall facts | Search Memory; read the selected record before relying on its full meaning. |
| Save a confirmed fact | Search first. Create a new fact or supersede a confirmed changed state; keep unresolved contradictions explicit. |
| Resume work | List bounded Shared Line summaries, select an exact `lineId`, and read its resume packet. |
| Record progress | Update the exact line with verified position, evidence, and a concrete next step. |
| Read source material | Choose exact, semantic, or hybrid Knowledge search, then read the returned section reference. |
| Review an optional thought | Use `innerlife_share_check` only when the current context makes review appropriate. A pending count contains no content. |
| Diagnose a problem | Request the relevant diagnostic section or exact record through the full catalog. |

A line is a resumable objective. Completing a subtask does not complete its
parent goal. Record the final position before archiving a line whose own
objective is complete or explicitly discontinued. Do not infer completion from
age, silence, or an empty next step.

When the objective is known, use `shared_line_list` with `query` and
`status: active` to find it without paging through unrelated work. Query is a
literal substring in the title, latest position, or next step (ASCII
case-insensitive, at most 200 characters); it does not search old checkpoints.
The returned total and pages count only matches within the requested Agent and
lifecycle scope. Read the selected exact `lineId`; a match never activates it.

`isGlobalFallback` is the global pointer; `isCurrent` remains its legacy alias.
Neither identifies the selected line of your conversation. Other sessions,
including startup with an explicit line ID, can move that global pointer.
Keep the exact line ID selected for the current task. Agent-filtered catalogs
and ambiguity hints use the same timestamp order without promoting the global
fallback. Timestamps in the line catalog are timezone-explicit ISO 8601; this
normalizes reads without modifying stored history.

## Context and evidence

Default catalogs are bounded summaries. Explicit reads remain scoped and
bounded; see [Context delivery](CONTEXT_DELIVERY.md). Source statements,
generated interpretations, and confirmed facts have different roles.

Automatic Memory context returns one eligible block or abstains. A host must
actually inject that block; selection is not delivery or use. Knowledge-aware
hosts explicitly negotiate [the additional contract](KNOWLEDGE_CONTEXT.md).
Connecting MCP alone does not install host hooks or collect every chat.

Automatic-context prompt calls return a compact summary by default. Follow
`diagnosticsRef` to inspect the same stored Memory decision without a second
recall; use `detail: full` when requesting a new call's routing diagnostics.
Prepared context does not become delivered or used through either read.

`truncatedFields` marks incomplete fields in key previews and continuation
packets; use their `detailRef` for the stored object. A successful
`shared_line_update` returns `persisted: true` and `receipt.readBack` for the
exact target. If a response is lost, read that line before retrying: the update
API does not promise idempotent retries. Presentation arguments are validated
before line mutations so invalid detail cannot save and then fail to respond.

InnerLife selection, delivery, and actual use are recorded separately. Do not
mark a selected thought as delivered or used without evidence. Conversation
IDs and InnerLife session IDs are separate; retain the internal session ID
returned at start and use it to end the same session.

Session startup returns `share_plan.decision=review_first` for a selected
candidate: startup has no real conversational context to decide that it should
be spoken now. Read the thought with `innerlife_share_check` when the register
fits; lexical overlap is evidence, not a requirement for sharing.

Repeating a session start with `includeBriefing=true` keeps the same session
but reads current state (`briefingFresh=true`). The saved opening snapshot is
historical, not a response cache. Startup has one recommendation in
`share_plan`; its summary briefing omits the duplicate `selectedShare` and
recommendation `nextRead`. Closed-share thoughts are excluded from summary
open loops. `counts.pendingShares` is the live total, while
`counts.pendingSharePreviews` is the bounded preview count.

An ambiguous briefing includes up to five `candidateLines` with line ID, title,
position preview, and update time. `totalCount`, `hasMore`, and `detailRef`
preserve the route to remaining active lines. The briefing does not select or
activate a candidate. Session startup also bundles a ten-row catalog page with
each line's `nextStep`;
hooks should use that one candidate source, or recover the same catalog page
from `shared_line_list`, and follow page offsets for more. Do not inject the
briefing's five hints as another competing set. An unmapped working directory
alone cannot identify the conversation's objective or disqualify a project.
The personal creflex integration separately configures an exact home-directory
candidate filter for four project lines. It changes only opening suggestions,
retains the Desktop line, and never changes line ownership or lifecycle. The
opening list shows recorded next steps; missing steps remain visibly missing.
Legacy Desktop responses are refreshed through `innerlife_briefing`, with the
pending total read separately. Refresh failures remain unavailable, and
compact does not inject share recommendations. Per-turn counts have no local
time-based cache.

## Optional understanding workflow

`understanding_context`, `understanding_submit`, and `understanding_resume`
organize bounded evidence, plans, authority, and recovery. They are in the
compatibility/full catalogs. Read the [contract](UNDERSTANDING_CONTRACT.md) and
[host integration](UNDERSTANDING_HOST.md) before enabling this workflow.
It does not replace ordinary domain tools or grant writes automatically.

## Maintenance

Treat pending, unavailable, partial, conflict, and failed as distinct outcomes.
Inspect exact records before retrying an uncertain write. See
[Maintenance](DESKTOP_MAINTENANCE.md). The internal CLI is for explicit local
maintenance, not a fallback MCP transport.
