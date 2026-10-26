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

## Context and evidence

Default catalogs are bounded summaries. Explicit reads remain scoped and
bounded; see [Context delivery](CONTEXT_DELIVERY.md). Source statements,
generated interpretations, and confirmed facts have different roles.

Automatic Memory context returns one eligible block or abstains. A host must
actually inject that block; selection is not delivery or use. Knowledge-aware
hosts explicitly negotiate [the additional contract](KNOWLEDGE_CONTEXT.md).
Connecting MCP alone does not install host hooks or collect every chat.

InnerLife selection, delivery, and actual use are recorded separately. Do not
mark a selected thought as delivered or used without evidence. Conversation
IDs and InnerLife session IDs are separate; retain the internal session ID
returned at start and use it to end the same session.

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
