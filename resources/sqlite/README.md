# Bundled SQLite Tools

ClaraCore Desktop uses these binaries when `node:sqlite` is unavailable.
They are copied outside `app.asar` through `build.extraResources` so the app can
spawn `sqlite3` without relying on the user's system `PATH`.

Source: official SQLite tools archives from `https://sqlite.org/2026/`, version
`3.53.3`.

Bundled targets:

- `darwin-arm64/sqlite3`
- `darwin-x64/sqlite3`
- `win32-arm64/sqlite3.exe`
- `win32-x64/sqlite3.exe`

SHA-256:

- `darwin-arm64/sqlite3`: `125681bd38d9cf9e10d46b115efe34879a928736fa0b3f6db33133792d89b6e8`
- `darwin-x64/sqlite3`: `534f6cb4f5259a7ea24b0548875252f696baf49df33553bb56b7381438952ca3`
- `win32-arm64/sqlite3.exe`: `770182f8aa2e1784a018b2995fedabf7a1bae23ff48653f0adee3c6dc2e81d9d`
- `win32-x64/sqlite3.exe`: `0bf6020e303a1a49dd576bbe259f8c2a05db689408a2f1f968714f5cf63714af`
