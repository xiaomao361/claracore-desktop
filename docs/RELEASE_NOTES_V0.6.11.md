# ClaraCore Desktop v0.6.11 Release Notes

Date: 2026-08-14

Status: development checkpoint. Packaging, signing, notarization, Windows
builds, publication, and live installed-app acceptance are not complete.

## App Startup

- Settings > App & data > App preferences now includes **Start ClaraCore at
  login**.
- The setting uses the operating system login-item registration on installed
  macOS and Windows builds.
- A system-login launch starts quietly in the tray instead of opening the main
  window. Opening ClaraCore directly still shows the main window.
- Development, test, and unsupported-platform sessions show the setting as
  unavailable and never modify the machine's login items.
- The displayed value comes from the operating system rather than a second
  ClaraCore-only copy, so Settings reflects the current registration state.

## Validation Boundary

- The login-item adapter has focused enable, disable, hidden-login-launch,
  unsupported-platform, and development-safety coverage.
- The isolated Settings UI smoke verifies the unavailable development state
  and preference persistence without changing the host login configuration.
- Installed macOS and Windows acceptance remains required before this version
  can be described as a public release.
