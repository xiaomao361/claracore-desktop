# ClaraCore Desktop Version Update Handoff

Date: 2026-07-16

Status: `v0.5.4` published with both installers; real Windows installation and
the first packaged old-to-new upgrade remain pending.

## User Need

ClaraCore Desktop currently has about four real users. Each new build is still
distributed manually, and repeating that process has become the clearest
release friction. The next focused slice is therefore the version-check and
upgrade path.

This handoff is intentionally limited to that need. Do not include the proposed
knowledge-card surface, removable built-in embedding model, pet, personalization,
or usage-history ideas in this implementation slice.

## Repository Boundary And Current State

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- GitHub repository visibility: public
- Current package version at handoff: `0.5.4`
- Product version source: `package.json`, read through `core/version.js`
- Desktop stack: Electron `43`, `electron-builder` `26.15.3`
- Current macOS targets: `dmg` and unpacked `dir`
- Current Windows target: x64 NSIS installer and unpacked `dir`
- Current package identity is `null`; the app is not yet signed or notarized
- GitHub Release `v0.5.4` is public with macOS arm64, Windows x64, and SHA-256
  checksum assets
- A local arm64 `0.5.4` DMG exists at approximately 199 MB

The working tree was already substantially dirty before this handoff was
created. It contains active changes across Memory, InnerLife, Gateway, UI,
documentation, package files, and one new Gateway file. Treat all of those as
pre-existing user work. Do not bulk-stage, revert, rewrite, or include them in
the version-update slice without first separating their ownership.

Start the continuation by running:

```bash
cd /Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop
pwd
git rev-parse --show-toplevel
git remote -v
git status --short
git diff -- package.json package-lock.json docs/mac-packaging.md docs/VERSION_BRANCHING.md
```

## Current Release Truth

There is no automatic-updater dependency. A manual GitHub Release check now
exists in the main process and Settings UI.

Relevant existing surfaces:

- `package.json`: version, packaging targets, artifact name, signing state
- `core/version.js`: single runtime product-version source
- `electron/main.js`: main-process lifecycle and product snapshot
- `electron/ipc-contracts.js`: allowed IPC channels
- `electron/ipc-handlers.js`: main-process request handlers
- `electron/preload.js`: renderer-safe Desktop API
- `index.html`: Settings > General > About already displays app version
- `app/views/settings.js`: renders the About information
- `app/i18n/zh.js` and `app/i18n/en.js`: localized UI strings
- `docs/mac-packaging.md`: packaging status and remaining release work
- `docs/VERSION_BRANCHING.md`: version and release history

The existing packaging documentation says that signing, notarization, and an
update/release channel remain unfinished. The new user priority supersedes the
older suggestion to wait indefinitely for the data model to stabilize, but it
does not remove the signing/notarization constraint on silent installation.

## Local Implementation Checkpoint

The local Stage 1 implementation now includes:

- `core/update/github-release-client.js`: timeout, stable-version comparison,
  structured errors, exact platform asset selection, and repository URL checks
- narrow `checkForUpdates` and `openUpdateUrl` IPC/preload methods
- bilingual manual update controls in Settings > General > About
- deterministic Windows NSIS naming with an explicit `x64` marker
- mocked release-client and real Electron Settings UI smoke coverage

Validated locally on macOS arm64 with `git diff --check`, `npm run check`, the
existing Settings UI smoke, `npm run test:update`, `npm run pack:mac`, and the
packaged macOS update UI smoke. `npm run dist:win` produced the expected x64
installer. Running and installing that artifact on Windows remains unverified.

## Agreed Product Direction

Solve the distribution problem in two stages.

### Stage 1: Check, Notify, And User-Directed Download

Implement this stage first.

- Use public GitHub Releases as the release source.
- Add a manual `Check for updates` action beside the existing app version in
  Settings > General > About.
- Perform the network request in the Electron main process, not directly in the
  renderer.
- Compare the current product version with the latest non-draft,
  non-prerelease release.
- Return a small structured result through the preload/IPC boundary: current
  version, latest version, status, release name/notes URL, publish time, and the
  matching DMG or EXE download URL when present.
- When an update exists, let the user open the release page or installer download in
  the system browser. Keep installation user-directed.
- Show clear states for checking, up to date, update available, offline/network
  failure, malformed release metadata, and missing compatible asset.
- A failed check must never block app startup or affect the local database,
  Gateway, Memoria, Shared Line, or InnerLife.
- Do not download, mount, replace, relaunch, or silently install the app in this
  stage.

After the manual flow is proven, optionally add a non-blocking automatic check
at startup, limited to at most once every 24 hours. Store only the last-check
timestamp and dismissed release version in local UI preferences. Do not add
remote telemetry.

### Stage 2: Automatic Download And Installation

Defer this stage until code signing, notarization, and a stable release pipeline
exist. Evaluate `electron-updater` or a native signed update mechanism only at
that point. Do not let Stage 2 expand the first implementation slice.

## Release Source Contract

Recommended first contract:

- Latest release metadata:
  `https://api.github.com/repos/xiaomao361/claracore-desktop/releases/latest`
- Release tag: prefer `v<package version>`, for example `v0.5.5`
- macOS asset naming: continue the current builder convention,
  `ClaraCore-Desktop-<version>-<arch>.dmg`
- Windows asset naming: `ClaraCore-Desktop-<version>-x64-Setup.exe`
- Initial supported platforms: packaged macOS arm64 and Windows x64

The API call should set a short timeout and an explicit user agent. Four clients
checking no more than daily are well inside normal unauthenticated GitHub API
usage. Do not put a GitHub token in the app.

The public `v0.5.4` Release now contains both supported assets and release
notes. Live API validation confirms that `0.5.4` reports up to date and that a
synthetic `0.5.3` client selects the correct macOS or Windows asset. A future
`v0.5.5` is still required to validate the complete packaged old-to-new flow.

## Smallest Useful Implementation Loop

1. Reconfirm the dirty-worktree boundary and identify whether the existing
   `package.json`, packaging-doc, and UI changes are still in progress.
2. Add a main-process release client with timeout, response validation, version
   comparison, platform/architecture asset selection, and structured errors.
3. Expose one narrow `checkForUpdates` IPC method through contracts, handlers,
   and preload.
4. Add the manual action and status text to Settings > About, reusing the
   existing version display instead of creating a new page.
5. Add Chinese and English copy.
6. Add focused tests with mocked release responses; tests must not depend on a
   live GitHub request.
7. Run the normal repository checks and a focused UI smoke.
8. Update packaging/version documentation with what is actually implemented and
   what remains deferred.
9. Only after local behavior is verified, create a real Release candidate and
   perform one live packaged check against it.

## Acceptance Criteria For Stage 1

- Packaged Desktop shows its current version and a manual update-check action.
- With a newer compatible release fixture, the UI reports the new version and
  opens the expected release/download URL through the system browser.
- With the same or an older release fixture, the UI reports that the app is up
  to date.
- Drafts and prereleases are not offered by the stable channel.
- A missing arm64 DMG or x64 EXE is reported as unavailable rather than
  selecting an incompatible asset.
- Network timeout, offline state, rate-limit response, invalid JSON, and missing
  fields are handled without an unhandled rejection.
- Update checks do not write to or migrate `claracore.db`.
- The renderer does not receive Node or shell access; external URLs are opened
  through a validated main-process path.
- `git diff --check` passes.
- `npm run check` passes.
- Focused update-client and Settings UI tests pass.
- Packaged macOS arm64 and Windows x64 builds are checked on their real
  operating systems before calling the live flow complete.

## Security And Safety Guardrails

- Allow only HTTPS GitHub release URLs for this first channel.
- Validate the repository owner/name and release asset host before opening an
  external URL.
- Do not execute downloaded content.
- Do not include credentials in requests, logs, or packaged configuration.
- Keep update state outside the product database; this is shell preference
  state, not Memory, Shared Line, or InnerLife data.
- Do not add analytics or usage reporting as part of the updater.
- Preserve user data across manual upgrades and document that the data root is
  independent from the application bundle.

## Validation Commands

Use the exact focused test command introduced by the implementation. The normal
baseline remains:

```bash
git diff --check
npm run check
npm run test:update
npm run pack:mac
npm run pack:win
```

For the final live acceptance, verify all of the following from the packaged
app rather than development mode:

- the current version is correct;
- the Release endpoint is reachable;
- update-available and up-to-date states are both reproducible;
- the chosen asset matches `darwin-arm64` or `win32-x64`;
- the release/download action opens the correct HTTPS URL;
- canceling or ignoring the update leaves the app fully usable.

## Explicitly Out Of Scope

- Silent or background installation
- Delta updates
- Linux update support
- Code signing and notarization implementation unless separately authorized
- Release telemetry or user analytics
- Built-in embedding-model removal/download
- Knowledge cards
- Pet, personalization, or long-term usage milestones
- Changes to Memoria, Shared Line, InnerLife, or Gateway behavior
- Committing, pushing, publishing a Release, or distributing a build unless the
  user explicitly requests that closeout step in the continuation session

## Suggested Continuation Prompt

```text
Read docs/HANDOFF_VERSION_UPDATE.md and the nearest AGENTS.md. Continue from the
completed local Stage 1 implementation. Reconfirm the dirty-worktree ownership,
rerun the focused update tests, then prepare one stable test Release containing
the exact macOS arm64 DMG and Windows x64 EXE names. Do not publish, commit, or
push until explicitly authorized. Final acceptance must cover old-to-new and
up-to-date states on real macOS arm64 and Windows x64 machines while preserving
the existing product data root.
```
