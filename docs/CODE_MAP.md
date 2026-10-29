# Code map

Start with the owner of the behavior you want to change.

| Task | Entry points |
| --- | --- |
| App lifecycle, tray, paths | `electron/main.js`, `core/runtime/` |
| Privileged renderer operations | `electron/preload.js`, `electron/ipc-handlers.js`, `electron/ipc-contracts.js` |
| Desktop rendering and navigation | `app.js`, `app/`, `styles/`, `index.html` |
| Home presence | `app/views/home.js`, `app/views/home-presence.js`, `app/views/home-vision.js` |
| Memory behavior | `core/memoria/`, `core/db/repositories/memoria*` |
| Shared Lines and agent state | `core/continuity/`, `core/db/repositories/continuity/` |
| Desktop scoped catalogs and original-text reads | `core/desktop-readers.js`, `app/innerlife-actions.js`, `app/shared-line-actions.js` |
| InnerLife behavior | `core/innerlife/`, `core/db/repositories/innerlife/` |
| Knowledge reader and intake | `core/knowledge/`, `app/views/knowledge.js`, `app/knowledge-markdown.js` |
| MCP tools and compatibility | `core/gateway/`, `electron/http-agent-gateway.js` |
| Context selection | `core/memory-controller/`, `core/gateway/auto-context*` |
| Understanding and host bridge | `core/gateway/understanding/`, `scripts/understanding-host.mjs` |
| SQLite schema and ownership | `core/db/`, `core/runtime/product-core-owner.js` |
| Background work | `electron/schedulers.js`, domain services |
| Tests | `core/tests/`, `core/tests/fixtures/` |
| Brand and installers | `assets/`, `scripts/*builder-config.js`, `package.json` |
| Project website | `website/`, `scripts/build-website.js` |

Use `rg --files` and `rg -n` to find the exact implementation before editing;
some repository families use facade files alongside directories. Module
READMEs explain finer ownership boundaries.

Keep domain policy in the core, routing in Gateway/IPC, and presentation in the
renderer. A new list should have a bounded projection and pagination contract.
A new long-lived resource needs an owner and a release path. See
[Architecture](ARCHITECTURE.md) and [Contributing](../CONTRIBUTING.md).
