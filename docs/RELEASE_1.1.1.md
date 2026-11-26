# 1.1.1 release record · 2026-11-26

## Scope

Knowledge adds sticky reading toolbars, heading-aware navigation, same-document
jumps, search highlights, and recent reading positions. Markdown reading improves
quotes, nested lists, and read-only task states. Shared Line reference copying,
dialog refreshes, Memoria formatting, and reading earlier logs also improve.
See the [changelog](../CHANGELOG.md) and [Knowledge reader](KNOWLEDGE_PAGE.md).

## Installers

[v1.1.1](https://github.com/xiaomao361/claracore-desktop/releases/tag/v1.1.1) is the stable release from source commit `41fde7e74e20a7c4d92fe6cc5642d3e9ab46a952`.
The tagged source includes the reading fixes and regression tests.

| Installer | Bytes | SHA-256 |
| --- | ---: | --- |
| ClaraCore-Desktop-1.1.1-arm64.dmg | 207545443 | `aba0d2a4f9509b8d3f583be8bf1504fc3c9a90a0f38b929e373ae70641f6f7f4` |
| ClaraCore-Desktop-1.1.1-lite-arm64.dmg | 126488816 | `73a0cdf8d0210a73bf81627853c0679ecf2e2a390ceddf76ad684e831d2cd4ad` |
| ClaraCore-Desktop-1.1.1-lite-x64-Setup.exe | 108801278 | `ef1d354a48efca0992e825912530eb7ff188bce31d6df2a7cf63276749d05d47` |
| ClaraCore-Desktop-1.1.1-x64-Setup.exe | 178812385 | `ffadd7390da3710df370095e7ea114ae7c1660e69d9b5a4ba7d4fc3d37b2eb17` |

macOS Full and Lite are Developer ID signed, notarized, and stapled. Windows
installers are unsigned. The release includes a SHA-256 manifest for each platform.

## Validation

- Local core, Gateway, maintenance, recovery, documentation, and release checks passed.
- [Source Checks](https://github.com/xiaomao361/claracore-desktop/actions/runs/45777063737) passed on the tagged commit.
- [Windows CI](https://github.com/xiaomao361/claracore-desktop/actions/runs/45777167588) built the tagged source and passed
  the Full embedding, Full/Lite package, and packaged SQLite checks.
- Each macOS bundle matches 435 tagged application files. Both flavors passed
  packaged SQLite and isolated Gateway checks. Full produced 512-dimensional
  embeddings. Signature, Gatekeeper, notarization, and read-only DMG checks passed.
- All four installers and both manifests are listed in the public release. Their
  asset sizes and digests match the verified files and platform checksums.

Installed-app interaction on macOS and Windows remains outside these checks.
