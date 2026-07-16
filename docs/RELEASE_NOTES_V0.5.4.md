# ClaraCore Desktop v0.5.4

`v0.5.4` is the first GitHub Release for ClaraCore Desktop and the bootstrap
release for the new user-directed update flow. Existing users install this
version manually once; later releases can then be discovered from Settings >
General > About.

## Highlights

### Manual update checks

- Check the latest public stable GitHub Release from the Desktop app.
- Select the exact installer for macOS arm64 or Windows x64.
- Open the validated installer or release-notes URL in the system browser.
- Handle up-to-date, no-release, missing-installer, offline, timeout,
  rate-limit, and malformed-response states without affecting local data.
- Keep download and installation fully user-directed. There is no background
  download, silent installation, relaunch, telemetry, or database write.

### Memory graph and state history

- Split the graph into Memory map, Relationship network, and State chain views.
- Show confirmed `supersedes` history from older facts to the current fact.
- Keep unresolved `contradicts` branches visible for review.
- Add state detail, replacement reason, zoom/pan, restricted-layer, light-theme,
  dark-theme, and reduced-motion handling.
- Preserve lazily loaded graph data across lightweight refreshes and view reopen.

### Agent and InnerLife compatibility

- Add selective-use MCP server instructions for Memoria, Shared Line, and
  waiting InnerLife shares.
- Accept `session_id` as a compatibility alias for the canonical `sessionId`.
- Preserve structured InnerLife session summaries as readable JSON text.
- Sync the packaged macOS Gateway token into the launch environment used by
  Codex; restart Codex after rotating the token.

## Downloads

- macOS Apple silicon: `ClaraCore-Desktop-0.5.4-arm64.dmg`
- Windows 64-bit: `ClaraCore-Desktop-0.5.4-x64-Setup.exe`
- Integrity hashes: `SHA256SUMS.txt`

Both installers are currently unsigned. macOS Gatekeeper or Windows SmartScreen
may require an explicit user confirmation. Signing, notarization, automatic
installation, and Linux packages remain deferred.

ClaraCore product data lives outside the application bundle. A normal manual
upgrade should preserve Memory, Shared Line, InnerLife, Gateway configuration,
and UI preferences. Back up important data before replacing a daily-use build.

## Validation

- Repository syntax, IPC-contract, SQL-interpolation, and focused runtime checks
- Memory link and state-chain repository smoke tests
- Memory graph, Settings, Gateway, and update-check Electron UI smokes
- Packaged macOS update-check smoke
- Valid macOS DMG checksum via `hdiutil verify`
- Windows x64 NSIS build and x86-64 unpacked executable inspection

Real Windows installation and the first live `v0.5.4 -> v0.5.5` update flow
remain follow-up acceptance steps.
