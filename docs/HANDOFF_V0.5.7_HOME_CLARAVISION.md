# ClaraCore Desktop v0.5.7 Home / ClaraVision Handoff

Date: 2026-07-16

Status: implemented and validated as the v0.5.7 development checkpoint on
2026-07-16. This document records both the implementation contract and its
measured result.

## Implementation Result

Home is now a presence surface built from the existing Desktop snapshot:

- `app/views/home-presence.js` maps recent Gateway traces, the current Shared
  Line, eligible InnerLife material, and one actionable issue into a bounded
  display model;
- `app/views/home-vision.js` owns the Canvas scene and explicit lifecycle;
- the foreground renders at most three recently observed Agents, uses stable
  hash-to-palette colors, and never treats configured-only Agents as present;
- the scene uses 96 deterministic particles, a 0.9 megapixel Canvas cap,
  12 FPS quiet cadence, 30 FPS active cap, and zero continuous frames when
  Home is inactive, the document is hidden, or reduced motion is enabled;
- the old Home period selectors, statistics, module cards, runtime board,
  Agent cards, and permanent onboarding checklist are absent from the DOM;
- Agent names are read-only hover/focus/arrival details rather than permanent
  labels.

Measured on the current development Mac in a real Electron window at
1440x900, device pixel ratio 2, after 30-second samples:

- static reduced-motion baseline: 0 FPS, 0.10% average total app CPU,
  136.37 MB renderer working set;
- quiet breathing: 11.8 FPS, 0.76% average total app CPU, 135.93 MB renderer
  working set;
- measured CPU delta: 0.66 percentage points;
- measured renderer working-set delta: -0.44 MB;
- away from Home for 10 seconds: 0 rendered frames and no scheduled Home
  timer or animation frame.

Validated with `npm run check`, `npm run test:home`,
`npm run test:home:performance`, `npm run test:shell`,
`npm run test:onboarding`, `npm run test:ux:polish`,
`npm run test:agent-access`, `npm run test:phase3:ui`,
`npm run test:phase4:trace-ui`, `npm run test:phase5:ui`, and
`git diff --check`. Visual QA covered light/wide and dark/narrow Electron
screenshots. The in-app browser was not used because this surface is a native
Electron BrowserWindow rather than a URL-hosted page; Playwright's Electron
driver was the compatible renderer inspection path.

## Continuation Prompt

```text
继续实现 ClaraCore Desktop v0.5.7 首页。先阅读
docs/HANDOFF_V0.5.7_HOME_CLARAVISION.md，确认 repo、git 状态，并保护当前未提交
的记忆、共同线、内在活动、日志、智能体接入和设置页实现。首页采用 ClaraVision
的“脑核”作为主要视觉表达，但只移植轻量渲染思想，不复制 ClaraVision 的独立
Electron、对话、Hermes、数据读取、节点管理或完整交互。脑核代表 ClaraCore 中
的共同意识空间；多 Agent 使用“外圈存在光点 + 彩色信号进入脑核”的 2+3 组合
表达。保留缓慢呼吸、平滑变色和活动光流，所有视觉必须来自可验证的最近活动，
不能把已配置 Agent 伪装成在线。删除首页统计和 dashboard 结构，不开始使用印记。
性能是 P0：隐藏或离开首页必须停止动画，空闲 10-12 FPS、活跃最多 30 FPS，限制
粒子和像素预算，支持减少动态效果和静态降级，并完成真实 Electron 性能与视觉 QA。
不要修改 /Users/zhouwei/Documents/ClaraCore/apps/claravision 原仓库。
```

## Repository And Working Tree Truth

- Target repository:
  `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Published baseline: `v0.5.6` at commit `c062777`
- Current development version: `0.5.7`
- At implementation start, the working tree intentionally contained the
  completed v0.5.7 Memory, Shared Line, InnerLife, Logs, Agent Access, and
  Settings page work; the closeout preserved that full batch.
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

Read the nearest `AGENTS.md`, then inspect the current versions and diffs of at
least:

- `index.html`
- `app.js`
- `app/dom.js`
- `app/views/home.js`
- `app/views/home-trace.js`
- `app/i18n/zh.js`
- `app/i18n/en.js`
- `styles/dark-fixes.css`
- `styles/views/responsive.css`
- `core/tests/onboarding-ui-smoke.js`
- `core/tests/ux-polish-ui-smoke.js`
- `core/tests/phase4-gateway-trace-ui-smoke.js`

## Confirmed Product Decisions

### Home is a presence surface, not a dashboard

The Home page should make the human feel:

> ClaraCore is still here. The shared world and the agents' recent presence
> continue to exist.

It should not summarize the product as counts, cards, maintenance metrics,
module inventory, a task board, or an Agent administration console.

The future `使用印记` / Usage Imprint surface will own historical statistics
and usage patterns. Do not implement or preview that surface in this round.

### Agent First still governs Home

Agents operate and maintain Memory, Shared Lines, InnerLife, and their normal
runtime state. The human Home surface observes and verifies. It does not ask
the human to organize agents, manage lines, acknowledge thoughts, tune runtime
behavior, or maintain data.

Exceptional actionable failures may be disclosed quietly and truthfully, but
Home must not become the replacement Settings or Logs page.

### The brain core represents the shared consciousness space

The central brain core does **not** represent Clara, Codex, Hermes, or any
single Agent. It represents:

> The shared consciousness space inside ClaraCore at this moment.

There is always one core. Adding Agents must not create multiple equal-sized
cores, a topology diagram, an avatar roster, or a collection of Agent cards.

### Multi-Agent expression uses option 2 + option 3

Combine:

1. A small presence light on the outer orbit for each recently observed Agent.
2. A colored signal flowing from an active/recent Agent into the shared core.

The core keeps a neutral base color and slowly blends toward the signature
color of the most recently influential Agent. Other recent Agents remain
visible as restrained outer lights and secondary flows. Never turn the core
into a rainbow or split it into one region per Agent.

## First-Screen Composition

The living core is the visual subject. Text exists to make the visual truthful
and understandable, not to recreate a dashboard beside it.

Recommended information hierarchy:

```text
首页

                         [ shared living brain core ]
                    · Codex presence       · Clara presence
                         colored flows enter the core

此刻
最近有智能体在整理首页的设计方向

我们现在
让首页成为共同意识空间的视觉表达

心里正在形成                         (only when truthful content exists)
ClaraVision 只保留脑核、呼吸和变色
```

This is a hierarchy reference, not a pixel-perfect layout. Prefer a large,
calm field with one compact text layer. On wide windows the text may sit beside
or partially overlay the field. On narrow windows it may stack below the core.

Normal Home must not show:

- yesterday/today/7-day/30-day activity selectors;
- memory, connection, share, Shared Line, or tool-call counts;
- one equal-weight card per Agent;
- module cards or Runtime Overview;
- Gateway trace tables;
- database/vector/daemon maintenance summaries;
- tags, graphs, or data statistics;
- a permanent onboarding checklist.

The underlying pages and backend capabilities remain unchanged.

## Truthful Presence Semantics

The phrase `Agent entered` must be based on observed activity, not registration
or saved configuration. MCP/HTTP access does not necessarily provide a durable
online session, so Home must not claim that an Agent is online merely because
it exists in configuration or appeared historically.

Use this truth hierarchy:

| Observable truth | Visual treatment | Allowed wording |
| --- | --- | --- |
| New trace/event observed since the previous Home snapshot | short arrival ripple; outer light appears | `刚刚活动` / `Active just now` |
| In-flight operation explicitly available from runtime truth | bright presence, inward flow, slightly faster breath | `正在活动` / `Active` |
| Recent completed activity | restrained outer light that slowly fades | `最近来过` / `Recently present` |
| Configured but no recent observed activity | do not render as a presence | no online/present claim |
| Old activity outside the presence window | remove from foreground | no current claim |
| Error trace | short restrained warning pulse plus explicit text when actionable | never rely on red color alone |

Do not infer a current in-flight operation from one old completed Gateway
trace. If the runtime has no explicit in-flight truth, use `最近活动` rather
than `正在工作`.

Suggested initial display windows, adjustable only after real testing:

- arrival animation: once when a newly observed trace enters the snapshot;
- bright recent presence: up to 90 seconds after an observed activity;
- dim recent presence: up to 15 minutes;
- older than 15 minutes: absent from the foreground Home visualization.

Foreground Agent lights are capped at the three most recently observed Agents.
Additional recent Agents may form a very faint, bounded far-field constellation
without names or counts. Never let Agent cardinality determine particle count.

## Visual Language

Each visual channel has one job:

- **Agent color**: identity of the Agent influencing the shared space.
- **Breath speed/depth**: current overall activity intensity.
- **Brightness**: recency/strength of observed activity.
- **Flow direction**: activity entering or leaving the shared space.
- **Outer presence light**: which Agent was recently observed.
- **Explicit text**: errors, uncertainty, and meaning that color cannot carry.

### Stable Agent colors

Known Agents may have reserved colors, but arbitrary Agent IDs must receive a
stable deterministic color from a restrained palette. The same ID must retain
the same color across restarts. Do not store a new preference solely for this;
a stable hash-to-palette mapping is sufficient unless the current code already
owns a better identity-color contract.

Use a calm palette with enough contrast in light and dark themes. Avoid neon
rainbow distribution. The shared core's base should remain neutral ice-white or
soft blue, then interpolate slowly toward the most influential recent Agent.

### Motion states

- Empty/quiet: one slow neutral breath; no fake Agent lights.
- Arrival: one Agent light enters the outer orbit with a single soft ripple.
- Recent activity: the light orbits very slowly; one low-energy flow reaches
  the core.
- Active operation: brighter flow and modestly faster breathing; do not shake
  or flash the whole page.
- Multi-Agent activity: two or three differently colored flows may braid or
  converge before entering the core. The core uses one dominant blended tint.
- Completion: one soft outward pulse, then return toward the quiet state.
- Error: one restrained warning event and readable text; no endless red pulse.

Agent names should not remain permanently visible. They may appear briefly on
arrival and in a read-only hover/focus tooltip. The tooltip may show only name,
truthful recent state, and relative activity time. It must not contain Agent
management controls.

## Small Home View Model

Do not pass the entire product snapshot or all Memory records into the renderer.
Build one bounded display model from data already present in the Desktop
snapshot. A possible contract is:

```js
{
  core: {
    state: "quiet" | "recent" | "active" | "error",
    currentLineTitle: "...",
    currentSummary: "...",
    emergingThought: "..."
  },
  agents: [
    {
      id: "codex",
      label: "Codex",
      color: "#...",
      presence: "active" | "recent" | "fading",
      lastObservedAt: "...",
      source: "gateway-trace" | "runtime-event"
    }
  ],
  actionableIssue: null
}
```

This is not a required public/backend schema. Prefer a renderer-owned view
model unless a measured need proves otherwise.

Candidate current inputs are already available in the Home snapshot:

- `gatewayTraces` for observed Agent activity;
- selected/current `sharedLine` material for `我们现在`;
- existing `innerLife` pending/inbox material for `心里正在形成`, when it is
  allowed to be shown and actually exists;
- current health/attention truth for one exceptional actionable issue.

Do not add database queries, a second polling loop, a ClaraVision snapshot
builder, or direct coupling between Memoria, Continuity, and InnerLife for this
page. Collapse missing fields rather than generating plausible text.

## ClaraVision Source Boundary

Visual reference repository:

`/Users/zhouwei/Documents/ClaraCore/apps/claravision`

Current inspected local HEAD at handoff creation: `a6bb62f`
(`v0.8-orb-polish`). That repo also has an unrelated untracked `.claude/`
directory. Do not modify or clean it.

Useful reference files:

- `VISUAL_DIRECTION.md`
- `README.md`
- `app.js`
- `styles.css`

ClaraVision is a reference source, not a runtime or package dependency. Do not:

- embed its page in an iframe;
- launch its Electron process;
- import or copy its complete `app.js`;
- bring over Lara/Hermes conversation code;
- bring over its event-file watcher or polling interval;
- bring over zoom, pan, node selection, touch navigation, context menus, or
  transparent always-on-top window behavior;
- read `data/state.json` or run `build_state.py` from Desktop;
- map the full Memory corpus into visual nodes.

The existing ClaraVision orb mode currently allows roughly 560 particles and
its idle scheduler still requests another frame after about 16 ms. Those
budgets are explicitly unsuitable for a Home page that may remain visible for
long periods. Reuse visual ideas and small math helpers only after reviewing
their per-frame cost and ownership.

## P0 Performance Contract

Performance is a release criterion, not later polish.

### Lifecycle

- The renderer must expose explicit start/resume and stop/suspend behavior.
- Leaving Home must cancel the pending animation frame/timer immediately.
- `document.hidden`, minimized/hidden window, or reduced-motion static mode
  must stop continuous rendering rather than continue a low-frequency loop.
- Returning to Home may render one immediate frame, then resume the correct
  cadence.
- Snapshot updates may update the view model; they must not create an
  additional polling loop.
- Re-entering Home repeatedly must not accumulate event listeners, timers,
  animation frames, observers, arrays, gradients, or canvases.

### Frame budgets

- Active transition/activity animation: maximum target 30 FPS.
- Quiet breathing: target 10-12 FPS.
- Non-Home, hidden window, or static reduced-motion state: 0 continuous FPS.
- Avoid 60 FPS entirely for v0.5.7; this visual does not need it.
- Prefer timestamp-based interpolation so motion remains correct when frames
  are skipped.

### Scene budgets

- Foreground Agent presence lights: maximum 3.
- Additional far-field Agent hints: maximum 12 and visually subordinate.
- Decorative particles: begin at 96; hard cap at 160.
- Semantic particles must not scale with Memory count, trace count, or total
  registered Agents.
- Signal paths/trails must be capped independently; do not create one perpetual
  signal per historical event.
- Cap internal Canvas pixel work to approximately 0.8-1.0 megapixels and cap
  effective device scale. A Retina window must not automatically multiply the
  full scene to native device pixels.

### Per-frame work

- Use Canvas 2D for this version. Do not introduce Three.js/WebGL, a worker, or
  a new rendering dependency unless profiling proves the simple path cannot
  meet the contract.
- Build scene topology and lookup maps only when the bounded view model changes.
- Mutate/reuse bounded scene objects; avoid arrays, maps, objects, strings, and
  closures allocated inside the hot frame loop.
- Cache reusable gradients, paths, palette calculations, and static background
  layers. Invalidate them only on size/theme/dominant-color changes.
- Do not use per-particle `shadowBlur`, CSS backdrop blur over the full Canvas,
  per-link gradients, O(n^2) neighbor searches, or DOM nodes per particle.
- Do not call `getBoundingClientRect()` repeatedly inside one frame. Resize the
  Canvas only when its container actually changes.

### Motion and accessibility fallback

Respect the existing Desktop motion setting and system reduced-motion
preference:

- motion enabled: bounded breathing and color transitions;
- reduced motion/system reduction: static core plus state color, with only an
  optional one-time crossfade;
- renderer or Canvas failure: textual `此刻 / 我们现在` content remains fully
  visible and usable.

### Measured acceptance on the current development Mac

Measure after at least 30 seconds of stabilization in a real Electron window:

- quiet Home adds no more than roughly 5 percentage points of CPU above an
  equivalent static Home baseline;
- leaving Home or hiding the window reduces ClaraVision-specific continuous
  CPU work to approximately zero;
- active animation sustains its 30 FPS target without repeated frames above
  33 ms;
- repeated Home -> another page -> Home navigation does not create increasing
  CPU or renderer-memory trends;
- the visual layer should add no more than about 50 MB of stable renderer
  memory over the static Home baseline;
- the textual Home appears without waiting for Canvas initialization, and the
  first useful visual frame should normally appear within 300 ms after the
  existing snapshot is available.

Record the machine/window size, baseline, observed CPU, renderer memory, frame
cadence, and lifecycle result in the implementation closeout. Do not claim the
performance contract passed from visual smoothness alone.

## Empty, Sparse, And Error States

### No observed Agents yet

- Show one neutral, slowly breathing core.
- Do not invent Agent lights.
- Use a short explanation such as `还没有智能体来过这里`.
- One quiet link to `智能体接入` is acceptable. Do not recreate its setup
  instructions or configuration controls on Home.

### Agent activity exists but no Shared Line exists

- Show truthful Agent presence.
- Collapse `我们现在` or use a direct empty sentence.
- Do not generate a fake current line from tool names or memory counts.

### Shared state exists but no recent Agent activity exists

- Keep the shared core and text visible in a quiet state.
- Do not imply any Agent is currently online.

### Actionable runtime failure

- Keep the core readable and calm.
- Show at most one highest-priority, human-actionable issue with a direct link
  to its owning page.
- Ordinary maintenance, pending shares, historical trace errors, and internal
  counts are not automatically human work.

## Suggested Implementation Shape

Prefer a small isolated renderer rather than extending the current large Home
function with another unbounded block. Suggested ownership, subject to the live
tree:

- `app/views/home-presence.js`: bounded view-model mapping and render lifecycle;
- `app/views/home-vision.js`: Canvas scene, animation scheduler, and hit testing
  for read-only Agent labels;
- `styles/views/home.css` or one focused Home presence stylesheet;
- `app/views/home.js`: orchestration and existing non-Home shared helpers only;
- one focused Home UI/performance-lifecycle smoke test.

Do not introduce a general visualization framework. Keep the Canvas module
specific to Home and independent of the product data stores.

Implementation order:

1. Replace the old Home DOM with semantic text and an empty Canvas container.
2. Build the small truthful Home view model from the existing snapshot.
3. Implement lifecycle start/stop and test it before visual polish.
4. Add the neutral breathing core under the particle/pixel/FPS budgets.
5. Add stable Agent presence lights and capped colored flows.
6. Add smooth dominant-color interpolation and multi-Agent convergence.
7. Add reduced-motion/static and Canvas-failure fallbacks.
8. Remove obsolete Home dashboard rendering, listeners, i18n, and styles only
   after checking that other pages do not depend on shared helpers.
9. Run automated regressions, real visual QA, and measured performance QA.

## Validation Path

At minimum:

```bash
npm run check
npm run test:shell
npm run test:onboarding
npm run test:ux:polish
npm run test:agent-access
npm run test:phase3:ui
npm run test:phase4:trace-ui
npm run test:phase5:ui
git diff --check
```

Add a focused Home smoke that proves:

- no-agent, one-agent, three-agent, and more-than-three-agent snapshots;
- registered-but-inactive Agents are not shown as present;
- a new observed trace creates one arrival transition, not a perpetual replay;
- Agent colors are stable across rerenders;
- text and visual state come from the same snapshot;
- switching away cancels timers/frames and switching back creates only one
  scheduler;
- reduced motion produces a static scene;
- missing Canvas support leaves the textual Home intact;
- legacy statistics, module cards, activity-period tabs, and trace tables are
  absent from Home;
- Agent Access, Shared Line, InnerLife, Settings, and Logs still render.

Perform real Electron visual QA with isolated data for:

- light and dark themes;
- Chinese and English;
- empty first run;
- one recent Agent;
- two and three Agents with distinct stable colors;
- more than three recent Agents;
- quiet, recent, active-if-truthful, completion, and actionable-error states;
- reduced motion;
- wide desktop window and narrow supported window;
- repeated navigation away from and back to Home.

Use an isolated data root for seeded/live-safe tests. Do not disturb the user's
real product data.

## Done Criteria

- The first impression is a living shared space, not a dashboard.
- One brain core clearly represents the shared consciousness space.
- Multiple Agents are expressed through restrained presence lights and colored
  flows into that single core.
- Breathing and color change feel alive without making the page busy.
- The page never claims an Agent is online without sufficient runtime truth.
- A new user can still understand the page through the compact textual layer.
- Home contains no usage statistics or module-management surface.
- The visual uses the existing snapshot and creates no new runtime coupling.
- All animation lifecycle, scene, frame, accessibility, CPU, and memory budgets
  are measured and pass.
- Existing v0.5.7 page work remains intact.
- No commit or push occurs unless the user asks.

## Out Of Scope

- Usage Imprint / 使用印记.
- Full ClaraVision migration or package dependency.
- Lara/Hermes chat or conversation entry on Home.
- Voice, microphone, hotkeys, always-on-top orb, or transparent overlay.
- Full Memory graph, searchable visual nodes, zoom/pan, or node management.
- Agent configuration, permissions, lifecycle control, archive, or deletion.
- New presence heartbeat/session protocol solely to make the animation richer.
- WebGL/Three.js visual rewrite.
- Backend schema or storage changes unless an existing truthful field is
  demonstrably inaccessible and the user approves a separate scope.
