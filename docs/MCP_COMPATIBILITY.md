# MCP profiles and compatibility

The default `core` profile exposes 25 everyday tools. `core-compat` exposes the
previous 38-tool core catalog. `full` exposes 83 canonical tool contracts,
including maintenance and specialist operations.

Set `X-ClaraCore-Tool-Profile` to `core`, `core-compat`, or `full`, then reconnect
the client. Unknown or missing values resolve to `core`. A client should not
assume live catalog refresh. `claracore_connection_test` reports the resolved
profile; `gateway_docs` describes specialist routes.

Profiles control discovery and schema size. They are not an authorization
boundary: authenticated clients can call tools outside their advertised catalog.

## Legacy tool names

Sixteen retired names remain callable adapters. They dispatch to the canonical
handlers with preserved operation semantics and return compatibility metadata.
Use the indicated replacement and arguments when migrating an integration.
The executable routing table is
[`tool-compatibility-routes.js`](../core/gateway/tool-compatibility-routes.js).
The regression fixture
[`mcp-capability-map.json`](../core/tests/fixtures/mcp-capability-map.json)
records all 97 historical tools and their replacements.

Do not remove an adapter solely to reduce a tool count. Retirement requires
verified caller migration and an explicitly planned compatibility break.
Schemas, fixed arguments, ownership, failure states, and source attribution
must be preserved during migration.

## Transport

Streamable HTTP supports MCP `2026-07-28` and `2025-06-18`. Stdio is retired.
See [HTTP migration](HTTP_MCP_MIGRATION.md) and
[Multi-client identity](MULTI_AGENT_CLIENTS.md).
