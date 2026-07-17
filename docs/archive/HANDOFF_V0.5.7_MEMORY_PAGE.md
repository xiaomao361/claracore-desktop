# ClaraCore Desktop v0.5.7 Memory Page Handoff

Date: 2026-07-16

Status: renderer implementation and isolated validation complete as the v0.5.7
development checkpoint.

## Implementation Checkpoint

Completed on 2026-07-16:

- replaced the human Memory page with the read-only path `search -> select -> read detail`;
- removed Memory statistics, vector maintenance, archive, restricted, deleted,
  embedding-status, score, and mutation controls from the human renderer;
- kept agent filtering, paging, empty states, keyboard selection, and truthful
  agent/time/label evidence;
- moved Labels and Graph behind one closed `高级查看` / `Advanced view`
  disclosure and kept graph loading lazy;
- removed the generic page-focus health/count strip from Memory so the first
  explanation matches the Agent First purpose;
- preserved all backend, Gateway MCP, CLI, graph, archive, restricted-memory,
  embedding, and maintenance capabilities.

Verified with:

```text
git diff --check
npm run check
npm run test:phase2
npm run test:memoria:cli
npm run test:memoria:links
npm run test:shell
npm run test:ux:polish
```

Visual QA used temporary data roots and covered Chinese light, Chinese dark,
English light, and a 760 px narrow window. The advanced Graph path was also
opened, closed, reopened, and verified after app restart.

## Continuation Prompt

```text
继续实现 ClaraCore Desktop v0.5.7 的记忆页简化。先阅读
docs/HANDOFF_V0.5.7_MEMORY_PAGE.md，确认 repo、git 状态和当前 0.5.7
版本切换改动。严格遵循 Agent First：智能体负责写入、整理和维护，人只在
Desktop 中搜索、阅读和核验。只改人类可见的 renderer，不削弱 MCP/CLI 或
后端 Memoria 能力。完成一个小闭环后运行 handoff 里的验证，并展示真实页面。
不要实现首页，也不要开始“使用印记”。
```

## Repository And Version Truth

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Published baseline: `v0.5.6` at commit `c062777`
- Current development version: `0.5.7`
- Product version source: `package.json`, read through `core/version.js`
- At handoff time the working tree contains the uncommitted 0.5.7 version
  transition in:
  - `package.json`
  - `package-lock.json`
  - `README.md`
  - `docs/VERSION_BRANCHING.md`
  - `docs/UI_UX_POLISH_BACKLOG.md`
- Preserve those changes. Do not revert, bulk-stage, commit, or push unless the
  user explicitly asks.

Start with:

```bash
pwd
git rev-parse --show-toplevel
git remote -v
git status --short
git diff -- package.json package-lock.json README.md \
  docs/VERSION_BRANCHING.md docs/UI_UX_POLISH_BACKLOG.md
```

## Confirmed Product Principle

The Memory page follows **Agent First**:

> Agents create, update, organize, and maintain Memory. The human Desktop
> surface is for reading and verification, not direct data management.

Consequences:

- Do not expose create, edit, delete, restore, archive, label-management,
  vector-generation, or maintenance actions on the normal human page.
- Do not require a new user to understand embeddings, maintenance queues,
  database paths, restricted/deleted storage, or backend lifecycle concepts.
- Keep source, time, owning agent, and other truthful evidence needed for a
  human to understand a memory.
- Do not remove or weaken agent-facing MCP, CLI, repository, database, graph,
  label, archive, restricted-memory, embedding, or maintenance capabilities.
  This slice changes the human renderer, not the Memoria product contract.

## Human Purpose Of The Page

The page should answer one question:

> What has the agent decided to remember for the long term?

The first screen should immediately explain:

> 智能体长期保留的事实、决定和偏好，不是完整聊天记录。

English equivalent:

> Facts, decisions, and preferences agents kept for the long term, not a full
> chat history.

## Confirmed Normal Reading Path

The default page contains only:

1. A short explanation of what Memory is.
2. One search field.
3. An agent filter.
4. A recent/search-result memory list.
5. A selected memory's read-only detail.

Recommended desktop layout:

- Search and agent filter across the top.
- Memory list in the left column.
- Selected read-only detail in the right column.
- Responsive layout may stack list above detail at narrower widths.

The detail can show only fields supported by current data, such as:

- content;
- source or provenance when actually present;
- owning/recording agent when derivable from current data;
- created or updated time;
- labels or related progress as quiet supporting evidence;
- a retention reason only when the stored record truly contains one.

Do not synthesize a source, reason, relationship, or agent identity that the
runtime did not provide. This slice should not add a new database schema just
to match the concept image.

## Advanced Read-Only Material

Labels and graph remain useful but must not compete with the normal reading
path.

- Place them behind one closed `高级查看` / `Advanced view` disclosure or an
  equivalently secondary entry on the Memory page.
- Keep both surfaces read-only.
- Keep graph data lazy-loaded when the advanced surface is opened.
- Label browsing may filter or navigate to memories, but it must not create,
  rename, merge, or delete labels.
- Graph interaction may pan, zoom, select, and inspect relationships, but it
  must not mutate data.

The exact long-term location of advanced material is not settled. For this
slice, a closed disclosure on the Memory page is the smallest reversible
choice.

## Remove From The Human Memory Page

Remove from the visible/default renderer:

- active/deleted/embedded/pending/restricted/archived statistic cards;
- vector maintenance disclosure and progress UI;
- archive/restricted/deleted management sections;
- delete and restore buttons on memory cards;
- inline embedding status/model/error details;
- search implementation labels and numeric match scores unless a later design
  establishes a clear human need;
- labels and graph as first-level tabs.

Do not replace these with a different statistics strip.

## Deferred Idea: Usage Imprint

The user wants to revisit a separate `使用印记` concept later. It may express
what the user and Clara experienced or built together, possibly through a
timeline and a few meaningful signals.

For this Memory slice:

- preserve the idea only as a deferred note;
- do not build a statistics page;
- do not move Memory counts into Home, Settings, or a new navigation item;
- do not introduce productivity scores, streaks, rankings, or gamification.

Home will be discussed last after the supporting pages have clear purposes.

## Concept Reference

The discussion mockup is available locally at:

`/Users/zhouwei/.codex/visualizations/2026/07/16/019f69ec-cee4-7921-b8ab-ad95e39d2a66/memory-agent-first-v057.png`

Use it for information hierarchy, not as a pixel-perfect visual specification.
The existing ClaraCore design system, dark mode, responsive behavior, and
accessibility remain authoritative.

## Current Implementation Surfaces

Primary renderer paths:

- `index.html`: current two-panel Memory markup, statistics, maintenance,
  first-level tabs, archive/restricted/deleted lists.
- `app/dom.js`: Memory element registry.
- `app/views/memoria-list.js`: memory cards, inline labels, embedding status,
  and delete/restore actions.
- `app/views/memoria.js`: search, paging, filters, tabs, maintenance, labels,
  graph rendering, archive/restricted/deleted loading, and UI events.
- `app/memoria-actions.js`: renderer actions that currently invoke human-facing
  mutations or maintenance.
- `app/i18n/zh.js` and `app/i18n/en.js`: page copy and accessibility labels.

Primary styles:

- `styles/views/memoria-layout.css`
- `styles/views/memoria-detail-results.css`
- `styles/views/memoria-detail-graph.css`
- `styles/views/memoria-detail-base.css`
- `styles/views/memoria-detail-labels.css`
- `styles/views/responsive.css`
- `styles/dark-fixes.css`

Primary tests:

- `core/tests/phase2-memory-ui-smoke.js`
- `core/tests/phase2-memory-smoke.js`
- `core/tests/memory-cli-smoke.js`
- `core/tests/memory-links-smoke.js`
- `core/tests/shell-window-smoke.js`
- `core/tests/ux-polish-ui-smoke.js`

## Implementation Guidance

1. First make the default Memory renderer read-only. Ensure normal memory cards
   render with no action argument; do not leave delete as the implicit default.
2. Add explicit selected-memory state and a read-only detail renderer. Preserve
   keyboard access and a clear selected state.
3. Replace first-level tabs with the default list/detail path plus one closed
   advanced disclosure for Labels and Graph.
4. Remove obsolete Memory statistics, maintenance, archive, restricted, and
   deleted DOM bindings only after tracing their renderer references.
5. Keep all backend calls and domain capabilities required by agents. If UI
   smoke tests currently provide the only coverage for an agent capability,
   move or preserve that coverage in a backend/MCP/CLI smoke rather than
   deleting the capability test.
6. Update both Chinese and English copy. Do not leave the English page on the
   old information architecture.
7. Check light mode, dark mode, empty state, populated state, search results,
   agent filtering, narrow width, and advanced graph reopening.

## Acceptance Criteria

- A new user can state what Memory is after reading the first screen.
- The normal page path is `search -> choose memory -> read detail`.
- No visible control on the normal page creates, edits, deletes, restores,
  archives, labels, embeds, or maintains Memory data.
- No statistics cards or technical embedding status appear.
- Labels and Graph are hidden by default under one clearly secondary read-only
  entry.
- Graph still works after opening, closing, and reopening the advanced surface.
- Search, agent filtering, paging, empty state, and selection remain usable.
- Agent-facing Memoria MCP/CLI behavior and backend tests remain intact.
- The page works in Chinese and English, light and dark themes, and at supported
  responsive widths.
- Home, Shared Line, InnerLife, Agent Access, Logs, Settings, and Usage Imprint
  remain outside this slice.

## Validation

Use isolated UI roots; do not touch the daily-use database:

```bash
git diff --check
npm run check
npm run test:phase2
npm run test:memoria:cli
npm run test:memoria:links
npm run test:shell
npm run test:ux:polish
```

Also perform visual QA with populated and empty temporary data in:

- Chinese light mode;
- Chinese dark mode;
- English light mode;
- a narrow responsive window;
- advanced Labels/Graph closed, opened, closed, and reopened.

## Completion Report

At handoff completion, report:

- what human-facing Memory surfaces changed;
- which agent-facing capabilities were deliberately preserved;
- exact automated validation results;
- visual QA evidence and any untested state;
- remaining risks;
- git status and whether anything was committed or pushed.
