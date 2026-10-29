# Packaging

Electron Builder produces Full and Lite variants. Full includes the local
embedding model; Lite omits it. Release installers currently target macOS
Apple Silicon and Windows x64. Source checks also run on Linux.

## Build commands

```sh
npm ci
npm run pack:mac
npm run pack:mac:lite
npm run dist:mac
npm run dist:mac:lite
npm run dist:win
npm run dist:win:lite
```

`pack:*` creates an unpacked application directory; `dist:*` creates installers
without publishing. Use native platform tooling or the Windows Actions workflow
for platform-specific packaging. Verify required model and SQLite resources
before a public build. `test:package:lite` and `test:package:win:lite` inspect
Lite package contents.

## Local Lite test builds

For rapid local testing, build without Developer ID signing or notarization:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false ./node_modules/.bin/electron-builder --mac --arm64 --config scripts/lite-builder-config.js --config.mac.identity=null --config.mac.notarize=false --publish never
```

Keep test output separate from previous packages. Validate package contents and
isolated runtime behavior, then let the user install and test. Reserve signing
and notarization for the final release. A local unsigned test build is not a
public release.

## Signed macOS release

```sh
npm run release:mac
npm run release:mac:lite
```

These commands require a configured Developer ID Application signing identity
and the Keychain notarization profile used by the release scripts. Configure
credentials locally; never put them in source. The scripts sign, notarize,
and staple the appropriate artifacts. Verify code signature, notarization,
Gatekeeper assessment, DMG integrity, and checksums for the actual release.

Ordinary local `dist:mac` output is not equivalent to a signed, notarized release.
Published 1.0.6 macOS packages are signed and notarized. Its Windows installers
are unsigned; do not label a successful Windows build as signed.

## Freeze and publish

Freeze a source commit and version before packaging. Compare packaged source
and assets with that commit, check Full/Lite resource differences, run isolated
packaged runtime checks, and publish the matching installers and SHA-256
manifests together. Never move an existing release tag to cover later docs.
See [Release process](VERSION_BRANCHING.md).
