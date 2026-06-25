# ClaraCore Desktop

ClaraCore Desktop is the local desktop manager for the first ClaraCore core package:

- Gateway
- Memoria
- Continuity
- InnerLife

It is not a chat client and does not include a primary chat model. The desktop app is meant to make the local core visible, configurable, and eventually manageable without starting every service by hand.

## v0.1 Status

The current version is a working desktop shell with read-only local awareness.

Included:

- Electron desktop app
- ClaraCore root detection
- Gateway, Memoria, Continuity, and InnerLife module presence checks
- Home, Memory, Shared Line, InnerLife, Data, Connections, and Settings pages
- MCP connection command and copyable config
- Local HTTP endpoint list
- Chinese and English UI switching
- macOS menu bar / Windows tray entry
- Real local resource monitor for uptime, CPU, memory, disk, and local time

Not included yet:

- Starting or stopping Gateway from Desktop
- Replacing the existing manually started local gateway
- Importing existing ClaraCore data into a Desktop-managed runtime
- Full backup and restore flow
- Packaged macOS release artifact
- Windows package

## Development Mode

From this directory:

```bash
npm install
npm run start
```

During development the app detects the existing ClaraCore checkout two directories above this app:

```text
../../
```

You can override that with:

```bash
CLARACORE_ROOT=/path/to/ClaraCore npm run start
```

## Commands

Check JavaScript syntax:

```bash
npm run check
```

Start the desktop app:

```bash
npm run start
```

## v0.2 Direction

The next version should move from display to real local control:

- Package a macOS app.
- Let Desktop start, stop, and restart the Gateway it owns.
- Detect and avoid interfering with a Gateway started outside Desktop.
- Use or import existing ClaraCore data safely.
- Show real service health, not just module file presence.
- Provide agent-ready MCP config for the Desktop-managed Gateway.
- Show useful startup and service logs.
