# Memory Controller

This directory owns the Desktop retrieval-control policy. It does not store or
mutate semantic Memory state.

Slice 0 contains only the deterministic pre-retrieval gate and replayable
fixtures. Run:

```bash
npm run test:memory-controller
```

The suite prints raw confusion matrices for the Stage A policy, the fixed
always-retrieve baseline, and the narrow explicit-search baseline. It also
replays real-shaped current, historical, restricted, conflicting,
knowledge-card, archived, and linked-neighbor reads against an isolated
temporary Desktop database. Token counts are intentionally rough estimates for
baseline comparison; release context caps will be enforced by the Slice 1
formatter.

An existing product database can be summarized without running a new search or
reading prompt/response content:

```bash
npm run baseline:memory-controller:live -- --db "/path/to/claracore.db"
```

This command opens SQLite read-only and reads only `duration_ms`, `status`, and
timestamps from existing `memoria_search` Gateway traces.

Policy rules stay human-readable and versioned in `stage-a.js`. Rule order is
part of the contract: opt-out and current-turn near misses run before positive
history and continuation signals.

## Bounded retrieval cache

`cache.js` owns only short-lived retrieval candidates. Its stable key includes
the normalized query hash, agent and sensitivity scope, time view, policy
version, retrieval parameters, and the current Memoria mutation watermark.
Entries have explicit TTL, count, byte, and three-candidate caps; there is no
background timer.

A candidate-bearing hit is valid only after the caller rechecks all candidate
ids through `getMemoryControlEligibleIds`. Missing, restricted, archived,
superseded, deleted, wrong-agent, or wrong-time-view candidates invalidate the
entry and return a safe miss. The cache rejects decision ids: orchestration must
write a new controller event for every turn, including cache hits.

## Deterministic orchestration

`controller.js` owns the Stage A → bounded retrieval/cache → Stage B → ledger
path. It requires a trusted Agent id, uses a 2500 ms maximum retrieval timeout,
and degrades timeout, search, schema, or audit failures to a context-free
`NOOP`. Stage A `NOOP` never calls Memoria.

`stage-b.js` contains the initial conservative ranking policy and context
formatter. Weak vector results, ambiguous leaders, restricted/ineligible rows,
and insufficient budgets abstain. Selected context defaults to one Memory,
targets at most 600 estimated tokens, and is hard-capped at 900. Observe mode
records the prospective Stage B action but returns an empty context and no
injected ids. Canary formatting remains a core-only contract; the Gateway is
fixed to observe mode in this slice.

## Observe-only Gateway

The `memory_context` MCP operation exposes this controller over stdio and
Streamable HTTP without enabling injection. It accepts the prompt, time view,
and context budget only; Agent, client, and conversation identity come from the
Gateway transport. Unidentified callers receive a context-free refusal, and
body-supplied Agent ids cannot override the transport caller. Controller
instances are reused per product database so the bounded cache survives across
tool calls.
