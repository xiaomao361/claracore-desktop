# Continuity Core

Desktop-owned shared-line and current-position logic.

This module uses the product database at `claracore.db`. Existing Continuity data under old ClaraCore service paths is treated as an import source only; Desktop must not mutate it directly.

## Product Boundary

- Shared Line stores the current resumable position.
- Memoria stores durable observable facts and structured records.
- Shared Line may reference fact IDs in `facts_used_json`, but it does not call Memoria to work.
- InnerLife output may update Shared Line only through explicit user action.

## Data Surface

- `continuity_lines`: named shared-line tracks.
- `current_positions`: one current position per line.
- `current_positions.metadata_json`: legacy Continuity metadata used by Desktop review surfaces, such as agent, mode, visibility, interpretation boundary, and trace fields.
- `continuity_position_history`: append-only saved position history.
- `continuity_snapshots`: append-only snapshots, including confirmed-overwrite checkpoints.
- `continuity_handoffs`: handoff records for agent resume.

## Desktop UI

The Shared Line view supports:

- active line status and module counts,
- view-first line browsing without activating or reordering the clicked line,
- agent filtering for imported and agent-authored lines,
- current position, `draft` / `confirmed` status, and fact-reference review,
- formatted current position and trace display so old raw text is split into readable rows,
- legacy Continuity fields such as agent, visibility, mode, next step, state summary, current interpretation, shared reality line, entry posture, confirmed ground, provisional read, boundary notes, misread risks, position history, and affective trace,
- recent history and snapshot review,
- handoff review,
- copyable resume packet.

Human UI is intentionally review-oriented. Create, update, archive, restore, and handoff writes are primarily agent-facing through CLI and Gateway MCP.

## Old Continuity Import

Old Continuity data is imported by copy, not by mutating the old service database.

Current importer support:

- reads old `session_threads` into Desktop `continuity_lines`,
- writes current thread state into `current_positions`,
- preserves legacy metadata in `current_positions.metadata_json`,
- writes initial imported state into history and snapshots,
- reads old `handoffs` into `continuity_handoffs`,
- reads old `state_snapshots` into `continuity_snapshots`,
- creates a product backup before import.

The old database remains an import source only.

## CLI

Use `node core/cli.js shared-line <command>`:

- `get [--line-id <id>]`
- `list [--limit N]`
- `create --title <text> [--no-activate]`
- `activate --line-id <id>`
- `rename --line-id <id> --title <text>`
- `archive --line-id <id>`
- `restore --line-id <id> [--activate]`
- `update --summary <text> [--line-id <id>] [--status draft|confirmed] [--facts-used a,b] [--confirm-overwrite]`
- `handoff [--line-id <id>] [--objective <text>] [--completed a,b] [--open-items a,b] [--next-step <text>]`

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
