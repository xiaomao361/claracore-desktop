# ClaraCore Desktop Docs

Current docs are the files a developer should read before changing runtime,
packaging, data, or agent behavior.

- `ARCHITECTURE.md`: current Electron, runtime, database, Gateway, packaging
  resource, and validation boundaries.
- `CODE_MAP.md`: source-first map for agents and developers debugging or
  repairing Desktop behavior.
- `CLEANUP_PLAN.md`: active debt rules and remaining refactor targets.
- `RUNTIME_MEMORY_POLICY.md`: bounded snapshot, pagination, resource ownership,
  and long-run memory rules.
- `UI_UX_POLISH_BACKLOG.md`: next-version UI/UX direction and staged polish
  backlog for the current Desktop surface.
- `HANDOFF_V0.5.7_MEMORY_PAGE.md`: confirmed Agent First, read-only Memory page
  direction and the implementation/validation boundary for the next session.
- `HANDOFF_V0.5.7_SHARED_LINE_PAGE.md`: confirmed line-first, read-only Shared
  Line continuity design and the selected-line correctness boundary.
- `HANDOFF_V0.5.7_INNERLIFE_PAGE.md`: implemented human-readable InnerLife
  checkpoint, including full unshared-thought visibility, verified-delivery
  history, and read-does-not-write proof.
- `HANDOFF_V0.5.7_LOGS_PAGE.md`: implemented read-only Logs checkpoint, with a
  primary evidence stream, closed Advanced Diagnostics, and preserved backend
  clear-log contracts.
- `HANDOFF_V0.5.7_SETTINGS_PAGE.md`: implemented Agent First Settings checkpoint
  with Common / Capabilities / Advanced hierarchy and isolated Electron QA.
- `HANDOFF_V0.5.7_AGENT_ACCESS_PAGE.md`: implemented one-action Agent Access
  checkpoint and external-client onboarding contract.
- `HANDOFF_V0.5.7_HOME_CLARAVISION.md`: implemented shared-consciousness Home
  presence surface, truthful Agent activity semantics, and measured Canvas
  lifecycle/performance contract.
- `mac-packaging.md`: current local macOS packaging and packaged Gateway notes.

Historical notes and completed bugfix reports live under `docs/archive/`.
Archived files are useful evidence, but they are not active implementation
instructions unless a current doc links to them.
