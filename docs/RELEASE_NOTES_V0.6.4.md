# ClaraCore Desktop v0.6.4 Development Notes

## Status

`0.6.4` is the current unreleased development version. The current public
stable release remains `v0.6.3`.

An unsigned macOS arm64 Lite App was built and owner-installed at
`/Applications/ClaraCore Desktop.app`. Its packaged `app.asar` SHA-256 is
`8ab012e13fcd3affadad8b263be1eb32dbc62b8f1bcc3ef5d86e7b6fb8bd9833`.
There is no `0.6.4` DMG, tag, GitHub Release, or update-channel entry yet.

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

The current `0.6.4` Lite App is about 293.0 MiB, reports arm64 and Lite flavor,
and excludes the built-in embedding model and dependency closure.

## Remaining Release Work

Current recommendation: keep `0.6.4` as an unreleased development checkpoint
until the automatic host integration has an intentional distribution story and
delivery/usage evidence has a conservative product contract. Releasing now
would publish the pull-mode Gateway and canary configuration, but not the
owner-tested automatic Codex experience.

Before publishing `v0.6.4`, build and validate a fresh Lite DMG from the final
committed source, generate release checksums, and explicitly authorize the tag,
push, and GitHub Release. Publication is not part of this checkpoint.
