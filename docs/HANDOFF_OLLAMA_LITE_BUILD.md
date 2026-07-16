# ClaraCore Desktop Lite Build Handoff

Date: 2026-07-16

Status: macOS arm64 Full/Lite implementation completed and promoted into the
`v0.5.5` release candidate.

## Decision

Keep the existing Full build and add a second Lite build from the same
source tree.

- Full keeps the bundled ClaraCore 512-dimensional embedding model and remains
  usable without Ollama.
- Lite excludes the complete built-in embedding runtime and model resources.
  Its first supported external embedding provider is Ollama.
- Do not add an in-app button that deletes files from an installed `.app`.
- Do not build a downloadable optional-model component in this slice.

The purpose is package-size reduction, not runtime memory or CPU reduction.
Ollama-backed operation already lazy-loads correctly and does not load or fall
back to the bundled model.

## Repository Boundary And Current State

- Repository: `/Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop`
- Remote: `git@github.com:xiaomao361/claracore-desktop.git`
- Branch at handoff: `main`
- HEAD at handoff: `7956715` (`Document v0.5.4 published release`)
- Current product version: `0.5.5`
- Release candidate: `v0.5.5`
- Build stack: Electron `43`, `electron-builder` `26.15.3`

The working tree is not clean. It still contains the pre-existing version-update
work in:

```text
M core/tests/update-settings-ui-smoke.js
M docs/HANDOFF_VERSION_UPDATE.md
M index.html
```

Those changes remain mixed in the working tree with the new Lite implementation.
Preserve their content and review commit scope carefully before closeout.

Start by running:

```bash
cd /Users/zhouwei/Documents/ClaraCore/apps/claracore-desktop
pwd
git rev-parse --show-toplevel
git remote -v
git status --short
git log -1 --oneline --decorate
```

## Measured Package Truth

The installed macOS application currently measures approximately:

| Component | Installed size |
| --- | ---: |
| Entire `ClaraCore Desktop.app` | 532 MB |
| Electron Framework | 274 MB |
| `Resources/app.asar` | 120 MB |
| `Resources/app.asar.unpacked` | 98 MB |
| Bundled embedding model resources | 24 MB |
| Bundled SQLite resources | 13 MB |

The 24 MB model weight is only one part of the built-in embedding cost. The
packaged runtime also includes approximately:

| Built-in embedding component | Installed size |
| --- | ---: |
| `@xenova/transformers` content | 44 MB |
| `onnxruntime-node` unpacked runtime | 74 MB |
| `sharp` unpacked runtime | 24 MB |
| Quantized model and tokenizer files | 24 MB |
| Remaining ONNX/Transformer transitive packages | additional tens of MB |

The production dependency tree is currently rooted in the single
`@xenova/transformers` dependency. Packaged production `node_modules` content is
approximately 214 MB, and model resources add another 24 MB. Historical
evidence matches this: the early v0.1 application was approximately 304 MB
uncompressed, while the current installation is 532 MB. The complete built-in
embedding feature therefore accounts for roughly 200-230 MB of installed size.

The Lite build is valuable only if it removes the complete runtime dependency
tree, not merely the 24 MB model file.

## Validated Implementation Result

The first macOS arm64 A/B loop was completed from the same working-tree state on
2026-07-16:

| Result | Full | Lite |
| --- | ---: | ---: |
| Installed `.app` size | 532.4 MiB | 292.6 MiB |
| `Resources/app.asar` | approximately 121 MiB | approximately 2.8 MiB |
| Built-in model resources | present | absent |
| Production `node_modules` / unpacked runtime | present | absent |

- Installed-size saving: 239.8 MiB.
- Lite DMG: `dist-lite/ClaraCore-Desktop-0.5.5-lite-arm64.dmg`, 127,091,159 bytes (approximately 121.2 MiB).
- `hdiutil verify` passed, and the mounted DMG app was re-inspected for the
  `lite` marker and forbidden package content.
- Packaged Lite launched successfully, showed only Ollama/Disabled, started with
  an empty model on a fresh data root, and safely explained an existing Full
  data root configured for the built-in provider.
- Packaged Lite fetched the real local Ollama model and stored a ready
  `bge-m3:latest` embedding with 1024 dimensions without loading or packaging
  the built-in runtime.
- Full retained its built-in provider/defaults and passed the existing Phase 1
  runtime/UI regression gate.

Validated commands:

```bash
npm run check
npm run test:phase1
npm run test:lite
npm run test:lite:ollama
npm run pack:mac
npm run pack:mac:lite
npm run test:package:lite
npm run dist:mac:lite
```

## Scope For This Implementation Slice

This round completed:

- add a reproducible macOS arm64 Lite packaging path;
- keep the existing Full packaging path unchanged;
- mark the packaged build flavor explicitly as `full` or `lite`;
- exclude all built-in embedding model resources and runtime dependencies from
  the Lite package;
- make the Lite runtime expose only valid embedding choices;
- validate real packaged size and Ollama-backed Memory behavior;
- document exact artifact names, commands, sizes, and limitations.

This round did not:

- change the current update-check implementation;
- publish a new GitHub Release;
- commit or push unless the user explicitly requests closeout;
- implement automatic download or installation;
- implement model install/remove/redownload UI;
- alter Memoria storage, Memory records, Shared Line, InnerLife, or Gateway
  semantics;
- optimize the Electron Framework itself;
- implement the Windows Lite build before the macOS A/B result is proven.

## Build Flavor Contract

Use two explicit build flavors from the same codebase:

### Full

- Flavor identifier: `full`
- Existing behavior and default packaging commands remain valid.
- Includes `resources/models`.
- Includes `@xenova/transformers` and all required transitive/native runtime
  dependencies.
- Offers `ClaraCore built-in`, `Ollama`, and `Disabled` Memory embedding
  providers.
- Artifact name remains:
  `ClaraCore-Desktop-<version>-arm64.dmg`.

### Lite

- Flavor identifier: `lite`
- Requires a separate, explicit packaging command such as `npm run pack:mac:lite`
  and `npm run dist:mac:lite`.
- Excludes `resources/models/**`.
- Excludes the complete production dependency closure introduced by
  `@xenova/transformers`, including ONNX and Sharp native resources.
- Offers only `Ollama` and `Disabled` as valid Memory embedding providers.
- Must not silently claim that the built-in provider is available.
- Proposed artifact name:
  `ClaraCore-Desktop-<version>-lite-arm64.dmg`.

Do not derive behavior from the artifact filename at runtime. Package a small,
read-only build-flavor marker or expose equivalent compile/package metadata so
the main process, snapshot, Settings UI, CLI, and tests can tell which capability
is actually present.

## Runtime Behavior

### Fresh Lite Installation

- Default the Memory embedding provider to `ollama` only if the Lite flavor is
  explicit, but leave the model name empty until the user fetches and selects an
  actually installed Ollama model.
- An explicit model fetch may select the single available model or canonicalize
  an equivalent Ollama default tag such as `bge-m3` to `bge-m3:latest`, but it
  must tell the user to save the model configuration.
- Keep the normal Ollama endpoint default visible.
- If Ollama or the configured model is unavailable, show an actionable
  configuration/connection error and retain keyword search fallback.
- Do not attempt to require `@xenova/transformers`.

### Existing Data Root Opened By Lite

An existing database may still contain
`memory.embedding.provider=claracore-built-in`.

- Detect this unsupported configuration explicitly.
- Do not crash during startup, snapshots, search, maintenance, CLI, or Gateway
  access.
- Do not silently rewrite the provider or delete existing embeddings.
- Tell the user to switch to Ollama or Disabled.
- Preserve the existing provider-change confirmation and vector rebuild flow.
- Preserve a previously saved Ollama endpoint and model across upgrade or
  reinstall. Database default seeding must not overwrite existing settings.

### Full Build Regression Boundary

- Full must retain the current built-in provider and 512-dimensional smoke test.
- Full must continue to avoid loading the built-in model when Ollama is selected.
- The Lite work must not weaken Full's offline, zero-configuration path.

## Recommended Smallest Closed Loop

1. Reconfirm the dirty worktree and keep update-session changes separate.
2. Inventory the exact production dependency closure rooted at
   `@xenova/transformers`.
3. Add an experimental macOS Lite builder configuration and build-flavor marker.
4. Produce an unpacked Lite `.app` before adding any Settings UI changes.
5. Prove through package inspection that models, Xenova, ONNX, and Sharp are
   absent.
6. Measure Full and Lite `.app` sizes from builds made from the same commit.
7. If the Lite saving is meaningful, add flavor-aware provider defaults and
   Settings/runtime guards.
8. Run focused mocked-Ollama Memory embedding/search tests against the Lite
   runtime.
9. Produce and verify the Lite DMG.
10. Update packaging documentation with measured results and only then decide
    whether to retain the dual-build path.

Do not begin with broad refactoring. First prove that electron-builder can
produce a functioning package without the complete embedding dependency tree.

## Acceptance Criteria

### Package Contents

- Full still contains the bundled model and built-in embedding runtime.
- Lite contains no `Resources/models` model payload.
- Lite `app.asar` contains no `@xenova/transformers` implementation.
- Lite `app.asar` / `app.asar.unpacked` contains no `onnxruntime-node`,
  `onnxruntime-web`, `onnxruntime-common`, or `sharp` runtime belonging only to
  the built-in embedding feature.
- Lite starts successfully without those packages installed in the bundle.

### Size Gate

- Full and Lite are built from the same source commit for comparison.
- Lite installed `.app` target: at most 330 MB.
- Expected saving: at least 180 MB versus Full.
- Lite DMG target: approximately 120-140 MB; record the real result rather than
  treating the estimate as a pass/fail guarantee.
- If the Lite `.app` saves less than 150 MB, stop and reassess before keeping the
  additional build flavor.

### Functional Gate

- Lite Settings does not offer a nonfunctional built-in provider.
- Fresh Lite starts with an empty Ollama model value; an explicit fetch selects
  the single installed model or lets the user choose when several are present.
- Ollama's implicit default tag is recognized: a saved `bge-m3` configuration
  tests successfully when the endpoint lists `bge-m3:latest`.
- A fetched/canonicalized model is not persisted until the user saves, and the
  UI says so explicitly.
- Fresh Lite startup reaches the normal application shell without loading a
  missing package.
- Ollama provider settings can be saved and read back.
- Mocked or isolated Ollama embedding generation succeeds.
- Memory search works with Ollama vectors and still falls back to keyword search
  when Ollama is unavailable.
- Vector maintenance does not attempt to call the built-in extractor.
- Existing Full data roots using Ollama open unchanged in Lite.
- Existing data roots configured for the built-in provider fail safely and
  explain the required provider switch.
- Gateway/CLI paths do not expose built-in embedding as available in Lite.
- Full built-in embedding and lazy-load tests remain green.

### Normal Validation

Use focused test commands introduced by the implementation, plus:

```bash
git diff --check
npm run check
npm run test:embedding:lazy
npm run test:builtin-embedding
npm run pack:mac
npm run pack:mac:lite
npm run dist:mac:lite
```

Also inspect the packaged contents directly and record both Full/Lite sizes.

## Relationship To Version Checking

The local Lite-build experiment does not require any change to version checking.
Keep the two workstreams separate in this implementation slice.

`core/update/github-release-client.js` now checks only whether a newer stable
Release exists. It does not compute or require a platform/flavor asset name.

Decision implemented on 2026-07-16: update checking is flavor-neutral during
the initial dual-build phase. When an update exists, open that version's Release
page and let the user choose Full or Lite.

The Settings surface should use `Open download page`, not `Download update`, and
also offer `Copy download page address`. Keep the stable
`https://github.com/xiaomao361/claracore-desktop/releases/latest` address
available even when the GitHub API check fails, so the user can paste it into a
different browser, proxy path, download tool, or another device. Copying the
same URL does not solve a machine-wide GitHub network block; a first-party
download page or mirror is a later follow-up only if that becomes a real support
problem.

Show the installed `Full` or `Lite` flavor in About so the user knows which
artifact to choose. Continue to allowlist trusted GitHub Release URLs before
opening them externally.

## Release Naming If The Experiment Is Accepted

Recommended assets on one `v<version>` Release:

```text
ClaraCore-Desktop-<version>-full-arm64.dmg
ClaraCore-Desktop-<version>-lite-arm64.dmg
ClaraCore-Desktop-<version>-full-x64-Setup.exe
ClaraCore-Desktop-<version>-lite-x64-Setup.exe
SHA256SUMS.txt
```

Release notes should state clearly:

- Full: works without Ollama and includes the local embedding runtime.
- Lite: smaller download; requires an available Ollama embedding model.
- Both builds use the same ClaraCore data-root format.
- Switching builds does not delete Memory data, but switching embedding
  providers may require rebuilding vectors.

Windows Lite packaging is a follow-up after the macOS size and behavior gates
pass.

## Risks To Watch

- electron-builder may automatically re-include production dependencies even
  when a file filter appears to exclude them; inspect the final ASAR and
  unpacked directory rather than trusting configuration.
- Native modules may be present under more than one transitive path.
- UI-only hiding is insufficient; CLI, Gateway, maintenance, and search paths
  must fail safely when built-in capability is absent.
- Reusing an existing Full-configured data root in Lite may leave a stored
  built-in provider selection.
- Two release artifacts add user-choice and support cost; keep their names and
  descriptions unambiguous.
- Do not let this work become a general plugin/component framework.

## Done Criteria

The first Lite phase is now complete locally because:

- a real packaged macOS arm64 Lite app and DMG exist;
- the Lite app saves 239.8 MiB versus the same-state Full build;
- package inspection proves the entire built-in embedding stack is absent;
- packaged Lite created a real Ollama-backed Memory embedding;
- Full retains built-in and Ollama behavior;
- docs record actual sizes and exact commands;
- update-check behavior remains a separate unclosed workstream;
- no commit, push, Release publication, or installation replacement was performed.

## Suggested Continuation Prompt

```text
Read docs/HANDOFF_OLLAMA_LITE_BUILD.md and the nearest AGENTS.md. Continue from
the validated local Full/Lite macOS A/B result. Preserve the existing dirty
version-update files. Re-run the focused Full/Lite gates, reconcile the generic
Release-page update flow, then prepare an intentional closeout boundary. Do not
publish a Release, install over the live app, commit, or push unless explicitly
requested.
```
