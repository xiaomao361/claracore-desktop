# GUI Lite fourth local trial — 2026-10-19

The user approved the existing product Logo's limited visual refresh. This
trial keeps the third GUI's behavior and Agent signatures and adds the updated
product assets described in [the brand record](../design/V1_BRAND_REFRESH.md).

## Local artifact

- Product / bundle version: `0.9.2`
- Local build ID: `gui-20261019.4`
- Target: macOS arm64 Lite, Electron `43.0.0`
- DMG: `out/gui-lite-20261019.4/ClaraCore-Desktop-0.9.2-gui-20261019.4-lite-arm64.dmg`
- Recipe: `scripts/gui-lite-builder-config.js`, `--publish never`
- Signing: local ad-hoc hardened runtime; not notarized or published.
- Exact size and SHA-256: `out/gui-lite-20261019.4/verification.json` and
  `SHA256SUMS.txt`.

## Validation

`npm run check` and `git diff --check` passed. All source vectors parse; both
explicit header appearance resources resolve. The maintained C/shared-line
paths retain their geometry. The Agent connection component matches the
third-trial source hash. The macOS monochrome tray template and its PNGs remain
byte-identical to their original versions.

PNG size/alpha checks, native ICNS decode with alpha/opaque-pixel comparison,
seven ICO PNG frame checks, source-palette contrast measurements and a repeat
generation check passed. Raster/container output is deterministic on this host.
See `out/brand-review-20261019.4/verification.json` for the exact measurements
and native ICNS edge-conversion limits. Windows ICO validation does not prove
Windows installation acceptance.

The before/after asset specimen is
`out/brand-review-20261019.4/preview.png`. This is a static rendering of source
assets, not a screenshot or walkthrough of the running application.

No installed app, Dock, menu bar or user window was operated. User observation
of the new header assets and Dock/installer icon remains pending.


Packaged checks passed: Lite boundary, deep strict signature, DMG integrity,
read-only mounted ASAR/metadata/executable/icon parity, and packaged SQLite
Node/CLI plus Gateway synthetic-data smokes. The 406 packaged source files
match the workspace byte-for-byte; the bundle references the regenerated
`icon.icns` and its bytes match the maintained asset. Validation executable
processes remaining: zero. No application window was launched for these checks.

- Size: 125,761,106 bytes (about 126 MB)
- SHA-256: `50ea4674017615e2042f9476ac4f0d4afe24772b6dbc10301e2cdc51320c7ba9`
