# Workflow overview

Everyday pages focus on records, search, and current progress. This guide keeps
the mechanism explanations outside those reading surfaces.

## Memory

An agent explicitly saves a fact or decision. Labels and relationships organize
it. Automatic recall checks whether history is needed and applies the Memory
Controller's relevance and scope gates before returning eligible context.
A saved or selected record does not prove a client received or used it.

## Shared Lines

A line records where an ongoing topic stands, recorded understanding, and
supporting references. A next step is optional; life topics and long-term
interests do not need an action plan. Updates preserve history so a later
conversation can resume. Agent-level settings apply across that agent's lines.

Desktop's continuation button copies a pointer to the selected, successfully
loaded line. Paste it into the assistant where you want to continue. Copying
neither sends the record nor proves it was read or used. The assistant must
read the exact ID using its own identity; inability to read it is not a reason
to impersonate another identity, activate a different line, or substitute a
historical handoff. Reading a line does not itself authorize writes.

## Connecting an assistant

Copy the local setup brief only to a trusted client; it contains a credential.
Keep Desktop running and configure Streamable HTTP according to client support.
Service readiness, observed requests, a connection-check result, and actual
content use remain distinct. The access page can refresh its observations;
the visible recent range is not proof of a persistent connection or full history.
Connection checks read runtime state without creating InnerLife profiles or
user records. Model setup is not required for connection checks or reading
existing Shared Lines. Automatic context depends on host support and enabled
capabilities; a subscription in an assistant client is not a third-party API key.

## InnerLife

Permitted material enters the inbox. Background work can form thoughts and
share candidates when enabled. Review considers timing and conversation fit.
A pending candidate is not a delivered message; actual sharing requires evidence.

## Reading and recovery in 1.0.6

Search and agent switching invalidate earlier requests. Shared Line catalogs
query the selected agent before paging, and an overview sample does not cancel
an exact selection from a later page. InnerLife binds thoughts, daemon state
and diagnostics to the selected agent. Long text is read by record and agent,
up to 16,000 Unicode characters per page, with further pages available.

NOOP recall, executed retrieval, cache reuse, failure and unknown evidence have
separate descriptions. A terminal background failure remains visible even when
the daemon's retry counter is zero. Reading never claims a thought was delivered.

Knowledge catalogs keep per-document errors alongside readable entries.
Backlink results identify incomplete scans. Backup/import/restore results retain
the distinction between operation completion and subsequent page refresh.

See [Product direction](POSITIONING.md), [Context delivery](CONTEXT_DELIVERY.md),
and [Milestones and lifecycle evidence](TRACE_PAGE.md).
