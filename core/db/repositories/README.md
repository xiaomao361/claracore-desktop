# Database Repositories

Repository modules own table-level persistence APIs behind `ProductDatabase`.

Current split:

- `memoria.js`: Memoria CRUD, labels, graph, records, search, maintenance, and embeddings.
- `continuity.js`: Shared Line, current position, history, handoffs, agent state, model adjustments, shared-reality/affective arc lifecycle (cap, truncation, compaction), resume packet, and gateway context.
- `innerlife.js`: composition root for InnerLife repositories and explicit
  domain-service ports.
- `innerlife/daemon.js`: daemon state and tick-transition persistence. Tick
  orchestration lives in `core/innerlife/services/daemon-tick.js`.
- `innerlife/session-store.js`: private session and persisted-afterthought SQL
  adapter. Session lifecycle policy lives in
  `core/innerlife/services/session-lifecycle.js`; `innerlife/sessions.js`
  preserves the public database API as a thin adapter.
- `innerlife/workflow-wiring.js`: focused composition for digest-run and
  share-timing services. Their private `digest-run-store.js` and
  `share-timing-store.js` adapters own compound persistence while
  `innerlife/digests.js` and `innerlife/shares.js` preserve the public API.
- `memory-controller.js`: append-only controller decisions and feedback,
  bounded audit queries, and feedback-aware retention. It must not mutate
  Memoria, Shared Line, or InnerLife semantic state.

Product decisions belong in `core/memoria`, `core/continuity`, and
`core/innerlife`. Repositories should stay close to persistence and SQL.
InnerLife repository modules must remain acyclic; workflow services may compose
repository capabilities only through explicit ports wired at the composition
boundary.
