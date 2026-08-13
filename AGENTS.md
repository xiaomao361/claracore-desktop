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

Context delivery is minimum-sufficient by default. Storage richness is not
delivery richness: lists are bounded catalogs, selected objects use resume or
summary shapes, and richer context requires an explicit scoped read. Explicit
reads are still bounded; `full` never means an unlimited full-object catalog.
Do not rely on Agent prompt discipline for this boundary—enforce projection,
pagination, detail references, and response budgets in the server contract.
Apply this as progressive disclosure, not a universal shrinking target. Use a
default page of 10 for general Agent-facing catalogs and allow an explicit page
up to 50. Preserve enough preview to identify the next object, and keep an
explicitly selected object semantically complete when it fits the final safety
ceiling. Byte ceilings are regression guardrails, not product quality goals.

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
