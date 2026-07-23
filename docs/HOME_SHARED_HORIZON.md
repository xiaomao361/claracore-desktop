# Home Shared Horizon

Date: 2026-07-17

Status: current Home product and performance contract, introduced in `0.5.8`
and carried forward by the `0.6.2` development line.

## Current Result

Home is a quiet presence surface, not a dashboard. Its visual subject is now a
`shared-horizon` scene:

- the Shared Line is a stable horizontal horizon across the shared world;
- up to three recently observed Agents appear as restrained ripples on that
  line;
- the most recent Agent may show one readable label; other labels remain
  available through hover or focus;
- the current Shared Line position and one eligible InnerLife thought remain
  code-native, readable text below the horizon;
- the empty state keeps the same world and line, removes all Agent signals, and
  offers one direct Agent Access action;
- wide, compact, light, and dark layouts use the same visual metaphor.

The previous radial core, globe, weather field, fog pockets, filaments, and
particle cloud are no longer the product direction. They made the Home surface
look biological or decorative instead of expressing continuity.

## Repository Truth

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Current development version: `0.6.4`
- Public stable baseline: `v0.6.3`

The Desktop repository may contain unrelated uncommitted work. Preserve it. Do
not revert, bulk-stage, commit, or push unless the user explicitly asks.

## Product Contract

### Home is a presence surface

Home should make the human feel:

> ClaraCore is still here. The shared world and the Agents' recent presence
> continue to exist.

Home must not become a statistics dashboard, module inventory, runtime board,
Agent administration console, trace table, or permanent onboarding checklist.

### Agent First remains intact

Agents operate and maintain Memory, Shared Lines, InnerLife, and runtime state.
The human Home observes and verifies. It does not ask the human to organize
Agents or maintain ClaraCore's internal systems.

One actionable failure may be disclosed quietly and explicitly. Normal
diagnostics remain owned by Logs and Settings.

### The Shared Line is the spatial spine

The horizon represents continuity across time, Agents, and the current shared
position. It is not an analytics axis and does not encode counts.

An Agent signal represents a verified recent arrival on that shared world. It
does not represent an avatar, permanent online state, or a separate mind/core.

InnerLife is a quiet echo near the horizon, not another equal-weight card.

## Truthful Presence Semantics

Presence comes from recent Gateway traces, never configuration alone.

| Observable truth | Home treatment | Allowed wording |
| --- | --- | --- |
| New trace since the prior snapshot | one arrival ripple | `刚刚活动` / `Active just now` |
| Explicit in-flight state | brighter signal, active cadence | `正在活动` / `Active` |
| Recent completed trace | restrained signal | `最近来过` / `Recently present` |
| Configured without recent trace | no signal | no presence claim |
| Older than the presence window | removed from foreground | no current claim |
| Actionable error | restrained warning plus text | never color alone |

Initial windows remain:

- bright recent presence: up to 90 seconds;
- dim recent presence: up to 15 minutes;
- older activity: absent from the Home foreground;
- foreground Agents: at most three, newest first.

## Screen Composition

Wide layout:

```text
此刻
Clara 刚刚来过这里
最近一次可验证活动来自 shared_line_update。

共同线 · Default Shared Line
─────────────────────── ◉ ─── ○ ─── ○

我们现在                              InnerLife · 回声
当前共同线标题与摘要                  一条合格的可分享想法
```

Empty layout keeps the same horizon with no Agent signals:

```text
共同意识空间安静地留在这里
还没有观察到最近的智能体活动，但共同线仍然保持着位置。
[打开智能体接入 →]

共同线 ───────────────────────────────
```

Compact layout keeps the same order and metaphor. It reduces type scale and
navigation width rather than inventing a second mobile design.

## Implementation Boundary

The current implementation reuses the existing product data model:

- `app/views/home-presence.js` builds the truthful bounded display model;
- `app/views/home.js` renders code-native text and Agent markers;
- `app/views/home-vision.js` draws only the horizon, three secondary curves,
  soft color washes, and up to three Agent glows;
- `styles/views/home-presence.css` owns wide, compact, light, and dark layout;
- Shared Line and InnerLife content remain DOM text, never Canvas text.

Do not add a second polling loop, new database query, ClaraVision dependency,
WebGL renderer, physics system, or runtime coupling for Home.

## Performance Contract

Current renderer limits:

- Canvas backing store: at most 720,000 pixels;
- quiet/recent cadence: 12 FPS;
- explicit active cadence: at most 24 FPS;
- reduced motion: static draw, 0 continuous FPS;
- Home inactive or document hidden: no timer and no animation frame;
- particles: zero;
- offscreen atmosphere sprites: zero;
- Agent signals: at most three.

Measured on 2026-07-17 in a real Electron window at 1440×900, DPR 2, using
30-second samples:

- reduced-motion baseline: 0 FPS, 0.07% average total app CPU;
- quiet breathing: 11.83 FPS, 0.68% average total app CPU;
- measured CPU delta: 0.61 percentage points;
- measured renderer working-set delta: -5.61 MB (sampling noise included);
- away from Home for 10 seconds: 0 rendered frames and no scheduled work.

## Validation Receipt

Validated in this revision with:

- `npm run test:home`;
- `npm run test:onboarding`;
- `npm run test:home:performance`;
- real Electron screenshots for active/wide, empty/wide, and dark/900×720;
- reduced motion, arrival settling, stable Agent colors, and away-from-Home
  scheduler assertions.

Repository-wide local-checkpoint validation on 2026-07-17 also passed:

- `npm run test:smoke`;
- `npm run test:home`;
- `npm run test:onboarding`;
- `npm run test:home:performance`;
- `npm run test:gateway:http`;
- `npm run test:ux:polish`;
- `git diff --check`.

## Current Visual Decisions

- Home uses the same restrained `8px` radius and one-pixel border as the other
  Desktop surfaces, with a lightly tinted surface gradient instead of a stark
  white edge-to-edge rectangle. It remains one continuous presence field, not
  a raised card, and adds no animation or rendering cost.
- Dark mode uses the same surface tokens and never falls back to a light gray
  panel.
- The main title is strong but capped so the Chinese empty-state sentence stays
  on one line at the normal wide window.
- The horizon may move only through slow low-amplitude curve drift.
- Arrival uses one bounded ring; it must settle and must not replay forever.
- Agent colors identify Agents but never turn the scene into a rainbow.
- Resource pressure remains shell chrome at the bottom, not Home content.

## Gateway Test Isolation

Random-port Gateway launches are test-only and must provide an isolated
`CLARACORE_DESKTOP_USER_DATA_DIR`. Desktop now rejects a test instance that
omits that directory, so a port-`0` `agent-gateway.json` cannot overwrite the
live Application Support configuration. The global checkpoint hook also
rejects a persisted port-`0` endpoint and falls back to the stable localhost MCP
address.

`npm run start:next` now supplies both the isolated product data root and the
isolated Electron user-data root, so the stricter guard does not break the
normal next-version launcher.

## Adjacent Memoria MCP Fix

The same local checkpoint fixes body-only `memoria_update` calls. The MCP
handler now reads the existing Memory and preserves omitted `title`, `labels`,
and `sensitivity`; fields explicitly present in the call still replace their
stored values. The focused Phase 2 Gateway smoke covers body replacement plus
title/label preservation.
