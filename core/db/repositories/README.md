# Database Repositories

Repository modules own table-level persistence APIs behind `ProductDatabase`.

Current split:

- `memoria.js`: Memoria CRUD, labels, graph, records, search, maintenance, and embeddings.
- `continuity.js`: Shared Line, current position, history, handoffs, agent state, model adjustments, shared-reality/affective arc lifecycle (cap, truncation, compaction), resume packet, and gateway context.
- `innerlife.js`: composition root for InnerLife repositories and explicit
  domain-service ports.
- `innerlife/daemon.js`: daemon state and tick-transition persistence. Tick
  orchestration lives in `core/innerlife/services/daemon-tick.js`.
- `memory-controller.js`: append-only controller decisions and feedback,
  bounded audit queries, and feedback-aware retention. It must not mutate
  Memoria, Shared Line, or InnerLife semantic state.

Product decisions belong in `core/memoria`, `core/continuity`, and
`core/innerlife`. Repositories should stay close to persistence and SQL.
