# ClaraCore Desktop v0.6.14 Release Notes

Date: 2026-09-07

Status: published public stable release on 2026-09-07, tagged `v0.6.14`
at `db03c42fb7d7c0142743dfbb997f84f5a1a154ab`.

[GitHub Release](https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.6.14)

macOS Apple Silicon Full/Lite DMGs are Developer ID signed, Apple-notarized,
stapled and Gatekeeper accepted. Windows x64 Full/Lite installers passed CI
package validation and remain unsigned. Actual installed-device acceptance is
not claimed by this release automation.

## Completed Repair Plan

- [x] Block restore and full JSON import when safety-backup verification fails.
- [x] Retrieve semantic matches across the full eligible catalog in bounded pages.
- [x] Match embedding provider/model/dimension and queue active vectors for rebuild
   when embedding configuration changes.
- [x] Count restore-preview differences across all active memories while keeping
   examples bounded.
- [x] Add routine source CI and synchronize version and maintained contracts.

## Changes

- Failed safety-backup verification stops both database replacement paths before
  invalidation, preserving the current data and normal access.
- Semantic retrieval uses 200-row keyset pages and retains only the best ten
  eligible vector results. Older memories remain discoverable. Existing keyword
  precedence and relevance thresholds remain in effect.
- Vector comparisons require matching provider, model, and query dimension.
  Changed embedding settings invalidate non-restricted active vectors for the
  existing rebuild queue; unchanged settings preserve them. Old in-flight
  successes and failures cannot overwrite the new configuration's rebuild state.
  Historical vectors retain their model identity and are excluded when incompatible.
- Restore previews count all active-memory differences, with at most eight
  examples per category. Their comparison still covers title, body, and update
  time rather than every table or field in a full database backup.
- Source Checks runs the non-UI `test:core` entry point on pull requests and
  pushes to main, plus SQLite CLI fallback coverage for the new boundaries.

## Validation Boundary

The focused regressions use temporary data and user-data roots, synthetic
vectors, and injected backup failures. They cover more than 600 candidate
memories, exact pagination boundaries, model/Agent/status/sensitivity isolation,
model switching and rebuilding, delayed responses after a model switch,
verification-failure cancellation, full preview counts, and bounded examples.

Local validation passed:

- `npm run test:core` (includes source/architecture/context checks, search,
  backup, Memory Controller, and Memoria/Gateway regressions).
- Both new boundary suites with `CLARACORE_DESKTOP_DISABLE_NODE_SQLITE=1`.
- `git diff --check`, workflow YAML parsing, package/lock version parity, and
  product/Agent Guide version parity through the context-budget gate.

Source Checks [34078370297](https://github.com/xiaomao361/claracore-desktop/actions/runs/34078370297)
and Windows release [34078565317](https://github.com/xiaomao361/claracore-desktop/actions/runs/34078565317)
both passed.
Installed-app visual/runtime acceptance has not been confirmed.

## Earlier Local Lite Trial Asset (Unsigned)

- File: `dist-lite/ClaraCore-Desktop-0.6.14-lite-arm64.dmg`
- Size: 127,400,270 bytes.
- SHA-256: `8955ce6386296a920323b530374a4116c4fdaaf4cbb9a515aacc791f22a18357`
- `npm run test:package:lite` passed: Lite flavor, 293.8 MiB installed App,
  no built-in model resources or Full embedding dependencies.
- Bundle version and isolated packaged stdio Gateway smoke report `0.6.14`.
- All 275 packaged JS/HTML/CSS source files match the source closeout.
- `hdiutil verify` passed.
- Local unsigned test artifact; no Developer ID signing or Apple notarization.
  Installation and visual acceptance remain user-owned.

## Published Assets

All six published assets were downloaded again; sizes and SHA-256 digests match
GitHub metadata and the two platform manifests. Both downloaded DMGs also pass
`hdiutil verify` and stapled-ticket validation.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ClaraCore-Desktop-0.6.14-arm64.dmg` | 207,816,554 | `4f23a2d373893dde63655caf46519db66150a1a77a82c90e012a47e0166ae557` |
| `ClaraCore-Desktop-0.6.14-lite-arm64.dmg` | 126,759,861 | `7db2e334249b987562b0a424d4bb772f77dc360cd598785036a0a5fa4302ae40` |
| `ClaraCore-Desktop-0.6.14-lite-x64-Setup.exe` | 108,753,229 | `7b93101929910324b29d1af6a7858c40e17e0996c290d904aa9bf435f1cead8d` |
| `ClaraCore-Desktop-0.6.14-x64-Setup.exe` | 178,756,943 | `e3d30bd3dc536d8f4fb32663f1918529da358447fda39f070822272d2b25b94a` |
| `SHA256SUMS-macos.txt` | 207 | `a0be290d253fc0e72105c81e562f7edb7c2e40aeef92599fe7b4f2cff7e7cc2a` |
| `SHA256SUMS-windows.txt` | 215 | `66c1dc5d34b2b980b08ad18d924b62d516857a625333456b195a47631f61f222` |

Full App/DMG notarization submissions: `6dc569f6-9406-42c8-906f-1f08be736e72`
and `75471768-2a93-487b-ad2e-8cca5170a5f0`. Lite App/DMG submissions:
`876889c2-b8fe-499d-bde4-6024962b72fb` and
`f248c4ab-a6ff-472f-8d59-9f7056ecd480`. All were accepted.

Full/Lite installed sizes are 532.6/292.8 MiB. Full generated a real
512-dimensional built-in embedding on macOS and Windows; both macOS packaged
Gateway smokes passed. No installation or user-owned UI operation was performed.
