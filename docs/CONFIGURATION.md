# Configuration

Settings are owned by Desktop. Use the settings pages to configure the Gateway,
models, Knowledge directory, backups, and optional background work.

## Models and build flavors

| Capability | Options and behavior |
| --- | --- |
| Memory embeddings | Included local model in Full, configured Ollama or compatible embedding provider, or disabled. |
| Knowledge semantic search | Local computation only: the included model or a loopback Ollama endpoint. |
| InnerLife generation | Disabled, Ollama, or an OpenAI-compatible provider. |

Lite does not download a replacement embedding model automatically. Install a
suitable Ollama model yourself and select it in Settings if needed. Changing a
model may require rebuilding its associated index. A working connection does
not establish retrieval quality for a particular language or corpus.

Remote providers receive the content required by the enabled capability.
Check [Privacy and data](PRIVACY.md) before enabling them. Background InnerLife
work has both a global gate and per-agent choices; turning off the global gate
does not erase each agent's choice.

New installations ship without a shared generation credential, with the
generation provider disabled and the background gate off. Configure your own
provider/model and credential if required, then explicitly enable background
reflections. Existing stored settings and credential references are preserved;
upgrading does not silently turn them off or replace them.

Model lists and connection checks run only when requested in Settings. Loading
suggestions does not replace a typed model. A connection check confirms service
reachability and model-list membership, not generation quality. Unsaved form
edits survive background refreshes. Review intervals display in minutes without
rounding away existing seconds; decimals such as 1.5 preserve 90 seconds.

Retrieval defaults to both Memory and Knowledge, with semantic Knowledge search.
Explicit caller choices take priority. Decision-model settings and remote routing
requests have been removed; legacy `jev-settings.json` files remain untouched
and are no longer read.

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

Use the Data section in Settings for supported backup/export and restore/import operations.
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


## Model configuration

Settings uses one **Model configuration** entry with separate **Memory retrieval** and **Reflection generation** sections. Each section validates and saves only its own fields; saving one keeps an unsaved draft in the other section. Closing can discard both drafts. Configuring a generation model does not enable background generation.

Both Full and Lite support Ollama and OpenAI-compatible APIs for memory embeddings; Full additionally includes its built-in model. The OpenAI-compatible retrieval form accepts a base URL, embedding model and API key (or `env:NAME` reference). Reflection generation uses Ollama or OpenAI-compatible Chat Completions. Support is by protocol, without brand-specific presets or native Anthropic/Gemini adapters. A chat model is not necessarily an embedding model.

For compatible API addresses, a bare origin uses `/v1`; explicit prefixes such as `/compatible-mode/v1`, `/api/paas/v4` or `/v1beta/openai` are preserved. Model-list, embedding and chat paths share this resolution. URL-embedded credentials, query and fragment are rejected. Service support for each operation still depends on that service; model-list checks do not perform an embedding or chat request. No default credential, automatic list request or automatic generation is added.

Memory text is sent to the configured retrieval endpoint. External knowledge-base semantic indexing retains its existing **local-only** boundary (built-in or loopback Ollama); selecting a remote embedding API for memory does not enable remote knowledge indexing.

Protocol references: [OpenAI embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create), [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai). These describe protocol contracts, not end-to-end acceptance of any vendor. Local synthetic HTTP fixtures cover custom prefixes, list/embedding/chat requests, key references, 401 rejection and malformed embedding failure; real providers require user configuration and acceptance.
