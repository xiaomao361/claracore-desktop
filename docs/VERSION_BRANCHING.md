# Version Branching

## Current Baseline

- `main` is the working Desktop line.
- `package.json` is the product-version source through `core/version.js`.
- The current local version is `0.3.6`.
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
