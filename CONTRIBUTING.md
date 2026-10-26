# Contributing to ClaraCore Desktop

Focused bug reports, documentation improvements, and pull requests are welcome.
Please open an issue before a large feature or a change to the data model.
The [product direction](docs/POSITIONING.md) favors a small, local workspace
that preserves continuity between people and their agents.

## Development setup

Use Node.js 22, npm, Git, and the platform tools needed for Electron. Run from
this standalone repository, not from a parent workspace:

```sh
npm ci
npm run check
npm run start:next
```

`start:next` opens an isolated development instance. Its data and user-data roots
can be overridden explicitly. Do not point tests at a personal database.
A native or system SQLite CLI may be needed when the Node SQLite path is
unavailable. Packaging has additional requirements in [Packaging](docs/mac-packaging.md).

## Place a change

- `app/`, `styles/`, `app.js`: desktop renderer and presentation.
- `electron/`: lifecycle, IPC, local HTTP service, and scheduled work.
- `core/`: domain behavior, runtime, storage, and MCP contracts.
- `docs/`: maintained public guides and reference contracts.
- `website/`: static project website; see its [README](website/README.md).

Read the nearest module README and [code map](docs/CODE_MAP.md). Preserve data
ownership: Gateway routes requests to domains; it should not implement their
storage policy. Keep generated thoughts, sourced material, and confirmed facts
distinguishable.

## Validate

Run `git diff --check` and `npm run check` for normal changes. Add or run a
focused regression when behavior changes. Useful non-interactive suites include:

| Scope | Command |
| --- | --- |
| Core and data boundaries | `npm run test:core` |
| MCP and HTTP | `npm run test:gateway` |
| Knowledge | `npm run test:knowledge` |
| Backup and restore | `npm run test:backup` |
| Maintenance queues | `npm run test:desktop-maintenance` |
| Public docs and website | `npm run test:website` |

`test:smoke` and scripts using `run-ui-smoke.js` open Electron windows. Run these
only in an environment where UI automation is expected. Isolate test data with
`CLARACORE_DESKTOP_DATA_DIR`, `CLARACORE_DESKTOP_USER_DATA_DIR`, and
`CLARACORE_DESKTOP_TEST_INSTANCE=1`. HTTP tests may use port `0`; the product's
normal default remains `50668`. Stop validation services after testing.

For failure handling, preserve the difference between no result, unavailable,
partial, and failed. For transformations or migrations, compare before/after
meaning and source attribution. A successful test does not establish visual
acceptance or model quality outside the tested cases.

## Pull requests

Explain the user-visible problem and resulting behavior, list relevant
validation, and mention material compatibility or data implications. Keep
changes focused. Update public guides when the supported workflow changes.
Do not commit databases, private prompts or conversations, credentials, local
machine paths, raw provider responses, or personal test corpora.

For bug reports, include the version, operating system, build flavor, expected
and actual behavior, and minimal redacted reproduction steps. Use synthetic
examples where possible. See [Security](SECURITY.md) for sensitive reports.
