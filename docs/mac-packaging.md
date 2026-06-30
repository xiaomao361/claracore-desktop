# ClaraCore Desktop macOS Packaging

## Current Target

The current macOS package is an unsigned local build for product-core validation.

It is enough for:

- Opening the Desktop app on the local Mac.
- Verifying the Desktop-owned SQLite data directory.
- Verifying the packaged Gateway MCP entry.
- Testing agent setup before code signing and notarization.

It is not yet a public release artifact.

## Commands

Create an unpacked `.app`:

```bash
npm run pack:mac
```

Create a `.dmg`:

```bash
npm run dist:mac
```

Current output:

```text
dist/mac-arm64/ClaraCore Desktop.app
dist/ClaraCore-Desktop-0.1.0-arm64.dmg
```

## Gateway In Packaged Mode

The packaged app supports Gateway mode directly:

```bash
"/path/to/ClaraCore Desktop.app/Contents/MacOS/ClaraCore Desktop" --gateway
```

Agent setup should include:

- command: the packaged app executable
- args: `["--gateway"]`
- env: `CLARACORE_DESKTOP_DATA_DIR` only when using a custom data directory

By default, packaged Desktop data is created under:

```text
~/Library/Application Support/ClaraCore Desktop/data
```

Development mode still uses:

```bash
node core/gateway/mcp-server.js
```

## Validation Status

Validated locally:

- `npm run check`
- `npm run pack:mac`
- packaged `.app` starts as a Gateway with `--gateway`
- packaged Gateway can create and search a Memory record
- packaged Desktop UI opens and shows Agent Setup with `--gateway`
- packaged Desktop UI shows the Home page first-run check
- packaged app includes `assets/icon.icns` as the macOS app icon, with matching SVG/PNG sources under `assets/`
- packaged Desktop UI can create and list a product database backup
- packaged Desktop backup creates both a `.db` file and a sidecar `.json` manifest
- packaged Desktop backup shows `verified` and `quick_check: ok` after export
- packaged Desktop can restore a verified backup after confirmation and the `RESTORE` phrase
- packaged Desktop shows a current-vs-target restore preview before execution
- packaged Desktop restore preview shows Memory records that will return and records that will be removed
- `npm run dist:mac`
- generated DMG mounts and contains `ClaraCore Desktop.app`

Known remaining release work:

- Add code signing.
- Add notarization.
- Add update/release channel only after the product data model is stable.
