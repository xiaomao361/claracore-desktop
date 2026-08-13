# ClaraCore Desktop v0.6.5 Release Notes

## Status

`v0.6.5` was the public stable GitHub Release at this checkpoint and is now a
historical release. See [Version Branching](VERSION_BRANCHING.md) for current
release truth:

<https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.6.5>

This maintenance release intentionally contains two assets:

- `ClaraCore-Desktop-0.6.5-lite-arm64.dmg` — macOS Apple Silicon Lite
- `SHA256SUMS.txt` — SHA-256 checksum for the DMG

The application and DMG use Developer ID signing and Hardened Runtime. Apple
accepted both notarization submissions, and the tickets are stapled to the
distributed artifact.

## Highlights

- Splits large InnerLife, system trace, and Shared Line repository ownership
  into explicit modules with composition and cycle guards.
- Moves InnerLife daemon, digest, session lifecycle, and share timing behavior
  behind services with focused repository ports.
- Adds a single-owner product-core lifecycle, shared resource refresh loop, and
  one-time selected Shared Line hydration.
- Consolidates Home activity queries and Gateway context startup work to avoid
  redundant reads while preserving explicit invalidation.
- Makes ambiguous Gateway context and Shared Line selection recoverable instead
  of silently choosing the wrong position.
- Completes Home normal, loading, empty, error/retry, reduced-motion, and narrow
  screen states with truthful accessibility metadata.

## Validation

- JavaScript syntax, SQL interpolation, IPC contract, and architecture checks
- Home normal/loading/empty/error/retry/reduced-motion/narrow UI smoke
- Lite source defaults and Full-to-Lite migration UI smoke
- update-check source and UI smoke
- packaged Lite dependency boundary and build-flavor verification
- packaged stdio Gateway smoke at version `0.6.5`
- packaged Lite settings UI smoke with isolated data roots
- Developer ID and Hardened Runtime deep signature verification
- Apple notarization acceptance, stapler validation, Gatekeeper assessment, and
  DMG integrity verification
- post-upload checksum, signature, stapler, and Gatekeeper verification

## Artifact Verification

- macOS Lite SHA-256:
  `92e7d653b13348cc9d4e8e157c8445ba8e9ee56adc0d0640bab3e1e5bd8e0dc7`

## Distribution Boundary

This release is macOS Apple Silicon/arm64 Lite only. It does not include the
built-in embedding dependency closure; use Ollama or disable embeddings. Full,
Windows, Intel macOS, automatic installation, and Mac App Store distribution
are outside this release.
