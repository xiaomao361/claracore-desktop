# Version Branching

## Current Baseline

- `main` is the working Desktop line.
- `package.json` is the product-version source through `core/version.js`.
- The current local version is `0.4.7`.
- Historical `0.1.x` and `0.2.x` planning notes are archived under
  `docs/archive/`.

## Isolated Development

Use the next-version launcher for manual development:

```bash
npm run start:next
```

That command sets:

```text
CLARACORE_DESKTOP_DATA_DIR=~/Library/Application Support/claracore-desktop-next/data
CLARACORE_DESKTOP_TEST_INSTANCE=1
```

The separate data root keeps development builds from writing the daily-use
product database. The test-instance flag also avoids colliding with the normal
app's single-instance lock while the stable app is open.

Automated smoke tests already create temporary data roots under `/tmp` through `CLARACORE_DESKTOP_DATA_DIR`. Keep new tests on the same pattern unless the test is explicitly checking migration from a real backup.

For packaged release checks, keep using:

```bash
npm run pack:mac
npm run dist:mac
```

Only install or replace the daily-use app after the target build passes the
focused smoke gates for its changed surface.

## v0.4.7 Checkpoint

`0.4.7` is an architecture-truth and maintainability checkpoint:

- Fresh installs treat the built-in Memory embedding provider as healthy, and
  every Home status surface consumes the same actionable-attention result.
- Runtime diagnostics are collapsed when healthy and expand automatically when
  an actionable warning or error exists.
- Database upgrades run through ordered before/after-schema migration modules
  and record successful ids in `schema_migrations`.
- `runtimeChanged` events carry scopes, so unrelated background activity does
  not reset focused Memory view state.
- Electron IPC names are checked against one 86-channel registry without
  weakening the sandboxed preload boundary.
- `gateway_context` routes through the Continuity domain facade.
- Identified agents no longer select the most recently updated Shared Line when
  more than one active line exists. Read, context, and update calls fail closed
  with `SHARED_LINE_ID_REQUIRED` and candidate ids until the caller supplies an
  explicit `lineId`; rejected updates perform no write.

Validation for this checkpoint includes:

```bash
npm run test:smoke
npm run pack:mac
```

## v0.4.6 Checkpoint

`0.4.6` trims MCP payload weight and adds InnerLife data hygiene, following the
`0.2.6` lite-contract precedent:

- `innerlife_status` now returns a lite snapshot by default (counts, pending
  share previews, daemon, doctor). The previous full snapshot (~400KB on a
  lived-in database: sessions with briefings, digest runs, history) is still
  available via the new `detail=true` parameter.
- Every MCP path that used to echo the full InnerLife snapshot as a side
  payload (`innerlife_submit_inbox` / `_fact` / `_continuity`,
  `innerlife_share_check`, `innerlife_digest`, `innerlife_explore`,
  `innerlife_converge`, process-once) now returns the lite snapshot instead.
  The Desktop UI keeps using the full snapshot.
- `innerlife_digest_runs` rows are pruned after each digest to the most recent
  200 per agent (`pruneInnerLifeDigestRuns`), so daemon ticks no longer grow
  the table without bound.
- `innerlife_session_start` no longer mixes archived Shared Lines into its
  bundled `shared_lines` listing; it now requests active lines only.
  `shared_line_list` gained an explicit `status` filter
  (`active` / `archived` / `all`) that was already supported by the repository
  layer but not exposed in the tool schema.

Validation for this checkpoint:

```bash
npm run check
node core/tests/phase4-gateway-contract-smoke.js
node core/tests/phase5-innerlife-smoke.js
node core/tests/sql-interpolation-lint.js
git diff --check
```

## v0.4.5 Checkpoint

`0.4.5` hardens the Streamable HTTP Gateway and Shared Line scoping introduced
in `0.4.2`–`0.4.4`:

- A persisted or user-entered Gateway port of `0` is now treated as a stale
  placeholder and falls back to the stable default (`50668`) on the non-explicit
  path, instead of silently binding a fresh random port. Random binding remains
  reserved for the explicit `CLARACORE_DESKTOP_HTTP_PORT` / test-instance path.
- The `OPTIONS` preflight reply is now a bodyless `204` (was a `204` carrying a
  JSON body).
- `getResumePacket` no longer materializes a Shared Line as a read-side effect:
  it resolves the caller's line read-only, so anonymous HTTP reads
  (session_start, tool calls) can no longer accumulate empty lines. A dedicated
  line is still created on the first write through `saveCurrentPosition`.
- Unidentified HTTP callers (the `http-agent` sentinel) no longer mint a
  dedicated `http-agent Shared Line`; they fall back to the default line.

Validation for this checkpoint:

```bash
npm run check
node core/tests/streamable-http-gateway-smoke.js
node core/tests/phase3-shared-line-smoke.js
node core/tests/phase5-innerlife-smoke.js
node core/tests/sql-interpolation-lint.js
git diff --check
```

## v0.4.4 Checkpoint

`0.4.4` fixes multi-agent Shared Line ownership after Streamable HTTP:

- `shared_line_get` and `shared_line_update` now use the caller agent identity
  when no explicit `lineId` is supplied.
- Each agent gets its own active Shared Line on demand; the global default line
  remains a fallback only when no agent identity is present.
- InnerLife briefing, digest, process-once, share timing, and share-to-line
  application read/write Shared Line context through the same agent scope.

Validation for this checkpoint:

```bash
npm run check
node core/tests/phase3-shared-line-smoke.js
node core/tests/phase5-innerlife-smoke.js
node core/tests/streamable-http-gateway-smoke.js
git diff --check
```

## v0.4.3 Checkpoint

`0.4.3` makes the stable Streamable HTTP MCP connection user-configurable:

- The default localhost MCP endpoint is `http://127.0.0.1:50668/mcp`.
- Settings > General > Agent Gateway exposes the current localhost port, bearer
  token, endpoint, and token file.
- The user can generate a random token, save a new token, or move the Gateway
  to a different available port.
- Agent Access and Settings copy blocks now include the endpoint, bearer header,
  agent/session headers, token file, and Codex CLI example instead of only a
  bare URL.
- Saving the Gateway config refreshes the running MCP server and renderer
  snapshot.

Validation for this checkpoint:

```bash
npm run check
node core/tests/streamable-http-gateway-smoke.js
node core/tests/run-ui-smoke.js core/tests/phase4-gateway-trace-ui-smoke.js
git diff --check
```

## v0.4.2 Checkpoint

`0.4.2` stabilizes Streamable HTTP MCP for daily use:

- The localhost MCP endpoint uses a stable default port instead of a new random
  port on every app restart.
- The bearer token is persisted in the local `agent-gateway.json` file with
  `0600` permissions, so MCP clients do not need manual token updates after
  every restart.
- Token rotation is explicit from Agent Access.
- If the configured port is occupied, Desktop surfaces the conflict instead of
  silently switching clients to another port.

Validation for this checkpoint:

```bash
npm run check
node core/tests/streamable-http-gateway-smoke.js
git diff --check
```

## v0.4.1 Checkpoint

`0.4.1` keeps the built-in Memory embedding model lazy:

- The Xenova built-in extractor is only loaded when the configured provider is
  `claracore-built-in` and an embedding is actually generated.
- Ollama-backed search, maintenance checks, and failed Ollama embedding attempts
  do not load or fall back to the built-in model.

Validation for this checkpoint:

```bash
npm run check
npm run test:embedding:lazy
git diff --check
```

## v0.4.0 Checkpoint

`0.4.0` starts the multi-agent Gateway migration:

- Desktop exposes a token-protected localhost Streamable HTTP MCP endpoint at
  `/mcp`.
- Stdio MCP remains available as a compatibility path while clients migrate.
- Gateway traces now record transport and optional session id, so multi-agent
  and multi-session activity can be inspected without relying only on helper
  processes.
- Home shows Agent change summaries for yesterday, today, recent 7 days, and
  recent 30 days.

Validation for this checkpoint:

```bash
npm run check
node core/tests/phase3-gateway-smoke.js
node core/tests/streamable-http-gateway-smoke.js
git diff --check
```

## v0.3.2 Checkpoint

`0.3.2` is a small Desktop runtime checkpoint:

- InnerLife share timing now connects to current Shared Line context by default
  and records overlap metadata for inspection.
- Logs includes a read-only time flow across Memory, Shared Line, InnerLife,
  Gateway, and runtime events.
- Runtime snapshots include a read-only decay audit for dormant Memory, Shared
  Line review state, old waiting InnerLife state, and InnerLife daemon errors.

Validation for this checkpoint:

```bash
npm run check
npm run test:phase4
npm run test:phase5
git diff --check
```

## v0.3.3 Checkpoint

`0.3.3` bundles a UX guard and an out-of-box InnerLife default:

- Saving Settings now asks for confirmation when the embedding provider or model
  changes, since existing memories must be re-embedded with the new model and
  vectors of different dimensions can't be compared. Semantic search stays
  degraded until the rebuild completes.
- Fresh installs seed a working InnerLife provider (DeepSeek `openai-compatible`,
  `deepseek-v4-flash`, shared out-of-box key) so InnerLife works with no setup.
  Existing databases keep their own config via `ON CONFLICT DO NOTHING`.

## v0.3.4 Checkpoint

`0.3.4` restores the built-in local embedding path as the default:

- Fresh installs default Memory embedding to ClaraCore built-in
  `Xenova/bge-small-zh-v1.5`, with 512-dimensional vectors.
- The built-in model is loaded from bundled `resources/models` through
  `@xenova/transformers`; runtime loading disables remote model downloads.
- The Settings provider selector exposes `ClaraCore built-in` as a current
  option, not a future placeholder.
- The Memory embedding UI keeps the default path simple: built-in hides
  endpoint/model/API-key controls, and the visible provider choices are only
  ClaraCore built-in, Ollama, or Disabled. OpenAI-compatible embedding remains a
  backend compatibility path, not the default Settings workflow.
- InnerLife Settings expose only the currently runnable providers: Disabled,
  Ollama, or OpenAI-compatible. There is no ClaraCore built-in InnerLife model
  yet.
- Fresh installs default `innerlife.enabled` to ON with the shared DeepSeek
  provider/key path.
- The API key placeholder now makes the default/shared key path explicit while
  still supporting `env:OPENAI_API_KEY` style references.

## v0.3.5 Checkpoint

`0.3.5` is a focused visual maintenance package:

- Dark mode now covers the newer v0.3 card and panel surfaces, including page
  focus summaries, source-map cards, Settings sections, daemon controls,
  attention items, InnerLife records/shares, metric/path lists, and model
  connection rows.
- The patch keeps the existing dark theme tokens and applies them consistently
  to newer UI surfaces instead of changing the product layout or model flow.

## v0.3.6 Checkpoint

`0.3.6` improves agent onboarding for packaged installs:

- Agent Access now frames the copied setup text as instructions for the agent,
  not as source-code reading directions.
- The copied instructions and `gateway_docs` both include the expected startup
  sequence: `claracore_connection_test`, `gateway_docs`, then
  `gateway_context`.
- The agent-facing guide includes module playbooks for Memory, Memory links,
  structured records, Shared Line, InnerLife, and Gateway diagnostics so agents
  know how to use ClaraCore through MCP without inspecting local source files.
- `docs/AGENT_MCP_PLAYBOOK.md`, the Agent Access copied instructions, and
  `gateway_docs` now share the same MCP-first recipes: connection test, context
  read, search-before-write Memory, Memory links, Shared Line updates, InnerLife
  checks, and Gateway diagnostics.
