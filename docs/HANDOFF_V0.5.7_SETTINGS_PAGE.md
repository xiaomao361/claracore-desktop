# ClaraCore Desktop v0.5.7 Settings Page Handoff

Date: 2026-07-16

Status: implemented and validated on isolated data as the v0.5.7 development
checkpoint; this document records the completed Settings boundary.

## Implemented Checkpoint

- Replaced `General / Models / Data` with `Common / Capabilities / Advanced`.
- Removed the Settings focus dashboard, duplicated runtime/provider summaries,
  the read-only time-zone field, the model usage panel, the Agent guide card,
  copied agent config, and the duplicate data-location panel.
- Kept Common limited to appearance, window behavior, version, privacy, and
  human-triggered update checks.
- Made Memory retrieval and InnerLife capability cards collapsed by default,
  with provider/model/endpoint/key controls revealed only through `Change`.
- Added truthful configured, connected, failed, disabled, and needs-setup
  capability states without treating stored external fields as a health check.
- Moved model runtime details, Agent Gateway, data/recovery, storage location,
  and runtime information into five closed Advanced groups.
- Split save ownership between Common, capability authorization, model runtime,
  Gateway, and storage location; Common no longer writes the data-root choice.
- Preserved Full/Lite provider behavior, embedding-change confirmation,
  connection tests, Gateway updates, data-root restart behavior, verified
  backup/restore, product JSON import/export, and update checks.

Validation completed:

- `npm run check`
- `npm run test:phase1:ui`
- `npm run test:lite`
- `npm run test:update`
- `npm run test:backup:ui`
- `npm run test:import-preview:ui`
- `npm run test:ux:polish`
- `npm run test:agent-access`
- `npm run test:phase5`
- `git diff --check`
- Real Playwright Electron screenshots at 1440×900 CSS pixels / 2880×1800
  device pixels and 820×720, covering Common, collapsed/open Capabilities,
  failed connection, collapsed Advanced, and narrow layout.

## Continuation Prompt

```text
继续实现 ClaraCore Desktop v0.5.7 的设置页简化。先阅读
docs/HANDOFF_V0.5.7_SETTINGS_PAGE.md，确认 repo、git 状态，并保护当前未提交的
0.5.7 版本切换以及已经完成的记忆、共同线、内在活动、日志和智能体接入实现。
设置页改为“常用 / 智能能力 / 高级”三层：常用只保留人的偏好、窗口行为、版本
和更新；智能能力先显示记忆检索与内在活动是否可用，只有主动点击更改时才展开
Provider、Endpoint、模型和密钥；数据恢复、数据路径、Agent Gateway、内部模型
参数和运行信息全部进入默认关闭的高级区。严格遵循 Agent First：人决定偏好、
外部服务授权、存储边界和高风险恢复，系统与智能体负责日常运行和内部维护。
不要改首页或开始使用印记。完成后运行 handoff 中的验证并做真实 Electron 视觉 QA。
```

## Repository And Working Tree Truth

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Published baseline: `v0.5.6` at commit `c062777`
- Current development version: `0.5.7`
- Product version source: `package.json`, read through `core/version.js`
- At implementation start, the working tree intentionally contained the v0.5.7
  version transition plus completed Memory, Shared Line, InnerLife, Logs, and
  Agent Access work; the closeout preserved that full batch.
- The Agent Access implementation has one visible human setup action and an
  agent-led first-connection protocol. Settings must not reintroduce a second
  human-facing agent-config copy path.
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
`app/dom.js`, both i18n files, `styles/dark-fixes.css`,
`styles/views/responsive.css`, `core/tests/agent-access-ui-smoke.js`,
`core/tests/phase4-gateway-trace-ui-smoke.js`, and
`core/tests/ux-polish-ui-smoke.js`. Preserve the completed v0.5.7 work
deliberately.

## This Round

### Will do

- Replace `General / Models / Data` with `Common / Capabilities / Advanced`.
- Make the first Settings screen small and understandable without technical
  product knowledge.
- Keep human preferences, app behavior, version, privacy, and update checks in
  Common.
- Reframe model configuration as human-readable capability availability for
  Memory retrieval and InnerLife.
- Hide provider/model/endpoint/key forms until the human explicitly chooses to
  change a capability.
- Move low-frequency, technical, destructive, and recovery settings into
  closed Advanced groups.
- Remove duplicated summaries, technical metrics, Agent guide material, and
  equal-weight status badges that do not help a decision.
- Preserve all underlying settings, model, Gateway, data-root, backup,
  import/export, restore, update, and runtime contracts.
- Update Chinese and English together.
- Update all affected UI tests and perform real visual QA with isolated data.

### Will not do

- Do not redesign the whole app shell or navigation.
- Do not change Home; Home remains the last page to discuss.
- Do not begin Usage Imprint.
- Do not move Memory, Shared Line, InnerLife, Logs, or Agent Access content
  into Settings.
- Do not make Settings a system-health dashboard or developer console.
- Do not add new providers, model schemas, secret stores, backup formats,
  import types, update mechanisms, or Gateway transports.
- Do not delete backend capability just because its UI becomes hidden or moves.
- Do not auto-change model/provider/key, data-root, Gateway, import, restore,
  or update settings on behalf of the human.
- Do not reintroduce human InnerLife daemon controls on the content page.
- Do not expose secrets in summaries or unmasked default states.
- Do not commit or push unless the user asks.

### Validation path

- Static checks and diff hygiene.
- Settings/model configuration and Lite/Full variant UI smokes.
- Appearance persistence and shell/window regression.
- Update-check UI coverage.
- Gateway settings and Agent Access regression.
- Backup, import-preview, restore, and data-root behavior.
- Memory embedding and InnerLife model regressions.
- Real Electron visual QA with empty, configured, error, and advanced states.

### Done criteria

- A new user can understand the first Settings screen without knowing MCP,
  SQLite, embeddings, providers, daemons, ports, or runtime paths.
- Normal use requires only Common and occasional Capabilities interaction.
- All technical or high-risk operations are still available but closed under
  Advanced.
- The page clearly separates human authority from system/agent operation.
- Existing saved settings and data operations continue to work.

## Confirmed Product Principle

The Settings page follows **Agent First**, with an explicit human-authority
boundary:

> Humans choose personal preferences, grant external-service and secret
> access, choose storage boundaries, approve application updates, and perform
> exceptional recovery. Agents and the system operate the product, maintain
> its working state, and use internal runtime defaults.

This means Settings is allowed to contain human-controlled mutations, but only
when the human is the correct authority.

### Human-owned decisions

- language, theme, motion, and window-close behavior;
- whether an external model/provider may be used;
- endpoint and secret/API-key authorization;
- changing the product data location;
- checking/downloading an application update;
- explicit backup, export, import, and restore actions;
- exceptional Gateway port/token recovery when needed.

### System/agent-owned operation

- normal Memory, Shared Line, and InnerLife content maintenance;
- routine log retention and diagnostics;
- choosing sensible internal defaults;
- normal Gateway operation and agent onboarding;
- routine background cadence and model-role split;
- runtime paths, process facts, and implementation versions;
- ordinary backups/maintenance when automation exists and is trustworthy.

Do not ask the human to manage system internals merely because the current
implementation exposes a field.

## Why The Current Page Feels Disorganized

The current page has only three tabs, but it simultaneously acts as:

1. Personal-preference settings.
2. Window behavior settings.
3. Agent Gateway administration.
4. Data-root and filesystem configuration.
5. Model/provider/key configuration.
6. InnerLife runtime tuning.
7. Backup, export, import, and restore center.
8. About/update page.
9. Runtime/developer information page.
10. Agent documentation source map.

The issue is conceptual hierarchy, not card spacing. `General / Models / Data`
separates files and forms, but it does not distinguish normal decisions from
technical maintenance or exceptional recovery.

## Confirmed Top-Level Structure

Use three top-level Settings views:

1. `常用` / `Common`
2. `智能能力` / `Capabilities`
3. `高级` / `Advanced`

Recommended first screen:

```text
设置

[常用]  [智能能力]  [高级]

外观
语言          中文
主题          跟随系统
动态效果      跟随系统

窗口
关闭窗口      隐藏到托盘

关于
版本          0.5.7 · Full
              [检查更新]

                         [保存常用设置]
```

This is an information hierarchy, not a pixel-perfect requirement. Reuse the
current visual system and controls where practical.

## Common

Common contains only settings a normal human can reasonably understand and
change during everyday use.

### Appearance

Keep:

- Language.
- Theme: system/light/dark.
- Motion: system/on/off.

Remove from the form:

- the read-only time-zone input;
- static `ready` badges.

Time zone follows the system. If it remains useful to disclose, show one quiet
non-form sentence such as `时间显示跟随系统（Asia/Shanghai）`; do not render it
as a setting the user cannot change.

### Window

Keep:

- Close window: hide to tray / quit app.

Avoid a separate status badge or duplicated read-only summary. The selected
value already communicates the state.

### About And Update

Keep a compact block:

- app version;
- build flavor when it affects what the user receives (`Full` / `Lite`);
- privacy sentence;
- Check for updates;
- Open download page when an update exists.

Move out of Common:

- runtime mode;
- database state;
- tray status;
- duplicated theme/motion/window summaries;
- Electron, Node, and Chrome versions;
- app root;
- Agent guide/source-map card;
- raw runtime/path details.

Update checks remain explicitly human-triggered. Do not add automatic install
or silent download in this slice.

### Saving Common

Use one clear action such as `保存常用设置` / `Save common settings`.

- Save only preference/window values owned by this view.
- Preserve current persistence and restart behavior.
- Language/theme/motion preview behavior may remain immediate if already
  established, but Cancel/relaunch semantics must stay truthful.
- Do not accidentally save model, Gateway, data-root, import, or restore state
  from this action.

## Capabilities

Rename the user concept from `Models` to `Capabilities`.

The first layer should answer:

> Which ClaraCore abilities are available, and which ones need my external
> provider authorization?

Show two primary capability cards.

### Memory Retrieval

Recommended collapsed state:

```text
记忆检索
● 已就绪
使用 ClaraCore 内置模型

[更改]
```

Truthful states may include:

- Ready with built-in model.
- Ready with Ollama/provider name.
- Disabled.
- Needs setup.
- Configuration saved but not tested this session.
- Last connection test failed.
- Lite build requires Ollama or Disabled.

Avoid saying `healthy` merely because fields are populated. Distinguish stored
configuration from a successful connection test.

When the human selects `更改`, reveal only the fields relevant to the selected
provider:

- Provider.
- Endpoint when required.
- Embedding model when required.
- Secret/API-key reference when required.
- Fetch models.
- Test connection.
- Save capability settings.

Keep the embedding-rebuild warning when provider/model changes require
re-embedding existing Memory. Do not move vector maintenance actions back onto
the normal Settings screen.

### InnerLife

Recommended collapsed state:

```text
内在活动
● 已连接
使用 DeepSeek

[更改]
```

Truthful states may include:

- Connected/tested.
- Configured but not tested this session.
- Disabled.
- Needs provider authorization.
- Last connection test failed.

When the human selects `更改`, reveal the human-authority fields:

- Provider.
- Endpoint when required.
- Primary model.
- Secret/API-key reference.
- Fetch models.
- Test connection.
- Save capability settings.

The existing `deep model` may serve as the primary user-facing model choice.
Do not force a schema migration solely to rename the label.

Move internal tuning out of the normal capability form:

- light-model override;
- separate light/deep role explanation;
- background-loop/poll minutes;
- daemon/runtime implementation language.

These values belong under Advanced model runtime details and should continue
using safe existing defaults when the human does not override them.

### Capability Form Rules

- Capability configuration is collapsed by default when usable.
- When a capability needs setup or has an error, expose one clear action; do
  not automatically open every technical field on page entry.
- Test connection and Save remain distinct. Fetching models proves discovery,
  not health.
- Preserve current connection-test semantics: endpoint/model availability is
  checked without claiming a generation request occurred.
- Mask secret values by default. Do not show secret references in a summary
  metric panel.
- Do not add a duplicate `Usage summary` side panel. Put a one-sentence purpose
  explanation in each capability card.
- Do not show static `ready` badges on cards that are not based on verified
  state.
- A model/provider change must not silently enable, pause, or run InnerLife.

## Advanced

Advanced is a deliberate low-frequency surface. All groups are closed by
default.

Recommended introduction:

> 这些设置会改变连接、存储或恢复行为。只有在明确需要时再修改。

English:

> These settings change connection, storage, or recovery behavior. Open them
> only when you have a specific reason.

Recommended groups:

1. Model runtime details.
2. Agent Gateway.
3. Data and recovery.
4. Storage location.
5. Runtime information.

Do not render all groups expanded as another long settings page.

### Model Runtime Details

Move here:

- InnerLife light-model override;
- deep-model role detail if still needed beyond the primary model field;
- background-loop/poll interval;
- other existing runtime-specific model values that are not required for basic
  provider authorization.

Rules:

- Preserve safe existing defaults.
- Explain the consequence of an override, not the implementation history.
- Do not add daemon start/pause/tick controls.
- Do not surface model usage counts or statistics.

### Agent Gateway

Move the current Gateway settings here:

- status;
- port;
- bearer token;
- endpoint;
- token file;
- generate/rotate token;
- save Gateway configuration.

Rules:

- Closed by default.
- Keep explicit warnings that port/token changes can disconnect agents.
- Preserve token masking, validation, persistence, and restart/update behavior.
- Do not show routine Gateway details in Common or Capabilities.
- Remove `Copy agent config` from Settings. Agent Access now owns the one and
  only visible human onboarding copy action.
- Preserve the underlying config-generation API because Agent Access and
  agent bootstrap may still use it.
- Do not hard-code an endpoint/port in static copy; render current runtime
  truth.

### Data And Recovery

Move the current Data tab here as one closed high-risk group:

- Create verified backup.
- Export product JSON.
- Import product JSON.
- Recent backups.
- Restore preview and typed confirmation.
- Open backups folder where still useful.

Rules:

- Present Backup/Export as safe preparation.
- Visually separate Import/Restore as state-changing recovery.
- Preserve verified safety backup behavior before destructive changes.
- Preserve preview, cancellation, typed `RESTORE`, and rollback evidence.
- Do not add human delete/cleanup actions as ordinary maintenance.
- Keep copy plain and explicit about merge versus replacement semantics.
- Do not weaken backup/restore/import tests during the layout move.

Data/recovery stays human-controlled because it changes or replaces the local
source of truth. Its presence in Advanced does not make it an agent-managed
routine.

### Storage Location

Move here:

- current product data root;
- choose custom data root;
- reset to default;
- restart/relaunch requirement;
- open data folder;
- path details.

Rules:

- Closed by default.
- Show the current root once; remove duplicate Location panels.
- Keep environment-override truth visible when
  `CLARACORE_DESKTOP_DATA_DIR` controls the launch.
- Preserve restart-required behavior and warnings.
- Put database, backup, export, logs, runtime, config-file, and app-root paths
  behind a nested read-only details disclosure if retained.
- Do not turn paths into editable free-form fields unless the existing safe
  chooser/validation contract supports it.

### Runtime Information

Move here as read-only evidence:

- runtime mode;
- database state;
- tray state when diagnostically useful;
- Electron version;
- Node version;
- Chrome version;
- app root;
- other package/runtime facts already returned by the snapshot.

Rules:

- Closed by default.
- Do not repeat values already visible in Common.
- Do not add process controls, kill/restart buttons, log cleanup, or source
  editing.
- Remove the Agent guide/source-map card. Agents learn through Agent Access,
  `/agent/setup`, and `gateway_docs`; humans do not need this in Settings.

## Current-To-New Mapping

| Current content | New location | Treatment |
| --- | --- | --- |
| Language, theme, motion | Common / Appearance | Keep |
| Read-only time-zone input | Common quiet note or omit | Remove as form field |
| Close-window behavior | Common / Window | Keep |
| Version, build flavor, update | Common / About | Keep and compact |
| Privacy note | Common / About | Keep concise |
| Runtime/database/tray/theme metrics | Advanced / Runtime | Remove duplicates |
| Electron, Node, Chrome, app root | Advanced / Runtime | Closed, read-only |
| Agent guide/source map | Agent Access and `gateway_docs` | Remove from Settings |
| Memory embedding form | Capabilities / Memory Retrieval | Collapsed until change |
| InnerLife provider form | Capabilities / InnerLife | Collapsed until change |
| Light model and poll interval | Advanced / Model runtime | Closed |
| Model Usage summary side panel | Inline capability copy | Remove panel |
| Agent Gateway port/token | Advanced / Agent Gateway | Closed |
| Copy Agent Gateway config | Agent Access only | Remove Settings action |
| Data root and path details | Advanced / Storage | Closed and deduplicated |
| Backup/export/import/restore | Advanced / Data and recovery | Closed, preserve safety |
| Duplicate Data Location panel | Advanced / Storage | Remove duplicate |

## Interaction And State Rules

- The selected Settings tab may persist within the current app session, but do
  not force Advanced as the default on app restart.
- Common is the default entry.
- Every Advanced disclosure starts closed on normal entry.
- Switching tabs, opening disclosures, changing language/theme previews, or
  reading status must not mutate provider, Gateway, data, or product content.
- Unsaved form state must not leak across unrelated capability/advanced
  sections.
- Save actions must have narrow ownership and clear success/failure feedback.
- Do not use one global Save button that silently writes Common,
  Capabilities, Gateway, storage, and recovery state together.
- Preserve confirmation dialogs for provider/model changes that invalidate
  embeddings, Gateway token/port changes, data-root restart, import, and
  restore where currently required.
- Empty or disabled capability states are valid states, not global app errors.
- `InnerLife paused` remains a normal state when no model loop is enabled.

## Remove Or Strongly De-emphasize

Remove from the normal Settings reading path:

- repeated `ready` badges on Appearance and Window;
- the read-only time-zone input;
- the ten-row About metric list;
- duplicated theme, motion, window, and tray summaries;
- the Model Usage summary side panel;
- secret-reference summary metrics;
- Fetch-model and connection-test explanatory metrics;
- the Agent guide/source-map card;
- repeated data-root Location panel;
- exposed path lists;
- visible Gateway endpoint/token controls;
- human-facing copied agent config;
- implementation-oriented terms such as daemon, poll, embedding dimensions,
  Electron, Node, Chrome, SQLite path, and token file outside Advanced.

Do not delete i18n strings or backend fields blindly. Remove only values proven
unused after renderer/test changes, and preserve compatibility surfaces that
other pages or APIs still consume.

## Current Implementation Surfaces

Primary renderer paths:

- `index.html`: current General/Models/Data tabs and all settings markup.
- `app/dom.js`: Settings, model, Gateway, path, update, backup, import, and
  restore DOM registry.
- `app/views/settings.js`: settings rendering, collection, validation,
  capability visibility, secret handling, Gateway copy/config, and tab binding.
- `app/views/data.js`: backup/import/restore rendering and event behavior.
- `app.js`: Settings integration, save/test/fetch actions, Gateway config,
  data-root, update, backup/import/restore, and tab/view event wiring.
- `app/appearance.js`: language/theme/motion behavior and persistence.
- `app/model-options.js`: provider/model list behavior.
- `app/i18n/zh.js` and `app/i18n/en.js`: current technical and duplicated
  Settings copy.
- `app/view-registry.js`: Settings view title/subtitle if applicable.

Primary styles:

- `styles/views/settings-controls.css`
- the current Settings layout styles imported through `styles/views/product.css`
- `styles/views/responsive.css`
- `styles/dark-fixes.css`
- any shared `.screen-grid`, `.panel`, `.settings-tabs`, `.settings-grid`,
  `.metric-list`, `.action-row`, `.backup-list`, and restore styles.

Backend/runtime contracts to preserve:

- Desktop preferences persistence and close behavior.
- model/provider configuration and connection tests.
- Memory embedding provider/model selection and rebuild warning.
- InnerLife model/provider configuration.
- Agent Gateway port/token persistence and update behavior.
- current Agent Access bootstrap/config generation.
- data-root selection, validation, environment override, and relaunch behavior.
- backup creation/verification, JSON export/import, restore preview, safety
  backup, and restore.
- update-release client and download URL handling.
- Full/Lite build-flavor behavior.

## Primary Tests To Update

- `core/tests/phase1-settings-ui-smoke.js`
- `core/tests/lite-settings-ui-smoke.js`
- `core/tests/update-settings-ui-smoke.js`
- `core/tests/backup-restore-ui-smoke.js`
- `core/tests/import-preview-ui-smoke.js`
- `core/tests/ux-polish-ui-smoke.js`
- `core/tests/shell-window-smoke.js`
- `core/tests/agent-access-ui-smoke.js`
- `core/tests/phase2-memory-ui-smoke.js`
- `core/tests/phase5-innerlife-ui-smoke.js`
- `core/tests/phase5-innerlife-scheduler-ui-smoke.js`

Current tests directly select `data-settings-tab="general"`, `"models"`, or
`"data"`. Update them to the new tab contract and open the intended Advanced
group before interacting with moved Gateway, backup, import, restore, storage,
or runtime controls.

Do not weaken behavioral assertions simply because selectors move. Preserve
actual persistence, connection, backup, restore, import, and Agent Access
regression coverage.

## Suggested Implementation Sequence

1. Reconfirm repo truth and protect all existing v0.5.7 changes.
2. Map current fields/actions/tests to Common, Capabilities, or Advanced before
   moving markup.
3. Update/add UI assertions for default Common entry and closed Advanced
   groups.
4. Build the three-tab skeleton and move Common content first.
5. Simplify About and remove duplicate metrics/source-map content.
6. Reframe Models as the two collapsed capability cards while preserving
   provider/model/key/test/save behavior.
7. Move light-model/poll/runtime tuning into Advanced model details.
8. Move Gateway settings into a closed Advanced group and remove the Settings
   copy-config action without removing config generation.
9. Move Data into closed Data and Recovery and Storage groups; preserve every
   destructive-action safeguard.
10. Move runtime/path facts into closed read-only Advanced disclosures.
11. Update Chinese and English together and remove only proven-unused copy.
12. Adjust responsive and dark styles without regressing other v0.5.7 pages.
13. Run focused tests, then the broader affected suite.
14. Perform real Electron visual QA with isolated data.

Avoid a broad rewrite of `app.js` or settings persistence. This is primarily
an information-architecture and renderer simplification; make the smallest
behavior changes required to produce truthful capability states and narrow
save ownership.

## Acceptance Criteria

- Settings has exactly three top-level views: Common, Capabilities, Advanced.
- Common is the default and shows only Appearance, Window, About/Privacy, and
  Update.
- No read-only time-zone input or static ready badges appear in Common.
- About is compact; implementation versions and runtime paths are absent from
  the normal view.
- Capabilities shows Memory Retrieval and InnerLife availability before any
  technical fields.
- Provider/model/endpoint/key forms are collapsed until the human chooses to
  change or resolve a capability.
- Capability status distinguishes configured, tested, disabled, needs setup,
  and failed states truthfully.
- The Usage summary side panel and secret/configuration metrics are gone.
- All Advanced groups are closed by default.
- Gateway, data/recovery, storage, model runtime, and runtime information are
  available only inside Advanced.
- Settings no longer exposes a second Copy Agent Config action.
- Agent Access still exposes exactly one human onboarding copy action and its
  first-connection protocol remains intact.
- Backup, export, import, restore preview, safety backup, typed confirmation,
  and cancellation still work.
- Data-root change/default/restart/environment-override behavior still works.
- Gateway port/token save/generate behavior still works from Advanced.
- Memory embedding Full/Lite behavior, model discovery, connection test,
  save, and rebuild warning still work.
- InnerLife provider/model discovery, connection test, save, and safe disabled
  behavior still work.
- Common settings persist across restart.
- Reading/switching/expanding Settings does not mutate product content.
- Chinese and English, light and dark themes, populated and empty/error states,
  and supported responsive widths work without overflow.
- Memory, Shared Line, InnerLife, Logs, Agent Access, Home, and future Usage
  Imprint do not regress.

## Automated Validation

Use isolated data roots and user-data roots. Do not touch the daily-use
database or current personal preferences.

Minimum commands:

```bash
git diff --check
npm run check
npm run test:phase1
npm run test:lite
npm run test:update
npm run test:backup
npm run test:backup:ui
npm run test:import-preview
npm run test:import-preview:ui
npm run test:shell
npm run test:ux:polish
npm run test:agent-access
```

Because model and shared renderer behavior overlaps Memory and InnerLife, also
run:

```bash
npm run test:phase2
npm run test:phase5
```

If shared shell/i18n/styles affect Shared Line or Logs, rerun their focused UI
baselines as well:

```bash
npm run test:phase3:ui
npm run test:phase4:trace-ui
```

### Required UI assertions

Add or update assertions that prove:

- Common is selected on initial Settings entry;
- tab order/labels are Common, Capabilities, Advanced in both languages;
- Common contains only the approved normal content;
- Capabilities initially shows compact truthful Memory/InnerLife states;
- technical capability fields open only through explicit Change actions;
- Advanced groups are closed initially and expose the correct moved controls
  after expansion;
- removed duplicate metrics/source-map/config-copy elements do not exist;
- save actions affect only their owned configuration groups;
- tab switches and disclosure toggles do not save or mutate state;
- appearance/window preferences persist after restart;
- Full and Lite capability states are truthful;
- failed/not-tested/tested model states are distinct;
- Agent Gateway controls preserve port/token behavior in Advanced;
- backup/import/restore/storage controls work after moving into Advanced;
- Settings no longer creates a second agent onboarding copy path;
- no console errors or horizontal overflow occur.

## Visual QA

Cover at least:

- Chinese light mode, Common;
- Chinese dark mode, Capabilities;
- English light mode, Advanced;
- Full build with built-in Memory retrieval ready;
- Lite build requiring Ollama or Disabled;
- InnerLife disabled;
- InnerLife configured but not tested;
- successful connection test;
- failed connection test with a long error;
- capability Change closed/open/closed;
- every Advanced group closed initially;
- Agent Gateway expanded with long endpoint/token-file paths;
- Data and Recovery with no backups and multiple backups;
- restore preview and confirmation;
- environment-controlled data root;
- update available/up-to-date/network-error states;
- a narrow responsive window;
- navigation away and back;
- no console errors and no horizontal page overflow.

## Completion Report

At implementation completion, report:

- the final Common/Capabilities/Advanced structure;
- which human-authority decisions remain normally visible;
- which technical/recovery controls moved into Advanced;
- how capability status is derived and distinguished from connection tests;
- what duplicate/technical content was removed;
- confirmation that Settings no longer exposes agent-config copy;
- which backend/settings/data/Gateway/model contracts were preserved;
- exact automated commands and results;
- real Electron visual QA scenarios and result;
- anything not validated;
- confirmation that Home and Usage Imprint were not changed;
- final git status, with no commit/push claim unless actually performed.
