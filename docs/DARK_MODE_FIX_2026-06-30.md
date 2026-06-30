# Dark Mode Fix - 2026-06-30

## Scope

This records the dark-mode style repair for ClaraCore Desktop, focused on the
Agent Access screen shown in daily use and the shared UI primitives reused by
other product views.

## Symptom

In dark mode, several surfaces still rendered with light-mode styling:

- Empty states and dashed placeholders appeared as bright blocks.
- Agent Access connection details, snippets, and install-brief code blocks used
  light backgrounds or low-contrast code text.
- Inputs, readonly fields, endpoint cards, backup/import rows, Shared Line
  cards, Memory previews, InnerLife cards, and Home trace cards could inherit
  light hard-coded backgrounds.
- Scrollbars stayed visually detached from the dark shell.

## Fix

- Added `styles/dark-fixes.css` and imported it last from `styles.css`.
- Centralized dark-mode control tokens for form controls, code text, links,
  panel backgrounds, and destructive borders.
- Added dark-mode overrides for common primitives and known view-level classes
  that previously used hard-coded light colors.
- Added explicit WebKit scrollbar styling for the shell, workspace, Agent
  Access side panel, snippets, and document previews.

The fix is intentionally CSS-only. It does not alter renderer state, runtime
data, Gateway behavior, or Electron IPC.

## Verification

- `npm run check`
- Electron + Playwright isolated launch with `CLARACORE_DESKTOP_DATA_DIR` under
  `/tmp`, `claracore.theme=dark`, and Agent Access selected.
- Verified computed styles for `.endpoint-empty`, `.snippet`, `.doc-preview`,
  `.agent-access-details`, and `.secondary` all resolve to dark backgrounds and
  readable text colors.
- Captured visual QA screenshot:
  `/tmp/claracore-agent-dark-scroll-final.png`

## Follow-up

If future views add new hard-coded light backgrounds, prefer moving them to
existing theme variables first. Keep `styles/dark-fixes.css` as the compatibility
layer for older view-specific selectors until the view CSS is fully tokenized.
