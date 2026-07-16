# ClaraCore Desktop v0.5.7 Logs Page Handoff

Date: 2026-07-16

Status: implemented and validated on isolated data as the v0.5.7 development
checkpoint.

## Implementation Checkpoint

Completed on 2026-07-16:

- the first screen now contains one bounded recent-error status, local filters,
  the log stream, Refresh, and Follow;
- the old five-value status strip and duplicate page-focus dashboard were
  removed;
- Decay Audit and technical Time Flow remain available inside one closed,
  read-only Advanced Diagnostics disclosure;
- the human Clear Logs button, renderer DOM, event wiring, and copy were
  removed while preload, IPC, runtime, repository, and Phase 1 clear-log
  contracts remain intact;
- the Phase 4 Electron smoke now exercises every filter, Follow, Refresh,
  Advanced Diagnostics, theme/language changes, and navigation re-entry;
- runtime events, Gateway traces, Memory, Shared Line, and InnerLife tables are
  fingerprinted before and after Logs-page reading and remain unchanged;
- automated validation and Electron visual QA passed in English light, Chinese
  dark, expanded diagnostics, and an 820px narrow viewport.

## Continuation Prompt

```text
继续检查 ClaraCore Desktop v0.5.7 的日志页面实现。先阅读
docs/HANDOFF_V0.5.7_LOGS_PAGE.md，确认 repo、git 状态，并保护当前未提交的
0.5.7 版本切换、记忆页、共同线和内在活动页面实现。先复核主路径、只读指纹、
高级诊断和底层 clearLogs 契约，再决定是否需要继续调整；不要改首页或使用印记，
不要新增数据统计。
```

## Repository And Working Tree Truth

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Published baseline: `v0.5.6` at commit `c062777`
- Current development version: `0.5.7`
- Product version source: `package.json`, read through `core/version.js`
- At implementation start, the working tree intentionally contained the v0.5.7
  version transition plus completed Memory, Shared Line, and InnerLife work;
  the closeout preserved that full batch.
- Treat every existing modification as pre-existing user work. Do not revert,
  rewrite, bulk-stage, commit, or push it unless the user explicitly asks.

Start with:

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short
git diff --stat
```

Before editing shared files, inspect the current diffs in `index.html`,
`app.js`, `app/dom.js`, both i18n files, `styles/dark-fixes.css`,
`styles/views/responsive.css`, and `core/tests/ux-polish-ui-smoke.js`. Preserve
the completed v0.5.7 page work deliberately.

## This Round

### Will do

- Clarify the Logs page as a read-only diagnostic evidence surface.
- Make the log stream the primary content.
- Keep useful viewing actions: refresh, follow, and local filtering.
- Replace the current equal-weight count strip with one quiet health summary.
- Put Decay Audit and the technical Time Flow behind a closed, read-only
  Advanced Diagnostics disclosure.
- Remove the human-facing Clear Logs control from the Logs page.
- Update Chinese and English copy together.
- Add or update UI coverage for hierarchy, read-only behavior, and Advanced
  Diagnostics.

### Will not do

- Do not redesign the whole page or change the navigation structure.
- Do not change Home; Home remains the last page to discuss.
- Do not begin Usage Imprint or reinterpret Time Flow as Usage Imprint.
- Do not add charts, analytics, usage counts, or dashboard cards.
- Do not add log management, retention configuration, export, download, or
  search systems.
- Do not delete or weaken runtime, database, preload, IPC, MCP, CLI, or test
  capabilities merely because a human UI control is removed.
- Do not alter Memory, Shared Line, InnerLife, Agent Access, Settings, or their
  data semantics except for unavoidable shared-shell compatibility.
- Do not commit or push unless the user asks.

### Validation path

- Static checks and diff hygiene.
- Existing Phase 1 domain coverage for the underlying log-clear capability.
- Phase 4 Gateway/Logs Electron UI smoke with Advanced Diagnostics open and
  closed.
- Shell and UX-polish regressions.
- Real Electron visual QA with isolated data.

### Done criteria

- A new user understands that the page is only needed when something goes
  wrong or when technical evidence is required.
- The first screen is visibly dominated by status, filters, and the log stream.
- Secondary system evidence is available but closed by default.
- No primary control asks the human to maintain or delete logs.
- All normal page interactions are read-only.
- Existing agent/runtime logging and clear-log backend contracts still pass.

## Confirmed Product Principle

The Logs page follows **Agent First**:

> The system and agents produce, retain, rotate, and use diagnostic evidence.
> The human Desktop surface reads and verifies it; it is not a log-management
> console.

The human purpose of the page is narrow:

> When something goes wrong, show me what happened.

Recommended first-screen explanation:

> 系统运行和智能体连接的只读证据，出现问题时再看。

English equivalent:

> Read-only evidence from system activity and agent connections, available
> when something goes wrong.

The page may remain more technical than Memory, Shared Line, and InnerLife.
Those product pages now hide implementation evidence; Logs is the appropriate
place to preserve bounded diagnostic visibility without making every normal
page feel like an admin console.

## Why This Page Only Needs A Light Change

The current page already has a coherent job:

- runtime events and Gateway traces are real diagnostic evidence;
- Errors, Runtime, Gateway, UI, and All filters are understandable;
- Refresh and Follow change only how evidence is viewed;
- raw terminal output is appropriate on a Logs page;
- Decay Audit and Time Flow are already read-only.

The problem is hierarchy, not missing capability. The current count strip,
terminal, Decay Audit, and Time Flow all compete at equal visual weight. A new
user must understand several internal concepts before reaching the actual
logs. This slice should remove that competition without replacing the working
diagnostic model.

## Confirmed Primary Reading Path

The normal page contains only:

1. A quiet current status.
2. Local filters.
3. The log stream.
4. Refresh and Follow controls.
5. One closed Advanced Diagnostics disclosure below the stream.

Recommended hierarchy:

```text
日志
系统运行和智能体连接的只读证据，出现问题时再看。

● 最近没有发现错误                         [刷新] [跟随]

[错误] [运行时] [Gateway] [界面] [全部]

┌──────────────────────────────────────────────┐
│ 14:32:01  Gateway  memoria_recall      42ms  │
│ 14:31:58  Runtime  snapshot refreshed        │
│ ...                                          │
└──────────────────────────────────────────────┘

▶ 高级诊断
```

This is an information hierarchy, not a required pixel-perfect design. Reuse
the existing visual language and components where practical.

## Primary Status

Replace the five-value status strip with one human-readable status line.

Recommended semantics:

- No recent errors: `最近没有发现错误` / `No recent errors found`.
- Recent errors exist: `最近发现 {count} 条错误` / `{count} recent error(s)`.
- If the snapshot is unavailable: show a quiet unavailable state rather than
  claiming health.

Rules:

- Derive the error count from the same bounded snapshot currently used by the
  page; do not imply full historical health.
- Avoid permanent Runtime, Gateway, Time Flow, Visible Lines, and Decay Audit
  count cards.
- A count is useful when it points to a problem. Counts are not the product.
- Do not introduce severity dashboards or health scores.

## Filters And Log Stream

Keep the existing filter model unless real implementation evidence requires a
small correction:

- Errors
- Runtime
- Gateway
- UI
- All

Rules:

- Filtering is local view state and must not mutate stored logs.
- Keep the filter explanation quiet; it does not need equal visual weight with
  the stream.
- Preserve the current bounded rendering behavior rather than attempting an
  unbounded log viewer in this slice.
- Preserve raw metadata that is genuinely useful for debugging.
- Keep empty states calm and explicit.
- Keep Follow as a viewing mode. It may remain enabled by default.
- Refresh and automatic follow refresh must not duplicate stored events or
  alter Memory, Shared Line, InnerLife, Gateway trace, or runtime-event rows.

Do not add full-text search, date ranges, pagination, export, copy-all, or a
new log query API in this round.

## Advanced Diagnostics

Move both existing secondary sections into one closed `<details>`-style
Advanced Diagnostics disclosure:

- Decay Audit.
- Technical Time Flow.

Rules:

- Closed by default on every normal page entry.
- Read-only.
- Opening, closing, refreshing, filtering, following, changing theme/language,
  or navigating away and back must not mutate product data.
- Keep the data available for diagnosis; do not remove it merely to simplify
  the first screen.
- Avoid duplicating the raw log stream inside Advanced Diagnostics.
- If expensive work can be deferred safely, render it only after expansion;
  do not add a new data-loading architecture solely for this slice.

### Decay Audit boundary

Decay Audit remains technical evidence about dormant, stale, waiting, or
errored state. It does not become a human work queue.

- Keep its current diagnostic content and issue examples.
- Do not add approve, clean up, archive, delete, resolve, or repair actions.
- Rewrite management-oriented copy such as “复查项” only where needed so the
  section reads as evidence, not assigned work.

### Time Flow boundary

The current Time Flow joins recent evidence from Memory, Shared Line,
InnerLife, Gateway, and runtime events. Keep it as a technical cross-system
sequence under Advanced Diagnostics.

It is **not Usage Imprint**:

- do not make it emotional, commemorative, or user-facing product history;
- do not add usage totals, streaks, milestones, or activity analytics;
- do not rename it to Usage Imprint;
- do not expand its data model for the future Usage Imprint idea.

Usage Imprint will be discussed separately later.

## Clear Logs Decision

Remove `Clear` from the human Logs page.

Reason:

- deletion is maintenance, not observation;
- a prominent destructive control makes the human responsible for system
  hygiene;
- removing evidence from the evidence page conflicts with the page's purpose;
- retention and rotation should ultimately be system-owned under Agent First.

This is a **renderer decision**, not authorization to delete the underlying
capability.

For this slice:

- remove the `#clearLogs` button and its page event wiring;
- remove renderer-only DOM and copy that become unused;
- preserve `window.ClaraCoreDesktop.clearLogs()` unless a separate security
  review proves it should change;
- preserve the preload, IPC handler, runtime, repository/database clear
  implementation, and Phase 1 domain test;
- do not move Clear into Settings in this round;
- do not claim automatic retention/rotation exists unless current code proves
  it;
- do not build retention/rotation as part of this UI optimization.

If a future session decides a human emergency clear path is necessary, it
should be separately designed under Settings -> Logs and Diagnostics with
explicit scope and confirmation. That decision is not part of v0.5.7 Logs UI.

## Read-Only Invariant

Record database-backed diagnostic state before and after representative human
interactions and prove it is unchanged.

At minimum cover:

- opening Logs;
- changing every filter;
- toggling Follow off and on;
- manual Refresh;
- opening and closing Advanced Diagnostics;
- switching theme and language;
- navigating away and back.

Fingerprint at least runtime events and Gateway traces. Where the test fixture
already creates Memory, Shared Line, and InnerLife rows for Time Flow and Decay
Audit, also prove these records and lifecycle states do not change through
Logs-page reading.

Do not interpret in-memory UI lines produced by Refresh as persisted runtime
events. The invariant concerns stored product state and agent-owned lifecycle
state.

## Current Implementation Surfaces

Primary renderer paths:

- `index.html`: Logs heading, toolbar, five-value status strip, filter row,
  terminal, Decay Audit, and Time Flow markup.
- `app/dom.js`: Logs DOM registry, including `clearLogs` and status counts.
- `app/views/logs.js`: filters, bounded terminal rendering, follow timer,
  refresh, clear action, Decay Audit, and cross-system Time Flow construction.
- `app.js`: Logs view integration, event listeners, view focus copy/metrics,
  and refresh-timer synchronization.
- `app/view-registry.js`: Logs title/subtitle registration.
- `app/i18n/zh.js` and `app/i18n/en.js`: Logs, filters, clear action, status,
  Decay Audit, Time Flow, and focus copy.

Primary styles:

- `styles/views/logs.css`
- `styles/views/responsive.css`
- `styles/dark-fixes.css`
- `styles/views/product.css`

Backend capability to preserve:

- `electron/preload.js`
- `electron/ipc-contracts.js`
- `electron/ipc-handlers.js`
- `electron/main.js`
- `core/runtime/index.js`
- `core/db/repositories/system.js`

Primary tests:

- `core/tests/phase4-gateway-trace-ui-smoke.js`
- `core/tests/phase1-smoke.js`
- `core/tests/shell-window-smoke.js`
- `core/tests/ux-polish-ui-smoke.js`
- `core/tests/ipc-contract-lint.js`

Important current-test detail:

`phase4-gateway-trace-ui-smoke.js` currently expects Decay Audit and Time Flow
content to be directly visible after opening Logs. Update it to open Advanced
Diagnostics before asserting those sections. Preserve its Memory, Shared Line,
InnerLife, Gateway error, and decay fixtures.

`phase1-smoke.js` directly verifies that the runtime/database Clear Logs
capability deletes runtime events and Gateway traces. Keep that test. The UI
control is being removed; the underlying contract is not.

## Suggested Implementation Sequence

1. Reconfirm repo truth and protect all existing v0.5.7 changes.
2. Inspect current Logs-related diffs before editing shared files.
3. Extend the Phase 4 Logs/Gateway UI smoke with read-does-not-write
   fingerprints and Advanced Diagnostics open/closed behavior.
4. Replace the five-value status strip with one bounded recent-error summary.
5. Keep and visually tighten filters, terminal, Refresh, and Follow.
6. Wrap Decay Audit and Time Flow in one closed read-only Advanced Diagnostics
   disclosure.
7. Remove the Clear button, renderer method/event wiring, unused renderer DOM,
   and unused human-facing clear copy while preserving backend contracts.
8. Update Chinese and English together.
9. Adjust responsive and dark-mode styling without changing other v0.5.7
   pages.
10. Run automated validation and real Electron visual QA with isolated data.

Prefer extending the existing Phase 4 UI smoke over creating a new test family
unless the existing file becomes materially harder to understand.

## Acceptance Criteria

- A new user can explain the page as “the place to inspect evidence when
  something goes wrong.”
- The first screen contains one quiet status, filters, the log stream, Refresh,
  Follow, and a closed Advanced Diagnostics disclosure.
- The five-value status/count strip is gone.
- No Clear Logs control appears on the Logs page.
- No charts, statistics dashboard, retention controls, or management actions
  are introduced.
- Decay Audit and Time Flow remain available under Advanced Diagnostics and
  retain truthful content.
- Time Flow remains technical and is not presented as Usage Imprint.
- Opening or using the page does not mutate stored runtime events, Gateway
  traces, Memory, Shared Line, or InnerLife state.
- Filtering, Refresh, Follow, Advanced Diagnostics, theme, language, and
  navigation behave correctly.
- The backend clear-logs contract and its Phase 1 test remain intact.
- Existing agent/runtime logging, Gateway traces, snapshots, IPC contracts,
  and diagnostic data remain intact.
- Chinese and English, light and dark themes, populated and empty states, and
  supported responsive widths work without overflow.
- Memory, Shared Line, InnerLife, Home, Agent Access, Settings, and future
  Usage Imprint behavior do not change.

## Validation

Use isolated data roots. Do not touch the daily-use database.

```bash
git diff --check
npm run check
npm run test:phase1
npm run test:phase4
npm run test:shell
npm run test:ux:polish
```

Because the modified files overlap the completed v0.5.7 page work, also rerun
the directly affected renderer baselines if shared shell/i18n/style changes are
non-trivial:

```bash
npm run test:phase2:ui
npm run test:phase3:ui
npm run test:phase5:ui
```

Visual QA must cover:

- Chinese light mode;
- Chinese dark mode;
- English light mode;
- no events / no traces;
- runtime events only;
- Gateway traces only;
- mixed normal and error evidence;
- every filter;
- Follow on and off;
- manual Refresh;
- Advanced Diagnostics closed, opened, and closed again;
- Decay Audit with no issues and with multiple issues;
- Time Flow with Memory, Shared Line, InnerLife, Gateway, and runtime items;
- a narrow responsive window;
- navigation away and back;
- no console errors and no horizontal page overflow.

## Completion Report

At implementation completion, report:

- what changed on the human Logs page;
- whether Clear was removed only from the renderer and which backend clear
  paths remain;
- how the recent-error status is bounded and derived;
- how Advanced Diagnostics behaves;
- the read-only fingerprint result;
- exact automated commands and results;
- real Electron visual QA scenarios and result;
- any validation not run;
- confirmation that Home and Usage Imprint were not changed;
- final git status, with no commit/push claim unless actually performed.
