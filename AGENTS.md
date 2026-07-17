# ClaraCore Desktop Agent Rules

## Boundary

This directory is the standalone Desktop repo. Confirm `git status --short`, repo root, and remote before commit, push, branch, or release work.

## Product Direction

North star (see `docs/POSITIONING.md`): ClaraCore does not try to understand
the whole world; it maintains the world that Clara and the user own together.
Every feature must maintain that shared world, not just add capability.

Default to simplicity and restraint. The current baseline is:

- Memoria stores and recalls memory
- Continuity remembers the shared line
- InnerLife can occasionally share proactive messages
- Gateway routes access

Do not broaden these roles, add hidden automation, or redesign the page unless the user explicitly asks. Treat "先维持" as a strong stop signal for UI/version changes.

## Safe Iteration

Make one tiny closed-loop change at a time. Prefer deleting or simplifying over adding new surfaces.

For Gateway, InnerLife, or runtime polish, avoid disturbing the live app. Use isolated roots such as:

- `CLARACORE_DESKTOP_DATA_DIR=/tmp/...`
- `CLARACORE_DESKTOP_USER_DATA_DIR=/tmp/...`
- `CLARACORE_DESKTOP_TEST_INSTANCE=1`

The Gateway uses stable localhost port `50668` by default. Tests may request a
runtime-assigned port by passing port `0`; do not describe that test behavior as
the normal product contract.

## Validation

Use `git diff --check` and `npm run check` for normal checkpoints. For live-safe runtime behavior, run focused temp-root smokes and stop validation-only services before finishing.
