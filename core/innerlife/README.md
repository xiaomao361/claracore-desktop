# InnerLife Core

Desktop-owned InnerLife state and loop configuration live in the product
database, not in the old standalone service database.

Existing `services/innerlife` code is a reference and import source. Normal
Desktop product use should go through this app's SQLite-backed product core,
Gateway MCP tools, or CLI fallback.

## Current Surface

Desktop currently owns:

- InnerLife profile state.
- Inbox material from agents or imported sources.
- Session start/end records.
- Briefing generation from Shared Line, Memory, pending shares, and inbox.
- Digest runs and share candidate generation.
- Autonomous exploration and convergence into waiting share candidates.
- Internal change history, formed experiences, and stable summaries.
- Pending share lifecycle records.
- Share timing checks against current context.
- Daemon enable/pause/tick state, scheduler behavior, and recovery doctor.
- Backup-gated copy import from the old InnerLife v2 database.
- Model provider, endpoint, model names, API key references, and loop cadence
  configured from the Desktop Models page.
- Source ingest from profile `autonomous_sources` into pending inbox material.

## Model-Backed Generation

Digest, manual process-once, exploration, convergence, and session-end
afterthoughts run through the configured InnerLife model when one is set, and
fall back to a deterministic template otherwise. Generation is tiered: `digest`
follows its `mode` (deep mode uses the deep model), `converge` uses the deep
model, and the rest use the light model.

Each generated record stores `generationSource` in its metadata:

- `model`: produced by the configured InnerLife model.
- `template`: provider is `disabled` or no model name is configured.
- `fallback`: a model was configured but the call failed; the template body is
  kept and tagged with `[InnerLife model fallback: <error>]`.

Model failures never throw out of the generation step, so a degraded or
unreachable model produces a clearly tagged waiting share instead of breaking
the daemon tick or session lifecycle. The model client supports `ollama`
(`/api/chat`) and `openai-compatible` (`/v1/chat/completions`) providers, reusing
the same secret-ref pattern as Memory embeddings (`innerlife.llm.api_key`).

The Desktop InnerLife page is intentionally inspect-oriented. Agents create and
update InnerLife state through Gateway MCP or CLI fallback. Humans can inspect
state and operate daemon controls from the InnerLife runtime panel, but the page
should not become a manual workflow surface for writing thoughts, reviewing
shares, or applying InnerLife output into other modules.

InnerLife output is product state until an agent explicitly writes Memory or
Shared Line through the corresponding product tools. The UI does not auto-apply
shares into Memory or Shared Line.

Daemon ticks can be triggered by the background scheduler or by the UI. The
runtime guards same-agent ticks so concurrent scheduler and manual activity do
not generate duplicate share candidates. Enabling the daemon while inbox items
are pending may immediately process that inbox instead of waiting for the next
interval.

When an agent profile contains `autonomous_sources`, each due daemon tick first
fetches those public RSS, Atom, or webpage sources, dedupes recent items, and
writes new material to the InnerLife inbox before running the existing digest
path. Manual `innerlife explore` uses the same ingest step before generating an
exploration thought. Source fetches honor `HTTP_PROXY`, `HTTPS_PROXY`,
`ALL_PROXY`, and `NO_PROXY` environment variables, so Desktop can use the host's
normal outbound proxy setup for external feeds.

Agent IDs come from the Gateway process `CLARACORE_AGENT_ID`. Use short, stable
product identities such as `lara`, `clara`, or `codex`; do not rely on
per-tool-call `agentId` arguments to override the caller identity. If an agent is
renamed, run `agent_identity_merge` to consolidate legacy rows.

## Agent Access

Preferred path: Desktop-owned Gateway MCP.

Useful MCP tools include:

- `innerlife_status` (lite by default: counts, pending share previews, daemon,
  doctor; pass `detail: true` only when full sessions, digest runs, and history
  are needed)
- `innerlife_briefing`
- `innerlife_sessions`
- `innerlife_session_start` (returns share_plan plus the active Shared Line
  resume packet and an active-only `shared_lines` summary in one call; pass
  `lineId` to activate a line in the same call — no separate
  `shared_line_list` / `shared_line_activate` / `shared_line_get` startup
  round trips needed)
- `innerlife_session_end` (`sessionId` is canonical and `session_id` is a
  compatibility alias; `summary` accepts text or a structured JSON object;
  returns a compact acknowledgement with the closed session, created ids,
  afterthought share, and converged/reason; full state comes from
  `innerlife_status` / `innerlife_briefing`)
- `innerlife_submit_inbox`
- `innerlife_submit_fact`
- `innerlife_submit_continuity`
- `innerlife_digest`
- `innerlife_explore`
- `innerlife_converge`
- `innerlife_history`
- `innerlife_experiences`
- `innerlife_summaries`
- `innerlife_share_check`
- `innerlife_pending_shares`
- `innerlife_share_actions`
- `innerlife_mark_share`

Marking a share as `used` requires `deliveryEvidence` with a conversation id,
the actual response excerpt, and the share timestamp. Candidate, pending, or
discarded rows are not counted as confirmed shares on Home.
- `innerlife_daemon_status`
- `innerlife_daemon_set`
- `innerlife_daemon_tick`

Digest run storage is bounded: each digest prunes `innerlife_digest_runs` to
the newest 200 rows for that agent. Use the paginated digest tools or
`innerlife_status` with `detail: true` for inspection, not the default status
call.

CLI fallback:

```bash
node core/cli.js innerlife status
node core/cli.js innerlife briefing --agent codex
node core/cli.js innerlife session-start --agent codex --user local-user --host cli
node core/cli.js innerlife inbox --body "material to digest later"
node core/cli.js innerlife digest --mode light
node core/cli.js innerlife pending
node core/cli.js innerlife share-check --context "current conversation context"
```
