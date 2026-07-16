# ClaraCore Desktop Tauri Migration Research

Date: 2026-07-16

Status: research checkpoint; no migration decision or implementation has been approved.

## Executive Summary

Rebuilding the ClaraCore Desktop shell with Tauri 2 is technically feasible,
but a full Rust rewrite is not currently justified.

The recommended direction, if this topic is resumed, is:

1. establish a smaller Electron baseline first, including the planned
   Ollama/Lite build and target-specific dependency pruning;
2. build a narrow Tauri shell with the existing Node Core packaged as a
   sidecar;
3. compare real package size, startup, idle memory, lifecycle behavior, and
   local embedding behavior before deciding whether to migrate;
4. keep the existing Node Core unless a separate strategic reason emerges for
   a shared Rust core.

The main opportunity is replacing the bundled Chromium/Electron shell. The
main migration risk is packaging and supervising the existing Node runtime,
SQLite, ONNX native dependencies, local model assets, schedulers, and MCP
Gateway reliably across platforms.

## Question And Scope

This research evaluates three different meanings of "rewrite with Tauri":

1. optimize the current Electron application without changing framework;
2. replace Electron with Tauri while preserving the Node Core as a sidecar;
3. replace Electron and rewrite the local Core in Rust.

These options must not be treated as equivalent. The first is packaging work,
the second is a shell/runtime-boundary migration, and the third is a product
backend rewrite.

This document does not authorize code changes, a migration branch, release
work, or changes to the live product database.

## Current Product Boundary

The current application is not a thin web wrapper.

- Renderer: plain HTML, CSS, and JavaScript in `index.html`, `app.js`, `app/`,
  and `styles/`.
- Electron host: application lifecycle, window, tray, single-instance behavior,
  dialogs, clipboard, updates, and IPC under `electron/`.
- Product Core: Memoria, Shared Line, InnerLife, backup/import, SQLite, runtime
  snapshots, and MCP Gateway under `core/`.
- Local inference: `@xenova/transformers`, ONNX Runtime, Sharp, and the bundled
  BGE embedding model.
- Agent access: the long-running localhost MCP Gateway uses stable default port
  `50668`.

The current code inventory is approximately:

| Surface | Size |
| --- | ---: |
| Core and Electron non-test JavaScript | 18,319 lines |
| Renderer JavaScript | 8,188 lines |
| Core test JavaScript | 7,027 lines |
| Preload IPC calls | 87 |

The renderer is comparatively portable. The backend runtime and its lifecycle
are the expensive part of a migration.

## Measured Electron Baseline

The following macOS arm64 measurements were reproduced from the current
`0.5.4` source with `npm run pack:mac` and `npm run dist:mac` on 2026-07-16.
The package is unsigned because `build.mac.identity` is currently `null`.

| Artifact or component | Measured size |
| --- | ---: |
| `ClaraCore Desktop.app` | 532 MB installed |
| DMG | 199 MB file size |
| Electron Framework | 274 MB |
| `Resources/app.asar` | 120 MB |
| `Resources/app.asar.unpacked` | 98 MB |
| Bundled model resources | 24 MB |
| Bundled SQLite resources | 13 MB |

An isolated test launch produced approximately 453 MB of summed RSS across the
main, GPU, network utility, and renderer processes after five seconds. Summed
RSS double-counts shared pages and is not a private-memory measurement, so it is
only a reproducible directional baseline.

The current package also contains avoidable cross-platform payloads, including
multiple ONNX Runtime binaries and SQLite executables for platforms other than
the current target. This means the current 532 MB baseline includes packaging
waste that should not be credited as a Tauri-specific saving.

## Important Ollama/Lite Baseline

`docs/HANDOFF_OLLAMA_LITE_BUILD.md` defines a planned Electron Ollama/Lite build
that removes the complete built-in embedding runtime and model dependency
closure, not only the 24 MB model file.

That work is expected to remove roughly 200-230 MB of installed payload from
the Full Electron package. Therefore any future framework comparison should
measure at least these three real artifacts:

1. Electron Full;
2. Electron Ollama/Lite;
3. Tauri with the same feature set as the Electron artifact being compared.

Comparing Tauri Lite against Electron Full would produce a misleading result.

## Tauri 2 Capability Fit

Tauri 2 uses the operating system WebView instead of bundling a browser engine.
The official project states that a minimal application can be smaller than
600 KB, but that number does not apply directly to ClaraCore because ClaraCore
must still ship application assets and a local backend runtime.

Official Tauri 2 support exists for the main shell capabilities ClaraCore uses:

- system tray and menus;
- single-instance handling;
- native dialogs and file/URL opening;
- process and shell integration;
- SQLite through the SQL plugin;
- application updates;
- external binaries and Node.js sidecars;
- per-window and per-command capabilities and permission scopes.

Relevant official documentation:

- Tauri overview and minimum-size explanation:
  <https://tauri.app/start/>
- Node.js sidecar guide:
  <https://v2.tauri.app/learn/sidecar-nodejs/>
- Official plugin catalog:
  <https://v2.tauri.app/plugin/>
- System tray:
  <https://v2.tauri.app/learn/system-tray/>
- SQL plugin:
  <https://v2.tauri.app/plugin/sql/>
- Updater API:
  <https://v2.tauri.app/reference/javascript/updater/>
- Permissions:
  <https://v2.tauri.app/security/permissions/>
- System WebView versions:
  <https://v2.tauri.app/reference/webview-versions/>
- Windows WebView2 installer modes:
  <https://v2.tauri.app/distribute/windows-installer/>

## Migration Options

The estimates below are planning ranges derived from the current package
composition. They are not promises and must be replaced by measured artifacts
from a prototype.

| Option | Estimated macOS `.app` | Estimated DMG | Expected effort | Assessment |
| --- | ---: | ---: | ---: | --- |
| Optimize Electron Full | 360-420 MB | 120-160 MB | 1-3 engineering days | Do first |
| Tauri shell + Node sidecar | 100-180 MB | 50-90 MB | 2-5 engineering weeks | Best prototype candidate |
| Tauri + Rust Core rewrite | 45-80 MB | 30-55 MB | 2-4+ engineering months | Not justified now |

The Ollama/Lite build may become materially smaller than the Electron Full
range above. Its real result should replace estimates before a Tauri migration
decision is made.

### Option A: Keep Electron And Reduce Packaging Waste

Likely work:

- ship only the current target's SQLite binary;
- ship only the current target and architecture's ONNX Runtime;
- exclude unused native headers, source payloads, and architectures;
- complete and measure the Ollama/Lite build;
- preserve the existing lifecycle, tests, and runtime architecture.

This has the best immediate return and creates a fair comparison baseline.
Electron's approximately 274 MB framework cost remains.

### Option B: Tauri Shell With Node Sidecar

Proposed boundary:

```text
Existing HTML/CSS/JS renderer
        |
        | Tauri invoke and events
        v
Tauri native shell
window, tray, permissions, updater, lifecycle
        |
        | local socket, localhost, or stdio
        v
Existing Node Core sidecar
SQLite, Memoria, Shared Line, InnerLife, MCP, embedding
```

Advantages:

- removes the bundled Electron/Chromium framework;
- preserves most domain logic and data semantics;
- allows a staged migration rather than a backend rewrite;
- gives the renderer a more explicit capability boundary.

Primary risks:

- the Node sidecar must work with `node:sqlite` and the required Node version;
- ONNX Runtime and Sharp native modules must be packaged per target correctly;
- model paths and writable data paths must remain stable after bundling;
- the sidecar must start, report readiness, survive UI hide/show, and terminate
  cleanly;
- the stable MCP port and token synchronization behavior must remain correct;
- IPC changes from 87 Electron calls to Tauri commands or sidecar RPC need a
  compatibility layer;
- existing Playwright Electron tests need a replacement or adaptation.

This is the recommended prototype because it tests the real risk while keeping
the product Core intact.

### Option C: Tauri With A Rust Core

This would require rewriting or replacing:

- database repositories and migrations;
- Memoria, Shared Line, and InnerLife domain behavior;
- backup, restore, import, and export workflows;
- MCP Streamable HTTP handling and authentication;
- schedulers and runtime snapshots;
- local embedding inference;
- the IPC contract and most backend-focused tests.

The package could be smaller and the native boundary could be cleaner, but the
work is not justified solely by package size. Reconsider this only if ClaraCore
later needs a reusable Rust core across multiple products or runtimes.

## Expected Benefits

### High-confidence benefits

- smaller downloads and installed application size;
- smaller framework-level update payloads;
- less Electron/Chromium-specific process overhead;
- a narrower, explicit command and filesystem permission model;
- potentially faster shell startup and better tray-resident behavior.

### Benefits that require measurement

- idle and active memory reduction;
- cold-start improvement after Node sidecar startup and database initialization;
- battery and idle CPU improvement;
- UI rendering performance under WKWebView and WebView2;
- update reliability and delta size.

### Areas Tauri will not automatically optimize

- ONNX embedding inference speed;
- SQLite query performance;
- MCP request performance;
- scheduler work and application-domain algorithms;
- database growth or snapshot size.

## Cross-platform Caveats

- macOS uses WKWebView while Windows uses WebView2. Electron currently provides
  one bundled Chromium version on all platforms, so a Tauri build requires UI
  regression testing on each target.
- Tauri does not bundle the WebView by default. On older Windows installations,
  the installer can bootstrap WebView2. An offline WebView2 installer adds
  approximately 127 MB according to the official documentation and would erase
  much of the download-size advantage.
- Memory comparisons must specify RSS, private memory, PSS, or another metric.
  Summed process RSS alone is not sufficient for a final decision.
- Signing, notarization, and update signatures must be validated with real
  distributable artifacts, not only unsigned local bundles.

## Recommended Prototype

If this direction is resumed, create an isolated prototype rather than changing
the production shell in place.

### Prototype scope

- reuse the current renderer without redesign;
- launch and supervise one packaged Node sidecar;
- implement runtime readiness and structured error reporting;
- map only the smallest useful IPC slice;
- read one runtime snapshot;
- perform one Memory search and one Memory write in an isolated database;
- start and validate the MCP Gateway on port `50668`;
- execute one local embedding request in the Full variant;
- implement tray, close-to-hide, quit, reopen, and single-instance behavior;
- produce a real unsigned macOS arm64 `.app` and DMG for measurement.

### Prototype exclusions

- no Rust rewrite of domain repositories;
- no UI redesign;
- no production data migration;
- no updater migration in the first spike;
- no Windows implementation before the macOS architecture is proven;
- no release, commit, or push without a separate closeout request.

### Acceptance gates

Continue beyond the prototype only if all of the following are true:

- macOS `.app` is no larger than 180 MB for the Full sidecar prototype;
- DMG is no larger than 90 MB;
- measured idle private memory improves by at least 30% under the same test;
- UI readiness is materially faster or no slower than the Electron baseline;
- SQLite, local embedding, and MCP work without separately installed runtimes;
- tray, hide, quit, reopen, and sidecar shutdown pass repeated lifecycle tests;
- the data root and existing product database format remain compatible;
- the packaging and test complexity remains maintainable.

If the prototype misses these gates, keep Electron and continue package-focused
optimization instead of forcing the migration.

## Decision Checkpoint

Current recommendation:

> Tauri is feasible and worth a bounded shell-plus-sidecar prototype, but it is
> not yet worth a full migration commitment, and a Rust Core rewrite is not
> justified by package size alone.

The next discussion should begin only after the Electron Ollama/Lite artifact
has a measured size, or when there is a separate strategic reason to replace
Electron beyond package size.

