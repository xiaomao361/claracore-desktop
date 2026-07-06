# Version Branching

## Current Baseline

- `main` is the working Desktop line.
- `package.json` is the product-version source through `core/version.js`.
- The current local version is `0.3.3`.
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
  `deepseek-v4-flash`, shared out-of-box key) so session-based sharing works with
  no setup. The background daemon (`innerlife.enabled`) stays OFF by default so a
  fresh install never idle-polls the shared key when nobody is talking to it.
  Existing databases keep their own config via `ON CONFLICT DO NOTHING`.

Local embedding (bundled bge-small-zh so semantic search works without Ollama)
is still pending: transformers.js in Node uses native onnxruntime, so the
"pure-WASM, no native" path needs onnxruntime-web + a hand-rolled tokenizer, and
model download + packaging must be validated on a build machine.
