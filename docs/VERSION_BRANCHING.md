# Version And Branching

## Current Truth

- `main` is the working Desktop line.
- `package.json` is the product-version source through `core/version.js`.
- Current development version: `0.6.7`.
- Current public release: `0.6.7`.
- Tag `v0.6.7` is the current stable GitHub Release.

`0.6.7` publishes the context-budget work begun at the unpublished `0.6.6`
checkpoint, makes automatic context Memory-only, and restores complete everyday
Memory workflows to the core tool profile. It is a Developer ID signed and
Apple-notarized macOS Apple Silicon Lite release. Full, Windows, and Intel macOS
packages are outside this release. See
[v0.6.7 Release Notes](RELEASE_NOTES_V0.6.7.md).

`0.6.5` is the previous public release. It publishes the post-`0.6.4`
architecture/runtime hardening and complete Home states as a signed and
notarized macOS Apple Silicon Lite DMG. See
[v0.6.5 Release Notes](RELEASE_NOTES_V0.6.5.md).

`0.6.4` is the previous stable release. It provides signed and Apple-notarized
macOS Apple Silicon Full/Lite DMGs and unsigned Windows x64 Full/Lite NSIS
installers. See [v0.6.4 Release Notes](RELEASE_NOTES_V0.6.4.md).

`0.6.3` is the previous stable release. It carries
the `0.6.0` observe-only Memory Controller, the `0.6.1` measured performance
pass, the `0.6.2` multi-Agent runtime hardening, and the `0.6.3` pre-canary
safety fixes. Its small-audience distribution is the unsigned macOS arm64 Lite
DMG; Full, Windows, Intel macOS, signing, and notarization remain outside this
release. See
[v0.6.3 Release Notes](RELEASE_NOTES_V0.6.3.md),
[v0.6.2 Performance Hardening](V0.6.2_PERFORMANCE_HARDENING_PLAN.md), and the
[Hermes Update Guide](HERMES_V0.6.2_UPDATE.md).

The `0.5.8` release adds the read-only Trace page and its bounded aggregate
snapshot to the Agent First page set, Home Shared Horizon, strict test-instance
isolation, and partial MCP `memoria_update` semantics. See
[Trace Page](TRACE_PAGE.md), [Home Shared Horizon](HOME_SHARED_HORIZON.md), and
the current architecture/code-map docs for the maintained contract.

## Isolated Development

Use:

```bash
npm run start:next
```

The launcher sets separate product-data and Electron user-data roots:

```text
CLARACORE_DESKTOP_DATA_DIR=~/Library/Application Support/claracore-desktop-next/data
CLARACORE_DESKTOP_USER_DATA_DIR=~/Library/Application Support/claracore-desktop-next
CLARACORE_DESKTOP_TEST_INSTANCE=1
```

Desktop rejects a test instance without an explicit user-data root. Random-port
Gateway tests enforce the same boundary so `agent-gateway.json` cannot fall
through to the daily-use Application Support directory.

## Checkpoint Rules

- Keep a small validated fix at the existing development version unless the
  accumulated change set is worth a new test checkpoint.
- A local checkpoint may update code, tests, and docs without creating a tag,
  release, package, or remote push.
- Record current behavior in maintained contracts, not a new session handoff.
- Move completed plans and one-off research to `docs/archive/`.

## Release Rules

- Version changes update `package.json` and `package-lock.json` together.
- A public release requires release notes, focused tests, the relevant package
  checks, a tag/release entry, and explicit authorization to push/publish.
- `收口` means docs, validation, commit, push, and local/remote parity; explicit
  boundaries such as “不提交远程” override that shortcut.
- Packaging and deployment are separate from a local code checkpoint.

Current packaging commands and artifact checks live in
[macOS Packaging](mac-packaging.md). Current public-release details live in
[v0.6.7 Release Notes](RELEASE_NOTES_V0.6.7.md).

## Current Checkpoint

`0.6.7` is the current public release on `main`, tagged `v0.6.7`. Its macOS
Apple Silicon Lite DMG is Developer ID signed, Apple-notarized, stapled,
Gatekeeper accepted, and published with a SHA-256 checksum.

- 2026-08-07: automatic context becomes Memory only. See
  [v0.6.7 Release Notes](RELEASE_NOTES_V0.6.7.md).
- The bump off `0.6.6` was not cosmetic: that build delivered InnerLife shares
  automatically and this one never does. Four builds had reported `0.6.6`, and a
  running app exposes only its version string, so one string covered four
  behaviours.

### Previous checkpoint

`0.6.6` was a **source checkpoint**, never published.

- 2026-08-07: context budget work landed. See
  [v0.6.6 Release Notes](RELEASE_NOTES_V0.6.6.md) and
  [v0.6.6 Context Budget Plan](V0.6.6_CONTEXT_BUDGET_PLAN.md).
- Local artifact: `dist-lite/ClaraCore-Desktop-0.6.6-lite-arm64.dmg`
  (unsigned, arm64 Lite, sha256
  `d3461ebf6cd2f1184d53f6bf463e5972ad34885efe0dc29e68e5939ba5a0b019`),
  verified with `npm run test:package:lite` and the packaged Gateway smoke.
- `v0.6.5` was the newest signed, notarized public release before `v0.6.7`.

## History

Detailed checkpoint history through the start of `0.5.7` is preserved in
[archive/VERSION_HISTORY_PRE_V0.5.7.md](archive/VERSION_HISTORY_PRE_V0.5.7.md).
Older release notes and completed release/build handoffs are indexed from
[archive/README.md](archive/README.md).
