# ClaraCore Desktop Polish Log

## Target

ClaraCore Desktop should become a daily-usable stable build: open the app,
inspect local core state, connect an agent, read/write Memoria, continue Shared
Lines, review InnerLife, export/import data, quit, reopen, and understand any
failure without guessing.

This is a polish target, not a feature-expansion plan. A successful round leaves
one real runtime problem reproduced, fixed or explicitly bounded, and verified
with the narrowest meaningful check.

## Operating Loop

1. Pick one to three real symptoms from daily use, Gateway traces, runtime logs,
   or a failing focused test.
2. Record the symptom, impact, reproduction path, suspected owner, and chosen
   verification command below before changing behavior.
3. Fix the smallest product boundary that owns the defect.
4. Run `npm run check` plus the focused command that exercises the defect.
5. Move the item to Fixed only when the verification is concrete.

Avoid broad smoke runs by default during polish. Use `npm run test:smoke` only
for structural/runtime changes or release checkpoints.

## Verification Matrix

| Surface | Focused check |
| --- | --- |
| Syntax and IPC wiring | `npm run check` |
| Shell, tray, drag, window state | `npm run test:shell` |
| Memoria CLI and Gateway memory contract | `npm run test:memoria:cli`, `npm run test:phase2` |
| Shared Line / Continuity | `npm run test:phase3` |
| Agent Access / Gateway contract | `npm run test:phase4` |
| InnerLife daemon, sessions, shares | `npm run test:phase5` |
| Backup, restore, JSON import/export | `npm run test:backup`, `npm run test:import-preview` |
| Runtime memory and bounded snapshots | `npm run test:memory-long-run` |

For live product data work, create a verified backup first, compare source and
target counts/timestamps, and run `PRAGMA quick_check` before declaring the
data safe.

## Active Issues

### P0 - None

No known data-loss or launch-blocking issue is currently captured here.

### P1 - Packaged runtime replacement check

- Symptom: packaged or agent-launched Gateway processes can outlive the visible
  Desktop UI and interfere with replacement, locks, or stale state.
- Impact: agent operations and development replacement become unreliable.
- Current status: Gateway contract and trace UI pass in isolated test
  instances. Packaged replacement still needs one real `.app` check when
  preparing a release build.
- Verification: packaged replacement check when building a `.app`.

### P1 - Shared Line current-position correctness

- Symptom: imported lines with legacy current-position ids can hit uniqueness
  conflicts, and `shared_line_update` can return the wrong resume packet after
  an inferred write.
- Impact: agents cannot trust the line they just updated.
- Current status: fixes are documented in `docs/BUGFIX-2026-06-30.md`.
- Verification: `npm run check`, `node core/tests/phase3-gateway-smoke.js`, and
  at least one live-data copy test before release.

### P2 - Runtime memory and snapshot size

- Symptom: Home/runtime snapshots can quietly grow when new views start pulling
  full product lists.
- Impact: long-running app memory use becomes restart-dependent.
- Current status: policy and an opt-in long-run check exist.
- Verification: `npm run check`, `npm run test:memory-long-run` after changing
  snapshots, schedulers, Gateway lifetime, or caches.

## Fixed

### 2026-06-30 - Gateway share timing and isolated UI smoke tests

- Symptom: `innerlife_share_check` returned `use` for pending InnerLife shares,
  and Electron UI smoke tests exited when a live Desktop instance already held
  the single-instance lock.
- Fix: pending shares now return `review_first`; approved matching shares return
  `use`. UI smoke tests opt into `CLARACORE_DESKTOP_TEST_INSTANCE=1`, which
  skips the single-instance lock only for test instances.
- Verification: `npm run check`, `CLARACORE_DESKTOP_DATA_DIR=/tmp/... npm run
  test:phase4`.

### 2026-06-30 - InnerLife daemon and digest polish

- Symptom: phase 5 InnerLife checks had agent-id drift, digest runs created
  extra pending convergence shares, and enabling the daemon from UI waited for
  the 60-second scheduler instead of processing pending inbox immediately.
- Fix: phase 5 tests now keep InnerLife operations scoped to one agent, digest
  runs no longer auto-create convergence shares, digest UI previews skip profile
  JSON noise, and UI daemon enable triggers an immediate tick for that agent.
- Verification: `npm run check`, `CLARACORE_DESKTOP_DATA_DIR=/tmp/... npm run
  test:phase5`.

### 2026-06-30 - Product JSON import, backup restore, SQLite WAL boundary

- Symptom: JSON import could lose imported rows and serve stale replaced rows
  when a cached SQLite connection still held WAL state.
- Fix: close/checkpoint temp databases, reset cached destination connections,
  and remove destination SQLite sidecars around file replacement.
- Verification: `npm run check`, `node core/tests/backup-restore-smoke.js`,
  `node core/tests/import-preview-smoke.js`.

### 2026-06-30 - Connection test InnerLife status

- Symptom: `claracore_connection_test` always reported InnerLife as paused.
- Fix: read real daemon state instead of a non-existent configuration path.
- Verification: Gateway contract path exercises the connection test.

## Release Checkpoint

Before calling a build "daily stable":

- `npm run check` passes.
- Focused tests for every touched surface pass.
- Product DB backup/restore/import paths have been checked if data movement
  changed.
- Agent Access text still describes runtime-assigned localhost URLs and does
  not hard-code a Gateway port.
- The current active issues above either move to Fixed or remain explicitly
  bounded with a reproduction path.
