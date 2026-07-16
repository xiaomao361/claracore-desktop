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
dist/ClaraCore-Desktop-0.5.4-arm64.dmg
dist/ClaraCore-Desktop-0.5.4-x64-Setup.exe
```

The unpacked `0.5.4` `.app`, arm64 DMG, and Windows x64 NSIS installer have
been produced locally. Windows runtime installation still requires acceptance
on a real Windows x64 computer.

## Manual Release Update Channel

The manual update check reads the latest public stable GitHub Release and
selects an exact asset for `darwin-arm64` or `win32-x64`. Build publishable
assets with `npm run dist:mac` and `npm run dist:win`, then upload both files to
the same `v<version>` GitHub Release. Use these names:

```text
ClaraCore-Desktop-<version>-arm64.dmg
ClaraCore-Desktop-<version>-x64-Setup.exe
```

The app opens the validated GitHub download URL in the system browser. It does
not download, execute, mount, replace, relaunch, or silently install anything.
Run `npm run test:update` for mocked release and Settings UI coverage before
performing a live published-Release check.

## Gateway In Packaged Mode

The running packaged app exposes the preferred Streamable HTTP MCP endpoint at
the configured localhost port. Agent Access shows the current URL, bearer-token
source, and v0.5 caller identity headers.

The packaged app also supports a stdio compatibility Gateway. The generated
Agent Access config launches the bundled Node entry with `ELECTRON_RUN_AS_NODE`:

```bash
ELECTRON_RUN_AS_NODE=1 \
  "/path/to/ClaraCore Desktop.app/Contents/MacOS/ClaraCore Desktop" \
  "/path/to/ClaraCore Desktop.app/Contents/Resources/app.asar/core/gateway/mcp-server.js"
```

The older `--gateway` app mode remains a compatibility path, not the preferred
new-client setup.

Stdio agent setup should include:

- command: the packaged app executable
- args: the packaged `app.asar/core/gateway/mcp-server.js` path
- env: `ELECTRON_RUN_AS_NODE=1`, stable `CLARACORE_AGENT_ID`, optional
  `CLARACORE_CLIENT_ID` / `CLARACORE_CONVERSATION_ID`, and
  `CLARACORE_DESKTOP_DATA_DIR` only for a custom data directory

By default, packaged Desktop data is created under:

```text
~/Library/Application Support/claracore-desktop/data
```

Development mode still uses:

```bash
node core/gateway/mcp-server.js
```

## Validation Status

Validated locally for `0.5.4`:

- packaged application reports version `0.5.4`
- `npm run check`
- `npm run test:update`
- packaged macOS update UI smoke with mocked `0.5.5` and up-to-date states
- `npm run pack:mac`
- `npm run dist:mac` and a valid `hdiutil verify` result for the `0.5.4` DMG
- `npm run dist:win` produced the deterministic x64 NSIS installer; real
  Windows installation remains pending
- focused Memory-link and Memory UI smoke tests
- Streamable HTTP Gateway smoke, including machine-readable `/agent/setup`
  guidance for current/historical Memory writes
- focused Memory and Gateway smoke tests cover `memoria_supersede` plus
  current/historical recall semantics before packaging
- packaged Gateway smoke passes from `dist/mac-arm64/ClaraCore Desktop.app`
- packaged Gateway initialize reports server version `0.5.4`

Previously validated packaging behavior retained by this build:

- packaged `.app` starts as a Gateway with `--gateway`
- packaged Desktop UI opens and shows Agent Setup with `--gateway`
- packaged Desktop UI shows the Home page first-run check
- packaged app includes `assets/icon.icns` as the macOS app icon, with matching SVG/PNG sources under `assets/`
- packaged Desktop UI can create and list a product database backup
- packaged Desktop backup creates both a `.db` file and a sidecar `.json` manifest
- packaged Desktop backup shows `verified` and `quick_check: ok` after export
- packaged Desktop can restore a verified backup after confirmation and the `RESTORE` phrase
- packaged Desktop shows a current-vs-target restore preview before execution
- packaged Desktop restore preview shows Memory records that will return and records that will be removed
- `npm run dist:mac` for `0.5.1`
- `hdiutil verify` reports the v0.5.1 DMG checksum as valid
- the last installed Streamable HTTP MCP validation used v0.5.0 and recorded separated
  `agentId`, `clientId`, and `conversationId` trace context

Known remaining release work:

- Add code signing.
- Add notarization.
- Complete real Windows x64 installation acceptance.
- Validate the first live old-to-new flow when a version newer than `0.5.4` is
  published.
- Consider automatic update installation only after signing and the release
  workflow are stable.
