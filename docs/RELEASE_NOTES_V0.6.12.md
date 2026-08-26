# ClaraCore Desktop v0.6.12 Release Notes

Date: 2026-08-26

Status: public stable release. The complete macOS Apple Silicon and Windows x64
Full/Lite matrix has passed source, package, signing, notarization, and remote
asset verification.

## Release Assets

The public release is complete only when all six files are present:

- `ClaraCore-Desktop-0.6.12-arm64.dmg` — macOS Full, Developer ID signed,
  Apple-notarized, and stapled
- `ClaraCore-Desktop-0.6.12-lite-arm64.dmg` — macOS Lite, Developer ID signed,
  Apple-notarized, and stapled
- `ClaraCore-Desktop-0.6.12-x64-Setup.exe` — Windows Full
- `ClaraCore-Desktop-0.6.12-lite-x64-Setup.exe` — Windows Lite
- `SHA256SUMS-macos.txt`
- `SHA256SUMS-windows.txt`

Published artifact evidence:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ClaraCore-Desktop-0.6.12-arm64.dmg` | 207,780,290 | `890b60ff210549ebafde86a70ccc32259f2ce34a609622696231919f7e861977` |
| `ClaraCore-Desktop-0.6.12-lite-arm64.dmg` | 126,761,555 | `0c29a6d87b0f2b482b40420276036e68f92e3e682f8b16072d61565ad82a7a53` |
| `ClaraCore-Desktop-0.6.12-x64-Setup.exe` | 178,751,444 | `711d401c2902e53b28adf1f13fa58c3bf5c7635fec25aaaa2ddfb635942136f1` |
| `ClaraCore-Desktop-0.6.12-lite-x64-Setup.exe` | 108,739,615 | `f6a79b4415888c719ba8d69b66063f7468a1da942edaaa6fc6a582584d26cb9b` |

## Shared Line Read Correctness

- Background refreshes for InnerLife and other unrelated modules no longer
  replace a fully hydrated Shared Line view with its lightweight overview.
- Agent context and archived-line catalogs remain visible after those scoped
  refreshes instead of incorrectly appearing empty while the underlying data
  is still present.
- The selected Shared Line and its independently scoped Agent context remain
  separate: selecting another line does not erase or retarget the catalog.

## InnerLife Share Integrity

- Session afterthought shares now remain `drafting` while their persisted model
  job is unfinished. SessionStart share plans, pending-share catalogs, and
  `innerlife_share_check` cannot expose the placeholder body.
- A successful generated afterthought moves atomically from `drafting` to
  `pending`; model no-share output and duplicate suppression move it to
  `discarded`.
- Empty model output (`template`) is recorded as `no_model_output` and
  discarded. Model failures (`fallback` with an error) remain `drafting` and
  follow the durable retry schedule, so a transient outage cannot destroy the
  afterthought or promote its placeholder body into the pending queue.
- Persisted retries keep the share in `drafting`, and an explicitly
  acknowledged terminal failure discards the unfinished share with its audit
  reason.
- Upgrades reclassify only legacy pending session-afterthought shares that are
  still linked to unfinished jobs. Ordinary pending shares and completed jobs
  remain unchanged.
- When `innerlife_mark_share` rejects an invalid status transition, Gateway
  callers receive the current share body and status together with a structured
  error, allowing immediate reconciliation against the content actually stored.
- `discarded` remains terminal; this checkpoint does not add a generic
  `discarded -> used` rollback.

## App Startup

This checkpoint also includes the installed-app login-startup preference from
the `0.6.11` development checkpoint. System-login launches stay quiet in the
tray, direct launches show the main window, and development/test instances do
not modify system login items.

## Validation Boundary

- Focused service, repository, persisted-job, Gateway, migration, and UI smokes
  cover drafting exclusion, generated-content visibility, retries, terminal
  acknowledgement, empty model output, failed-model retries, drafting counts
  and reasons, illegal-transition reconciliation, and legacy-data upgrade.
- Shared Line UI coverage now verifies that an unrelated InnerLife refresh
  preserves hydrated Agent context and archived-line catalogs.
- The macOS Full/Lite Apps and DMGs are Developer ID signed, Apple-notarized,
  stapled, Gatekeeper accepted, and DMG-verified. Apple accepted Full App/DMG
  submissions `6a063b16-3ff8-4a6a-ad56-5f37b0ee3889` and
  `861a172d-8a64-4be4-8b6f-a47d16247233`, plus Lite App/DMG submissions
  `991b2790-802e-487d-b5cb-4d4dbabdac5c` and
  `e6c69efc-b1f2-4dc8-a9a7-75e93812fa03`.
- The macOS Full package generated a real 512-dimensional built-in embedding;
  Full/Lite package boundaries, packaged settings, update UI, and both
  isolated packaged Gateway workflows passed.
- Windows workflow
  [`32946450594`](https://github.com/xiaomao361/claracore-desktop/actions/runs/32946450594)
  passed source checks, both installer builds, a real packaged Full embedding,
  Full/Lite package boundaries, LF checksum generation, and draft-asset upload.
- All six GitHub Release assets were downloaded again. Both checksum manifests,
  downloaded sizes and hashes, macOS DMG integrity, stapled tickets, and
  Gatekeeper assessments matched the published asset metadata.
- Live macOS installed-app acceptance confirmed direct launch, quiet login
  startup, and Shared Line Agent context/archive visibility. Windows installers
  remain unsigned; CI package validation passed, while Windows real-device
  installation acceptance remains a separate unverified layer.
