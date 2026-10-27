# Changelog

User-facing release highlights are recorded here. Installers and checksums are
published in [GitHub Releases](https://github.com/xiaomao361/claracore-desktop/releases).

## 1.0.6 — Local unsigned test build, 2026-10-27 (not publicly released)

- Repeated session starts return a current briefing while retaining the same
  session and its original historical opening snapshot.
- Startup has one share recommendation in `share_plan`; consumed or retired
  share thoughts no longer reappear as open loops in the summary briefing.
- Briefings distinguish the current pending total from the five delivered
  previews. Session catalogs include each line's recorded next step.
- The personal creflex hook filters four explicitly configured project lines
  at the home directory, shows next steps, refreshes legacy briefings, and
  reads pending counts each turn without its former ten-minute cache.
- Hook-only follow-up explains cwd exclusions by title and line ID, and
  preserves candidate interpretation status. See the [test baseline](docs/AGENT_EXPERIENCE_TESTING.md).

## 1.0.5 — Local unsigned test build, 2026-10-27 (not publicly released)

- Agent-filtered Shared Line catalogs and ambiguity hints use the same order;
  another session's global selection no longer moves catalog candidates.
- `isGlobalFallback` describes the global pointer explicitly. `isCurrent` is
  retained as a compatibility alias and does not mean session selection.
- Shared Line catalog timestamps use timezone-explicit ISO 8601 and compare
  timestamps by instant, without rewriting stored history.
- Session startup bundles bounded catalog previews for one opening candidate
  source. The creflex hook shows a ten-line page, avoids duplicate candidate
  sets, and links remaining pages instead of repeating page one.

## 1.0.4 — Local test build, 2026-10-27 (not publicly released)

- Ambiguous session briefings include identifiable Shared Line candidates,
  position previews, update times, the real total, and a catalog recovery route.
- Session startup offers InnerLife thoughts for conversational review instead
  of instructing an immediate opening before the conversation is known.
- Agents can find Shared Lines by a literal query in titles, latest positions,
  or next steps, with existing agent/lifecycle filters and truthful pagination.
- Automatic context defaults to a compact result; callers can inspect the
  existing Memory decision without another recall or request full diagnostics.
- Key Shared Line and Memory previews identify clipped fields and point to
  their stored source instead of appearing complete.
- Shared Line progress writes return an explicit persistence receipt and
  read-back reference. Invalid detail is rejected before line mutations.

## 1.0.3 — 2026-10-26

- Maintenance audits now report pending Memory embeddings independently from
  missing, failed, or stale records. Pending work no longer appears fully healthy.
- Runtime maintenance results refresh after processing, showing completed,
  partially completed, disabled, and failed work accurately.
- Includes the MCP catalog and InnerLife improvements below. Available as
  Full and Lite for macOS Apple Silicon and Windows x64.

## Included improvements since 1.0.0

### 1.0.2

- A smaller daily MCP catalog: 25 default tools, a 38-tool compatibility
  profile, and 83 canonical tools in the full catalog.
- Sixteen older tool names remain callable through compatibility adapters.
  Clients can migrate without losing existing workflows.

### 1.0.1

- InnerLife's candidate pool is bounded to ten items per agent with a seven-day
  lifetime. Retired suggestions retain their original text and recorded reason.
- Per-agent background choices remain independent from the global switch.

## 1.0.0 — 2026-10-20

- Shared understanding workspace with Home, Memory, Shared Lines, InnerLife,
  and Knowledge views.
- Refreshed desktop identity and navigation.
- Explicit understanding planning and recovery through existing domain tools.

## Earlier releases

See [GitHub Releases](https://github.com/xiaomao361/claracore-desktop/releases)
for historical packages and version-specific changes.
