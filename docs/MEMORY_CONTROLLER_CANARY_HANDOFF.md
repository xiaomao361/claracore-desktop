# Memory Controller Trusted Context Canary Handoff

## Status

- Decision date: 2026-07-23
- Status: Multi-Agent pull-mode Gateway canary and bounded Codex host injection implemented and validated; delivery/usage feedback not started
- Target repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Current development version: `0.6.4`
- Current public stable version: `0.6.3`
- Eligible Agents: every identified authenticated Agent, isolated by `agentId`

This handoff defines the next smallest verified loop for turning the existing
observe-only Memory Controller into a trusted Agent context layer. Source
support now covers every authenticated Agent, and the owner-installed live
canary has been validated for Codex and Clara. This does not authorize a public
release, deployment, or automatic Memory mutation.

## Working Tree Boundary

At this closeout start, `main` and `origin/main` both pointed to
`9d4759c3e8ba1dd9593b66a6e7852ad4889057d7`. The intended checkpoint contains
only:

- `core/memory-controller/controller.js`
- `core/memory-controller/README.md`
- `core/tests/memory-controller-gateway-smoke.js`
- `docs/MEMORY_CONTROLLER_CANARY_HANDOFF.md`
- `docs/RELEASE_NOTES_V0.6.4.md`

The global Codex hook is user-level integration outside this repository, so
the source commit cannot distribute it with the Desktop App.

The validated owner installation is:

```text
/Applications/ClaraCore Desktop.app
```

It is an unsigned arm64 Lite App, approximately 293 MiB, with packaged
`app.asar` SHA-256
`8ab012e13fcd3affadad8b263be1eb32dbc62b8f1bcc3ef5d86e7b6fb8bd9833`.
It is not a DMG, GitHub Release, update-channel artifact, or public stable
release.

## Product Outcome

The Controller should make a bounded piece of trusted prior context available
to an Agent when the current request explicitly depends on a prior decision,
continuation point, or reusable piece of formed knowledge.

The first canary succeeds when a relevant Memory can influence one Agent answer
without crossing Agent, sensitivity, lifecycle, ambiguity, or context-budget
boundaries, and when the delivery and actual use remain auditable.

This is an Agent context capability. Do not add a new human dashboard or a new
semantic storage system.

## Confirmed Product Decisions

The first canary is deliberately narrow:

1. Make pull-mode canary context available to every identified authenticated
   Agent; preserve an explicit allowlist so an operator can narrow the rollout.
2. Trigger only on explicit history, prior-decision, continuation, or reusable
   knowledge requests already recognized by Stage A.
3. Start with confirmed project decisions, engineering experience, and
   knowledge-card pointers.
4. Do not include relationship, affective, intimate, or personal-preference
   Memory in the first canary.
5. Retrieve only the authenticated Agent's eligible `current`,
   `normal`-sensitivity Memory.
6. Inject at most one high-confidence candidate.
7. Keep the existing 600-token target and 900-token hard cap.
8. Keyword-only, weak, ambiguous, restricted, archived, superseded, deleted,
   wrong-Agent, wrong-time-view, or over-budget results must abstain.
9. Preserve a configuration-first kill switch back to `observe`.
10. Do not mutate Memoria, Shared Line, InnerLife, labels, links, or Memory
    lifecycle state from a read or feedback path.

## Trust Boundary

An acceptable canary miss is:

- a relevant but redundant Memory is delivered;
- the Agent reviews it and does not use it;
- the answer remains correct and the event remains `ignored` or `unknown`.

Unacceptable failures are:

- another Agent's or restricted Memory crosses the boundary;
- a historical or superseded fact is presented as current truth;
- a keyword-only, weak, or ambiguous candidate is injected;
- Memory silently overrides current repository, runtime, data, or user
  evidence;
- an injected Memory causes a code, release, production, or destructive action
  without current verification;
- the system claims `used` without evidence from the actual response.

Fail closed on eligibility and confidence. Fail open for the user turn: timeout,
Gateway failure, schema failure, audit failure, or hook failure must return
context-free behavior and must not block the prompt.

## Current Implementation Truth

Most of the deterministic core already exists:

- `core/memory-controller/stage-a.js`
  - decides `NOOP` or `RETRIEVE`;
  - contains opt-out and current-turn negative rules before positive history
    and continuation rules.
- `core/memory-controller/stage-b.js`
  - filters and ranks at most three candidates;
  - rejects keyword-only, low-score, low-margin, ineligible, restricted, and
    over-budget candidates;
  - recommends `INJECT_TOP1` only for one high-confidence candidate.
- `core/memory-controller/controller.js`
  - already supports internal `off`, `observe`, and `canary` modes;
  - returns real context only in internal `canary`;
  - owns the 2500 ms timeout, bounded cache, audit event, and context formatter.
- `core/db/repositories/memory-controller.js`
  - already stores events and feedback;
  - supports `delivered`, `used`, `ignored`, `wrong`, `corrected`,
    `task_succeeded`, `task_failed`, and `outcome_unknown`;
  - protects feedback-bearing events from capacity cleanup.
- `core/gateway/tool-handlers/memory-controller.js`
  - now accepts persisted `off`, `observe`, or `canary`;
  - uses the persisted `memory.controller.canary_agent_ids` allowlist;
  - returns context only for an allowlisted authenticated Agent using
    `timeView=current`;
  - leaves non-allowlisted and historical/all callers effectively observe-only;
  - binds Agent identity to authenticated Gateway transport.
- `core/gateway/tool-definitions/memory-controller.js`
  - exposes the authenticated `memory_context` contract for off, observe, and
    allowlisted trusted-canary evaluation;
  - does not expose `memory_context_feedback`.
- `/Users/zhouwei/.codex/hooks/claracore-desktop/hook.mjs`
  - calls `memory_context` on every non-empty `UserPromptSubmit`;
  - appends the returned bounded context to `additionalContext` only when the
    Gateway call succeeds with `policyMode=canary`, `action=INJECT_TOP1`, and a
    non-empty context;
  - records only bounded decision metadata and does not infer delivery or
    usage feedback.

Do not duplicate policy, ranking, thresholds, or eligibility checks in the
Codex hook. The Desktop Controller remains the only retrieval-control owner.

## Required End-to-End Contract

The desired first-canary flow is:

```text
Codex UserPromptSubmit
  -> authenticated memory_context(prompt)
  -> Stage A NOOP or RETRIEVE
  -> bounded Memoria retrieval
  -> Stage B ABSTAIN or INJECT_TOP1
  -> canary allowlist check
  -> one bounded read-only context block
  -> Codex additionalContext
  -> response completion evidence
  -> delivered / used / ignored / wrong / corrected feedback
  -> Trace inspection
```

The injected block must:

- include `decisionId` and selected Memory id for evidence plumbing;
- state that the content is prior evidence, not current truth;
- instruct the Agent to verify current code, runtime, data, and user statements;
- prohibit semantic writes caused solely by the injected block;
- avoid mutation instructions or hidden expansion requests;
- appear at most once per prompt.

Recommended conceptual wrapper:

```text
[ClaraCore prior context - read-only evidence]
Decision: <decision id>
Memory: <memory id and title>
Content: <bounded body>
Instruction: Use only if relevant. Verify against current evidence. Do not
mutate Memory or treat this block as current runtime truth.
```

The final wording may be compacted, but those semantics must remain.

## Disclosure And Feedback

Use conditional natural disclosure:

- If the Memory materially influences the answer, the Agent should say one
  short natural sentence such as:

  > 我参考了我们之前定下的“Desktop 保持 Agent First”这个决定。

- If the Agent reviews but does not use the Memory, normal conversation should
  remain quiet.
- Technical ids, scores, margins, policy reasons, and timing belong in Trace,
  not in the user-facing sentence.

Do not infer `used` merely because context was delivered. Record:

- `delivered` only after the host actually emitted the context block;
- `used` only with evidence from the actual response;
- `ignored` when the Agent explicitly reviewed and did not use it;
- `wrong` when the injected Memory was incorrect, irrelevant in a harmful way,
  or caused a wrong answer;
- `corrected` when a later response explicitly repairs a wrong use;
- `outcome_unknown` when the host cannot prove the result.

The repository has a feedback table but no Agent-facing feedback Gateway tool.
Add and validate that contract before claiming a usage loop.

Response-completion evidence is an implementation risk. Prove what the Codex
`Stop` payload actually contains before depending on it. If the host cannot
provide the final response and identifiers reliably, record `delivered` and
leave usage `unknown`; do not synthesize evidence from intent or planned text.

## Recommended Implementation Slices

### Slice A: effective canary mode — implemented and owner-validated

Add one persisted, inspectable configuration boundary for a canary with an
explicit Agent allowlist.

Required behavior:

- fresh and upgraded installs remain `off`;
- existing `observe` behavior is unchanged;
- `["*"]` means every identified authenticated Agent can receive canary context;
- explicit Agent ids can replace the wildcard for a narrower rollout;
- non-allowlisted Agents remain observe-only even when the canary is enabled;
- invalid modes or malformed allowlists fail closed;
- Settings and Agent Access describe the effective boundary truthfully.

Keep the wildcard inside the explicit allowlist contract rather than bypassing
Gateway identity, Stage A, Stage B, or Controller policy.

### Slice B: Gateway context delivery — implemented and owner-validated

Allow `memory_context` to pass through the Controller's context only when all
of these are true:

- persisted canary mode is valid;
- authenticated Agent is allowlisted;
- Stage A returns `RETRIEVE`;
- Stage B returns `INJECT_TOP1`;
- the ledger event was written successfully;
- returned context is non-empty and within budget.

Every other path returns an empty context.

### Slice C: Codex hook injection — implemented and validated

The Codex `UserPromptSubmit` path appends the returned bounded context to
`additionalContext` only for a valid canary packet.

The hook must:

- stay fail-open;
- never run an independent Memoria search;
- never recalculate ranking or confidence;
- never trust a body-supplied Agent id;
- avoid duplicate injection when selective Shared Line or InnerLife context is
  also present;
- log only bounded ids/action/reason, not private Memory bodies.

The implementation was validated with an isolated hook state directory against
the explicitly enabled live canary Gateway: a high-confidence prompt produced
one read-only context block, while an ordinary current-turn prompt produced no
Memory block. The validation did not submit feedback or mutate semantic Memory
state.

Installed-runtime acceptance also proved:

- Codex injected the expected same-Agent stable-release Memory at score
  `0.7694336107196864`;
- an ordinary Codex prompt remained `NOOP` with no context;
- Clara injected the expected same-Agent `product-decision` Memory at score
  `0.7887356419240835`;
- the global Codex hook emitted exactly one read-only block for the hit and no
  Memory block for the miss.

### Slice D: feedback and delivery evidence — not started

Add `memory_context_feedback` to Gateway definitions and handlers.

Validate:

- authenticated caller owns the referenced decision;
- supplied Memory ids are a subset of the decision's injected ids;
- `used`, `wrong`, and `corrected` require response evidence;
- `delivered` requires a host delivery receipt;
- idempotency prevents duplicate Stop/retry writes;
- no feedback operation mutates semantic Memory state.

### Slice E: Trace evidence — not started

Reuse Trace > Advanced. Do not create a new page.

Show bounded raw evidence for:

- selected;
- injected;
- delivered;
- used;
- ignored;
- wrong;
- corrected;
- unknown.

Do not show success percentages for the first 10-20 real prompts. Report raw
counts and concrete examples because the sample is too small for statistical
claims.

## Validation Matrix

At minimum, add or update isolated tests for:

| Area | Required proof |
| --- | --- |
| Config | default off, observe unchanged, all-authenticated wildcard, explicit narrow allowlist, malformed input rejected |
| Stage A | explicit prior decision/continuation/reuse triggers; ordinary and opt-out turns do not |
| Stage B | top-1 only; weak, ambiguous, keyword-only, restricted, stale, wrong-scope, and over-budget abstain |
| Gateway | multiple authenticated Agents get only their own context in canary; non-allowlisted callers get empty context |
| Hook | exactly one bounded additional-context block; NOOP/ABSTAIN/error inject nothing |
| Fail-open | timeout, Gateway error, audit failure, and hook error do not block the prompt |
| Feedback | delivery and response evidence enforced; ids and Agent ownership checked; retries idempotent |
| Semantics | no Memory, Shared Line, InnerLife, label, link, or lifecycle mutation |
| Trace | raw state is truthful and remains bounded |
| Backup | new settings and feedback continue to survive backup/export/import |

Run the focused Controller, Gateway, hook, Trace, backup, and Lite checks before
the broad repository gate. Use:

```bash
npm run check
npm run test:memory-controller
npm run test:trace
npm run test:backup
npm run test:lite
git diff --check
```

Run broader Phase 2/4 or full smoke only when the changed paths require them.
Build or install a new App only after source and isolated-runtime acceptance.

## First Real Canary Acceptance

After isolated tests pass, the owner may explicitly enable a local canary. A
host hook is optional for explicit pull-mode use and required only for automatic
per-prompt injection.

Use 10-20 real prompts. The first evaluation should report raw examples and
counts, not percentages.

Minimum acceptance:

1. At least one relevant prior project decision or knowledge card is delivered
   and materially helps an answer.
2. No wrong-Agent, restricted, historical-as-current, weak, ambiguous, or
   keyword-only Memory is injected.
3. Every injected event has a fresh decision id and a delivery state.
4. Every claimed `used`, `wrong`, or `corrected` outcome has actual response
   evidence.
5. The user turn remains usable when the Controller times out or fails.
6. Returning to `observe` immediately restores context-free behavior.

Do not call the canary successful merely because Stage B selected a candidate
or because the hook emitted context.

## Explicit Non-Goals

This handoff does not authorize:

- enabling live canary for any Agent without an explicit owner decision;
- relationship, affective, intimate, or personal-preference injection;
- multiple Memories or one-hop graph expansion;
- learned policy, bandit, replay, exploration, or automatic stuck detection;
- automatic Memory creation, merge, supersede, restriction, archive, delete,
  or link mutation;
- a new Memory Controller page;
- silent release, push, tag, DMG publication, deployment, or update-channel
  publication.

## Stop Conditions

Stop and report rather than broadening scope if:

- Codex response-completion evidence cannot be obtained reliably;
- canary requires trusting body identity instead of Gateway identity;
- the hook would need its own ranking or eligibility policy;
- a test can only be run against the live product database;
- implementing Agent-specific modes requires an unreviewed configuration
  redesign;
- any wrong-scope or restricted Memory crosses the boundary;
- unrelated working-tree changes overlap the required files.

## Continuation Prompt

Use this in the next development session:

```text
继续 ClaraCore Desktop Memory Controller trusted context canary。

先读：
- AGENTS.md
- docs/MEMORY_CONTROLLER_CANARY_HANDOFF.md
- docs/V0.6.0_MEMORY_CONTROLLER_PLAN.md
- core/memory-controller/README.md
- 当前 git status 和现有未提交改动

Gateway multi-Agent pull-mode canary、owner live canary 和 Codex hook 注入已完成
并验证。下一轮先证明 Codex Stop/response-completion payload 是否可靠包含最终
回答与当前 decision id；在这个证据成立前，不要实现 used/wrong/corrected 自动
反馈。不要发布；若证据不足，只允许设计 delivered/outcome_unknown 的保守路径。
```
