# ClaraCore Desktop v0.5.8

Released on 2026-07-17 as the current stable GitHub Release. This release also
publishes the completed Agent First work that remained unreleased during the
`0.5.7` development line.

## What Changed

### Agent First Human Surfaces

- Home now uses the Shared Horizon to show recent, evidence-backed Agent
  presence without turning the product into a chat surface.
- Memoria, Shared Line, and InnerLife are simpler read-only inspection pages;
  Agent/runtime mutations remain available through MCP and CLI paths.
- Logs, Settings, and Agent Access have focused human-facing information while
  technical and uncommon detail stays behind Advanced sections.
- Agent Access keeps one primary copy-for-agent path for Streamable HTTP and
  the stdio fallback.

### Trace

- The new Trace page brings together the statistics previously removed from
  Memoria, Shared Line, and InnerLife pages.
- Its primary surface is narrative: time accumulated together, retained
  decisions, long-running lines, recalled Memory, Agent-initiated thoughts,
  and recent confirmed milestones.
- Agent participation is non-ranked. Detailed domain statistics and raw counts
  are secondary, with advanced data collapsed by default.
- Trace is a read-only aggregate view, not a new persisted domain object.
- The Memory span excludes archived and superseded records, and legacy `+0000`
  timestamps remain valid evidence.

### Runtime And Maintenance

- InnerLife profile deletion accepts an explicit target Agent so an authorized
  Agent can clean up another Agent's data through the supported interface.
- Legacy InnerLife share evidence now distinguishes verified conversational
  delivery from older pipeline-only records.
- Trace snapshots are bounded, and development/test instances remain isolated
  from daily-use Desktop data.
- Maintained documentation now describes the current page boundaries; completed
  handoffs and older release notes live under `docs/archive/`.
- The Windows release workflow is version-neutral. All Full/Lite distribution
  scripts explicitly disable implicit electron-builder publishing so packaging
  and GitHub Release publication remain separate steps.

## Validation

Source and UI checks passed:

- `git diff --check`
- `npm run check`
- `npm run test:smoke`
- `npm run test:trace`
- `npm run test:home`
- `npm run test:home:performance`
- `npm run test:agent-access`
- `npm run test:ux:polish`
- `npm run test:update`
- `npm run test:lite`

macOS arm64 packaging:

- Full DMG: `ClaraCore-Desktop-0.5.8-arm64.dmg`, `198.4 MiB`, SHA-256
  `3e2f1c96c63e0f775d902f645b6a778117299438349665495f9b8095cc5cb6e2`
- Lite DMG: `ClaraCore-Desktop-0.5.8-lite-arm64.dmg`, `121.2 MiB`, SHA-256
  `863cc7560f48aa9bda9d6ea19b0fcee56e60eab6720b40b78b3bb59e5bbd8de5`
- Both DMGs pass `hdiutil verify`; both app bundles report version `0.5.8`.
- Full generates a real 512-dimensional built-in Memory embedding.
- Unpacked boundary: Full `532.1 MiB`, Lite `292.7 MiB`, saving `239.4 MiB`.
- Packaged Full Gateway and update UI smokes pass; packaged Lite Trace UI smoke
  passes.

Windows x64 packaging:

- GitHub Actions run
  [29558439711](https://github.com/xiaomao361/claracore-desktop/actions/runs/29558439711)
  completed from a clean Windows dependency install.
- Full installer: `ClaraCore-Desktop-0.5.8-x64-Setup.exe`, `170.3 MiB`, SHA-256
  `131197fde729651955f13227683853484477b9ad00d18fdbead9519921da6909`
- Lite installer: `ClaraCore-Desktop-0.5.8-lite-x64-Setup.exe`, `103.5 MiB`,
  SHA-256
  `1765fd05d0bd5cbc84fcfff9ddd94ac853b3eefce93fc4823d71d861cb2f9910`
- Full generates a real 512-dimensional built-in Memory embedding.
- Unpacked boundary: Full `654.2 MiB`, Lite `372.0 MiB`, saving `282.1 MiB`.
- Locally downloaded installers match the SHA-256 checksums produced by the
  Windows runner.

## Package Choice

- Full includes the local built-in Memory embedding runtime and is the simplest
  default when local built-in embeddings are wanted.
- Lite excludes that runtime and starts with Ollama as the external embedding
  option.

## Known Boundaries

- macOS packages are not signed or notarized.
- Windows packages are not code-signed.
- A real Windows x64 installation and local Ollama acceptance check remain
  manual tester steps.
- Updates remain user-directed downloads from GitHub Releases; the app does not
  silently install an update.
