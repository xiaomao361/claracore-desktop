# ClaraCore Desktop macOS Packaging

## Current Target

The current public stable package line is `v0.6.3`. Its small-audience
distribution is unsigned macOS arm64 Lite.

The current development line is `0.6.4`, but no `0.6.4` package has been built.
The last validated packaged line remains `0.6.3`. Its local macOS artifact is
the unsigned arm64 Lite app at
`dist-lite/mac-arm64/ClaraCore Desktop.app` (293.0 MiB). The unpacked app is a
local validation artifact; the published asset is
`ClaraCore-Desktop-0.6.3-lite-arm64.dmg`. Full, Windows, and Intel macOS
artifacts are not part of this release.

It is enough for:

- Opening the Desktop app on the local Mac.
- Verifying the Desktop-owned SQLite data directory.
- Verifying the packaged Gateway MCP entry.
- Testing agent setup before code signing and notarization.

The published unsigned packages are suitable for the current small tester group
but not a signed/notarized general-public distribution.

## Commands

Create an unpacked Lite `.app`:

```bash
npm run pack:mac:lite
```

Create a Lite `.dmg`:

```bash
npm run dist:mac:lite
```

Expected output for the current development version after a future package run:

```text
dist-lite/mac-arm64/ClaraCore Desktop.app
dist-lite/ClaraCore-Desktop-0.6.4-lite-arm64.dmg
```

No `0.6.4` package or DMG was produced as part of the version bump.

The previous `0.5.8` Full/Lite arm64 DMGs and Windows x64 NSIS installers remain
available in GitHub Release `v0.5.8`.

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

`v0.6.3` is published at
`https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.6.3` with the
macOS arm64 Lite DMG and `SHA256SUMS.txt`.

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

Validated locally for the packaged `0.6.3` Lite checkpoint:

- bundle version and build flavor are `0.6.3` and `lite`;
- the unpacked application is 293.0 MiB;
- the executable is arm64 and the package excludes built-in model resources
  and the Full embedding dependency closure;
- packaged Lite settings and update UI smokes pass;
- source Memory Controller, Gateway, overview, InnerLife, and repository checks
  pass;
- the DMG passes `hdiutil verify`, and its mounted Gateway opens an online
  backup copy of the 45 MiB product database with all six migrations present
  and `quick_check=ok`;
- the generic Full-vs-Lite package-size comparator was not run because no
  `0.6.3` Full artifact was built.

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
