# 1.0 GUI brand refresh — 2026-10-19

The user approved a small visual update to the existing product mark after
reviewing the new GUI. The C, shared line and node remain the identifying form.
This update does not introduce a library of Agent or tool brand icons.

## Visual changes

- The C and shared-line path geometry, placement and stroke sizes remain.
- The application icon changes from warm white/black/green-blue to cool
  white/deep purple/lavender/ice blue. Its shadow changes from dy 22 / blur 28 /
  opacity .16 to dy 10 / blur 14 / opacity .10.
- The node retains its center and outer circle radius; its outline changes from
  42 to 34 source units and the inner point from radius 29 to 26.
- The header uses flat light and dark SVGs selected by `body[data-theme]`,
  respecting the app's manual appearance setting as well as its system mode.
- The wordmark receives the same palette, lighter typography and underline.
  Its wording remains unchanged. The monochrome symbol has a transparent
  knockout around the node for constrained placements.
- The color tray family shares the palette. The macOS monochrome template SVG
  and its existing PNGs remain byte-identical to the original files.

## Palette

| Role | Light / application | Dark header |
| --- | --- | --- |
| Main ink | `#443256` | `#e5dcf3` |
| Shared line / point | `#795bac` | `#bda3eb` |
| Ice endpoint | `#6088b0` | Flat lavender line |
| Flat background | `#f6f3fc` | `#282333` |

Measured foreground/background pairs are at least 3.29:1 for the listed graphic
colors; the wordmark description is 5.83:1. These are source-palette checks,
not a claim about every antialiased edge in every rendered size.

## Sources and build

Canonical vectors live under `assets/brand/` and `assets/tray/`. Run
`npm run build:brand` on macOS to regenerate the derived families with the
existing Sharp runtime and native icon compiler. The generator leaves the
unchanged monochrome menu bar family alone and reports failures as failures.

Static before/after rendering and asset evidence are in
`out/brand-review-20261019.4/preview.png` and `verification.json`.
Native ICNS round-trip inspection preserves every frame's alpha and opaque
pixels. Native legacy 16px/32px encoding adjusts some partially transparent
edge RGB values; eight other frames match all decoded pixels exactly.
The Windows ICO has seven validated PNG frames from 16px through 256px.

## Acceptance boundary

The vectors and derived assets were inspected as local images, including
light/dark header specimens and small-size variants. No app window was opened,
no Dock or menu bar interaction was performed, and no installed app was replaced.
The user subsequently reported that the result looked good and approved the
`1.0.0` version. Actual installed header, Dock and installer behavior still
requires the user's observation. Following the local checkpoint, the user
authorized the [1.0.0 public release](../RELEASE_NOTES_V1.0.0.md) on October 20.
Agent identity and activity code is byte-identical to the third GUI trial.
