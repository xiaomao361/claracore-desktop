# Version And Branching

## Current Truth

- `main` is the working Desktop line.
- `package.json` is the product-version source through `core/version.js`.
- Current development version: `0.6.12`.
- Current public release: `0.6.12`.
- Tag `v0.6.12` is the current stable GitHub Release.

`0.6.12` is the current public release. It preserves hydrated Shared Line
catalogs across unrelated scoped refreshes, keeps session afterthoughts out of
the shareable queue until generated content is complete, preserves retry and
terminal-failure audit behavior, and includes the installed-app-only
login-startup preference. See
[v0.6.12 Release Notes](RELEASE_NOTES_V0.6.12.md).

`0.6.11` was an unpublished login-startup development checkpoint. See
[v0.6.11 Release Notes](RELEASE_NOTES_V0.6.11.md).

`0.6.10` was the previous public release. It makes context delivery
minimum-sufficient by default, adds server-enforced catalog projections and
one-object expansion paths, light write acknowledgements, bounded InnerLife
and trace reads, and a final Gateway response ceiling. It ships Developer ID
signed and Apple-notarized macOS Apple Silicon Full/Lite DMGs plus verified
Windows x64 Full/Lite installers. See
[v0.6.10 Release Notes](RELEASE_NOTES_V0.6.10.md).

`0.6.9` publishes the unified Desktop design language, direct human-facing
copy, versioned searchable Agent Guide, single-model InnerLife settings, and
clearer Memory/Trace/Logs evidence boundaries. It is a Developer ID signed and
Apple-notarized macOS Apple Silicon Full/Lite release with Windows x64
Full/Lite installers. Intel macOS and Mac App Store packages are outside this
release. See
[v0.6.9 Release Notes](RELEASE_NOTES_V0.6.9.md).

`0.6.8` was a local design checkpoint and was never published.

Older release notes, completed plans, and checkpoint-specific handoffs are
historical evidence under [archive](archive/README.md). They are not current
implementation or release instructions.

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
- Every version change also reviews the Agent Guide and explicitly updates
  `DOCS_RELEASE` in `core/gateway/docs.js`. `npm run test:context-budget`
  rejects a product/guide version mismatch.
- A public release requires release notes, focused tests, the relevant package
  checks, a tag/release entry, and explicit authorization to push/publish.
- `收口` means docs, validation, commit, push, and local/remote parity; explicit
  boundaries such as “不提交远程” override that shortcut.
- Packaging and deployment are separate from a local code checkpoint.

Current packaging commands and artifact checks live in
[macOS Packaging](mac-packaging.md). Current public-release details live in
[v0.6.12 Release Notes](RELEASE_NOTES_V0.6.12.md).

## Current Release

`0.6.12` is the current source checkpoint and public release, tagged
`v0.6.12`. Its macOS Apple Silicon Full/Lite DMGs are Developer ID signed,
Apple-notarized, stapled, and Gatekeeper accepted. Its Windows x64 Full/Lite
installers are built and package-verified on `windows-latest`. All four assets
are published with portable per-platform SHA-256 manifests.

- 2026-08-12: the complete human UI adopts one design language; the Agent Guide
  is versioned and searchable; InnerLife settings use one migrated model.
- 2026-08-13: Agent context delivery adopts minimum-sufficient defaults,
  progressive one-object expansion, server-side projections, and byte guards.
- 2026-08-13: Agent-facing boolean names, secret-safe status, trace evidence,
  core-module filters, dialogs, Memoria paging, and compact responsive layouts
  are aligned under the same contract and visual language.
- 2026-08-14: Settings adds an operating-system-backed login-startup preference
  for installed macOS and Windows builds.
- 2026-08-25: Session afterthoughts stay drafting until generated content is
  ready, and legacy unfinished placeholders are removed from share candidates.
- 2026-08-26: Unrelated scoped refreshes preserve hydrated Shared Line Agent
  context and archived-line catalogs; the Full/Lite matrix is published as
  `v0.6.12`.
- See [v0.6.12 Release Notes](RELEASE_NOTES_V0.6.12.md).
- See [v0.6.11 Release Notes](RELEASE_NOTES_V0.6.11.md).
- See [v0.6.10 Release Notes](RELEASE_NOTES_V0.6.10.md).
- See [v0.6.9 Release Notes](RELEASE_NOTES_V0.6.9.md).

### Previous checkpoints

- `v0.6.10` was the previous signed, notarized Full/Lite public release.
- `v0.6.9` was an earlier signed, notarized Full/Lite public release.
- `0.6.8` was a local design checkpoint and was never published.
- `v0.6.7` was the newest signed, notarized public release before `v0.6.9`.
- `0.6.6` was an unpublished source and local-package checkpoint for the
  context-budget work later released in `0.6.7`.

## History

Detailed checkpoint history through the start of `0.5.7` is preserved in
[archive/VERSION_HISTORY_PRE_V0.5.7.md](archive/VERSION_HISTORY_PRE_V0.5.7.md).
Older release notes and completed release/build handoffs are indexed from
[archive/README.md](archive/README.md).
