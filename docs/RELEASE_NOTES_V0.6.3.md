# ClaraCore Desktop v0.6.3 Packaged-Test Checkpoint

> Status: local macOS arm64 Lite packaged-test checkpoint; not a public GitHub Release
> Public stable release: `v0.5.8`

## Included

- Memory Controller Stage B rejects keyword-only candidates and applies the
  vector score and margin gates to hybrid keyword+vector candidates.
- Context formatting honors explicit budgets through the 900-token hard cap;
  full-width CJK punctuation is included in token estimates.
- Ledger cleanup scans and deletes in 500-row batches. Capacity cleanup never
  deletes feedback-bearing decisions, while the longer feedback age policy
  remains explicit.
- Retrieval cache identity matches the normalized retrieval input, uses one
  watermark-key invalidation mechanism, and has a defensive empty-LRU stop.
- InnerLife afterthought failure is isolated from per-Agent daemon ticks.
- Overview recent shares are loaded only at the view boundary; hot Lite
  snapshots remain lean.
- Streamable HTTP applies both global and per-Agent active-call caps. Agent
  identity is derived only from the transport header/query boundary, never tool
  arguments.
- Invalid persisted Memory Controller modes fail explicitly instead of silently
  degrading to `off`.

## Validated

- complete source smoke suite and repository static checks
- Memory Controller orchestration, ledger, cache, Gateway, and scheduler tests
- Streamable HTTP identity and per-Agent backpressure tests
- overview, InnerLife compact snapshot, and Gateway-context performance tests
- unsigned 293.0 MiB macOS arm64 Lite application at version `0.6.3`
- packaged Lite settings, update UI, and stdio Gateway checks

## Product Boundary

- Memory Controller remains `off`/`observe` only in product settings and the
  Gateway. This checkpoint does not enable canary injection.
- No tag, GitHub Release, deployment, or automatic-update publication is
  included.
- Signing, notarization, Windows, Intel macOS, Full packaging, and installed
  endurance validation remain outside this Lite checkpoint.
