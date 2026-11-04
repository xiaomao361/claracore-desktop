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

[v1.1.0 is published](https://github.com/xiaomao361/claracore-desktop/releases/tag/v1.1.0)
as the latest stable release. The immutable tag resolves to
`ec2cb2ee02acfc3fdefc5b0383e2c099a9b91fa7`, which includes PR #6 and all prior
release-pipeline fixes from main. PR #5 remains on remote branch
`codex/gui-v1-document` at `9cecc2519dc9ae635073d211149d8509f91b9e20`.

| Installer | Bytes | SHA-256 |
| --- | ---: | --- |
| ClaraCore-Desktop-1.1.0-arm64.dmg | 207513224 | `da8212e41a964eb90a3a1d35c0df8e47f182158148711f97c219cc79605a781e` |
| ClaraCore-Desktop-1.1.0-lite-arm64.dmg | 126487168 | `f42339923473e2a40f8900adfa4858b57a378ffa2c068ea0a26dc930c43b3fd0` |
| ClaraCore-Desktop-1.1.0-lite-x64-Setup.exe | 108795761 | `be52b00249eaa51bb6a14eb215a5df23115a905ce98699438b1992ef9e437003` |
| ClaraCore-Desktop-1.1.0-x64-Setup.exe | 178806162 | `88139e5ae6141a09254a31afc25cdb0a167bb221712308542c0465f61428fd91` |

macOS Full and Lite are Developer ID signed, notarized and stapled. Application
and DMG Gatekeeper checks passed. Windows installers are unsigned. Both platform
SHA-256 manifests are included. All six GitHub asset sizes and digests match the
verified local files; the Windows installers and manifest were downloaded and
checked independently against their published hashes.

Documentation-only updates follow the frozen release source without moving its
tag. README downloads and the deployed website point to 1.1.0.

## Validation

- Local source/core/Gateway/maintenance/recovery, release and website checks
  passed, including SQLite CLI fallback boundaries and InnerLife source ingest.
- [Source Checks](https://github.com/xiaomao361/claracore-desktop/actions/runs/41797865581)
  passed on the frozen application commit.
- [Windows CI](https://github.com/xiaomao361/claracore-desktop/actions/runs/41797882716)
  built the exact v1.1.0 source and passed source, built-in embedding,
  Full/Lite package boundaries and both packaged SQLite engines before upload.
- Each macOS flavor's 435 application source/assets files match the immutable
  tag byte for byte, with no unexpected source files. Full built-in embedding
  reported 512 dimensions. Full/Lite packaged SQLite Node and CLI engines and
  isolated packaged Gateway checks passed. Lite omits production dependencies
  and built-in model resources and saves about 239 MiB versus Full.
- Application signatures, stapled tickets and Gatekeeper passed. Both DMGs
  passed integrity checks and read-only mounted signature/content checks; their
  packaged ASARs match the verified applications. Validation mounts were detached.
- [Pages deployment](https://github.com/xiaomao361/claracore-desktop/actions/runs/41797865603)
  passed; an HTTP readback confirmed all four 1.1.0 download variants.

Real Windows interaction, exhaustive screen layouts and long-running operation
remain outside the noninteractive evidence. No personal data or host hooks were
packaged, and no installed application was replaced.
