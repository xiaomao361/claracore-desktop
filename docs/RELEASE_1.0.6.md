# 1.0.6 release record · 2026-10-29

## Scope

This release promotes the tested local 1.0.6 work to a public release. It includes
workspace navigation and focused settings, Knowledge reading and intake,
Memory and InnerLife evidence, exact Shared Line continuation, model setup,
tray destinations, and all 13 confirmed issues in the
[overall review](design/2026-10-29-FULL-REVIEW.md).

The user tested the unsigned Lite build and reported that it felt noticeably
better. That observation is not exhaustive visual, platform or long-running
acceptance. Historical 1.1.0 proposals remain design history; the adopted work
ships in 1.0.6 without adopting rejected visual directions.

## Artifacts and publication

Release preparation is in progress. Public downloads remain on 1.0.3 until
all four 1.0.6 installers are uploaded and verified. The release tag will bind
the frozen source commit; later publication records and website changes may
use a separate documentation commit. Existing published tags remain unchanged.

Target artifacts: signed and notarized macOS Apple Silicon Full/Lite DMGs,
unsigned Windows x64 Full/Lite installers, and per-platform SHA-256 manifests.

## Validation boundary

Source/core/Gateway/maintenance and release/website checks run before packaging.
macOS packages require content, built-in embedding (Full), SQLite vector runtime,
signature, notarization, Gatekeeper and DMG checks. Windows CI checks the exact
release source and package version before building and before asset upload.
Published assets and Pages links require separate readback after publication.

Real Windows interaction, exhaustive screen layout and long-running multi-client
behavior remain outside the noninteractive test evidence. No personal data or
local host hooks are included in the release.
