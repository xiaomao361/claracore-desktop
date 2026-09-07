# ClaraCore Desktop v0.6.14 Release Notes

Date: 2026-09-07

Status: local source and macOS Apple Silicon Lite trial checkpoint. An unsigned
Lite DMG was built on 2026-09-07. Source closeout is on `main`; no tag,
notarization, or public release is included. Public stable remains `v0.6.12`.

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

Remote GitHub Actions status is tracked separately from local validation.
Installed-app visual/runtime acceptance has not been confirmed.

## Local Lite Trial Asset

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
