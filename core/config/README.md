# Product Configuration

Product-owned configuration logic lives here.

`index.js` owns:

- default product settings
- writable setting keys
- setting normalization and validation
- the default agent id

Settings are persisted in the Desktop-owned `claracore.db`. Secrets remain
stored as secret references/status rows rather than raw values in normal
configuration output.
