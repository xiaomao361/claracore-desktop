# ClaraCore Desktop v0.6.9 Release Notes

## Status

`v0.6.9` is the current public release. It contains a Developer ID signed,
Apple-notarized, and stapled macOS Apple Silicon Lite DMG plus its SHA-256
checksum. Full, Windows, Intel macOS, and Mac App Store packages are not part of
this release.

## Assets

- `ClaraCore-Desktop-0.6.9-lite-arm64.dmg`
- `SHA256SUMS.txt`
- Size: 126,738,439 bytes (120.9 MiB DMG; 292.7 MiB unpacked App)
- SHA-256: `70e8f90b5a802b4205cf2d12a91e063d8879ea05116640a3aaa89b50c110202a`

## What Changed

### One design language across the Desktop

The human UI now follows one restrained reading model. Memoria, Shared Line,
InnerLife, Trace, Logs, Agent Access, and Settings each use one continuous page
surface; cards remain only for independent records, evidence, or actions. Copy
states the object, status, and next action directly instead of repeatedly
explaining what a module is not.

The Home page keeps its distinct overview role. The current Shared Line is the
primary content, recent verified Agent activity is supporting evidence, and
actions lead to Shared Line, Trace, Logs, or Agent Access. Pending or unreviewed
InnerLife content is never previewed on Home.

### Human-readable evidence without losing detail

- Memoria shows its write-to-recall path and recent Controller evidence,
  separating retrieval need, candidates, relevance, return, delivery, and use.
- Shared Line exposes its continuation path, current position, evidence, and
  archives through one reader without changing Agent-active state.
- InnerLife separates thoughts still inside from confirmed conversational
  delivery and keeps raw diagnostics behind one reading layer.
- Trace describes confirmed shared-world history; it no longer presents
  completed counts as an approval queue or duplicates Memory Controller logs.
- Logs presents current issues and readable event rows first, with raw records,
  decay diagnostics, and time sequence available in detail.

### Agent Guide ships with the product

`gateway_docs` is now a versioned Agent Guide. Agents can request a maintained
section or search it with `query`; the guide version is release-gated against
the application version. Agent Access displays that version and its copied
brief tells Agents to reread the guide after an upgrade or reconnect.

### Simpler InnerLife model settings

InnerLife now uses one configured model instead of separate light and deep
model fields. Migration `007_innerlife_single_model` preserves an existing
light model first and falls back to the former deep model when needed. Custom
poll intervals and provider credentials remain unchanged.

## Upgrade Notes

- Product data remains in the existing Desktop-owned SQLite data directory.
- Existing Memoria, Shared Lines, InnerLife records, identities, and Gateway
  token are preserved.
- Restart Desktop and reconnect the Agent after upgrading. Recopying the Agent
  Access brief is recommended so the Agent learns the versioned `gateway_docs`
  contract.
- Lite still excludes the built-in embedding runtime and supports Ollama or a
  disabled Memory embedding provider.

## Verification

Source acceptance covers the complete maintained smoke suite, HTTP Gateway,
Memory Controller, Lite flavor, update flow, responsive UI, and diff checks.
Final release acceptance separately verifies Developer ID signatures, Hardened
Runtime, Apple notarization, stapling, Gatekeeper, DMG integrity, Lite package
boundaries, packaged Gateway version, GitHub publication, and a fresh public
download.

Local release acceptance completed on 2026-08-12:

- Apple accepted App submission `367868dc-0613-41e9-81c5-ea4a4b400918` and DMG
  submission `eb07b6bb-dfc4-48ce-8e09-6041510dd1cc`;
- App and DMG signatures pass strict verification with Hardened Runtime and a
  trusted timestamp;
- both stapled tickets validate and Gatekeeper reports `Notarized Developer ID`;
- `hdiutil verify`, the 292.7 MiB Lite package boundary, and the packaged
  Gateway smoke pass; the packaged Gateway reports version `0.6.9`.
