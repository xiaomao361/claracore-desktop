# ClaraCore Desktop Market Product Parity

## Decision

ClaraCore Desktop is the main market-facing product.

It must eventually cover the user capabilities of the old Memoria, Continuity,
InnerLife, and Gateway projects inside one Desktop-owned product experience.
The old projects remain references and migration sources, not normal runtime
dependencies.

Desktop is agent-first and UI-light. The Gateway/MCP contract is the primary
operation path for agents. The human UI is still a complete product surface, but
its job is viewing, diagnostics, configuration, and small corrections rather
than approval-heavy or workflow-heavy operations.

UI coverage means the old systems' styles and user-visible capabilities are
represented in one consistent ClaraCore Desktop style. Functional parity does
not require every deep operation to become a large human UI workflow; deep and
repeatable operations should be implemented in core modules and exposed through
Gateway tools first.

## Safety Boundary

- Do not mutate existing service databases.
- Do not stop or replace the user's current local Gateway.
- Do not require old checkout paths in packaged mode.
- Build new capability against the Desktop-owned `claracore.db`.
- Old data import must remain preview-first and backup-gated.

## Capability Baseline

### Memory / Memoria

Old product capabilities:

- Durable fact storage with source and provenance.
- Semantic search through local Ollama embedding.
- Full-text fallback search.
- Labels, aliases, bidirectional-link style relationship indexing.
- Soft delete, restore, update, and tag management.
- Stats and label list.
- Web management: overview, search, graph, labels, all memories, restricted content.
- MCP and CLI tools for store, recall, get, delete, restore, tag, update, stats, labels.
- High-frequency structured records such as fitness logs with dedupe, query, and summary.
- Export/import.
- Maintenance tasks: rebuild, merge suggestions, dormant/archive handling.

Desktop status:

- Implemented: create, list, search, update, soft delete, restore deleted memory, restricted-content isolation, labels, label aliases with canonicalization, graph view, stats/labels UI, source, local Ollama embedding, embedding/label maintenance check and repair, merge suggestions with safe soft-delete merge, dormant/archive suggestions, archive/restore, structured records with type stats, portable Memory JSON export/import, backup-gated old Memoria import, backup-gated old Continuity import, backup-gated old InnerLife import, Gateway tools, backup, old-data import preview.
- Missing: full real-machine migration wizard flow, restore preview by imported item, and broader validation against live historical data shapes. Current import preview already shows mapped tables and truncated sample rows before import.

### Shared Line / Continuity

Old product capabilities:

- Agent-scoped session threads.
- Multiple parallel threads with private/shared visibility.
- State snapshots.
- Handoffs.
- Resume packets with continue/fork/blend/reset modes.
- Current interpretation, interpretation status, user confirmation, facts used.
- Affective trace and position history.
- Agent state.
- Audit events.
- Close, edit, merge, compact, delete.
- Model-adjust rules for negative model behavior.
- Web management with agent filters and all-agent view.
- MCP and CLI tools for list/show/resume/capture/close/compact/agent-state.

Desktop status:

- Implemented: default Shared Line, multiple Shared Lines/threads, active line switching, rename/archive/restore line management, current position, facts used, history, snapshots, handoff records, resume packet, user confirmation before overwriting confirmed state, Desktop UI, Gateway tools.
- Missing: multi-agent isolation, private/shared visibility, resume modes, affective trace, agent state, audit events, merge/delete/compact, model-adjust rules.

### InnerLife

Old product capabilities:

- Per-agent state, history, boundaries, and active context.
- Inbox queue from multiple windows.
- Session start/end lifecycle.
- Briefing at conversation start.
- Digest and afterthought processing.
- Pending shares with used/deferred/discarded lifecycle.
- Share timing and share-action history.
- Manual and daemon processing with retries/backoff.
- Memoria and Continuity sync inputs.
- Model configuration for local, OpenAI-compatible, and Anthropic-compatible providers.
- Autonomous source exploration with evidence.
- Experiences, explorations, source management.
- Convergence and stable summaries.
- Delivery queue and delivered/failed marking.
- Doctor, backup, scenarios, tests, launchd config.
- HTTP, CLI, and MCP management.

Desktop status:

- Implemented: profile/state storage, imported agent identities, session start/end, briefing, inbox submission/processing, explicit digest records, pending shares, deterministic share timing checks, used/deferred/discarded lifecycle, share-action history, inspect-first Desktop UI with agent filtering, Models page for provider/model/key/cadence configuration, explicit daemon enable/pause/status/tick controls in Models, Desktop automatic daemon scheduler, daemon retry/backoff recovery, Doctor recovery guidance, Gateway daemon/doctor tools, and backup-gated old InnerLife v2 copy import.
- Missing: model-backed digest/timing, autonomous sources/exploration, experiences, convergence summaries, delivery queue, scenarios.

### Gateway

Old product capabilities:

- Single MCP entry point aggregating Memoria, Continuity, InnerLife, Grafana, cognitive context, and service controls.
- Context assembly from memory, continuity, and inner state.
- Cross-system trace recording.
- Service registry and supervisor with start/stop/restart/logs.
- Web management console with health, service controls, cognitive snapshot, agent view, traces.
- Local-only cognitive HTTP endpoints.

Desktop status:

- Implemented: product-owned stdio MCP, status, unified Gateway context packet, Gateway tool-call trace recording/listing, Connections-page trace viewer, Memory tools, Shared Line tools, handoff tool, InnerLife lifecycle tools, InnerLife daemon status/set/tick tools, InnerLife doctor tool, setup docs, packaged `--gateway` path.
- Missing: service registry/supervisor, local HTTP endpoints, cognitive overview, fuller agent view, optional external providers.

## Product Priority

1. Gateway/MCP parity: expose complete agent-operated tools for Memory, Shared Line, InnerLife, data import/export, backup/restore preview, diagnostics, and maintenance.
2. Core module parity: finish the missing old-system behaviors in Desktop-owned core modules before expanding manual UI workflows.
3. UI-light parity: keep Desktop visually consistent with the old systems and expose viewing, search, status, configuration, diagnostics, small correction, and simple delete/restore/edit flows.
4. Migration hardening: keep old data import preview-first and backup-gated, validate against live historical data shapes, and expose import operations to agents.
5. Market packaging: signed macOS build, Windows tray/build, self-contained runtime, and agent setup that works after install.

## Current Next Target

Build the agent-operated product contract before adding more manual UI:

- Audit Gateway tools against old Memoria, Continuity, InnerLife, and Gateway capabilities.
- Add missing MCP tools for data import/export, backup/restore preview, diagnostics, and maintenance.
- Keep UI controls focused on state viewing, configuration, traces, simple correction, and simple delete/restore/edit paths.
- Expand core parity for Continuity multi-agent/thread behavior and InnerLife model-backed processing.
- Validate live old-data import shapes without mutating old sources.
