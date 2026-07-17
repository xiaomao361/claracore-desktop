# ClaraCore Desktop v0.5.7 Agent Access Page Handoff

Date: 2026-07-16

Status: implementation complete in the current dirty v0.5.7 working tree;
automated clean-client onboarding, Electron UI, Gateway, Shared Line regression,
shell, UX, and packaged Gateway validation pass. A real external LLM client's
first proactive user response remains the final manual acceptance step.

## Implementation Checkpoint

- Agent Access now keeps the read-only connected-agent and recent-activity
  evidence on the left and exposes one visible `复制给智能体` action on the right.
- The copied brief is generated from the current Streamable HTTP endpoint,
  bearer authorization, and stdio fallback config; detailed reference material
  is no longer rendered or copied from this page.
- `/agent/setup`, `claracore_connection_test`, `gateway_docs`, the Gateway
  README, and the external-agent playbook use the same first-connection order.
- First-connection reads no longer materialize an empty default Shared Line.
- Added `npm run test:agent-access` and expanded HTTP/Phase 4 contract coverage.
- Verified: `npm run check`, `npm run test:agent-access`,
  `npm run test:gateway:http`, `npm run test:phase3`, `npm run test:phase4`,
  `npm run test:shell`, `npm run test:ux:polish`, and
  `npm run test:phase4:packaged`.
- Visual QA covered the Chinese default state and English/dark at 900 px
  without horizontal overflow. The remaining manual acceptance is to paste the
  brief into a genuinely clean external agent client and capture its first
  grounded capability/context introduction.

## Continuation Prompt

```text
继续实现 ClaraCore Desktop v0.5.7 的“智能体接入”页面与首次接入协议。先阅读
docs/HANDOFF_V0.5.7_AGENT_ACCESS_PAGE.md，确认 repo、git 状态，并保护当前未
提交的 0.5.7 版本切换以及已经完成的记忆、共同线、内在活动和日志页实现。
严格遵循 Agent First：人只看到一个“复制给智能体”入口；智能体负责理解当前
连接信息、选择受支持的传输、完成或指导配置、验证连接、阅读 gateway_docs、
读取当前上下文，并主动告诉用户 ClaraCore 可以做什么。左侧已接入智能体与最近
活动继续保持只读。不要删除 HTTP/stdio/IPC/Gateway 等底层兼容能力；不要改首页
或开始使用印记。完成后运行 handoff 中的自动化验证，并做真实 Electron 视觉 QA
和一次真实新智能体首次接入验收。
```

## Repository And Working Tree Truth

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch: `main`
- Published baseline: `v0.5.6` at commit `c062777`
- Current development version: `0.5.7`
- Product version source: `package.json`, read through `core/version.js`
- At implementation start, the working tree intentionally contained the v0.5.7
  version transition and completed Memory, Shared Line, InnerLife, and Logs
  page work; the closeout preserved that full batch.
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
`styles/views/responsive.css`, `core/tests/phase4-gateway-trace-ui-smoke.js`,
and `core/tests/ux-polish-ui-smoke.js`. Preserve the completed v0.5.7 page
work deliberately.

## This Round

### Will do

- Keep the existing read-only connected-agent and recent-activity content as
  the main verification surface.
- Replace the crowded right-side access console with one visible onboarding
  explanation and one `复制给智能体` / `Copy for agent` action.
- Generate one compact, current-runtime bootstrap brief for the agent.
- Give the agent an unambiguous preferred transport order without asking the
  human to choose between HTTP and stdio.
- Add a canonical first-connection protocol across the copied brief,
  `/agent/setup`, `claracore_connection_test`, and `gateway_docs`.
- Require the newly connected agent to read current context and proactively
  explain ClaraCore's useful capabilities to the user.
- Keep detailed agent documentation available through `gateway_docs` and the
  repository playbook, while front-loading a short product-oriented quick
  start.
- Update Chinese and English together.
- Add contract/UI tests and perform one real new-agent onboarding acceptance
  loop.

### Will not do

- Do not turn Agent Access into a connection-management dashboard.
- Do not add multiple visible setup choices, client tabs, transport selectors,
  or separate buttons for MCP config, command, endpoint, token, or runtime
  folder.
- Do not delete Streamable HTTP, stdio fallback, MCP config generation,
  `/agent/setup`, Gateway endpoints, token handling, IPC, CLI fallback, or
  agent identity contracts.
- Do not make the human learn tool names before using ClaraCore.
- Do not auto-write Memory, Shared Line, or InnerLife content merely because
  an agent connected or read onboarding material.
- Do not promise that every client can edit its own MCP settings. When it
  cannot, the agent must give the human one exact, client-specific action.
- Do not add a new onboarding page or a separate human tutorial.
- Do not change Home; Home remains the last page to discuss.
- Do not begin Usage Imprint.
- Do not commit or push unless the user asks.

### Validation path

- Static checks and diff hygiene.
- Streamable HTTP setup and MCP JSON-RPC contract smoke.
- Phase 4 stdio and packaged Gateway contract coverage.
- Agent Access Electron UI smoke with clipboard output verification.
- Shell and UX-polish regression coverage.
- Real Electron visual QA with isolated data.
- One clean-client or clean-config new-agent acceptance loop.

### Done criteria

- The human sees one and only one setup action.
- The copied bootstrap brief is sufficient for an agent to connect or tell the
  human exactly what single setup action is required.
- A successful first connection leads the agent through docs and context
  without the user having to ask “怎么用”.
- The agent proactively returns a truthful, concise capability introduction
  and current-context summary in the user's language.
- Existing agents, Gateway transports, token/config behavior, and agent
  activity evidence remain intact.

## Confirmed Product Principle

The page follows **Agent First**:

> The human hands one invitation to an agent. The agent reads the connection
> material, establishes and verifies access, learns the product contract, and
> explains its usable capabilities. The human only observes whether the agent
> connected and what it recently used.

The page is not a human-facing MCP administration console. It should answer
only two questions:

1. How do I let a new agent enter ClaraCore?
2. Which agents have actually used ClaraCore recently?

Recommended page explanation:

> 把接入说明交给智能体，它会自行连接、读取使用说明并告诉你可以做什么。

English equivalent:

> Give the setup brief to an agent. It will connect, read the guide, and tell
> you what it can do.

## Product Meaning Of “One And Only One”

“One” applies to the human product entry, not to the underlying compatibility
layer.

- The human sees one `复制给智能体` button.
- The generated brief gives the agent one preferred order: use the current
  Streamable HTTP MCP endpoint when supported; use the generated stdio config
  only when the client does not support HTTP MCP.
- The agent, not the human, evaluates client support.
- HTTP and stdio must not be presented as equal visible choices.
- Existing compatibility implementations remain available to connected
  clients and recovery workflows.

Do not hard-code a port, token, endpoint, data root, app path, or MCP command
inside static copy. Always derive the current connection material from the
runtime snapshot/setup payload. Current code uses a configured stable
localhost Gateway by default, but the bootstrap contract must remain truthful
if the user changes that configuration.

## Confirmed Page Hierarchy

Recommended desktop structure:

```text
智能体接入
把接入说明交给智能体，它会自行连接、读取使用说明并告诉你可以做什么。

┌ 有调用记录的智能体 ──────────────┐  ┌ 让智能体接入 ClaraCore ─────┐
│ Clara · Claude Code · 最近调用   │  │                            │
│ Codex · Codex App · 已记录       │  │ 把接入说明发送给智能体，     │
│                                  │  │ 它会自行连接并验证。         │
│ 最近活动                         │  │                            │
│ Clara 读取了共同线               │  │   [ 复制给智能体 ]           │
│ Codex 检索了记忆                 │  │                            │
│                                  │  │ 复制后粘贴到智能体对话中。   │
└──────────────────────────────────┘  └────────────────────────────┘
```

This is an information hierarchy, not a pixel-perfect design. Reuse the
existing visual language and responsive behavior.

## Left Side: Read-Only Verification

Keep the current two concepts:

- agents grouped from recent MCP/Gateway traces;
- recent Gateway tool activity across agents.

Truth rules:

- Do not label trace-derived presence as “online”.
- Keep wording such as `刚刚调用`, `最近调用`, or `已记录` rather than inventing
  live connection state.
- A successful `claracore_connection_test` may appear as a visible handshake
  trace.
- The left side remains read-only: no disconnect, rename, merge, delete,
  suspend, retry, or identity-management controls.
- Keep errors visible but quiet; this is evidence, not an incident console.
- Do not add counts or charts unless needed to explain an actual error.

The current left-side subject and recent-activity table are broadly acceptable.
This slice should avoid redesigning them beyond copy, spacing, empty-state, and
responsive adjustments required by the simplified right side.

## Right Side: One Bootstrap Action

The right panel contains only:

1. `让智能体接入 ClaraCore`.
2. One sentence explaining that the agent will connect, read the guide, and
   report its capabilities.
3. One primary `复制给智能体` button.
4. Quiet copy success/failure feedback.
5. A short helper: `复制后，粘贴到智能体对话中。`

When the Gateway/setup payload is not ready:

- disable the copy action;
- show a truthful quiet status such as `接入服务正在启动`;
- do not expose a half-valid endpoint or stale config;
- recover automatically when the runtime snapshot becomes ready.

Remove from the Agent Access renderer:

- the second `Copy MCP config` action;
- current identity list;
- Rotate Streamable HTTP token;
- Open runtime folder;
- visible MCP command and MCP config;
- HTTP endpoint list;
- Connection Details disclosures;
- Maintenance Details disclosure;
- giant agent-guide preview;
- page-level transport, token, port, file, path, and CLI explanations.

Do not delete their backend capability. Port/token management already belongs
under Settings -> Agent Gateway. Detailed diagnostics belong in Settings,
Logs, `gateway_docs`, or developer documentation rather than beside the one
human setup action.

## Copied Bootstrap Brief

The clipboard content should be compact and operational. It is an agent
bootstrap instruction, not the full `gateway_docs` reference.

It must include current truthful connection material and this behavioral
contract:

1. You are being invited to connect to ClaraCore Desktop.
2. Prefer the supplied current Streamable HTTP MCP setup when your client
   supports it.
3. If your client cannot use Streamable HTTP, use the supplied generated stdio
   fallback. Do not ask the human to choose between transports.
4. Use your own stable persona id and a truthful client id. Do not reuse
   another agent's id.
5. If you can update/reload your own MCP configuration, do so and reconnect.
6. If you cannot, tell the human exactly which client settings screen/file to
   open and exactly what single config block to paste. Do not answer only
   “please configure MCP”.
7. After tools become available, call `claracore_connection_test`.
8. Call `gateway_docs` and read the First Connection and Product Capabilities
   sections.
9. Call `shared_line_list` with `status=active`, then call `gateway_context`
   with an explicit `lineId` when required.
10. Proactively tell the user that connection succeeded, what ClaraCore now
    lets you do, what current resumable context was found, and give several
    natural-language example requests.

The copied brief must not:

- dump the complete tool catalog, module playbook, CLI fallback, model
  defaults, runtime paths, or maintenance notes;
- ask the human to understand headers, tokens, environment variables, or
  transport differences;
- claim the agent is connected before the verification call succeeds;
- include a stale endpoint/config from an earlier render;
- expose secrets beyond what the intentional local copy action already needs
  to establish the token-protected localhost connection.

Preserve the current fallback principle: when an agent cannot edit its own MCP
settings, it may ask the human for one precise client action. Agent First does
not mean pretending every host has self-modifying configuration access.

## Canonical First-Connection Protocol

The protocol must be consistent across all entry surfaces:

```text
install/reload MCP
  -> claracore_connection_test
  -> gateway_docs
  -> shared_line_list(status=active)
  -> gateway_context(lineId when needed)
  -> proactive user capability introduction
```

Avoid the current drift where:

- the copied instructions mention `gateway_docs`;
- `/agent/setup.firstCalls` mentions `gateway_docs`;
- `claracore_connection_test.next` skips directly to Shared Line and context;
- older Gateway documentation sometimes says to call `gateway_context` first.

Pick the sequence above and update every current source of truth together.

### `claracore_connection_test`

Keep existing connection/identity/transport/module evidence. Preserve the
existing `next` field if compatibility requires it, but add or replace guidance
with structured, testable onboarding data such as:

```json
{
  "nextCalls": [
    "gateway_docs",
    "shared_line_list",
    "gateway_context"
  ],
  "afterOnboarding": "Tell the user what ClaraCore enables and summarize the current resumable context."
}
```

Requirements:

- `gateway_docs` must be the first post-verification call.
- Do not report module `empty` or InnerLife `paused` as a failed connection.
- Keep identity and transport truth visible in the response.
- Connection testing may record the expected Gateway handshake trace, but it
  must not create user content in Memory, Shared Line, or InnerLife.

### `/agent/setup`

Keep the authenticated JSON setup endpoint and existing technical fields for
agents. Add an explicit after-connect/user-handoff contract if it is not
already represented.

Suggested stable concepts:

- `firstCalls`
- `capabilities`
- `afterConnect`
- `userIntroductionRequirements`

Do not make UI copy depend on undocumented ad hoc response strings. Keep the
setup JSON, copied brief, and Gateway tools aligned through tests.

### `gateway_docs`

The current guide is comprehensive but front-loads implementation concepts and
contains a long reference. Preserve the detailed reference while adding a
short product-oriented beginning.

Recommended top-level order:

1. `First Connection`.
2. `What ClaraCore Lets You Do`.
3. `Tell The User`.
4. `Current Context` guidance.
5. Identity and safety boundaries.
6. Common recipes.
7. Detailed module/tool reference.
8. MCP/CLI fallback and runtime detail.

The first useful screenful should explain the product before listing headers,
environment variables, model defaults, or every tool.

## Product Capability Vocabulary

The first-time guide and user introduction should describe four clear
capabilities in human language:

### Memory

> Remember and retrieve durable facts, preferences, decisions, and prior
> knowledge when they matter.

Agent boundary:

- search before creating;
- update the same fact when appropriate;
- preserve historical state through supersede/links;
- do not write ordinary chat automatically.

### Shared Line

> Find where ongoing work stopped and continue without starting over.

Agent boundary:

- list/select the intended active line;
- read before updating;
- update after meaningful progress, handoff, or changed interpretation;
- never guess among multiple lines.

### InnerLife

> Keep and revisit background thoughts, then share them when they are useful
> and timely.

Agent boundary:

- the agent manages thought/share timing;
- do not frame InnerLife as a human review queue;
- do not automatically promote InnerLife output into Memory or Shared Line.

### Gateway And Diagnostics

> Check whether ClaraCore is connected and inspect bounded evidence when a
> tool call or runtime behavior fails.

Agent boundary:

- keep calls intentional and bounded;
- use product tools instead of mutating SQLite or inspecting packaged source;
- do not make diagnostics the main product story.

Do not lead a new user with Memoria/Continuity schema, MCP tool counts, tokens,
headers, records, embeddings, daemon controls, or maintenance operations.

## Required Proactive User Introduction

After a successful first connection, docs read, and context read, the agent
must proactively respond in the current conversation language. The user should
not have to ask “怎么用”.

Required content:

1. Truthful connection result.
2. The four capabilities above in concise user language.
3. A bounded summary of actual current context:
   - selected/available active Shared Line;
   - relevant recent Memory when present;
   - whether useful InnerLife context is available;
   - any ambiguity or unavailable module that materially affects use.
4. Three to five natural-language example requests.
5. One suggested next action based on real context, when evidence supports it.

Recommended shape:

```text
我已经接入 ClaraCore，并读取了使用说明和当前上下文。

我现在可以：
- 记住并检索长期有效的信息、偏好和决定；
- 找到共同线，从上次停下的位置继续；
- 在有实质进展后替你维护共同线；
- 保留并在合适时机分享内在活动中的想法；
- 检查连接和运行问题。

当前我找到：<truthful bounded context summary>。

你可以直接对我说：
- “记住这件事”；
- “接着上次的共同线继续”；
- “我们现在做到哪里了？”；
- “看看有没有相关记忆”；
- “检查一下 ClaraCore 是否正常”。

建议下一步：<evidence-backed suggestion or omit>。
```

Rules:

- This is a behavioral contract for the newly connected agent, not fixed UI
  copy rendered by Desktop.
- Use the user's current language.
- Translate capabilities into natural language; do not dump raw tool names.
- Do not claim a line, memory, thought, model, or health state that the tool
  responses did not return.
- Do not expose private raw context unnecessarily; summarize only what helps
  the user begin.
- If multiple Shared Lines require selection, explain that truthfully instead
  of guessing.
- If context is empty, say the connection works and explain what can be built
  from this point.
- If connection fails, do not send the success introduction; diagnose or give
  the one exact human action required.

## Current Implementation Surfaces

Primary renderer paths:

- `index.html`: two-column Agent Access layout, connected agents/activity,
  two copy actions, identity, token/folder controls, config/endpoint details,
  maintenance guide, and preview.
- `app/dom.js`: Agent Access DOM registry.
- `app/views/agent-setup.js`: current giant copied Markdown, connection modes,
  identity contract, recipes, full tool guidance, fallback commands, and copy
  action.
- `app/views/agent-setup.js` should remain responsible for current-runtime
  bootstrap material, but the copied result must become compact.
- `app.js`: Agent Access render integration, copy wiring, token rotation,
  endpoint/config copy actions, and Gateway folder action.
- `app/i18n/zh.js` and `app/i18n/en.js`: Agent Access, connections, copy,
  identity, token, endpoint, empty-state, and help text.

Primary styles:

- `styles/views/agent-setup.css`
- `styles/views/responsive.css`
- `styles/dark-fixes.css`
- `styles/views/product.css`

Gateway/onboarding contract paths:

- `core/gateway/tool-handlers/system.js`: `gateway_docs`,
  `claracore_connection_test`, and `gateway_context` handler routing.
- `core/gateway/tool-definitions/system.js`: agent-facing tool descriptions.
- `electron/http-agent-gateway.js`: authenticated `/agent/setup`,
  `connectionMode`, `firstCalls`, current endpoints, and Streamable HTTP MCP.
- `core/gateway/README.md`: Gateway runtime/startup contract.
- `docs/AGENT_MCP_PLAYBOOK.md`: durable external-agent playbook.
- `docs/MULTI_AGENT_CLIENT_MIGRATION_V0_5.md`: client migration details; keep
  it as reference, not primary onboarding copy.

Backend/settings capability to preserve:

- Streamable HTTP `/mcp` transport and token authorization.
- stdio Gateway configuration and packaged launch path.
- Gateway token persistence/rotation/update.
- configured localhost port behavior.
- agent/client/conversation identity headers and env variables.
- current Settings -> Agent Gateway port/token/config controls.
- Gateway traces and connected-agent aggregation.
- CLI fallback documentation for recovery agents.

## Current Contract Gaps To Fix

The implementation already has substantial documentation. Do not rebuild it
from scratch. Fix these concrete gaps:

1. The right panel exposes multiple equal-looking human choices.
2. `app/views/agent-setup.js` copies a very long reference rather than a
   compact bootstrap brief.
3. Product capabilities are buried after transport and identity detail.
4. `claracore_connection_test.next` currently skips `gateway_docs` and points
   directly to Shared Line/context.
5. There is no explicit contract requiring the connected agent to explain its
   capabilities to the user.
6. `/agent/setup`, Gateway docs, copied instructions, repository playbooks,
   and older wording contain sequence drift.
7. The page duplicates token/port/config operations that already belong in
   Settings.

## Suggested Implementation Sequence

1. Reconfirm repo truth and protect all existing v0.5.7 changes.
2. Add contract assertions for the canonical first-connection sequence and
   proactive user introduction before editing behavior.
3. Update `/agent/setup` and `claracore_connection_test` with aligned,
   structured next-step/user-handoff guidance while preserving existing fields
   where compatibility matters.
4. Reorder `gateway_docs` so First Connection, product capabilities, and Tell
   The User appear first; retain detailed reference below.
5. Align `core/gateway/README.md` and `docs/AGENT_MCP_PLAYBOOK.md`; remove
   contradictory startup-order wording.
6. Replace the giant copied Markdown with a compact current-runtime bootstrap
   brief containing the mandatory first-connection/user-introduction contract.
7. Simplify the right-side renderer to one explanation, one button, helper
   copy, and feedback.
8. Remove renderer-only wiring/DOM/copy for the second setup action, identity,
   token/folder controls, connection details, endpoint list, maintenance
   details, and preview. Preserve their backend/settings contracts.
9. Keep the left-side agent/activity renderer read-only and truthful.
10. Update Chinese and English together, then adjust responsive/dark styles.
11. Run automated validation and real Electron visual QA on isolated data.
12. Perform a real new-agent onboarding acceptance loop and capture its exact
    first response.

## Acceptance Criteria

- The Agent Access page exposes exactly one setup action to the human.
- No visible transport selector, config copy, command copy, identity editor,
  endpoint list, token rotation, runtime folder, maintenance disclosure, or
  giant guide preview remains on the page.
- Connected agents and recent activity remain visible, truthful, and read-only.
- The clipboard brief uses current runtime connection material and clearly
  prioritizes HTTP with stdio only as agent-selected fallback.
- A recipient agent can determine what to do without asking the user “which
  one should I use?”.
- When the agent cannot edit its own client configuration, it asks for one
  exact human action instead of returning vague MCP terminology.
- `claracore_connection_test` points first to `gateway_docs` and exposes a
  testable onboarding continuation.
- `/agent/setup`, copied instructions, `gateway_docs`, and maintained playbooks
  agree on the canonical startup sequence.
- `gateway_docs` explains the four product capabilities before detailed
  transport/tool/reference material.
- First-time instructions explicitly require a proactive user capability and
  current-context introduction.
- The introduction is grounded in real `gateway_context` results, uses the
  user's language, and offers natural-language example requests.
- Onboarding creates no Memory, Shared Line, or InnerLife user content merely
  from connecting/reading; expected Gateway handshake traces remain allowed.
- Existing Streamable HTTP, stdio, packaged Gateway, token persistence,
  settings, identity, MCP tools, and CLI fallback behavior remain intact.
- Chinese and English, light and dark themes, populated and empty states, and
  supported responsive widths work without overflow.
- Memory, Shared Line, InnerLife, Logs, Home, Settings semantics, and future
  Usage Imprint do not regress.

## Automated Validation

Use isolated data roots. Do not touch the daily-use database.

Minimum commands:

```bash
git diff --check
npm run check
npm run test:gateway:http
npm run test:phase4
npm run test:phase4:packaged
npm run test:shell
npm run test:ux:polish
```

The packaged Phase 4 command rebuilds the app and is slower. If it cannot be
run, state that clearly and do not claim packaged onboarding was verified.

Because shared renderer/i18n/style files overlap completed v0.5.7 work, rerun
the directly affected page baselines when those shared files change
non-trivially:

```bash
npm run test:phase2:ui
npm run test:phase3:ui
npm run test:phase4:trace-ui
npm run test:phase5:ui
```

### Required contract assertions

Add assertions that prove:

- `/agent/setup.firstCalls` begins the post-install flow with the connection
  test and includes `gateway_docs`, Shared Line selection, and context;
- `/agent/setup` exposes the after-connect/user-introduction requirement;
- `claracore_connection_test` returns successful identity/transport evidence,
  `nextCalls` beginning with `gateway_docs`, and an after-onboarding user
  handoff instruction;
- `gateway_docs` contains First Connection, the four capabilities, Tell The
  User, and current-context guidance before or independently of the full tool
  catalog;
- current runtime endpoint/config truth is used;
- stdio and Streamable HTTP return equivalent onboarding guidance;
- packaged Gateway includes the same guidance;
- onboarding reads do not create Memory, Shared Line, or InnerLife content;
- expected handshake/Gateway traces still appear.

### Required UI assertions

Add or update Electron coverage that proves:

- exactly one visible setup button exists;
- the removed controls/details/previews do not exist in the Agent Access DOM;
- copy is disabled or guarded while setup data is unavailable;
- clicking the one button copies the compact bootstrap brief;
- copied output contains the current connection material, canonical call
  sequence, and proactive user-introduction requirement;
- copied output does not contain the entire tool catalog or CLI/reference
  guide;
- copy success/failure feedback is announced;
- the left-side roster and recent activity remain visible;
- viewing, copying, changing theme/language, and navigating away/back do not
  mutate Memory, Shared Line, or InnerLife content;
- the page has no console errors or horizontal overflow.

## Real New-Agent Acceptance

Automated string assertions cannot prove that a real agent understands and
follows the onboarding contract. Complete one real acceptance loop using a
fresh client config, temporary agent identity, or otherwise isolated setup.

Acceptance scenario:

1. Start Desktop against an isolated data root with representative Memory,
   one or two active Shared Lines, and optional InnerLife state.
2. Copy the one Agent Access brief.
3. Give it to a new agent/client that has not been separately coached on
   ClaraCore.
4. Observe whether it selects/configures the supported MCP path or asks for
   one exact human configuration action.
5. Confirm it calls the canonical sequence.
6. Confirm Agent Access shows truthful handshake/activity evidence.
7. Inspect the agent's first user-facing response.

The first response passes only if it:

- says whether connection actually succeeded;
- explains Memory, Shared Line, InnerLife, and diagnostics in natural language;
- summarizes actual current context without inventing details;
- gives useful example requests;
- does not ask the user “how do I use ClaraCore?”;
- does not dump raw MCP tool names/configuration as the primary explanation.

Capture the client, transport, agent id, exact call sequence, and response
summary in the completion report. Do not use the user's daily data for this
test.

## Visual QA

Cover:

- Chinese light mode;
- Chinese dark mode;
- English light mode;
- Gateway ready;
- Gateway starting/unavailable;
- no connected agents and no activity;
- one recent agent;
- multiple agents with mixed recent/recorded/error calls;
- copy success and failure feedback;
- narrow responsive window;
- long agent/client/tool names;
- navigation away and back;
- no console errors and no horizontal page overflow.

## Completion Report

At implementation completion, report:

- what changed in the human Agent Access page;
- confirmation that exactly one setup action remains;
- what the compact copied brief contains and deliberately omits;
- how `/agent/setup`, `claracore_connection_test`, and `gateway_docs` were
  aligned;
- the exact proactive user-introduction contract;
- which backend/settings/transport capabilities were preserved;
- automated commands and exact results;
- visual QA scenarios and result;
- the real new-agent acceptance client, transport, call sequence, and first
  response result;
- anything not validated;
- confirmation that Home and Usage Imprint were not changed;
- final git status, with no commit/push claim unless actually performed.
