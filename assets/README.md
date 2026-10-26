# ClaraCore Desktop Logo Assets

The ClaraCore mark uses one shared language across product surfaces:

- Open C ring: the controllable local core.
- Shared line: continuity across work sessions and agents.
- Inner point: the active memory/current-position state.

Recommended usage:

- `brand/claracore-mark.svg`: primary app icon source and large product mark.
- `brand/claracore-mark-flat.svg`: small digital placements where shadows should be avoided.
- `brand/claracore-mark-flat-dark.svg`: the corresponding dark-appearance mark; the Desktop header selects it using the app's theme.
- `brand/claracore-symbol-mono.svg`: monochrome docs, favicons, masks, and constrained UI.
- `brand/claracore-wordmark.svg`: README, website, installer, release notes, and splash/about surfaces.
- `tray/claracore-tray-template.svg`: macOS template menu bar icon source.
- `tray/claracore-tray-color.svg`: Windows/Linux tray source.
- `icon.icns`: generated macOS application icon.
- `icon.ico`: generated Windows application icon.
- `generated/`: generated PNG renditions for common app, docs, web, and tray sizes.

Do not edit generated PNG or ICNS files directly. Update the source SVGs, then regenerate the derived assets.

## Visual identity

The open C and shared-line paths retain their geometry. Cool white, deep purple,
lavender and ice blue form the current palette; the application icon uses
a lighter shadow and a less heavy node outline. Header marks are flat, with
explicit light and dark appearances. The wordmark retains its existing words.
The macOS single-color tray template and its generated PNGs are preserved.

Run `npm run build:brand` from the full development checkout on macOS. It uses
the lockfile's existing `sharp` dependency and the system `iconutil` compiler;
no application windows are launched. The command regenerates application PNGs,
the macOS iconset/ICNS, Windows ICO, flat previews, the wordmark and color tray
PNGs from their SVG sources. It does not regenerate the unchanged menu bar
template family. Windows ICO frames are PNG-compressed, including a 256px frame.

Asset rendering is separate from appearance acceptance in the running app.
See [the brand refresh record](../docs/UI_DESIGN_LANGUAGE.md).

## Documentation and website graphics

The project illustration is `website/assets/continuity-art.webp`, generated for
ClaraCore with the built-in image generation tool and converted from PNG to
WebP. It depicts continuity using a lavender ribbon and ice-blue nodes; it is
not a product screenshot. The semantic SVG diagram lives in
`docs/images/how-it-works.svg`. Both are used by the public README and website.
