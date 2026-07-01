# ClaraCore Desktop UI/UX Polish Backlog

Date: 2026-07-01

Source screenshots:

- `/Users/zhouwei/Downloads/Claracore_images/首页1.png`
- `/Users/zhouwei/Downloads/Claracore_images/首页2.png`
- `/Users/zhouwei/Downloads/Claracore_images/记忆页1.png`
- `/Users/zhouwei/Downloads/Claracore_images/记忆页2.png`
- `/Users/zhouwei/Downloads/Claracore_images/共同线1.png`
- `/Users/zhouwei/Downloads/Claracore_images/共同线2.png`
- `/Users/zhouwei/Downloads/Claracore_images/内在活动1.png`
- `/Users/zhouwei/Downloads/Claracore_images/内在活动2.png`
- `/Users/zhouwei/Downloads/Claracore_images/备份.png`
- `/Users/zhouwei/Downloads/Claracore_images/日志.png`
- `/Users/zhouwei/Downloads/Claracore_images/智能体接入.png`
- `/Users/zhouwei/Downloads/Claracore_images/模型.png`
- `/Users/zhouwei/Downloads/Claracore_images/设置.png`

This backlog lists UI/UX polish work for the current ClaraCore Desktop surface.
It is intentionally a convergence plan, not a redesign. The app should remain a
quiet local control surface for agents to use and humans to inspect.

## Product-Level Gaps

### P0: Add A Clear "What Matters Now" Thread

Problem:

Most pages expose truthful runtime data, but the first reading path is not
always clear. The user sees many cards with similar visual weight and has to
decide what matters.

Adjustment:

- Each primary page should answer one sentence at the top of the content area:
  current state, whether action is needed, and the most relevant next action.
- Keep this as product state, not explanatory tutorial copy.
- Prefer compact summary rows or a small status strip over large prose blocks.

Acceptance:

- On every page, a user can identify the current state and whether action is
  needed within three seconds.
- The page's primary action is visually clearer than secondary inspection data.

### P0: Preserve Agent-First Hierarchy

Problem:

Agent Access is correct in content, but it still feels like a settings/logs
page rather than the primary integration console.

Adjustment:

- Make Agent Access read as the first-class agent entry point.
- Separate quick copy actions, current identity, connection mode, recent
  activity, and debug/source references.
- Add a compact source/debug entry that points to `docs/CODE_MAP.md`.

Acceptance:

- A new agent or operator can find MCP config, identity rules, current
  connection mode, and the source/code map entry without reading a long brief.

### P1: Reduce Raw Text Dominance

Problem:

Several pages show long raw text blocks by default. This is useful for evidence,
but it overwhelms the control surface.

Adjustment:

- Default to summarized cards for Memory, Gateway traces, and InnerLife items.
- Keep full raw text available behind expand/details controls.
- Preserve exact evidence where debugging requires it.

Acceptance:

- Dense content pages remain scannable at first glance.
- Full raw evidence is still reachable in one click or one expanded state.

### P1: Standardize Page Reading Structure

Problem:

The core module pages use different structures. Shared Line currently has the
clearest product reading model; Memory and InnerLife feel more like data
explorers.

Adjustment:

Use this rough page shape where appropriate:

1. Current state
2. Key metrics
3. Recent changes
4. Recommended action
5. Deep inspection

Acceptance:

- Memory, Shared Line, InnerLife, Agent Access, Models, Data, Logs, and Settings
  all share a predictable scan pattern without becoming visually identical.

## Page-Level Backlog

## Home

### P0: Compress Gateway Trace Detail On Home

Problem:

The Gateway trace card is visually heavy. Request/response content can compete
with higher-priority runtime status.

Adjustment:

- Show the newest or highest-priority trace as a compact row/card by default.
- Display tool name, agent, status, latency, and time first.
- Move request/response snippets behind expand or "Open in Agent Access".
- Keep errors expanded or visually elevated when present.

Acceptance:

- Home first screen prioritizes runtime status, pending attention, and agent
  state over raw Gateway payloads.
- Gateway errors still surface clearly.

### P0: Make Pending Attention More Actionable

Problem:

The "待处理" panel can say there is nothing to handle, but when there are items,
it needs to become the main action path.

Adjustment:

- When attention exists, show count, category, owner agent, and direct target
  view.
- When empty, keep the empty state compact.

Acceptance:

- The Home page makes it obvious whether the operator needs to do anything now.

### P1: Clarify Agent View As The Main Continuity Snapshot

Problem:

The Agent View section contains the strongest "where are we" signal, but it can
be visually buried between status and trace panels.

Adjustment:

- Promote current active agent/line state above recent trace details.
- Keep long current-focus text clipped with a clear expand affordance.
- Use consistent labels for related memory, pending shares, and Gateway calls.

Acceptance:

- The user can tell which agent is active, what line it is on, and what the
  current focus is without scrolling.

### P2: Tighten Core Module Cards

Problem:

Core module cards are useful but read like a second dashboard inside Home.

Adjustment:

- Keep module cards compact.
- Use consistent metric labels and link behavior.
- Consider moving deeper module stats to each module page.

Acceptance:

- Core module cards remain a quick health board, not a competing detail view.

## Agent Access

### P0: Reframe As Agent Integration Console

Problem:

The page content is correct, but the layout reads as a mixed table plus action
panel.

Adjustment:

- Divide the page into clear blocks:
  - Connected agents
  - Recent MCP activity
  - Quick copy actions
  - Identity contract
  - Connection mode
  - Debug/source references
- Keep the action column, but group actions by purpose instead of showing a
  flat button stack.

Acceptance:

- A new agent/operator can quickly locate "copy MCP config", current agent ids,
  recent activity, and source/debug references.

### P0: Add Code Map / Source Reference Entry

Problem:

The new code map exists, but it is not visible from the product.

Adjustment:

- Add a compact "Debug / Source Map" block.
- Point to `docs/CODE_MAP.md`.
- Optionally include app root and repo/source path when available.

Acceptance:

- Agent Access can tell a maintenance-capable agent where to read source
  ownership boundaries without implying ordinary agents should patch the app.

### P1: Clarify Agent Presence Versus Historical Activity

Problem:

The page says agents are grouped by MCP traces and do not imply online status,
but the visual cards may still feel like connected/live users.

Adjustment:

- Label cards as "recently active" or "recorded".
- If true online presence is unavailable, avoid live-style language.
- Keep last call time and error count visible.

Acceptance:

- The user does not confuse historical Gateway traces with live agent presence.

## Memory

### P0: Add Default Summary Mode For Memory Results

Problem:

Memory search results show long raw content by default. This makes the page feel
like a markdown dump.

Adjustment:

- Default result cards should show title, time/source/agent, labels, and a
  short summary or first few lines.
- Add an explicit "show full text" control.
- Preserve full text for evidence review.

Acceptance:

- The Search tab is scannable with hundreds of memories.
- A user can still expand a record to inspect raw content.

### P1: Explain Graph Semantics In The Graph Tab

Problem:

The graph is visually rich, but the meaning of nodes, colors, labels, and layers
is not obvious in the screenshot.

Adjustment:

- Add a compact graph legend or inline help row.
- Explain primary versus restricted layer.
- Explain what clicking a node does.

Acceptance:

- A user can understand what the graph represents without prior implementation
  knowledge.

### P1: Make Label List More Navigational

Problem:

The left label list is valuable, but it competes with page metrics and can feel
like a long unstructured list.

Adjustment:

- Group labels by type when possible: imported/source, agent, tool, system,
  topic.
- Keep counts visible.
- Consider a search/filter for labels if the list grows further.

Acceptance:

- Users can use labels as navigation, not only as raw facets.

### P2: Clarify Vector Maintenance State

Problem:

The rebuild-vector action and "no pending vectors" state are present, but the
reason to act is not always obvious.

Adjustment:

- Show whether vector maintenance is healthy.
- Explain pending/embedded/failed counts in one compact row.
- Keep rebuild action disabled or secondary when no work exists.

Acceptance:

- Users can tell whether vector maintenance needs intervention.

## Shared Line

### P0: Keep Detail Context Visible

Problem:

The Shared Line page has strong detail content, but independent scrolling can
make the selected line context disappear.

Adjustment:

- Keep selected line name, agent, status, and updated time visible at the top of
  the detail panel.
- Ensure the right detail panel always identifies what line it is describing.

Acceptance:

- While scrolling the detail/trace panel, the user never loses which line is
  selected.

### P1: Keep "Line" And "Archive" Language Stable

Problem:

The page uses tabs and cards that are generally clear, but status labels such
as selected, active, confirmed, draft, archive, and read-only need consistent
meaning.

Adjustment:

- Define visible status labels and use them consistently.
- Avoid mixing implementation status with user-facing state when possible.

Acceptance:

- A user can distinguish active line, selected line, archived line, and draft
  line without reading raw data.

### P1: Promote Next Step And Boundary Notes

Problem:

The best Shared Line content is current progress, next step, and boundary.
These should stay near the top of the detail view.

Adjustment:

- Keep next step, current interpretation, and boundary notes above long trace
  history.
- Let trace/history remain available but secondary.

Acceptance:

- The detail panel reads as "current resumable position" before it reads as
  history.

## InnerLife

### P0: Simplify The First Screen

Problem:

The InnerLife page exposes many concepts at once: brain, summaries, sessions,
inner changes, experiences, stable recognition, and configuration.

Adjustment:

- First screen should emphasize:
  - selected agent
  - daemon/background loop status
  - pending shares
  - recent approved/pending thoughts
  - next useful action
- Move deeper material such as experiences, stable recognition, and advanced
  configuration lower or behind collapsible sections.

Acceptance:

- A user can understand what InnerLife is doing now without parsing every
  internal category.

### P1: Separate Pending, Approved, And Historical Material

Problem:

Pending thoughts, approved output, sessions, summaries, and historical stable
knowledge can appear close together.

Adjustment:

- Visually separate:
  - pending review/share queue
  - approved outputs
  - session history
  - stable/historical knowledge
- Use consistent status badges.

Acceptance:

- A user can tell what still needs review versus what has already been
  processed.

### P1: Make Agent Selector Context Stronger

Problem:

InnerLife is agent-scoped, but selected-agent context can get lost while
scrolling.

Adjustment:

- Keep selected agent and daemon state visible near the top of the content.
- Consider a sticky compact header inside the main panel.

Acceptance:

- The user always knows which agent's inner activity is being inspected.

## Data

### P1: Strengthen Import Risk Copy

Problem:

Import JSON is visually marked as dangerous, but the consequence and safety path
should be clearer.

Adjustment:

- Add one compact sentence explaining what import affects.
- State whether import previews, overwrites, merges, or creates a safety backup.
- Keep the dangerous action visually distinct.

Acceptance:

- A user understands the consequence before clicking import.

### P2: Clarify Backup Artifact Pair

Problem:

Backups show a database file and a JSON manifest. This is technically correct,
but the role of each artifact could be clearer.

Adjustment:

- Label `.db` as exact SQLite restore point.
- Label `.json` as manifest/metadata.

Acceptance:

- A non-implementation user can understand what each backup file is for.

## Logs

### P1: Add Log Filters

Problem:

The log view is useful for debugging, but it is a large raw terminal block.

Adjustment:

- Add filters for source/type, such as desktop, gateway, memoria, backup, and
  errors.
- Keep raw full log view available.

Acceptance:

- Users can isolate relevant log categories without reading the whole stream.

### P1: Confirm Before Clearing Logs

Problem:

The clear action can remove useful diagnostic evidence.

Adjustment:

- Add a confirmation step before clearing logs.
- Mention that recent debugging evidence may be removed.

Acceptance:

- Logs cannot be cleared by a single accidental click.

## Models

### P0: Add Connection Test And Last Success State

Problem:

Model configuration can look available without proving that the endpoint and
model are currently reachable.

Adjustment:

- Add "Test connection" for embedding and InnerLife model blocks.
- Show last success time or last error.
- Keep "Get models" but distinguish it from a connection health test.

Acceptance:

- A user can verify whether each model configuration actually works.

### P1: Rename Or Clarify "Boundary"

Problem:

The right-side "边界" panel is useful but abstract.

Adjustment:

- Rename to "当前配置摘要" or "使用位置".
- Show where each model setting is used: memory vectors, InnerLife loop, secret
  reference.

Acceptance:

- The right panel reads as a configuration summary, not an abstract concept.

### P2: Make Secret Reference Behavior More Explicit

Problem:

The UI shows masked keys and env references, but the storage/usage boundary may
not be obvious.

Adjustment:

- Clarify whether a field is a stored secret reference, direct secret, or
  environment variable name.
- Avoid exposing more secret material than necessary.

Acceptance:

- Users understand which values are stored and which are references.

## Settings

### P1: Add Documentation / Code Map Entry

Problem:

Settings shows runtime facts, but it does not expose current docs/source entry
points.

Adjustment:

- Add a docs/source section or link row:
  - `docs/ARCHITECTURE.md`
  - `docs/CODE_MAP.md`
  - app root
  - data root
- Keep this read-only.

Acceptance:

- Operators and maintenance agents can find current docs from inside the app.

### P2: Tighten About Runtime Facts

Problem:

The About panel has useful facts, but they could read more like a stable
runtime fact table.

Adjustment:

- Keep version, mode, database, close-window behavior, tray, theme, motion,
  Electron, and Node.
- Add source/build metadata later if available.

Acceptance:

- The About panel can be used as a quick runtime facts reference.

## Bottom Runtime Bar

### P1: Reduce Visual Noise While Preserving Truth

Problem:

The bottom bar is valuable, but CPU, memory, process, disk, uptime, and local
time compete with page content.

Adjustment:

- Keep the bottom bar compact and stable.
- Consider grouping resource metrics under "Resources" or dimming secondary
  metrics.
- Preserve warning visibility for high memory/disk states.

Acceptance:

- The bottom bar remains useful but does not visually dominate every page.

## Suggested Implementation Order

### Pass 1: Product Hierarchy

1. Home: compress Gateway trace detail.
2. Home: promote pending attention and agent continuity state.
3. Agent Access: reframe as integration console.
4. Agent Access: add Code Map / source reference entry.

### Pass 2: Core Module Readability

1. Memory: default summary mode for search results.
2. Memory: graph legend and label grouping.
3. Shared Line: sticky selected-line context and status-label cleanup.
4. InnerLife: simplify first screen and separate pending/approved/history.

### Pass 3: Operational Surfaces

1. Models: connection tests and current configuration summary.
2. Logs: filters and clear confirmation.
3. Data: import risk copy and backup artifact labels.
4. Settings: docs/source entry and cleaner runtime facts.

### Pass 4: Global Fit And Finish

1. Standardize page summary pattern.
2. Tune raw-text expansion behavior.
3. Review bottom runtime bar visual weight.
4. Run desktop and narrow-width visual checks.

## Non-Goals For This Polish Round

- Do not redesign the whole visual language.
- Do not add a chat surface.
- Do not add plugin/extension architecture.
- Do not hide runtime truth behind decorative UI.
- Do not add broad new product modules before current pages are clearer.

