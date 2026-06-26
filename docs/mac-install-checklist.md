# ClaraCore Desktop macOS Install Checklist

## Before Opening

- Keep the existing local ClaraCore Gateway running or stopped exactly as it is.
- Do not point Desktop at old service databases during product-core testing.
- Use the default Desktop data directory unless testing a specific custom path.

## Install

1. Open `dist/ClaraCore-Desktop-0.1.0-arm64.dmg`.
2. Drag `ClaraCore Desktop.app` into Applications.
3. Open ClaraCore Desktop.
4. If macOS blocks the unsigned app, use the normal local unsigned-app flow for this development build.

## First Run Check

On the Home page, check `First-run check`.

Expected status:

- Data directory: ready.
- Product database: ready.
- Gateway entry: ready.
- Embedding setup: ready.
- Old services: not controlled by Desktop.

## Agent Setup

Open `Agent Setup`.

For packaged mode, the MCP config should use:

- command: the app executable inside `ClaraCore Desktop.app`
- args: `["--gateway"]`
- env: `CLARACORE_DESKTOP_DATA_DIR`

## Backup Check

Open `Data`.

1. Click `Export`.
2. Confirm a new backup appears under `Recent backups`.
3. Click `Open backups folder`.
4. Confirm the backup folder contains a `.db` file and a matching `.json` manifest.
5. Confirm the backup status is `verified` and quick check is `ok`.
6. Use restore only for verified backups created by this Desktop app.
7. Before restoring, review the current-vs-target preview and the Memory records that will return or be removed.
8. Restore requires the confirmation dialog and typing `RESTORE`.

## Current Limits

- The app is not signed or notarized yet.
- Import from old Memoria, Continuity, and InnerLife data is preview-first and backup-gated.
- Restore is limited to verified product backups, requires `RESTORE`, and creates a safety backup first.
- InnerLife background loop remains paused by default and can be enabled from Models.
- Windows packaging still needs a separate validation pass.
