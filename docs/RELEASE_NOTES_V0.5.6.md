# ClaraCore Desktop v0.5.6 Local Test Checkpoint

Status: release-candidate testing; no public `v0.5.6` Release has been published.

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
- Added a manually triggered GitHub Actions Windows build. It installs native
  dependencies on a Windows x64 runner, builds Full and Lite installers, runs a
  real packaged Full 512-dimensional embedding smoke test, and uploads the
  installers with SHA-256 checksums for seven days.
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

The Windows release-candidate workflow is `.github/workflows/build-v0.5.6.yml`.
It must pass `npm run test:builtin-embedding:packaged` before its installers are
accepted for physical-device testing.

## Packaging Validation

Local macOS arm64 validation completed on 2026-07-16:

- Full DMG: `ClaraCore-Desktop-0.5.6-arm64.dmg`, approximately 198 MiB,
  SHA-256 `cdc26fd40d0f6cd9039d374c1815d06016d665ffc681de86ed1fc659edac96df`.
- Lite DMG: `ClaraCore-Desktop-0.5.6-lite-arm64.dmg`, approximately 121 MiB,
  SHA-256 `08739a6dbed564e9835d05a6192ea382a30e946df4a66c3028ec4b6d3e91f394`.
- Both DMGs passed `hdiutil verify`.
- The packaged Full app generated a 512-dimensional built-in embedding.
- The Full/Lite package boundary check passed; the unpacked Lite app measured
  292.7 MiB versus Full at 532.1 MiB.

## User Acceptance

- Start the local build against an isolated or disposable data root.
- Confirm empty Home shows onboarding, demo data can be loaded, and clearing it
  returns to the empty state.
- In Full Settings > Models, confirm ClaraCore built-in shows no external
  endpoint/model/key/test fields and Ollama restores them.
- Confirm normal existing data does not show the onboarding panel.
- Windows x64 installation and real Ollama use remain separate physical-device
  acceptance steps after the GitHub-built installers pass their packaged
  built-in embedding gate.
