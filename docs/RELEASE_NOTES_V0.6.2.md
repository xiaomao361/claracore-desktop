# ClaraCore Desktop v0.6.2 Development Checkpoint

> Status: installed-test checkpoint; not a public GitHub Release
> Public stable release: `v0.5.8`

## Included

- The `0.6.0` deterministic, authenticated, observe-only Memory Controller,
  bounded ledger, operator mode, feedback contract, and Trace evidence.
- The `0.6.1` split runtime snapshots, targeted Gateway reads, persisted
  background jobs, multi-Agent SQLite/HTTP baselines, and bounded Gateway trace
  retention.
- The `0.6.2` per-Agent InnerLife history retention, compact detail snapshots,
  fair HTTP admission/backpressure, and simultaneous stdio SQLite startup fix.
- Agent Access copy now states the live Memory Controller contract and keeps
  explicit `memoria_search` separate from observe-only `memory_context`.
- A copy-ready Hermes/Lara reconnect and verification contract.

## Validated

- `npm run test:smoke`
- `npm run test:gateway:http`
- source and packaged Lite settings/update checks
- installed macOS arm64 Lite app at version `0.6.2`
- 46.5 MB product-data-copy startup, overview, InnerLife, and navigation reads
- normal 1/4/8-Agent HTTP reads and a 240-call overload burst
- five-minute installed endurance with zero tool failures and no monotonic RSS
  growth
- real-data-copy InnerLife retention with protected work preserved and
  `quick_check=ok`

## Not Claimed

- No tag or GitHub Release is created by this checkpoint.
- No deployment or automatic update publication is included.
- The 30-minute endurance release gate remains open.
- Signing, notarization, Windows, and Intel macOS validation remain outside this
  local Lite acceptance.
