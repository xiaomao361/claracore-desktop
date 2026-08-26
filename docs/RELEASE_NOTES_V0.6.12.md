# ClaraCore Desktop v0.6.12 Release Notes

Date: 2026-08-26

Status: release candidate. Local source and macOS Apple Silicon Lite checks
have passed. Signed/notarized release packaging, Windows builds, publication,
and public-download verification are not complete.

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
- The local macOS Apple Silicon Lite DMG passed package-structure, disk-image,
  and packaged-Gateway checks; it remains an ad-hoc, unnotarized test artifact.
- Installed macOS and Windows login-startup acceptance remains required before
  this version can be described as a public release.
