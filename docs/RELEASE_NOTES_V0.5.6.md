# ClaraCore Desktop v0.5.6 Local Test Checkpoint

Status: committed for local user testing; not published or pushed.

## What Changed

- Added an empty-data Home onboarding path with direct links to Agent Access
  and model settings.
- Added backup-first demo data load and clear actions. Fixture records use
  dedicated `ux_*` identifiers, and clear removes only fixture-owned records.
- Kept Agent Access as the primary connection surface and moved Gateway port
  and token editing behind an advanced Settings disclosure.
- Changed `shared_line_get` to return the selected line's lite resume packet;
  line catalogs remain owned by `shared_line_list`.
- Fixed Full's ClaraCore built-in Memory embedding form so endpoint, model,
  API-key, fetch, and connection-test controls are not rendered. Ollama fields
  still appear when Ollama is selected.
- Added Windows Lite packaging and package-content checks alongside the existing
  Full/Lite macOS flow.
- Tightened local-data copy so it does not imply that explicitly configured
  external-model or update-check network requests cannot occur.

## Automated Validation

Run before the local commit:

```bash
git diff --check
npm run check
npm run test:onboarding
npm run test:phase1:ui
npm run test:lite
node core/tests/phase3-gateway-smoke.js
node core/tests/phase3-shared-line-smoke.js
```

## User Acceptance

- Start the local build against an isolated or disposable data root.
- Confirm empty Home shows onboarding, demo data can be loaded, and clearing it
  returns to the empty state.
- In Full Settings > Models, confirm ClaraCore built-in shows no external
  endpoint/model/key/test fields and Ollama restores them.
- Confirm normal existing data does not show the onboarding panel.
- Windows x64 installation and real Ollama use remain a separate physical-device
  acceptance step.
