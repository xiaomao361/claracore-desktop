# ClaraCore Desktop v0.6.4 Release Notes

## Status

`v0.6.4` is the current public stable GitHub Release. Tag `v0.6.4` points to
commit `c2d91b9acc247989b9259e55ec3cec9faaf804b3`.

Release:
<https://github.com/xiaomao361/claracore-desktop/releases/tag/v0.6.4>

The Release contains six assets:

- `ClaraCore-Desktop-0.6.4-arm64.dmg` — macOS Apple Silicon Full
- `ClaraCore-Desktop-0.6.4-lite-arm64.dmg` — macOS Apple Silicon Lite
- `ClaraCore-Desktop-0.6.4-x64-Setup.exe` — Windows x64 Full
- `ClaraCore-Desktop-0.6.4-lite-x64-Setup.exe` — Windows x64 Lite
- `SHA256SUMS.txt` — macOS checksums
- `SHA256SUMS-windows.txt` — Windows checksums

Both macOS DMGs contain Developer ID signed, Hardened Runtime apps and have
accepted Apple notarization tickets stapled to the final disk images. The
Windows installers are currently unsigned and may show an unknown-publisher or
SmartScreen warning.

## InnerLife Share Quality

- Continuity-only inbox material is treated as context and does not create a
  share by itself.
- Empty inbox and empty prompt input produces no share.
- Model output may use `[NO_SHARE]` to preserve an intentional decision not to
  speak.
- New candidates are compared with active and recently used shares so repeated
  themes do not keep accumulating.
- Share decisions retain explicit audit reasons, including context-only input,
  no shareable input, model no-share output, distinct material, and similar
  existing material.
- Session afterthoughts follow the same no-share and duplicate-theme rules.

## Memory Controller Trace Status

- Trace view snapshots carry the persisted Memory Controller mode together with
  observation evidence, so `observe` is shown as `仅观察` / `Observe only`
  instead of being misreported as off after lazy view hydration.
- The Trace UI regression covers both observe and off states through the
  current layered snapshot boundary.

## Trusted Context Gateway Foundation

- Memory Controller settings now support an explicit trusted `canary` mode
  backed by the persisted `memory.controller.canary_agent_ids` allowlist.
- Fresh and upgraded installs remain `off`; the allowlist defaults to `["*"]`,
  meaning every identified authenticated Agent.
- Any authenticated allowed Agent using `timeView=current` can receive one
  bounded current, normal-sensitivity, same-Agent project decision
  (`decision` plus project scope or `product-decision`),
  engineering-experience, or knowledge-card pointer.
- Non-allowlisted Agents and historical/all views remain observe-only.
  Malformed modes and allowlists fail closed without writing a decision.
- Observe and canary use separate cache scopes. Canary context includes the
  fresh decision id, selected Memory id, and a current-evidence verification
  instruction.
- The global Codex `UserPromptSubmit` hook now appends only valid canary
  `INJECT_TOP1` context to `additionalContext`; ordinary, observe, error, and
  empty-context paths remain context-free.
- That hook is user-level integration on the owner machine, not content
  distributed inside the Desktop App.
- Delivery/usage feedback and public release remain disabled. Other Agents can
  use `memory_context` explicitly through MCP without a hook.

## Validation Completed

- `npm run check`
- `npm run test:lite`
- `npm run test:trace`
- `npm run test:memory-controller`
- `npm run test:gateway:http`
- `npm run test:agent-access`
- `npm run test:backup`
- `npm run test:phase4`
- `npm run test:phase5`
- persisted background-jobs smoke
- isolated InnerLife share-quality smoke covering six decision paths
- Lite source and packaged-artifact quality smokes against temporary data roots
- packaged Lite Trace UI smoke, including the observe-mode status
- packaged stdio Gateway smoke, including Controller default-off and version
  `0.6.4`
- Developer ID signature, Hardened Runtime, and deep strict signature
  validation for the packaged Lite App
- accepted and stapled App notarization ticket, plus Gatekeeper execution
  acceptance as `Notarized Developer ID`
- Full and Lite final DMG integrity, signature, stapler, and Gatekeeper
  verification
- owner-installed live Gateway connectivity and packaged identity
- live Codex canary: the expected same-Agent stable-release Memory was injected
  at score `0.7694336107196864`; an ordinary prompt remained `NOOP`
- installed packaged Clara canary: the expected `product-decision` Memory was
  injected at score `0.7887356419240835`
- global Codex hook acceptance: exactly one read-only Memory block on the
  high-confidence hit and no Memory block on the ordinary prompt

The quality fix was also installed locally as a same-version `0.6.3` test build
before this version bump. That local installation was validation evidence, not
a `0.6.4` release artifact.

The current `0.6.4` Lite packages exclude the built-in embedding model and its
dependency closure. Full packages include the built-in model resources.

## Release Artifact Verification

- macOS Full SHA-256:
  `301b38d797b31aa8464bcbbe40a46a9d4bfbe62e1001ab2ad60db6608f102e58`
- macOS Lite SHA-256:
  `8b13c35fc1c3743d548c8c663a45081089c609df6dcdb5f85e570a50144f3eb1`
- Windows Full SHA-256:
  `39a8ebc70f62767da6645ed8866d6e1d3dd70811a0beed481ccb1241456f23db`
- Windows Lite SHA-256:
  `db1e2d4245a79f99aeefe3d2f45917028b13f10e7803f34551e907e1f3c14326`
- The macOS assets were downloaded back from the public Release and passed
  checksum, `codesign`, stapler, and Gatekeeper verification.
- Windows GitHub Actions run `30503828638` passed the source checks, Full
  packaged embedding test, Lite package-boundary test, and checksum generation.
- Both Windows installers were downloaded back from the public Release and
  passed SHA-256 verification.

## Remaining Distribution Risk

The Windows x64 installers do not yet carry an Authenticode signature. Windows
code signing is separate from the Apple Developer ID certificate used for the
macOS artifacts.
