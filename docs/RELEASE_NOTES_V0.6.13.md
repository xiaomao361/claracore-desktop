# ClaraCore Desktop v0.6.13 Release Notes

Date: 2026-08-28

Status: local macOS Apple Silicon Lite trial checkpoint. This version is for
daily-use evaluation and has not been tagged, pushed, signed, notarized, or
published as a public release. Public stable remains `v0.6.12`.

## Local Trial Asset

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `ClaraCore-Desktop-0.6.13-lite-arm64.dmg` | 127,400,188 | `0d2ecbe7daf88d30dbc9e7de7158644f11514ca387eb9635df7bd64897fa1829` |

The packaged App reports version `0.6.13`; Lite package-boundary verification
and `hdiutil verify` both pass. This artifact is deliberately unsigned and is
not a substitute for a signed/notarized public release asset.

## Memory Search Quality

- Exact keyword matches remain ahead of purely semantic candidates.
- Vector candidates must pass a minimum relevance threshold; an unrelated
  nearest neighbor is no longer shown merely because it exists.
- Pure semantic results are capped at 10 instead of padding the page to 50.
- When nothing is reliable, the page states that directly and suggests a more
  specific keyword.
- The search action works from both the button and the input submission path.

## Memoria Graph Reading

### Memory map

- Keeps the existing overall structure while increasing the breathing room
  between the center and outer memories.
- Uses distinct, stable Agent colors for memory nodes and round legend marks.
- Keeps automatic labels selective, but clicking any memory reveals a readable
  title or excerpt and its structural position instead of an empty/zero-only
  panel.

### Relationship network

- Shows explicit fact-to-fact links rather than repeating the label-centered
  memory map.
- Opens on the largest connected relationship cluster and lists the remaining
  clusters for direct switching.
- Uses degree-aware node size, fewer labels, and quieter edges/arrows so the
  linked structure reads before the decoration.

### State chains

- Opens with an overview of all state chains. Replacement detail appears only
  after one chain is selected.
- Reads vertically from the current conclusion to earlier versions, with the
  replacement reason kept beside the relevant transition.
- Uses readable excerpts when a stored title is only an internal memory ID.
- Uses one fixed internal vertical scroll path. Wheel input no longer changes
  graph scale or node spacing, switching chains preserves the outer page
  position, and long previews clamp without creating nested scrollbars.
- The overview, chain cards, reading guide, and detail stage now use semantic
  surface colors, keeping titles and supporting text readable in both light
  and dark appearances.

## Validation And Trial Boundary

- Automated retrieval coverage checks keyword precedence, vector thresholding,
  reliable empty state, and the 10-result semantic cap.
- Automated UI coverage checks memory-node details, Agent color distinctions,
  relationship-cluster switching, state-chain overview-first behavior,
  timeline scrolling, stable page position, and readable truncation.
- The local Lite DMG is an unsigned test artifact. Visual comfort, long-session
  usefulness, and real-memory semantics remain the purpose of the user's daily
  trial; they are not claimed by automated checks.
