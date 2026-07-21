# Version And Branching

## Current Truth

- `main` is the working Desktop line.
- `package.json` is the product-version source through `core/version.js`.
- Current development version: `0.6.1`.
- Current public release: `0.5.8`.
- Tag `v0.5.8` is the current stable GitHub Release.

`0.6.1` is the current development test checkpoint. It carries the `0.6.0`
Memory Controller observe-only path forward and adds a measured, staged
performance pass across Desktop snapshots, Gateway context, durable background
work, multi-Agent transport, and trace retention. It is not yet a public
release. The frozen execution plan is
[v0.6.1 Performance Plan](V0.6.1_PERFORMANCE_PLAN.md).

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
[v0.5.8 Release Notes](RELEASE_NOTES_V0.5.8.md).

## History

Detailed checkpoint history through the start of `0.5.7` is preserved in
[archive/VERSION_HISTORY_PRE_V0.5.7.md](archive/VERSION_HISTORY_PRE_V0.5.7.md).
Older release notes and completed release/build handoffs are indexed from
[archive/README.md](archive/README.md).
