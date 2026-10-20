# GUI Lite second local trial — 2026-10-19

The user supplied a screenshot and liked the overall direction, but found the
four-module convergence unclear and the separate white activity panel intrusive.
The follow-up replaces that panel with a compact Agent light beside the heading
and gathers four module entrances into the shared reading surface.

## Artifact

- Version: `0.9.2`; local build ID: `gui-20261019.2`
- Target: macOS arm64, Lite, Electron `43.0.0`
- DMG: `out/gui-lite-20261019.2/ClaraCore-Desktop-0.9.2-gui-20261019.2-lite-arm64.dmg`
- Size: 126,370,715 bytes (about 126 MB)
- SHA-256: `700800b48080b16f195afc7f8a47e7b9ac33e300f662b632c902b2c1532646d6`
- Signing: local ad-hoc, hardened runtime; not notarized or published.
- Recipe: `scripts/gui-lite-builder-config.js`, `--publish never`
- Machine-readable evidence: `out/gui-lite-20261019.2/verification.json`

## Verified boundary

- `npm run check` passed; subsequent affected offline Home, syntax and CSS
  parsing checks passed. `git diff --check` passed.
- Offline scenarios cover exact topic selection, recorded reference categories,
  unknown references, explicit empty references, no private thought reads,
  request failures, active request counters, stale counter expiry, recent
  activity expiry, hidden/away lifecycle and the motion pause control.
- Lite boundary, deep strict signature verification and DMG integrity passed.
- All 404 non-package.json files in ASAR match current source byte-for-byte;
  the new connection component and styles are present. Product and bundle
  versions match; the build flavor and ID match the values above.
- The mounted read-only DMG matches the verified unpacked app for ASAR, bundle
  metadata and executable. It was mounted without browsing or opening Finder,
  then detached.
- Packaged SQLite Node and CLI probes passed. Packaged Gateway smoke passed
  using synthetic data, temporary roots and a test port; the controller stayed
  off. Verification executable processes remaining: zero.

No application window, installation, real data access or real model call was
performed for this verification. The future GUI and performance smokes were
adapted to the compact connection component, syntax checked, and not executed.

## Semantics and user observation

Four module roles are visible together. Only the selected line and recognized
recorded references get solid connections; arbitrary external paths stay in
the reference reader. This structure does not manufacture a new synthesized
conclusion or imply that every module contributed to the selected topic.

The HTTP Gateway has no persistent online session. Only a fresh per-agent live
request counter supports “interacting”; completed calls support recent activity.
Observe the four-part convergence, the small light's placement, light/dark and
narrow-window layout, pause behavior and actual request-driven transitions.
Visual and interaction acceptance remain pending the user's observation.
