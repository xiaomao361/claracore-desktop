# Continuity Core

Desktop-owned shared-line and current-position logic.

This module uses the product database at `claracore.db`. Existing Continuity data under old ClaraCore service paths is treated as an import source only; Desktop must not mutate it directly.

In the Desktop product, the user-facing surface is Shared Line. Continuity is
the internal/domain name and old-service import lineage.

## Product Boundary

- Shared Line stores the current resumable position.
- Memoria stores durable observable facts and structured records.
- Shared Line may reference fact IDs in `facts_used_json`, but it does not call Memoria to work.
- InnerLife output may update Shared Line only when an agent explicitly calls the
  Shared Line product tools. It is not auto-applied by the InnerLife UI.

## Data Surface

- `continuity_lines`: named shared-line tracks.
- `continuity_lines.agent_id`: first-class agent ownership for agent-scoped line listing and default line selection.
- `current_positions`: one current position per line.
- `current_positions.metadata_json`: shared-reality and legacy Continuity metadata used by Desktop review surfaces and agent resume packets, such as mode, visibility, next step, state summary, current interpretation, shared reality fields, boundary fields, position history, and affective trace.
- `continuity_position_history`: append-only saved position history.
- `continuity_snapshots`: append-only snapshots, including confirmed-overwrite checkpoints.
- `continuity_handoffs`: handoff records for agent resume.
- `continuity_agent_state`: Continuity-specific agent style, relationship position, preferences, boundaries, stable patterns, and notes.
- `continuity_model_adjustments`: per-model negative adjustments used by resume packets.

## Desktop UI

The Shared Line view supports:

- active line status and module counts,
- view-first line browsing without activating or reordering the clicked line,
- right-side detail review for the selected line; selection is a UI focus state, not the agent-active line,
- agent filtering for imported and agent-authored lines,
- current position, `draft` / `confirmed` / `active` / `needs_review` / `stale` / `closed` status, and fact-reference review,
- formatted current position and trace display so old raw text is split into readable rows,
- legacy Continuity fields such as agent, visibility, mode, next step, state summary, current interpretation, shared reality line, entry posture, confirmed ground, provisional read, boundary notes, misread risks, position history, and affective trace,
- recent history and snapshot review,
- handoff review,
- copyable resume packet.

Human UI is intentionally review-oriented. Create, update, archive, restore, and handoff writes are primarily agent-facing through CLI and Gateway MCP.

Chinese Desktop UI uses `记忆` for the left navigation and Memory page title. `Memoria` remains the English/module name in technical surfaces.

## Old Continuity Import

Old Continuity data is imported by copy, not by mutating the old service database.

Current importer support:

- reads old `session_threads` into Desktop `continuity_lines`,
- writes current thread state into `current_positions`,
- preserves legacy metadata in `current_positions.metadata_json`,
- writes initial imported state into history and snapshots,
- reads old `handoffs` into `continuity_handoffs`,
- reads old `state_snapshots` into `continuity_snapshots`,
- reads old `agent_state` into `continuity_agent_state`,
- reads old `model_adjustments.json` into `continuity_model_adjustments`,
- creates a product backup before import.

The old database remains an import source only.

## CLI

Use `node core/cli.js shared-line <command>`:

- `get [--line-id <id>] [--agent-id <id>] [--full-arc]`
- `list [--limit N] [--agent-id <id>] [--all-agents]`
- `create --title <text> [--agent-id <id>] [--no-activate]`
- `activate --line-id <id>`
- `rename --line-id <id> --title <text>`
- `archive --line-id <id>`
- `restore --line-id <id> [--activate]`
- `update --summary <text> [--line-id <id>] [--agent-id <id>] [--status draft|confirmed|active|needs_review|stale|closed] [--facts-used a,b] [--reality-line <text>] [--confirmed-ground <text>] [--provisional-read <text>] [--boundary-notes <text>] [--misread-risks <text>] [--affective-tone <text>] [--confirm-overwrite]`
- `handoff [--line-id <id>] [--objective <text>] [--completed a,b] [--open-items a,b] [--next-step <text>]`
- `agent-state [--agent-id <id>] [--communication-style <text>] [--relationship-position <text>] [--long-term-preferences a,b] [--boundaries a,b] [--stable-patterns a,b] [--notes <text>]`
- `model-adjust list|get|set|delete [--model <name>] [--forbidden-phrases a,b] [--forbidden-patterns a,b] [--inject-prompt <text>]`
- `compact [--line-id <id>] [--keep-trace N] [--keep-history N]`

The agent-facing CLI/MCP surface now accepts the old Continuity shared-reality and affective fields as formal inputs. They are persisted in `current_positions.metadata_json` and included in resume packets. Continuity-specific `agent_state` and `model_adjustments` are product-owned tables and are also included in resume packets.

## Current Position Semantics

There is exactly one current position per Shared Line. Imported legacy data may
carry old position ids, so updates must not assume the current position id is
always `position_${lineId}`. The write path must:

- resolve the target line first,
- reuse the existing current position id when one already exists,
- upsert `current_positions` by `line_id`,
- append to `continuity_position_history`,
- append to `continuity_snapshots`,
- return a resume packet for the line that was actually written.

MCP write tools (`shared_line_update`, `create`, `activate`, `rename`,
`archive`, `restore`, `handoff_create`) return a lite resume packet: the saved
position, recent history/snapshots/handoffs, shared reality, and the text
packet, with `lines`, `archivedLines`, and `agentStates` empty. Full packets
come from `shared_line_get`; full line lists come from `shared_line_list`.

For session startup, agents should not call `shared_line_list` /
`shared_line_activate` / `shared_line_get` as separate steps:
`innerlife_session_start` bundles the active line's lite resume packet
(`shared_line`) and a compact `shared_lines` summary, and accepts an optional
`lineId` that activates that line in the same call. The separate tools remain
for mid-session reads and switches.

`shared_line_update` and the CLI `shared-line update` follow this rule. Passing
`lineId` updates that exact active line. Omitting `lineId` updates the current
active line, not an agent-inferred recent line. Agents that maintain several
lines should call `shared_line_list` and pass the real `lineId` explicitly.

The default line exists as a fallback, but reading or ensuring it exists must
not refresh its `updated_at`; otherwise it can incorrectly become the most
recent line for agent-scoped views.

## Arc Lifecycle

The affective trace and position history are managed arcs, not unbounded logs:

- **Momentary readings are transient.** An affective node with
  `stability: momentary` is not persisted into the trace and does not alter
  shared reality. It is a passing signal, not a recorded position.
- **Consecutive duplicates are de-duplicated.** An affective node identical to
  the previous one (tone, valence, intensity, signals) is not appended again.
- **Persisted arcs are capped.** The stored trace and position history are each
  capped (currently 50 nodes). When over the cap, oldest non-protected nodes are
  dropped first. Affective nodes flagged `needs_review` are protected and always
  kept.
- **Resume packets are truncated by default.** `getResumePacket` /
  `shared_line_get` returns only the most recent nodes (currently 5 each) plus
  protected nodes, and reports `arcMeta` with totals and truncation flags. Pass
  `fullArc: true` to get the complete arc.
- **Compaction is explicit.** `shared_line_compact` trims the persisted trace and
  history to a requested length while keeping protected nodes. It only rewrites
  the metadata arcs; summary, interpretation status, history, and snapshots are
  untouched, so it cannot bypass the confirmed-position overwrite guard.

## Gateway

Gateway exposes the same product-owned surface through:

- `shared_line_get`
- `shared_line_list`
- `shared_line_create`
- `shared_line_activate`
- `shared_line_rename`
- `shared_line_archive`
- `shared_line_restore`
- `shared_line_update`
- `shared_line_handoff_create`
- `shared_line_agent_state`
- `shared_line_model_adjustment_list`
- `shared_line_model_adjustment_get`
- `shared_line_model_adjustment_set`
- `shared_line_model_adjustment_delete`
- `shared_line_compact`

`shared_line_get` accepts `fullArc` to return the complete affective trace and
position history instead of the default truncated arc.
