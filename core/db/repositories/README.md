# Database Repositories

Repository modules own table-level persistence APIs behind `ProductDatabase`.

Current split:

- `memoria.js`: Memoria CRUD, labels, graph, records, search, maintenance, and embeddings.
- `continuity.js`: Shared Line, current position, history, handoffs, agent state, model adjustments, shared-reality/affective arc lifecycle (cap, truncation, compaction), resume packet, and gateway context.
- `innerlife.js`: InnerLife profiles, daemon state, inbox, sessions, shares, digest, exploration, convergence, history/experiences/summaries, model-backed generation, and review flow.

Product decisions belong in `core/memoria`, `core/continuity`, and
`core/innerlife`. Repositories should stay close to persistence and SQL.
