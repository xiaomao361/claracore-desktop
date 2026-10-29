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

[1.0.6 is published](https://github.com/xiaomao361/claracore-desktop/releases/tag/v1.0.6)
and is the latest stable release. Its immutable tag resolves to
`c098f27616a4fa552421bff8a031bd516474e8d6`. macOS application source and assets
match that commit (431 files per flavor). Windows built that exact source
using the draft-aware workflow guard from `6c5d55b`.

| Installer | Bytes | SHA-256 |
| --- | ---: | --- |
| ClaraCore-Desktop-1.0.6-arm64.dmg | 207529426 | `ccdcafd1afcd633aeb1238039214c129660c7ffa844ba5d06a39bb74079b216c` |
| ClaraCore-Desktop-1.0.6-lite-arm64.dmg | 126493476 | `4f4d8453f99cd127f4179836140b2ad63cc119b82cce48410430c7c3a4f5c1d3` |
| ClaraCore-Desktop-1.0.6-lite-x64-Setup.exe | 108791557 | `1919e2c70f3a4d50b7f58c65daed735f106d96cc6746e65c94ba007d082b5418` |
| ClaraCore-Desktop-1.0.6-x64-Setup.exe | 178795594 | `35144c8264b2dc1db7b7b54a34076086e2ae30f8a1822b22024980ed05af998c` |

macOS Full/Lite are Developer ID signed, notarized and stapled. Gatekeeper
assessments and DMG integrity checks passed. Windows installers are unsigned.
The release includes `SHA256SUMS-macos.txt` and `SHA256SUMS-windows.txt`.
All six GitHub asset digests and sizes match the locally verified files.
Windows installers were also downloaded and matched their manifest.

Documentation and website updates follow the release without moving its tag.

## Validation boundary

Source/core/Gateway/maintenance and release/website checks passed locally.
[Source Checks](https://github.com/xiaomao361/claracore-desktop/actions/runs/40843067943)
passed at `6c5d55b`; its changes after the frozen application commit are release
helpers and portable documentation links, not application behavior.
[Windows CI](https://github.com/xiaomao361/claracore-desktop/actions/runs/40843089258)
passed, including Full built-in embedding, Lite boundaries and both packaged
SQLite engines. macOS Full built-in embedding reported 512 dimensions and
Full/Lite packaged SQLite checks passed with Node and CLI engines.

The initial source CI found links into local-only test output; documentation
now retains those paths as historical text, and the public-link checker rejects
local build-output hyperlinks. The initial Windows preflight could not read a
draft through GitHub's tag endpoint; a 404 now permits a bounded authenticated
release-list lookup, while other API failures and existing-asset protections
remain intact. The corrected workflow built the same immutable release source.

Release validation requires the following distinct layers:
macOS packages require content, built-in embedding (Full), SQLite vector runtime,
signature, notarization, Gatekeeper and DMG checks. Windows CI checks the exact
release source and package version before building and before asset upload.
Published assets and Pages links require separate readback after publication.

Real Windows interaction, exhaustive screen layout and long-running multi-client
behavior remain outside the noninteractive test evidence. No personal data or
local host hooks are included in the release.
