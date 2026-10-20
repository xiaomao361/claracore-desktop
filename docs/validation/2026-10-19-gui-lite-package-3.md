# GUI Lite third local trial — 2026-10-19

The user approved the second trial's visual direction and requested concurrent
Agent presence, distinct Agent icons, a stronger sense of life, and clearer
formatting in the current topic.

## Changes

- Four Agents can appear together in the heading. Each has its own name,
  status, stable silhouette, hue and motion phase. More observations are
  available through the activity disclosure; the observation catalog is bounded
  to 20 and prioritizes running requests.
- Life is expressed by individual silhouettes, soft ambient light, a more
  concentrated running state, fading afterglow, and one response to a new trace.
  Unchanged refreshes reuse DOM nodes and do not replay the arrival response.
  Reduced motion, the pause control, hidden windows and leaving Home stop motion.
- Topic previews and full Shared Line reading share a safe reading mode in the
  existing Markdown renderer: paragraphs, explicit headings, lists, emphasis,
  code, and unambiguous ascending circled lists. Original numbering, amounts,
  dates and uncertainty remain in the text. Ambiguous circled markers stay prose.
- Empty references move to the bottom of the reading surface. Long body text
  has a comfortable measure; the existing bounded preview and full reader remain.
- Raw HTML is escaped and reading-mode links remain text. Knowledge's default
  mode retains its original emphasis and link behavior, including text in brackets.

## Validation boundary

`npm run check` passed. A subsequent targeted check covered the final reading
mode isolation correction; the Home offline smoke and Knowledge page smoke
passed again. JavaScript syntax, stylesheet parsing, production IDs and script
paths, and `git diff --check` passed.

Offline cases include concurrent live and recent Agents, distinct stable
identities across reordering, unchanged text-node preservation, one arrival per
new observation, overflow visibility, pause/error cleanup, stale active-counter
expiry, HTML injection, original numbered values, monetary/date examples,
ambiguous markers, and Knowledge's unchanged default inline handling.

No user UI was opened or operated. Visual layout, actual animation appearance
and interaction acceptance remain pending the user's observation of this trial.

## Local artifact

The artifact is macOS arm64 Lite, product version `0.9.2`, local build ID
`gui-20261019.3`, built with `scripts/gui-lite-builder-config.js --publish never`.
It uses a local ad-hoc hardened-runtime signature and is not notarized or
published. Exact size, SHA-256 and packaged verification results are recorded
in `out/gui-lite-20261019.3/verification.json` alongside `SHA256SUMS.txt`.


Packaged checks completed successfully: Lite boundary, deep strict signature,
DMG integrity and read-only mounted payload parity, SQLite Node/CLI, and the
packaged Gateway with synthetic data. The 404 packaged source files match the
workspace byte-for-byte; metadata versions and flavor match. No validation
executable processes remained after the checks.

- Size: 126,366,574 bytes (about 126 MB)
- SHA-256: `2497c85ccd1528316211b47f5829b765ae8b4adcce0f8c3be6f07df013189d01`
