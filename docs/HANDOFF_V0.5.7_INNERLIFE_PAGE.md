# ClaraCore Desktop v0.5.7 InnerLife Page Handoff

Date: 2026-07-16

Status: implemented and validated on isolated data as the v0.5.7 development
checkpoint.

## Implementation Checkpoint

Completed on 2026-07-16:

- the human page now follows selected profile -> current focus/interests ->
  full unshared thoughts -> verified shared history;
- visible agent options come only from `innerLife.profiles`;
- pending, approved-but-undelivered, and deferred shares remain under
  `尚未分享`;
- `已经分享` requires a `used` action with valid conversational
  `deliveryEvidence`;
- page focus counters, editable profile fields, review/apply/mark actions,
  daemon controls, and the runtime side console were removed from the content
  path;
- raw profile/state, runtime health, history, experiences, summaries, sessions,
  digests, inbox, and timing checks are read-only under a closed Advanced view;
- renderer access to delivery evidence was added without removing or weakening
  the agent-facing repository, runtime, IPC, MCP, or CLI mutation paths;
- the InnerLife UI smoke fingerprints profiles, shares, share actions, share
  checks, and daemon state before and after read interactions and proves they
  are unchanged.

## Continuation Prompt

```text
继续实现 ClaraCore Desktop v0.5.7 的内在活动页面简化。先阅读
docs/HANDOFF_V0.5.7_INNERLIFE_PAGE.md，确认 repo、git 状态，并保护当前
未提交的 0.5.7 版本切换、记忆页和共同线实现。严格遵循 Agent First：智能体
维护 InnerLife，人只观察。人可以完整阅读尚未分享的想法，但任何浏览、筛选、
展开、刷新或详情查看都不得改变 share 状态，也不得被记录为对话中的“已分享”或
“已使用”。主路径只保留智能体、正在关注、尚未分享、已经真实分享；其余内容
默认隐藏且只读。先为“读取不写入”和“真实交付才算已分享”增加测试，再改 UI。
不要改首页或开始使用印记。
```

## Repository And Working Tree Truth

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Published baseline: `v0.5.6` at commit `c062777`
- Current development version: `0.5.7`
- Product version source: `package.json`, read through `core/version.js`
- At implementation start, the working tree intentionally contained the 0.5.7
  version transition plus completed Memory and Shared Line work; the closeout
  preserved that full batch.
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

Before editing shared files, inspect current changes in `index.html`, `app.js`,
`app/dom.js`, `app/views/shared-innerlife.js`, i18n files, responsive styles,
dark-mode styles, and `core/tests/ux-polish-ui-smoke.js`. Preserve Memory and
Shared Line behavior deliberately.

## Confirmed Product Principle

The InnerLife page follows **Agent First**:

> Agents form, time, share, defer, use, and discard their own InnerLife
> material. The human Desktop surface observes it; it does not manage the
> pipeline.

The user explicitly confirmed an important exception to an overly private
model:

> Humans may read the full text of thoughts the agent has not yet chosen to
> share in conversation. Browsing these unshared thoughts is a valuable part
> of the product.

Therefore:

- full unshared thought content is allowed on the human page;
- human reading is observation, not approval, delivery, use, or state change;
- the agent still decides whether and when to proactively share in a
  conversation;
- InnerLife output must not automatically become Memory or Shared Line data.

## Human Purpose Of The Page

The page should answer:

> What is this agent paying attention to, what thoughts have formed but not
> been shared, and what has it actually shared before?

Recommended first-screen explanation:

> 智能体在交流之外持续关注和形成的想法。

English equivalent:

> What agents continue to notice and think about outside the conversation.

Do not describe the page as a review queue, approval center, daemon console,
profile editor, inbox, pipeline, or task list for the human.

## Confirmed Primary Reading Path

The normal page contains only:

1. Agent selection.
2. `正在关注`.
3. `尚未分享` with complete readable thought content.
4. `已经分享` as a lighter history section.
5. Quiet truthful context such as formed time and related Shared Line when the
   stored data actually supports it.

Recommended hierarchy:

- One selected agent owns the page context.
- Current focus/interests appear as a short quiet introduction.
- Unshared thoughts are the main content and may show full text.
- Actually shared thoughts appear below or behind a lighter disclosure.
- Avoid counters, equal-weight dashboard cards, status rails, and a separate
  side console competing with the thoughts.

## Primary Data Mapping

Use current stored truth and do not invent value explanations, source links,
line relationships, moods, or timing reasons.

Suggested mapping:

- Agent list: `innerLife.profiles` is authoritative. Do not reconstruct visible
  agents from stale sessions, shares, history, or imported evidence.
- Current focus: selected profile state `recent_focus`.
- Current interests: selected profile state `current_interests`, rendered only
  when useful and not duplicative.
- Unshared thoughts: selected-agent shares without verified conversational
  delivery. This may include pending/approved/deferred lifecycle states, but
  translate them into quiet human language instead of review terminology.
- Shared history: only shares with real delivery evidence / the validated
  delivered state. Do not equate `approved` with `shared`.
- Content: share `body`.
- Formed/updated time: actual persisted timestamps.
- Reason: show `decision_reason` only when it is user-readable and truly
  explains the item. Share-timing diagnostic reasons belong in Advanced view.
- Related Shared Line: show only when an explicit stored relationship exists.

If no truthful reason or line relationship exists, omit that row. Do not add a
schema change solely to make the first renderer match an idealized card.

## P0 Semantics: Reading Must Never Become Sharing

Opening InnerLife, switching agents, opening a thought, expanding Advanced
view, scrolling, refreshing, changing language/theme, or returning to the page
must not:

- call `reviewInnerLifeShare`;
- call `markProductInnerLifeShare` / `innerlife_mark_share`;
- apply a share to Memory or Shared Line;
- create a delivery-evidence record;
- change pending/approved/deferred/used/discarded/rejected status;
- create or update an InnerLife profile;
- change daemon state or share timing.

Human page views must not appear in agent share history as conversational
delivery. A share counts as `已经分享` only when the existing delivery-evidence
contract proves that it was actually delivered in conversation.

Add a UI smoke that records share rows/actions/delivery evidence before and
after all read interactions and proves byte-for-byte lifecycle equivalence.
Also assert that an approved-but-undelivered share remains under `尚未分享`,
while a delivered/used share appears under `已经分享`.

## Secondary And Hidden Material

Everything outside the primary reading path goes behind one or more closed,
read-only `高级查看` / `Advanced view` disclosures.

Candidates:

- raw history;
- experiences;
- stable summaries;
- sessions;
- digest runs;
- inbox items;
- share timing checks;
- daemon status, next run, last result, recovery, and doctor evidence;
- profile/state JSON and share-policy values;
- source-ingest and pipeline evidence.

Rules:

- Advanced content is closed by default and read-only.
- Expanding it must not mutate state or create missing profiles.
- Lazy-load expensive/paginated evidence only after expansion.
- Keep diagnostic labels inside Advanced view; do not leak them back into the
  thought-reading path.
- Do not repeat the same unshared/shared thought body in multiple sections.

## Remove From The Human InnerLife Page

Remove from the normal and advanced human renderer:

- approve/reject/review controls;
- mark used/deferred/discarded controls;
- apply-to-Memory or apply-to-Shared-Line controls;
- profile save/edit controls and editable JSON;
- daemon enable/pause/tick controls;
- manual digest/process controls;
- any instruction that tells the human to review or process pending shares;
- pending-share, session, digest, inbox, or timing statistic cards/count rails;
- “share queue”, “pending review”, “approved material”, and similar
  management-oriented primary terminology.

Do not delete the underlying agent-facing MCP, CLI, database, repository, IPC,
profile, daemon, share timing, delivery evidence, mark, apply, or source-ingest
capabilities. This is a human renderer simplification, not an InnerLife
contract reduction.

## Runtime And Configuration Boundary

Daemon/model/profile controls do not belong on the InnerLife content page.

For this slice:

- remove them from the content renderer;
- keep runtime health and raw configuration read-only under Advanced view;
- preserve all backend and agent control paths;
- do not silently move controls into Settings unless the user separately
  approves that Settings-surface decision.

If human runtime control is needed later, design it as a Settings concern, not
as an action beside an agent's thoughts.

## Current Implementation Surfaces

Primary renderer paths:

- `index.html`: current daemon/pending status strip, share queue, context bar,
  history/experiences/summaries, editable profile, runtime side panel, and
  pipeline evidence.
- `app/dom.js`: InnerLife DOM registry.
- `app/views/shared-innerlife.js`: selected profile rendering, broad agent-id
  aggregation, daemon/doctor/session/digest/inbox/timing rendering, context
  bar, pending/approved share grouping, and adjacent Shared Line rendering.
  Keep InnerLife changes scoped; do not regress Shared Line.
- `app/innerlife-actions.js`: editable profile, daemon toggle, paginated
  evidence loads, and event wiring.
- `app.js`: state, page focus/status metrics, runtime refresh, and action
  integration.
- `app/i18n/zh.js` and `app/i18n/en.js`: old queue/review/runtime/profile copy
  and user-facing labels.

Primary styles:

- `styles/views/innerlife-layout.css`
- `styles/views/innerlife-profile.css`
- `styles/views/responsive.css`
- `styles/dark-fixes.css`

Backend and agent boundaries to preserve:

- `core/db/repositories/innerlife/`
- `core/innerlife/`
- `core/runtime/index.js`
- `electron/preload.js`
- `electron/ipc-handlers.js`
- InnerLife definitions/handlers under `core/gateway/`

Primary tests:

- `core/tests/phase5-innerlife-ui-smoke.js`
- `core/tests/phase5-innerlife-scheduler-ui-smoke.js`
- `core/tests/phase5-innerlife-smoke.js`
- `core/tests/innerlife-source-ingest-smoke.js`
- `core/tests/shell-window-smoke.js`
- `core/tests/ux-polish-ui-smoke.js`

## Implementation Sequence

1. Protect and rerun the completed Memory and Shared Line baselines.
2. Add read-does-not-write coverage across page load, agent selection, thought
   expansion, Advanced view, refresh, theme, and language changes.
3. Add delivered-vs-undelivered fixtures and prove `approved` is not rendered
   as `已经分享` without delivery evidence.
4. Source visible agents from profiles and remove stale collection-derived
   identities from the primary selector.
5. Replace the current status/queue/side-console layout with agent, current
   focus, unshared thoughts, and shared history.
6. Move secondary evidence into closed read-only Advanced view disclosures.
7. Remove human mutation controls, editable profile UI, daemon controls,
   counters, and management-oriented copy from the content page.
8. Update Chinese and English together.
9. Preserve backend mutation coverage in domain/MCP/CLI smokes rather than
   deleting capability tests with the renderer controls.
10. Perform real visual QA against isolated populated data.

## Acceptance Criteria

- A new user can explain InnerLife after reading the first screen.
- The primary page is selected agent -> current focus -> unshared thoughts ->
  actually shared history.
- Humans can read the full body of an unshared thought.
- Reading never changes share/profile/daemon/delivery state.
- Undelivered approved/deferred/pending material remains `尚未分享`.
- `已经分享` requires real conversational delivery evidence.
- No page copy frames unshared thoughts as a human review or work queue.
- No visible human control approves, rejects, marks, applies, edits profiles,
  or controls the daemon.
- All non-primary evidence is hidden and read-only by default.
- Visible agents come from current profiles; deleted/stale agent ids do not
  return through history or share aggregation.
- Existing agent-facing InnerLife/MCP/CLI behavior remains intact.
- The page works in Chinese and English, light and dark themes, populated and
  empty states, and supported responsive widths.
- Memory, Shared Line, Home, Agent Access, Logs, Settings, and Usage Imprint do
  not change except for unavoidable shared-shell compatibility.

## Validation

Use isolated data roots; do not touch the daily-use database:

```bash
git diff --check
npm run check
npm run test:phase2
npm run test:phase3
npm run test:phase5
npm run test:shell
npm run test:ux:polish
```

Visual QA must cover:

- Chinese light mode;
- Chinese dark mode;
- English light mode;
- no profile / empty state;
- one agent with current focus but no thoughts;
- one agent with pending, approved-undelivered, deferred, and delivered shares;
- two profiles with clearly different thoughts to detect agent leakage;
- long thought content;
- narrow responsive window;
- Advanced view closed/opened/closed;
- runtime refresh while an unshared thought remains open.

## Completion Report

At implementation completion, report:

- what changed on the human InnerLife page;
- how read-does-not-write was proven;
- how delivered-vs-undelivered classification was proven;
- which agent-facing capabilities were deliberately preserved;
- exact automated validation results;
- visual QA evidence and any untested state;
- any deferred Settings/control decision;
- git status and whether anything was committed or pushed.
