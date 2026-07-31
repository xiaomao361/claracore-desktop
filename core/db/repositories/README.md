# Database Repositories

Repository modules own table-level persistence APIs behind `ProductDatabase`.

Current split:

- `memoria.js`: Memoria CRUD, labels, graph, records, search, maintenance, and embeddings.
- `continuity.js`: Shared Line, current position, history, handoffs, agent state,
  model adjustments, shared-reality/affective arc lifecycle (cap, truncation,
  compaction), and resume packet persistence.
- `innerlife.js`: composition root for InnerLife repositories and explicit
  domain-service ports.
- `innerlife/daemon.js`: daemon state and tick-transition persistence. Tick
  orchestration lives in `core/innerlife/services/daemon-tick.js`.
- `innerlife/session-store.js`: private session and persisted-afterthought SQL
  adapter, including atomic due-time claim, retry metadata, terminal failure,
  and success cleanup. Session lifecycle policy lives in
  `core/innerlife/services/session-lifecycle.js`; `innerlife/sessions.js`
  preserves the public database API as a thin adapter.
- `innerlife/workflow-wiring.js`: focused composition for digest-run and
  share-timing services. Their private `digest-run-store.js` and
  `share-timing-store.js` adapters own compound persistence while
  `innerlife/digests.js` and `innerlife/shares.js` preserve the public API.
- `memory-controller.js`: append-only controller decisions and feedback,
  bounded audit queries, and feedback-aware retention. It must not mutate
  Memoria, Shared Line, or InnerLife semantic state.
- `system/agent-identity.js`: atomic cross-domain Agent identity migration.
  Singleton profile, daemon, and Continuity rows move only when the target is
  absent or deduplicate when both sides are semantically equivalent; differing
  rows return field-level conflicts without mutating or deleting the source.

Product decisions belong in `core/memoria`, `core/continuity`, and
`core/innerlife`. Repositories should stay close to persistence and SQL.
Cross-domain Gateway context assembly belongs in `core/gateway/context.js`,
which composes the three domain facades without adding repository ownership.
InnerLife repository modules must remain acyclic; workflow services may compose
repository capabilities only through explicit ports wired at the composition
boundary.
