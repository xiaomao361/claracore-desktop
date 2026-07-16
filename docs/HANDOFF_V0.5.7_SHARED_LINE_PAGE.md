# ClaraCore Desktop v0.5.7 Shared Line Page Handoff

Date: 2026-07-16

Status: implemented and validated as the v0.5.7 development checkpoint.

## Implementation Result

- The human page is now line-first and read-only: active lines on the left,
  selected-line `过去 -> 现在 -> 下一步` on the right, followed by `共同认识`
  and truthful `仍需确认` material.
- Renderer selection uses a dedicated selected-line packet. Runtime refreshes
  re-fetch and preserve that packet while the line still exists; selecting a
  line never activates it for agents.
- Resume Packet text/copy, archive actions, statistics, management tabs, and
  mutation controls are absent from the human Shared Line page.
- Older history, snapshots, metadata, and agent evidence sit behind a closed
  read-only advanced disclosure. Archived lines sit behind a separate closed
  read-only disclosure.
- Continuity database, IPC, MCP, CLI, Gateway, archive/restore, activate,
  resume-packet, history, and snapshot capabilities were deliberately left
  unchanged.
- The two-line UI smoke uses deliberately different Past/Now/Next,
  participants, shared understanding, uncertainty, and history values to catch
  cross-line leakage. It also proves selection does not activate a line and a
  runtime refresh preserves human selection.
- The full validation list in this document passed on 2026-07-16. Native
  Electron visual QA covered Chinese light/dark, English light, empty/sparse,
  two-line selection, advanced open/closed, archived open, and a 760 px narrow
  window with no console errors or horizontal overflow.

## Continuation Prompt

```text
继续实现 ClaraCore Desktop v0.5.7 的共同线页面简化。先阅读
docs/HANDOFF_V0.5.7_SHARED_LINE_PAGE.md，确认 repo、git 状态，并保护当前
未提交的 0.5.7 版本切换与记忆页实现。严格遵循 Agent First：智能体创建、
更新和维护共同线，人只查看与核验。页面必须线优先，不是智能体状态页，也不是
项目管理器。先修正“选中线与右侧数据必须一致”的 P0，再实现过去 -> 现在 ->
下一步的连续轨迹。移除人类界面的接续包与复制功能；本轮不提供归档/结束操作，
但保留所有 agent-facing Continuity/MCP/CLI 能力。完成后运行 handoff 中的验证，
并展示真实页面的视觉 QA。不要改首页或开始使用印记。
```

## Repository And Working Tree Truth

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Published baseline: `v0.5.6` at commit `c062777`
- Current development version: `0.5.7`
- Product version source: `package.json`, read through `core/version.js`
- At implementation start, the working tree intentionally contained the 0.5.7
  version transition and completed Memory work; the closeout preserved that
  full batch.
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

Before editing Shared Line files, inspect overlapping Memory changes in
`index.html`, `app.js`, `app/dom.js`, i18n files, responsive styles, dark-mode
styles, and `core/tests/ux-polish-ui-smoke.js`. Preserve them deliberately.

## Confirmed Product Principle

The Shared Line page follows **Agent First**:

> Agents create, update, organize, and maintain Shared Lines. The human
> Desktop surface reads and verifies continuity; it does not manage the
> Continuity data model.

The page is **line-first**, not agent-first in information architecture:

> A Shared Line is a long-lived thing the user and agents continue together.
> An agent may participate in a line, but the line does not belong to one
> agent and should survive agent changes.

This does not contradict Agent First. Agent First defines who maintains the
data; line-first defines what the human page is organized around.

## Human Purpose Of The Page

The page should answer:

> What are we continuing, where have we reached, and what comes next?

Recommended first-screen explanation:

> 记录我们共同推进的事情，让智能体下次继续，而不是重新开始。

English equivalent:

> The things we continue together, so agents can resume next time instead of
> starting over.

Do not describe the page as a task manager, project board, agent-status
console, storage browser, or resume-packet viewer.

## Confirmed Primary Reading Path

The normal page contains only:

1. A list of active Shared Lines.
2. One selected line.
3. A continuity path: `过去 -> 现在 -> 下一步`.
4. `共同认识`.
5. `仍需确认` when truthful unresolved material exists.
6. Quiet supporting evidence: participants and last update time.

Recommended desktop layout:

- Active line list in the left column.
- Selected-line continuity detail in the right column.
- Responsive layout stacks list above detail.
- Use a visible but restrained thread/spine connecting Past, Now, and Next so
  continuity is perceived before the user reads every field.
- Avoid a dashboard grid, Kanban board, progress percentage, checkbox list, or
  a collection of equal-weight status cards.

## Primary Data Mapping

Use only values actually returned for the selected line. Do not synthesize
milestones, conclusions, participants, uncertainty, or status.

Suggested mapping, subject to current packet truth:

- Line title: selected line title.
- Past: the latest relevant earlier line-history item(s), not global history
  from another line.
- Now: selected line `currentPosition.summary`, `stateSummary`, or current
  interpretation, without duplicating the same text in multiple sections.
- Next: selected line `nextStep` when present.
- Shared understanding: `confirmedGround`, `realityLine`, or other confirmed
  shared-reality fields.
- Still to confirm: `provisionalRead`, `misreadRisks`, review-needed status, or
  explicitly unresolved boundary notes.
- Participants: agent identity from the selected line/packet, shown as quiet
  context rather than ownership.
- Updated time: selected line's actual update time.

When fields are absent, collapse the empty section or show one quiet human
sentence. Do not expose raw field names as a substitute for design.

## P0 Correctness: Selected Line Owns Its Detail

The current renderer mixes `selectedLine` values with global
`sharedLine.currentPosition`, metadata, history, and snapshots. That can make
the left list select line A while the right detail displays current data from
active line B.

The implementation must establish one selected-line view model sourced from
the `desktop.getSharedLine({ lineId })` result and render every primary and
advanced detail from that same scoped packet.

Acceptance requirements:

- Selecting a non-active line changes only the human view; it must not activate
  the line for agents.
- Title, Past, Now, Next, shared understanding, uncertainty, participants,
  history, snapshots, and timestamps all belong to the selected line.
- Runtime refresh must preserve the human selection when that line still
  exists.
- If the selected line disappears or becomes unavailable, fall back
  deterministically and visibly rather than silently mixing packets.
- Add a UI smoke with two lines containing deliberately different summaries,
  next steps, participants, and history so cross-line leakage is detectable.

## Secondary And Hidden Material

Everything that is not part of the primary reading path must sit behind a
closed, read-only `高级查看` / `Advanced view` disclosure or another clearly
secondary disclosure.

Candidates for hidden read-only inspection:

- older detailed line history;
- snapshots and compressed records;
- position history and affective trace;
- mode, visibility, interpretation status, and raw metadata;
- boundary notes that are diagnostic rather than useful in `仍需确认`;
- agent state and model-adjustment information;
- optional filtering by participating agent.

Rules:

- The disclosure is closed by default.
- Opening it must not mutate or activate a line.
- Prefer lazy loading/rendering for expensive or rarely used evidence.
- Preserve keyboard access, disclosure state correctness, dark mode, and
  responsive behavior.
- Do not let advanced content repeat the primary sections verbatim.

## Remove From The Human Shared Line Page

Remove entirely from the human renderer, not merely hide:

- raw Resume Packet / 接续包 text;
- `复制接续包` and its notice/copy wiring;
- archive buttons and archive confirmation UI;
- create, rename, activate, restore, save-position, or other mutation controls;
- statistics for line/history/snapshot/archive counts;
- internal field names on the primary path;
- technical `selected`, `active`, `confirmed`, `mode`, and `visibility` chips
  when they do not help the human reading path.

Do not remove the underlying MCP, CLI, database, repository, IPC, archive,
restore, activate, snapshot, history, or resume-packet capabilities used by
agents and tests. This is a renderer simplification, not a Continuity contract
reduction.

## Deferred Archive Decision

The user has not decided whether a human should be allowed to archive a line.

For this slice:

- show a closed/read-only `查看已经走过的线` section;
- do not expose archive or restore actions;
- do not delete backend archive/restore capabilities;
- do not settle the future wording or interaction.

If human intervention is approved later, reconsider it as `结束这条线` with a
clear semantic definition and recovery path. Do not reintroduce a technical
`归档` button into the primary line card without a separate product decision.

## Concept Reference

The confirmed discussion mockup is available locally at:

`/Users/zhouwei/.codex/visualizations/2026/07/16/019f69ec-cee4-7921-b8ab-ad95e39d2a66/shared-line-continuity-v057.png`

Use it for information hierarchy and the continuity feeling, not as a
pixel-perfect visual specification. Existing ClaraCore typography, theme,
responsive, and accessibility patterns remain authoritative.

## Current Implementation Surfaces

Primary renderer paths:

- `index.html`: current Shared Line tabs, agent filter, agent-state panel,
  history/snapshots/archive lists, detail metadata, Resume Packet, and copy
  action.
- `app/dom.js`: Shared Line DOM registry.
- `app/views/shared-innerlife.js`: line cards, selected-line context, global
  current-position mixing, metadata, agent state, history, snapshots, archive,
  and InnerLife rendering. Keep Shared Line edits scoped; do not regress the
  adjacent InnerLife renderer.
- `app/shared-line-actions.js`: tabs, agent filtering, selected-line fetch,
  archive action, and Resume Packet copy action.
- `app.js`: shared state, runtime snapshot updates, page focus/status metrics,
  and action wiring.
- `app/i18n/zh.js` and `app/i18n/en.js`: user copy, field labels, statuses, and
  old management/resume terminology.

Primary styles:

- `styles/views/shared-line.css`
- `styles/views/responsive.css`
- `styles/dark-fixes.css`

Agent/backend boundaries to preserve:

- `electron/preload.js`
- `electron/ipc-handlers.js`
- `core/continuity/index.js`
- `core/db/repositories/continuity.js`
- Shared Line tool definitions and handlers under `core/gateway/`

Primary tests:

- `core/tests/phase3-shared-line-ui-smoke.js`
- `core/tests/phase3-shared-line-smoke.js`
- `core/tests/phase3-gateway-smoke.js`
- `core/tests/shell-window-smoke.js`
- `core/tests/ux-polish-ui-smoke.js`
- `core/tests/backup-restore-smoke.js`
- `core/tests/import-preview-smoke.js`

## Implementation Sequence

1. Protect and rerun the completed Memory baseline before Shared Line changes.
2. Build a selected-line-scoped view model and add a two-line leakage smoke.
3. Replace the current primary markup with the active line list and
   Past/Now/Next continuity detail.
4. Map confirmed and unresolved data into `共同认识` and `仍需确认` without
   duplicating or inventing content.
5. Move secondary read-only evidence under a closed advanced disclosure.
6. Move archived lines to a closed read-only `查看已经走过的线` disclosure.
7. Remove Resume Packet, copy wiring, archive actions, statistics, and
   management-oriented primary copy from the human renderer.
8. Update Chinese and English together.
9. Update UI smokes so removed human actions are asserted absent while backend
   archive/resume/activate behavior remains covered by domain/Gateway tests.
10. Perform real visual QA against isolated populated data.

## Acceptance Criteria

- A new user can explain Shared Line after reading the first screen.
- The page is visibly organized around long-lived lines, not agents.
- The primary path is `select line -> Past -> Now -> Next -> shared
  understanding -> unresolved material`.
- Selecting line A never shows line B data and never activates line A.
- No primary or advanced human control creates, edits, activates, archives,
  restores, or otherwise mutates a Shared Line.
- Resume Packet text and copy functionality are absent from the human page.
- Archive/restore remain available to agents but absent from the human page.
- `查看已经走过的线` is closed and read-only by default.
- All non-primary evidence is hidden by default and remains read-only.
- Sparse lines degrade gracefully without fake content or raw field dumps.
- Existing agent-facing Continuity/MCP/CLI behavior remains intact.
- The page works in Chinese and English, light and dark themes, populated and
  empty states, and supported responsive widths.
- Memory, Home, InnerLife, Agent Access, Logs, Settings, and Usage Imprint do
  not change except for unavoidable shared-shell compatibility.

## Validation

Use isolated data roots; do not touch the daily-use database:

```bash
git diff --check
npm run check
npm run test:phase2
npm run test:phase3
npm run test:shell
npm run test:ux:polish
npm run test:backup
npm run test:import-preview
```

Visual QA must cover:

- Chinese light mode;
- Chinese dark mode;
- English light mode;
- empty state;
- one sparse active line;
- two active lines with intentionally different selected-line content;
- a narrow responsive window;
- advanced disclosure closed/opened/closed;
- `查看已经走过的线` closed/opened;
- runtime refresh while a non-active line remains selected.

## Completion Report

At implementation completion, report:

- what changed on the human Shared Line page;
- how selected-line scoping was proven;
- which agent-facing capabilities were deliberately preserved;
- exact automated validation results;
- visual QA evidence and any untested state;
- remaining archive-decision risk;
- git status and whether anything was committed or pushed.
