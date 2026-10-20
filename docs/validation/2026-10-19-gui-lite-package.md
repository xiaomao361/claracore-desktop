# GUI Lite local trial — 2026-10-19

The user requested a Lite installer to inspect the new GUI. This is a local
macOS Apple Silicon trial, not a public 1.0 release. No installation or UI
interaction was performed by the agent.

## Artifact

- Source and bundle version: `0.9.2`
- Local build ID: `gui-20261019.1`
- Flavor / target: Lite / macOS arm64
- Electron: `43.0.0`
- DMG: `out/gui-lite-20261019.1/ClaraCore-Desktop-0.9.2-gui-20261019.1-lite-arm64.dmg`
- Size: 126,364,819 bytes (about 126 MB)
- SHA-256: `fb0009225a90429d763542e3373a72a70a87b3f7cb995ea24101f16a200ca880`
- Signing: local ad-hoc signature with hardened runtime; not notarized.
- Package recipe: `scripts/gui-lite-builder-config.js`
- Evidence: `out/gui-lite-20261019.1/verification.json` and `SHA256SUMS.txt`

Build command:

```sh
./node_modules/.bin/electron-builder --mac --arm64 --config scripts/gui-lite-builder-config.js --publish never
```

## Verified

- Lite package boundary passed: no bundled node_modules or model payloads.
- ASAR contains the GUI additions; 402 non-package.json files match the current
  source byte-for-byte. Package metadata and bundle version match the values above.
- `codesign --verify --deep --strict` passed; `hdiutil verify` reported VALID.
- A read-only, non-browsing DMG mount confirmed that ASAR, bundle metadata, and
  executable match the verified unpacked app; the volume was then detached.
- The packaged SQLite Node and CLI probes both passed using Electron run-as-node.
- The packaged Gateway smoke passed with temporary data roots and a dynamic
  test port. It covered synthetic Memory, Shared Line, and handoff paths;
  the controller remained off by default. No validation processes remained.
- The offline home-understanding smoke passed again; `git diff --check` passed.
  The implementation checkpoint had already passed `npm run check`.

Runtime probes used the package without opening windows. They did not access
live business data or call a real model. These checks do not establish visual
or interaction acceptance.

## User observation pending

Install the DMG after quitting the existing app, then inspect topic selection,
full reading, the folded activity area, navigation and window dragging, long
text at narrow widths, and light/dark appearance. Existing unrelated model and
permission observations remain outside this packaging verification.
