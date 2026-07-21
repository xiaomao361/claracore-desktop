# ClaraCore Desktop macOS Packaging

## Current Target

The current public package line is `v0.5.8`. macOS and Windows artifacts remain
unsigned.

The current development and installed-test line is `0.6.2`. Its validated
local macOS artifact is the unsigned arm64 Lite app at
`dist-lite/mac-arm64/ClaraCore Desktop.app` (about 293 MiB). This local app is
not a tag, GitHub Release, or automatic-update publication.

It is enough for:

- Opening the Desktop app on the local Mac.
- Verifying the Desktop-owned SQLite data directory.
- Verifying the packaged Gateway MCP entry.
- Testing agent setup before code signing and notarization.

The published unsigned packages are suitable for the current small tester group
but not a signed/notarized general-public distribution.

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
dist/ClaraCore-Desktop-0.5.8-arm64.dmg
dist-lite/ClaraCore-Desktop-0.5.8-lite-arm64.dmg
ClaraCore-Desktop-0.5.8-x64-Setup.exe
ClaraCore-Desktop-0.5.8-lite-x64-Setup.exe
```

The `0.5.8` Full/Lite arm64 DMGs and Windows x64 NSIS installers are published
in GitHub Release `v0.5.8`. Windows Full/Lite are built on `windows-latest`; the
packaged Full executable must generate a real 512-dimensional built-in
embedding before its installers are uploaded.

## Manual Release Update Channel

The manual update check reads the latest public stable GitHub Release, then
opens or copies the generic Release page so the user chooses Full/Lite and the
correct platform. Build publishable assets with `npm run dist:mac`,
`npm run dist:mac:lite`, `npm run dist:win`, and `npm run dist:win:lite`, then
upload them to the same `v<version>` GitHub Release. Use these names:

```text
ClaraCore-Desktop-<version>-arm64.dmg
ClaraCore-Desktop-<version>-lite-arm64.dmg
ClaraCore-Desktop-<version>-x64-Setup.exe
ClaraCore-Desktop-<version>-lite-x64-Setup.exe
```

All four distribution scripts pass `--publish never` to electron-builder.
Creating the tag, GitHub Release, and uploaded assets is an explicit release
step after validation; CI packaging never publishes implicitly.

macOS artifacts are built and validated locally. Windows Full and Lite
artifacts are built by the manually triggered
`.github/workflows/build-windows-release.yml` workflow on `windows-latest`. The workflow
must run the packaged Full built-in embedding smoke before its installers are
accepted, so incomplete `sharp`/libvips native DLL packaging fails in CI instead
of on a tester's machine.

The app opens the validated GitHub Release URL in the system browser. If the API
check fails, the fixed `releases/latest` address remains available to open or
copy. It does not download, execute, mount, replace, relaunch, or silently
install anything.
Run `npm run test:update` for mocked release and Settings UI coverage before
performing a live published-Release check.

`v0.5.8` is published at
`https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.5.8` with Full
and Lite macOS DMGs, Full and Lite Windows installers, and `SHA256SUMS.txt`.

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

Validated locally for the installed `0.6.2` Lite checkpoint:

- bundle version and build flavor are `0.6.2` and `lite`;
- the executable is arm64 and the package excludes built-in model resources
  and the Full embedding dependency closure;
- packaged Lite settings and update UI smokes pass;
- installed Gateway normal 1/4/8-Agent reads, 240-call backpressure, 46.5 MB
  product-data-copy UI reads, and five-minute endurance pass;
- the generic Full-vs-Lite package-size comparator was not run because no
  `0.6.2` Full artifact was built.

Validated for `0.5.8`:

- source checks pass: `npm run check`, `npm run test:smoke`, `npm run
  test:trace`, `npm run test:home`, `npm run test:home:performance`, `npm run
  test:agent-access`, `npm run test:ux:polish`, `npm run test:update`, and `npm
  run test:lite`
- packaged macOS Full and Lite applications report version `0.5.8`
- both macOS DMGs pass `hdiutil verify`
- macOS Full built-in Memory embedding generates a real 512-dimensional vector
- macOS package boundary: Full `532.1 MiB`, Lite `292.7 MiB`, saving `239.4
  MiB`
- packaged macOS Full Gateway and update UI smokes pass; packaged Lite Trace UI
  smoke passes
- GitHub Actions run
  [29558439711](https://github.com/xiaomao361/claracore-desktop/actions/runs/29558439711)
  builds both Windows NSIS installers from a clean Windows dependency install
- packaged Windows Full built-in Memory embedding generates a real
  512-dimensional vector
- Windows package boundary: Full `654.2 MiB`, Lite `372.0 MiB`, saving `282.1
  MiB`
- downloaded Windows artifacts match the SHA-256 checksums generated by the
  Windows runner

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
- Validate the real installed Windows Full build against a local Ollama model.
- Consider automatic update installation only after signing and the release
  workflow are stable.
