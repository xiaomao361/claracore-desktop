# Architecture

ClaraCore Desktop is a standalone Electron application. The renderer displays
state; the main process owns privileged operations and the local MCP listener;
the product core owns domain behavior and persistence.

![Client and domain flow](images/how-it-works.svg)

## Runtime ownership

`electron/main.js` manages application lifecycle, windows, tray integration,
IPC registration, and runtime services. `core/runtime/product-core-owner.js`
owns the shared product-core connection and generation-safe reset path.
Restore, import, and root changes release the replaced resources rather than
leaving a second live database owner.

The Streamable HTTP Gateway shares this product core. It does not start a
separate database process per client. Its normal loopback port is `50668`.
Background schedulers have explicit stop paths; see [Runtime memory policy](RUNTIME_MEMORY_POLICY.md).

## Renderer and IPC

`index.html`, `app.js`, `app/`, `styles.css`, and `styles/` provide the desktop
interface without a frontend bundler. The preload exposes focused IPC methods;
renderers do not directly read SQLite or arbitrary files. Domain pages load
bounded data when needed instead of hydrating the entire database on refresh.
Knowledge HTML is escaped and links use scoped resolution.

## Domains and storage

| Domain | Ownership |
| --- | --- |
| Memoria | Memories, status, embeddings, labels, links, and retention. |
| Continuity | Agent state, Shared Lines, positions, history, and handoffs. |
| InnerLife | Sessions, inbox, candidate review, generation, sharing, and daemon choices. |
| Knowledge | Selected-directory Markdown, attribution, intake, and rebuildable indexes. |
| Memory Controller | Bounded recall selection, delivery policy, and its evaluation ledger. |

SQLite access and migrations live in `core/db/`. Domain facades compose focused
repositories and services. Structured data uses the Desktop-owned database;
Knowledge source Markdown remains the authority for source bodies.

## Gateway contracts

`core/gateway/` defines tools, profiles, handlers, projection budgets, and
explicit understanding planning/recovery. Handlers call domain facades rather
than duplicating storage policy. Profiles control advertised schemas, not
permissions. Identity separates agent persona, host client, and conversation.

The optional understanding journal records execution evidence. It is not a
fifth source of business facts and does not provide a cross-domain atomic
transaction. See [Understanding](UNDERSTANDING_CONTRACT.md).

## Failure and recovery

Preserve no-results, unavailable, partial, conflict, and failed as distinct
outcomes. A write with uncertain acknowledgement must be inspected before
retrying. Recovery relies on stable references, hashes, operation IDs, and the
original authorization. Backups and Markdown recovery copies have separate
coverage; see [Configuration](CONFIGURATION.md).

## Packaging

Electron Builder packages the app, renderer, core, and brand assets. Full
includes the local embedding model; Lite omits it. Platform resources include
SQLite and sqlite-vec support. Website files and project documents are not
application runtime dependencies. See [Packaging](mac-packaging.md).
