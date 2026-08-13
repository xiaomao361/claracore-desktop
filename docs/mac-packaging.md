# ClaraCore Desktop macOS Packaging

## Current Release Boundary

The current development version is `0.6.10`; the public stable release remains
`0.6.9` until the complete `v0.6.10` matrix passes and the GitHub Release is
published. Treat [Version Branching](VERSION_BRANCHING.md) and the versioned
release notes as the release truth.

## Historical Pre-Release Checkpoint

The paths and validation notes below preserve the earlier local unsigned
`0.6.4` Lite checkpoint that preceded the public release. That checkpoint was
enough for:

- Opening the Desktop app on the local Mac.
- Verifying the Desktop-owned SQLite data directory.
- Verifying the packaged Gateway MCP entry.
- Testing agent setup before code signing and notarization.

Those historical unsigned checkpoint packages were suitable only for the
small tester group at that time, not for general-public distribution.

## Commands

Create an unpacked Lite `.app`:

```bash
npm run pack:mac:lite
```

Create a Lite `.dmg`:

```bash
npm run dist:mac:lite
```

Create the explicit Developer ID signed, notarized, and stapled Full/Lite
release DMGs:

```bash
npm run release:mac
npm run release:mac:lite
```

The release command requires the `Developer ID Application` identity and the
`claracore-notary` notarytool keychain profile. Local `pack`/`dist` commands do
not submit test packages to Apple.

Current App output and future DMG output:

```text
dist/mac-arm64/ClaraCore Desktop.app
dist/ClaraCore-Desktop-0.6.10-arm64.dmg
dist-lite/mac-arm64/ClaraCore Desktop.app
dist-lite/ClaraCore-Desktop-0.6.10-lite-arm64.dmg
```

Only artifacts built with the signed release commands and accepted by the
validation contract below may be uploaded to a public release. Packages built
with the unsigned local `dist` commands remain test artifacts.

Run `npm run test:package:lite` after creating the unpacked Lite App. The check
validates the Lite package independently; when a matching unpacked Full App is
also present, it additionally verifies the Full runtime boundary and the
Full-to-Lite size saving.

The previous `0.5.8` Full/Lite arm64 DMGs and Windows x64 NSIS installers remain
available in GitHub Release `v0.5.8`.

## Manual Release Update Channel

The manual update check reads the latest public stable GitHub Release, then
opens or copies the generic Release page so the user chooses an available
flavor and platform. Local matrix builds use `npm run dist:mac`, `npm run
dist:mac:lite`, `npm run dist:win`, and `npm run dist:win:lite`. A public signed
macOS Lite asset must use `npm run release:mac:lite`; do not upload the ad-hoc
local `dist:mac:lite` artifact. Use these names when a release includes the
corresponding platform/flavor:

```text
ClaraCore-Desktop-<version>-arm64.dmg
ClaraCore-Desktop-<version>-lite-arm64.dmg
ClaraCore-Desktop-<version>-x64-Setup.exe
ClaraCore-Desktop-<version>-lite-x64-Setup.exe
```

All four distribution scripts pass `--publish never` to electron-builder.
Creating the tag and GitHub Release is explicit. The Windows workflow may
publish its verified installers only when manually dispatched with an existing
`publish_tag`; pull-request builds and ordinary dispatches never publish.

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

Earlier release assets and checksums remain documented in their versioned
release notes. The `v0.6.10` release candidate targets macOS Apple Silicon and
Windows x64 Full/Lite artifacts plus per-platform checksum files.

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

Current released-artifact evidence is recorded in
[v0.6.9 Release Notes](RELEASE_NOTES_V0.6.9.md).

### `0.6.9` Full/Lite release checkpoint

Validated locally and after publication:

- source, lockfile, bundle, and packaged Gateway versions are `0.6.9`;
- source smoke, Gateway, Memory Controller, Lite, update, responsive-layout,
  and UI polish checks pass;
- macOS Full built-in embedding, Full/Lite package boundaries, and packaged
  Gateway smokes pass;
- App and DMG notarization submissions are accepted, both tickets validate,
  and Gatekeeper reports `Notarized Developer ID`;
- the Windows workflow builds and validates Full/Lite installers, including a
  real packaged Full embedding generation;
- `hdiutil verify` and published-platform checksum verification pass.

### `0.6.7` Lite release checkpoint

Validated locally and after publication:

- source, lockfile, bundle, and packaged Gateway versions are `0.6.7`;
- the source smoke, Gateway, Memory Controller, Lite, and update checks pass;
- the 292.5 MiB Lite package boundary and packaged Gateway smoke pass;
- App and DMG notarization submissions are accepted, both tickets validate,
  and Gatekeeper reports `Notarized Developer ID`;
- `hdiutil verify` passes and the published DMG matches `SHA256SUMS.txt`.

### `0.6.5` Lite release checkpoint

Validated locally for installation testing:

- source version, lockfile version, bundle version, and packaged Gateway version
  are `0.6.5`;
- `npm run check`, `npm run test:home`, `npm run test:lite`, and `npm run
  test:update` pass;
- the Lite package boundary check passes at 293.3 MiB and confirms the package
  does not contain the Full built-in embedding dependency closure;
- the arm64 DMG passes `hdiutil verify`, and the mounted application reports
  version `0.6.5`;
- the mounted packaged Gateway smoke passes with the Memory Controller off by
  default, and the mounted Lite settings UI covers fresh and migrated data;
- the final release artifact is Developer ID signed, Apple-notarized, stapled,
  Gatekeeper accepted, checksum-verified after upload, and published as
  `v0.6.5`.

### Historical unpacked `0.6.4` Lite checkpoint

Validated locally before the public release:

- bundle version and packaged metadata are `0.6.4` and `lite`;
- the executable is arm64 and the App is 293.0 MiB;
- built-in model resources, Xenova, ONNX Runtime, Sharp, and unpacked production
  dependencies are absent;
- packaged Lite settings and Trace UI smokes pass;
- Trace shows the persisted Memory Controller observe mode as `仅观察`;
- packaged stdio Gateway smoke passes and reports version `0.6.4`;
- no DMG, signing, notarization, tag, GitHub Release, update publication, or
  installation was performed.

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

Known remaining distribution work:

- Complete real Windows x64 installation acceptance.
- Validate the real installed Windows Full build against a local Ollama model.
- Consider automatic update installation only after per-platform signing and
  the release workflow are stable.
