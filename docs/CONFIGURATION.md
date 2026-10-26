# Configuration

Settings are owned by Desktop. Use the settings pages to configure the Gateway,
models, Knowledge directory, backups, and optional background work.

## Models and build flavors

| Capability | Options and behavior |
| --- | --- |
| Memory embeddings | Included local model in Full, configured Ollama or compatible embedding provider, or disabled. |
| Knowledge semantic search | Local computation only: the included model or a loopback Ollama endpoint. |
| InnerLife generation | Disabled, Ollama, or an OpenAI-compatible provider. |
| Decision models | Optional OpenAI-compatible or TypeSafe/Jev integration; see [contract](DECISION_MODELS.md). |

Lite does not download a replacement embedding model automatically. Install a
suitable Ollama model yourself and select it in Settings if needed. Changing a
model may require rebuilding its associated index. A working connection does
not establish retrieval quality for a particular language or corpus.

Remote providers receive the content required by the enabled capability.
Check [Privacy and data](PRIVACY.md) before enabling them. Background InnerLife
work has both a global gate and per-agent choices; turning off the global gate
does not erase each agent's choice.

## Gateway

The normal endpoint is `http://127.0.0.1:50668/mcp`. A different port must be
configured intentionally. Tokens persist until rotated. After changing a token
or tool profile, reconnect the client; some clients also need a restart to
inherit changed environment credentials. Tool profiles are discovery settings,
not permission isolation.

## Data locations

By default, the SQLite database is `data/claracore.db` under Electron's user-data
directory: `~/Library/Application Support/claracore-desktop/` on macOS and
`%APPDATA%/claracore-desktop/` on Windows. A configured data root overrides the
default. Check Desktop's active path before a backup or maintenance operation.
The user-data directory also holds settings, credentials, tokens, caches, and
recovery state; copying only the database is not a complete application backup.

Knowledge Markdown stays in the directory you select. Its indexes are
rebuildable caches. Back up the original Markdown separately.

## Backup and restore

Use the Data page's supported backup/export and restore/import operations.
Check what each export includes before relying on it: database, Knowledge
files, credentials, configuration, and execution journals have different owners.
Keep a recoverable copy of unique data before restore, import, or changing roots.
Verify representative records after recovery. Do not replace a live SQLite file
with an arbitrary copy while the application is writing to it.

## Development isolation

Non-interactive tests and development instances can specify:

```sh
CLARACORE_DESKTOP_DATA_DIR=/tmp/claracore-example/data
CLARACORE_DESKTOP_USER_DATA_DIR=/tmp/claracore-example/user-data
CLARACORE_DESKTOP_TEST_INSTANCE=1
```

These are development overrides, not a recommendation to put everyday data in
`/tmp`. See [Contributing](../CONTRIBUTING.md).
