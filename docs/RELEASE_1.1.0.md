# 1.1.0 release record · 2026-11-04

## Scope

Promotes the shared-world GUI direction from [PR #6](https://github.com/xiaomao361/claracore-desktop/pull/6),
contributed by @jaredchao. Home retains the existing four modules and top
navigation while highlighting the current topic and Shared Line. The Shared
Line ribbon distinguishes recorded, current and next positions; stage labels
and dark-theme selection colors are aligned. Other pages inherit the new colors.

The release includes the existing 1.0.6 reliability work and the later
release-pipeline fixes: authenticated draft lookup after a real 404, portable
documentation links, exact-source/version checks and existing-asset protection.
The alternative GUI in PR #5 remains on a separate branch and is excluded.

The user viewed the local unsigned 1.0.6 Lite build containing PR #6 and
approved its effect for this release. That observation does not establish
exhaustive UI, Windows interaction or long-running acceptance.

## Publication

Target: [v1.1.0](https://github.com/xiaomao361/claracore-desktop/releases/tag/v1.1.0).
Full and Lite installers are planned for macOS Apple Silicon and Windows x64.
Publication and artifact verification are pending at this checkpoint.

## Validation boundary

Local source/core/Gateway/maintenance, release and website checks passed,
including the SQLite CLI fallback boundaries. Remote CI and packaged checks
are pending at this checkpoint.
macOS release artifacts require package-content checks, Full built-in embedding,
Full/Lite SQLite runtime checks, signing, notarization, Gatekeeper and DMG
integrity checks. Windows CI must build the exact tag and validate Full/Lite
boundaries, built-in embedding and both SQLite engines before upload.
Published assets, checksums and website downloads require separate readback.
